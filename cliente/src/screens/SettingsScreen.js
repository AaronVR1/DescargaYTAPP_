import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import { clearAllHistory } from '../utils/storage';

export default function SettingsScreen() {
  const handleClearHistory = () => {
    Alert.alert(
      'Limpiar Historial',
      '¿Estás seguro de que deseas eliminar todo el historial de descargas?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearAllHistory();
              Alert.alert('Éxito', 'Historial eliminado correctamente');
            } catch (error) {
              Alert.alert('Error', 'No se pudo limpiar el historial');
            }
          }
        }
      ]
    );
  };

  const handleCheckStorage = async () => {
    try {
      const info = await FileSystem.getInfoAsync(FileSystem.documentDirectory);
      Alert.alert(
        'Información de Almacenamiento',
        `Directorio: ${info.uri}\n\nLos archivos se guardan en la carpeta de documentos de la app.`
      );
    } catch (error) {
      Alert.alert('Error', 'No se pudo obtener información de almacenamiento');
    }
  };

  const SettingItem = ({ icon, title, subtitle, onPress, color = '#2563eb' }) => (
    <TouchableOpacity style={styles.settingItem} onPress={onPress}>
      <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.settingTitle}>{title}</Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={24} color="#ccc" />
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>General</Text>
          
          <SettingItem
            icon="folder-outline"
            title="Ubicación de Archivos"
            subtitle="Ver dónde se guardan los videos"
            onPress={handleCheckStorage}
            color="#2563eb"
          />

          <SettingItem
            icon="trash-outline"
            title="Limpiar Historial"
            subtitle="Eliminar todo el historial de descargas"
            onPress={handleClearHistory}
            color="#ef4444"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Acerca de</Text>
          
          <View style={styles.infoCard}>
            <Ionicons name="information-circle" size={40} color="#2563eb" />
            <Text style={styles.appName}>YouTube Downloader</Text>
            <Text style={styles.version}>Versión 1.0.0</Text>
            <Text style={styles.description}>
              Aplicación educativa para descargar videos de YouTube.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Información Importante</Text>
          
          <View style={styles.warningCard}>
            <Ionicons name="warning" size={24} color="#f59e0b" />
            <Text style={styles.warningText}>
              Esta aplicación es solo para fines educativos. Respeta los derechos 
              de autor y las políticas de YouTube al descargar contenido.
            </Text>
          </View>
        </View>
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
    padding: 15,
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    marginLeft: 5,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  textContainer: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 3,
  },
  settingSubtitle: {
    fontSize: 13,
    color: '#666',
  },
  infoCard: {
    backgroundColor: '#fff',
    padding: 30,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  appName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 15,
  },
  version: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  description: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 15,
    lineHeight: 20,
  },
  warningCard: {
    backgroundColor: '#fef3c7',
    padding: 15,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#78350f',
    marginLeft: 10,
    lineHeight: 18,
  },
});