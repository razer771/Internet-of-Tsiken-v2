// screensample/ControlScreen.js
import React, { useState, useEffect, useCallback } from "react";
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
} from "../../../modules/ServoMotorService";
import CameraStream from "../../../modules/CameraStream";

const PRIMARY = "#133E87";
const GREEN = "#249D1D";
const RED = "#D70E11";
const YELLOW = "#DFB118";
const BORDER_OVERLAY = "#0D609C73";

export default function ControlScreen({ navigation }) {
  // side menu
  const [menuOpen, setMenuOpen] = useState(false);

  // realtime sensor data
  const [waterNow, setWaterNow] = useState(0);
  const [feederNow, setFeederNow] = useState(0);
  const [sensorLoading, setSensorLoading] = useState(true);
  const [sensorError, setSensorError] = useState(null);
  const [isSimulated, setIsSimulated] = useState(true);

  // Lighting and Ventilation controls
  const [lightOn, setLightOn] = useState(false);
  const [fanOn, setFanOn] = useState(false);

  // night schedule (time)
  const [nightStart, setNightStart] = useState(new Date());
  const [showNightPicker, setShowNightPicker] = useState(false);

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
        console.log('Sensor initialization:', initResult);
        
        // Get initial readings
        const readings = await getAllSensorReadings();
        updateSensorValues(readings);
        
        // Start polling for continuous updates (every 5 seconds)
        stopPolling = startSensorPolling((readings) => {
          updateSensorValues(readings);
        }, 5000);
        
      } catch (error) {
        console.error('Sensor initialization error:', error);
        setSensorError('Failed to initialize sensors. Using simulated data.');
        setIsSimulated(true);
        // Set default values on error
        setWaterNow(85);
        setFeederNow(62);
      } finally {
        setSensorLoading(false);
      }
    };

    initSensors();

    // Cleanup polling on unmount
    return () => {
      if (stopPolling) {
        stopPolling();
      }
    };
  }, []);

  // Update sensor values from readings
  const updateSensorValues = useCallback((readings) => {
    if (readings) {
      // Update water level
      if (readings.water) {
        setWaterNow(readings.water.level || 0);
        if (readings.water.isSimulated) {
          setIsSimulated(true);
        }
        if (readings.water.error || readings.water.warning) {
          setSensorError(readings.water.error || readings.water.warning);
        }
      }
      
      // Update feeder level
      if (readings.feeder) {
        setFeederNow(readings.feeder.level || 0);
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
      const user = auth.currentUser;
      if (!user) return;

      const feedsSnapshot = await getDocs(collection(db, "feeds"));
      const loadedFeeds = [];
      feedsSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.userId === user.uid) {
          loadedFeeds.push({
            id: data.feedId,
            label: data.label,
            time: data.time,
          });
        }
      });

      // Sort by time
      loadedFeeds.sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
      setFeeds(loadedFeeds);
    } catch (err) {
      console.error("Failed to load feeds:", err);
    }
  };

  const loadWateringScheduleFromFirestore = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const wateringSnapshot = await getDocs(
        collection(db, "wateringSchedules")
      );
      wateringSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.userId === user.uid) {
          // Load the most recent schedule
          const loadedDate = data.date ? new Date(data.date) : new Date();
          const loadedTime = data.time ? new Date(data.time) : new Date();
          setWaterDate(loadedDate);
          setWaterTime(loadedTime);
          setLiters(data.liters);
          setDuration(data.duration);
          // Set confirmed values for display
          setConfirmedWaterDate(loadedDate);
          setConfirmedWaterTime(loadedTime);
        }
      });
    } catch (err) {
      console.error("Failed to load watering schedule:", err);
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

  // water schedule
  const [waterDate, setWaterDate] = useState(new Date());
  const [showWaterDatePicker, setShowWaterDatePicker] = useState(false);
  const [waterTime, setWaterTime] = useState(new Date());
  const [showWaterTimePicker, setShowWaterTimePicker] = useState(false);
  const [liters, setLiters] = useState(30);
  const [duration, setDuration] = useState(30);
  // watering schedule confirmation
  const [confirmWaterSaveVisible, setConfirmWaterSaveVisible] = useState(false);
  const [pendingWaterSchedule, setPendingWaterSchedule] = useState(null);
  const [showInvalidScheduleModal, setShowInvalidScheduleModal] =
    useState(false);
  // confirmed schedule for display (only updates after save)
  const [confirmedWaterDate, setConfirmedWaterDate] = useState(null);
  const [confirmedWaterTime, setConfirmedWaterTime] = useState(null);

  // popups
  const [showSavedPopup, setShowSavedPopup] = useState(false);

  // camera placeholder modal
  const [cameraModal, setCameraModal] = useState(false);
  
  // Camera server auto-discovery - no user input needed!
  const [cameraServerUrl, setCameraServerUrl] = useState("http://rpi5desktop.local:5000");
  const [showServerInput, setShowServerInput] = useState(false);
  
  // Callback when camera server is auto-discovered
  const handleServerDiscovered = (discoveredUrl) => {
    console.log('📡 Auto-discovered camera server:', discoveredUrl);
    setCameraServerUrl(discoveredUrl);
    // Don't show settings - it worked automatically!
  };

  // power schedule
  const [alertThreshold, setAlertThreshold] = useState(30);
  const [autoPower, setAutoPower] = useState(false);

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
    })
  ).current;

  // Handlers
  const addFeedSchedule = () => {
    // Open time picker for user to select feeding time
    setShowFeedAddPicker(true);
  };

  // Convert time string "hh:mm AM/PM" to minutes since midnight for sorting
  const timeToMinutes = (timeStr) => {
    const parts = timeStr.split(/[: ]/);
    if (parts.length < 3) return 0;
    let hour = parseInt(parts[0], 10);
    const minute = parseInt(parts[1], 10);
    const ampm = parts[2].toUpperCase();
    if (ampm === "PM" && hour !== 12) hour += 12;
    if (ampm === "AM" && hour === 12) hour = 0;
    return hour * 60 + minute;
  };

  const confirmAddFeed = async () => {
    if (!pendingFeedTime) {
      setConfirmFeedSaveVisible(false);
      setShowFeedAddPicker(false);
      return;
    }
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
        await setDoc(doc(db, "feeds", `${user.uid}_${nextId}`), {
          feedId: nextId,
          label: label,
          time: formattedTime,
          userId: user.uid,
          timestamp: new Date().toISOString(),
        });

        // Log to addFeedSchedule collection
        await addDoc(collection(db, "addFeedSchedule_logs"), {
          feedId: nextId,
          userId: user.uid,
          userName: user.displayName || user.email || "Unknown User",
          firstName: firstName,
          lastName: lastName,
          selectedTime: pendingFeedTime.toISOString(),
          selectedTimeFormatted: formattedTime,
          newTime: formattedTime,
          timestamp: new Date().toISOString(),
          action: "Add new feeding schedule",
          description: `Added ${formattedTime}`,
        });
      }
    } catch (err) {
      Alert.alert("Error", "Failed to save feed: " + err.message);
      setConfirmFeedSaveVisible(false);
      setShowFeedAddPicker(false);
      setPendingFeedTime(null);
      return;
    }

    // Add and sort by time
    setFeeds((s) => {
      const updated = [...s, newFeed];
      return updated.sort(
        (a, b) => timeToMinutes(a.time) - timeToMinutes(b.time)
      );
    });

    // Close all related modals
    setConfirmFeedSaveVisible(false);
    setShowFeedAddPicker(false);
    setPendingFeedTime(null);
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
      { cancelable: true }
    );
  };

  const confirmDeleteAll = () => {
    setFeeds([]);
    setDeleteMode(false);
    setSelectedToDelete([]);
    setConfirmDeleteVisible(false);
    // show brief popup
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
        "Please select at least one schedule to delete."
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
          onPress: () => {
            setFeeds((s) => s.filter((f) => !selectedToDelete.includes(f.id)));
            setDeleteMode(false);
            setSelectedToDelete([]);
            setShowSavedPopup(true);
            setTimeout(() => setShowSavedPopup(false), 1200);
          },
        },
      ],
      { cancelable: true }
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
    if (feedEdit.idx === null) {
      setConfirmEditVisible(false);
      setFeedEdit({ open: false, idx: null, timeDate: new Date() });
      return;
    }
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
        await setDoc(doc(db, "feeds", `${user.uid}_${feedId}`), {
          feedId: feedId,
          label: feeds[feedEdit.idx].label,
          time: newTime,
          userId: user.uid,
          timestamp: new Date().toISOString(),
        });

        // Log to editFeedSchedule collection
        await addDoc(collection(db, "editFeedSchedule_logs"), {
          feedId: feedId,
          userId: user.uid,
          userName: user.displayName || user.email || "Unknown User",
          firstName: firstName,
          lastName: lastName,
          oldTime,
          newTime,
          selectedTime: feedEdit.timeDate.toISOString(),
          selectedTimeFormatted: newTime,
          timestamp: new Date().toISOString(),
          action: "Updated feeding time",
          description: `From ${oldTime} to ${newTime}`,
        });
      }
    } catch (err) {
      Alert.alert("Error", "Failed to update feed: " + err.message);
      setConfirmEditVisible(false);
      setFeedEdit({ open: false, idx: null, timeDate: new Date() });
      return;
    }

    // Update local state and sort
    setFeeds((s) => {
      const copy = [...s];
      copy[feedEdit.idx].time = newTime;
      return copy.sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
    });

    // Close all related modals
    setConfirmEditVisible(false);
    setFeedEdit({ open: false, idx: null, timeDate: new Date() });
    setShowSavedPopup(true);
    setTimeout(() => setShowSavedPopup(false), 1400);
  };

  const confirmDeleteFeed = async () => {
    if (!pendingDeleteFeedId) {
      setConfirmDeleteFeedVisible(false);
      setPendingDeleteFeedId(null);
      return;
    }

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
        await deleteDoc(doc(db, "feeds", `${user.uid}_${pendingDeleteFeedId}`));

        // Log delete activity in deleteFeedSchedule collection
        await addDoc(collection(db, "deleteFeedSchedule_logs"), {
          feedId: pendingDeleteFeedId,
          userId: user.uid,
          userName: user.displayName || user.email || "Unknown User",
          firstName: firstName,
          lastName: lastName,
          oldTime: feedToDelete.time,
          timestamp: new Date().toISOString(),
          action: "Deleted a feeding schedule",
          description: `Deleted ${feedToDelete.time}`,
        });
      }
    } catch (err) {
      Alert.alert("Error", "Failed to delete feed: " + err.message);
      // Close modal even on error
      setConfirmDeleteFeedVisible(false);
      setPendingDeleteFeedId(null);
      return;
    }

    // Update local state
    setFeeds((s) => s.filter((feed) => feed.id !== pendingDeleteFeedId));

    // Close modal and cleanup
    setConfirmDeleteFeedVisible(false);
    setPendingDeleteFeedId(null);
    setShowSavedPopup(true);
    setTimeout(() => setShowSavedPopup(false), 1200);
  };

  // State for manual action operations
  const [isDispensing, setIsDispensing] = useState(false);
  const [isSprinklerActive, setIsSprinklerActive] = useState(false);
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
      
      const result = await dispenseFeed();
      
      if (result.success) {
        // Show warning modal if simulated
        if (result.isSimulated && result.warning) {
          showMotorWarning(
            "Motor Not Detected",
            result.warning + "\n\nThe operation was simulated."
          );
        }
      } else {
        showMotorWarning("Dispense Error", result.error || "Failed to dispense feed.");
      }
    } catch (error) {
      console.error("Dispense error:", error);
      showMotorWarning("Error", "Feed dispenser motor not detected. Please check the connection.");
    } finally {
      setIsDispensing(false);
    }
  };

  const handleSprinkler = async () => {
    try {
      setIsSprinklerActive(true);
      setServoError(null);
      
      const result = await activateSprinkler();
      
      if (result.success) {
        // Show warning modal if simulated
        if (result.isSimulated && result.warning) {
          showMotorWarning(
            "Motor Not Detected",
            result.warning + "\n\nThe operation was simulated."
          );
        }
      } else {
        showMotorWarning("Sprinkler Error", result.error || "Failed to activate sprinkler.");
      }
    } catch (error) {
      console.error("Sprinkler error:", error);
      showMotorWarning("Error", "Water sprinkler motor not detected. Please check the connection.");
    } finally {
      setIsSprinklerActive(false);
    }
  };

  const saveWaterSchedule = () => {
    // Validate past time
    const scheduledDateTime = new Date(waterDate);
    scheduledDateTime.setHours(
      waterTime.getHours(),
      waterTime.getMinutes(),
      0,
      0
    );

    if (scheduledDateTime.getTime() < Date.now()) {
      setShowInvalidScheduleModal(true);
      return;
    }

    // Store pending schedule and show confirmation modal
    setPendingWaterSchedule({
      date: waterDate.toISOString(),
      time: waterTime.toISOString(),
      liters,
      duration,
    });
    setConfirmWaterSaveVisible(true);
  };

  const confirmSaveWaterSchedule = async () => {
    if (!pendingWaterSchedule) {
      setConfirmWaterSaveVisible(false);
      return;
    }

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

        // Log to wateringActivityLogs collection
        // Convert scheduledTime to GMT+8 and format
        const scheduledTimeDate = new Date(pendingWaterSchedule.time);
        const gmt8Time = new Date(
          scheduledTimeDate.getTime() + 8 * 60 * 60 * 1000
        );
        const hours = gmt8Time.getUTCHours();
        const minutes = gmt8Time.getUTCMinutes();
        const ampm = hours >= 12 ? "PM" : "AM";
        const hour12 = hours % 12 || 12;
        const timeFormatted = `${hour12}:${minutes.toString().padStart(2, "0")} ${ampm}`;

        await addDoc(collection(db, "wateringActivity_logs"), {
          userId: user.uid,
          userName: user.displayName || user.email || "Unknown User",
          scheduledDate: pendingWaterSchedule.date,
          scheduledTime: pendingWaterSchedule.time,
          liters: pendingWaterSchedule.liters,
          duration: pendingWaterSchedule.duration,
          timestamp: new Date().toISOString(),
          action: "New watering schedule",
          description: `Watering schedule : Duration: ${pendingWaterSchedule.duration}, Liters: ${pendingWaterSchedule.liters}, Time : ${timeFormatted}`,
        });

        // Update confirmed display values after successful save
        setConfirmedWaterDate(pendingWaterSchedule.date ? new Date(pendingWaterSchedule.date) : new Date());
        setConfirmedWaterTime(pendingWaterSchedule.time ? new Date(pendingWaterSchedule.time) : new Date());
      }
    } catch (err) {
      Alert.alert("Error", "Failed to save watering schedule: " + err.message);
      setConfirmWaterSaveVisible(false);
      setPendingWaterSchedule(null);
      return;
    }

    setConfirmWaterSaveVisible(false);
    setPendingWaterSchedule(null);
    setShowSavedPopup(true);
    setTimeout(() => setShowSavedPopup(false), 1400);
  };
  // helpers
  const fmtDate = (d) => d.toISOString().split("T")[0];
  const fmtTime = (d) =>
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const saveNightTimeLog = async (time) => {
    try {
      const user = auth.currentUser;
      if (!user) return;

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

      await addDoc(collection(db, "nightTime_logs"), {
        userId: user.uid,
        userName: user.displayName || user.email || "Unknown User",
        firstName: firstName,
        lastName: lastName,
        selectedTime: time.toISOString(),
        selectedTimeGMT8Formatted: selectedTimeGMT8Formatted,
        timestamp: new Date().toISOString(),
        action: "Set the night time",
        description: `Night time starts at ${timeOnly}`,
      });

      setShowSavedPopup(true);
      setTimeout(() => setShowSavedPopup(false), 1400);
    } catch (err) {
      Alert.alert("Error", err.message);
    }
  };

  // power bar width calculation (we'll map alertThreshold 0-100 to width)
  const powerBarWidth = (percent) => {
    // base width in style is 270; map percent to that width
    const max = 270;
    return (percent / 100) * max;
  };

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
              Sensor module not detected. Using simulated data.
            </Text>
          </View>
        )}

        {/* Real-time cards */}
        <View style={styles.rowCenter}>
          <StatCard
            label="Water Level"
            value={sensorLoading ? "..." : `${waterNow}%`}
            dotColor={isSimulated ? "#FFC107" : "#4CAF50"}
            loading={sensorLoading}
            isSimulated={isSimulated}
          />
          <StatCard
            label="Feeder Level"
            value={sensorLoading ? "..." : `${feederNow}%`}
            dotColor={isSimulated ? "#FFC107" : "#2196F3"}
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
          <TouchableOpacity
            style={styles.cameraBox}
            onPress={() => setCameraModal(true)}
            activeOpacity={0.8}
          >
            <CameraStream 
              serverUrl={cameraServerUrl}
              onServerDiscovered={handleServerDiscovered}
            />
          </TouchableOpacity>
        </View>

        {/* Night Schedule */}
        <View style={[styles.card, { borderColor: BORDER_OVERLAY }]}>
          <CardHeader icon="moon-outline" title="Night Schedule" />
          <View style={styles.rowSpace}>
            <View style={{ flex: 1 }}>
              <Text style={styles.smallLabel}>Night Time Start</Text>
              <TouchableOpacity
                style={styles.timeInput}
                onPress={() => setShowNightPicker(true)}
              >
                <Text style={styles.timeText}>{fmtTime(nightStart)}</Text>
                <Ionicons name="time-outline" size={18} color={PRIMARY} />
              </TouchableOpacity>
            </View>
          </View>
          <Text style={[styles.smallNote, { marginTop: 8 }]}>
            Solar power will activate at this time
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
              <View key={f.id} style={styles.feedRow}>
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
                        <Text style={{ color: "#fff" }}>✓</Text>
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

        {/* Water Scheduling */}
        <View style={[styles.card, { borderColor: BORDER_OVERLAY }]}>
          <CardHeader icon="water-outline" title="Watering Schedule" />
          <View style={styles.rowSpace}>
            <TouchableOpacity
              style={[styles.dateBox, { backgroundColor: "#7C8CA821" }]}
              onPress={() => setShowWaterDatePicker(true)}
            >
              <Text style={{ fontWeight: "600" }}>{fmtDate(waterDate)}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.smallBtn}
              onPress={() => setShowWaterDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={20} color="#333" />
            </TouchableOpacity>
          </View>

          <View style={{ marginTop: 12 }}>
            <Text style={styles.smallLabel}>Watering Time</Text>
            <TouchableOpacity
              style={[styles.timeInput, { marginTop: 6 }]}
              onPress={() => setShowWaterTimePicker(true)}
            >
              <Text>{fmtTime(waterTime)}</Text>
            </TouchableOpacity>

            <Text style={[styles.smallLabel, { marginTop: 8 }]}>
              Liters: {liters}L
            </Text>
            <Slider
              minimumValue={1}
              maximumValue={60}
              step={1}
              value={liters}
              onValueChange={setLiters}
              minimumTrackTintColor={PRIMARY}
            />

            <Text style={[styles.smallLabel, { marginTop: 8 }]}>
              Duration (seconds): {duration}s
            </Text>
            <Slider
              minimumValue={5}
              maximumValue={120}
              step={1}
              value={duration}
              onValueChange={setDuration}
              minimumTrackTintColor={PRIMARY}
            />

            <View
              style={[
                styles.upcomingBox,
                { backgroundColor: "#BDCBE421", borderColor: "#0D609C54" },
              ]}
            >
              <Text>
                {confirmedWaterDate && confirmedWaterTime
                  ? `Upcoming schedule : ${fmtDate(confirmedWaterDate)} at ${fmtTime(confirmedWaterTime)}`
                  : "No upcoming schedule"}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, { marginTop: 10 }]}
              onPress={() => {
                saveWaterSchedule();
              }}
            >
              <Text style={styles.primaryBtnText}>Save schedule</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Test Devices */}
        <View style={[styles.card, { borderColor: BORDER_OVERLAY }]}>
          <Text style={styles.cardTitle}>Test Devices</Text>
          <Text style={[styles.smallNote, { fontSize: 11 }]}>Check if the devices are working properly.</Text>

          <TouchableOpacity 
            style={[styles.testBtn, { marginTop: 8 }, isDispensing && styles.testBtnDisabled]} 
            onPress={handleDispense}
            disabled={isDispensing}
          >
            {isDispensing ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <ActivityIndicator size="small" color={PRIMARY} style={{ marginRight: 8 }} />
                <Text style={styles.testBtnText}>Dispensing...</Text>
              </View>
            ) : (
              <Text style={styles.testBtnText}>Test Feeding</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.testBtn, { marginTop: 10 }, isSprinklerActive && styles.testBtnDisabled]}
            onPress={handleSprinkler}
            disabled={isSprinklerActive}
          >
            {isSprinklerActive ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <ActivityIndicator size="small" color={PRIMARY} style={{ marginRight: 8 }} />
                <Text style={styles.testBtnText}>Activating...</Text>
              </View>
            ) : (
              <Text style={styles.testBtnText}>Test Hydro Defense Mechanism</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Lighting & Ventilation */}
        <View style={[styles.card, { borderColor: BORDER_OVERLAY }]}>
          <CardHeader icon="bulb-outline" title="Lighting & Ventilation" />
          <View
            style={[
              styles.innerBox,
              { marginTop: 8, borderColor: BORDER_OVERLAY },
            ]}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons
                name="sunny-outline"
                size={18}
                color="#333"
                style={{ marginRight: 8 }}
              />
              <Text style={{ fontWeight: "600" }}>Incandescent Light</Text>
            </View>
            <Switch
              value={lightOn}
              onValueChange={setLightOn}
              trackColor={{ false: "#B0B0B0", true: PRIMARY }}
              ios_backgroundColor="#B0B0B0"
              thumbColor="#fff"
            />
          </View>
          <View
            style={[
              styles.innerBox,
              { marginTop: 8, borderColor: BORDER_OVERLAY },
            ]}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons
                name="sync-outline"
                size={18}
                color="#333"
                style={{ marginRight: 8 }}
              />
              <Text style={{ fontWeight: "600" }}>Exhaust Fan</Text>
            </View>
            <Switch
              value={fanOn}
              onValueChange={setFanOn}
              trackColor={{ false: "#B0B0B0", true: PRIMARY }}
              ios_backgroundColor="#B0B0B0"
              thumbColor="#fff"
            />
          </View>
        </View>
        {/* Power Schedule */}
        <View style={[styles.card, { borderColor: BORDER_OVERLAY }]}>
          <CardHeader
            icon="flash-outline"
            title="Power Schedule"
            rightText={"62%"}
          />

          <View style={{ marginTop: 8 }}>
            <Text style={styles.smallLabel}>Solar power level</Text>

            {/* Horizontal bar container (looks like the requested layout) */}
            <View style={styles.powerBarContainer}>
              <View
                style={[
                  styles.powerBarFill,
                  { width: powerBarWidth(alertThreshold) },
                ]}
              />
            </View>

            <Text style={[styles.smallNote, { marginTop: 8 }]}>
              Moderate Power - Monitor closely
            </Text>

            <Text style={[styles.smallLabel, { marginTop: 12 }]}>
              Alert threshold (%) {alertThreshold}%
            </Text>
            <Slider
              minimumValue={0}
              maximumValue={100}
              step={1}
              value={alertThreshold}
              onValueChange={setAlertThreshold}
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

        {/* Continue / Pause */}
        <View style={{ marginHorizontal: 14, marginTop: 14 }}>
          <TouchableOpacity
            style={[styles.continueBtn]}
            onPress={() => Alert.alert("Continue", "Continue operations")}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>
              Continue Operations
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.pauseBtn]}
            onPress={() => Alert.alert("Pause", "Paused non-critical tasks")}
          >
            <Text style={{ fontWeight: "700" }}>Pause non-critical tasks</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* Date / Time Pickers */}
      {showWaterDatePicker && (
        <DateTimePicker
          value={waterDate}
          mode="date"
          display="default"
          minimumDate={new Date()}
          onChange={(_, selected) => {
            setShowWaterDatePicker(false);
            if (selected) setWaterDate(selected);
          }}
        />
      )}
      {showWaterTimePicker && (
        <DateTimePicker
          value={waterTime}
          mode="time"
          display="default"
          onChange={(_, selected) => {
            setShowWaterTimePicker(false);
            if (selected) setWaterTime(selected);
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

      {/* Feed Edit Modal (time picker like night schedule) */}
      <Modal
        key="feedEditModal"
        visible={feedEdit.open}
        transparent
        animationType="slide"
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          onPress={() =>
            setFeedEdit({ open: false, idx: null, timeDate: new Date() })
          }
        />
        <View style={styles.editModal}>
          <Text
            style={[
              styles.modalTitle,
              { textAlign: "center", fontWeight: "bold" },
            ]}
          >
            Edit Feeding Time
          </Text>

          <TouchableOpacity
            style={[styles.timeInput, { marginTop: 6 }]}
            onPress={() => setShowFeedTimePicker(true)}
          >
            <Text style={styles.timeText}>
              {feedEdit.timeDate ? fmtTime(feedEdit.timeDate) : "Select time"}
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
                { backgroundColor: "#999", flex: 1, marginRight: 6 },
              ]}
              onPress={() =>
                setFeedEdit({ open: false, idx: null, timeDate: new Date() })
              }
            >
              <Text style={styles.primaryBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryBtn, { flex: 1 }]}
              onPress={() => {
                // Check for duplicate before showing confirm modal
                if (feedEdit.idx !== null) {
                  const newTime = feedEdit.timeDate.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  const isDuplicate = feeds.some(
                    (f, i) => i !== feedEdit.idx && f.time === newTime
                  );
                  if (isDuplicate) {
                    // Keep edit modal open, just show duplicate error
                    setShowDuplicateModal(true);
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
                style={[styles.smallActionBtn, { backgroundColor: "#999" }]}
                onPress={() => setConfirmDeleteVisible(false)}
              >
                <Text style={styles.smallActionText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.smallActionBtn,
                  { backgroundColor: RED, marginLeft: 8 },
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
                style={[styles.smallActionBtn, { backgroundColor: "#999" }]}
                onPress={() => {
                  setConfirmFeedSaveVisible(false);
                  setShowFeedAddPicker(false);
                  setPendingFeedTime(null);
                }}
              >
                <Text style={styles.smallActionText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.smallActionBtn,
                  { backgroundColor: PRIMARY, marginLeft: 8 },
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
                style={[styles.smallActionBtn, { backgroundColor: "#999" }]}
                onPress={() => {
                  setConfirmEditVisible(false);
                  setFeedEdit({ open: false, idx: null, timeDate: new Date() });
                }}
              >
                <Text style={styles.smallActionText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.smallActionBtn,
                  { backgroundColor: PRIMARY, marginLeft: 8 },
                ]}
                onPress={saveFeedEdit}
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
                style={[styles.smallActionBtn, { backgroundColor: "#999" }]}
                onPress={() => {
                  setConfirmDeleteFeedVisible(false);
                  setPendingDeleteFeedId(null);
                }}
              >
                <Text style={styles.smallActionText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.smallActionBtn,
                  { backgroundColor: RED, marginLeft: 8 },
                ]}
                onPress={confirmDeleteFeed}
              >
                <Text style={styles.smallActionText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Invalid Schedule Modal */}
      <Modal
        key="invalidScheduleModal"
        visible={showInvalidScheduleModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowInvalidScheduleModal(false)}
      >
        <View style={styles.popupBackground}>
          <View style={styles.popupBox}>
            <Text style={{ fontWeight: "700", fontSize: 16 }}>
              Invalid Schedule
            </Text>
            <Text style={{ color: "#666", marginTop: 8, textAlign: "center" }}>
              You cannot choose a past date or time.
            </Text>
            <TouchableOpacity
              style={[
                styles.smallActionBtn,
                { backgroundColor: PRIMARY, marginTop: 12 },
              ]}
              onPress={() => setShowInvalidScheduleModal(false)}
            >
              <Text style={styles.smallActionText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Confirm Watering Schedule Modal */}
      <Modal
        key="confirmWaterSaveModal"
        visible={confirmWaterSaveVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmWaterSaveVisible(false)}
      >
        <View style={styles.popupBackground}>
          <View style={styles.popupBox}>
            <Text style={{ fontWeight: "700", fontSize: 16 }}>
              Confirm Watering Schedule
            </Text>
            <Text style={{ color: "#666", marginTop: 8, textAlign: "center" }}>
              Do you want to save this watering schedule?
            </Text>
            <View style={{ flexDirection: "row", marginTop: 12 }}>
              <TouchableOpacity
                style={[styles.smallActionBtn, { backgroundColor: "#999" }]}
                onPress={() => {
                  setConfirmWaterSaveVisible(false);
                  setPendingWaterSchedule(null);
                }}
              >
                <Text style={styles.smallActionText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.smallActionBtn,
                  { backgroundColor: PRIMARY, marginLeft: 8 },
                ]}
                onPress={confirmSaveWaterSchedule}
              >
                <Text style={styles.smallActionText}>Confirm</Text>
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
            <Image
              source={require("../../../assets/logo.png")}
              style={{ width: 56, height: 56 }}
            />
            <Text style={styles.popupText}>Saved Successfully!</Text>
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
            <Text style={styles.motorWarningTitle}>{motorWarningModal.title}</Text>
            <Text style={styles.motorWarningMessage}>{motorWarningModal.message}</Text>
            <TouchableOpacity
              style={styles.motorWarningButton}
              onPress={hideMotorWarning}
            >
              <Text style={styles.motorWarningButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ---------------- helpers ---------------- */
function StatCard({ label, value, dotColor, loading, isSimulated }) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statLeft}>
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
        <View>
          <Text style={styles.statLabel}>{label}</Text>
          {isSimulated && (
            <Text style={styles.simulatedLabel}>Simulated</Text>
          )}
        </View>
      </View>
      <View style={styles.statRight}>
        <View style={[styles.statBox, { borderLeftColor: isSimulated ? "#FFC107" : PRIMARY }]}>
          {loading ? (
            <ActivityIndicator size="small" color={PRIMARY} />
          ) : (
            <Text style={styles.statValue}>{value}</Text>
          )}
        </View>
      </View>
    </View>
  );
}

function CardHeader({ icon, title, rightText }) {
  return (
    <View style={styles.cardHeader}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Ionicons
          name={icon}
          size={20}
          color={PRIMARY}
          style={{ marginRight: 8 }}
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
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  sensorBannerText: {
    color: "#856404",
    fontSize: 12,
    marginLeft: 8,
    flex: 1,
  },

  statCard: {
    width: "100%",
    maxWidth: 340,
    height: 55,
    borderRadius: 8,
    borderWidth: 1,
    marginVertical: 6,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
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
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
  },

  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTitle: { fontSize: 16, fontWeight: "700", color: PRIMARY },
  cardRightValue: { fontWeight: "700", color: PRIMARY },

  cameraBox: {
    marginTop: 10,
    height: 200,
    borderRadius: 8,
    overflow: 'hidden',
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
    borderColor: "#ddd",
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
    borderColor: PRIMARY,
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
    borderColor: "#999",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  checkboxChecked: { backgroundColor: RED, borderColor: RED },

  dateBox: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    width: "72%",
    alignItems: "center",
  },
  smallBtn: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    alignItems: "center",
    justifyContent: "center",
  },

  upcomingBox: {
    marginTop: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#0D609C54",
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

  continueBtn: {
    backgroundColor: GREEN,
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 8,
  },
  pauseBtn: {
    backgroundColor: "#BDCBE421",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
  },

  logItem: {
    backgroundColor: "#BDCBE421",
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#0D609C54",
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
    borderColor: PRIMARY,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  testBtnDisabled: {
    borderColor: "#999",
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    right: 20,
    zIndex: 999,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
  },
  fullScreenCameraContainer: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
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
    borderColor: "#ddd",
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
    borderColor: "#0D609C54",
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

  // small helpers
  dateText: { fontWeight: "700" },
});
