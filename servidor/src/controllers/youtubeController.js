const { execFile } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

const execFileAsync = promisify(execFile);

const ytDlpPath = path.join(__dirname, '../../bin/yt-dlp.exe');
const ffmpegPath = path.join(__dirname, '../../bin/ffmpeg.exe');
const tempDir = path.join(__dirname, '../../temp');

function getVideoId(url) {
  const patterns = [
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// ⭐ NUEVA FUNCIÓN: Sanitizar nombres de archivo
function sanitizeFilename(filename) {
  return filename
    .replace(/[<>:"/\\|?*]/g, '') // Quitar caracteres inválidos
    .replace(/\s+/g, ' ')          // Múltiples espacios → un espacio
    .trim()                         // Quitar espacios al inicio/fin
    .substring(0, 100);             // Máximo 100 caracteres
}

function cleanupOldFiles() {
  try {
    const files = fs.readdirSync(tempDir);
    const now = Date.now();
    
    files.forEach(file => {
      const filePath = path.join(tempDir, file);
      const stats = fs.statSync(filePath);
      const ageInHours = (now - stats.mtimeMs) / (1000 * 60 * 60);
      
      if (ageInHours > 1) {
        fs.unlinkSync(filePath);
        console.log('🧹 Archivo viejo eliminado:', file);
      }
    });
  } catch (e) {
    console.log('⚠️ Error al limpiar archivos:', e.message);
  }
}

function waitForFile(filePath, timeout = 60000) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const checkInterval = setInterval(() => {
      if (fs.existsSync(filePath)) {
        clearInterval(checkInterval);
        resolve(filePath);
      } else if (Date.now() - startTime > timeout) {
        clearInterval(checkInterval);
        resolve(null);
      }
    }, 500);
  });
}

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

exports.getVideoInfo = async (req, res) => {
  try {
    const url = req.query.url;
    
    if (!url) {
      return res.status(400).json({ error: 'URL es requerida' });
    }

    console.log('📥 Petición de info recibida:', url);

    const videoId = getVideoId(url);
    if (!videoId) {
      return res.status(400).json({ error: 'URL de YouTube inválida' });
    }

    console.log('🔍 Obteniendo info del video ID:', videoId);

    const { stdout } = await execFileAsync(ytDlpPath, [
      '-j',
      '--no-warnings',
      url
    ], { maxBuffer: 10 * 1024 * 1024 });

    const videoData = JSON.parse(stdout);

    const info = {
      title: videoData.title || 'Desconocido',
      duration: videoData.duration ? `${Math.floor(videoData.duration / 60)}:${String(videoData.duration % 60).padStart(2, '0')}` : 'N/A',
      views: videoData.view_count ? `${(videoData.view_count / 1000000).toFixed(1)}M` : 'N/A',
      channel: videoData.uploader || 'Desconocido',
      thumbnail: videoData.thumbnail || '',
      description: videoData.description || ''
    };

    console.log('✅ Info obtenida:', info.title);
    res.json(info);

  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({ error: 'Error al obtener información', message: error.message });
  }
};

exports.downloadVideo = async (req, res) => {
  let outputPath = null;

  try {
    const url = req.query.url;

    if (!url) {
      return res.status(400).json({ error: 'URL es requerida' });
    }

    const videoId = getVideoId(url);
    if (!videoId) {
      return res.status(400).json({ error: 'URL inválida' });
    }

    cleanupOldFiles();

    const timestamp = Date.now();
    const outputFile = path.join(tempDir, `video_${videoId}_${timestamp}.mp4`);

    console.log('⏳ Descargando video en MP4...');

    await execFileAsync(ytDlpPath, [
      '-f', 'best[vcodec^=avc1]/best[vcodec^=h264]/best',
      url,
      '-o', outputFile,
      '-R', '3',
      '--no-warnings'
    ], {
      maxBuffer: 500 * 1024 * 1024,
      timeout: 7200000
    });

    const videoFileExists = await waitForFile(outputFile, 180000);
    if (!videoFileExists) {
      return res.status(500).json({ error: 'Error: No se pudo descargar el video' });
    }

    if (!fs.existsSync(outputFile)) {
      return res.status(500).json({ error: 'Error: Archivo de video no existe' });
    }

    const fileSize = fs.statSync(outputFile).size;
    console.log(`✅ Video descargado: ${(fileSize / (1024 * 1024)).toFixed(2)} MB`);

    if (fileSize < 500000) {
      fs.unlinkSync(outputFile);
      return res.status(500).json({ error: 'Error: Archivo muy pequeño' });
    }

    outputPath = outputFile;

    console.log('📤 Enviando video al cliente...');

    res.download(outputFile, `video_${videoId}.mp4`, (err) => {
      if (err) {
        console.error('❌ Error al enviar:', err.message);
      } else {
        console.log('✅ Enviado exitosamente');
      }

      setTimeout(() => {
        try {
          if (outputPath && fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
            console.log('🧹 Temporales eliminados');
          }
        } catch (e) {}
      }, 5000);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    try {
      if (outputPath && fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }
    } catch (e) {}
    res.status(500).json({ error: 'Error al descargar', message: error.message });
  }
};

exports.downloadAudio = async (req, res) => {
  let outputPath = null;
  let tempMp3 = null;
  let coverImage = null;

  try {
    const url = req.query.url;

    if (!url) {
      return res.status(400).json({ error: 'URL es requerida' });
    }

    const videoId = getVideoId(url);
    if (!videoId) {
      return res.status(400).json({ error: 'URL inválida' });
    }

    cleanupOldFiles();

    // ⭐ PRIMERO: Obtener información del video para el título
    console.log('📋 Obteniendo información del video...');
    const { stdout: infoStdout } = await execFileAsync(ytDlpPath, [
      '-j',
      '--no-warnings',
      url
    ], { maxBuffer: 10 * 1024 * 1024 });

    const videoData = JSON.parse(infoStdout);
    const title = videoData.title || 'Desconocido';
    const artist = videoData.uploader || 'Desconocido';
    const thumbnailUrl = videoData.thumbnail;

    // ⭐ Sanitizar título para usarlo como nombre de archivo
    const sanitizedTitle = sanitizeFilename(title);
    console.log(`📝 Título: ${title}`);
    console.log(`👤 Artista: ${artist}`);

    const timestamp = Date.now();
    tempMp3 = path.join(tempDir, `audio_temp_${videoId}_${timestamp}.mp3`);
    coverImage = path.join(tempDir, `cover_${videoId}_${timestamp}.jpg`);
    // ⭐ USAR TÍTULO SANITIZADO en lugar de videoId
    const mp3File = path.join(tempDir, `${sanitizedTitle}.mp3`);

    console.log('🎵 Descargando audio 320kbps...');

    // Descargar audio sin portada primero
    await execFileAsync(ytDlpPath, [
      '-f', 'bestaudio/best',
      '-x',
      '--audio-format', 'mp3',
      '--audio-quality', '320K',
      '--ffmpeg-location', ffmpegPath,
      url,
      '-o', tempMp3,
      '--no-warnings'
    ], {
      maxBuffer: 100 * 1024 * 1024,
      timeout: 3600000
    });

    console.log('⏳ Verificando archivo de audio...');

    const audioFileExists = await waitForFile(tempMp3, 120000);
    if (!audioFileExists) {
      return res.status(500).json({ error: 'Error: No se pudo descargar el audio' });
    }

    if (!fs.existsSync(tempMp3)) {
      return res.status(500).json({ error: 'Error: Archivo de audio no existe' });
    }

    const fileSize = fs.statSync(tempMp3).size;
    console.log(`✅ Audio descargado: ${(fileSize / (1024 * 1024)).toFixed(2)} MB`);

    if (fileSize < 500000) {
      fs.unlinkSync(tempMp3);
      return res.status(500).json({ error: 'Error: Archivo muy pequeño' });
    }

    // Descargar portada e incrustarla
    if (thumbnailUrl) {
      try {
        console.log('🖼️ Descargando portada...');
        await downloadImage(thumbnailUrl, coverImage);
        console.log('✅ Portada descargada');

        // Incrustar portada en el MP3 con FFmpeg
        console.log('🎨 Incrustando portada en MP3...');
        await execFileAsync(ffmpegPath, [
          '-i', tempMp3,
          '-i', coverImage,
          '-c', 'copy',
          '-map', '0',
          '-map', '1',
          '-metadata:s:v', 'title="Album cover"',
          '-metadata:s:v', 'comment="Cover"',
          '-metadata', `title=${title}`,
          '-metadata', `artist=${artist}`,
          '-id3v2_version', '3',
          '-y',
          mp3File
        ], {
          maxBuffer: 100 * 1024 * 1024,
          timeout: 600000
        });

        console.log('✅ Portada incrustada exitosamente');
      } catch (e) {
        console.log('⚠️ Error al incrustar portada, usando MP3 sin portada:', e.message);
        fs.copyFileSync(tempMp3, mp3File);
      }
    } else {
      console.log('⚠️ No se encontró portada, usando MP3 sin portada');
      fs.copyFileSync(tempMp3, mp3File);
    }

    if (!fs.existsSync(mp3File)) {
      return res.status(500).json({ error: 'Error: No se pudo procesar el audio' });
    }

    const finalSize = fs.statSync(mp3File).size;
    console.log(`✅ Audio final listo: ${(finalSize / (1024 * 1024)).toFixed(2)} MB`);

    outputPath = mp3File;

    console.log('📤 Enviando audio al cliente...');

    // ⭐ USAR TÍTULO SANITIZADO como nombre de descarga
    res.download(mp3File, `${sanitizedTitle}.mp3`, (err) => {
      if (err) {
        console.error('❌ Error al enviar:', err.message);
      } else {
        console.log('✅ Enviado exitosamente');
      }

      setTimeout(() => {
        try {
          if (tempMp3 && fs.existsSync(tempMp3)) {
            fs.unlinkSync(tempMp3);
          }
          if (coverImage && fs.existsSync(coverImage)) {
            fs.unlinkSync(coverImage);
          }
          if (outputPath && fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
            console.log('🧹 Temporales eliminados');
          }
        } catch (e) {}
      }, 5000);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    try {
      if (tempMp3 && fs.existsSync(tempMp3)) {
        fs.unlinkSync(tempMp3);
      }
      if (coverImage && fs.existsSync(coverImage)) {
        fs.unlinkSync(coverImage);
      }
      if (outputPath && fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }
    } catch (e) {}
    res.status(500).json({ error: 'Error al procesar', message: error.message });
  }
};