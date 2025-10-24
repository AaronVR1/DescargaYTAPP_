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
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { getVideoInfo, getDownloadLinks, isValidYouTubeUrl } from '../api/youtubeApi';
import { saveDownloadHistory } from '../utils/storage';

export default function HomeScreen() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [videoInfo, setVideoInfo] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(0);

  const handleGetInfo = async () => {
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

    try {
      console.log('🔍 Buscando video...');
      const info = await getVideoInfo(url);
      console.log('✅ Video encontrado:', info.title);
      setVideoInfo(info);
    } catch (error) {
      console.error('❌ Error:', error);
      Alert.alert('Error', 'No se pudo obtener la información del video');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (quality = 'high') => {
    if (!videoInfo) return;

    setLoading(true);
    setDownloadProgress(0);

    try {
      console.log('📥 Iniciando descarga...');
      const downloadData = await getDownloadLinks(url, quality);
      
      if (!downloadData || !downloadData.link) {
        Alert.alert('Error', 'No se pudo obtener el enlace de descarga');
        return;
      }

      console.log('🔗 Enlace obtenido:', downloadData.link.substring(0, 50) + '...');

      // Limpiar el nombre del archivo (quitar caracteres especiales)
      const sanitizedTitle = videoInfo.title
        .replace(/[^a-z0-9]/gi, '_')
        .substring(0, 50);
      
      const fileUri = `${FileSystem.documentDirectory || 'file://'}${sanitizedTitle}.mp4`;

      console.log('💾 Guardando en:', fileUri);

      const downloadResumable = FileSystem.createDownloadResumable(
        downloadData.link,
        fileUri,
        {},
        (downloadProgress) => {
          const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
          setDownloadProgress(progress);
          
          // Mostrar progreso cada 10%
          if (Math.round(progress * 100) % 10 === 0) {
            console.log(`📊 Progreso: ${Math.round(progress * 100)}%`);
          }
        }
      );

      const result = await downloadResumable.downloadAsync();
      
      if (!result) {
        Alert.alert('Error', 'La descarga falló');
        return;
      }

      console.log('✅ Descarga completa:', result.uri);
      
      // Guardar en historial
      await saveDownloadHistory({
        title: videoInfo.title,
        uri: result.uri,
        date: new Date().toISOString(),
        thumbnail: videoInfo.thumbnail
      });

      Alert.alert(
        'Descarga Completa',
        '¿Deseas compartir el video?',
        [
          { text: 'No', style: 'cancel' },
          { 
            text: 'Sí', 
            onPress: async () => {
              if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(result.uri);
              }
            }
          }
        ]
      );

    } catch (error) {
      console.error('❌ Error completo:', error);
      Alert.alert(
        'Error', 
        `No se pudo descargar el video: ${error.message}`
      );
    } finally {
      setLoading(false);
      setDownloadProgress(0);
    }
  };

  const clearInput = () => {
    setUrl('');
    setVideoInfo(null);
    setDownloadProgress(0);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Ionicons name="logo-youtube" size={60} color="#FF0000" />
          <Text style={styles.title}>Descarga YTAPP</Text>
          <Text style={styles.subtitle}>App hecha por aaron</Text>
        </View>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Pega aquí la URL del video de YouTube"
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
          />
          {url.length > 0 && (
            <TouchableOpacity 
              style={styles.clearButton}
              onPress={clearInput}
            >
              <Ionicons name="close-circle" size={24} color="#888" />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleGetInfo}
          disabled={loading}
        >
          {loading && !videoInfo ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="search" size={20} color="#fff" />
              <Text style={styles.buttonText}>Buscar Video</Text>
            </>
          )}
        </TouchableOpacity>

        {videoInfo && (
          <View style={styles.videoCard}>
            <Image
              source={{ uri: videoInfo.thumbnail }}
              style={styles.thumbnail}
              resizeMode="cover"
            />
            <Text style={styles.videoTitle}>{videoInfo.title}</Text>
            <Text style={styles.videoInfo}>
              Canal: {videoInfo.channel || 'Desconocido'}
            </Text>
            <Text style={styles.videoInfo}>
              Duración: {videoInfo.duration || 'N/A'}
            </Text>

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

            <TouchableOpacity
              style={[styles.downloadButton, loading && styles.buttonDisabled]}
              onPress={() => handleDownload('high')}
              disabled={loading}
            >
              {loading && videoInfo ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="download" size={20} color="#fff" />
                  <Text style={styles.buttonText}>Descargar Video</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
    color: '#333',
    marginTop: 10,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
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
    backgroundColor: '#fff',
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
    backgroundColor: '#2563eb',
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
  downloadButton: {
    backgroundColor: '#10b981',
    padding: 15,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 15,
  },
});