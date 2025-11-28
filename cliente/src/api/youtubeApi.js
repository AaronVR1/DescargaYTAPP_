// cliente/src/api/youtubeApi.js
import CONFIG, { getApiUrl } from '../config/config';

export const getVideoInfo = async (url) => {
  try {
    console.log('📝 Obteniendo info del video...');
    const response = await fetch(
      `${getApiUrl('/info')}?url=${encodeURIComponent(url)}`,
      {
        timeout: CONFIG.DOWNLOAD_TIMEOUT,
      }
    );

    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ Info recibida:', data.title);
    return data;
  } catch (error) {
    console.error('❌ Error al obtener info:', error);
    throw error;
  }
};

export const isValidYouTubeUrl = (url) => {
  const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube|youtu|youtube-nocookie)\.(com|be)\//;
  return youtubeRegex.test(url);
};

export const isYouTubeShort = (url) => {
  return /youtube\.com\/shorts\/|youtu\.be\//.test(url);
};