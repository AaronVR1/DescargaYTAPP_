const express = require('express');
const router = express.Router();
const youtubeController = require('../controllers/youtubeController');

// Obtener información del video
router.post('/info', youtubeController.getVideoInfo);

// Descargar video
router.post('/download', youtubeController.downloadVideo);

// Descargar audio
router.post('/audio', youtubeController.downloadAudio);

module.exports = router;