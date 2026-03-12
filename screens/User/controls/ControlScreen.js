// screensample/ControlScreen.js
/**
 * USER ACTIVITY LOGGING SYSTEM
 * All user actions are logged to Firestore "activity_logs" collection
 * with sub-collections for different action types.
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Image,
  TouchableOpacity,
  Switch,
  Modal,
  TextInput,
  Alert,
  Platform,
  PanResponder,
  ActivityIndicator,
} from "react-native";
import Slider from "@react-native-community/slider";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { auth, db } from "../../../config/firebaseconfig";
import {
  doc,
  setDoc,
  addDoc,
  collection,
  getDocs,
  deleteDoc,
  query,
  where,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import {
  initializeSensors,
  getAllSensorReadings,
  getConnectionStatus,
  startSensorPolling,
} from "../../../modules/UltrasonicSensorService";
import {
  initializeServos,
  dispenseFeed,
  activateSprinkler,
  getServoConnectionStatus,
  configureWaterSystemUserId,
} from "../../../modules/ServoMotorService";
import CameraStream from "../../../modules/CameraStream";
import {
  fetchSunsetTime,
  formatSunsetDateTime,
} from "../../../modules/SunsetService";
import { useAdminNotifications } from "../../Admin/AdminNotificationContext";
import { useNotifications } from "./NotificationContext";

const PRIMARY = "#133E87";
const GREEN = "#249D1D";
const RED = "#D70E11";
const YELLOW = "#DFB118";
const BORDER_OVERLAY = "#e2e8f0";

// ==================== HELPER FUNCTIONS ====================

/**
 * Fetch Night Time schedule from Firestore
 * Retrieves document "1" from "nightTime" collection
 * @returns {Promise<Object|null>} Night time data or null if not found
 */
const fetchNightTimeSchedule = async () => {
  try {
    console.log("[FetchNightTime] Fetching night time schedule...");

    const docRef = doc(db, "nightTime", "1");
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      console.log("[FetchNightTime] Night time schedule loaded:", data);
      return data;
    } else {
      console.warn("[FetchNightTime] Night time document not found");
      return null;
    }
  } catch (error) {
    console.error(
      "[FetchNightTime] Error fetching night time schedule:",
      error,
    );
    return null;
  }
};

/**
 * Format time to GMT+8
 * @param {Date|string} dateTime - Date object or ISO string
 * @returns {string} Formatted time in GMT+8 (e.g., "7:00 PM")
 */
const formatTimeGMT8 = (dateTime) => {
  try {
    if (!dateTime) return "N/A";

    const date = dateTime instanceof Date ? dateTime : new Date(dateTime);
    const gmt8Date = new Date(date.getTime() + 8 * 60 * 60 * 1000);

    return gmt8Date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "UTC", // Already adjusted to GMT+8
    });
  } catch (error) {
    console.error("[FormatTimeGMT8] Error formatting time:", error);
    return "N/A";
  }
};

/**
 * Update Night Time Schedule in Firestore
 * @param {string|number} newTime - New time value (e.g., "19:00" or ISO timestamp)
 * @param {string} userId - Current user ID
 * @param {string} firstName - User's first name
 * @param {string} lastName - User's last name
 * @returns {Promise<{success: boolean, message: string, oldTime?: any, newTime?: any}>}
 */
const updateNightTimeSchedule = async (
  newTime,
  userId,
  firstName,
  lastName,
) => {
  try {
    console.log("[UpdateNightTime] Updating night time schedule...");

    if (!newTime || !userId) {
      throw new Error("New time and user ID are required");
    }

    // Fetch current schedule to get old value
    const currentData = await fetchNightTimeSchedule();
    const oldTime = currentData?.nightTime || currentData?.time || null;

    // Format the new time for display
    const newTimeFormatted = formatTimeGMT8(newTime);

    // Update the document
    const docRef = doc(db, "nightTime", "1");
    await setDoc(
      docRef,
      {
        nightTime: newTime,
        time: newTime,
        selectedTimeGMT8Formatted: newTimeFormatted,
        updatedAt: new Date().toISOString(),
        updatedBy: userId,
      },
      { merge: true },
    );

    console.log("[UpdateNightTime] Night time schedule updated successfully");

    // Log the activity
    try {
      const selectedTime = new Date(newTime).toISOString();
      const oldTimeFormatted = oldTime ? formatTimeGMT8(oldTime) : "N/A";

      const logEntry = {
        action: `Set night time at ${newTimeFormatted}`,
        description: `Night time starts at ${newTimeFormatted}`,
        firstName: firstName,
        lastName: lastName,
        newTime: newTimeFormatted,
        oldTime: oldTimeFormatted,
        selectedTime: selectedTime,
        selectedTimeGMT8: newTimeFormatted,
        timestamp: new Date().toISOString(),
        userId: userId,
      };

      await addDoc(
        collection(db, "activity_logs", "nightTime_logs", "events"),
        logEntry,
      );

      console.log("[UpdateNightTime] Activity logged successfully");
    } catch (logError) {
      console.warn("[UpdateNightTime] Failed to log activity:", logError);
      // Don't throw - logging failure shouldn't block the update
    }

    return {
      success: true,
      message: "Night time schedule updated successfully",
      oldTime: oldTime,
      newTime: newTime,
    };
  } catch (error) {
    console.error(
      "[UpdateNightTime] Error updating night time schedule:",
      error,
    );
    return {
      success: false,
      message: error.message || "Failed to update night time schedule",
    };
  }
};

export default function ControlScreen({ navigation }) {
  // Admin notifications
  const { addNotification } = useAdminNotifications();

  // User notifications
  const { addNotification: addUserNotification } = useNotifications();

  // ============================================================================
  // ACTIVITY LOGGING SYSTEM
  // Logs all user actions to Firestore activity_logs collection
  // ============================================================================

  /**
   * Universal activity logger for ControlScreen actions
   * @param {string} actionType - Sub-collection name (e.g., "addFeedSchedule_logs")
   * @param {object} payload - Action-specific data
   * @returns {Promise<void>}
   */
  const logActivity = async (actionType, payload) => {
    try {
      const user = auth.currentUser;
      if (!user) {
        console.warn("⚠️ [LOGGING] No authenticated user, skipping log");
        return;
      }

      // Fetch user profile from users collection
      let firstName = "N/A";
      let lastName = "N/A";

      try {
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          firstName = userData.firstName || "N/A";
          lastName = userData.lastName || "N/A";
        }
      } catch (fetchErr) {
        console.error("⚠️ [LOGGING] Failed to fetch user data:", fetchErr);
      }

      // Format time in GMT+8
      const formatTimeGMT8 = (isoString) => {
        if (!isoString) return "N/A";
        const date = new Date(isoString);
        // GMT+8 offset (8 hours * 60 minutes * 60 seconds * 1000 milliseconds)
        const gmt8Date = new Date(date.getTime() + 8 * 60 * 60 * 1000);
        return gmt8Date.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
          timeZone: "UTC", // Already adjusted to GMT+8
        });
      };

      // Build log record with all required fields
      const logRecord = {
        action: payload.action || "Unknown action",
        description: payload.description || "",
        userId: user.uid,
        userName: user.email || user.displayName || "Unknown",
        firstName,
        lastName,
        timestamp: new Date().toISOString(),

        // Optional fields (include if provided)
        ...(payload.feedId !== undefined && { feedId: payload.feedId }),
        ...(payload.waterId !== undefined && { waterId: payload.waterId }),
        ...(payload.newTime && { newTime: payload.newTime }),
        ...(payload.oldTime && { oldTime: payload.oldTime }),
        ...(payload.selectedTime && {
          selectedTime: payload.selectedTime,
          selectedTimeGMT8: formatTimeGMT8(payload.selectedTime),
        }),
        ...(payload.duration && { duration: payload.duration }),
        ...(payload.status && { status: payload.status }),
        ...(payload.nightModeEnabled !== undefined && {
          nightModeEnabled: payload.nightModeEnabled,
        }),
      };

      // Save to Firestore: activity_logs/{actionType}/{auto-generated-id}
      await addDoc(
        collection(db, "activity_logs", actionType, "logs"),
        logRecord,
      );

      console.log(`✅ [LOGGING] Logged to ${actionType}:`, logRecord);
    } catch (error) {
      console.error(`❌ [LOGGING] Failed to log ${actionType}:`, error);
      // Don't throw - logging failures shouldn't break the app
    }
  };

  // Prevent duplicate submissions
  const [isSubmitting, setIsSubmitting] = useState(false);

  // side menu
  const [menuOpen, setMenuOpen] = useState(false);

  // realtime sensor data
  const [waterNow, setWaterNow] = useState(0);
  const [feederNow, setFeederNow] = useState(0);
  const [sensorLoading, setSensorLoading] = useState(true);
  const [sensorError, setSensorError] = useState(null);
  const [isSimulated, setIsSimulated] = useState(true);

  // NEW STATE VARIABLES
  const [temperature, setTemperature] = useState(0);
  const [humidity, setHumidity] = useState(0);
  const [airQuality, setAirQuality] = useState(0);
  const [bowlWeight, setBowlWeight] = useState(0);
  const [fanOn, setFanOn] = useState(false);
  const [vitaminOn, setVitaminOn] = useState(false);
  const [waterStorageLevel, setWaterStorageLevel] = useState(0);
  const [feedStorageLevel, setFeedStorageLevel] = useState(0);

  // Lighting control
  const [lightOn, setLightOn] = useState(false);

  // night schedule (time)
  const [nightStart, setNightStart] = useState(new Date());
  const [showNightPicker, setShowNightPicker] = useState(false);
  const [sunsetLoading, setSunsetLoading] = useState(true);
  const [sunsetError, setSunsetError] = useState(null);
  const [isSunsetAutomated, setIsSunsetAutomated] = useState(false);

  // feed schedule: can add / delete / edit
  const [feeds, setFeeds] = useState([]);
  const [feedEdit, setFeedEdit] = useState({
    open: false,
    idx: null,
    timeDate: new Date(),
  });

  // delete mode / selection
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedToDelete, setSelectedToDelete] = useState([]);

  // Initialize sensors and start polling on mount
  useEffect(() => {
    let stopPolling = null;

    const initSensors = async () => {
      try {
        setSensorLoading(true);
        setSensorError(null);

        // Initialize sensors
        const initResult = await initializeSensors();
        console.log("Sensor initialization:");

        // Configure ESP32 with user ID for scheduled watering
        const user = auth.currentUser;
        if (user) {
          console.log(
            "📡 Configuring ESP32 with user ID for scheduled watering...",
          );
          await configureWaterSystemUserId(user.uid);
        }

        // Get initial readings
        const readings = await getAllSensorReadings();
        updateSensorValues(readings);

        // Start polling for continuous updates (every 5 seconds)
        stopPolling = startSensorPolling((readings) => {
          updateSensorValues(readings);
        }, 5000);
      } catch (error) {
        console.error("Sensor initialization error:", error);
        setSensorError("Failed to initialize sensors.");
        setIsSimulated(true);
        // Set default values on error
        setWaterNow(0);
        setFeederNow(0);
      } finally {
        setSensorLoading(false);
      }
    };

    initSensors();

    // Start solar power polling (every 10 seconds)
    const solarPollInterval = setInterval(async () => {
      try {
        // TODO: Replace with actual ESP32 IP:port from your setup
        const ESP32_URL = "http://192.168.1.100:8080"; // Update with your ESP32 IP
        const response = await fetch(`${ESP32_URL}/solar/level`, {
          method: "GET",
          timeout: 5000,
        });

        if (response.ok) {
          const data = await response.json();
          const powerLevel = Math.min(100, Math.max(0, data.level || 62));
          setSolarPowerLevel(powerLevel);
          setIsSolarSimulated(false);
          console.log("[Solar] Real-time power update:", powerLevel + "%");

          // Check threshold and send alerts if needed
          checkPowerThreshold(powerLevel);
        } else {
          throw new Error("ESP32 responded with error");
        }
      } catch (error) {
        console.warn("[Solar] Failed to fetch from ESP32.", error.message);
        setSolarPowerLevel(30); // Fallback to simulated
        setIsSolarSimulated(true);
      } finally {
        setSolarPowerLoading(false);
      }
    }, 10000);

    // Cleanup polling on unmount
    return () => {
      if (stopPolling) {
        stopPolling();
      }
      clearInterval(solarPollInterval);
    };
  }, []);

  // Fetch sunset time and night time schedule on mount
  useEffect(() => {
    const loadNightTimeSchedule = async () => {
      try {
        setSunsetLoading(true);
        setSunsetError(null);

        console.log(
          "[NightTime] Automating night time schedule with sunset API...",
        );

        // Fetch sunset time from SunriseSunset.io API
        console.log(
          "[NightTime] Fetching sunset time from SunriseSunset.io...",
        );
        const sunsetResult = await fetchSunsetTime();

        if (sunsetResult.success) {
          console.log(
            "[NightTime] Sunset time fetched successfully:",
            sunsetResult.formattedDateTime,
          );
          setNightStart(sunsetResult.sunsetTime);
          setIsSunsetAutomated(true);

          // Update Firestore with the sunset time
          try {
            const docRef = doc(db, "nightTime", "1");
            await setDoc(
              docRef,
              {
                nightTime: sunsetResult.sunsetTimeIso,
                time: sunsetResult.sunsetTimeIso,
                selectedTimeGMT8Formatted: sunsetResult.formattedDateTime,
                automatedViaSunset: true,
                sunsetFetchedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
              { merge: true },
            );
            console.log("[NightTime] Firestore updated with sunset time");
          } catch (firestoreError) {
            console.warn(
              "[NightTime] Failed to update Firestore with sunset time:",
              firestoreError,
            );
            // Don't fail - just log the warning
          }
        } else {
          // Sunset API failed - fall back to stored Firestore data
          console.warn(
            "[NightTime] Failed to fetch sunset time:",
            sunsetResult.error,
          );
          setSunsetError(sunsetResult.error);
          setIsSunsetAutomated(false);

          console.log(
            "[NightTime] Falling back to stored night time schedule...",
          );
          const nightTimeData = await fetchNightTimeSchedule();

          if (nightTimeData) {
            // Get the time value - try multiple field names for compatibility
            const timeValue = nightTimeData.nightTime || nightTimeData.time;

            if (timeValue) {
              // Convert ISO string or timestamp to Date object
              const timeDate =
                timeValue instanceof Date ? timeValue : new Date(timeValue);

              setNightStart(timeDate);
              console.log(
                "[NightTime] Night time loaded from Firestore:",
                fmtTime(timeDate),
              );
            } else {
              console.warn("[NightTime] No time value found in document");
            }
          } else {
            console.warn(
              "[NightTime] Night time document not found, using default time",
            );
          }
        }
      } catch (error) {
        console.error("[NightTime] Error loading night time schedule:", error);
        setSunsetError(error.message || "Unknown error occurred");
        // Keep default time on error
      } finally {
        setSunsetLoading(false);
      }
    };

    loadNightTimeSchedule();
  }, []);

  // UPDATED: Update sensor values from readings with new fields
  const updateSensorValues = useCallback((readings) => {
    if (readings) {
      // Map new fields from ESP32 response

      // Temperature from DHT22
      if (readings.temperature !== undefined) {
        setTemperature(readings.temperature || 0);
      }

      // Humidity from DHT22
      if (readings.humidity !== undefined) {
        setHumidity(readings.humidity || 0);
      }

      // Air Quality from MQ135
      if (readings.air_quality !== undefined) {
        setAirQuality(readings.air_quality || 0);
      }

      // Bowl Weight from Load Cell (HX711) - Feeder Mass
      if (readings.feed_weight !== undefined) {
        setBowlWeight(readings.feed_weight || 0);
      }

      // Water Level from Analog Sensor (Drinker)
      if (readings.water_level !== undefined) {
        setWaterNow(readings.water_level || 0);
      }

      // Feeder Storage from Ultrasonic 1 (Tank level)
      if (readings.feeder_tank_level !== undefined) {
        const feedStorageVal = readings.feeder_tank_level;
        console.log(`[Storage] Feed storage level: ${feedStorageVal}%`);
        setFeederNow(feedStorageVal);
        setFeedStorageLevel(feedStorageVal);
      } else if (readings.feeder && readings.feeder.level !== undefined) {
        const feedStorageVal = readings.feeder.level;
        console.log(
          `[Storage] Feed storage level (legacy): ${feedStorageVal}%`,
        );
        setFeederNow(feedStorageVal);
        setFeedStorageLevel(feedStorageVal);
      }

      // Water Storage from Ultrasonic 2 (Tank level)
      if (readings.water_tank_level !== undefined) {
        const waterStorageVal = readings.water_tank_level;
        console.log(`[Storage] Water storage level: ${waterStorageVal}%`);
        setWaterStorageLevel(waterStorageVal);
      }

      // Fan Status sync
      if (readings.fan_status !== undefined) {
        setFanOn(readings.fan_status === "on");
      }

      // Vitamin system sync
      if (readings.vitamin_system_enabled !== undefined) {
        setVitaminOn(readings.vitamin_system_enabled === true);
      }

      // Light Status sync
      if (readings.light_status !== undefined) {
        setLightOn(readings.light_status === "on");
      }

      // Legacy support for old structure
      if (readings.water && readings.water.level !== undefined) {
        // Only use this if water_level is not provided
        if (readings.water_level === undefined) {
          setWaterNow(readings.water.level || 0);
        }
        if (readings.water.isSimulated) {
          setIsSimulated(true);
        }
        if (readings.water.error || readings.water.warning) {
          setSensorError(readings.water.error || readings.water.warning);
        }
      }

      // Check simulation mode
      if (readings.simulationMode !== undefined) {
        setIsSimulated(readings.simulationMode);
      }
    }
  }, []);

  // Load feeds and watering schedule from Firestore on mount
  useEffect(() => {
    loadFeedsFromFirestore();
    loadWateringScheduleFromFirestore();
  }, []);

  const loadFeedsFromFirestore = async () => {
    try {
      console.log("[FetchFeeds] Fetching all feeds from Firestore...");
      const feedsSnapshot = await getDocs(collection(db, "feeds"));
      const loadedFeeds = [];
      const seenIds = new Set();

      feedsSnapshot.forEach((doc) => {
        const data = doc.data();

        // Skip duplicates based on feedId (regardless of creator)
        if (seenIds.has(data.feedId)) {
          console.warn(`Duplicate feedId ${data.feedId} found, skipping`);
          return;
        }
        seenIds.add(data.feedId);

        // Get the time - could be ISO string or formatted string
        const rawTime = data.time || data.timestamp;

        // Convert to GMT+8 if it's an ISO timestamp
        let timeGMT8 = rawTime;
        if (rawTime && (rawTime.includes("T") || rawTime instanceof Date)) {
          // It's an ISO string or Date - convert to GMT+8 formatted time
          timeGMT8 = formatTimeGMT8(rawTime);
        }

        loadedFeeds.push({
          id: data.feedId,
          label: data.label,
          time: timeGMT8,
        });
      });

      // Sort by time in ascending order
      loadedFeeds.sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));

      setFeeds(loadedFeeds);

      // console.log("[FetchFeeds] Total feeds fetched:", loadedFeeds.length);
      // console.log(
      //   "📋 [SORT] Feeds loaded and sorted in ascending order (GMT+8):",
      // );
      // loadedFeeds.forEach((f) => {
      //   console.log(
      //     `  - ${f.time} (${f.label}) = ${timeToMinutes(f.time)} minutes`,
      //   );
      // });
    } catch (err) {
      console.error("Failed to load feeds:", err);
    }
  };

  const loadWateringScheduleFromFirestore = async () => {
    try {
      // Fetch ALL watering schedules from "wateringSchedules" collection (no userId filter)
      const wateringSnapshot = await getDocs(
        collection(db, "wateringSchedules"),
      );

      const loadedWaterings = [];
      const seenIds = new Set();

      wateringSnapshot.forEach((doc) => {
        const data = doc.data();
        // Skip duplicates based on wateringId
        if (seenIds.has(data.wateringId)) {
          console.warn(
            `Duplicate wateringId ${data.wateringId} found, skipping`,
          );
          return;
        }
        seenIds.add(data.wateringId);

        // Convert time to GMT+8 format
        let timeGMT8 = data.time; // Default to stored time
        if (data.selectedTimeGMT8Formatted) {
          timeGMT8 = data.selectedTimeGMT8Formatted;
        }

        loadedWaterings.push({
          id: data.wateringId,
          label: data.label,
          time: timeGMT8,
        });
      });

      // Sort by time in ascending order (earliest to latest)
      loadedWaterings.sort(
        (a, b) => timeToMinutes(a.time) - timeToMinutes(b.time),
      );
      setWaterings(loadedWaterings);
      // console.log(
      //   `💧 [LOAD] Watering schedules loaded from database: ${loadedWaterings.length} total`,
      // );
      // console.log("💧 [SORT] Watering schedules sorted:");
      // loadedWaterings.forEach((w) => {
      //   console.log(
      //     `  - ${w.time} (${w.label}) = ${timeToMinutes(w.time)} minutes`,
      //   );
      // });
    } catch (err) {
      console.error("Failed to load watering schedules:", err);
    }
  };

  // confirm modals
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);
  const [confirmSaveVisible, setConfirmSaveVisible] = useState(false);
  // edit and delete confirmation modals
  const [confirmEditVisible, setConfirmEditVisible] = useState(false);
  const [confirmDeleteFeedVisible, setConfirmDeleteFeedVisible] =
    useState(false);
  const [pendingDeleteFeedId, setPendingDeleteFeedId] = useState(null);
  // night time save confirmation
  const [confirmNightSaveVisible, setConfirmNightSaveVisible] = useState(false);
  const [pendingNightTime, setPendingNightTime] = useState(null);
  // morning warning before confirmation
  const [warnMorningVisible, setWarnMorningVisible] = useState(false);

  // feed add time picker flow
  const [pendingFeedTime, setPendingFeedTime] = useState(null);
  const [confirmFeedSaveVisible, setConfirmFeedSaveVisible] = useState(false);
  const [showFeedAddPicker, setShowFeedAddPicker] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);

  // watering schedule: mirror feeding schedule
  const [waterings, setWaterings] = useState([]);
  const [waterEdit, setWaterEdit] = useState({
    open: false,
    idx: null,
    timeDate: new Date(),
  });
  const [showWaterAddPicker, setShowWaterAddPicker] = useState(false);
  const [pendingWaterTime, setPendingWaterTime] = useState(null);
  const [confirmWaterAddVisible, setConfirmWaterAddVisible] = useState(false);
  const [showDuplicateWaterModal, setShowDuplicateWaterModal] = useState(false);
  const [confirmDeleteWaterVisible, setConfirmDeleteWaterVisible] =
    useState(false);
  const [pendingDeleteWaterId, setPendingDeleteWaterId] = useState(null);
  const [showWaterTimePicker, setShowWaterTimePicker] = useState(false);

  // popups
  const [showSavedPopup, setShowSavedPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState("Saved Successfully!");

  // camera placeholder modal
  const [cameraModal, setCameraModal] = useState(false);

  // Camera server auto-discovery - no user input needed!
  const [cameraServerUrl, setCameraServerUrl] = useState(
    "http://rpi5desktop.local:5000",
  );
  const [showServerInput, setShowServerInput] = useState(false);

  // Callback when camera server is auto-discovered
  const handleServerDiscovered = (discoveredUrl) => {
    console.log("📡 Auto-discovered camera server:", discoveredUrl);
    setCameraServerUrl(discoveredUrl);
    // Don't show settings - it worked automatically!
  };

  // power schedule - real-time solar monitoring
  const [solarPowerLevel, setSolarPowerLevel] = useState(62);
  const [solarPowerLoading, setSolarPowerLoading] = useState(true);
  const [alertThreshold, setAlertThreshold] = useState(30);
  const [autoPower, setAutoPower] = useState(false);
  const [lastAlertTime, setLastAlertTime] = useState(null);
  const [isSolarSimulated, setIsSolarSimulated] = useState(true);

  // bottom active
  const [activeTab, setActiveTab] = useState("Control");

  // timepicker state for feed edit
  const [showFeedTimePicker, setShowFeedTimePicker] = useState(false);

  // Swipe gesture handler - swipe right to go to Home, swipe left to go to Analytics
  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Only respond to horizontal swipes (not vertical scrolling)
        return (
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) &&
          Math.abs(gestureState.dx) > 20
        );
      },
      onPanResponderRelease: (evt, gestureState) => {
        // Swipe right (positive dx) to go back to Home (slide left to right)
        if (gestureState.dx > 50) {
          navigation.goBack();
        }
        // Swipe left (negative dx) to go to Analytics (if you have it)
        // if (gestureState.dx < -50) {
        //   navigation.navigate("Analytics");
        // }
      },
    }),
  ).current;

  // Handlers
  const addFeedSchedule = () => {
    console.log("📄 [ACTION] User clicked Add Feed Schedule button");
    // Open time picker for user to select feeding time
    setShowFeedAddPicker(true);
  };

  // Handle light toggle with ESP32 control
  const handleLightToggle = async (newValue) => {
    console.log(`[Light] Toggle requested: ${newValue ? "ON" : "OFF"}`);
    setLightOn(newValue); // Optimistic update

    try {
      const { getWaterSystemUrl } = await import("../../../config/esp32config");
      const url = getWaterSystemUrl();

      if (!url) {
        throw new Error("ESP32 not configured. Check esp32config.js");
      }

      const endpoint = newValue ? "/api/light/on" : "/api/light/off";
      const fullUrl = `${url}${endpoint}`;

      console.log(`[Light] Sending request to: ${fullUrl}`);

      const response = await fetch(fullUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`[Light] Response:`, data);
      console.log(`[Light] Successfully turned ${newValue ? "ON" : "OFF"}`);

      // Update state from server response
      if (data.light_status !== undefined) {
        setLightOn(data.light_status === "on");
      } else if (data.status !== undefined) {
        setLightOn(data.status === "on");
      }

      // Log activity
      await logActivity("lightControl_logs", {
        action: newValue ? "light_started" : "light_stopped",
        status: newValue ? "on" : "off",
        timestamp: new Date().toISOString(),
      });

      // Sync with Firestore
      try {
        const sensorsRef = doc(db, "sensors", "current");
        await updateDoc(sensorsRef, { lightStatus: newValue ? "On" : "Off" });
      } catch (firestoreError) {
        console.warn("[Light] Firestore sync failed:", firestoreError.message);
      }
    } catch (error) {
      console.error("[Light] Control failed:", error.message);
      setLightOn(!newValue); // Revert on fail
      Alert.alert(
        "Light Control Error",
        `Could not reach light controller.\n\nError: ${error.message}\n\nPlease check:\n1. ESP32 is powered on\n2. WiFi connection\n3. IP address in esp32config.js`,
      );
    }
  };

  // NEW: Handle Fan Toggle
  const handleFanToggle = async (value) => {
    console.log(`[Fan] Toggle requested: ${value ? "ON" : "OFF"}`);
    setFanOn(value); // Optimistic update

    try {
      const { getWaterSystemUrl } = await import("../../../config/esp32config");
      const url = getWaterSystemUrl();

      if (!url) {
        throw new Error("ESP32 not configured. Check esp32config.js");
      }

      const endpoint = value ? "/api/fan/start" : "/api/fan/stop";
      const fullUrl = `${url}${endpoint}`;

      console.log(`[Fan] Sending request to: ${fullUrl}`);

      const response = await fetch(fullUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`[Fan] Response:`, data);
      console.log(`[Fan] Successfully turned ${value ? "ON" : "OFF"}`);

      // Update state from server response
      if (data.fan_status !== undefined) {
        setFanOn(data.fan_status === "on");
      }

      // Log activity
      await logActivity("fanControl_logs", {
        action: value ? "fan_started" : "fan_stopped",
        status: value ? "on" : "off",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("[Fan] Control failed:", error.message);
      setFanOn(!value); // Revert on fail
      Alert.alert(
        "Fan Control Error",
        `Could not reach fan controller.\n\nError: ${error.message}\n\nPlease check:\n1. ESP32 is powered on\n2. WiFi connection\n3. IP address in esp32config.js`,
      );
    }
  };

  // Handle Vitamin System Toggle (ON = peristaltic pump dispenses at schedule; OFF = water pump dispenses)
  const handleVitaminToggle = async (value) => {
    console.log(`[Vitamin] Toggle requested: ${value ? "ON" : "OFF"}`);
    setVitaminOn(value); // Optimistic update

    try {
      const { getWaterSystemUrl } = await import("../../../config/esp32config");
      const url = getWaterSystemUrl();

      if (!url) {
        throw new Error("ESP32 not configured. Check esp32config.js");
      }

      const endpoint = value ? "/api/vitamin/enable" : "/api/vitamin/disable";
      const fullUrl = `${url}${endpoint}`;

      console.log(`[Vitamin] Sending request to: ${fullUrl}`);

      const response = await fetch(fullUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`[Vitamin] Response:`, data);

      if (data.vitamin_system_enabled !== undefined) {
        setVitaminOn(data.vitamin_system_enabled);
      }

      await logActivity("vitaminControl_logs", {
        action: value ? "vitamin_system_enabled" : "vitamin_system_disabled",
        status: value ? "on" : "off",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("[Vitamin] Control failed:", error.message);
      setVitaminOn(!value); // Revert on fail
      Alert.alert(
        "Vitamin System Error",
        `Could not reach vitamin pump controller.\n\nError: ${error.message}\n\nPlease check:\n1. ESP32 is powered on\n2. WiFi connection\n3. IP address in esp32config.js`,
      );
    }
  };

  // Handle Test Vitamin Pump
  const handleTestVitaminPump = async () => {
    try {
      setIsVitaminPumpTesting(true);
      console.log("💊 Testing vitamin pump...");

      const { getWaterSystemUrl } = await import("../../../config/esp32config");
      const esp32Url = getWaterSystemUrl();

      if (!esp32Url) {
        showMotorWarning(
          "Configuration Error",
          "ESP32 water system URL not configured. Please check esp32config.js",
        );
        return;
      }

      const response = await fetch(`${esp32Url}/api/vitamin/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ duration: 5000 }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log("✅ Vitamin pump test successful:", data);

        await logActivity("vitaminPumpTest_logs", {
          action: "Test vitamin pump",
          description: "User tested vitamin peristaltic pump via ESP32",
          status: "Completed",
          duration: 5000,
        });

        const currentUser = auth.currentUser;
        const userName = currentUser?.email || "User";
        addNotification({
          category: "User Activity",
          title: "Vitamin pump tested",
          description: `${userName} tested vitamin pump at ${new Date().toLocaleString()}`,
          type: "testing",
        });
      } else {
        const errorText = await response.text();
        console.error(
          "❌ Vitamin pump test failed:",
          response.status,
          errorText,
        );
        showMotorWarning(
          "Vitamin Pump Test Failed",
          `ESP32 returned error: ${response.status}\n${errorText}`,
        );
      }
    } catch (error) {
      console.error("❌ Vitamin pump test error:", error);
      showMotorWarning(
        "Connection Error",
        `Failed to connect to ESP32: ${error.message}\n\nPlease check if ESP32 is powered on and connected to the network.`,
      );
    } finally {
      setIsVitaminPumpTesting(false);
    }
  };

  // Check solar power threshold and send alerts if needed
  const checkPowerThreshold = (powerLevel) => {
    if (
      powerLevel <= alertThreshold &&
      (!lastAlertTime || now - lastAlertTime > thirtyMinInMs)
    ) {
      // Send user notification
      if (addUserNotification) {
        addUserNotification({
          type: "warning",
          title: "⚠️ Low Solar Power Alert",
          message: `Solar power is at ${powerLevel}% (threshold: ${alertThreshold}%)`,
          duration: 5000,
        });
      }

      // Send admin notification
      if (addNotification) {
        addNotification({
          type: "warning",
          title: "⚠️ Low Solar Power Detected",
          message: `System solar power dropped to ${powerLevel}% (threshold: ${alertThreshold}%)`,
          userId: currentUser?.uid,
        });
      }

      // Log to activity logs
      logActivity("powerAlert_logs", {
        powerLevel,
        threshold: alertThreshold,
        timestamp: new Date().toISOString(),
        userId: currentUser?.uid,
      });

      setLastAlertTime(now);
      console.log(
        "[Solar] Alert sent - Power:",
        powerLevel + "%",
        "Threshold:",
        alertThreshold + "%",
      );
    }
  };

  // Handle threshold slider change (reset cooldown)
  const handleThresholdChange = (newValue) => {
    setAlertThreshold(newValue);
    setLastAlertTime(null); // Reset cooldown when user adjusts threshold
    console.log("[Solar] Threshold changed to:", newValue + "%");
  };

  // Convert time string "hh:mm AM/PM" or "hh:mmAM/PM" to minutes since midnight for sorting
  const timeToMinutes = (timeStr) => {
    if (!timeStr) return 0;

    // Handle both "10:00 AM" and "10:00AM" formats
    // Remove any spaces and extract components
    const trimmed = timeStr.trim();
    const match = trimmed.match(/(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)/i);

    if (!match) {
      console.warn("⚠️ Invalid time format:", timeStr);
      return 0;
    }

    let hour = parseInt(match[1], 10);
    const minute = parseInt(match[2], 10);
    const ampm = match[3].toUpperCase();

    // Convert to 24-hour format
    if (ampm === "PM" && hour !== 12) hour += 12;
    if (ampm === "AM" && hour === 12) hour = 0;

    return hour * 60 + minute;
  };

  const confirmAddFeed = async () => {
    console.log("📄 [ACTION] Confirming feed schedule add");

    // Prevent duplicate submissions
    if (isSubmitting) {
      console.warn("Submit already in progress, ignoring duplicate click");
      return;
    }

    if (!pendingFeedTime) {
      console.log("⚠️  [DEBUG] No pendingFeedTime, aborting");
      setConfirmFeedSaveVisible(false);
      setShowFeedAddPicker(false);
      return;
    }

    setIsSubmitting(true);
    console.log("✅ [DEBUG] Proceeding with feed add...");
    const formattedTime = pendingFeedTime.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    // Check for duplicate time
    const isDuplicate = feeds.some((f) => f.time === formattedTime);
    if (isDuplicate) {
      setConfirmFeedSaveVisible(false);
      setShowFeedAddPicker(false);
      setPendingFeedTime(null);
      setShowDuplicateModal(true);
      return;
    }

    const nextId = feeds.length ? Math.max(...feeds.map((f) => f.id)) + 1 : 1;
    const label = `Schedule ${nextId}`;
    const newFeed = { id: nextId, label, time: formattedTime };

    try {
      const user = auth.currentUser;
      if (user) {
        // Fetch firstName and lastName from users collection
        let firstName = "N/A";
        let lastName = "N/A";

        try {
          const userDocRef = doc(db, "users", user.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            firstName = userData.firstName || "N/A";
            lastName = userData.lastName || "N/A";
          }
        } catch (fetchErr) {
          console.error("Failed to fetch user data:", fetchErr);
          // firstName and lastName will remain "N/A"
        }

        // Persist to Firestore feeds collection
        await setDoc(doc(db, "feeds", `${nextId}`), {
          feedId: nextId,
          label: label,
          time: formattedTime,
          userId: user.uid, // Required by ESP32 for filtering
          duration: 5, // Duration in seconds (5s default)
          timestamp: new Date().toISOString(),
        });

        // Log activity to Firestore
        await addDoc(
          collection(db, "activity_logs", "feeding", "addFeedSchedule_logs"),
          {
            action: `New feeding schedule: ${formattedTime}`,
            description: `Added ${formattedTime}`,
            firstName,
            lastName,
            newTime: formattedTime,
            selectedTime: pendingFeedTime.toISOString(),
            selectedTimeGMT8: formattedTime,
            timestamp: new Date().toISOString(),
            userId: user.uid,
            feedId: nextId,
          },
        );

        // Add user notification
        addUserNotification({
          category: "IoT: Internet of Tsiken",
          title: "Feeding schedule added",
          description: `New feeding schedule created for ${formattedTime}`,
        });

        // Add admin notification
        addNotification({
          category: "Schedule Management",
          title: "Feeding schedule added",
          description: `${user.displayName || user.email} added feeding schedule at ${formattedTime}`,
          type: "schedule",
        });
      }
    } catch (err) {
      Alert.alert("Error", "Failed to save feed: " + err.message);
      setConfirmFeedSaveVisible(false);
      setShowFeedAddPicker(false);
      setPendingFeedTime(null);
      setIsSubmitting(false);
      return;
    }

    // Add and sort by time
    setFeeds((s) => {
      const updated = [...s, newFeed];
      const sorted = updated.sort(
        (a, b) => timeToMinutes(a.time) - timeToMinutes(b.time),
      );
      console.log("📋 [SORT] Feeds after adding new schedule:");
      sorted.forEach((f) => {
        console.log(
          `  - ${f.time} (${f.label}) = ${timeToMinutes(f.time)} minutes`,
        );
      });
      return sorted;
    });

    // Close all related modals
    setConfirmFeedSaveVisible(false);
    setShowFeedAddPicker(false);
    setPendingFeedTime(null);
    setIsSubmitting(false);
    setPopupMessage("Saved Successfully!");
    setShowSavedPopup(true);
    setTimeout(() => setShowSavedPopup(false), 1400);
  };

  const beginDeleteFlow = () => {
    // Show options: Delete All or Choose
    Alert.alert(
      "Delete schedules",
      "Choose delete option",
      [
        {
          text: "Delete All",
          style: "destructive",
          onPress: () => setConfirmDeleteVisible(true),
        },
        {
          text: "Choose",
          onPress: () => {
            setDeleteMode(true);
            setSelectedToDelete([]);
          },
        },
        { text: "Cancel", style: "cancel" },
      ],
      { cancelable: true },
    );
  };

  const confirmDeleteAll = async () => {
    console.log("📄 [ACTION] Confirming delete all feeds");

    // Prevent duplicate submissions
    if (isSubmitting) {
      console.warn("Submit already in progress, ignoring duplicate click");
      return;
    }

    setIsSubmitting(true);

    try {
      const user = auth.currentUser;
      if (user) {
        // Delete all feed documents from Firestore for this user
        const deletePromises = feeds.map((feed) =>
          deleteDoc(doc(db, "feeds", `${user.uid}_${feed.id}`)),
        );
        await Promise.all(deletePromises);

        console.log(
          `✅ Deleted ${feeds.length} feeding schedules from Firestore`,
        );

        // Add user notification
        addUserNotification({
          category: "IoT: Internet of Tsiken",
          title: "All feeding schedules deleted",
          description: `Removed all ${feeds.length} feeding schedules`,
        });

        // Add admin notification
        addNotification({
          category: "Schedule Management",
          title: "All feeding schedules deleted",
          description: `${user.displayName || user.email} deleted all ${feeds.length} feeding schedules`,
          type: "schedule",
        });
      }
    } catch (err) {
      console.error("Failed to delete all feeds:", err);
      Alert.alert("Error", "Failed to delete all schedules: " + err.message);
      setIsSubmitting(false);
      return;
    }

    // Update local state
    setFeeds([]);
    setDeleteMode(false);
    setSelectedToDelete([]);
    setConfirmDeleteVisible(false);
    setIsSubmitting(false);

    // Show success popup
    setPopupMessage("Deleted Successfully!");
    setShowSavedPopup(true);
    setTimeout(() => setShowSavedPopup(false), 1200);
  };

  const toggleSelectToDelete = (id) => {
    setSelectedToDelete((s) => {
      if (s.includes(id)) return s.filter((x) => x !== id);
      return [...s, id];
    });
  };

  const deleteSelected = () => {
    if (selectedToDelete.length === 0) {
      Alert.alert(
        "No selection",
        "Please select at least one schedule to delete.",
      );
      return;
    }
    // confirmation
    Alert.alert(
      "Delete selected",
      "Are you sure you want to delete selected schedules?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            console.log(
              "📄 [ACTION] Deleting selected feeds:",
              selectedToDelete,
            );

            // Prevent duplicate submissions
            if (isSubmitting) {
              console.warn(
                "Submit already in progress, ignoring duplicate click",
              );
              return;
            }

            setIsSubmitting(true);

            try {
              const user = auth.currentUser;
              if (user) {
                // Delete selected feed documents from Firestore
                const deletePromises = selectedToDelete.map((feedId) =>
                  deleteDoc(doc(db, "feeds", `${user.uid}_${feedId}`)),
                );
                await Promise.all(deletePromises);

                console.log(
                  `✅ Deleted ${selectedToDelete.length} selected feeding schedules`,
                );

                // Get deleted feed times for notification
                const deletedFeeds = feeds.filter((f) =>
                  selectedToDelete.includes(f.id),
                );
                const deletedTimes = deletedFeeds.map((f) => f.time).join(", ");

                // Add user notification
                addUserNotification({
                  category: "IoT: Internet of Tsiken",
                  title: "Feeding schedules deleted",
                  description: `Removed ${selectedToDelete.length} feeding schedule(s)`,
                });

                // Add admin notification
                addNotification({
                  category: "Schedule Management",
                  title: "Feeding schedules deleted",
                  description: `${user.displayName || user.email} deleted ${selectedToDelete.length} feeding schedule(s): ${deletedTimes}`,
                  type: "schedule",
                });
              }
            } catch (err) {
              console.error("Failed to delete selected feeds:", err);
              Alert.alert(
                "Error",
                "Failed to delete selected schedules: " + err.message,
              );
              setIsSubmitting(false);
              return;
            }

            // Update local state
            setFeeds((s) => s.filter((f) => !selectedToDelete.includes(f.id)));
            setDeleteMode(false);
            setSelectedToDelete([]);
            setIsSubmitting(false);

            // Show success popup
            setPopupMessage("Deleted Successfully!");
            setShowSavedPopup(true);
            setTimeout(() => setShowSavedPopup(false), 1200);
          },
        },
      ],
      { cancelable: true },
    );
  };

  const beginSaveFlow = () => {
    // show confirmation modal
    setConfirmSaveVisible(true);
  };

  const confirmSaveAll = () => {
    // In real app, call API to save feeds
    setConfirmSaveVisible(false);
    setShowSavedPopup(true);
    setTimeout(() => setShowSavedPopup(false), 1400);
  };

  const openEditFeed = (idx) => {
    console.log("📄 [ACTION] User clicked edit feed button for index:", idx);
    // open edit modal with Date object based on existing time string if possible
    const f = feeds[idx];
    // try parse time string "hh:mm AM/PM" into Date
    let timeDate = new Date();
    try {
      const parts = f.time.split(/[: ]/); // ["06","00","AM"]
      if (parts.length >= 3) {
        const hour = parseInt(parts[0], 10);
        const minute = parseInt(parts[1], 10);
        const ampm = parts[2];
        let hr = hour % 12;
        if (ampm.toUpperCase() === "PM") hr += 12;
        timeDate.setHours(hr, minute, 0, 0);
      }
    } catch (e) {
      timeDate = new Date();
    }
    setFeedEdit({ open: true, idx, timeDate });
  };

  const saveFeedEdit = async () => {
    console.log("📄 [ACTION] Saving feed edit");

    // Prevent duplicate submissions
    if (isSubmitting) {
      console.warn("Submit already in progress, ignoring duplicate click");
      return;
    }

    if (feedEdit.idx === null) {
      setConfirmEditVisible(false);
      setFeedEdit({ open: false, idx: null, timeDate: new Date() });
      return;
    }

    setIsSubmitting(true);
    const newTime = feedEdit.timeDate.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    const oldTime = feeds[feedEdit.idx].time;
    const feedId = feeds[feedEdit.idx].id;

    try {
      const user = auth.currentUser;
      if (user) {
        // Fetch firstName and lastName from users collection
        let firstName = "N/A";
        let lastName = "N/A";

        try {
          const userDocRef = doc(db, "users", user.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            firstName = userData.firstName || "N/A";
            lastName = userData.lastName || "N/A";
          }
        } catch (fetchErr) {
          console.error("Failed to fetch user data:", fetchErr);
          // firstName and lastName will remain "N/A"
        }

        // Update Firestore feeds document
        await setDoc(doc(db, "feeds", `${feedId}`), {
          feedId: feedId,
          label: feeds[feedEdit.idx].label,
          time: newTime,
          userId: user.uid, // Required by ESP32
          duration: 5, // Duration in seconds
          timestamp: new Date().toISOString(),
        });

        // Log activity to Firestore
        await addDoc(
          collection(db, "activity_logs", "feeding", "editFeedSchedule_logs"),
          {
            action: `Changed feeding time from ${oldTime} to ${newTime}`,
            description: `Changed from ${oldTime} to ${newTime}`,
            firstName,
            lastName,
            newTime,
            oldTime,
            selectedTime: feedEdit.timeDate.toISOString(),
            selectedTimeGMT8: newTime,
            timestamp: new Date().toISOString(),
            userId: user.uid,
            feedId,
          },
        );

        // Add user notification
        addUserNotification({
          category: "IoT: Internet of Tsiken",
          title: "Feeding schedule updated",
          description: `Schedule changed from ${oldTime} to ${newTime}`,
        });

        // Add admin notification
        addNotification({
          category: "Schedule Management",
          title: "Feeding schedule updated",
          description: `${user.displayName || user.email} changed feeding schedule from ${oldTime} to ${newTime}`,
          type: "schedule",
        });
      }
    } catch (err) {
      Alert.alert("Error", "Failed to update feed: " + err.message);
      setConfirmEditVisible(false);
      setFeedEdit({ open: false, idx: null, timeDate: new Date() });
      setIsSubmitting(false);
      return;
    }

    // Update local state and sort
    setFeeds((s) => {
      const copy = [...s];
      copy[feedEdit.idx].time = newTime;
      const sorted = copy.sort(
        (a, b) => timeToMinutes(a.time) - timeToMinutes(b.time),
      );
      console.log("📋 [SORT] Feeds after editing schedule:");
      sorted.forEach((f) => {
        console.log(
          `  - ${f.time} (${f.label}) = ${timeToMinutes(f.time)} minutes`,
        );
      });
      return sorted;
    });

    // Close all related modals
    setConfirmEditVisible(false);
    setFeedEdit({ open: false, idx: null, timeDate: new Date() });
    setIsSubmitting(false);
    setPopupMessage("Updated Successfully!");
    setShowSavedPopup(true);
    setTimeout(() => setShowSavedPopup(false), 1400);
  };

  const confirmDeleteFeed = async () => {
    console.log("📄 [ACTION] Confirming feed delete");

    // Prevent duplicate submissions
    if (isSubmitting) {
      console.warn("Submit already in progress, ignoring duplicate click");
      return;
    }

    if (!pendingDeleteFeedId) {
      setConfirmDeleteFeedVisible(false);
      setPendingDeleteFeedId(null);
      return;
    }

    setIsSubmitting(true);

    const feedToDelete = feeds.find((f) => f.id === pendingDeleteFeedId);
    if (!feedToDelete) {
      setConfirmDeleteFeedVisible(false);
      setPendingDeleteFeedId(null);
      return;
    }

    try {
      const user = auth.currentUser;
      if (user) {
        // Fetch firstName and lastName from users collection
        let firstName = "N/A";
        let lastName = "N/A";

        try {
          const userDocRef = doc(db, "users", user.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            firstName = userData.firstName || "N/A";
            lastName = userData.lastName || "N/A";
          }
        } catch (fetchErr) {
          console.error("Failed to fetch user data:", fetchErr);
          // firstName and lastName will remain "N/A"
        }

        // Delete from Firestore feeds collection
        await deleteDoc(doc(db, "feeds", `${pendingDeleteFeedId}`));

        // Log activity to Firestore
        await addDoc(
          collection(db, "activity_logs", "feeding", "deleteFeedSchedule_logs"),
          {
            action: `Removed ${feedToDelete.time} feeding schedule`,
            description: `${feedToDelete.time} has been removed`,
            firstName,
            lastName,
            scheduleRemoved: feedToDelete.time,
            timestamp: new Date().toISOString(),
            userId: user.uid,
            feedId: pendingDeleteFeedId,
          },
        );

        // Add user notification
        addUserNotification({
          category: "IoT: Internet of Tsiken",
          title: "Feeding schedule deleted",
          description: `Feeding schedule at ${feedToDelete.time} has been removed`,
        });

        // Add admin notification
        addNotification({
          category: "Schedule Management",
          title: "Feeding schedule deleted",
          description: `${user.displayName || user.email} deleted feeding schedule at ${feedToDelete.time}`,
          type: "schedule",
        });
      }
    } catch (err) {
      Alert.alert("Error", "Failed to delete feed: " + err.message);
      // Close modal even on error
      setConfirmDeleteFeedVisible(false);
      setPendingDeleteFeedId(null);
      setIsSubmitting(false);
      return;
    }

    // Update local state
    setFeeds((s) => s.filter((feed) => feed.id !== pendingDeleteFeedId));

    // Close modal and cleanup
    setConfirmDeleteFeedVisible(false);
    setPendingDeleteFeedId(null);
    setIsSubmitting(false);
    setPopupMessage("Deleted Successfully!");
    setShowSavedPopup(true);
    setTimeout(() => setShowSavedPopup(false), 1200);
  };

  // State for manual action operations
  const [isDispensing, setIsDispensing] = useState(false);
  const [isSprinklerActive, setIsSprinklerActive] = useState(false);
  const [isPumpTesting, setIsPumpTesting] = useState(false);
  const [isVitaminPumpTesting, setIsVitaminPumpTesting] = useState(false);
  const [servoError, setServoError] = useState(null);

  // Motor warning modal state
  const [motorWarningModal, setMotorWarningModal] = useState({
    visible: false,
    title: "",
    message: "",
  });

  const showMotorWarning = (title, message) => {
    setMotorWarningModal({ visible: true, title, message });
  };

  const hideMotorWarning = () => {
    setMotorWarningModal({ visible: false, title: "", message: "" });
  };

  const handleDispense = async () => {
    try {
      setIsDispensing(true);
      setServoError(null);
      console.log("🍗 Testing feed dispenser...");

      // Get ESP32 URL from config
      const { getFeedSystemUrl } = await import("../../../config/esp32config");
      const esp32Url = getFeedSystemUrl();

      if (!esp32Url) {
        showMotorWarning(
          "Configuration Error",
          "ESP32 feed system URL not configured. Please check esp32config.js",
        );
        return;
      }

      // Send servo start command directly to ESP32
      const response = await fetch(`${esp32Url}/api/servo/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          angle: 45, // Dispense angle (open position)
          duration: 5000, // 5 seconds dispense
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log("✅ Feed dispense successful:", data);

        // Add admin notification for successful feeding
        const currentUser = auth.currentUser;
        const userName = currentUser?.email || "User";
        addNotification({
          category: "User Activity",
          title: "Feeding completed",
          description: `${userName} manually dispensed feed at ${new Date().toLocaleString()}`,
          type: "feeding",
        });

        // Log manual feeding activity
        await logActivity("feedingActivity_logs", {
          action: "Manual feed dispensed",
          description: "User manually dispensed feed via ESP32",
          status: "Completed",
          angle: 45,
          duration: 5000,
        });
      } else {
        const errorText = await response.text();
        console.error("❌ Feed dispense failed:", response.status, errorText);
        showMotorWarning(
          "Feed Dispense Failed",
          `ESP32 returned error: ${response.status}\n${errorText}`,
        );
      }
    } catch (error) {
      console.error("❌ Feed dispense error:", error);
      showMotorWarning(
        "Connection Error",
        `Failed to connect to ESP32: ${error.message}\n\nPlease check if ESP32 is powered on and connected to the network.`,
      );
    } finally {
      setIsDispensing(false);
    }
  };

  const handleTestPump = async () => {
    try {
      setIsPumpTesting(true);
      console.log("💧 Testing water pump...");

      // Get ESP32 URL from config
      const { getWaterSystemUrl } = await import("../../../config/esp32config");
      const esp32Url = getWaterSystemUrl();

      if (!esp32Url) {
        showMotorWarning(
          "Configuration Error",
          "ESP32 water system URL not configured. Please check esp32config.js",
        );
        return;
      }

      // Send pump start command directly to ESP32
      const response = await fetch(`${esp32Url}/api/pump/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ duration: 5000 }), // 5 seconds test
      });

      if (response.ok) {
        const data = await response.json();
        console.log("✅ Pump test successful:", data);

        // Log activity
        await logActivity("pumpTest_logs", {
          action: "Test water pump",
          description: "User tested water pump via ESP32",
          status: "Completed",
          duration: 5000,
        });

        // Add admin notification
        const currentUser = auth.currentUser;
        const userName = currentUser?.email || "User";
        addNotification({
          category: "User Activity",
          title: "Water pump tested",
          description: `${userName} tested water pump at ${new Date().toLocaleString()}`,
          type: "testing",
        });
      } else {
        const errorText = await response.text();
        console.error("❌ Pump test failed:", response.status, errorText);
        showMotorWarning(
          "Pump Test Failed",
          `ESP32 returned error: ${response.status}\n${errorText}`,
        );
      }
    } catch (error) {
      console.error("❌ Pump test error:", error);
      showMotorWarning(
        "Connection Error",
        `Failed to connect to ESP32: ${error.message}\n\nPlease check if ESP32 is powered on and connected to the network.`,
      );
    } finally {
      setIsPumpTesting(false);
    }
  };

  const handleSprinkler = async () => {
    try {
      setIsSprinklerActive(true);
      setServoError(null);

      const result = await activateSprinkler();

      if (result.success) {
        // Add admin notification for successful watering
        const currentUser = auth.currentUser;
        const userName = currentUser?.email || "User";
        addNotification({
          category: "User Activity",
          title: "Watering completed",
          description: `${userName} manually activated sprinkler at ${new Date().toLocaleString()}`,
          type: "watering",
        });

        // Log manual watering activity
        await logActivity("wateringActivity_logs", {
          action: "Manual sprinkler activated",
          description: "User manually activated sprinkler",
          status: result.isSimulated ? "Simulated" : "Completed",
        });

        // Show warning modal if simulated
        if (result.isSimulated && result.warning) {
          showMotorWarning(
            "Motor Not Detected",
            result.warning + "\n\nThe operation was simulated.",
          );
        }
      } else {
        showMotorWarning(
          "Sprinkler Error",
          result.error || "Failed to activate sprinkler.",
        );
      }
    } catch (error) {
      console.error("Sprinkler error:", error);
      showMotorWarning(
        "Error",
        "Water sprinkler motor not detected. Please check the connection.",
      );
    } finally {
      setIsSprinklerActive(false);
    }
  };

  const handleTestLighting = () => {
    // Simply open the test lighting modal
    setTestLightingModalVisible(true);
  };

  const handleTestLightToggle = async (newValue) => {
    console.log(`[TestLight] Toggle requested: ${newValue ? "ON" : "OFF"}`);
    setTestLightOn(newValue); // Optimistic update

    try {
      // Call ESP32 API
      const endpoint = newValue ? "/api/light/on" : "/api/light/off";
      const fullUrl = `http://${esp32IpAddress}${endpoint}`;

      console.log(`[TestLight] Sending request to: ${fullUrl}`);

      const response = await fetch(fullUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log(`[TestLight] Response:`, data);

      // Sync state from ESP32 response
      if (data.light_status !== undefined) {
        setTestLightOn(data.light_status === "on");
      } else if (data.status !== undefined) {
        setTestLightOn(data.status === "on");
      }

      // Log test lighting activity
      await logActivity("lightingTest_logs", {
        action: `Test lighting turned ${newValue ? "ON" : "OFF"}`,
        description: `User tested lighting via modal`,
        status: "Completed",
        timestamp: new Date().toISOString(),
      });

      console.log(`[TestLight] Successfully turned ${newValue ? "ON" : "OFF"}`);
    } catch (error) {
      console.error("[TestLight] Error:", error);

      // Revert optimistic update on error
      setTestLightOn(!newValue);

      showMotorWarning(
        "Connection Error",
        `Could not connect to ESP32.\n\nError: ${error.message}\n\nPlease check if ESP32 is online at ${esp32IpAddress}`,
      );
    }
  };

  // Watering schedule handlers like feeding
  const addWaterSchedule = () => {
    setShowWaterAddPicker(true);
  };

  const confirmAddWater = async () => {
    // Prevent duplicate submissions
    if (isSubmitting) {
      console.warn("Submit already in progress, ignoring duplicate click");
      return;
    }

    if (!pendingWaterTime) {
      setConfirmWaterAddVisible(false);
      setShowWaterAddPicker(false);
      return;
    }

    setIsSubmitting(true);

    // Convert to GMT+8 format
    const formattedTime = formatTimeGMT8(pendingWaterTime);

    // Double-check for duplicates (in case of race condition)
    const isDuplicate = waterings.some((w) => w.time === formattedTime);
    if (isDuplicate) {
      setConfirmWaterAddVisible(false);
      setShowWaterAddPicker(false);
      setPendingWaterTime(null);
      setShowDuplicateWaterModal(true);
      setIsSubmitting(false);
      return;
    }

    const nextId = waterings.length
      ? Math.max(...waterings.map((w) => w.id)) + 1
      : 1;
    const label = `Schedule ${nextId}`;
    const newWater = { id: nextId, label, time: formattedTime };

    try {
      const user = auth.currentUser;
      if (user) {
        let firstName = "N/A";
        let lastName = "N/A";
        try {
          const userDocRef = doc(db, "users", user.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            firstName = userData.firstName || "N/A";
            lastName = userData.lastName || "N/A";
          }
        } catch (fetchErr) {
          console.error("Failed to fetch user data:", fetchErr);
        }

        await setDoc(doc(db, "wateringSchedules", `${nextId}`), {
          wateringId: nextId,
          label: label,
          time: formattedTime,
          userId: user.uid, // Required by ESP32 for filtering
          duration: 5, // Duration in seconds (5s default)
          timestamp: new Date().toISOString(),
        });

        await addDoc(
          collection(db, "activity_logs", "watering", "addWaterSchedule_logs"),
          {
            action: `New watering schedule: ${formattedTime}`,
            description: `Added ${formattedTime}`,
            firstName,
            lastName,
            newTime: formattedTime,
            selectedTime: pendingWaterTime.toISOString(),
            selectedTimeGMT8: formattedTime,
            timestamp: new Date().toISOString(),
            userId: user.uid,
            waterId: nextId,
          },
        );

        // Add user notification
        addUserNotification({
          category: "IoT: Internet of Tsiken",
          title: "Watering schedule added",
          description: `New watering schedule created for ${formattedTime}`,
        });

        // Add admin notification
        addNotification({
          category: "Schedule Management",
          title: "Watering schedule added",
          description: `${user.displayName || user.email} added watering schedule at ${formattedTime}`,
          type: "schedule",
        });
      }
    } catch (err) {
      Alert.alert("Error", "Failed to save watering: " + err.message);
      setConfirmWaterAddVisible(false);
      setShowWaterAddPicker(false);
      setPendingWaterTime(null);
      setIsSubmitting(false);
      return;
    }

    setWaterings((s) => {
      const updated = [...s, newWater];
      return updated.sort(
        (a, b) => timeToMinutes(a.time) - timeToMinutes(b.time),
      );
    });

    setConfirmWaterAddVisible(false);
    setShowWaterAddPicker(false);
    setPendingWaterTime(null);
    setIsSubmitting(false);
    setPopupMessage("Saved Successfully!");
    setShowSavedPopup(true);
    setTimeout(() => setShowSavedPopup(false), 1400);
  };

  const openEditWater = (idx) => {
    const w = waterings[idx];
    let timeDate = new Date();
    try {
      const parts = w.time.split(/[: ]/);
      if (parts.length >= 3) {
        const hour = parseInt(parts[0], 10);
        const minute = parseInt(parts[1], 10);
        const ampm = parts[2];
        let hr = hour % 12;
        if (ampm.toUpperCase() === "PM") hr += 12;
        timeDate.setHours(hr, minute, 0, 0);
      }
    } catch (e) {
      timeDate = new Date();
    }
    setWaterEdit({ open: true, idx, timeDate });
  };

  const saveWaterEdit = async () => {
    if (waterEdit.idx === null) {
      setConfirmEditVisible(false);
      setWaterEdit({ open: false, idx: null, timeDate: new Date() });
      return;
    }

    // Convert to GMT+8 format
    const newTime = formatTimeGMT8(waterEdit.timeDate);
    const oldTime = waterings[waterEdit.idx].time;
    const wateringId = waterings[waterEdit.idx].id;

    // Check for duplicate time (excluding current schedule being edited)
    const isDuplicate = waterings.some(
      (w, i) => w.time === newTime && i !== waterEdit.idx,
    );
    if (isDuplicate) {
      setConfirmEditVisible(false);
      setWaterEdit({ open: false, idx: null, timeDate: new Date() });
      setShowDuplicateWaterModal(true);
      return;
    }

    try {
      const user = auth.currentUser;
      if (user) {
        let firstName = "N/A";
        let lastName = "N/A";
        try {
          const userDocRef = doc(db, "users", user.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            firstName = userData.firstName || "N/A";
            lastName = userData.lastName || "N/A";
          }
        } catch (fetchErr) {
          console.error("Failed to fetch user data:", fetchErr);
        }

        // Update existing document in database
        await setDoc(doc(db, "wateringSchedules", `${wateringId}`), {
          wateringId,
          label: waterings[waterEdit.idx].label,
          time: newTime,
          userId: user.uid, // Required by ESP32
          duration: 5, // Duration in seconds
          timestamp: new Date().toISOString(),
        });

        await addDoc(
          collection(db, "activity_logs", "watering", "editWaterSchedule_logs"),
          {
            action: `Changed watering time from ${oldTime} to ${newTime}`,
            description: `Changed from ${oldTime} to ${newTime}`,
            firstName,
            lastName,
            newTime,
            oldTime,
            selectedTime: waterEdit.timeDate.toISOString(),
            selectedTimeGMT8: newTime,
            timestamp: new Date().toISOString(),
            userId: user.uid,
            wateringId,
          },
        );

        // Add user notification
        addUserNotification({
          category: "IoT: Internet of Tsiken",
          title: "Watering schedule updated",
          description: `Schedule changed from ${oldTime} to ${newTime}`,
        });

        // Add admin notification
        addNotification({
          category: "Schedule Management",
          title: "Watering schedule updated",
          description: `${user.displayName || user.email} changed watering time from ${oldTime} to ${newTime}`,
          type: "schedule",
        });
      }
    } catch (err) {
      console.error("Failed to save watering edit:", err);
    }

    setWaterings((s) =>
      s
        .map((w, i) => (i === waterEdit.idx ? { ...w, time: newTime } : w))
        .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time)),
    );

    setConfirmEditVisible(false);
    setWaterEdit({ open: false, idx: null, timeDate: new Date() });
    setPopupMessage("Updated Successfully!");
    setShowSavedPopup(true);
    setTimeout(() => setShowSavedPopup(false), 1400);
  };

  const confirmDeleteWater = async () => {
    console.log("📄 [ACTION] Confirming water schedule delete");
    console.log("🔍 pendingDeleteWaterId value:", pendingDeleteWaterId);
    console.log("🔍 Current waterings list:", waterings);

    if (!pendingDeleteWaterId) {
      console.warn("❌ No pending water ID to delete");
      setConfirmDeleteWaterVisible(false);
      setPendingDeleteWaterId(null);
      return;
    }
    const waterToDelete = waterings.find((w) => w.id === pendingDeleteWaterId);
    if (!waterToDelete) {
      console.warn(
        "❌ Water schedule not found in list:",
        pendingDeleteWaterId,
      );
      setConfirmDeleteWaterVisible(false);
      setPendingDeleteWaterId(null);
      return;
    }

    console.log("🗑️ Deleting water schedule:", waterToDelete);

    try {
      const user = auth.currentUser;
      if (user) {
        let firstName = "N/A";
        let lastName = "N/A";
        try {
          const userDocRef = doc(db, "users", user.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            firstName = userData.firstName || "N/A";
            lastName = userData.lastName || "N/A";
          }
        } catch (fetchErr) {
          console.error("Failed to fetch user data:", fetchErr);
        }

        console.log("🔥 Deleting from Firestore...");
        await deleteDoc(
          doc(db, "wateringSchedules", `${pendingDeleteWaterId}`),
        );

        console.log("📝 Adding delete log...");
        await addDoc(
          collection(
            db,
            "activity_logs",
            "watering",
            "deleteWaterSchedule_logs",
          ),
          {
            action: `Removed water schedule: ${waterToDelete.time}`,
            description: `${waterToDelete.time} has been removed`,
            firstName,
            lastName,
            scheduleRemoved: waterToDelete.time,
            timestamp: new Date().toISOString(),
            userId: user.uid,
            waterId: pendingDeleteWaterId,
          },
        );

        // Add user notification
        addUserNotification({
          category: "IoT: Internet of Tsiken",
          title: "Watering schedule deleted",
          description: `Watering schedule at ${waterToDelete.time} has been removed`,
        });

        // Add admin notification
        addNotification({
          category: "Schedule Management",
          title: "Watering schedule deleted",
          description: `${user.displayName || user.email} deleted watering schedule at ${waterToDelete.time}`,
          type: "schedule",
        });

        console.log("✅ Successfully deleted from Firestore");
      }
    } catch (err) {
      console.error("❌ Error deleting watering schedule:", err);
      Alert.alert("Error", "Failed to delete watering: " + err.message);
      setConfirmDeleteWaterVisible(false);
      setPendingDeleteWaterId(null);
      return;
    }

    console.log("🔄 Updating local state...");
    setWaterings((s) => s.filter((w) => w.id !== pendingDeleteWaterId));
    setConfirmDeleteWaterVisible(false);
    setPendingDeleteWaterId(null);
    setShowSavedPopup(true);
    setTimeout(() => setShowSavedPopup(false), 1200);
    setPopupMessage("Deleted Successfully!");
    setShowSavedPopup(true);
    setTimeout(() => setShowSavedPopup(false), 1200);
    console.log("✅ Water schedule deleted successfully");
  };

  const confirmSaveWaterSchedule = async () => {
    console.log("📄 [ACTION] Confirming water schedule save");

    // Prevent duplicate submissions
    if (isSubmitting) {
      console.warn("Submit already in progress, ignoring duplicate click");
      return;
    }

    if (!pendingWaterSchedule) {
      setConfirmWaterSaveVisible(false);
      return;
    }

    setIsSubmitting(true);

    try {
      const user = auth.currentUser;
      if (user) {
        // Save to wateringSchedules collection
        await setDoc(doc(db, "wateringSchedules", user.uid), {
          userId: user.uid,
          date: pendingWaterSchedule.date,
          time: pendingWaterSchedule.time,
          liters: pendingWaterSchedule.liters,
          duration: pendingWaterSchedule.duration,
          timestamp: new Date().toISOString(),
        });

        // LOGGING REMOVED - Log to wateringActivity_logs collection
        // Convert scheduledTime to GMT+8 and format
        const scheduledTimeDate = new Date(pendingWaterSchedule.time);
        const gmt8Time = new Date(
          scheduledTimeDate.getTime() + 8 * 60 * 60 * 1000,
        );
        const hours = gmt8Time.getUTCHours();
        const minutes = gmt8Time.getUTCMinutes();
        const ampm = hours >= 12 ? "PM" : "AM";
        const hour12 = hours % 12 || 12;
        const timeFormatted = `${hour12}:${minutes.toString().padStart(2, "0")} ${ampm}`;

        console.log(
          "📋 [LOGGING DISABLED] Would log watering schedule change:",
          {
            scheduledTime: timeFormatted,
            liters: pendingWaterSchedule.liters,
            duration: pendingWaterSchedule.duration,
            action: "New watering schedule",
          },
        );

        // Log activity to Firestore
        await logActivity("wateringActivity_logs", {
          action: "New watering schedule",
          description: `Scheduled ${pendingWaterSchedule.liters}L for ${pendingWaterSchedule.duration} seconds at ${timeFormatted}`,
          newTime: timeFormatted,
          selectedTime: pendingWaterSchedule.time,
          duration: pendingWaterSchedule.duration,
          status: "Scheduled",
        });

        // Add user notification
        addUserNotification({
          category: "IoT: Internet of Tsiken",
          title: "Watering schedule saved",
          description: `Watering scheduled for ${timeFormatted}: ${pendingWaterSchedule.liters}L for ${pendingWaterSchedule.duration} seconds`,
        });

        // Add admin notification
        addNotification({
          category: "Schedule Management",
          title: "Watering schedule saved",
          description: `${user.displayName || user.email} scheduled watering at ${timeFormatted}: ${pendingWaterSchedule.liters}L for ${pendingWaterSchedule.duration}s`,
          type: "schedule",
        });

        // Update confirmed display values after successful save
        setConfirmedWaterDate(
          pendingWaterSchedule.date
            ? new Date(pendingWaterSchedule.date)
            : new Date(),
        );
        setConfirmedWaterTime(
          pendingWaterSchedule.time
            ? new Date(pendingWaterSchedule.time)
            : new Date(),
        );
      }
    } catch (err) {
      Alert.alert("Error", "Failed to save watering schedule: " + err.message);
      setConfirmWaterSaveVisible(false);
      setPendingWaterSchedule(null);
      setIsSubmitting(false);
      return;
    }

    setConfirmWaterSaveVisible(false);
    setPendingWaterSchedule(null);
    setIsSubmitting(false);
    setShowSavedPopup(true);
    setTimeout(() => setShowSavedPopup(false), 1400);
  };
  // helpers
  const fmtDate = (d) => d.toISOString().split("T")[0];
  const fmtTime = (d) =>
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const saveNightTimeLog = async (time) => {
    console.log("📄 [ACTION] Saving night schedule");

    // Prevent duplicate submissions
    if (isSubmitting) {
      console.warn("Submit already in progress, ignoring duplicate click");
      return;
    }

    setIsSubmitting(true);

    try {
      const user = auth.currentUser;
      if (!user) {
        setIsSubmitting(false);
        return;
      }

      // Fetch firstName and lastName from users collection
      let firstName = "N/A";
      let lastName = "N/A";
      try {
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          firstName = userData.firstName || "N/A";
          lastName = userData.lastName || "N/A";
        }
      } catch (userFetchError) {
        console.error("Error fetching user data:", userFetchError);
      }

      // Convert to GMT+8 and format as human-readable string
      const gmt8Time = new Date(time.getTime() + 8 * 60 * 60 * 1000);
      const hours = gmt8Time.getUTCHours();
      const minutes = gmt8Time.getUTCMinutes();
      const ampm = hours >= 12 ? "PM" : "AM";
      const hour12 = hours % 12 || 12;
      const monthNames = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      const selectedTimeGMT8Formatted = `${hour12}:${minutes.toString().padStart(2, "0")} ${ampm}, ${monthNames[gmt8Time.getUTCMonth()]} ${gmt8Time.getUTCDate()}, ${gmt8Time.getUTCFullYear()}`;
      const timeOnly = `${hour12}:${minutes.toString().padStart(2, "0")} ${ampm}`;

      // Save to Firestore nightTime collection
      console.log(
        "💾 [DATABASE] Saving night time to Firestore nightTime/1...",
      );
      const updateResult = await updateNightTimeSchedule(
        time.toISOString(),
        user.uid,
        firstName,
        lastName,
      );

      if (!updateResult.success) {
        throw new Error(updateResult.message || "Failed to save night time");
      }

      console.log("✅ [DATABASE] Night time saved successfully:", updateResult);

      // Activity logging is handled in updateNightTimeSchedule function
      // Logging to activity_logs/nightTime_logs/events

      setIsSubmitting(false);
      setPopupMessage("Updated Successfully!");
      setShowSavedPopup(true);
      setTimeout(() => setShowSavedPopup(false), 1400);
    } catch (err) {
      setIsSubmitting(false);
      console.error("❌ [ERROR] Failed to save night time:", err);
      Alert.alert("Error", err.message || "Failed to save night time");
    }
  };

  // power bar width calculation (we'll map alertThreshold 0-100 to width)
  const powerBarWidth = (percent) => {
    // base width in style is 270; map percent to that width
    const max = 270;
    return (percent / 100) * max;
  };

  // Test Lighting modal state
  const [testLightingModalVisible, setTestLightingModalVisible] =
    useState(false);
  const [testLightOn, setTestLightOn] = useState(false);

  return (
    <View style={styles.page} {...panResponder.panHandlers}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Page Title */}
        <Text style={styles.pageTitle}>REAL-TIME STATUS</Text>

        {/* Sensor Status Banner */}
        {isSimulated && (
          <View style={styles.sensorBanner}>
            <Ionicons name="warning-outline" size={16} color="#856404" />
            <Text style={styles.sensorBannerText}>
              Sensor module not detected.
            </Text>
          </View>
        )}

        {/* 1. UPDATED REAL-TIME SENSORS GRID */}
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            justifyContent: "space-between",
            marginTop: 8,
          }}
        >
          {/* Water Level */}
          <StatCard
            label="Water Level"
            value={sensorLoading ? "..." : `${Math.round(waterNow)}%`}
            subValue={waterNow > 80 ? "Full (Safety Active)" : "Normal"}
            icon="water-outline"
            color="#133E87"
            loading={sensorLoading}
            isSimulated={isSimulated}
          />
          {/* Feeder / Weight */}
          <StatCard
            label="Feeder Mass"
            value={sensorLoading ? "..." : `${Math.round(bowlWeight)}g`}
            subValue={bowlWeight > 500 ? "Bowl Full" : "Ready"}
            icon="nutrition-outline"
            color="#133E87"
            loading={sensorLoading}
            isSimulated={isSimulated}
          />
          {/* Temperature */}
          <StatCard
            label="Temperature"
            value={sensorLoading ? "..." : `${temperature}°C`}
            icon="thermometer-outline"
            color="#133E87"
            loading={sensorLoading}
            isSimulated={isSimulated}
          />
          {/* Humidity */}
          <StatCard
            label="Humidity"
            value={sensorLoading ? "..." : `${humidity}%`}
            icon="water-outline"
            color="#133E87"
            loading={sensorLoading}
            isSimulated={isSimulated}
          />
          {/* Air Quality */}
          <StatCard
            label="Air Quality"
            value={sensorLoading ? "..." : `${airQuality}`}
            subValue="PPM"
            icon="cloud-outline"
            color="#133E87"
            loading={sensorLoading}
            isSimulated={isSimulated}
          />
          {/* Water Storage Tank Level (Ultrasonic 2) */}
          <StatCard
            label="Water Storage"
            value={sensorLoading ? "..." : `${Math.round(waterStorageLevel)}%`}
            subValue={waterStorageLevel < 20 ? "Low - Refill Soon" : "Normal"}
            icon="water-outline"
            color="#133E87"
            loading={sensorLoading}
            isSimulated={isSimulated}
          />
          {/* Feed Storage Tank Level (Ultrasonic 1) */}
          <StatCard
            label="Feed Storage"
            value={sensorLoading ? "..." : `${Math.round(feedStorageLevel)}%`}
            subValue={feedStorageLevel < 20 ? "Low - Refill Soon" : "Normal"}
            icon="cube-outline"
            color="#133E87"
            loading={sensorLoading}
            isSimulated={isSimulated}
          />
        </View>

        {/* Live Camera */}
        <View style={[styles.card, { borderColor: BORDER_OVERLAY }]}>
          <CardHeader
            icon="videocam-outline"
            title="Live Camera Surveillance"
          />
          <View style={styles.cameraBox}>
            <CameraStream
              serverUrl={cameraServerUrl}
              onServerDiscovered={handleServerDiscovered}
              onOpenFullscreen={() => setCameraModal(true)}
            />
          </View>
        </View>

        {/* 2. VENTILATION CONTROL (New Section) */}
        <View style={[styles.card, { borderColor: BORDER_OVERLAY }]}>
          <CardHeader icon="hardware-chip-outline" title="Ventilation System" />
          <View
            style={[
              styles.innerBox,
              { justifyContent: "space-between", marginTop: 15 },
            ]}
          >
            <View>
              <Text style={{ fontSize: 16, fontWeight: "600", color: "#333" }}>
                Exhaust Fan
              </Text>
              <Text style={styles.smallNote}>
                {fanOn
                  ? "Active - Cooling system running"
                  : "Inactive - System idle"}
              </Text>
            </View>
            <Switch
              value={fanOn}
              onValueChange={handleFanToggle}
              trackColor={{ false: "#B0B0B0", true: PRIMARY }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* 3. VITAMIN SYSTEM */}
        <View style={[styles.card, { borderColor: BORDER_OVERLAY }]}>
          <CardHeader icon="flask-outline" title="Vitamin System" />
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 12,
              paddingTop: 12,
              borderTopWidth: 1,
              borderTopColor: "#e2e8f0",
            }}
          >
            <View style={{ flex: 1, paddingRight: 16 }}>
              <Text style={{ fontSize: 16, fontWeight: "600", color: "#333" }}>
                Peristaltic Pump
              </Text>
              <Text style={styles.smallNote}>
                {vitaminOn
                  ? "Active - Vitamin pump dispenses at watering schedule"
                  : "Inactive - Water pump dispenses at watering schedule"}
              </Text>
            </View>
            <View style={{ marginRight: 24 }}>
              <Switch
                value={vitaminOn}
                onValueChange={handleVitaminToggle}
                trackColor={{ false: "#B0B0B0", true: PRIMARY }}
                thumbColor="#fff"
              />
            </View>
          </View>
          <Text
            style={[
              styles.smallNote,
              { marginTop: 6, fontSize: 11, fontStyle: "italic" },
            ]}
          >
            {vitaminOn
              ? "ON: Peristaltic pump runs at scheduled watering times"
              : "OFF: Regular water pump runs at scheduled watering times"}
          </Text>
        </View>

        {/* Night Schedule */}
        <View style={[styles.card, { borderColor: BORDER_OVERLAY }]}>
          <CardHeader icon="moon-outline" title="Night Schedule" />
          <View style={styles.rowSpace}>
            <View style={{ flex: 1 }}>
              <Text style={styles.smallLabel}>Night Time Start</Text>
              {sunsetLoading ? (
                <View
                  style={[
                    styles.timeInput,
                    { justifyContent: "center", alignItems: "center" },
                  ]}
                >
                  <ActivityIndicator size="small" color={PRIMARY} />
                  <Text style={[styles.timeText, { marginLeft: 8 }]}>
                    Fetching sunset...
                  </Text>
                </View>
              ) : (
                <View
                  style={[
                    styles.timeInput,
                    {
                      backgroundColor: isSunsetAutomated
                        ? "#E8F5E9"
                        : "#FFF3E0",
                      borderColor: isSunsetAutomated ? GREEN : YELLOW,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.timeText}>
                      {formatSunsetDateTime(nightStart)}
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        color: isSunsetAutomated ? GREEN : YELLOW,
                        marginTop: 4,
                      }}
                    >
                      {isSunsetAutomated
                        ? "📍 Auto-set via Sunset API"
                        : "⚠️ Using stored schedule"}
                    </Text>
                  </View>
                  <Ionicons
                    name={isSunsetAutomated ? "checkmark-circle" : "warning"}
                    size={20}
                    color={isSunsetAutomated ? GREEN : YELLOW}
                  />
                </View>
              )}
            </View>
          </View>
          <Text style={[styles.smallNote, { marginTop: 8 }]}>
            {sunsetError
              ? `⚠️ API Error: ${sunsetError}`
              : "Solar power will activate at sunset time"}
          </Text>
        </View>

        {/* Feeding Schedule */}
        <View style={[styles.card, { borderColor: BORDER_OVERLAY }]}>
          <CardHeader icon="fast-food-outline" title="Feeding Schedule" />

          {/* Action buttons: Add only */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "flex-end",
              marginBottom: 8,
            }}
          >
            <TouchableOpacity
              style={[styles.smallActionBtn, { backgroundColor: GREEN }]}
              onPress={addFeedSchedule}
            >
              <Text style={styles.smallActionText}>Add</Text>
            </TouchableOpacity>
          </View>

          {feeds.length === 0 ? (
            <Text style={{ color: "#666", paddingVertical: 8 }}>
              No feeding schedules.
            </Text>
          ) : (
            feeds.map((f, idx) => (
              <View key={`feed-${f.id}-${idx}`} style={styles.feedRow}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  {deleteMode ? (
                    <TouchableOpacity
                      onPress={() => toggleSelectToDelete(f.id)}
                      style={[
                        styles.checkbox,
                        selectedToDelete.includes(f.id) &&
                          styles.checkboxChecked,
                      ]}
                    >
                      {selectedToDelete.includes(f.id) && (
                        <Ionicons name="checkmark" size={18} color="#fff" />
                      )}
                    </TouchableOpacity>
                  ) : (
                    <Ionicons
                      name="time-outline"
                      size={16}
                      color={PRIMARY}
                      style={{ marginRight: 8 }}
                    />
                  )}

                  <Text style={styles.feedTimeText}>{f.time}</Text>
                </View>

                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <TouchableOpacity
                    style={styles.editBtn}
                    onPress={() => openEditFeed(idx)}
                  >
                    <Text style={styles.editText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.editBtn,
                      { backgroundColor: RED, marginLeft: 6 },
                    ]}
                    onPress={() => {
                      console.log(
                        "📄 [ACTION] User clicked delete feed button for id:",
                        f.id,
                      );
                      setPendingDeleteFeedId(f.id);
                      setConfirmDeleteFeedVisible(true);
                    }}
                  >
                    <Text style={styles.editText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}

          {/* If deleteMode active show Delete Selected button */}
          {deleteMode && (
            <View
              style={{
                marginTop: 10,
                flexDirection: "row",
                justifyContent: "flex-end",
              }}
            >
              <TouchableOpacity
                style={[styles.smallActionBtn, { backgroundColor: RED }]}
                onPress={deleteSelected}
              >
                <Text style={styles.smallActionText}>Delete selected</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.smallActionBtn,
                  { backgroundColor: "#999", marginLeft: 8 },
                ]}
                onPress={() => {
                  setDeleteMode(false);
                  setSelectedToDelete([]);
                }}
              >
                <Text style={styles.smallActionText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Water Scheduling (like Feeding) */}
        <View style={[styles.card, { borderColor: BORDER_OVERLAY }]}>
          <CardHeader icon="water-outline" title="Watering Schedule" />
          <View
            style={{
              flexDirection: "row",
              justifyContent: "flex-end",
              marginBottom: 8,
            }}
          >
            <TouchableOpacity
              style={[styles.smallActionBtn, { backgroundColor: GREEN }]}
              onPress={addWaterSchedule}
            >
              <Text style={styles.smallActionText}>Add</Text>
            </TouchableOpacity>
          </View>

          {waterings.length === 0 ? (
            <Text style={{ color: "#666", paddingVertical: 8 }}>
              No watering schedules.
            </Text>
          ) : (
            waterings.map((w, idx) => (
              <View key={`water-${w.id}-${idx}`} style={styles.feedRow}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  {deleteMode ? (
                    <TouchableOpacity
                      onPress={() => toggleSelectToDelete(w.id)}
                      style={[
                        styles.checkbox,
                        selectedToDelete.includes(w.id) &&
                          styles.checkboxChecked,
                      ]}
                    >
                      {selectedToDelete.includes(w.id) && (
                        <Ionicons name="checkmark" size={18} color="#fff" />
                      )}
                    </TouchableOpacity>
                  ) : (
                    <Ionicons
                      name="time-outline"
                      size={16}
                      color={PRIMARY}
                      style={{ marginRight: 8 }}
                    />
                  )}

                  <Text style={styles.feedTimeText}>{w.time}</Text>
                </View>

                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <TouchableOpacity
                    style={styles.editBtn}
                    onPress={() => openEditWater(idx)}
                  >
                    <Text style={styles.editText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.editBtn,
                      { backgroundColor: RED, marginLeft: 6 },
                    ]}
                    onPress={() => {
                      console.log(
                        "🗑️ [ACTION] Delete button clicked for water schedule:",
                        w.id,
                        w.time,
                      );
                      setPendingDeleteWaterId(w.id);
                      setConfirmDeleteWaterVisible(true);
                      console.log("✅ Set pendingDeleteWaterId to:", w.id);
                    }}
                  >
                    <Text style={styles.editText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Test Devices */}
        <View style={[styles.card, { borderColor: BORDER_OVERLAY }]}>
          <Text style={styles.cardTitle}>Test Devices</Text>
          <Text style={[styles.smallNote, { fontSize: 11 }]}>
            Check if the devices are working properly.
          </Text>

          <TouchableOpacity
            style={[
              styles.testBtn,
              { marginTop: 8 },
              isDispensing && styles.testBtnDisabled,
            ]}
            onPress={handleDispense}
            disabled={isDispensing}
          >
            {isDispensing ? (
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <ActivityIndicator
                  size="small"
                  color={PRIMARY}
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.testBtnText}>Dispensing...</Text>
              </View>
            ) : (
              <Text style={styles.testBtnText}>Test Feeding</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.testBtn,
              { marginTop: 10 },
              isPumpTesting && styles.testBtnDisabled,
            ]}
            onPress={handleTestPump}
            disabled={isPumpTesting}
          >
            {isPumpTesting ? (
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <ActivityIndicator
                  size="small"
                  color={PRIMARY}
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.testBtnText}>Testing Pump...</Text>
              </View>
            ) : (
              <Text style={styles.testBtnText}>Test Water Pump</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.testBtn,
              { marginTop: 10 },
              isVitaminPumpTesting && styles.testBtnDisabled,
            ]}
            onPress={handleTestVitaminPump}
            disabled={isVitaminPumpTesting}
          >
            {isVitaminPumpTesting ? (
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <ActivityIndicator
                  size="small"
                  color={PRIMARY}
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.testBtnText}>Testing Vitamin Pump...</Text>
              </View>
            ) : (
              <Text style={styles.testBtnText}>Test Vitamin Pump</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.testBtn,
              { marginTop: 10 },
              isSprinklerActive && styles.testBtnDisabled,
            ]}
            onPress={handleSprinkler}
            disabled={isSprinklerActive}
          >
            {isSprinklerActive ? (
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <ActivityIndicator
                  size="small"
                  color={PRIMARY}
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.testBtnText}>Activating...</Text>
              </View>
            ) : (
              <Text style={styles.testBtnText}>
                Test Hydro Defense Mechanism
              </Text>
            )}
          </TouchableOpacity>

          {/* New Test Lighting Button */}
          <TouchableOpacity
            style={[styles.testBtn, { marginTop: 10 }]}
            onPress={handleTestLighting}
          >
            <Text style={styles.testBtnText}>Test Lighting</Text>
          </TouchableOpacity>
        </View>

        {/* Lighting only (Ventilation removed) */}
        <View style={[styles.card, { borderColor: BORDER_OVERLAY }]}>
          <CardHeader icon="bulb-outline" title="Lighting" />
          <View
            style={[
              styles.innerBox,
              {
                marginTop: 8,
                borderColor: BORDER_OVERLAY,
                paddingVertical: 12,
                paddingHorizontal: 12,
                flexDirection: "column",
              },
            ]}
          >
            {/* Incandescent Light Control */}
            <View style={{ width: "100%" }}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <Text style={{ fontWeight: "600", fontSize: 14 }}>
                  Incandescent Light (MOSFET)
                </Text>
                <Switch
                  value={lightOn}
                  onValueChange={handleLightToggle}
                  trackColor={{ false: "#B0B0B0", true: PRIMARY }}
                  ios_backgroundColor="#B0B0B0"
                  thumbColor="#fff"
                />
              </View>

              {/* Status text */}
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Status:</Text>
                <Ionicons
                  name="ellipse"
                  size={14}
                  color={lightOn ? "#22c55e" : "#000"}
                  style={{ marginHorizontal: 6 }}
                />
                <Text style={styles.statusValue}>{lightOn ? "ON" : "OFF"}</Text>
              </View>
              <Text
                style={{
                  fontSize: 11,
                  color: "#999",
                  marginTop: 2,
                  fontStyle: "italic",
                }}
              >
                Connected to ESP32 GPIO16 via MOSFET
              </Text>
            </View>
          </View>
        </View>
        {/* Power Schedule */}
        <View style={[styles.card, { borderColor: BORDER_OVERLAY }]}>
          <CardHeader
            icon="flash-outline"
            title="Power Schedule"
            rightText={`${solarPowerLevel}%`}
          />

          {/* Simulation warning banner */}
          {isSolarSimulated && (
            <View
              style={{
                backgroundColor: "#FFF3CD",
                borderRadius: 6,
                padding: 10,
                marginTop: 8,
                borderLeftWidth: 4,
                borderLeftColor: YELLOW,
              }}
            >
              <Text
                style={{ fontSize: 12, color: "#856404", fontWeight: "600" }}
              >
                ⚠️ ESP32 offline
              </Text>
            </View>
          )}

          <View style={{ marginTop: 8 }}>
            {/* Power level display */}
            <Text style={styles.smallLabel}>
              Solar power level: {solarPowerLevel}%
            </Text>

            {/* Dynamic status text based on power level */}
            <Text
              style={{
                fontSize: 12,
                marginBottom: 8,
                fontWeight: "600",
                color:
                  solarPowerLevel > 75
                    ? GREEN
                    : solarPowerLevel > 50
                      ? YELLOW
                      : solarPowerLevel > 30
                        ? "#FF9800"
                        : RED,
              }}
            >
              <Ionicons
                name={
                  solarPowerLevel > 75
                    ? "checkmark-circle"
                    : solarPowerLevel > 50
                      ? "radio-button-on"
                      : solarPowerLevel > 30
                        ? "warning"
                        : "alert-circle"
                }
                size={14}
                color={
                  solarPowerLevel > 75
                    ? GREEN
                    : solarPowerLevel > 50
                      ? YELLOW
                      : solarPowerLevel > 30
                        ? "#FF9800"
                        : RED
                }
                style={{ marginRight: 4 }}
              />
              {solarPowerLevel > 75
                ? "Excellent Power"
                : solarPowerLevel > 50
                  ? "Good Power"
                  : solarPowerLevel > 30
                    ? "Moderate Power"
                    : "Low Power"}
            </Text>

            {/* Horizontal bar container with threshold indicator */}
            <View style={styles.powerBarContainer}>
              {/* Threshold indicator line */}
              <View
                style={{
                  position: "absolute",
                  left: `${alertThreshold}%`,
                  top: 0,
                  bottom: 0,
                  width: 3,
                  backgroundColor: RED,
                  zIndex: 2,
                }}
              />
              {/* Power bar fill with dynamic color */}
              <View
                style={[
                  styles.powerBarFill,
                  {
                    width: `${Math.min(solarPowerLevel, 100)}%`,
                    backgroundColor:
                      solarPowerLevel <= alertThreshold ? RED : YELLOW,
                  },
                ]}
              />
            </View>

            {/* Threshold percentage label */}
            <Text style={[styles.smallLabel, { marginTop: 12 }]}>
              Alert threshold: {alertThreshold}%
            </Text>
            <Slider
              minimumValue={0}
              maximumValue={100}
              step={1}
              value={alertThreshold}
              onValueChange={handleThresholdChange}
              minimumTrackTintColor={YELLOW}
            />

            <View style={{ marginTop: 10 }}>
              <View style={styles.rowSpace}>
                <Text style={{ fontWeight: "600" }}>
                  Enable automatic power management
                </Text>
                <Switch
                  value={autoPower}
                  onValueChange={setAutoPower}
                  trackColor={{ false: "#B0B0B0", true: PRIMARY }}
                  ios_backgroundColor="#B0B0B0"
                  thumbColor="#fff"
                />
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Date / Time Pickers */}
      {showWaterTimePicker && !waterEdit.open && (
        <DateTimePicker
          value={new Date()}
          mode="time"
          display="default"
          onChange={(_, selected) => {
            setShowWaterTimePicker(false);
            if (selected)
              setWaterEdit((prev) => ({ ...prev, timeDate: selected }));
          }}
        />
      )}
      {showWaterAddPicker && (
        <DateTimePicker
          value={new Date()}
          mode="time"
          display="default"
          onChange={(event, selected) => {
            setShowWaterAddPicker(false);
            const confirmed =
              (event?.type === "set" || !event?.type) && selected;
            if (confirmed) {
              // Check for duplicate time BEFORE showing confirmation
              const formattedTime = selected.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              });
              const isDuplicate = waterings.some(
                (w) => w.time === formattedTime,
              );

              if (isDuplicate) {
                setShowDuplicateWaterModal(true);
              } else {
                setPendingWaterTime(selected);
                setConfirmWaterAddVisible(true);
              }
            }
          }}
        />
      )}
      {showNightPicker && (
        <DateTimePicker
          value={nightStart}
          mode="time"
          display="default"
          onChange={(event, selected) => {
            // Close picker regardless
            setShowNightPicker(false);
            // Only proceed if user pressed OK (Android) or a time is selected (iOS)
            const confirmed =
              (event?.type === "set" || !event?.type) && selected;
            if (confirmed) {
              const hour = selected.getHours(); // 0-23
              // Duplicate time check: if same as current nightStart, warn like feed schedule duplicate
              const selectedStr = fmtTime(selected);
              const currentStr = fmtTime(nightStart);
              if (selectedStr === currentStr) {
                setShowDuplicateModal(true);
                return;
              }
              setPendingNightTime(selected);
              if (hour < 12) {
                // Morning selection warning
                setWarnMorningVisible(true);
              } else {
                // Evening directly to confirmation
                setConfirmNightSaveVisible(true);
              }
            }
          }}
        />
      )}
      {showFeedAddPicker && (
        <DateTimePicker
          value={new Date()}
          mode="time"
          display="default"
          onChange={(event, selected) => {
            setShowFeedAddPicker(false);
            const confirmed =
              (event?.type === "set" || !event?.type) && selected;
            if (confirmed) {
              setPendingFeedTime(selected);
              setConfirmFeedSaveVisible(true);
            }
          }}
        />
      )}

      {/* Edit Modal for Feed or Watering */}
      <Modal
        key="feedEditModal"
        visible={feedEdit.open || waterEdit.open}
        transparent
        animationType="slide"
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          onPress={() => {
            if (feedEdit.open) {
              setFeedEdit({ open: false, idx: null, timeDate: new Date() });
            }
            if (waterEdit.open) {
              setWaterEdit({ open: false, idx: null, timeDate: new Date() });
            }
          }}
        />
        <View style={styles.editModal}>
          <Text
            style={[
              styles.modalTitle,
              { textAlign: "center", fontWeight: "bold" },
            ]}
          >
            {feedEdit.open ? "Edit Feeding Time" : "Edit Watering Time"}
          </Text>

          <TouchableOpacity
            style={[styles.timeInput, { marginTop: 6 }]}
            onPress={() => {
              if (feedEdit.open) setShowFeedTimePicker(true);
              else setShowWaterTimePicker(true);
            }}
          >
            <Text style={styles.timeText}>
              {feedEdit.open
                ? feedEdit.timeDate
                  ? fmtTime(feedEdit.timeDate)
                  : "Select time"
                : waterEdit.timeDate
                  ? fmtTime(waterEdit.timeDate)
                  : "Select time"}
            </Text>
            <Ionicons name="time-outline" size={18} color={PRIMARY} />
          </TouchableOpacity>

          {showFeedTimePicker && (
            <DateTimePicker
              value={feedEdit.timeDate || new Date()}
              mode="time"
              display="default"
              onChange={(_, selected) => {
                setShowFeedTimePicker(false);
                if (selected)
                  setFeedEdit((s) => ({ ...s, timeDate: selected }));
              }}
            />
          )}
          {showWaterTimePicker && (
            <DateTimePicker
              value={waterEdit.timeDate || new Date()}
              mode="time"
              display="default"
              onChange={(_, selected) => {
                setShowWaterTimePicker(false);
                if (selected)
                  setWaterEdit((s) => ({ ...s, timeDate: selected }));
              }}
            />
          )}

          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginTop: 10,
            }}
          >
            <TouchableOpacity
              style={[
                styles.primaryBtn,
                { backgroundColor: "#e5e7eb", flex: 1, marginRight: 6 },
              ]}
              onPress={() => {
                if (feedEdit.open) {
                  setFeedEdit({ open: false, idx: null, timeDate: new Date() });
                } else if (waterEdit.open) {
                  setWaterEdit({
                    open: false,
                    idx: null,
                    timeDate: new Date(),
                  });
                }
              }}
            >
              <Text style={styles.primaryBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.primaryBtn,
                { flex: 1, backgroundColor: "#22c55e" },
              ]}
              onPress={() => {
                // Check for duplicate before showing confirm modal
                if (feedEdit.open && feedEdit.idx !== null) {
                  const newTime = feedEdit.timeDate.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  const isDuplicate = feeds.some(
                    (f, i) => i !== feedEdit.idx && f.time === newTime,
                  );
                  if (isDuplicate) {
                    setShowDuplicateModal(true);
                    return;
                  }
                }
                if (waterEdit.open && waterEdit.idx !== null) {
                  const newTime = waterEdit.timeDate.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  const isDuplicate = waterings.some(
                    (w, i) => i !== waterEdit.idx && w.time === newTime,
                  );
                  if (isDuplicate) {
                    setShowDuplicateWaterModal(true);
                    return;
                  }
                }
                setConfirmEditVisible(true);
              }}
            >
              <Text style={styles.primaryBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Camera Modal */}
      <Modal
        key="cameraModal"
        visible={cameraModal}
        transparent
        animationType="slide"
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          onPress={() => setCameraModal(false)}
        />
        <View style={styles.editModal}>
          <Text style={styles.modalTitle}>Live Camera</Text>
          <Image
            source={require("../../../assets/proposal meeting.png")}
            style={{ width: "100%", height: 220, borderRadius: 8 }}
          />
          <TouchableOpacity
            style={[styles.primaryBtn, { marginTop: 12 }]}
            onPress={() =>
              Alert.alert("Connect", "Placeholder to connect to IoT camera")
            }
          >
            <Ionicons name="close-circle" size={40} color="#fff" />
          </TouchableOpacity>

          <View style={styles.fullScreenCameraContainer}>
            <CameraStream
              serverUrl={cameraServerUrl}
              onServerDiscovered={handleServerDiscovered}
              autoConnect={true}
              fullscreen={true}
            />
          </View>
        </View>
      </Modal>

      {/* Confirm delete all */}
      <Modal
        key="confirmDeleteAllModal"
        visible={confirmDeleteVisible}
        transparent
        animationType="fade"
      >
        <View style={styles.popupBackground}>
          <View style={styles.popupBox}>
            <Text style={{ fontWeight: "700", fontSize: 16 }}>
              Delete all schedules?
            </Text>
            <Text style={{ color: "#666", marginTop: 8 }}>
              This will remove all feeding schedules.
            </Text>
            <View style={{ flexDirection: "row", marginTop: 12 }}>
              <TouchableOpacity
                style={[styles.smallActionBtn, { backgroundColor: "#E5E7EB" }]}
                onPress={() => setConfirmDeleteVisible(false)}
              >
                <Text style={[styles.smallActionText, { color: "#1F2937" }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.smallActionBtn,
                  { backgroundColor: "#22C55E", marginLeft: 8 },
                ]}
                onPress={confirmDeleteAll}
              >
                <Text style={styles.smallActionText}>Delete All</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Confirm Save */}
      <Modal
        key="confirmSaveModal"
        visible={confirmSaveVisible}
        transparent
        animationType="fade"
      >
        <View style={styles.popupBackground}>
          <View style={styles.popupBox}>
            <Text style={{ fontWeight: "700", fontSize: 16 }}>
              Save schedules?
            </Text>
            <Text style={{ color: "#666", marginTop: 8 }}>
              Are you sure you want to save all feeding schedules?
            </Text>
            <View style={{ flexDirection: "row", marginTop: 12 }}>
              <TouchableOpacity
                style={[styles.smallActionBtn, { backgroundColor: "#999" }]}
                onPress={() => setConfirmSaveVisible(false)}
              >
                <Text style={styles.smallActionText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.smallActionBtn,
                  { backgroundColor: PRIMARY, marginLeft: 8 },
                ]}
                onPress={confirmSaveAll}
              >
                <Text style={styles.smallActionText}>Yes, Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Morning Warning Modal */}
      <Modal
        key="morningWarningModal"
        visible={warnMorningVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setWarnMorningVisible(false)}
      >
        <View style={styles.popupBackground}>
          <View style={styles.popupBox}>
            <Text style={{ fontWeight: "700", fontSize: 16 }}>
              Morning time selected
            </Text>
            <Text style={{ color: "#666", marginTop: 8, textAlign: "center" }}>
              You picked a morning time. Night schedule usually starts in the
              evening. Do you still want to continue?
            </Text>
            <View style={{ flexDirection: "row", marginTop: 12 }}>
              <TouchableOpacity
                style={[styles.smallActionBtn, { backgroundColor: "#999" }]}
                onPress={() => {
                  setWarnMorningVisible(false);
                  setPendingNightTime(null);
                }}
              >
                <Text style={styles.smallActionText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.smallActionBtn,
                  { backgroundColor: PRIMARY, marginLeft: 8 },
                ]}
                onPress={() => {
                  setWarnMorningVisible(false);
                  setConfirmNightSaveVisible(true);
                }}
              >
                <Text style={styles.smallActionText}>Continue</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Confirm Night Time Save */}
      <Modal
        key="confirmNightSaveModal"
        visible={confirmNightSaveVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmNightSaveVisible(false)}
      >
        <View style={styles.popupBackground}>
          <View style={styles.popupBox}>
            <Text style={{ fontWeight: "700", fontSize: 16 }}>
              Save night time?
            </Text>
            <Text style={{ color: "#666", marginTop: 8, textAlign: "center" }}>
              Are you sure you want to save{" "}
              {pendingNightTime ? fmtTime(pendingNightTime) : ""} as the night
              schedule?
            </Text>
            <View style={{ flexDirection: "row", marginTop: 12 }}>
              <TouchableOpacity
                style={[styles.smallActionBtn, { backgroundColor: "#999" }]}
                onPress={() => {
                  setConfirmNightSaveVisible(false);
                  setPendingNightTime(null);
                }}
              >
                <Text style={styles.smallActionText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.smallActionBtn,
                  { backgroundColor: PRIMARY, marginLeft: 8 },
                ]}
                onPress={async () => {
                  if (!pendingNightTime) {
                    setConfirmNightSaveVisible(false);
                    return;
                  }
                  await saveNightTimeLog(pendingNightTime);
                  setNightStart(pendingNightTime);
                  setConfirmNightSaveVisible(false);
                  setPendingNightTime(null);
                }}
              >
                <Text style={styles.smallActionText}>Yes, Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Confirm Feed Add */}
      <Modal
        key="confirmFeedAddModal"
        visible={confirmFeedSaveVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setConfirmFeedSaveVisible(false);
          setShowFeedAddPicker(false);
          setPendingFeedTime(null);
        }}
      >
        <View style={styles.popupBackground}>
          <View style={styles.popupBox}>
            <Text style={{ fontWeight: "700", fontSize: 16 }}>
              Save feeding time?
            </Text>
            <Text style={{ color: "#666", marginTop: 8, textAlign: "center" }}>
              Are you sure you want to save{" "}
              {pendingFeedTime ? fmtTime(pendingFeedTime) : ""} as a feeding
              schedule?
            </Text>
            <View style={{ flexDirection: "row", marginTop: 12 }}>
              <TouchableOpacity
                style={[styles.smallActionBtn, { backgroundColor: "#E5E7EB" }]}
                onPress={() => {
                  setConfirmFeedSaveVisible(false);
                  setShowFeedAddPicker(false);
                  setPendingFeedTime(null);
                }}
              >
                <Text style={[styles.smallActionText, { color: "#1F2937" }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.smallActionBtn,
                  { backgroundColor: "#22C55E", marginLeft: 8 },
                ]}
                onPress={confirmAddFeed}
              >
                <Text style={styles.smallActionText}>Yes, Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Duplicate Time Modal */}
      <Modal
        key="duplicateTimeModal"
        visible={showDuplicateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDuplicateModal(false)}
      >
        <View style={styles.popupBackground}>
          <View style={styles.popupBox}>
            <Text style={{ fontWeight: "700", fontSize: 16 }}>
              Duplicate time
            </Text>
            <Text style={{ color: "#666", marginTop: 8, textAlign: "center" }}>
              That feeding time already exists. Please choose a different time.
            </Text>
            <TouchableOpacity
              style={[
                styles.smallActionBtn,
                { backgroundColor: PRIMARY, marginTop: 12 },
              ]}
              onPress={() => setShowDuplicateModal(false)}
            >
              <Text style={styles.smallActionText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Confirm Edit Modal */}
      <Modal
        key="confirmEditModal"
        visible={confirmEditVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setConfirmEditVisible(false);
          setFeedEdit({ open: false, idx: null, timeDate: new Date() });
        }}
      >
        <View style={styles.popupBackground}>
          <View style={styles.popupBox}>
            <Text style={{ fontWeight: "700", fontSize: 16 }}>
              Confirm Edit
            </Text>
            <Text style={{ color: "#666", marginTop: 8, textAlign: "center" }}>
              Do you want to save changes to this schedule?
            </Text>
            <View style={{ flexDirection: "row", marginTop: 12 }}>
              <TouchableOpacity
                style={[styles.smallActionBtn, { backgroundColor: "#E5E7EB" }]}
                onPress={() => {
                  setConfirmEditVisible(false);
                  setFeedEdit({ open: false, idx: null, timeDate: new Date() });
                }}
              >
                <Text style={[styles.smallActionText, { color: "#1F2937" }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.smallActionBtn,
                  { backgroundColor: "#22C55E", marginLeft: 8 },
                ]}
                onPress={() => {
                  if (feedEdit.open) {
                    saveFeedEdit();
                  } else if (waterEdit.open) {
                    saveWaterEdit();
                  }
                }}
              >
                <Text style={styles.smallActionText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Confirm Delete Feed Modal */}
      <Modal
        key="confirmDeleteFeedModal"
        visible={confirmDeleteFeedVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmDeleteFeedVisible(false)}
      >
        <View style={styles.popupBackground}>
          <View style={styles.popupBox}>
            <Text style={{ fontWeight: "700", fontSize: 16 }}>
              Confirm Delete
            </Text>
            <Text style={{ color: "#666", marginTop: 8, textAlign: "center" }}>
              Are you sure you want to delete this schedule?
            </Text>
            <View style={{ flexDirection: "row", marginTop: 12 }}>
              <TouchableOpacity
                style={[styles.smallActionBtn, { backgroundColor: "#E5E7EB" }]}
                onPress={() => {
                  setConfirmDeleteFeedVisible(false);
                  setPendingDeleteFeedId(null);
                }}
              >
                <Text style={[styles.smallActionText, { color: "#1F2937" }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.smallActionBtn,
                  { backgroundColor: "#22C55E", marginLeft: 8 },
                ]}
                onPress={confirmDeleteFeed}
              >
                <Text style={styles.smallActionText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        key="confirmDeleteWaterModal"
        visible={confirmDeleteWaterVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmDeleteWaterVisible(false)}
      >
        <View style={styles.popupBackground}>
          <View style={styles.popupBox}>
            <Text style={{ fontWeight: "700", fontSize: 16 }}>
              Confirm Delete
            </Text>
            <Text style={{ color: "#666", marginTop: 8, textAlign: "center" }}>
              Are you sure you want to delete this watering schedule?
            </Text>
            <View style={{ flexDirection: "row", marginTop: 12 }}>
              <TouchableOpacity
                style={[styles.smallActionBtn, { backgroundColor: "#E5E7EB" }]}
                onPress={() => setConfirmDeleteWaterVisible(false)}
              >
                <Text style={[styles.smallActionText, { color: "#1F2937" }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.smallActionBtn,
                  { backgroundColor: "#22C55E", marginLeft: 8 },
                ]}
                onPress={confirmDeleteWater}
              >
                <Text style={styles.smallActionText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Duplicate Watering Time Modal */}
      <Modal
        key="duplicateWaterTimeModal"
        visible={showDuplicateWaterModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDuplicateWaterModal(false)}
      >
        <View style={styles.popupBackground}>
          <View style={styles.popupBox}>
            <Text style={{ fontWeight: "700", fontSize: 16 }}>
              Duplicate time
            </Text>
            <Text style={{ color: "#666", marginTop: 8, textAlign: "center" }}>
              That watering time already exists. Please choose a different time.
            </Text>
            <TouchableOpacity
              style={[
                styles.smallActionBtn,
                { backgroundColor: PRIMARY, marginTop: 12 },
              ]}
              onPress={() => setShowDuplicateWaterModal(false)}
            >
              <Text style={styles.smallActionText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Confirm Watering Add Modal */}
      <Modal
        key="confirmWaterAddModal"
        visible={confirmWaterAddVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmWaterAddVisible(false)}
      >
        <View style={styles.popupBackground}>
          <View style={styles.popupBox}>
            <Text style={{ fontWeight: "700", fontSize: 16 }}>
              Save watering time?
            </Text>
            <Text style={{ color: "#666", marginTop: 8, textAlign: "center" }}>
              Are you sure you want to save{" "}
              {pendingWaterTime ? fmtTime(pendingWaterTime) : ""} as a watering
              schedule?
            </Text>
            <View style={{ flexDirection: "row", marginTop: 12 }}>
              <TouchableOpacity
                style={[styles.smallActionBtn, { backgroundColor: "#e5e7eb" }]}
                onPress={() => {
                  setConfirmWaterAddVisible(false);
                  setPendingWaterTime(null);
                }}
              >
                <Text style={[styles.smallActionText, { color: "#334155" }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.smallActionBtn,
                  { backgroundColor: "#22c55e", marginLeft: 8 },
                ]}
                onPress={confirmAddWater}
              >
                <Text style={styles.smallActionText}>Yes, Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Save popup */}
      <Modal
        key="savePopupModal"
        visible={showSavedPopup}
        transparent
        animationType="fade"
      >
        <View style={styles.popupBackground}>
          <View style={styles.popupBox}>
            <Ionicons name="checkmark-circle" size={56} color="#22c55e" />
            <Text style={styles.popupText}>{popupMessage}</Text>
          </View>
        </View>
      </Modal>

      {/* Motor Warning Modal */}
      <Modal
        key="motorWarningModal"
        visible={motorWarningModal.visible}
        transparent
        animationType="fade"
      >
        <View style={styles.popupBackground}>
          <View style={styles.motorWarningBox}>
            <View style={styles.warningIconContainer}>
              <Ionicons name="warning" size={40} color="#FFC107" />
            </View>
            <Text style={styles.motorWarningTitle}>
              {motorWarningModal.title}
            </Text>
            <Text style={styles.motorWarningMessage}>
              {motorWarningModal.message}
            </Text>
            <TouchableOpacity
              style={styles.motorWarningButton}
              onPress={hideMotorWarning}
            >
              <Text style={styles.motorWarningButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Test Lighting Modal */}
      <Modal
        key="testLightingModal"
        visible={testLightingModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setTestLightingModalVisible(false)}
      >
        <View style={styles.popupBackground}>
          <View
            style={[styles.popupBox, { width: 320, alignItems: "stretch" }]}
          >
            {/* Header with Close Button */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <Text style={{ fontWeight: "700", fontSize: 16 }}>
                Test Lighting
              </Text>
              <TouchableOpacity
                onPress={() => setTestLightingModalVisible(false)}
                style={{ padding: 4 }}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Toggle Button */}
            <TouchableOpacity
              style={[
                styles.primaryBtn,
                {
                  marginTop: 10,
                  backgroundColor: testLightOn ? "#4CAF50" : "#F44336",
                },
              ]}
              onPress={() => handleTestLightToggle(!testLightOn)}
            >
              <Text style={styles.primaryBtnText}>
                {testLightOn ? "ON" : "OFF"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ---------------- helpers ---------------- */
function StatCard({
  label,
  value,
  subValue,
  icon,
  color,
  dotColor,
  loading,
  isSimulated,
  fullWidth,
}) {
  return (
    <View
      style={[
        styles.statCard,
        fullWidth ? { width: "100%" } : { width: "48%" },
      ]}
    >
      <View
        style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}
      >
        {icon && (
          <Ionicons
            name={icon}
            size={18}
            color={color || dotColor}
            style={{ marginRight: 6 }}
          />
        )}
        {!icon && <View style={[styles.dot, { backgroundColor: dotColor }]} />}
        <Text style={{ fontSize: 13, color: "#666", fontWeight: "600" }}>
          {label}
        </Text>
      </View>
      {loading ? (
        <ActivityIndicator size="small" color={PRIMARY} />
      ) : (
        <>
          <Text style={{ fontSize: 20, fontWeight: "700", color: "#333" }}>
            {value}
          </Text>
          {subValue && (
            <Text
              style={{
                fontSize: 11,
                color: subValue.includes("Full") ? RED : "#999",
                marginTop: 2,
              }}
            >
              {subValue}
            </Text>
          )}
        </>
      )}
    </View>
  );
}

function CardHeader({ icon, title, rightText }) {
  return (
    <View style={styles.cardHeader}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Ionicons
          name={icon}
          size={24}
          color={PRIMARY}
          style={{ marginRight: 12 }}
        />
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      {rightText ? (
        <Text style={styles.cardRightValue}>{rightText}</Text>
      ) : null}
    </View>
  );
}

/* ---------------- STYLES ---------------- */
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F4F6FA" },
  container: { flex: 1, paddingHorizontal: 14 },

  pageTitle: { fontSize: 14, color: PRIMARY, fontWeight: "700", marginTop: 14 },

  // Sensor status banner
  sensorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF3CD",
    borderColor: "#FFEEBA",
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 8,
    marginBottom: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  sensorBannerText: {
    color: "#856404",
    fontSize: 12,
    marginLeft: 8,
    flex: 1,
  },

  statCard: {
    minHeight: 85,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#ffff",
    marginVertical: 6,
    padding: 12,
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  statLeft: { flexDirection: "row", alignItems: "center" },
  dot: { width: 10, height: 10, borderRadius: 6, marginRight: 10 },
  statLabel: { fontSize: 15, fontWeight: "600", color: "#333" },
  simulatedLabel: { fontSize: 10, color: "#856404", fontStyle: "italic" },
  statRight: { alignItems: "flex-end" },
  statBox: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderLeftWidth: 4,
    borderRadius: 8,
    backgroundColor: "#fff",
  },
  statValue: { color: PRIMARY, fontWeight: "700", fontSize: 16 },

  rowCenter: { alignItems: "center" },

  card: {
    marginTop: 12,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },

  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    minHeight: 36,
  },
  cardTitle: { fontSize: 16, fontWeight: "700", color: PRIMARY },
  cardRightValue: { fontWeight: "700", color: PRIMARY },

  cameraBox: {
    marginTop: 10,
    borderRadius: 8,
    overflow: "visible",
  },

  smallNote: { color: "#666", marginTop: 6 },
  innerBox: {
    marginTop: 10,
    padding: 12,
    borderRadius: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },

  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  statusLabel: {
    fontSize: 12,
    color: "#666",
    fontWeight: "600",
  },
  statusValue: {
    fontSize: 12,
    color: "#666",
    fontWeight: "600",
  },

  rowSpace: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  timeInput: {
    marginTop: 6,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  timeText: { fontWeight: "700", color: "#333" },
  smallLabel: { color: "#444", fontSize: 13 },

  feedRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  feedTimeText: {
    fontWeight: "600",
    fontSize: 14,
    color: "#333",
  },
  editBtn: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  editText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  checkboxChecked: { backgroundColor: RED, borderColor: RED },

  dateBox: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    width: "72%",
    alignItems: "center",
  },
  smallBtn: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },

  upcomingBox: {
    marginTop: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
  },
  primaryBtn: {
    backgroundColor: PRIMARY,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "700" },

  smallActionBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  smallActionText: { color: "#fff", fontWeight: "700", fontSize: 13 },

  logItem: {
    backgroundColor: "#BDCBE421",
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },

  actionBtn: {
    backgroundColor: PRIMARY,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  actionBtnDisabled: {
    backgroundColor: "#999",
    opacity: 0.7,
  },
  actionText: { color: "#fff", fontWeight: "700" },

  // Test Device buttons - blue border only, smaller
  testBtn: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  testBtnDisabled: {
    borderColor: "#e2e8f0",
    opacity: 0.7,
  },
  testBtnText: {
    color: PRIMARY,
    fontWeight: "600",
    fontSize: 13,
  },

  // modals
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  editModal: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    padding: 16,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    elevation: 10,
  },
  fullScreenCameraModal: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  closeButton: {
    position: "absolute",
    top: Platform.OS === "ios" ? 50 : 20,
    right: 20,
    zIndex: 999,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 20,
  },
  fullScreenCameraContainer: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  fullScreenModal: {
    flex: 1,
    backgroundColor: "#fff",
    paddingTop: Platform.OS === "ios" ? 50 : 20,
    paddingHorizontal: 16,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  cameraStreamContainer: {
    flex: 1,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: "row",
    marginBottom: 12,
  },
  serverInputContainer: {
    padding: 12,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    marginBottom: 16,
  },
  modalTitle: { fontWeight: "700", fontSize: 16, marginBottom: 8 },
  formInput: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 10,
    marginTop: 6,
    backgroundColor: "#fff",
  },

  popupBackground: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  popupBox: {
    backgroundColor: "#fff",
    padding: 22,
    borderRadius: 12,
    alignItems: "center",
  },
  popupText: { marginTop: 10, fontSize: 16, fontWeight: "700", color: GREEN },

  // power bar
  powerBarContainer: {
    width: 270,
    height: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#eee",
    overflow: "hidden",
    marginTop: 8,
  },
  powerBarFill: {
    height: "100%",
    backgroundColor: YELLOW,
    borderRadius: 8,
  },

  // Motor Warning Modal styles
  motorWarningBox: {
    backgroundColor: "#fff",
    padding: 24,
    borderRadius: 16,
    alignItems: "center",
    width: "85%",
    maxWidth: 340,
  },
  warningIconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#FFF8E1",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  motorWarningTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
    marginBottom: 12,
    textAlign: "center",
  },
  motorWarningMessage: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  motorWarningButton: {
    backgroundColor: PRIMARY,
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 8,
  },
  motorWarningButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
