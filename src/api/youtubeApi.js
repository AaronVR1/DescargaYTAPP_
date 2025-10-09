import axios from 'axios';

const RAPID_API_KEY = 'c5902e0766mshdf220e7b7997351p11acaajsn75f33ce3a8b4';
const RAPID_API_HOST = 'youtube-media-downloader.p.rapidapi.com';

const api = axios.create({
  baseURL: `https://${RAPID_API_HOST}`,
  headers: {
    'x-rapidapi-key': RAPID_API_KEY,
    'x-rapidapi-host': RAPID_API_HOST
  }
});

// Función para obtener información del video
export const getVideoInfo = async (videoUrl) => {
  try {
    const videoId = extractVideoId(videoUrl);
    const response = await api.get('/v2/video/details', {
      params: {
        videoId: videoId
      }
    });
    
    const data = response.data;
    console.log('Respuesta completa de la API:', JSON.stringify(data, null, 2));
    
    return {
      title: data.title || 'Sin título',
      thumbnail: data.thumbnails?.[0]?.url || data.thumbnail || '',
      channel: data.channel?.name || data.author || 'Desconocido',
      duration: data.lengthText || data.duration || 'N/A',
      videoId: videoId
    };
  } catch (error) {
    console.error('Error al obtener info del video:', error);
    throw error;
  }
};

// Función para obtener los enlaces de descarga - TEMPORAL
export const getDownloadLinks = async (videoUrl) => {
  try {
    const videoId = extractVideoId(videoUrl);
    
    // Primero obtener los detalles del video que pueden incluir formatos
    const response = await api.get('/v2/video/details', {
      params: {
        videoId: videoId
      }
    });
    
    console.log('Buscando enlaces en:', JSON.stringify(response.data, null, 2));
    
    // Intentar encontrar el enlace de descarga en la respuesta
    const data = response.data;
    const downloadLink = data.formats?.[0]?.url || 
                        data.downloadUrl || 
                        data.url ||
                        `https://www.youtube.com/watch?v=${videoId}`;
    
    return {
      link: downloadLink
    };
  } catch (error) {
    console.error('Error al obtener enlaces de descarga:', error);
    throw error;
  }
};

export const extractVideoId = (url) => {
  const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[7].length === 11) ? match[7] : null;
};

export const isValidYouTubeUrl = (url) => {
  const pattern = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
  return pattern.test(url);
};

export default api;