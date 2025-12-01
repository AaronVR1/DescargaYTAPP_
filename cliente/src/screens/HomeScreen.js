import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Image,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { saveDownloadHistory } from '../utils/storage';
import { getServerUrl } from '../utils/config';
// ⭐ IMPORTAR EventSource para SSE
import RNEventSource from 'rn-eventsource';

// ===== CONFIGURACIÓN =====
const API_YOUTUBE_ENDPOINT = '/api/youtube';
const DOWNLOAD_TIMEOUT = 7200000;

// ===== FUNCIONES DE UTILIDAD =====
const isValidYouTubeUrl = (url) => {
  const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube|youtu|youtube-nocookie)\.(com|be)\//;
  return youtubeRegex.test(url);
};

const isPlaylistUrl = (url) => {
  return url.includes('list=');
};

// ===== FUNCIONES DE API =====
const getVideoInfo = async (url, apiBaseUrl) => {
  try {
    console.log('📝 Obteniendo info del video...');
    const response = await fetch(
      `${apiBaseUrl}${API_YOUTUBE_ENDPOINT}/info?url=${encodeURIComponent(url)}`,
      { timeout: DOWNLOAD_TIMEOUT }
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

const getPlaylistInfo = async (url, apiBaseUrl) => {
  try {
    console.log('📝 Obteniendo info de la playlist...');
    const response = await fetch(
      `${apiBaseUrl}${API_YOUTUBE_ENDPOINT}/playlist/info?url=${encodeURIComponent(url)}`,
      { timeout: DOWNLOAD_TIMEOUT }
    );

    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ Playlist encontrada:', data.title, `-`, data.videoCount, 'videos');
    return data;
  } catch (error) {
    console.error('❌ Error al obtener info de playlist:', error);
    throw error;
  }
};

// ===== COMPONENTE PRINCIPAL =====
export default function HomeScreen() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [videoInfo, setVideoInfo] = useState(null);
  const [playlistInfo, setPlaylistInfo] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [apiBaseUrl, setApiBaseUrl] = useState(null); // ⭐ SIN IP hardcodeada
  const [contentType, setContentType] = useState(null); // 'video' o 'playlist'
  
  // ⭐ NUEVOS ESTADOS PARA PROGRESO EN TIEMPO REAL
  const [progressMessage, setProgressMessage] = useState('');
  const [currentVideo, setCurrentVideo] = useState(0);
  const [totalVideos, setTotalVideos] = useState(0);
  const [jobId, setJobId] = useState(null);

  // ⭐ Cargar la URL del servidor cada vez que la pantalla gana foco
  // Esto permite que los cambios de Settings se apliquen inmediatamente
  useFocusEffect(
    React.useCallback(() => {
      loadServerUrl();
    }, [])
  );

  const loadServerUrl = async () => {
    try {
      const url = await getServerUrl();
      if (!url) {
        // NO hay configuración guardada
        Alert.alert(
          '⚙️ Configuración Requerida',
          'Antes de descargar videos, debes configurar la dirección IP del servidor.\n\n' +
          '1. Ve a la pestaña "Configuración"\n' +
          '2. Sigue las instrucciones\n' +
          '3. Ingresa la IP del servidor\n' +
          '4. Presiona "Guardar"\n\n' +
          'Esto solo se hace una vez.',
          [{ text: 'Entendido', style: 'default' }]
        );
        setApiBaseUrl(null);
        console.log('⚠️ No hay configuración del servidor');
      } else {
        setApiBaseUrl(url);
        console.log('🌐 Usando servidor:', url);
      }
    } catch (error) {
      console.error('Error al cargar URL del servidor:', error);
      setApiBaseUrl(null);
    }
  };

  const handleGetInfo = async () => {
    // Verificar que hay configuración
    if (!apiBaseUrl) {
      Alert.alert(
        '⚙️ Servidor No Configurado',
        'Debes configurar la IP del servidor primero.\n\n' +
        'Ve a la pestaña "Configuración" y sigue las instrucciones.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (!url.trim()) {
      Alert.alert('Error', 'Por favor ingresa una URL de YouTube');
      return;
    }

    if (!isValidYouTubeUrl(url)) {
      Alert.alert('Error', 'La URL ingresada no es válida');
      return;
    }

    setLoading(true);
    setVideoInfo(null);
    setPlaylistInfo(null);
    setContentType(null);

    try {
      if (isPlaylistUrl(url)) {
        console.log('📋 Detectada playlist');
        const info = await getPlaylistInfo(url, apiBaseUrl);
        setPlaylistInfo(info);
        setContentType('playlist');
      } else {
        console.log('🎬 Detectado video individual');
        const info = await getVideoInfo(url, apiBaseUrl);
        setVideoInfo(info);
        setContentType('video');
      }
    } catch (error) {
      console.error('❌ Error:', error);
      Alert.alert('Error', `No se pudo obtener la información\n\n${error.message}\n\nVerifica que el servidor esté en: ${apiBaseUrl}`);
    } finally {
      setLoading(false);
    }
  };

  const shareFile = async (fileUri, fileName, mimeType) => {
    try {
      console.log('📤 Preparando archivo para compartir...');
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (!fileInfo.exists) {
        Alert.alert('Error', 'El archivo no existe');
        return;
      }

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: mimeType,
        });
      } else {
        Alert.alert('Error', 'Compartir no está disponible en este dispositivo');
      }
    } catch (error) {
      console.error('❌ Error al compartir:', error);
      Alert.alert('Error al compartir', error.message);
    }
  };

  const clearInput = () => {
    setUrl('');
    setVideoInfo(null);
    setPlaylistInfo(null);
    setDownloadProgress(0);
    setContentType(null);
    setProgressMessage('');
    setCurrentVideo(0);
    setTotalVideos(0);
    setJobId(null);
  };

  const handleDownloadVideo = async () => {
    if (!videoInfo) return;

    setLoading(true);
    setDownloadProgress(0);

    try {
      let sanitizedTitle = videoInfo.title
        .replace(/[^a-zA-Z0-9\s-]/g, '')
        .replace(/\s+/g, '_')
        .substring(0, 50)
        .trim();

      if (!sanitizedTitle) {
        sanitizedTitle = `video_${Date.now()}`;
      }

      let fileUri = `${FileSystem.documentDirectory}${sanitizedTitle}.mp4`;

      const downloadUrl = `${apiBaseUrl}${API_YOUTUBE_ENDPOINT}/download?url=${encodeURIComponent(url)}`;

      Alert.alert(
        'Descargando...',
        'Por favor espera, esto puede tomar 3-5 minutos.\n\nNo cierres la app.',
        [{ text: 'OK' }],
        { cancelable: false }
      );

      const downloadResumable = FileSystem.createDownloadResumable(
        downloadUrl,
        fileUri,
        {
          // ⭐ CONFIGURACIÓN CORRECTA DE TIMEOUT
        },
        (progressEvent) => {
          try {
            const progress = progressEvent.totalBytesWritten / progressEvent.totalBytesExpectedToWrite;
            setDownloadProgress(progress);
          } catch (e) {
            console.log('Progreso:', progressEvent.totalBytesWritten);
          }
        }
      );

      const result = await downloadResumable.downloadAsync();
      const fileInfo = await FileSystem.getInfoAsync(fileUri);

      if (!fileInfo.exists || fileInfo.size < 500000) {
        throw new Error('Archivo incompleto o corrupto');
      }

      // ⭐ GUARDAR EN HISTORIAL
      await saveDownloadHistory({
        title: videoInfo.title,
        uri: fileUri,
        thumbnail: videoInfo.thumbnail,
        date: new Date().toISOString(),
        size: fileInfo.size,
        type: 'video',
        isPlaylist: false
      });

      console.log('✅ Video guardado en historial');

      Alert.alert(
        '✅ ¡Descarga Completa!',
        `Video: ${sanitizedTitle}\nTamaño: ${(fileInfo.size / (1024 * 1024)).toFixed(2)} MB`,
        [
          { text: '✅ OK', style: 'default' },
          {
            text: '📤 Compartir',
            onPress: () => shareFile(fileUri, sanitizedTitle, 'video/mp4')
          }
        ]
      );

    } catch (error) {
      console.error('❌ Error:', error);
      Alert.alert('Error en descarga', error.message);
    } finally {
      setLoading(false);
      setDownloadProgress(0);
    }
  };

  const handleDownloadAudio = async () => {
    if (!videoInfo) return;

    setLoading(true);
    setDownloadProgress(0);

    try {
      let sanitizedTitle = videoInfo.title
        .replace(/[^a-zA-Z0-9\s-]/g, '')
        .replace(/\s+/g, '_')
        .substring(0, 50)
        .trim();

      if (!sanitizedTitle) {
        sanitizedTitle = `audio_${Date.now()}`;
      }

      const fileUri = `${FileSystem.documentDirectory}${sanitizedTitle}.mp3`;
      const downloadUrl = `${apiBaseUrl}${API_YOUTUBE_ENDPOINT}/audio?url=${encodeURIComponent(url)}`;

      Alert.alert(
        'Descargando...',
        'Por favor espera, esto puede tomar 1-2 minutos.\n\nNo cierres la app.',
        [{ text: 'OK' }],
        { cancelable: false }
      );

      const downloadResumable = FileSystem.createDownloadResumable(
        downloadUrl,
        fileUri,
        {
          // ⭐ SIN TIMEOUT - FileSystem legacy no lo soporta bien
        },
        (progressEvent) => {
          try {
            const progress = progressEvent.totalBytesWritten / progressEvent.totalBytesExpectedToWrite;
            setDownloadProgress(progress);
          } catch (e) {
            console.log('Progreso:', progressEvent.totalBytesWritten);
          }
        }
      );

      const result = await downloadResumable.downloadAsync();
      const fileInfo = await FileSystem.getInfoAsync(fileUri);

      if (!fileInfo.exists || fileInfo.size < 500000) {
        throw new Error('Archivo incompleto o corrupto');
      }

      // ⭐ GUARDAR EN HISTORIAL
      await saveDownloadHistory({
        title: videoInfo.title,
        uri: fileUri,
        thumbnail: videoInfo.thumbnail,
        date: new Date().toISOString(),
        size: fileInfo.size,
        type: 'audio',
        isPlaylist: false
      });

      console.log('✅ Audio guardado en historial');

      Alert.alert(
        '✅ ¡Audio Descargado!',
        `Título: ${sanitizedTitle}\nTamaño: ${(fileInfo.size / (1024 * 1024)).toFixed(2)} MB`,
        [
          { text: '✅ OK', style: 'default' },
          {
            text: '📤 Compartir',
            onPress: () => shareFile(fileUri, sanitizedTitle, 'audio/mp3')
          }
        ]
      );

    } catch (error) {
      console.error('❌ Error:', error);
      Alert.alert('Error en descarga', error.message);
    } finally {
      setLoading(false);
      setDownloadProgress(0);
    }
  };

  // ⭐ NUEVA FUNCIÓN: Descargar playlist AUDIO con progreso en tiempo real
  const handleDownloadPlaylistAudio = async () => {
    if (!playlistInfo) return;

    setLoading(true);
    setDownloadProgress(0);
    setProgressMessage('Iniciando...');
    setCurrentVideo(0);
    setTotalVideos(playlistInfo.videoCount);
    setJobId(null);

    try {
      console.log('🎵 Iniciando descarga de playlist como MP3 (con progreso)...');

      const downloadUrl = `${apiBaseUrl}${API_YOUTUBE_ENDPOINT}/playlist/audio/progress?url=${encodeURIComponent(url)}`;

      Alert.alert(
        'Descargando Playlist...',
        `Se descargarán ${playlistInfo.videoCount} videos.\n\nVerás el progreso en tiempo real.`,
        [{ text: 'OK' }],
        { cancelable: false }
      );

      // ⭐ USAR EventSource para SSE
      const eventSource = new RNEventSource(downloadUrl);

      eventSource.addEventListener('status', (event) => {
        const data = JSON.parse(event.data);
        console.log('📊 Progreso:', data.message);
        
        setProgressMessage(data.message);
        setDownloadProgress(data.progress / 100);
        
        if (data.current && data.total) {
          setCurrentVideo(data.current);
          setTotalVideos(data.total);
        }
      });

      eventSource.addEventListener('warning', (event) => {
        const data = JSON.parse(event.data);
        console.warn('⚠️', data.message);
      });

      eventSource.addEventListener('complete', async (event) => {
        const data = JSON.parse(event.data);
        console.log('✅ Completo! JobID:', data.jobId);
        
        setProgressMessage(data.message);
        setDownloadProgress(1);
        setJobId(data.jobId);
        
        eventSource.close();
        
        // Descargar el ZIP
        await downloadPlaylistZip(data.jobId, 'audio');
      });

      eventSource.addEventListener('error', (event) => {
        console.error('❌ Error SSE:', event);
        eventSource.close();
        setLoading(false);
        
        let errorMessage = 'Error en el servidor';
        try {
          const data = JSON.parse(event.data);
          errorMessage = data.message || data.error;
        } catch (e) {
          errorMessage = 'Error de conexión con el servidor';
        }
        
        Alert.alert('Error', errorMessage);
      });

      eventSource.onerror = (error) => {
        console.error('❌ Error de conexión:', error);
        eventSource.close();
        setLoading(false);
        Alert.alert('Error', 'Problemas de conexión con el servidor');
      };

    } catch (error) {
      console.error('❌ Error:', error);
      setLoading(false);
      Alert.alert('Error', error.message || 'Error al descargar playlist');
    }
  };

  // ⭐ NUEVA FUNCIÓN: Descargar playlist VIDEO con progreso en tiempo real
  const handleDownloadPlaylistVideo = async () => {
    if (!playlistInfo) return;

    setLoading(true);
    setDownloadProgress(0);
    setProgressMessage('Iniciando...');
    setCurrentVideo(0);
    setTotalVideos(playlistInfo.videoCount);
    setJobId(null);

    try {
      console.log('📹 Iniciando descarga de playlist como MP4 (con progreso)...');

      const downloadUrl = `${apiBaseUrl}${API_YOUTUBE_ENDPOINT}/playlist/video/progress?url=${encodeURIComponent(url)}`;

      Alert.alert(
        'Descargando Playlist...',
        `Se descargarán ${playlistInfo.videoCount} videos.\n\nVerás el progreso en tiempo real.`,
        [{ text: 'OK' }],
        { cancelable: false }
      );

      // ⭐ USAR EventSource para SSE
      const eventSource = new RNEventSource(downloadUrl);

      eventSource.addEventListener('status', (event) => {
        const data = JSON.parse(event.data);
        console.log('📊 Progreso:', data.message);
        
        setProgressMessage(data.message);
        setDownloadProgress(data.progress / 100);
        
        if (data.current && data.total) {
          setCurrentVideo(data.current);
          setTotalVideos(data.total);
        }
      });

      eventSource.addEventListener('warning', (event) => {
        const data = JSON.parse(event.data);
        console.warn('⚠️', data.message);
      });

      eventSource.addEventListener('complete', async (event) => {
        const data = JSON.parse(event.data);
        console.log('✅ Completo! JobID:', data.jobId);
        
        setProgressMessage(data.message);
        setDownloadProgress(1);
        setJobId(data.jobId);
        
        eventSource.close();
        
        // Descargar el ZIP
        await downloadPlaylistZip(data.jobId, 'video');
      });

      eventSource.addEventListener('error', (event) => {
        console.error('❌ Error SSE:', event);
        eventSource.close();
        setLoading(false);
        
        let errorMessage = 'Error en el servidor';
        try {
          const data = JSON.parse(event.data);
          errorMessage = data.message || data.error;
        } catch (e) {
          errorMessage = 'Error de conexión con el servidor';
        }
        
        Alert.alert('Error', errorMessage);
      });

      eventSource.onerror = (error) => {
        console.error('❌ Error de conexión:', error);
        eventSource.close();
        setLoading(false);
        Alert.alert('Error', 'Problemas de conexión con el servidor');
      };

    } catch (error) {
      console.error('❌ Error:', error);
      setLoading(false);
      Alert.alert('Error', error.message || 'Error al descargar playlist');
    }
  };

  // ⭐ NUEVA FUNCIÓN: Descargar el ZIP generado
  const downloadPlaylistZip = async (jobId, type) => {
    try {
      console.log('📥 Descargando ZIP...');
      setProgressMessage('📥 Descargando archivo ZIP...');

      const timestamp = Date.now();
      const zipFileName = `playlist_${type}_${timestamp}.zip`;
      const zipFileUri = `${FileSystem.documentDirectory}${zipFileName}`;

      const downloadUrl = `${apiBaseUrl}${API_YOUTUBE_ENDPOINT}/playlist/download/${jobId}`;

      const downloadResumable = FileSystem.createDownloadResumable(
        downloadUrl,
        zipFileUri,
        {},
        (progressEvent) => {
          try {
            const progress = progressEvent.totalBytesWritten / progressEvent.totalBytesExpectedToWrite;
            setDownloadProgress(progress);
          } catch (e) {}
        }
      );

      await downloadResumable.downloadAsync();

      const zipInfo = await FileSystem.getInfoAsync(zipFileUri);
      if (!zipInfo.exists) {
        throw new Error('ZIP no se descargó correctamente');
      }

      console.log(`✅ ZIP descargado: ${(zipInfo.size / (1024 * 1024)).toFixed(2)} MB`);

      // ⭐ GUARDAR EN HISTORIAL
      await saveDownloadHistory({
        title: `🎵 Playlist: ${playlistInfo.title}`,
        uri: zipFileUri,
        type: type, // 'audio' o 'video'
        videoCount: totalVideos,
        size: zipInfo.size,
        date: new Date().toISOString(),
        isPlaylist: true,
        thumbnail: playlistInfo.thumbnail // ⭐ AHORA incluye thumbnail
      });

      console.log('✅ Guardado en historial');

      Alert.alert(
        '✅ ¡Playlist Descargada!',
        `Archivo: ${zipFileName}\nTamaño: ${(zipInfo.size / (1024 * 1024)).toFixed(2)} MB\nVideos: ${totalVideos}\nFormato: ${type === 'audio' ? 'MP3 320kbps' : 'MP4'}\n\nEl archivo ZIP está guardado. Puedes compartirlo o extraerlo con tu gestor de archivos.`,
        [
          { text: '✅ OK', style: 'default' },
          {
            text: '📤 Compartir ZIP',
            onPress: async () => {
              try {
                if (await Sharing.isAvailableAsync()) {
                  await Sharing.shareAsync(zipFileUri);
                }
              } catch (e) {
                console.error('Error al compartir:', e);
              }
            }
          }
        ]
      );

    } catch (error) {
      console.error('❌ Error al descargar ZIP:', error);
      Alert.alert('Error', 'No se pudo descargar el archivo ZIP');
    } finally {
      setLoading(false);
      setDownloadProgress(0);
      setProgressMessage('');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Image
            source={require('../../assets/images/monachina.png')}
            style={{ width: 250, height: 250 }}
            resizeMode="contain"
          />
          <Text style={styles.title}>Descarga YTAPP</Text>
          <Text style={styles.subtitle}>Videos y audio de YouTube</Text>
        </View>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Pega aquí la URL de YouTube..."
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {url.length > 0 && (
            <TouchableOpacity onPress={clearInput} style={styles.clearButton}>
              <Ionicons name="close-circle" size={24} color="#999" />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleGetInfo}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="search" size={20} color="#fff" />
              <Text style={styles.buttonText}>Buscar</Text>
            </>
          )}
        </TouchableOpacity>

        {/* ⭐ CARACTERÍSTICAS - Se oculta cuando hay contenido encontrado */}
        {!videoInfo && !playlistInfo && !loading && (
          <View style={styles.featuresContainer}>
            <Text style={styles.featuresTitle}>✨ Características</Text>
            
            <View style={styles.featureCard}>
              <View style={styles.featureIconContainer}>
                <Ionicons name="videocam" size={32} color="#8b5cf6" />
              </View>
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>Videos en Full HD</Text>
                <Text style={styles.featureDescription}>
                  Descarga videos hasta 1080p con la mejor calidad
                </Text>
              </View>
            </View>

            <View style={styles.featureCard}>
              <View style={styles.featureIconContainer}>
                <Ionicons name="musical-notes" size={32} color="#ec4899" />
              </View>
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>Audio de Alta Calidad</Text>
                <Text style={styles.featureDescription}>
                  MP3 a 320kbps con portadas incrustadas
                </Text>
              </View>
            </View>

            <View style={styles.featureCard}>
              <View style={styles.featureIconContainer}>
                <Ionicons name="list" size={32} color="#22d3ee" />
              </View>
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>Playlists Completas</Text>
                <Text style={styles.featureDescription}>
                  Descarga playlists enteras con un solo toque
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* VIDEO INDIVIDUAL */}
        {contentType === 'video' && videoInfo && (
          <View style={styles.videoCard}>
            <View style={styles.successBadge}>
              <Ionicons name="checkmark-circle" size={18} color="#fff" />
              <Text style={styles.successBadgeText}>✅ Video Encontrado</Text>
            </View>

            {videoInfo.thumbnail && (
              <Image
                source={{ uri: videoInfo.thumbnail }}
                style={styles.thumbnail}
              />
            )}

            <Text style={styles.videoTitle}>{videoInfo.title}</Text>
            <Text style={styles.videoInfo}>Canal: {videoInfo.channel}</Text>
            <Text style={styles.videoInfo}>Duración: {videoInfo.duration}</Text>
            <Text style={styles.videoInfo}>Vistas: {videoInfo.views}</Text>

            {downloadProgress > 0 && downloadProgress < 1 && (
              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <View 
                    style={[
                      styles.progressFill, 
                      { width: `${downloadProgress * 100}%` }
                    ]} 
                  />
                </View>
                <Text style={styles.progressText}>
                  {Math.round(downloadProgress * 100)}%
                </Text>
              </View>
            )}

            <View style={styles.buttonGroup}>
              <TouchableOpacity
                style={[styles.downloadButton, loading && styles.buttonDisabled]}
                onPress={handleDownloadVideo}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="download" size={20} color="#fff" />
                    <Text style={styles.buttonText}>MP4</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.audioButton, loading && styles.buttonDisabled]}
                onPress={handleDownloadAudio}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="musical-notes" size={20} color="#fff" />
                    <Text style={styles.buttonText}>MP3</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* PLAYLIST */}
        {contentType === 'playlist' && playlistInfo && (
          <View style={styles.videoCard}>
            <View style={styles.playlistBadge}>
              <Ionicons name="checkmark-circle" size={18} color="#fff" />
              <Text style={styles.playlistBadgeText}>✅ Playlist Encontrada</Text>
            </View>

            {/* ⭐ THUMBNAIL DE LA PLAYLIST */}
            {playlistInfo.thumbnail && (
              <Image
                source={{ uri: playlistInfo.thumbnail }}
                style={styles.thumbnail}
              />
            )}

            <Text style={styles.videoTitle}>{playlistInfo.title}</Text>
            <Text style={styles.videoInfo}>
              Total de videos: {playlistInfo.videoCount}
            </Text>

            {/* ⭐ PROGRESO EN TIEMPO REAL */}
            {loading && (
              <View style={styles.progressContainer}>
                {progressMessage && (
                  <Text style={styles.progressMessage}>
                    {progressMessage}
                  </Text>
                )}
                
                {totalVideos > 0 && currentVideo > 0 && (
                  <Text style={styles.videoCounter}>
                    Video {currentVideo} / {totalVideos}
                  </Text>
                )}
                
                <View style={styles.progressBar}>
                  <View 
                    style={[
                      styles.progressFill, 
                      { width: `${downloadProgress * 100}%` }
                    ]} 
                  />
                </View>
                <Text style={styles.progressText}>
                  {Math.round(downloadProgress * 100)}%
                </Text>
              </View>
            )}

            <View style={styles.buttonGroup}>
              <TouchableOpacity
                style={[styles.downloadButton, loading && styles.buttonDisabled]}
                onPress={handleDownloadPlaylistVideo}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="download" size={20} color="#fff" />
                    <Text style={styles.buttonText}>MP4</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.audioButton, loading && styles.buttonDisabled]}
                onPress={handleDownloadPlaylistAudio}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="musical-notes" size={20} color="#fff" />
                    <Text style={styles.buttonText}>MP3</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a0033',
  },
  content: {
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#8b5cf6',
    marginTop: 10,
    textShadowColor: '#8b5cf6',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  subtitle: {
    fontSize: 14,
    color: '#ffffff',
    marginTop: 5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    position: 'relative',
  },
  input: {
    flex: 1,
    backgroundColor: '#ffffffff',
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    fontSize: 14,
  },
  clearButton: {
    position: 'absolute',
    right: 10,
  },
  button: {
    backgroundColor: '#3b82f6',
    padding: 15,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  buttonDisabled: {
    backgroundColor: '#94a3b8',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  videoCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  successBadge: {
    backgroundColor: '#10b981',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    marginBottom: 15,
  },
  playlistBadge: {
    backgroundColor: '#8b5cf6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    marginBottom: 15,
  },
  successBadgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  playlistBadgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  thumbnail: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    marginBottom: 15,
  },
  videoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  videoInfo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  progressContainer: {
    marginVertical: 15,
  },
  progressMessage: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    textAlign: 'center',
  },
  videoCounter: {
    fontSize: 13,
    color: '#8b5cf6',
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  progressBar: {
    height: 10,
    backgroundColor: '#e0e0e0',
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2563eb',
  },
  progressText: {
    textAlign: 'center',
    marginTop: 5,
    color: '#666',
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 15,
  },
  downloadButton: {
    flex: 1,
    backgroundColor: '#10b981',
    padding: 15,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  audioButton: {
    flex: 1,
    backgroundColor: '#ff005d',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  // ⭐ ESTILOS PARA CARACTERÍSTICAS
  featuresContainer: {
    marginTop: 30,
    marginBottom: 10,
  },
  featuresTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
    textAlign: 'center',
  },
  featureCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(10px)',
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  featureIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  featureDescription: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 18,
  },
});