import AsyncStorage from '@react-native-async-storage/async-storage';

// ⚠️ NO hay IP por defecto - el usuario DEBE configurarla
const DEFAULT_PORT = '3000';
const CONFIG_KEY = 'server_config';

export const getServerUrl = async () => {
  try {
    const config = await AsyncStorage.getItem(CONFIG_KEY);
    if (config) {
      const { ip, port } = JSON.parse(config);
      return `http://${ip}:${port}`;
    }
    // Sin configuración - retorna null para forzar configuración
    return null;
  } catch (error) {
    console.error('Error al obtener URL del servidor:', error);
    return null;
  }
};

export const setServerUrl = async (ip, port = DEFAULT_PORT) => {
  try {
    // Validar que la IP tenga formato correcto
    if (!ip || ip.trim() === '') {
      throw new Error('IP no puede estar vacía');
    }

    // Validación básica de formato IP
    const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipPattern.test(ip.trim())) {
      throw new Error('Formato de IP inválido. Use formato: 192.168.0.1');
    }

    const config = { ip: ip.trim(), port };
    await AsyncStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    console.log('✅ Configuración guardada:', config);
    return true;
  } catch (error) {
    console.error('Error al guardar configuración:', error);
    throw error;
  }
};

export const getServerConfig = async () => {
  try {
    const config = await AsyncStorage.getItem(CONFIG_KEY);
    if (config) {
      return JSON.parse(config);
    }
    // Sin configuración previa
    return null;
  } catch (error) {
    console.error('Error al obtener configuración:', error);
    return null;
  }
};

export const hasServerConfig = async () => {
  try {
    const config = await AsyncStorage.getItem(CONFIG_KEY);
    return config !== null;
  } catch (error) {
    return false;
  }
};

export const resetToDefault = async () => {
  try {
    await AsyncStorage.removeItem(CONFIG_KEY);
    console.log('✅ Configuración eliminada');
    return true;
  } catch (error) {
    console.error('Error al resetear configuración:', error);
    throw error;
  }
};