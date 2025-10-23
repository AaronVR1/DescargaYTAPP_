import axios from 'axios';
import { Platform } from 'react-native';

// Detectar automáticamente la IP según el dispositivo
const getApiUrl = () => {
  if (Platform.OS === 'web') {
    return 'http://localhost:3000/api/youtube';
  }
  // CAMBIAR ESTA IP cuando cambies de red WiFi
  return 'http://192.168.0.59:3000/api/youtube';
};

const API_URL = getApiUrl();

export const isValidYouTubeUrl = (url) => {
  const regex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|v\/)|youtu\.be\/)[\w-]{11}/;
  return regex.test(url);
};

export const getVideoInfo = async (url) => {
  try {
    console.log('🔍 Obteniendo info del video...');
    const response = await axios.post(`${API_URL}/info`, { url });
    console.log('✅ Info recibida:', response.data.data.title);
    return response.data.data;
  } catch (error) {
    console.error('❌ Error al obtener info:', error.message);
    throw new Error(error.response?.data?.error || 'Error al obtener información');
  }
};

export const getDownloadLinks = async (url, quality = 'high') => {
  try {
    console.log('🔗 Obteniendo enlace de descarga...');
    const response = await axios.post(`${API_URL}/download`, { url, quality });
    console.log('✅ Enlace obtenido:', response.data.data.quality);
    return response.data.data;
  } catch (error) {
    console.error('❌ Error al obtener enlace:', error.message);
    throw new Error(error.response?.data?.error || 'Error al obtener enlace de descarga');
  }
};

export const getAudioLink = async (url) => {
  try {
    console.log('🎵 Obteniendo enlace de audio...');
    const response = await axios.post(`${API_URL}/audio`, { url });
    console.log('✅ Audio obtenido');
    return response.data.data;
  } catch (error) {
    console.error('❌ Error al obtener audio:', error.message);
    throw new Error(error.response?.data?.error || 'Error al obtener audio');
  }
};