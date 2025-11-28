const express = require('express');
const router = express.Router();
const youtubeController = require('../controllers/youtubeController');
const playlistController = require('../controllers/playlistController');

// ===== VIDEO INDIVIDUAL =====
// Obtener información del video
router.get('/info', youtubeController.getVideoInfo);

// Descargar video individual
router.get('/download', youtubeController.downloadVideo);

// Descargar audio individual
router.get('/audio', youtubeController.downloadAudio);

// ===== PLAYLIST =====
// Obtener información de la playlist
router.get('/playlist/info', playlistController.getPlaylistInfo);

// ⭐ NUEVAS RUTAS CON PROGRESO EN TIEMPO REAL
// Descargar playlist como MP3 con progreso (SSE)
router.get('/playlist/audio/progress', playlistController.downloadPlaylistAudioWithProgress);

// Descargar playlist como MP4 con progreso (SSE)
router.get('/playlist/video/progress', playlistController.downloadPlaylistVideoWithProgress);

// Descargar el ZIP generado
router.get('/playlist/download/:jobId', playlistController.downloadPlaylistZip);

// ===== RUTAS ANTIGUAS (mantener compatibilidad) =====
// Descargar playlist como MP3 (sin progreso)
router.get('/playlist/audio', playlistController.downloadPlaylistAudio);

// Descargar playlist como MP4 (sin progreso)
router.get('/playlist/video', playlistController.downloadPlaylistVideo);

module.exports = router;