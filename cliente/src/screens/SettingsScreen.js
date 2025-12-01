import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { setServerUrl, getServerConfig } from '../utils/config';

export default function SettingsScreen() {
  const [ip, setIp] = useState('');
  const [port, setPort] = useState('3000');
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const config = await getServerConfig();
      if (config) {
        setIp(config.ip);
        setPort(config.port || '3000');
      }
    } catch (error) {
      console.error('Error al cargar configuración:', error);
    }
  };

  const testConnection = async () => {
    if (!ip.trim()) {
      Alert.alert('Error', 'Por favor ingresa una dirección IP');
      return;
    }

    setTesting(true);
    try {
      const testUrl = `http://${ip.trim()}:${port}`;
      console.log('🔍 Probando conexión a:', testUrl);

      // ⭐ Crear timeout manual porque fetch no lo soporta directamente
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 segundos

      const response = await fetch(testUrl, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        Alert.alert(
          '✅ Conexión Exitosa',
          `Servidor encontrado:\n${data.message || 'Servidor activo'}\n\nIP: ${ip}\nPuerto: ${port}`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          '⚠️ Servidor Responde',
          `El servidor respondió pero con código: ${response.status}\n\nVerifica que sea el servidor correcto.`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      let errorMessage = 'No se pudo conectar al servidor.\n\n';
      
      if (error.name === 'AbortError') {
        errorMessage += 'Timeout: El servidor no respondió en 10 segundos.\n\n';
      } else {
        errorMessage += `Error: ${error.message}\n\n`;
      }
      
      errorMessage += 'Verifica:\n';
      errorMessage += '1. El servidor está corriendo\n';
      errorMessage += '2. La IP es correcta\n';
      errorMessage += '3. Estás en la misma red WiFi\n';
      errorMessage += '4. Probaste abrir http://' + ip + ':' + port + ' en el navegador del teléfono';

      Alert.alert('❌ Error de Conexión', errorMessage, [{ text: 'OK' }]);
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!ip.trim()) {
      Alert.alert('Error', 'Por favor ingresa una dirección IP');
      return;
    }

    // Validación básica de formato IP
    const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipPattern.test(ip.trim())) {
      Alert.alert(
        'Formato Incorrecto',
        'La IP debe tener el formato:\n192.168.0.1\n\nVerifica y vuelve a intentar.'
      );
      return;
    }

    setLoading(true);
    try {
      await setServerUrl(ip, port);
      Alert.alert(
        '✅ Configuración Guardada',
        `Servidor configurado:\nhttp://${ip}:${port}\n\nAhora puedes descargar videos.`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="settings" size={50} color="#8b5cf6" />
        <Text style={styles.title}>Configuración del Servidor</Text>
      </View>

      {/* INSTRUCCIONES CLARAS */}
      <View style={styles.instructionsCard}>
        <Text style={styles.instructionsTitle}>📋 Instrucciones:</Text>
        
        <Text style={styles.instructionStep}>
          1. En tu PC, abre CMD o PowerShell:
        </Text>
        <View style={styles.codeBlock}>
          <Text style={styles.codeText}>Windows + R → cmd → Enter</Text>
        </View>

        <Text style={styles.instructionStep}>
          2. Ejecuta este comando para ver tu IP:
        </Text>
        <View style={styles.codeBlock}>
          <Text style={styles.codeText}>ipconfig</Text>
        </View>

        <Text style={styles.instructionStep}>
          3. Busca "Adaptador de LAN inalámbrica" o "Ethernet":
        </Text>
        <View style={styles.codeBlock}>
          <Text style={styles.highlightText}>
            Dirección IPv4: 192.168.X.X
          </Text>
          <Text style={styles.codeText}>Copia solo: 192.168.X.X</Text>
        </View>

        <Text style={styles.instructionStep}>
          4. Inicia el servidor en tu PC:
        </Text>
        <View style={styles.codeBlock}>
          <Text style={styles.codeText}>cd servidor</Text>
          <Text style={styles.codeText}>npm start</Text>
        </View>

        <Text style={styles.instructionStep}>
          5. Pega la IP abajo y presiona "Probar Conexión"
        </Text>

        <Text style={styles.instructionStep}>
          6. Si funciona, presiona "Guardar"
        </Text>
      </View>

      {/* FORMULARIO */}
      <View style={styles.formCard}>
        <Text style={styles.label}>Dirección IP del Servidor:</Text>
        <TextInput
          style={styles.input}
          value={ip}
          onChangeText={setIp}
          placeholder="Ejemplo: 192.168.0.59"
          placeholderTextColor="#666"
          keyboardType="numeric"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={styles.label}>Puerto:</Text>
        <TextInput
          style={styles.input}
          value={port}
          onChangeText={setPort}
          placeholder="3000"
          placeholderTextColor="#666"
          keyboardType="numeric"
          editable={false}
        />

        <Text style={styles.resultUrl}>
          {ip ? `http://${ip}:${port}` : 'http://___.___.___.___.___:3000'}
        </Text>
      </View>

      {/* BOTONES */}
      <View style={styles.buttonsContainer}>
        <TouchableOpacity
          style={[styles.button, styles.testButton]}
          onPress={testConnection}
          disabled={testing || !ip}
        >
          {testing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="wifi" size={20} color="#fff" />
              <Text style={styles.buttonText}>Probar Conexión</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.saveButton]}
          onPress={handleSave}
          disabled={loading || !ip}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="save" size={20} color="#fff" />
              <Text style={styles.buttonText}>Guardar Configuración</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* TIPS */}
      <View style={styles.tipsCard}>
        <Text style={styles.tipsTitle}>💡 Tips:</Text>
        <Text style={styles.tipText}>
          • Usa el comando "ipconfig" en Windows para ver tu IP
        </Text>
        <Text style={styles.tipText}>
          • Tu PC y tu teléfono deben estar en la misma red WiFi
        </Text>
        <Text style={styles.tipText}>
          • NO uses localhost o 127.0.0.1 (no funciona)
        </Text>
        <Text style={styles.tipText}>
          • La IP debe tener formato: 192.168.X.X
        </Text>
        <Text style={styles.tipText}>
          • Si cambias de red, actualiza la IP aquí
        </Text>
        <Text style={styles.tipText}>
          • Los cambios se aplican al volver a la pestaña Inicio
        </Text>
      </View>

      {/* FOOTER */}
      <View style={styles.footer}>
        <Text style={styles.version}>DescargaYT v1.0.0</Text>
        <Text style={styles.credits}>Proyecto Escolar - Grupo 7A6</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a0033',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 10,
  },
  instructionsCard: {
    backgroundColor: '#2d1b4e',
    margin: 15,
    padding: 20,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#8b5cf6',
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
  },
  instructionStep: {
    fontSize: 14,
    color: '#fff',
    marginTop: 10,
    marginBottom: 5,
  },
  codeBlock: {
    backgroundColor: '#1a0033',
    padding: 10,
    borderRadius: 8,
    marginVertical: 5,
  },
  codeText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#8b5cf6',
  },
  highlightText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#22d3ee',
    marginTop: 5,
  },
  formCard: {
    backgroundColor: '#2d1b4e',
    margin: 15,
    padding: 20,
    borderRadius: 15,
  },
  label: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 8,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#1a0033',
    color: '#fff',
    padding: 15,
    borderRadius: 10,
    fontSize: 16,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#8b5cf6',
  },
  resultUrl: {
    color: '#22d3ee',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
    fontFamily: 'monospace',
  },
  buttonsContainer: {
    marginHorizontal: 15,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  testButton: {
    backgroundColor: '#3b82f6',
  },
  saveButton: {
    backgroundColor: '#8b5cf6',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  tipsCard: {
    backgroundColor: '#2d1b4e',
    margin: 15,
    padding: 20,
    borderRadius: 15,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  tipText: {
    color: '#ccc',
    fontSize: 14,
    marginVertical: 3,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 20,
    marginBottom: 20,
  },
  version: {
    color: '#888',
    fontSize: 12,
  },
  credits: {
    color: '#666',
    fontSize: 10,
    marginTop: 5,
  },
});