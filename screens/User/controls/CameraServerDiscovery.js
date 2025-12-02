// CameraServerDiscovery.js - Auto-discover camera server across networks
import { Platform } from 'react-native';

/**
 * Attempts to discover the camera server using multiple methods
 * Returns the first working URL or null if none work
 */
export async function discoverCameraServer(timeout = 5000) {
  // List of possible server URLs to try (in priority order)
  const possibleUrls = [
    // 1. Hostname (works across different networks if mDNS is available)
    'http://rpi5desktop.local:5000',
    
    // 2. Common local network IPs (192.168.x.x)
    'http://192.168.1.19:5000',
    'http://192.168.0.19:5000',
    'http://192.168.1.100:5000',
    
    // 3. Current known IP
    'http://10.193.174.156:5000',
    
    // 4. Other common ranges
    'http://10.0.0.19:5000',
  ];

  console.log('🔍 Discovering camera server...');

  // Try each URL with a quick timeout
  for (const url of possibleUrls) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(`${url}/status`, {
        method: 'GET',
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data.status === 'online') {
          console.log('✅ Found camera server at:', url);
          return url;
        }
      }
    } catch (err) {
      // Continue to next URL
      console.log(`❌ Failed: ${url}`);
    }
  }

  console.log('⚠️ No camera server found');
  return null;
}

/**
 * Store the last working server URL in AsyncStorage
 */
export async function saveLastWorkingUrl(url) {
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    await AsyncStorage.setItem('camera_server_url', url);
  } catch (err) {
    console.log('Failed to save URL:', err);
  }
}

/**
 * Retrieve the last working server URL
 */
export async function getLastWorkingUrl() {
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    return await AsyncStorage.getItem('camera_server_url');
  } catch (err) {
    console.log('Failed to get saved URL:', err);
    return null;
  }
}
