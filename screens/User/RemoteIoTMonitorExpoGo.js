/**
 * Remote IoT Monitor Screen - EXPO GO COMPATIBLE VERSION
 * ========================================================
 * 
 * Uses simple HTTP video streaming instead of WebRTC
 * Compatible with Expo Go (no native modules required)
 * 
 * Limitations vs WebRTC version:
 * - Higher latency (1-3 seconds vs 100-300ms)
 * - More bandwidth usage
 * - No peer-to-peer connection
 * 
 * @format
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  StatusBar,
  LayoutChangeEvent,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface DetectionAlert {
  timestamp: string;
  class_name: string;
  class_id: number;
  confidence: number;
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  frame_width: number;
  frame_height: number;
}

interface ScaledBbox {
  x: number;
  y: number;
  width: number;
  height: number;
  class_name: string;
  confidence: number;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // HLS stream from MediaMTX (replace with your Raspberry Pi IP)
  HLS_STREAM_URL: 'http://192.168.1.100:8888/cam/index.m3u8',
  
  // Python FastAPI WebSocket endpoint
  WEBSOCKET_URL: 'ws://192.168.1.100:8000/ws/alerts',
  
  // Detection display duration (milliseconds)
  DETECTION_TIMEOUT: 3000,
  
  // WebSocket reconnection settings
  WS_RECONNECT_DELAY: 2000,
  WS_MAX_RECONNECT_ATTEMPTS: 10,
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const RemoteIoTMonitorExpoGo = () => {
  // State management
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detections, setDetections] = useState<ScaledBbox[]>([]);
  const [videoLayout, setVideoLayout] = useState({ width: 0, height: 0 });
  const [wsConnected, setWsConnected] = useState(false);
  const [videoStatus, setVideoStatus] = useState<any>({});
  
  // Refs
  const videoRef = useRef<Video>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const detectionTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const wsReconnectAttemptsRef = useRef(0);
  const wsReconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // ============================================================================
  // WEBSOCKET CONNECTION MANAGEMENT
  // ============================================================================
  
  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }
    
    console.log('Connecting to WebSocket:', CONFIG.WEBSOCKET_URL);
    
    try {
      const ws = new WebSocket(CONFIG.WEBSOCKET_URL);
      
      ws.onopen = () => {
        console.log('WebSocket connected');
        setWsConnected(true);
        wsReconnectAttemptsRef.current = 0;
      };
      
      ws.onmessage = (event) => {
        try {
          const detection: DetectionAlert = JSON.parse(event.data);
          handleDetection(detection);
        } catch (err) {
          console.error('Failed to parse detection:', err);
        }
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setWsConnected(false);
      };
      
      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setWsConnected(false);
        wsRef.current = null;
        
        if (wsReconnectAttemptsRef.current < CONFIG.WS_MAX_RECONNECT_ATTEMPTS) {
          wsReconnectAttemptsRef.current++;
          wsReconnectTimerRef.current = setTimeout(() => {
            connectWebSocket();
          }, CONFIG.WS_RECONNECT_DELAY);
        }
      };
      
      wsRef.current = ws;
    } catch (err) {
      console.error('WebSocket connection error:', err);
      setWsConnected(false);
    }
  }, []);
  
  const disconnectWebSocket = useCallback(() => {
    if (wsReconnectTimerRef.current) {
      clearTimeout(wsReconnectTimerRef.current);
      wsReconnectTimerRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setWsConnected(false);
  }, []);
  
  // ============================================================================
  // DETECTION HANDLING & BBOX SCALING
  // ============================================================================
  
  const handleDetection = useCallback(
    (detection: DetectionAlert) => {
      if (!videoLayout.width || !videoLayout.height) {
        return;
      }
      
      const scaleX = videoLayout.width / detection.frame_width;
      const scaleY = videoLayout.height / detection.frame_height;
      
      const scaledBbox: ScaledBbox = {
        x: detection.bbox.x * scaleX,
        y: detection.bbox.y * scaleY,
        width: detection.bbox.width * scaleX,
        height: detection.bbox.height * scaleY,
        class_name: detection.class_name,
        confidence: detection.confidence,
      };
      
      setDetections((prev) => [...prev, scaledBbox]);
      
      const detectionKey = `${detection.timestamp}_${detection.class_name}`;
      
      const existingTimer = detectionTimersRef.current.get(detectionKey);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }
      
      const timer = setTimeout(() => {
        setDetections((prev) => prev.filter((d) => d !== scaledBbox));
        detectionTimersRef.current.delete(detectionKey);
      }, CONFIG.DETECTION_TIMEOUT);
      
      detectionTimersRef.current.set(detectionKey, timer);
      
      console.log(`Detection: ${detection.class_name} (${(detection.confidence * 100).toFixed(1)}%)`);
    },
    [videoLayout]
  );
  
  // ============================================================================
  // VIDEO HANDLERS
  // ============================================================================
  
  const handleVideoLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setVideoLayout({ width, height });
    console.log('Video layout:', width, 'x', height);
  }, []);
  
  const handlePlaybackStatusUpdate = useCallback((status: any) => {
    setVideoStatus(status);
    if (status.isLoaded) {
      setIsConnected(true);
      setError(null);
    } else if (status.error) {
      setError(status.error);
      setIsConnected(false);
    }
  }, []);
  
  // ============================================================================
  // LIFECYCLE EFFECTS
  // ============================================================================
  
  useEffect(() => {
    connectWebSocket();
    
    return () => {
      disconnectWebSocket();
      detectionTimersRef.current.forEach((timer) => clearTimeout(timer));
      detectionTimersRef.current.clear();
    };
  }, []);
  
  // ============================================================================
  // RENDER HELPERS
  // ============================================================================
  
  const renderDetectionOverlay = () => {
    if (detections.length === 0) {
      return null;
    }
    
    return detections.map((detection, index) => (
      <View
        key={`detection_${index}`}
        style={[
          styles.boundingBox,
          {
            left: detection.x,
            top: detection.y,
            width: detection.width,
            height: detection.height,
          },
        ]}
      >
        <View style={styles.labelContainer}>
          <Text style={styles.labelText}>
            {detection.class_name} {(detection.confidence * 100).toFixed(0)}%
          </Text>
        </View>
      </View>
    ));
  };
  
  const renderConnectionStatus = () => {
    return (
      <View style={styles.statusContainer}>
        <View style={styles.statusRow}>
          <View style={[styles.statusIndicator, isConnected && styles.statusConnected]} />
          <Text style={styles.statusText}>
            Video: {isConnected ? 'Connected' : 'Connecting...'}
          </Text>
        </View>
        <View style={styles.statusRow}>
          <View style={[styles.statusIndicator, wsConnected && styles.statusConnected]} />
          <Text style={styles.statusText}>
            AI Alerts: {wsConnected ? 'Connected' : 'Disconnected'}
          </Text>
        </View>
      </View>
    );
  };
  
  // ============================================================================
  // MAIN RENDER
  // ============================================================================
  
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      
      {/* Video Stream */}
      <View style={styles.videoContainer} onLayout={handleVideoLayout}>
        <Video
          ref={videoRef}
          source={{ uri: CONFIG.HLS_STREAM_URL }}
          style={styles.videoStream}
          resizeMode={ResizeMode.CONTAIN}
          shouldPlay
          isLooping
          onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
        />
        
        {/* AI Detection Overlay */}
        <View style={styles.overlayContainer}>
          {renderDetectionOverlay()}
        </View>
        
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </View>
      
      {/* Connection Status */}
      {renderConnectionStatus()}
      
      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <Text style={styles.infoText}>
          📱 Expo Go Mode - Using HLS streaming (higher latency)
        </Text>
        <Text style={styles.infoSubtext}>
          For low-latency WebRTC, build development client
        </Text>
      </View>
    </View>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  videoContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    position: 'relative',
  },
  videoStream: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: 'none',
  },
  boundingBox: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: '#ff0000',
    borderStyle: 'solid',
    backgroundColor: 'transparent',
  },
  labelContainer: {
    position: 'absolute',
    top: -25,
    left: 0,
    backgroundColor: '#ff0000',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  labelText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  errorContainer: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 14,
    textAlign: 'center',
  },
  statusContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#666',
    marginRight: 8,
  },
  statusConnected: {
    backgroundColor: '#00ff00',
  },
  statusText: {
    color: '#fff',
    fontSize: 14,
  },
  infoBanner: {
    backgroundColor: '#2196F3',
    padding: 12,
    alignItems: 'center',
  },
  infoText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  infoSubtext: {
    color: '#e3f2fd',
    fontSize: 12,
    marginTop: 4,
  },
});

export default RemoteIoTMonitorExpoGo;
