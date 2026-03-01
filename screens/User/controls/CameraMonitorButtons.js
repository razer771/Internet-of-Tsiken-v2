/**
 * Camera Monitor Quick Access Component
 * Add this to your Home screen or Settings to test the camera monitors
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const CameraMonitorButtons = () => {
  const navigation = useNavigation();

  return (
    <View style={styles.container}>
      <Text style={styles.header}>📹 Camera Monitor</Text>
      
      {/* Expo Go Compatible Version */}
      <TouchableOpacity
        style={[styles.button, styles.expoGoButton]}
        onPress={() => navigation.navigate('RemoteMonitorExpoGo')}
      >
        <MaterialCommunityIcons name="video" size={24} color="#fff" />
        <View style={styles.buttonContent}>
          <Text style={styles.buttonTitle}>Test in Expo Go</Text>
          <Text style={styles.buttonSubtitle}>HLS Streaming • Works Now</Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={24} color="#fff" />
      </TouchableOpacity>

      {/* WebRTC Version (requires dev build) */}
      <TouchableOpacity
        style={[styles.button, styles.webrtcButton]}
        onPress={() => navigation.navigate('RemoteMonitor')}
      >
        <MaterialCommunityIcons name="video-wireless" size={24} color="#fff" />
        <View style={styles.buttonContent}>
          <Text style={styles.buttonTitle}>WebRTC Monitor</Text>
          <Text style={styles.buttonSubtitle}>Low Latency • Needs Dev Build</Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={24} color="#fff" />
      </TouchableOpacity>

      <Text style={styles.info}>
        💡 Start with Expo Go version for instant testing
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    marginVertical: 8,
  },
  header: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  expoGoButton: {
    backgroundColor: '#2196F3',
  },
  webrtcButton: {
    backgroundColor: '#4CAF50',
  },
  buttonContent: {
    flex: 1,
    marginLeft: 12,
  },
  buttonTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    marginTop: 2,
  },
  info: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
});

export default CameraMonitorButtons;

// ============================================================================
// USAGE EXAMPLE - Add to your Home.js or Settings screen
// ============================================================================

/*

import CameraMonitorButtons from './path/to/CameraMonitorButtons';

// Inside your screen component:
<CameraMonitorButtons />

// Or with custom styling:
<View style={{ padding: 20 }}>
  <CameraMonitorButtons />
</View>

*/
