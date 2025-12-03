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
import { useAdminNotifications } from '../screens/Admin/AdminNotificationContext';
import { useNotifications } from '../screens/User/controls/NotificationContext';

const PRIMARY = '#133E87';

export default function CameraStream({ serverUrl, onServerDiscovered, autoConnect = false, fullscreen = false }) {
  const [isConnected, setIsConnected] = useState(false);
  const [detections, setDetections] = useState({ objects: [], fps: 0, count: 0 });
  const [actualServerUrl, setActualServerUrl] = useState(serverUrl);
  const [discoveryState, setDiscoveryState] = useState('idle'); // idle, discovering, success, failed
  const [lastPersonDetection, setLastPersonDetection] = useState(null);
  const webViewRef = useRef(null);
  const discoveryTimeoutRef = useRef(null);
  const { addNotification: addAdminNotification } = useAdminNotifications();
  const { addNotification: addUserNotification } = useNotifications();

  // Construct stream URL
  const streamUrl = `${actualServerUrl}/video_feed`;
  const detectionsUrl = `${actualServerUrl}/detections`;

  useEffect(() => {
    // Auto-connect on mount if enabled (for fullscreen modal)
    if (autoConnect && discoveryState === 'idle') {
      startDiscovery();
    }
  }, [autoConnect]);

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
      
      // Check for person detection
      if (data.objects && data.objects.length > 0) {
        const personDetected = data.objects.some(obj => 
          obj.class && obj.class.toLowerCase() === 'person'
        );
        
        if (personDetected) {
          const now = Date.now();
          // Only send notification if no person was detected in the last 5 minutes (300000ms)
          if (!lastPersonDetection || (now - lastPersonDetection) > 300000) {
            setLastPersonDetection(now);
            const notificationData = {
              category: "IoT: Internet of Tsiken",
              title: "Person detected",
              description: `Camera detected a person in the brooder area at ${new Date().toLocaleString()}. Please verify for security purposes.`,
              type: "security",
            };
            // Send to admin
            addAdminNotification({
              ...notificationData,
              category: "System Alert",
            });
            // Send to user
            addUserNotification(notificationData);
          }
        }
      }
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

  // Idle state - show placeholder with "Detect Camera" button
  if (discoveryState === 'idle') {
    return (
      <View style={styles.container}>
        <View style={styles.streamContainer}>
          <View style={styles.placeholderBox}>
            <TouchableOpacity style={styles.detectButton} onPress={startDiscovery}>
              <Ionicons name="camera-outline" size={24} color="#fff" />
              <Text style={styles.detectButtonText}>Detect Camera</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // Discovering state - show placeholder with loading
  if (discoveryState === 'discovering') {
    return (
      <View style={styles.container}>
        <View style={styles.streamContainer}>
          <View style={styles.placeholderBox}>
            <ActivityIndicator size="large" color={PRIMARY} />
            <Text style={styles.searchingText}>Searching for camera...</Text>
          </View>
        </View>
      </View>
    );
  }

  // Failed state - show placeholder with error and retry
  if (discoveryState === 'failed') {
    return (
      <View style={styles.container}>
        <View style={styles.streamContainer}>
          <View style={styles.placeholderBox}>
            <Ionicons name="warning-outline" size={48} color="#666" style={{marginBottom: 12}} />
            <Text style={styles.errorText}>No camera detected</Text>
            <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
              <Text style={styles.retryText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // Success state - show camera stream
  return (
    <View style={styles.container}>
      {/* Live Stream using WebView */}
      <View style={fullscreen ? styles.streamContainerFullscreen : styles.streamContainer}>
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
        
        {/* Show badges only when NOT in fullscreen */}
        {!fullscreen && (
          <>
            {/* Live Badge */}
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>

            {/* FPS Counter */}
            <View style={styles.fpsBadge}>
              <Text style={styles.fpsText}>{detections.fps} FPS</Text>
            </View>
          </>
        )}
      </View>

      {/* Show detection info only when NOT in fullscreen */}
      {!fullscreen && (
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
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  placeholderBox: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#333',
    borderStyle: 'dashed',
  },
  searchingText: {
    color: '#999',
    fontSize: 14,
    marginTop: 12,
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
    color: '#999',
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
  streamContainerFullscreen: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
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
