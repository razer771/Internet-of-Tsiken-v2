// CameraStream.js - Live YOLO Camera Component for React Native
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { WebView } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import {
  discoverCameraServer,
  saveLastWorkingUrl,
  getLastWorkingUrl,
} from "./CameraServerDiscovery";
import { useAdminNotifications } from "../screens/Admin/AdminNotificationContext";
import { useNotifications } from "../screens/User/controls/NotificationContext";

const PRIMARY = "#133E87";

export default function CameraStream({
  serverUrl,
  onServerDiscovered,
  autoConnect = false,
  fullscreen = false,
  onOpenFullscreen,
}) {
  const [isConnected, setIsConnected] = useState(false);
  const [detections, setDetections] = useState({
    objects: [],
    fps: 0,
    count: 0,
  });
  const [recentDetections, setRecentDetections] = useState([]);
  const [actualServerUrl, setActualServerUrl] = useState(serverUrl);
  const [discoveryState, setDiscoveryState] = useState("idle"); // idle, discovering, success, failed
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
    if (autoConnect && discoveryState === "idle") {
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
      if (discoveryTimeoutRef.current)
        clearTimeout(discoveryTimeoutRef.current);
    };
  }, [isConnected]);

  const startDiscovery = async () => {
    setDiscoveryState("discovering");

    // Set 30 second timeout
    discoveryTimeoutRef.current = setTimeout(() => {
      if (discoveryState === "discovering") {
        setDiscoveryState("failed");
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
        setDiscoveryState("success");
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
        setDiscoveryState("success");
        setIsConnected(true);
      } else {
        clearTimeout(discoveryTimeoutRef.current);
        setDiscoveryState("failed");
      }
    } else {
      clearTimeout(discoveryTimeoutRef.current);
      setDiscoveryState("failed");
    }
  };

  const checkServerStatus = async (urlToCheck) => {
    try {
      const testUrl = `${urlToCheck}/status`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(testUrl, {
        method: "GET",
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });

      clearTimeout(timeoutId);
      const data = await response.json();

      return data.status === "online";
    } catch (err) {
      console.log("Status check failed:", err.message);
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

      if (data.objects && data.objects.length > 0) {
        setRecentDetections((prev) => {
          let updated = [...prev];
          const now = new Date();

          data.objects.forEach((obj) => {
            if (!obj.class) return;
            const objClass = obj.class.toLowerCase();

            // Only add if we haven't seen this class in the last 10 seconds to avoid spam
            const lastOfClass = updated.find((d) => d.class === objClass);
            if (!lastOfClass || now.getTime() - lastOfClass.timestamp > 10000) {
              updated.unshift({
                id: now.getTime() + Math.random(),
                class: objClass,
                confidence: obj.confidence || 0,
                timestamp: now.getTime(),
                timeStr: now.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                }),
                dateStr: now.toLocaleDateString(),
              });
            }
          });

          // Sort by newest first
          updated.sort((a, b) => b.timestamp - a.timestamp);
          // Keep only the most recent 5
          return updated.slice(0, 5);
        });
      }

      // Check for person detection
      if (data.objects && data.objects.length > 0) {
        const personDetected = data.objects.some(
          (obj) => obj.class && obj.class.toLowerCase() === "person",
        );

        if (personDetected) {
          const now = Date.now();
          // Only send notification if no person was detected in the last 5 minutes (300000ms)
          if (!lastPersonDetection || now - lastPersonDetection > 300000) {
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
      console.log("Detection fetch failed:", err.message);
    }
  };

  const stopDiscovery = () => {
    if (discoveryTimeoutRef.current) clearTimeout(discoveryTimeoutRef.current);
    setDiscoveryState("idle");
    setIsConnected(false);
  };

  const handleRetry = () => {
    setDiscoveryState("idle");
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
            user-select: none;
            -webkit-user-select: none;
          }
          img {
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
            user-select: none;
            -webkit-user-select: none;
            -webkit-touch-callout: none;
            pointer-events: none;
          }
        </style>
      </head>
      <body>
        <img src="${streamUrl}" alt="Camera Stream" draggable="false" />
      </body>
    </html>
  `;

  // Idle / Discovering state - button always visible
  if (discoveryState === "idle" || discoveryState === "discovering") {
    const isDetecting = discoveryState === "discovering";
    return (
      <View style={styles.container}>
        <View style={styles.streamContainer}>
          <View style={styles.placeholderBox}>
            {isDetecting ? (
              <ActivityIndicator size="large" color={PRIMARY} />
            ) : (
              <Ionicons name="camera-off-outline" size={44} color="#444" />
            )}
            <Text style={styles.searchingText}>
              {isDetecting ? "Searching for camera..." : "Camera not connected"}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.detectButton, isDetecting && styles.detectButtonStop]}
          onPress={isDetecting ? stopDiscovery : startDiscovery}
        >
          <Ionicons
            name={isDetecting ? "stop-circle-outline" : "camera-outline"}
            size={18}
            color="#fff"
          />
          <Text style={styles.detectButtonText}>
            {isDetecting ? "Stop Detecting" : "Detect Camera"}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Failed state - show placeholder with error and retry
  if (discoveryState === "failed") {
    return (
      <View style={styles.container}>
        <View style={styles.streamContainer}>
          <View style={styles.placeholderBox}>
            <Ionicons
              name="warning-outline"
              size={44}
              color="#666"
              style={{ marginBottom: 8 }}
            />
            <Text style={styles.errorText}>No camera detected</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
          <Ionicons name="refresh-outline" size={18} color="#fff" />
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Success state - show camera stream
  return (
    <View style={styles.container}>
      {/* Live Stream using WebView */}
      <View
        pointerEvents="none"
        style={
          fullscreen ? styles.streamContainerFullscreen : styles.streamContainer
        }
      >
        <WebView
          ref={webViewRef}
          source={{ html: streamHTML }}
          style={styles.webView}
          scrollEnabled={false}
          scalesPageToFit={true}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.warn("WebView error:", nativeEvent);
          }}
        />
      </View>

      {!fullscreen && (
        <TouchableOpacity
          style={[styles.detectButton, styles.detectButtonStop]}
          onPress={stopDiscovery}
        >
          <Ionicons name="stop-circle-outline" size={18} color="#fff" />
          <Text style={styles.detectButtonText}>Stop Camera</Text>
        </TouchableOpacity>
      )}

      {/* Recent Detections List */}
      {!fullscreen && recentDetections.length > 0 && (
        <View style={styles.recentDetectionsContainer}>
          <View style={styles.recentHeader}>
            <Ionicons name="list-outline" size={16} color="#444" />
            <Text style={styles.recentTitle}>Recent Detections</Text>
          </View>
          {recentDetections.map((item) => (
            <View key={item.id} style={styles.recentItem}>
              <View style={styles.recentItemLeft}>
                <Ionicons
                  name={
                    item.class === "person" 
                      ? "person-outline" 
                      : ["cat", "dog", "rat", "snake"].includes(item.class)
                      ? "warning-outline"
                      : "scan-outline"
                  }
                  size={16}
                  color={item.class === "person" ? "#ef4444" : "#f59e0b"}
                />
                <Text style={styles.recentItemClass}>
                  {item.class.charAt(0).toUpperCase() + item.class.slice(1)}
                </Text>
              </View>
              <Text style={styles.recentItemTime}>
                {item.dateStr} {item.timeStr}
              </Text>
            </View>
          ))}
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
    backgroundColor: "#1a1a1a",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#333",
    borderStyle: "dashed",
  },
  searchingText: {
    color: "#999",
    fontSize: 14,
    marginTop: 12,
  },
  detectButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PRIMARY,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 10,
    gap: 8,
  },
  detectButtonStop: {
    backgroundColor: "#ef4444", // Changed to red for stopping 
  },
  detectButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  errorText: {
    fontSize: 14,
    color: "#999",
    marginTop: 4,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ef4444",
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 10,
    gap: 8,
  },
  retryText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  streamContainer: {
    width: "100%",
    aspectRatio: 4 / 3,
    backgroundColor: "#000",
    borderRadius: 8,
    overflow: "hidden",
    position: "relative",
  },
  streamContainerFullscreen: {
    width: "100%",
    height: "100%",
    backgroundColor: "#000",
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  webView: {
    flex: 1,
    backgroundColor: "#000",
  },
  liveBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "#D70E11",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    flexDirection: "row",
    alignItems: "center",
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#fff",
    marginRight: 6,
  },
  liveText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
  fpsBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  fpsText: {
    color: "#0f0",
    fontWeight: "600",
    fontSize: 12,
  },
  infoContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  infoText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  objectsList: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  objectTag: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
    marginBottom: 6,
    flexDirection: "row",
    alignItems: "center",
  },
  objectName: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    marginRight: 4,
  },
  objectConf: {
    color: "#fff",
    fontSize: 10,
    opacity: 0.8,
  },
  recentDetectionsContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  recentHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingBottom: 6,
  },
  recentTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#334155",
    marginLeft: 6,
  },
  recentItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  recentItemLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  recentItemClass: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1e293b",
    marginLeft: 8,
  },
  recentItemTime: {
    fontSize: 12,
    color: "#64748b",
  },
});
