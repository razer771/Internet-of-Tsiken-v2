// CameraStream.js - Live YOLO Camera Component for React Native
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { discoverCameraServer, saveLastWorkingUrl, getLastWorkingUrl } from './CameraServerDiscovery';

const PRIMARY = '#133E87';

export default function CameraStream({ serverUrl, onServerDiscovered }) {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [detections, setDetections] = useState({ objects: [], fps: 0, count: 0 });
  const [error, setError] = useState(null);
  const [actualServerUrl, setActualServerUrl] = useState(serverUrl);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const webViewRef = useRef(null);

  // Construct stream URL
  const streamUrl = `${actualServerUrl}/video_feed`;
  const detectionsUrl = `${actualServerUrl}/detections`;
  const statusUrl = `${actualServerUrl}/status`;

  useEffect(() => {
    // Try to connect with provided URL first, then auto-discover if it fails
    initializeConnection();

    // Fetch detection data every second
    const interval = setInterval(fetchDetections, 1000);

    return () => clearInterval(interval);
  }, [serverUrl]);

  const initializeConnection = async () => {
    // First, try the provided URL
    const connected = await checkServerStatus(serverUrl);
    
    if (!connected) {
      // If provided URL fails, try last working URL
      const lastUrl = await getLastWorkingUrl();
      if (lastUrl && lastUrl !== serverUrl) {
        console.log('Trying last working URL:', lastUrl);
        const connectedToLast = await checkServerStatus(lastUrl);
        if (connectedToLast) {
          setActualServerUrl(lastUrl);
          if (onServerDiscovered) onServerDiscovered(lastUrl);
          return;
        }
      }
      
      // If both fail, try auto-discovery
      await autoDiscover();
    } else {
      // Save working URL
      await saveLastWorkingUrl(serverUrl);
    }
  };

  const autoDiscover = async () => {
    setIsDiscovering(true);
    setError('Auto-discovering camera server...\nThis may take a moment.');
    
    const discoveredUrl = await discoverCameraServer(3000);
    
    if (discoveredUrl) {
      setActualServerUrl(discoveredUrl);
      await saveLastWorkingUrl(discoveredUrl);
      if (onServerDiscovered) onServerDiscovered(discoveredUrl);
      checkServerStatus(discoveredUrl);
    } else {
      setError('Cannot find camera server\n\nPlease check:\n✓ Server running on Pi\n✓ Same WiFi network\n✓ Or manually set IP in settings');
      setIsLoading(false);
    }
    
    setIsDiscovering(false);
  };

  const checkServerStatus = async (urlToCheck = actualServerUrl) => {
    try {
      const testUrl = `${urlToCheck}/status`;
      console.log('Checking server status:', testUrl);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(testUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        },
      });
      
      clearTimeout(timeoutId);
      
      const data = await response.json();
      console.log('Server response:', data);
      
      if (data.status === 'online') {
        setIsConnected(true);
        setIsLoading(false);
        setError(null);
        return true;
      } else {
        throw new Error('Server not online');
      }
    } catch (err) {
      console.error('Connection error:', err);
      
      // Don't show error if we're about to auto-discover
      if (!isDiscovering) {
        let errorMsg = 'Cannot connect to camera server\n\n';
        
        if (err.name === 'AbortError') {
          errorMsg += '⏱️ Connection timeout\n\n';
        } else if (err.message.includes('Network request failed')) {
          errorMsg += '🌐 Network Error\n\n';
        }
        
        errorMsg += 'Will attempt auto-discovery...';
        setError(errorMsg);
      }
      
      setIsLoading(false);
      setIsConnected(false);
      return false;
    }
  };

  const fetchDetections = async () => {
    if (!isConnected) return;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      const response = await fetch(detectionsUrl, {
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      const data = await response.json();
      setDetections(data);
    } catch (err) {
      // Silent fail for detection updates
      console.log('Detection fetch failed:', err.message);
    }
  };

  const handleRetry = () => {
    setIsLoading(true);
    setError(null);
    initializeConnection();
  };

  const handleAutoDiscover = () => {
    setIsLoading(true);
    setError(null);
    autoDiscover();
  };

  // HTML to display MJPEG stream in WebView
  const streamHTML = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
        <style>
          body {
            margin: 0;
            padding: 0;
            background: #000;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            overflow: hidden;
          }
          img {
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
          }
        </style>
      </head>
      <body>
        <img src="${streamUrl}" alt="Camera Stream" />
      </body>
    </html>
  `;

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={PRIMARY} />
        <Text style={styles.statusText}>Connecting to camera...</Text>
        <Text style={styles.smallText}>{serverUrl}</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={48} color="#D70E11" />
        <Text style={styles.errorTitle}>Connection Failed</Text>
        <Text style={styles.errorText}>{error}</Text>
        <Text style={styles.serverUrl}>Server: {serverUrl}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
          <Ionicons name="refresh" size={18} color="#fff" style={{ marginRight: 6 }} />
          <Text style={styles.retryText}>Retry Connection</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Live Stream using WebView */}
      <View style={styles.streamContainer}>
        <WebView
          ref={webViewRef}
          source={{ html: streamHTML }}
          style={styles.webView}
          scrollEnabled={false}
          scalesPageToFit={true}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.warn('WebView error:', nativeEvent);
          }}
        />
        
        {/* Live Badge */}
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>

        {/* FPS Counter */}
        <View style={styles.fpsBadge}>
          <Text style={styles.fpsText}>{detections.fps} FPS</Text>
        </View>
      </View>

      {/* Detection Info */}
      <View style={styles.infoContainer}>
        <View style={styles.infoRow}>
          <Ionicons name="eye-outline" size={20} color={PRIMARY} />
          <Text style={styles.infoText}>
            {detections.count} object{detections.count !== 1 ? 's' : ''} detected
          </Text>
        </View>

        {/* List detected objects */}
        {detections.objects && detections.objects.length > 0 && (
          <View style={styles.objectsList}>
            {detections.objects.slice(0, 5).map((obj, idx) => (
              <View key={idx} style={styles.objectTag}>
                <Text style={styles.objectName}>{obj.class}</Text>
                <Text style={styles.objectConf}>{obj.confidence}%</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  streamContainer: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: '#000',
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  webView: {
    flex: 1,
    backgroundColor: '#000',
  },
  liveBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#D70E11',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
    marginRight: 6,
  },
  liveText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  fpsBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  fpsText: {
    color: '#0f0',
    fontWeight: '600',
    fontSize: 12,
  },
  infoContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  objectsList: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  objectTag: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  objectName: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginRight: 4,
  },
  objectConf: {
    color: '#fff',
    fontSize: 10,
    opacity: 0.8,
  },
  statusText: {
    marginTop: 12,
    color: '#666',
    fontSize: 14,
  },
  smallText: {
    marginTop: 8,
    color: '#999',
    fontSize: 12,
  },
  helpText: {
    marginTop: 12,
    color: '#666',
    fontSize: 13,
    textAlign: 'left',
    lineHeight: 20,
  },
  errorTitle: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: '700',
    color: '#D70E11',
  },
  errorText: {
    marginTop: 12,
    color: '#333',
    fontSize: 13,
    textAlign: 'left',
    paddingHorizontal: 20,
    lineHeight: 20,
  },
  serverUrl: {
    marginTop: 8,
    color: PRIMARY,
    fontSize: 12,
    fontWeight: '600',
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: PRIMARY,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
  },
});
