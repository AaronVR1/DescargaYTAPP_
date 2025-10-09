import AsyncStorage from '@react-native-async-storage/async-storage';

const DOWNLOADS_KEY = '@youtube_downloader_history';

// Guardar un video en el historial
export const saveDownloadHistory = async (downloadData) => {
  try {
    const existingData = await AsyncStorage.getItem(DOWNLOADS_KEY);
    const downloads = existingData ? JSON.parse(existingData) : [];
    
    // Agregar el nuevo video al inicio del array
    downloads.unshift(downloadData);
    
    await AsyncStorage.setItem(DOWNLOADS_KEY, JSON.stringify(downloads));
    return true;
  } catch (error) {
    console.error('Error al guardar en el historial:', error);
    return false;
  }
};

// Obtener todo el historial de descargas
export const getDownloadHistory = async () => {
  try {
    const data = await AsyncStorage.getItem(DOWNLOADS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error al obtener el historial:', error);
    return [];
  }
};

// Eliminar un video específico del historial
export const removeFromHistory = async (uri) => {
  try {
    const existingData = await AsyncStorage.getItem(DOWNLOADS_KEY);
    const downloads = existingData ? JSON.parse(existingData) : [];
    
    const updatedDownloads = downloads.filter(item => item.uri !== uri);
    
    await AsyncStorage.setItem(DOWNLOADS_KEY, JSON.stringify(updatedDownloads));
    return true;
  } catch (error) {
    console.error('Error al eliminar del historial:', error);
    return false;
  }
};

// Limpiar todo el historial
export const clearAllHistory = async () => {
  try {
    await AsyncStorage.removeItem(DOWNLOADS_KEY);
    return true;
  } catch (error) {
    console.error('Error al limpiar el historial:', error);
    return false;
  }
};