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
  const [detections, setDetections] = useState({ objects: [], fps: 0, count: 0 });
  const [actualServerUrl, setActualServerUrl] = useState(serverUrl);
  const [discoveryState, setDiscoveryState] = useState('idle'); // idle, discovering, success, failed
  const webViewRef = useRef(null);
  const discoveryTimeoutRef = useRef(null);

  // Construct stream URL
  const streamUrl = `${actualServerUrl}/video_feed`;
  const detectionsUrl = `${actualServerUrl}/detections`;

  useEffect(() => {
    // Fetch detection data every second if connected
    let interval;
    if (isConnected) {
      interval = setInterval(fetchDetections, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
      if (discoveryTimeoutRef.current) clearTimeout(discoveryTimeoutRef.current);
    };
  }, [isConnected]);

  const startDiscovery = async () => {
    setDiscoveryState('discovering');
    
    // Set 30 second timeout
    discoveryTimeoutRef.current = setTimeout(() => {
      if (discoveryState === 'discovering') {
        setDiscoveryState('failed');
      }
    }, 30000);

    // Try cached URL first
    const lastUrl = await getLastWorkingUrl();
    if (lastUrl) {
      const connected = await checkServerStatus(lastUrl);
      if (connected) {
        clearTimeout(discoveryTimeoutRef.current);
        setActualServerUrl(lastUrl);
        if (onServerDiscovered) onServerDiscovered(lastUrl);
        setDiscoveryState('success');
        setIsConnected(true);
        return;
      }
    }

    // Auto-discover
    const discoveredUrl = await discoverCameraServer(3000);
    
    if (discoveredUrl) {
      const connected = await checkServerStatus(discoveredUrl);
      if (connected) {
        clearTimeout(discoveryTimeoutRef.current);
        setActualServerUrl(discoveredUrl);
        await saveLastWorkingUrl(discoveredUrl);
        if (onServerDiscovered) onServerDiscovered(discoveredUrl);
        setDiscoveryState('success');
        setIsConnected(true);
      } else {
        clearTimeout(discoveryTimeoutRef.current);
        setDiscoveryState('failed');
      }
    } else {
      clearTimeout(discoveryTimeoutRef.current);
      setDiscoveryState('failed');
    }
  };

  const checkServerStatus = async (urlToCheck) => {
    try {
      const testUrl = `${urlToCheck}/status`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(testUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
      });
      
      clearTimeout(timeoutId);
      const data = await response.json();
      
      return data.status === 'online';
    } catch (err) {
      console.log('Status check failed:', err.message);
      return false;
    }
  };

  const fetchDetections = async () => {
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
      console.log('Detection fetch failed:', err.message);
    }
  };

  const handleRetry = () => {
    setDiscoveryState('idle');
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

  // Idle state - show "Detect Camera" button
  if (discoveryState === 'idle') {
    return (
      <View style={styles.centerContainer}>
        <TouchableOpacity style={styles.detectButton} onPress={startDiscovery}>
          <Ionicons name="camera-outline" size={24} color="#fff" />
          <Text style={styles.detectButtonText}>Detect Camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Discovering state - show loading
  if (discoveryState === 'discovering') {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );
  }

  // Failed state - show error and retry
  if (discoveryState === 'failed') {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>No camera detected</Text>
        <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
          <Text style={styles.retryText}>Please try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Success state - show camera stream
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
  },
  detectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PRIMARY,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  detectButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
});
