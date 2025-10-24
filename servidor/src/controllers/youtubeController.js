const YTDlpWrap = require('yt-dlp-wrap').default;
const path = require('path');

// Inicializar yt-dlp con ruta específica
const ytDlpPath = path.join(__dirname, '../../bin/yt-dlp.exe');
const ytDlpWrap = new YTDlpWrap(ytDlpPath);

const getVideoId = (url) => {
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
};

const formatDuration = (seconds) => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

exports.getVideoInfo = async (req, res) => {
  try {
    const { url } = req.body;

    console.log('📥 Petición de info recibida:', url);

    if (!url) {
      return res.status(400).json({ error: 'URL es requerida' });
    }

    const videoId = getVideoId(url);
    if (!videoId) {
      return res.status(400).json({ error: 'URL de YouTube inválida' });
    }

    console.log('🔍 Obteniendo info del video ID:', videoId);

    // Obtener info con yt-dlp
    const info = await ytDlpWrap.getVideoInfo(url);

    console.log('✅ Info obtenida:', info.title);

    // Obtener formatos disponibles
    const formats = info.formats
      .filter(f => f.vcodec !== 'none' && f.acodec !== 'none')
      .map(f => ({
        quality: f.format_note || f.height + 'p' || 'unknown',
        format: f.ext,
        size: f.filesize ? `${(f.filesize / (1024 * 1024)).toFixed(2)} MB` : 'N/A'
      }))
      .slice(0, 5); // Solo las primeras 5

    res.json({
      success: true,
      data: {
        title: info.title,
        duration: formatDuration(parseInt(info.duration)),
        thumbnail: info.thumbnail,
        channel: info.uploader || info.channel,
        views: parseInt(info.view_count || 0).toLocaleString(),
        uploadDate: info.upload_date,
        formats: formats
      }
    });

  } catch (error) {
    console.error('❌ Error al obtener info:', error.message);
    res.status(500).json({ 
      error: 'Error al obtener información del video',
      message: error.message 
    });
  }
};

exports.downloadVideo = async (req, res) => {
  try {
    const { url, quality = 'high' } = req.body;

    console.log('📥 Petición de descarga recibida:', { url, quality });

    if (!url) {
      return res.status(400).json({ error: 'URL es requerida' });
    }

    const videoId = getVideoId(url);
    if (!videoId) {
      return res.status(400).json({ error: 'URL de YouTube inválida' });
    }

    console.log('🔍 Obteniendo formatos del video ID:', videoId);

    // Obtener info con yt-dlp
    const info = await ytDlpWrap.getVideoInfo(url);

// Primero: Buscar formatos con video Y audio juntos
let videoFormats = info.formats.filter(f => 
  f.vcodec !== 'none' && 
  f.acodec !== 'none' &&
  f.url &&
  !f.url.includes('manifest')
);

console.log(`📊 Formatos con video+audio: ${videoFormats.length}`);

// Si encontramos formatos combinados, usarlos
if (videoFormats.length > 0) {
  // Ordenar por calidad (altura)
  videoFormats.sort((a, b) => (b.height || 0) - (a.height || 0));
  
  // Filtrar solo los que tienen buena calidad y audio
  const goodFormats = videoFormats.filter(f => 
    (f.height >= 480 || f.qualityLabel) && 
    f.acodec !== 'none'
  );
  
  if (goodFormats.length > 0) {
    videoFormats = goodFormats;
    console.log(`✅ Usando formatos combinados de calidad: ${videoFormats[0].height || videoFormats[0].quality}p`);
  }
} else {
  // Si NO hay formatos combinados, buscar los mejores formatos con audio
  console.log('⚠️ No hay formatos combinados, buscando alternativas...');
  
  // Buscar formatos que tengan audio (aunque sea de menor calidad de video)
  const formatsWithAudio = info.formats.filter(f => 
    f.acodec !== 'none' &&
    f.url &&
    !f.url.includes('manifest')
  );
  
  if (formatsWithAudio.length > 0) {
    videoFormats = formatsWithAudio;
    videoFormats.sort((a, b) => (b.height || 0) - (a.height || 0));
    console.log(`✅ Usando formato con audio: ${videoFormats[0].height || videoFormats[0].quality}p`);
  } else {
    // Último recurso: cualquier formato descargable
    videoFormats = info.formats.filter(f => 
      f.url && !f.url.includes('manifest')
    );
    console.log('⚠️ Usando cualquier formato disponible (puede no tener audio)');
  }
}

    if (videoFormats.length === 0) {
      console.log('❌ No se encontró formato disponible');
      return res.status(404).json({ error: 'No se encontró formato disponible' });
    }

    // Ordenar por calidad (altura)
    videoFormats.sort((a, b) => (b.height || 0) - (a.height || 0));

    // Seleccionar formato según calidad
    const format = quality === 'high' ? videoFormats[0] : videoFormats[videoFormats.length - 1];

    console.log('✅ Formato encontrado:', format.format_note || format.height + 'p');
    console.log('🔗 URL del video:', format.url.substring(0, 100) + '...');

    res.json({
      success: true,
      data: {
        link: format.url,
        quality: format.format_note || (format.height ? format.height + 'p' : 'unknown'),
        size: format.filesize ? `${(format.filesize / (1024 * 1024)).toFixed(2)} MB` : 'N/A',
        format: format.ext
      }
    });

  } catch (error) {
    console.error('❌ Error al descargar video:', error.message);
    res.status(500).json({ 
      error: 'Error al procesar la descarga',
      message: error.message 
    });
  }
};

exports.downloadAudio = async (req, res) => {
  try {
    const { url } = req.body;

    console.log('📥 Petición de audio recibida:', url);

    if (!url) {
      return res.status(400).json({ error: 'URL es requerida' });
    }

    const videoId = getVideoId(url);
    if (!videoId) {
      return res.status(400).json({ error: 'URL de YouTube inválida' });
    }

    console.log('🔍 Obteniendo audio del video ID:', videoId);

    // Obtener info con yt-dlp
    const info = await ytDlpWrap.getVideoInfo(url);

    // Filtrar solo formatos de audio
    const audioFormats = info.formats.filter(f => 
      f.acodec !== 'none' && 
      f.vcodec === 'none' &&
      f.url
    );

    if (audioFormats.length === 0) {
      console.log('❌ No se encontró formato de audio disponible');
      return res.status(404).json({ error: 'No se encontró formato de audio disponible' });
    }

    // Seleccionar el mejor audio (por abr - audio bitrate)
    audioFormats.sort((a, b) => (b.abr || 0) - (a.abr || 0));
    const format = audioFormats[0];

    console.log('✅ Audio encontrado');

    res.json({
      success: true,
      data: {
        link: format.url,
        bitrate: format.abr ? `${format.abr} kbps` : 'N/A',
        size: format.filesize ? `${(format.filesize / (1024 * 1024)).toFixed(2)} MB` : 'N/A',
        format: 'audio'
      }
    });

  } catch (error) {
    console.error('❌ Error al descargar audio:', error.message);
    res.status(500).json({ 
      error: 'Error al procesar la descarga de audio',
      message: error.message 
    });
  }
};