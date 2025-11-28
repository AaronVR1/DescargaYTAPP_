const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// ⭐ AUMENTAR TIMEOUT DE EXPRESS (2 HORAS)
app.use((req, res, next) => {
  req.setTimeout(7200000); // 2 horas
  res.setTimeout(7200000); // 2 horas
  next();
});

// Verificar herramientas
console.log('========== CONFIGURACIÓN INICIAL ==========');

const ytDlpPath = path.join(__dirname, 'bin', 'yt-dlp.exe');
const ffmpegPath = path.join(__dirname, 'bin', 'ffmpeg.exe');
const tempDir = path.join(__dirname, 'temp');

// Crear temp si no existe
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

console.log('🎵 yt-dlp en:', ytDlpPath);
console.log('Existe:', fs.existsSync(ytDlpPath) ? '✅' : '❌');
console.log('📁 Temp en:', tempDir);
console.log('🎬 FFmpeg en:', ffmpegPath);
console.log('Existe:', fs.existsSync(ffmpegPath) ? '✅' : '❌');
console.log('==========================================');

// Importar rutas reales
const youtubeRoutes = require('./src/routes/youtubeRoutes');

// Usar rutas
app.use('/api/youtube', youtubeRoutes);

// Ruta raíz
app.get('/', (req, res) => {
  res.json({ 
    message: '🎬 Servidor de YouTube activo',
    endpoints: {
      info: 'GET /api/youtube/info?url=<URL>',
      download: 'GET /api/youtube/download?url=<URL>',
      audio: 'GET /api/youtube/audio?url=<URL>',
      playlistInfo: 'GET /api/youtube/playlist/info?url=<URL>',
      playlistAudio: 'GET /api/youtube/playlist/audio/progress?url=<URL>',
      playlistVideo: 'GET /api/youtube/playlist/video/progress?url=<URL>'
    }
  });
});

// Manejo de errores
app.use((err, req, res, next) => {
  console.error('❌ Error:', err);
  res.status(500).json({ error: 'Error en el servidor', message: err.message });
});

// Iniciar servidor con timeout aumentado
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`📡 Accesible desde: http://192.168.1.74:${PORT}`);
  console.log('✅ Presiona Ctrl+C para detener');
});

// ⭐ AUMENTAR TIMEOUT DEL SERVIDOR (2 HORAS)
server.timeout = 7200000;