import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
} from "react";

const CameraContext = createContext();

export function CameraProvider({ children }) {
  // Persistent camera state - survives re-renders and notification pop-ups
  const [isConnected, setIsConnected] = useState(false);
  const [serverUrl, setServerUrl] = useState(null);
  const [discoveryState, setDiscoveryState] = useState("idle"); // idle, discovering, success, failed

  // Use refs for values that shouldn't trigger re-renders
  const lastPredatorDetectionsRef = useRef({});
  const lastPersonDetectionRef = useRef(null);
  const lastDetectionTimesRef = useRef({});

  // Connect to camera
  const connectCamera = useCallback((url) => {
    setServerUrl(url);
    setIsConnected(true);
    setDiscoveryState("success");
    console.log("CameraContext: Connected to", url);
  }, []);

  // Disconnect from camera
  const disconnectCamera = useCallback(() => {
    setIsConnected(false);
    setDiscoveryState("idle");
    console.log("CameraContext: Disconnected");
  }, []);

  // Update discovery state
  const updateDiscoveryState = useCallback((state) => {
    setDiscoveryState(state);
  }, []);

  // Get/set predator detection times (for cooldown)
  const getLastPredatorDetection = useCallback((predatorType) => {
    return lastPredatorDetectionsRef.current[predatorType] || 0;
  }, []);

  const setLastPredatorDetection = useCallback((predatorType, time) => {
    lastPredatorDetectionsRef.current[predatorType] = time;
  }, []);

  // Get/set person detection time
  const getLastPersonDetection = useCallback(() => {
    return lastPersonDetectionRef.current;
  }, []);

  const setLastPersonDetection = useCallback((time) => {
    lastPersonDetectionRef.current = time;
  }, []);

  // Get/set Firebase detection times (for deduplication)
  const getLastDetectionTime = useCallback((className) => {
    return lastDetectionTimesRef.current[className] || 0;
  }, []);

  const setLastDetectionTime = useCallback((className, time) => {
    lastDetectionTimesRef.current[className] = time;
  }, []);

  const value = {
    // State
    isConnected,
    serverUrl,
    discoveryState,

    // Actions
    connectCamera,
    disconnectCamera,
    updateDiscoveryState,
    setServerUrl,

    // Detection tracking (refs - won't cause re-renders)
    getLastPredatorDetection,
    setLastPredatorDetection,
    getLastPersonDetection,
    setLastPersonDetection,
    getLastDetectionTime,
    setLastDetectionTime,
  };

  return (
    <CameraContext.Provider value={value}>{children}</CameraContext.Provider>
  );
}

export function useCamera() {
  const context = useContext(CameraContext);
  if (!context) {
    throw new Error("useCamera must be used within a CameraProvider");
  }
  return context;
}
