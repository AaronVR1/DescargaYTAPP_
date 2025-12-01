const { execFile, spawn } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const https = require('https');
const http = require('http');

const execFileAsync = promisify(execFile);

const ytDlpPath = path.join(__dirname, '../../bin/yt-dlp.exe');
const ffmpegPath = path.join(__dirname, '../../bin/ffmpeg.exe');
const tempDir = path.join(__dirname, '../../temp');

// Almacenar jobs activos
const activeJobs = new Map();

function getPlaylistId(url) {
  const patterns = [
    /list=([a-zA-Z0-9_-]+)/,  // Playlist ID
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function isValidPlaylistUrl(url) {
  return url.includes('list=') && (url.includes('youtube.com') || url.includes('youtu.be'));
}

function cleanupOldFiles() {
  try {
    const files = fs.readdirSync(tempDir);
    const now = Date.now();
    
    files.forEach(file => {
      const filePath = path.join(tempDir, file);
      try {
        const stats = fs.statSync(filePath);
        const ageInHours = (now - stats.mtimeMs) / (1000 * 60 * 60);
        
        if (ageInHours > 2) { // 2 horas para dar tiempo a descargar
          if (fs.statSync(filePath).isDirectory()) {
            fs.rmSync(filePath, { recursive: true, force: true });
          } else {
            fs.unlinkSync(filePath);
          }
          console.log('🧹 Archivo viejo eliminado:', file);
        }
      } catch (e) {
        // Ignorar errores individuales
      }
    });
  } catch (e) {
    console.log('⚠️ Error al limpiar archivos:', e.message);
  }
}

// Función para descargar imágenes (thumbnails)
function downloadImage(url, filePath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(filePath);

    protocol.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(filePath);
      });
    }).on('error', (err) => {
      fs.unlink(filePath, () => {});
      reject(err);
    });
  });
}

// Función para enviar eventos SSE
function sendSSE(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

exports.getPlaylistInfo = async (req, res) => {
  try {
    const url = req.query.url;

    if (!url) {
      return res.status(400).json({ error: 'URL es requerida' });
    }

    if (!isValidPlaylistUrl(url)) {
      return res.status(400).json({ error: 'URL no es una playlist válida' });
    }

    console.log('📥 Obteniendo info de la playlist:', url);

    const { stdout } = await execFileAsync(ytDlpPath, [
      '-j',
      '--flat-playlist',
      '--no-warnings',
      url
    ], { maxBuffer: 50 * 1024 * 1024 });

    const lines = stdout.trim().split('\n');
    const videos = lines.map(line => {
      try {
        return JSON.parse(line);
      } catch (e) {
        return null;
      }
    }).filter(v => v !== null);

    console.log(`✅ Playlist contiene ${videos.length} videos`);

    // ⭐ Obtener thumbnail del primer video de la playlist
    let thumbnail = null;
    if (videos.length > 0 && videos[0].id) {
      // YouTube thumbnail estándar del primer video (mqdefault = medium quality)
      thumbnail = `https://i.ytimg.com/vi/${videos[0].id}/mqdefault.jpg`;
      console.log(`🖼️ Thumbnail de playlist: ${thumbnail}`);
    }

    const playlistInfo = {
      title: videos[0]?.playlist_title || 'Playlist',
      videoCount: videos.length,
      thumbnail: thumbnail, // ⭐ NUEVO: Miniatura de la playlist
      videos: videos.slice(0, 50).map(v => ({
        title: v.title,
        id: v.id,
        duration: v.duration || 0
      }))
    };

    res.json(playlistInfo);

  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({ error: 'Error al obtener información de la playlist', message: error.message });
  }
};

// ⭐ NUEVA FUNCIÓN: Descargar playlist AUDIO con progreso
exports.downloadPlaylistAudioWithProgress = async (req, res) => {
  const url = req.query.url;

  if (!url) {
    return res.status(400).json({ error: 'URL es requerida' });
  }

  if (!isValidPlaylistUrl(url)) {
    return res.status(400).json({ error: 'URL no es una playlist válida' });
  }

  // Configurar SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const playlistId = getPlaylistId(url);
  const timestamp = Date.now();
  const jobId = `audio_${playlistId}_${timestamp}`;
  const playlistTempDir = path.join(tempDir, jobId);
  const zipPath = path.join(tempDir, `${jobId}.zip`);

  try {
    cleanupOldFiles();

    // Crear directorio temporal
    if (!fs.existsSync(playlistTempDir)) {
      fs.mkdirSync(playlistTempDir, { recursive: true });
    }

    sendSSE(res, 'status', { message: '📋 Obteniendo lista de videos...', progress: 5 });

    // Obtener lista de videos
    const { stdout } = await execFileAsync(ytDlpPath, [
      '-j',
      '--flat-playlist',
      '--no-warnings',
      url
    ], { maxBuffer: 50 * 1024 * 1024 });

    const lines = stdout.trim().split('\n');
    const videoList = lines.map(line => {
      try {
        return JSON.parse(line);
      } catch (e) {
        return null;
      }
    }).filter(v => v !== null);

    const totalVideos = videoList.length;
    sendSSE(res, 'status', { 
      message: `📹 Encontrados ${totalVideos} videos`, 
      progress: 10,
      total: totalVideos 
    });

    console.log(`🎵 Iniciando descarga de ${totalVideos} audios...`);

    // Descargar videos uno por uno con progreso
    for (let i = 0; i < totalVideos; i++) {
      const video = videoList[i];
      const videoUrl = `https://www.youtube.com/watch?v=${video.id}`;
      const progress = Math.round(10 + (i / totalVideos) * 70);
      
      sendSSE(res, 'status', { 
        message: `🎵 Descargando: ${video.title}`,
        progress: progress,
        current: i + 1,
        total: totalVideos
      });

      try {
        // Sanitizar nombre del archivo
        const sanitizedTitle = video.title
          .replace(/[<>:"/\\|?*]/g, '')
          .substring(0, 100);

        const tempMp3 = path.join(playlistTempDir, `temp_${video.id}.mp3`);
        const coverImage = path.join(playlistTempDir, `cover_${video.id}.jpg`);
        const finalMp3 = path.join(playlistTempDir, `${sanitizedTitle}.mp3`);

        // Descargar audio sin portada primero
        await execFileAsync(ytDlpPath, [
          '-f', 'bestaudio/best',
          '-x',
          '--audio-format', 'mp3',
          '--audio-quality', '320K',
          '--ffmpeg-location', ffmpegPath,
          '-o', tempMp3,
          '--no-warnings',
          videoUrl
        ], {
          maxBuffer: 100 * 1024 * 1024,
          timeout: 600000
        });

        // Obtener información del video para thumbnail y metadatos
        const { stdout } = await execFileAsync(ytDlpPath, [
          '-j',
          '--no-warnings',
          videoUrl
        ], { maxBuffer: 10 * 1024 * 1024 });

        const videoData = JSON.parse(stdout);
        const thumbnailUrl = videoData.thumbnail;
        const artist = videoData.uploader || 'Unknown Artist';

        // Descargar thumbnail
        if (thumbnailUrl) {
          try {
            await downloadImage(thumbnailUrl, coverImage);
            
            // Incrustar portada en el MP3 con FFmpeg
            await execFileAsync(ffmpegPath, [
              '-i', tempMp3,
              '-i', coverImage,
              '-c', 'copy',
              '-map', '0',
              '-map', '1',
              '-metadata:s:v', 'title=Album cover',
              '-metadata:s:v', 'comment=Cover',
              '-metadata', `title=${video.title}`,
              '-metadata', `artist=${artist}`,
              '-id3v2_version', '3',
              '-y',
              finalMp3
            ], {
              maxBuffer: 100 * 1024 * 1024,
              timeout: 300000
            });

            // Limpiar archivos temporales
            if (fs.existsSync(tempMp3)) fs.unlinkSync(tempMp3);
            if (fs.existsSync(coverImage)) fs.unlinkSync(coverImage);
          } catch (e) {
            console.log(`⚠️ Error incrustando portada para ${video.title}, usando MP3 sin portada`);
            // Si falla, usar el MP3 sin portada
            if (fs.existsSync(tempMp3)) {
              fs.copyFileSync(tempMp3, finalMp3);
              fs.unlinkSync(tempMp3);
            }
          }
        } else {
          // No hay thumbnail, usar MP3 sin portada
          if (fs.existsSync(tempMp3)) {
            fs.copyFileSync(tempMp3, finalMp3);
            fs.unlinkSync(tempMp3);
          }
        }

      } catch (e) {
        console.log(`⚠️ Error descargando ${video.title}:`, e.message);
        sendSSE(res, 'warning', { 
          message: `⚠️ No se pudo descargar: ${video.title}` 
        });
      }
    }

    sendSSE(res, 'status', { message: '📦 Comprimiendo archivos...', progress: 85 });

    // Crear ZIP
    await createZip(playlistTempDir, zipPath);

    const zipSize = fs.statSync(zipPath).size;
    console.log(`✅ ZIP creado: ${(zipSize / (1024 * 1024)).toFixed(2)} MB`);

    // Guardar info del job
    activeJobs.set(jobId, {
      zipPath: zipPath,
      playlistTempDir: playlistTempDir,
      createdAt: Date.now()
    });

    sendSSE(res, 'complete', { 
      message: '✅ ¡Descarga completa!',
      progress: 100,
      jobId: jobId,
      size: `${(zipSize / (1024 * 1024)).toFixed(2)} MB`
    });

    res.end();

  } catch (error) {
    console.error('❌ Error:', error.message);
    sendSSE(res, 'error', { 
      message: 'Error al descargar playlist',
      error: error.message 
    });
    res.end();
    
    // Limpiar archivos
    try {
      if (playlistTempDir && fs.existsSync(playlistTempDir)) {
        fs.rmSync(playlistTempDir, { recursive: true, force: true });
      }
      if (zipPath && fs.existsSync(zipPath)) {
        fs.unlinkSync(zipPath);
      }
    } catch (e) {}
  }
};

// ⭐ NUEVA FUNCIÓN: Descargar playlist VIDEO con progreso
exports.downloadPlaylistVideoWithProgress = async (req, res) => {
  const url = req.query.url;

  if (!url) {
    return res.status(400).json({ error: 'URL es requerida' });
  }

  if (!isValidPlaylistUrl(url)) {
    return res.status(400).json({ error: 'URL no es una playlist válida' });
  }

  // Configurar SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const playlistId = getPlaylistId(url);
  const timestamp = Date.now();
  const jobId = `video_${playlistId}_${timestamp}`;
  const playlistTempDir = path.join(tempDir, jobId);
  const zipPath = path.join(tempDir, `${jobId}.zip`);

  try {
    cleanupOldFiles();

    // Crear directorio temporal
    if (!fs.existsSync(playlistTempDir)) {
      fs.mkdirSync(playlistTempDir, { recursive: true });
    }

    sendSSE(res, 'status', { message: '📋 Obteniendo lista de videos...', progress: 5 });

    // Obtener lista de videos
    const { stdout } = await execFileAsync(ytDlpPath, [
      '-j',
      '--flat-playlist',
      '--no-warnings',
      url
    ], { maxBuffer: 50 * 1024 * 1024 });

    const lines = stdout.trim().split('\n');
    const videoList = lines.map(line => {
      try {
        return JSON.parse(line);
      } catch (e) {
        return null;
      }
    }).filter(v => v !== null);

    const totalVideos = videoList.length;
    sendSSE(res, 'status', { 
      message: `📹 Encontrados ${totalVideos} videos`, 
      progress: 10,
      total: totalVideos 
    });

    console.log(`📹 Iniciando descarga de ${totalVideos} videos...`);

    // Descargar videos uno por uno con progreso
    for (let i = 0; i < totalVideos; i++) {
      const video = videoList[i];
      const videoUrl = `https://www.youtube.com/watch?v=${video.id}`;
      const progress = Math.round(10 + (i / totalVideos) * 70);
      
      sendSSE(res, 'status', { 
        message: `📹 Descargando: ${video.title}`,
        progress: progress,
        current: i + 1,
        total: totalVideos
      });

      try {
        await execFileAsync(ytDlpPath, [
          '-f', 'best[vcodec^=avc1]/best[vcodec^=h264]/best',
          '-o', path.join(playlistTempDir, '%(title)s.%(ext)s'),
          '-R', '3',
          '--no-warnings',
          videoUrl
        ], {
          maxBuffer: 100 * 1024 * 1024,
          timeout: 600000 // 10 minutos por video
        });
      } catch (e) {
        console.log(`⚠️ Error descargando ${video.title}:`, e.message);
        sendSSE(res, 'warning', { 
          message: `⚠️ No se pudo descargar: ${video.title}` 
        });
      }
    }

    sendSSE(res, 'status', { message: '📦 Comprimiendo archivos...', progress: 85 });

    // Crear ZIP
    await createZip(playlistTempDir, zipPath);

    const zipSize = fs.statSync(zipPath).size;
    console.log(`✅ ZIP creado: ${(zipSize / (1024 * 1024)).toFixed(2)} MB`);

    // Guardar info del job
    activeJobs.set(jobId, {
      zipPath: zipPath,
      playlistTempDir: playlistTempDir,
      createdAt: Date.now()
    });

    sendSSE(res, 'complete', { 
      message: '✅ ¡Descarga completa!',
      progress: 100,
      jobId: jobId,
      size: `${(zipSize / (1024 * 1024)).toFixed(2)} MB`
    });

    res.end();

  } catch (error) {
    console.error('❌ Error:', error.message);
    sendSSE(res, 'error', { 
      message: 'Error al descargar playlist',
      error: error.message 
    });
    res.end();
    
    // Limpiar archivos
    try {
      if (playlistTempDir && fs.existsSync(playlistTempDir)) {
        fs.rmSync(playlistTempDir, { recursive: true, force: true });
      }
      if (zipPath && fs.existsSync(zipPath)) {
        fs.unlinkSync(zipPath);
      }
    } catch (e) {}
  }
};

// ⭐ NUEVA FUNCIÓN: Descargar ZIP generado
exports.downloadPlaylistZip = async (req, res) => {
  try {
    const jobId = req.params.jobId;
    const job = activeJobs.get(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job no encontrado o expirado' });
    }

    if (!fs.existsSync(job.zipPath)) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }

    console.log('📤 Enviando ZIP al cliente...');

    res.download(job.zipPath, `${jobId}.zip`, (err) => {
      if (err) {
        console.error('❌ Error al enviar:', err.message);
      } else {
        console.log('✅ ZIP enviado');
      }

      // Limpiar después de 10 segundos
      setTimeout(() => {
        try {
          if (job.playlistTempDir && fs.existsSync(job.playlistTempDir)) {
            fs.rmSync(job.playlistTempDir, { recursive: true, force: true });
          }
          if (job.zipPath && fs.existsSync(job.zipPath)) {
            fs.unlinkSync(job.zipPath);
          }
          activeJobs.delete(jobId);
          console.log('🧹 Job eliminado:', jobId);
        } catch (e) {
          console.log('⚠️ Error al limpiar:', e.message);
        }
      }, 10000);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({ error: 'Error al descargar archivo', message: error.message });
  }
};

// ===== FUNCIONES ANTIGUAS (mantener compatibilidad) =====
exports.downloadPlaylistAudio = async (req, res) => {
  let zipPath = null;
  let playlistTempDir = null;

  try {
    const url = req.query.url;

    if (!url) {
      return res.status(400).json({ error: 'URL es requerida' });
    }

    if (!isValidPlaylistUrl(url)) {
      return res.status(400).json({ error: 'URL no es una playlist válida' });
    }

    cleanupOldFiles();

    const playlistId = getPlaylistId(url);
    const timestamp = Date.now();
    playlistTempDir = path.join(tempDir, `playlist_audio_${playlistId}_${timestamp}`);
    zipPath = path.join(tempDir, `playlist_audio_${playlistId}_${timestamp}.zip`);

    // Crear directorio temporal
    if (!fs.existsSync(playlistTempDir)) {
      fs.mkdirSync(playlistTempDir, { recursive: true });
    }

    console.log('🎵 Descargando playlist como MP3...');

    // Descargar todos los audios
    await execFileAsync(ytDlpPath, [
      '-f', 'bestaudio/best',
      '-x',
      '--audio-format', 'mp3',
      '--audio-quality', '320K',
      '--ffmpeg-location', ffmpegPath,
      '-o', path.join(playlistTempDir, '%(title)s.%(ext)s'),
      '--no-warnings',
      url
    ], {
      maxBuffer: 100 * 1024 * 1024,
      timeout: 7200000 // 2 horas
    });

    console.log('✅ Audios descargados');

    // Crear ZIP
    console.log('📦 Creando ZIP...');
    await createZip(playlistTempDir, zipPath);

    const zipSize = fs.statSync(zipPath).size;
    console.log(`✅ ZIP creado: ${(zipSize / (1024 * 1024)).toFixed(2)} MB`);

    // Enviar ZIP
    res.download(zipPath, `playlist_audio_${timestamp}.zip`, (err) => {
      if (err) {
        console.error('❌ Error al enviar:', err.message);
      } else {
        console.log('✅ ZIP enviado');
      }

      // Limpiar después de 5 segundos
      setTimeout(() => {
        try {
          if (playlistTempDir && fs.existsSync(playlistTempDir)) {
            fs.rmSync(playlistTempDir, { recursive: true, force: true });
          }
          if (zipPath && fs.existsSync(zipPath)) {
            fs.unlinkSync(zipPath);
          }
          console.log('🧹 Temporales eliminados');
        } catch (e) {
          console.log('⚠️ Error al limpiar:', e.message);
        }
      }, 5000);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    try {
      if (playlistTempDir && fs.existsSync(playlistTempDir)) {
        fs.rmSync(playlistTempDir, { recursive: true, force: true });
      }
      if (zipPath && fs.existsSync(zipPath)) {
        fs.unlinkSync(zipPath);
      }
    } catch (e) {}
    res.status(500).json({ error: 'Error al descargar playlist', message: error.message });
  }
};

exports.downloadPlaylistVideo = async (req, res) => {
  let zipPath = null;
  let playlistTempDir = null;

  try {
    const url = req.query.url;

    if (!url) {
      return res.status(400).json({ error: 'URL es requerida' });
    }

    if (!isValidPlaylistUrl(url)) {
      return res.status(400).json({ error: 'URL no es una playlist válida' });
    }

    cleanupOldFiles();

    const playlistId = getPlaylistId(url);
    const timestamp = Date.now();
    playlistTempDir = path.join(tempDir, `playlist_video_${playlistId}_${timestamp}`);
    zipPath = path.join(tempDir, `playlist_video_${playlistId}_${timestamp}.zip`);

    // Crear directorio temporal
    if (!fs.existsSync(playlistTempDir)) {
      fs.mkdirSync(playlistTempDir, { recursive: true });
    }

    console.log('📹 Descargando playlist como MP4...');

    // Descargar todos los videos
    await execFileAsync(ytDlpPath, [
      '-f', 'best[vcodec^=avc1]/best[vcodec^=h264]/best',
      '-o', path.join(playlistTempDir, '%(title)s.%(ext)s'),
      '-R', '3',
      '--no-warnings',
      url
    ], {
      maxBuffer: 100 * 1024 * 1024,
      timeout: 7200000 // 2 horas
    });

    console.log('✅ Videos descargados');

    // Crear ZIP
    console.log('📦 Creando ZIP...');
    await createZip(playlistTempDir, zipPath);

    const zipSize = fs.statSync(zipPath).size;
    console.log(`✅ ZIP creado: ${(zipSize / (1024 * 1024)).toFixed(2)} MB`);

    // Enviar ZIP
    res.download(zipPath, `playlist_video_${timestamp}.zip`, (err) => {
      if (err) {
        console.error('❌ Error al enviar:', err.message);
      } else {
        console.log('✅ ZIP enviado');
      }

      // Limpiar después de 5 segundos
      setTimeout(() => {
        try {
          if (playlistTempDir && fs.existsSync(playlistTempDir)) {
            fs.rmSync(playlistTempDir, { recursive: true, force: true });
          }
          if (zipPath && fs.existsSync(zipPath)) {
            fs.unlinkSync(zipPath);
          }
          console.log('🧹 Temporales eliminados');
        } catch (e) {
          console.log('⚠️ Error al limpiar:', e.message);
        }
      }, 5000);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    try {
      if (playlistTempDir && fs.existsSync(playlistTempDir)) {
        fs.rmSync(playlistTempDir, { recursive: true, force: true });
      }
      if (zipPath && fs.existsSync(zipPath)) {
        fs.unlinkSync(zipPath);
      }
    } catch (e) {}
    res.status(500).json({ error: 'Error al descargar playlist', message: error.message });
  }
};

// Función auxiliar para crear ZIP
function createZip(sourceDir, outputPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 6 } });

    output.on('close', () => resolve());
    archive.on('error', reject);

    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}