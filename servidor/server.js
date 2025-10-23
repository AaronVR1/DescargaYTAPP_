const express = require('express');
const cors = require('cors');
const youtubeRoutes = require('./src/routes/youtubeRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Rutas
app.use('/api/youtube', youtubeRoutes);

// Ruta de prueba
app.get('/', (req, res) => {
  res.json({ 
    message: 'YouTube Downloader API',
    status: 'running',
    endpoints: {
      info: '/api/youtube/info',
      download: '/api/youtube/download',
      audio: '/api/youtube/audio'
    }
  });
});

// Manejo de errores
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Algo salió mal!',
    message: err.message 
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});