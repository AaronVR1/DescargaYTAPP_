import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { getDownloadHistory, removeFromHistory } from '../utils/storage';

export default function DownloadsScreen() {
  const [downloads, setDownloads] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadDownloads = async () => {
    setLoading(true);
    try {
      const history = await getDownloadHistory();
      setDownloads(history);
    } catch (error) {
      console.error('Error al cargar descargas:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadDownloads();
    }, [])
  );

  const handleShare = async (item) => {
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(item.uri);
      } else {
        Alert.alert('Error', 'Compartir no está disponible en este dispositivo');
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo compartir el archivo');
    }
  };

  const handleDelete = async (item) => {
    const itemType = item.isPlaylist ? 'playlist' : 'video';
    const itemName = item.isPlaylist ? 'esta playlist' : 'este video';
    
    Alert.alert(
      'Eliminar',
      `¿Estás seguro de que deseas eliminar ${itemName}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await FileSystem.deleteAsync(item.uri, { idempotent: true });
              await removeFromHistory(item.uri);
              loadDownloads();
              Alert.alert('Éxito', `${itemType === 'playlist' ? 'Playlist' : 'Video'} eliminado correctamente`);
            } catch (error) {
              Alert.alert('Error', `No se pudo eliminar el ${itemType}`);
            }
          }
        }
      ]
    );
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      {/* Mostrar thumbnail solo si NO es playlist */}
      {item.thumbnail && !item.isPlaylist && (
        <Image
          source={{ uri: item.thumbnail }}
          style={styles.thumbnail}
          resizeMode="cover"
        />
      )}
      
      {/* Si es playlist, mostrar un ícono en lugar de thumbnail */}
      {item.isPlaylist && (
        <View style={styles.playlistIconContainer}>
          <Ionicons name="albums" size={80} color="#8b5cf6" />
          <Text style={styles.playlistIconText}>PLAYLIST</Text>
        </View>
      )}

      <View style={styles.cardContent}>
        {/* Badge de Playlist */}
        {item.isPlaylist && (
          <View style={styles.playlistBadge}>
            <Ionicons name="list" size={14} color="#fff" />
            <Text style={styles.playlistBadgeText}>
              {item.videoCount} videos • {item.type === 'audio' ? 'MP3' : 'MP4'}
            </Text>
          </View>
        )}

        <Text style={styles.title} numberOfLines={2}>
          {item.title}
        </Text>
        
        {/* Mostrar tamaño si está disponible */}
        {item.size && (
          <Text style={styles.sizeText}>
            📦 {(item.size / (1024 * 1024)).toFixed(2)} MB
          </Text>
        )}
        
        <Text style={styles.date}>
          {new Date(item.date).toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </Text>
      </View>
      
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleShare(item)}
        >
          <Ionicons name="share-social" size={24} color="#2563eb" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleDelete(item)}
        >
          <Ionicons name="trash" size={24} color="#ef4444" />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.loadingText}>Cargando...</Text>
      </View>
    );
  }

  if (downloads.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="download-outline" size={80} color="#ccc" />
        <Text style={styles.emptyText}>No hay descargas aún</Text>
        <Text style={styles.emptySubtext}>
          Los videos y playlists que descargues aparecerán aquí
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={downloads}
        renderItem={renderItem}
        keyExtractor={(item, index) => index.toString()}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a0033',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a0033',
    padding: 20,
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
  },
  list: {
    padding: 15,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  thumbnail: {
    width: '100%',
    height: 150,
  },
  playlistIconContainer: {
    width: '100%',
    height: 150,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playlistIconText: {
    color: '#8b5cf6',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 10,
  },
  cardContent: {
    padding: 15,
  },
  playlistBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8b5cf6',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    alignSelf: 'flex-start',
    marginBottom: 10,
    gap: 5,
  },
  playlistBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#504f4fff',
    marginBottom: 5,
  },
  sizeText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 5,
  },
  date: {
    fontSize: 12,
    color: '#666',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  actionButton: {
    padding: 10,
    marginLeft: 10,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 20,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 10,
    textAlign: 'center',
  },
});