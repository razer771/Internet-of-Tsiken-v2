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

export default function CameraStream({ serverUrl, onServerDiscovered, autoConnect = false, fullscreen = false, persistConnection = false }) {
  const [isConnected, setIsConnected] = useState(persistConnection);
  const [detections, setDetections] = useState({ objects: [], fps: 0, count: 0 });
  const [detectionHistory, setDetectionHistory] = useState([]); // Track last 5 detections
  const [actualServerUrl, setActualServerUrl] = useState(serverUrl);
  const [discoveryState, setDiscoveryState] = useState(persistConnection ? 'success' : 'idle');
  const webViewRef = useRef(null);
  const discoveryTimeoutRef = useRef(null);

  // Construct stream URL
  const streamUrl = `${actualServerUrl}/video_feed`;
  const detectionsUrl = `${actualServerUrl}/detections`;

  // Update state when persistConnection or serverUrl changes
  useEffect(() => {
    if (persistConnection && serverUrl) {
      setDiscoveryState('success');
      setIsConnected(true);
      setActualServerUrl(serverUrl);
    } else if (autoConnect && discoveryState === 'idle') {
      startDiscovery();
    }
  }, [autoConnect, persistConnection, serverUrl]);

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
      
      // Add new detections to history
      if (data.objects && data.objects.length > 0) {
        const timestamp = new Date();
        const newDetections = data.objects.map((obj, idx) => ({
          ...obj,
          timestamp: timestamp.toISOString(),
          uniqueId: `${obj.class}-${timestamp.getTime()}-${idx}`, // Unique ID per object
        }));
        
        // Add to history and keep only last 5 detections
        setDetectionHistory(prev => {
          const combined = [...newDetections, ...prev];
          return combined.slice(0, 5); // Keep only the 5 most recent
        });
      }
    } catch (err) {
      console.log('Detection fetch failed:', err.message);
    }
  };

  const handleRetry = () => {
    setDiscoveryState('idle');
  };

  const handleRefresh = () => {
    // Reset and reconnect
    setIsConnected(false);
    setDiscoveryState('discovering');
    setTimeout(() => {
      startDiscovery();
    }, 100);
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
        <View style={fullscreen ? styles.placeholderBoxFullscreen : styles.streamContainer}>
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
        <View style={fullscreen ? styles.placeholderBoxFullscreen : styles.streamContainer}>
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
        <View style={fullscreen ? styles.placeholderBoxFullscreen : styles.streamContainer}>
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
            {/* Refresh Button */}
            <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh}>
              <Ionicons name="refresh" size={18} color="#fff" />
              <Text style={styles.refreshText}>REFRESH</Text>
            </TouchableOpacity>

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
          <View style={styles.tableHeaderRow}>
            <Text style={styles.tableHeaderText}>Object</Text>
            <Text style={styles.tableHeaderText}>Accuracy</Text>
            <Text style={styles.tableHeaderText}>Date & Time</Text>
          </View>

          {/* Detection Table */}
          {detectionHistory.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={32} color="#999" />
              <Text style={styles.emptyText}>No objects detected yet</Text>
            </View>
          ) : (
            detectionHistory.map((obj) => {
              const detectionTime = new Date(obj.timestamp);
              const timeString = detectionTime.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: true 
              });
              const dateString = detectionTime.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric' 
              });
              
              return (
                <View key={obj.uniqueId} style={styles.tableRow}>
                  <Text style={styles.tableCell}>{obj.class}</Text>
                  <Text style={[styles.tableCell, styles.accuracyText]}>{obj.confidence}%</Text>
                  <Text style={[styles.tableCell, styles.dateTimeText]}>
                    {dateString} {timeString}
                  </Text>
                </View>
              );
            })
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
    minHeight: 200,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#333',
    borderStyle: 'dashed',
  },
  placeholderBoxFullscreen: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
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
  refreshButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(19, 62, 135, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  refreshText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 11,
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
    backgroundColor: '#fff',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: PRIMARY,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  tableHeaderText: {
    flex: 1,
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    alignItems: 'center',
  },
  tableCell: {
    flex: 1,
    fontSize: 11,
    color: '#333',
    textAlign: 'center',
  },
  accuracyText: {
    fontWeight: '700',
    color: '#249D1D',
  },
  dateTimeText: {
    fontSize: 10,
    color: '#666',
  },
  emptyState: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    marginTop: 8,
    fontSize: 12,
    color: '#999',
  },
});
