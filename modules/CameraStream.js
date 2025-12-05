// CameraStream.js - Live YOLO Camera Component for React Native
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  Animated,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { discoverCameraServer, saveLastWorkingUrl, getLastWorkingUrl } from './CameraServerDiscovery';
import { capturePredatorDetection, checkForPredators } from './PredatorDetectionService';
import { useNotifications } from '../screens/User/controls/NotificationContext';

const PRIMARY = '#133E87';

export default function CameraStream({ serverUrl, onServerDiscovered, autoConnect = false, fullscreen = false, persistConnection = false }) {
  const [isConnected, setIsConnected] = useState(persistConnection);
  const [detections, setDetections] = useState({ objects: [], fps: 0, count: 0 });
  const [detectionHistory, setDetectionHistory] = useState([]); // Track last 5 detections
  const [actualServerUrl, setActualServerUrl] = useState(serverUrl);
<<<<<<< Updated upstream
  const [discoveryState, setDiscoveryState] = useState('idle'); // idle, discovering, success, failed
  const [capturing, setCapturing] = useState(false);
  const [autoCapture, setAutoCapture] = useState(true); // Enable auto-capture by default
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [modalMessage, setModalMessage] = useState({ title: '', description: '', isAuto: false });
  const lastCaptureRef = useRef(null);
=======
  const [discoveryState, setDiscoveryState] = useState(persistConnection ? 'success' : 'idle');
>>>>>>> Stashed changes
  const webViewRef = useRef(null);
  const discoveryTimeoutRef = useRef(null);
  const { addNotification } = useNotifications();

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

  // Auto-capture predators when detected (high confidence)
  useEffect(() => {
    if (!isConnected || !autoCapture) return;

    const predator = checkForPredators(detections, 80); // 80% confidence threshold
    
    if (predator) {
      // Prevent duplicate captures within 10 seconds
      const now = Date.now();
      if (lastCaptureRef.current && (now - lastCaptureRef.current) < 10000) {
        return;
      }

      // Auto-capture
      lastCaptureRef.current = now;
      handleCapturePredator(predator, true);
    }
  }, [detections, isConnected, autoCapture]);

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
        const newDetections = data.objects.map(obj => ({
          ...obj,
          timestamp: timestamp.toISOString(),
        }));
        
        // Add to history and keep only last 5 unique detections
        setDetectionHistory(prev => {
          const combined = [...newDetections, ...prev];
          // Remove duplicates based on class name and keep most recent
          const unique = [];
          const seen = new Set();
          
          for (const det of combined) {
            const key = `${det.class}-${det.timestamp}`;
            if (!seen.has(key) && unique.length < 5) {
              seen.add(key);
              unique.push(det);
            }
          }
          
          return unique;
        });
      }
    } catch (err) {
      console.log('Detection fetch failed:', err.message);
    }
  };

  const handleRetry = () => {
    setDiscoveryState('idle');
  };

  const handleCapturePredator = async (detection = null, isAuto = false) => {
    if (capturing) return;

    setCapturing(true);
    try {
      const result = await capturePredatorDetection(actualServerUrl, detection);
      
      if (result.success) {
        // Trigger notification
        addNotification({
          category: "IoT: Internet of Tsiken",
          title: `⚠️ Predator Detected!`,
          message: `${result.detectionData.detectedClass} detected with ${result.detectionData.confidence.toFixed(1)}% confidence`,
          time: new Date().toLocaleString(),
        });

        setModalMessage({
          title: result.detectionData.detectedClass.toUpperCase(),
          description: `${result.detectionData.confidence.toFixed(1)}% confidence\n${isAuto ? 'Auto-captured' : 'Manually captured'} and saved to your detections.`,
          isAuto: isAuto
        });
        setShowSuccessModal(true);
      } else {
        setModalMessage({
          title: 'Capture Failed',
          description: result.error || 'Could not capture detection',
          isAuto: false
        });
        setShowErrorModal(true);
      }
    } catch (error) {
      console.error("Capture error:", error);
      setModalMessage({
        title: 'Error',
        description: 'Failed to capture predator detection',
        isAuto: false
      });
      setShowErrorModal(true);
    } finally {
      setCapturing(false);
    }
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
            detectionHistory.map((obj, idx) => {
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
                <View key={idx} style={styles.tableRow}>
                  <Text style={styles.tableCell}>{obj.class}</Text>
                  <Text style={[styles.tableCell, styles.accuracyText]}>{obj.confidence}%</Text>
                  <Text style={[styles.tableCell, styles.dateTimeText]}>
                    {dateString} {timeString}
                  </Text>
                </View>
              );
            })
          )}

          {/* Predator Capture Controls */}
          <View style={styles.captureControls}>
            <TouchableOpacity
              style={styles.autoCaptureToggle}
              onPress={() => setAutoCapture(!autoCapture)}
            >
              <Ionicons
                name={autoCapture ? "checkmark-circle" : "ellipse-outline"}
                size={20}
                color={autoCapture ? "#4CAF50" : "#999"}
              />
              <Text style={styles.autoCaptureText}>Auto-capture predators</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.captureButton, capturing && styles.captureButtonDisabled]}
              onPress={() => handleCapturePredator(null, false)}
              disabled={capturing}
            >
              {capturing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="camera" size={18} color="#fff" />
                  <Text style={styles.captureButtonText}>Capture Now</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Success Modal */}
      <SuccessModal
        visible={showSuccessModal}
        title={modalMessage.title}
        description={modalMessage.description}
        isAuto={modalMessage.isAuto}
        onClose={() => setShowSuccessModal(false)}
      />

      {/* Error Modal */}
      <ErrorModal
        visible={showErrorModal}
        title={modalMessage.title}
        description={modalMessage.description}
        onClose={() => setShowErrorModal(false)}
      />
    </View>
  );
}

// Success Modal Component
function SuccessModal({ visible, title, description, isAuto, onClose }) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto close after 3 seconds
      const timeout = setTimeout(() => {
        onClose();
      }, 3000);

      return () => clearTimeout(timeout);
    } else {
      scaleAnim.setValue(0);
      fadeAnim.setValue(0);
    }
  }, [visible]);

  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={modalStyles.overlay}>
        <Animated.View
          style={[
            modalStyles.successContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <Animated.View
            style={[
              modalStyles.iconCircle,
              modalStyles.successCircle,
              { transform: [{ scale: scaleAnim }] },
            ]}
          >
            <Ionicons name="shield-checkmark" size={48} color="#4CAF50" />
          </Animated.View>

          <Text style={modalStyles.successTitle}>Predator Captured!</Text>
          <Text style={modalStyles.predatorName}>{title}</Text>
          <Text style={modalStyles.successDescription}>{description}</Text>

          {isAuto && (
            <View style={modalStyles.autoBadge}>
              <Ionicons name="flash" size={14} color="#FF9800" />
              <Text style={modalStyles.autoBadgeText}>Auto-captured</Text>
            </View>
          )}

          <TouchableOpacity style={modalStyles.okButton} onPress={onClose}>
            <Text style={modalStyles.okButtonText}>OK</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

// Error Modal Component
function ErrorModal({ visible, title, description, onClose }) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0);
      fadeAnim.setValue(0);
    }
  }, [visible]);

  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={modalStyles.overlay}>
        <Animated.View
          style={[
            modalStyles.errorContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <Animated.View
            style={[
              modalStyles.iconCircle,
              modalStyles.errorCircle,
              { transform: [{ scale: scaleAnim }] },
            ]}
          >
            <Ionicons name="alert-circle" size={48} color="#FF6B6B" />
          </Animated.View>

          <Text style={modalStyles.errorTitle}>{title}</Text>
          <Text style={modalStyles.errorDescription}>{description}</Text>

          <TouchableOpacity style={modalStyles.okButton} onPress={onClose}>
            <Text style={modalStyles.okButtonText}>OK</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  successContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    width: '90%',
    maxWidth: 400,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  errorContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    width: '90%',
    maxWidth: 400,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  successCircle: {
    backgroundColor: '#E8F5E9',
  },
  errorCircle: {
    backgroundColor: '#FFEBEE',
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#4CAF50',
    marginBottom: 8,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FF6B6B',
    marginBottom: 8,
  },
  predatorName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#000',
    marginBottom: 12,
  },
  successDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 24,
  },
  errorDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 24,
  },
  autoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 20,
  },
  autoBadgeText: {
    fontSize: 12,
    color: '#FF9800',
    fontWeight: '600',
    marginLeft: 4,
  },
  okButton: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 40,
    paddingVertical: 12,
    borderRadius: 10,
    minWidth: 120,
  },
  okButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});

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
  captureControls: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  autoCaptureToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  autoCaptureText: {
    marginLeft: 6,
    fontSize: 13,
    color: '#333',
  },
  captureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  captureButtonDisabled: {
    backgroundColor: '#CCC',
  },
  captureButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
