import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  TextInput,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import { clearAllHistory } from '../utils/storage';
import { getServerConfig, setServerUrl } from '../utils/config';

export default function SettingsScreen() {
  const [serverIp, setServerIp] = useState('');
  const [serverPort, setServerPort] = useState('3000');
  const [modalVisible, setModalVisible] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [inputType, setInputType] = useState(''); // 'ip' o 'port'

  React.useEffect(() => {
    loadServerConfig();
  }, []);

  const loadServerConfig = async () => {
    try {
      const config = await getServerConfig();
      setServerIp(config.ip);
      setServerPort(config.port);
      console.log('✅ Configuración cargada:', config);
    } catch (error) {
      console.error('Error al cargar configuración:', error);
    }
  };

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

  const openModal = (type) => {
    setInputType(type);
    if (type === 'ip') {
      setInputValue(serverIp);
    } else {
      setInputValue(serverPort);
    }
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!inputValue.trim()) {
      Alert.alert('Error', 'El valor no puede estar vacío');
      return;
    }

    try {
      if (inputType === 'ip') {
        await setServerUrl(inputValue, serverPort);
        setServerIp(inputValue);
        Alert.alert('Éxito', `IP guardada: ${inputValue}`);
      } else {
        await setServerUrl(serverIp, inputValue);
        setServerPort(inputValue);
        Alert.alert('Éxito', `Puerto guardado: ${inputValue}`);
      }
      setModalVisible(false);
      await loadServerConfig();
    } catch (error) {
      Alert.alert('Error', error.message);
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
          <Text style={styles.sectionTitle}>Servidor</Text>
          
          <SettingItem
            icon="server"
            title="Cambiar IP del Servidor"
            subtitle={`IP: ${serverIp}`}
            onPress={() => openModal('ip')}
            color="#8b5cf6"
          />

          <SettingItem
            icon="settings"
            title="Cambiar Puerto"
            subtitle={`Puerto: ${serverPort}`}
            onPress={() => openModal('port')}
            color="#06b6d4"
          />
        </View>

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
            <Text style={styles.appName}>Descarga YTAPP</Text>
            <Text style={styles.version}>Versión 1.0.0</Text>
            <Text style={styles.description}>
              Aplicación hecha para la clase de desarrollo de aplicaciones para dispositivos moviles.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Información Importante</Text>
          
          <View style={styles.warningCard}>
            <Ionicons name="warning" size={24} color="#f59e0b" />
            <Text style={styles.warningText}>
              Aplicacion hecha por Aaronselo.
            </Text>
          </View>
        </View>
      </View>

      {/* Modal para cambiar IP o Puerto */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {inputType === 'ip' ? 'Cambiar IP del Servidor' : 'Cambiar Puerto'}
            </Text>
            <Text style={styles.modalSubtitle}>
              {inputType === 'ip' 
                ? 'Ingresa la IP (ej: 192.168.1.74)' 
                : 'Ingresa el puerto (ej: 3000)'}
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder={inputType === 'ip' ? '192.168.1.74' : '3000'}
              value={inputValue}
              onChangeText={setInputValue}
              keyboardType={inputType === 'ip' ? 'default' : 'number-pad'}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleSave}
              >
                <Text style={styles.saveButtonText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a0033',
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
    color: '#ffffffff',
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

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 25,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    marginBottom: 20,
    backgroundColor: '#f9f9f9',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  modalButton: {
    flex: 1,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#e5e7eb',
  },
  cancelButtonText: {
    color: '#333',
    fontWeight: '600',
    fontSize: 16,
  },
  saveButton: {
    backgroundColor: '#8b5cf6',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});