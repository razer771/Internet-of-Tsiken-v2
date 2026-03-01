/**
 * Remote IoT Monitor Screen with WebRTC & AI Detection Overlay
 * =============================================================
 * 
 * Features:
 * - WebRTC WHEP stream consumption from MediaMTX
 * - Real-time AI detection alerts via WebSocket
 * - Dynamic bounding box overlay on video
 * - Auto-scaling to screen dimensions
 * 
 * Required Dependencies:
 * npm install react-native-webrtc@124.0.1
 * npm install @react-native-community/netinfo@11.2.1
 * 
 * @format
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  StatusBar,
  LayoutChangeEvent,
} from 'react-native';
import {
  RTCView,
  RTCPeerConnection,
  RTCSessionDescription,
  MediaStream,
  mediaDevices,
} from 'react-native-webrtc';

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
  // MediaMTX WebRTC WHEP endpoint (replace with your Raspberry Pi IP or Cloudflare Tunnel URL)
  MEDIAMTX_WHEP_URL: 'http://YOUR_RASPBERRY_PI_IP:8889/cam/whep',
  
  // Python FastAPI WebSocket endpoint (replace with Cloudflare Tunnel URL)
  WEBSOCKET_URL: 'ws://YOUR_CLOUDFLARE_TUNNEL_URL/ws/alerts',
  
  // ICE servers (Google STUN for NAT traversal)
  ICE_SERVERS: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
  
  // Detection display duration (milliseconds)
  DETECTION_TIMEOUT: 3000,
  
  // WebSocket reconnection settings
  WS_RECONNECT_DELAY: 2000,
  WS_MAX_RECONNECT_ATTEMPTS: 10,
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const RemoteIoTMonitorScreen = () => {
  // State management
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detections, setDetections] = useState<ScaledBbox[]>([]);
  const [videoLayout, setVideoLayout] = useState({ width: 0, height: 0 });
  const [wsConnected, setWsConnected] = useState(false);
  
  // Refs
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const detectionTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const wsReconnectAttemptsRef = useRef(0);
  const wsReconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // ============================================================================
  // WEBRTC CONNECTION MANAGEMENT
  // ============================================================================
  
  const connectWebRTC = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    
    try {
      // Create RTCPeerConnection
      const pc = new RTCPeerConnection({
        iceServers: CONFIG.ICE_SERVERS,
        iceTransportPolicy: 'all',
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require',
      });
      
      peerConnectionRef.current = pc;
      
      // Handle incoming stream
      pc.ontrack = (event) => {
        console.log('Received remote track:', event.track.kind);
        if (event.streams && event.streams[0]) {
          setStream(event.streams[0]);
          setIsConnected(true);
          setIsConnecting(false);
        }
      };
      
      // Handle ICE connection state changes
      pc.oniceconnectionstatechange = () => {
        console.log('ICE connection state:', pc.iceConnectionState);
        
        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          setIsConnected(true);
          setIsConnecting(false);
        } else if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
          setError('WebRTC connection lost');
          setIsConnected(false);
        }
      };
      
      // Add transceivers for receiving video
      pc.addTransceiver('video', { direction: 'recvonly' });
      pc.addTransceiver('audio', { direction: 'recvonly' });
      
      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      // Send offer to MediaMTX WHEP endpoint
      const response = await fetch(CONFIG.MEDIAMTX_WHEP_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/sdp',
        },
        body: offer.sdp,
      });
      
      if (!response.ok) {
        throw new Error(`WHEP request failed: ${response.status} ${response.statusText}`);
      }
      
      // Get answer SDP from MediaMTX
      const answerSDP = await response.text();
      
      // Set remote description
      await pc.setRemoteDescription(
        new RTCSessionDescription({
          type: 'answer',
          sdp: answerSDP,
        })
      );
      
      console.log('WebRTC connection established');
      
    } catch (err) {
      console.error('WebRTC connection error:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect to camera');
      setIsConnecting(false);
      setIsConnected(false);
      
      // Cleanup on error
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
    }
  }, []);
  
  const disconnectWebRTC = useCallback(() => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    setStream(null);
    setIsConnected(false);
    setIsConnecting(false);
  }, []);
  
  // ============================================================================
  // WEBSOCKET CONNECTION MANAGEMENT
  // ============================================================================
  
  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return; // Already connected
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
        
        // Attempt reconnection
        if (wsReconnectAttemptsRef.current < CONFIG.WS_MAX_RECONNECT_ATTEMPTS) {
          wsReconnectAttemptsRef.current++;
          console.log(
            `Reconnecting WebSocket (attempt ${wsReconnectAttemptsRef.current}/${CONFIG.WS_MAX_RECONNECT_ATTEMPTS})...`
          );
          wsReconnectTimerRef.current = setTimeout(() => {
            connectWebSocket();
          }, CONFIG.WS_RECONNECT_DELAY);
        } else {
          setError('WebSocket connection failed after maximum retry attempts');
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
        return; // Video layout not ready
      }
      
      // Calculate scaling factors
      const scaleX = videoLayout.width / detection.frame_width;
      const scaleY = videoLayout.height / detection.frame_height;
      
      // Scale bounding box to screen coordinates
      const scaledBbox: ScaledBbox = {
        x: detection.bbox.x * scaleX,
        y: detection.bbox.y * scaleY,
        width: detection.bbox.width * scaleX,
        height: detection.bbox.height * scaleY,
        class_name: detection.class_name,
        confidence: detection.confidence,
      };
      
      // Add to detections array
      setDetections((prev) => [...prev, scaledBbox]);
      
      // Create unique key for this detection
      const detectionKey = `${detection.timestamp}_${detection.class_name}`;
      
      // Clear existing timer if any
      const existingTimer = detectionTimersRef.current.get(detectionKey);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }
      
      // Set timeout to remove detection after configured duration
      const timer = setTimeout(() => {
        setDetections((prev) =>
          prev.filter((d) => d !== scaledBbox)
        );
        detectionTimersRef.current.delete(detectionKey);
      }, CONFIG.DETECTION_TIMEOUT);
      
      detectionTimersRef.current.set(detectionKey, timer);
      
      console.log(`Detection: ${detection.class_name} (${(detection.confidence * 100).toFixed(1)}%)`);
    },
    [videoLayout]
  );
  
  // ============================================================================
  // VIDEO LAYOUT HANDLER
  // ============================================================================
  
  const handleVideoLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setVideoLayout({ width, height });
    console.log('Video layout:', width, 'x', height);
  }, []);
  
  // ============================================================================
  // LIFECYCLE EFFECTS
  // ============================================================================
  
  // Connect on mount
  useEffect(() => {
    connectWebRTC();
    connectWebSocket();
    
    return () => {
      disconnectWebRTC();
      disconnectWebSocket();
      
      // Clear all detection timers
      detectionTimersRef.current.forEach((timer) => clearTimeout(timer));
      detectionTimersRef.current.clear();
    };
  }, []);
  
  // ============================================================================
  // RENDER HELPERS
  // ============================================================================
  
  const renderDetectionOverlay = () => {
    if (!isConnected || detections.length === 0) {
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
            WebRTC: {isConnected ? 'Connected' : isConnecting ? 'Connecting...' : 'Disconnected'}
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
        {isConnecting && !stream && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.loadingText}>Connecting to camera...</Text>
          </View>
        )}
        
        {stream && (
          <>
            <RTCView
              streamURL={stream.toURL()}
              style={styles.videoStream}
              objectFit="cover"
              mirror={false}
            />
            
            {/* AI Detection Overlay - Positioned absolutely over video */}
            <View style={styles.overlayContainer}>
              {renderDetectionOverlay()}
            </View>
          </>
        )}
        
        {error && !isConnecting && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={connectWebRTC}>
              <Text style={styles.retryButtonText}>Retry Connection</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
      
      {/* Connection Status */}
      {renderConnectionStatus()}
      
      {/* Control Buttons */}
      <View style={styles.controlsContainer}>
        <TouchableOpacity
          style={[styles.controlButton, styles.disconnectButton]}
          onPress={disconnectWebRTC}
          disabled={!isConnected}
        >
          <Text style={styles.controlButtonText}>Disconnect</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.controlButton, styles.reconnectButton]}
          onPress={connectWebRTC}
          disabled={isConnecting || isConnected}
        >
          <Text style={styles.controlButtonText}>
            {isConnecting ? 'Connecting...' : 'Connect'}
          </Text>
        </TouchableOpacity>
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
    pointerEvents: 'none', // Allow touches to pass through to video
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    marginTop: 16,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
  controlsContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#1a1a1a',
    justifyContent: 'space-around',
  },
  controlButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    marginHorizontal: 8,
    alignItems: 'center',
  },
  disconnectButton: {
    backgroundColor: '#ff4444',
  },
  reconnectButton: {
    backgroundColor: '#007AFF',
  },
  controlButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default RemoteIoTMonitorScreen;
