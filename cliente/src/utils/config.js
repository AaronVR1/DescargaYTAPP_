import AsyncStorage from '@react-native-async-storage/async-storage';

const DEFAULT_IP = '192.168.1.74';
const DEFAULT_PORT = '3000';
const CONFIG_KEY = 'server_config';

export const getServerUrl = async () => {
  try {
    const config = await AsyncStorage.getItem(CONFIG_KEY);
    if (config) {
      const { ip, port } = JSON.parse(config);
      return `http://${ip}:${port}`;
    }
    // Si no existe configuración, devolver la default
    return `http://${DEFAULT_IP}:${DEFAULT_PORT}`;
  } catch (error) {
    console.error('Error al obtener URL del servidor:', error);
    return `http://${DEFAULT_IP}:${DEFAULT_PORT}`;
  }
};

export const setServerUrl = async (ip, port = DEFAULT_PORT) => {
  try {
    // Validar que la IP tenga formato correcto
    if (!ip || ip.trim() === '') {
      throw new Error('IP no puede estar vacía');
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
    return { ip: DEFAULT_IP, port: DEFAULT_PORT };
  } catch (error) {
    console.error('Error al obtener configuración:', error);
    return { ip: DEFAULT_IP, port: DEFAULT_PORT };
  }
};

export const resetToDefault = async () => {
  try {
    await AsyncStorage.removeItem(CONFIG_KEY);
    console.log('✅ Configuración reseteada a valores por defecto');
    return true;
  } catch (error) {
    console.error('Error al resetear configuración:', error);
    throw error;
  }
};
