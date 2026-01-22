import React, { useState, useEffect, useRef } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  PanResponder,
  Modal,
} from "react-native";
import QuickSetupModal from "./QuickSetupModal";
import ViewAllBatchesModal, {
  fetchBatches,
  calculateAge,
} from "./viewallbatchesModal";
import EditBatchModal from "./editbatchModal";
import ReportMortalityModal from "./ReportMortalityModal";
import Toast from "../../navigation/Toast";
import { auth, db } from "../../../config/firebaseconfig";
import {
  doc,
  getDoc,
  updateDoc,
  onSnapshot,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
} from "firebase/firestore";
import { db as firestoreDb } from "../../../config/firebaseconfig";
// Replace static import with a dynamic require + in-memory fallback.
// This avoids a crash when @react-native-async-storage/async-storage is not installed.
let AsyncStorage;
try {
  // try to require the community package (works in metro bundler environment)
  const mod = require("@react-native-async-storage/async-storage");
  AsyncStorage = mod && mod.default ? mod.default : mod;
} catch (e) {
  console.warn(
    "[AsyncStorage] @react-native-async-storage/async-storage not found — using in-memory fallback. Install the package to persist data between app restarts.",
  );
  // Simple in-memory shim that mimics AsyncStorage API (not persistent across reloads)
  const _store = {};
  AsyncStorage = {
    getItem: async (key) => {
      return Object.prototype.hasOwnProperty.call(_store, key)
        ? _store[key]
        : null;
    },
    setItem: async (key, value) => {
      _store[key] = String(value);
    },
    removeItem: async (key) => {
      delete _store[key];
    },
    // optional helpers
    clear: async () => {
      Object.keys(_store).forEach((k) => delete _store[k]);
    },
  };
}

// ==================== HELPER FUNCTIONS FOR BATCH MANAGEMENT ====================

/**
 * Fetch the latest batch from Firestore
 * Query: brooderInfo collection ordered by batchNumber DESC, limit 1
 * @returns {Promise<Object|null>} Latest batch document with calculated age, or null
 */
const getLatestBatch = async () => {
  try {
    console.log("[GetLatestBatch] Fetching latest batch...");

    const q = query(
      collection(firestoreDb, "brooderInfo"),
      orderBy("batchNumber", "desc"),
      limit(1),
    );

    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      console.log("[GetLatestBatch] No batches found");
      return null;
    }

    const doc = querySnapshot.docs[0];
    const data = doc.data();

    // Skip if deleted
    if (data.deleted) {
      console.log("[GetLatestBatch] Latest batch is deleted, skipping");
      return null;
    }

    const batch = {
      id: doc.id,
      ...data,
      daysCount: calculateAge(data.startDate, data.daysCount),
    };

    console.log("[GetLatestBatch] Latest batch found:", batch.id, batch);
    return batch;
  } catch (error) {
    console.error("[GetLatestBatch] Error:", error);
    return null;
  }
};

/**
 * Fetch a specific batch by document ID
 * @param {string} batchId - Firestore document ID
 * @returns {Promise<Object|null>} Batch document with calculated age, or null if not found or deleted
 */
const getBatchById = async (batchId) => {
  try {
    if (!batchId) {
      console.log("[GetBatchById] No batchId provided");
      return null;
    }

    console.log("[GetBatchById] Fetching batch:", batchId);

    const docRef = doc(firestoreDb, "brooderInfo", batchId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      console.log("[GetBatchById] Batch not found:", batchId);
      return null;
    }

    const data = docSnap.data();

    // Skip if deleted
    if (data.deleted) {
      console.log("[GetBatchById] Batch is deleted:", batchId);
      return null;
    }

    const batch = {
      id: docSnap.id,
      ...data,
      daysCount: calculateAge(data.startDate, data.daysCount),
    };

    console.log("[GetBatchById] Batch found:", batch.id, batch);
    return batch;
  } catch (error) {
    console.error("[GetBatchById] Error fetching batch:", error);
    return null;
  }
};

/**
 * Save selected batch ID to AsyncStorage
 * @param {string} batchId - Firestore document ID to save
 */
const setSelectedBatch = async (batchId) => {
  try {
    if (!batchId) {
      await AsyncStorage.removeItem("selectedBatchId");
      console.log("[SetSelectedBatch] Cleared selected batch");
      return;
    }

    await AsyncStorage.setItem("selectedBatchId", batchId);
    console.log("[SetSelectedBatch] Saved selected batch:", batchId);
  } catch (error) {
    console.error("[SetSelectedBatch] Error:", error);
  }
};

/**
 * Retrieve selected batch ID from AsyncStorage
 * @returns {Promise<string|null>} Selected batch ID, or null if none selected
 */
const getSelectedBatch = async () => {
  try {
    const selectedBatchId = await AsyncStorage.getItem("selectedBatchId");
    console.log("[GetSelectedBatch] Retrieved:", selectedBatchId);
    return selectedBatchId;
  } catch (error) {
    console.error("[GetSelectedBatch] Error:", error);
    return null;
  }
};

/**
 * Update brooder card display with batch data
 * @param {Object} batch - Batch document with id, chicksCount, daysCount, harvestDays
 * @param {Function} setChicksCount - State setter for chicks count
 * @param {Function} setDaysCount - State setter for days count
 * @param {Function} setHarvestDays - State setter for harvest days
 * @param {Function} setBrooderInfo - State setter for brooder info
 * @param {Function} setHasBatchData - State setter for has batch data flag
 */
const updateBrooderCardFromBatch = (
  batch,
  setChicksCount,
  setDaysCount,
  setHarvestDays,
  setBrooderInfo,
  setHasBatchData,
) => {
  try {
    if (!batch) {
      console.log("[UpdateBrooderCard] No batch provided");
      return;
    }

    const chicksVal = String(batch.chicksCount || 0);
    const ageVal = String(batch.daysCount || 0);
    const harvestVal = String(batch.harvestDays || 0);

    setChicksCount(chicksVal);
    setDaysCount(ageVal);
    setHarvestDays(harvestVal);

    setBrooderInfo({
      chicksCount: batch.chicksCount || 0,
      daysCount: batch.daysCount || 0,
      harvestDays: batch.harvestDays || 0,
    });

    setHasBatchData(true);

    console.log("[UpdateBrooderCard] Updated card with batch:", batch.id);
  } catch (error) {
    console.error("[UpdateBrooderCard] Error:", error);
  }
};

class ErrorBoundary extends React.Component {
  state = { hasError: false, err: null };
  static getDerivedStateFromError(error) {
    return { hasError: true, err: error };
  }
  componentDidCatch(error, info) {
    console.warn("[ErrorBoundary]", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, padding: 16, justifyContent: "center" }}>
          <Text style={{ fontWeight: "700", fontSize: 18, marginBottom: 8 }}>
            Render Error
          </Text>
          <Text selectable>{String(this.state.err)}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function QuickOverviewSetup({ navigation }) {
  const [chicksCount, setChicksCount] = useState("");
  const [daysCount, setDaysCount] = useState("");
  const [harvestDays, setHarvestDays] = useState("");
  const [todayDate, setTodayDate] = useState("");
  const [showQuickSetup, setShowQuickSetup] = useState(false);
  const [showConfirmReplace, setShowConfirmReplace] = useState(false);
  const [hasBatchData, setHasBatchData] = useState(false);
  const [userName, setUserName] = useState("User");
  const [showBatchesModal, setShowBatchesModal] = useState(false);
  const [showEditBatchModal, setShowEditBatchModal] = useState(false);
  const [editingBatchIndex, setEditingBatchIndex] = useState(null);
  const [batches, setBatches] = useState([]);
  const [selectedBatchIndex, setSelectedBatchIndex] = useState(null);
  const [showMortalityModal, setShowMortalityModal] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [sensorData, setSensorData] = useState({
    waterLevel: 0,
    feedLevel: 0,
    solarCharge: 0,
    lightStatus: "Off",
  });
  const [loadingSensorData, setLoadingSensorData] = useState(false);
  const [sensorDataError, setSensorDataError] = useState(null);
  const [brooderInfo, setBrooderInfo] = useState({
    chicksCount: 0,
    daysCount: 0,
    harvestDays: 0,
  });
  const [loadingBrooderInfo, setLoadingBrooderInfo] = useState(false);
  const [brooderInfoError, setBrooderInfoError] = useState(null);
  const sensorListenerRef = useRef(null);
  const resetBrooderUI = async () => {
    setChicksCount("0");
    setDaysCount("0");
    setHarvestDays("0");
    setHasBatchData(false);
    setSelectedBatchIndex(null);

    await AsyncStorage.multiRemove([
      "chicksCount",
      "daysCount",
      "harvestDays",
      "batchStartDate",
      "selectedBatchIndex",
    ]);

    console.log("[Brooder] UI reset (no batches)");
  };

  // Load saved data when component mounts
  useEffect(() => {
    loadSavedData();
    fetchUserName();

    // Fetch latest batch and all batches from Firestore
    const initializeBatches = async () => {
      await fetchLatestBatch();
      await fetchAllBatchesFromFirestore();
    };

    initializeBatches();

    setupSensorMonitoring();

    // Set today's date
    const today = new Date();
    const formattedDate = today.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    setTodayDate(formattedDate);

    console.log("[App] Mounted");

    // Update days count every minute to keep it in sync with real-time
    const interval = setInterval(() => {
      loadSavedData();
    }, 60000); // Update every 60 seconds
    return () => {
      clearInterval(interval);
      // Unsubscribe from Firestore listener on unmount
      if (sensorListenerRef.current) {
        sensorListenerRef.current();
      }
    };
  }, []);

  // ==================== SCREEN FOCUS EFFECT: REFRESH SELECTED BATCH ====================
  /**
   * When Home screen comes into focus, refresh the selected batch from Firestore
   * This ensures data is always fresh when returning from other screens
   */
  useFocusEffect(
    React.useCallback(() => {
      console.log("[ScreenFocus] Home screen came into focus");

      const refreshSelectedBatch = async () => {
        try {
          // Get selected batch ID from AsyncStorage
          const selectedBatchId = await getSelectedBatch();

          if (selectedBatchId) {
            // Fetch fresh batch from Firestore
            const freshBatch = await getBatchById(selectedBatchId);

            if (freshBatch) {
              // Batch exists, update display
              updateBrooderCardFromBatch(
                freshBatch,
                setChicksCount,
                setDaysCount,
                setHarvestDays,
                setBrooderInfo,
                setHasBatchData,
              );

              // Update batches array with fresh data
              const updatedBatches = batches.map((batch) =>
                batch.id === selectedBatchId ? freshBatch : batch,
              );
              setBatches(updatedBatches);

              console.log(
                "[ScreenFocus] Refreshed selected batch:",
                selectedBatchId,
              );
            } else {
              // Selected batch deleted, fallback to latest
              console.log(
                "[ScreenFocus] Selected batch not found, falling back to latest",
              );
              const latestBatch = await getLatestBatch();
              if (latestBatch) {
                await setSelectedBatch(latestBatch.id);
                updateBrooderCardFromBatch(
                  latestBatch,
                  setChicksCount,
                  setDaysCount,
                  setHarvestDays,
                  setBrooderInfo,
                  setHasBatchData,
                );
                const updatedBatches = batches.map((batch) =>
                  batch.id === latestBatch.id ? latestBatch : batch,
                );
                setBatches(updatedBatches);
              } else {
                // No latest batch either, clear everything
                console.log("[ScreenFocus] No batches available, clearing all");
                await setSelectedBatch(null);
                setChicksCount("0");
                setDaysCount("0");
                setHarvestDays("0");
                setHasBatchData(false);
                setBatches([]);
              }
            }
          } else {
            // No selected batch, fetch latest
            console.log("[ScreenFocus] No selected batch, fetching latest");
            const latestBatch = await getLatestBatch();
            if (latestBatch) {
              await setSelectedBatch(latestBatch.id);
              updateBrooderCardFromBatch(
                latestBatch,
                setChicksCount,
                setDaysCount,
                setHarvestDays,
                setBrooderInfo,
                setHasBatchData,
              );
              const updatedBatches = batches.map((batch) =>
                batch.id === latestBatch.id ? latestBatch : batch,
              );
              setBatches(updatedBatches);
            } else {
              // No batches at all
              console.log("[ScreenFocus] No batches available, resetting UI");
              setChicksCount("0");
              setDaysCount("0");
              setHarvestDays("0");
              setHasBatchData(false);
              setBatches([]);
            }
          }
        } catch (error) {
          console.error("[ScreenFocus] Error refreshing batch:", error);
        }
      };

      refreshSelectedBatch();
    }, [batches]),
  );

  // ==================== SYNC SELECTED BATCH INDEX ====================
  /**
   * After batches are fetched, find the index of the currently displayed batch
   * This keeps selectedBatchIndex in sync with the actual batch ID being displayed
   */
  useEffect(() => {
    if (batches.length === 0) {
      // No batches left - ensure UI is completely reset
      console.log("[SyncIndex] No batches, resetting UI");
      setChicksCount("0");
      setDaysCount("0");
      setHarvestDays("0");
      setHasBatchData(false);
      setSelectedBatchIndex(null);
    } else if (batches.length > 0 && chicksCount !== "0") {
      // Find the batch that matches current display data
      const currentBatchIndex = batches.findIndex(
        (batch) =>
          String(batch.chicksCount) === chicksCount &&
          String(batch.daysCount) === daysCount &&
          String(batch.harvestDays) === harvestDays,
      );

      if (currentBatchIndex !== -1) {
        console.log(
          "[SyncIndex] Found batch at index",
          currentBatchIndex,
          "id:",
          batches[currentBatchIndex].id,
        );
        setSelectedBatchIndex(currentBatchIndex);
      }
    }
  }, [batches]);

  const handleLogout = async () => {
    await AsyncStorage.clear(); // 🔥 important
    await auth.signOut();
    navigation.replace("Login");
  };

  const fetchUserName = async () => {
    try {
      // Check if admin bypass
      const isAdminBypass = await AsyncStorage.getItem("isAdminBypass");
      const adminEmail = await AsyncStorage.getItem("adminEmail");

      if (isAdminBypass === "true" && adminEmail === "admin@example.com") {
        setUserName("Admin");
        return;
      }

      const currentUser = auth.currentUser;

      if (currentUser) {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));

        if (userDoc.exists()) {
          const data = userDoc.data();
          // Get first name only for greeting
          const fullName =
            data.fullname || data.name || data.firstName || "User";
          const firstName = fullName.split(" ")[0];
          setUserName(firstName);
        }
      }
    } catch (error) {
      console.error("Error fetching user name:", error);
    }
  };

  // ==================== FIRESTORE BATCH FUNCTIONS ====================

  /**
   * Fetch the latest batch from Firestore and display on Brooder Card
   * Uses the same fetchBatches function from ViewAllBatchesModal for consistency
   */
  const fetchLatestBatch = async () => {
    try {
      setLoadingBrooderInfo(true);
      setBrooderInfoError(null);

      // Fetch all batches using shared function
      const allBatches = await fetchBatches();

      if (allBatches.length > 0) {
        // Get the first batch (most recent due to startDate DESC sorting)
        const latestBatch = allBatches[0];

        console.log(
          "[FetchLatest] Latest batch found:",
          latestBatch.id,
          latestBatch,
        );

        // Extract fields
        const fetchedChicksCount = String(latestBatch.chicksCount || 0);
        const fetchedAge = String(latestBatch.daysCount || 0);
        const fetchedHarvestDays = String(latestBatch.harvestDays || 0);

        // Update UI states
        setChicksCount(fetchedChicksCount);
        setDaysCount(fetchedAge);
        setHarvestDays(fetchedHarvestDays);

        // Update brooder info state
        setBrooderInfo({
          chicksCount: latestBatch.chicksCount || 0,
          daysCount: latestBatch.daysCount || 0,
          harvestDays: latestBatch.harvestDays || 0,
        });

        // Cache to AsyncStorage for offline
        try {
          await AsyncStorage.setItem("chicksCount", fetchedChicksCount);
          await AsyncStorage.setItem("daysCount", fetchedAge);
          await AsyncStorage.setItem("harvestDays", fetchedHarvestDays);
          console.log("[FetchLatest] Cached to AsyncStorage");
        } catch (storageError) {
          console.warn(
            "[FetchLatest] AsyncStorage cache failed:",
            storageError,
          );
        }

        // Auto-increment daily age
        const ageNum = parseInt(fetchedAge);
        if (!isNaN(ageNum)) {
          await checkAndIncrementDailyAge(ageNum);
        }

        setHasBatchData(true);
      } else {
        console.log("[FetchLatest] No batches found in brooderInfo collection");
        setBrooderInfoError("No brooder information available");
        setHasBatchData(false);
        await resetBrooderUI();
      }
    } catch (error) {
      console.error("[FetchLatest] Error fetching latest batch:", error);
      setBrooderInfoError(error.message);
      setHasBatchData(false);
    } finally {
      setLoadingBrooderInfo(false);
    }
  };

  /**
   * Fetch all batches from Firestore
   * Uses the same fetchBatches function from ViewAllBatchesModal for consistency
   * Returns array of batch documents with auto-calculated daysCount
   */
  const fetchAllBatchesFromFirestore = async () => {
    try {
      console.log("[FetchAll] Starting to fetch all batches from Firestore...");

      // Use shared fetchBatches function for consistency with ViewAllBatchesModal
      const allBatches = await fetchBatches();

      console.log("[FetchAll] Total batches fetched:", allBatches.length);
      setBatches(allBatches);
      setHasBatchData(allBatches.length > 0);

      return allBatches;
    } catch (error) {
      console.error("[FetchAll] Error fetching all batches:", error);
      setBatches([]);
      setHasBatchData(false);
      return [];
    }
  };

  /**
   * Update Firestore with latest batch data
   * Finds and updates the latest batch document by startDate
   */
  const updateLatestBatchInFirestore = async (updates) => {
    try {
      const q = query(
        collection(firestoreDb, "brooderInfo"),
        orderBy("startDate", "desc"),
        limit(1),
      );
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const latestDoc = querySnapshot.docs[0];
        const docRef = latestDoc.ref;

        const updateData = {
          ...updates,
          updatedAt: new Date().toISOString(),
        };

        await updateDoc(docRef, updateData);
        console.log("[UpdateLatest] Updated batch:", latestDoc.id, updateData);
        return true;
      } else {
        console.error("[UpdateLatest] No batch found to update");
        Alert.alert("Error", "No brooder batch found to update");
        return false;
      }
    } catch (error) {
      console.error("[UpdateLatest] Error updating batch:", error);
      Alert.alert("Error", "Failed to update batch in database");
      return false;
    }
  };

  const fetchBrooderInfoFromFirestore = async () => {
    try {
      setLoadingBrooderInfo(true);
      setBrooderInfoError(null);

      const docRef = doc(firestoreDb, "brooderInfo", "batch1");
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();

        // Convert values to strings for UI display
        const fetchedChicksCount = String(data.chicksCount || 0);
        const fetchedDaysCount = String(data.daysCount || 0);
        const fetchedHarvestDays = String(data.harvestDays || 0);

        // Update UI states - make Firestore the source of truth
        setChicksCount(fetchedChicksCount);
        setDaysCount(fetchedDaysCount);
        setHarvestDays(fetchedHarvestDays);

        // Also update the brooderInfo state
        setBrooderInfo({
          chicksCount: data.chicksCount || 0,
          daysCount: data.daysCount || 0,
          harvestDays: data.harvestDays || 0,
        });

        // Sync fetched data to AsyncStorage for offline caching
        try {
          await AsyncStorage.setItem("chicksCount", fetchedChicksCount);
          await AsyncStorage.setItem("daysCount", fetchedDaysCount);
          await AsyncStorage.setItem("harvestDays", fetchedHarvestDays);
        } catch (storageError) {
          console.warn(
            "Could not sync Firestore data to AsyncStorage:",
            storageError,
          );
        }

        console.log(
          "Brooder info fetched from Firestore and UI updated:",
          data,
        );

        // Check and perform daily age auto-increment
        const daysNum = parseInt(fetchedDaysCount);
        if (!isNaN(daysNum)) {
          await checkAndIncrementDailyAge(daysNum);
        }
      } else {
        console.log("No brooder info document found in Firestore");
        setBrooderInfoError("No brooder information available");
      }
    } catch (error) {
      console.error("Error fetching brooder info from Firestore:", error);
      setBrooderInfoError(error.message);
    } finally {
      setLoadingBrooderInfo(false);
    }
  };

  const updateBrooderInfoInFirestore = async (updates) => {
    try {
      const docRef = doc(firestoreDb, "brooderInfo", "batch1");

      // Prepare update object with timestamp
      const updateData = {
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      // Use updateDoc to update only the specified fields
      await updateDoc(docRef, updateData);

      console.log("Brooder info updated in Firestore:", updateData);
      return true;
    } catch (error) {
      console.error("Error updating brooder info in Firestore:", error);
      // Alert.alert("Error", "Failed to update brooder information in database");
      return false;
    }
  };

  const getTodayDateGMT8 = () => {
    // Get current date in GMT+8 timezone (YYYY-MM-DD format)
    const now = new Date();
    // Create date string in GMT+8
    const utcDate = new Date(now.getTime() + now.getTimezoneOffset() * 60000);
    const gmt8Date = new Date(utcDate.getTime() + 8 * 60 * 60000);

    const year = gmt8Date.getFullYear();
    const month = String(gmt8Date.getMonth() + 1).padStart(2, "0");
    const day = String(gmt8Date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  const checkAndIncrementDailyAge = async (currentDaysCount) => {
    try {
      const todayGMT8 = getTodayDateGMT8();
      const lastUpdateDate = await AsyncStorage.getItem("lastUpdateDate");

      console.log(
        `[DailyAge] Today: ${todayGMT8}, Last Update: ${lastUpdateDate}`,
      );

      // If today's date is different from last update date, increment age
      if (lastUpdateDate !== todayGMT8) {
        const newDaysCount = currentDaysCount + 1;
        const newDaysCountStr = String(newDaysCount);

        console.log(
          `[DailyAge] Incrementing age from ${currentDaysCount} to ${newDaysCount}`,
        );

        // Update React state
        setDaysCount(newDaysCountStr);

        // Update AsyncStorage
        await AsyncStorage.setItem("daysCount", newDaysCountStr);

        // Update Firestore
        await updateBrooderInfoInFirestore({
          daysCount: newDaysCount,
        });

        // Save today as the last update date
        await AsyncStorage.setItem("lastUpdateDate", todayGMT8);

        console.log(
          `[DailyAge] Age incremented and saved. Last update date set to ${todayGMT8}`,
        );
      } else {
        console.log("[DailyAge] Age already incremented today, skipping");
      }
    } catch (error) {
      console.error("Error checking and incrementing daily age:", error);
    }
  };

  const setupSensorMonitoring = async () => {
    try {
      setLoadingSensorData(true);
      setSensorDataError(null);

      // First, load cached data from AsyncStorage
      const hasCachedData = await loadCachedSensorData();

      const docRef = doc(firestoreDb, "sensors", "current");

      // Set up real-time listener with onSnapshot
      const unsubscribe = onSnapshot(docRef, async (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();

          // Extract sensor values with defaults
          const newSensorData = {
            waterLevel:
              typeof data.waterLevel === "number" ? data.waterLevel : 0,
            feedLevel: typeof data.feedLevel === "number" ? data.feedLevel : 0,
            solarCharge:
              typeof data.solarCharge === "number" ? data.solarCharge : 0,
            lightStatus: data.lightStatus ? String(data.lightStatus) : "Off",
          };

          // Update state with Firestore data
          setSensorData(newSensorData);

          // Cache the new data to AsyncStorage
          await cacheSensorData(newSensorData);
        }
      });

      // Store the unsubscribe function for cleanup
      sensorListenerRef.current = unsubscribe;

      console.log("[SensorData] Real-time listener set up");
    } catch (error) {
      console.error("Error setting up sensor monitoring:", error);
      setSensorDataError(error.message);
      setLoadingSensorData(false);
    }
  };

  const loadCachedSensorData = async () => {
    try {
      const cachedWaterLevel = await AsyncStorage.getItem("sensorWaterLevel");
      const cachedFeedLevel = await AsyncStorage.getItem("sensorFeedLevel");
      const cachedSolarCharge = await AsyncStorage.getItem("sensorSolarCharge");
      const cachedLightStatus = await AsyncStorage.getItem("sensorLightStatus");

      if (
        cachedWaterLevel ||
        cachedFeedLevel ||
        cachedSolarCharge ||
        cachedLightStatus
      ) {
        setSensorData({
          waterLevel: cachedWaterLevel ? parseInt(cachedWaterLevel) : 0,
          feedLevel: cachedFeedLevel ? parseInt(cachedFeedLevel) : 0,
          solarCharge: cachedSolarCharge ? parseInt(cachedSolarCharge) : 0,
          lightStatus: cachedLightStatus || "Off",
        });

        console.log("[SensorData] Loaded from AsyncStorage cache");
        return true;
      }

      return false;
    } catch (error) {
      console.error("Error loading cached sensor data:", error);
      return false;
    }
  };

  const cacheSensorData = async (data) => {
    try {
      if (data.waterLevel !== undefined) {
        await AsyncStorage.setItem("sensorWaterLevel", String(data.waterLevel));
      }
      if (data.feedLevel !== undefined) {
        await AsyncStorage.setItem("sensorFeedLevel", String(data.feedLevel));
      }
      if (data.solarCharge !== undefined) {
        await AsyncStorage.setItem(
          "sensorSolarCharge",
          String(data.solarCharge),
        );
      }
      if (data.lightStatus !== undefined) {
        await AsyncStorage.setItem(
          "sensorLightStatus",
          String(data.lightStatus),
        );
      }

      console.log("[SensorData] Cached to AsyncStorage");
    } catch (error) {
      console.error("Error caching sensor data:", error);
    }
  };

  const loadSavedData = async () => {
    try {
      // Load all batches and selected index
      const [
        batchesStr,
        savedBatchIndex,
        savedChicks,
        savedDays,
        savedHarvest,
      ] = await Promise.all([
        AsyncStorage.getItem("batches"),
        AsyncStorage.getItem("selectedBatchIndex"),
        AsyncStorage.getItem("chicksCount"),
        AsyncStorage.getItem("daysCount"),
        AsyncStorage.getItem("harvestDays"),
      ]);

      let parsedBatches = [];
      if (batchesStr) {
        try {
          parsedBatches = JSON.parse(batchesStr);
        } catch (e) {
          parsedBatches = [];
        }
      }
      setBatches(parsedBatches);

      let idx =
        savedBatchIndex !== null &&
        savedBatchIndex !== undefined &&
        savedBatchIndex !== "null"
          ? parseInt(savedBatchIndex, 10)
          : null;
      if (
        parsedBatches.length > 0 &&
        idx !== null &&
        idx >= 0 &&
        idx < parsedBatches.length
      ) {
        // Use batch data for all fields
        const batch = parsedBatches[idx];
        setChicksCount(batch.chicksCount ? String(batch.chicksCount) : "0");
        setDaysCount(batch.daysCount ? String(batch.daysCount) : "0");
        setHarvestDays(batch.harvestDays ? String(batch.harvestDays) : "0");
        setHasBatchData(true);
        setSelectedBatchIndex(idx);
      } else if (parsedBatches.length > 0) {
        // Fallback: select most recent batch
        const lastIdx = parsedBatches.length - 1;
        const batch = parsedBatches[lastIdx];
        setChicksCount(batch.chicksCount ? String(batch.chicksCount) : "0");
        setDaysCount(batch.daysCount ? String(batch.daysCount) : "0");
        setHarvestDays(batch.harvestDays ? String(batch.harvestDays) : "0");
        setHasBatchData(true);
        setSelectedBatchIndex(lastIdx);
        await AsyncStorage.setItem("selectedBatchIndex", String(lastIdx));
      } else {
        // No batches, reset to zero (don't use old saved values)
        setChicksCount("0");
        setDaysCount("0");
        setHarvestDays("0");
        setHasBatchData(false);
        setSelectedBatchIndex(null);
      }
    } catch (error) {
      console.error("Error loading saved data:", error);
    }
  };

  const handleSaveChicksCount = async () => {
    if (!chicksCount || parseInt(chicksCount) <= 0) {
      Alert.alert("Invalid Input", "Please enter a valid number of chicks");
      return;
    }
    try {
      await AsyncStorage.setItem("chicksCount", chicksCount);
      setChicksCount(chicksCount);
      setHasBatchData(true);
      Alert.alert("Success", "Chicks count saved successfully");
      console.log("Saving chicks count:", chicksCount);
    } catch (error) {
      console.error("Error saving chicks count:", error);
      Alert.alert("Error", "Failed to save chicks count");
    }
  };

  const handleSaveDaysCount = async () => {
    const days = parseInt(daysCount);
    if (!daysCount || days < 1 || days > 45) {
      Alert.alert("Invalid Input", "Please enter a number between 1 and 45");
      return;
    }
    try {
      await AsyncStorage.setItem("daysCount", daysCount);
      setDaysCount(daysCount);
      setHasBatchData(true);
      Alert.alert("Success", "Days count saved successfully");
      console.log("Saving days count:", daysCount);
    } catch (error) {
      console.error("Error saving days count:", error);
      Alert.alert("Error", "Failed to save days count");
    }
  };

  const handleBack = () => {
    console.log("Navigate back to dashboard");
  };

  const openQuickSetup = async () => {
    setShowQuickSetup(true);
  };

  const closeQuickSetup = async () => {
    // Refresh batches from Firestore after adding new batch
    await fetchAllBatchesFromFirestore();
    await fetchLatestBatch();
    setShowQuickSetup(false);
  };

  const handleReplaceConfirm = () => {
    setShowConfirmReplace(false);
    setShowQuickSetup(true);
  };

  const handleReplaceCancel = () => {
    setShowConfirmReplace(false);
  };

  const handleViewAllBatches = async () => {
    try {
      // Refresh all batches from Firestore when opening modal
      await fetchAllBatchesFromFirestore();
      setShowBatchesModal(true);
    } catch (error) {
      console.error("[ViewAllBatches] Error:", error);
      Alert.alert("Error", "Failed to load batches");
    }
  };

  const loadAllBatches = async () => {
    // Deprecated: Use fetchAllBatchesFromFirestore() instead
    // This function kept for backward compatibility
    try {
      const allBatches = await fetchAllBatchesFromFirestore();
      return allBatches;
    } catch (error) {
      console.error("[LoadAllBatches] Error:", error);
      return [];
    }
  };

  const handleDeleteBatch = async (index) => {
    try {
      if (index < 0 || index >= batches.length) {
        console.error("[HandleDeleteBatch] Invalid batch index:", index);
        return;
      }

      // Refresh batches from Firestore after deletion from ViewAllBatchesModal
      // ViewAllBatchesModal handles deletion, confirmation modals, and success/error feedback
      await fetchAllBatchesFromFirestore();

      // If deleted batch was selected, fetch latest
      if (selectedBatchIndex === index) {
        await fetchLatestBatch();
      }

      console.log("[HandleDeleteBatch] Batches refreshed after deletion");
    } catch (error) {
      console.error("[HandleDeleteBatch] Error refreshing batches:", error);
    }
  };

  const handleSelectBatch = async (index) => {
    try {
      if (index < 0 || index >= batches.length) {
        Alert.alert("Error", "Invalid batch selection");
        return;
      }

      // Get batch from array
      const selectedBatchFromArray = batches[index];

      // Fetch fresh batch from Firestore using batch ID
      const freshBatch = await getBatchById(selectedBatchFromArray.id);

      if (!freshBatch) {
        Alert.alert("Error", "Selected batch no longer exists");
        return;
      }

      // Update selected batch ID in AsyncStorage
      await setSelectedBatch(freshBatch.id);

      // Update selected batch index
      setSelectedBatchIndex(index);

      // Update brooder card with fresh batch data
      updateBrooderCardFromBatch(
        freshBatch,
        setChicksCount,
        setDaysCount,
        setHarvestDays,
        setBrooderInfo,
        setHasBatchData,
      );

      // Update batches array with fresh data
      const updatedBatches = batches.map((batch, idx) =>
        idx === index ? freshBatch : batch,
      );
      setBatches(updatedBatches);

      console.log(
        "[SelectBatch] Selected batch",
        freshBatch.id,
        "at index",
        index,
      );

      setShowBatchesModal(false);
    } catch (error) {
      console.error("[SelectBatch] Error selecting batch:", error);
      Alert.alert("Error", "Failed to select batch");
    }
  };

  const handleDeleteSelectedBatch = async () => {
    // Get the current selected batch
    const currentIndex = selectedBatchIndex;
    if (currentIndex === null || currentIndex >= batches.length) {
      Alert.alert("Error", "No batch selected");
      return;
    }

    Alert.alert(
      "Delete Batch",
      "Are you sure you want to delete this batch? This action cannot be undone.",
      [
        {
          text: "Cancel",
          onPress: () => {},
          style: "cancel",
        },
        {
          text: "Delete",
          onPress: async () => {
            try {
              // Remove the batch
              const updated = batches.filter((_, i) => i !== currentIndex);
              setBatches(updated);
              await AsyncStorage.setItem("batches", JSON.stringify(updated));

              // If there are remaining batches, select the first one
              if (updated.length > 0) {
                const nextIndex = 0;
                const nextBatch = updated[nextIndex];
                setSelectedBatchIndex(nextIndex);
                setChicksCount(String(nextBatch.chicksCount || "0"));
                setDaysCount(String(nextBatch.daysCount || "0"));
                setHarvestDays(String(nextBatch.harvestDays || "0"));
                await AsyncStorage.setItem("selectedBatchIndex", "0");
                await AsyncStorage.setItem(
                  "chicksCount",
                  String(nextBatch.chicksCount || "0"),
                );
                await AsyncStorage.setItem(
                  "daysCount",
                  String(nextBatch.daysCount || "0"),
                );
                await AsyncStorage.setItem(
                  "harvestDays",
                  String(nextBatch.harvestDays || "0"),
                );
                await AsyncStorage.setItem(
                  "batchStartDate",
                  nextBatch.startDate || "",
                );
              } else {
                // No batches left, reset to zero
                setSelectedBatchIndex(null);
                setChicksCount("0");
                setDaysCount("0");
                setHarvestDays("0");
                setHasBatchData(false);
                await AsyncStorage.removeItem("chicksCount");
                await AsyncStorage.removeItem("daysCount");
                await AsyncStorage.removeItem("harvestDays");
                await AsyncStorage.removeItem("batchStartDate");
                await AsyncStorage.removeItem("selectedBatchIndex");
                await AsyncStorage.removeItem("selectedBatchId");
                await AsyncStorage.removeItem("batches");
              }

              Alert.alert("Success", "Batch deleted successfully");
            } catch (error) {
              console.error("Error deleting batch:", error);
              Alert.alert("Error", "Failed to delete batch");
            }
          },
          style: "destructive",
        },
      ],
    );
  };

  const handleEditBatch = (index) => {
    setEditingBatchIndex(index);
    setShowEditBatchModal(true);
  };

  const handleSaveEditBatch = async (updatedBatch) => {
    try {
      if (editingBatchIndex === null || editingBatchIndex >= batches.length) {
        Alert.alert("Error", "Invalid batch index");
        return;
      }

      const updatedBatches = batches.map((batch, idx) => {
        if (idx === editingBatchIndex) {
          return {
            ...batch,
            chicksCount: updatedBatch.chicksCount,
            daysCount: updatedBatch.daysCount,
            harvestDays: updatedBatch.harvestDays,
          };
        }
        return batch;
      });

      setBatches(updatedBatches);
      await AsyncStorage.setItem("batches", JSON.stringify(updatedBatches));

      // Update the displayed data if the edited batch is the currently selected one
      if (editingBatchIndex === selectedBatchIndex) {
        setChicksCount(updatedBatch.chicksCount);
        setDaysCount(updatedBatch.daysCount);
        setHarvestDays(updatedBatch.harvestDays);
        await AsyncStorage.setItem("chicksCount", updatedBatch.chicksCount);
        await AsyncStorage.setItem("daysCount", updatedBatch.daysCount);
        await AsyncStorage.setItem("harvestDays", updatedBatch.harvestDays);
      }

      setShowEditBatchModal(false);
      setEditingBatchIndex(null);
    } catch (error) {
      console.error("Error saving edited batch:", error);
      Alert.alert("Error", "Failed to save batch changes");
    }
  };

  const handleSaveChicksCountModal = async (value) => {
    try {
      let batchArr = batches.slice();
      let idx = selectedBatchIndex;

      if (hasBatchData && idx !== null && batchArr[idx]) {
        // Edit existing batch
        batchArr[idx] = {
          ...batchArr[idx],
          chicksCount: String(value),
          daysCount: String(daysCount || "0"),
          harvestDays: String(harvestDays || "0"),
          startDate: batchArr[idx].startDate || new Date().toISOString(),
        };
      } else {
        // Add new batch
        const newBatch = {
          chicksCount: String(value),
          daysCount: String(daysCount && daysCount !== "" ? daysCount : "0"),
          harvestDays: String(
            harvestDays && harvestDays !== "" ? harvestDays : "0",
          ),
          startDate: new Date().toISOString(),
        };
        batchArr.push(newBatch);
        idx = batchArr.length - 1;
        setSelectedBatchIndex(idx);
        await AsyncStorage.setItem("selectedBatchIndex", String(idx));
      }

      setBatches(batchArr);
      setChicksCount(String(value));
      setHasBatchData(true);
      await AsyncStorage.setItem("batches", JSON.stringify(batchArr));
      await AsyncStorage.setItem("chicksCount", String(value));
      await AsyncStorage.setItem("batchStartDate", batchArr[idx].startDate);
    } catch (error) {
      console.error("Error saving chicks count:", error);
    }
  };

  const handleSaveBatch = async (batchData) => {
    try {
      const newBatch = {
        batchNo: batchData.batchNo || "-",
        chicksCount: batchData.chicksCount,
        daysCount: batchData.daysCount,
        harvestDays: batchData.harvestDays,
        startDate: new Date().toISOString(),
      };

      let batchArr = batches.slice();
      batchArr.push(newBatch);
      const newIndex = batchArr.length - 1;

      setBatches(batchArr);
      setSelectedBatchIndex(newIndex);
      setChicksCount(batchData.chicksCount);
      setDaysCount(batchData.daysCount);
      setHarvestDays(batchData.harvestDays);
      setHasBatchData(true);

      await AsyncStorage.setItem("batches", JSON.stringify(batchArr));
      await AsyncStorage.setItem("selectedBatchIndex", String(newIndex));
      await AsyncStorage.setItem("chicksCount", batchData.chicksCount);
      await AsyncStorage.setItem("daysCount", batchData.daysCount);
      await AsyncStorage.setItem("harvestDays", batchData.harvestDays);
      await AsyncStorage.setItem("batchStartDate", newBatch.startDate);
    } catch (error) {
      console.error("Error saving batch:", error);
    }
  };

  const handleSaveDaysCountModal = async (value) => {
    const days = parseInt(value);
    if (!value || days < 1 || days > 365) {
      Alert.alert("Invalid Input", "Please enter a number between 1 and 365");
      return;
    }
    try {
      let batchArr = batches.slice();
      let idx = selectedBatchIndex;

      if (hasBatchData && idx !== null && batchArr[idx]) {
        batchArr[idx] = {
          ...batchArr[idx],
          chicksCount: String(chicksCount || "0"),
          daysCount: String(value),
          harvestDays: String(harvestDays || "0"),
          startDate: batchArr[idx].startDate || new Date().toISOString(),
        };
      } else {
        const newBatch = {
          chicksCount: String(
            chicksCount && chicksCount !== "" ? chicksCount : "0",
          ),
          daysCount: String(value),
          harvestDays: String(
            harvestDays && harvestDays !== "" ? harvestDays : "0",
          ),
          startDate: new Date().toISOString(),
        };
        batchArr.push(newBatch);
        idx = batchArr.length - 1;
        setSelectedBatchIndex(idx);
        await AsyncStorage.setItem("selectedBatchIndex", String(idx));
      }

      setBatches(batchArr);
      setDaysCount(String(value));
      setHasBatchData(true);
      await AsyncStorage.setItem("batches", JSON.stringify(batchArr));
      await AsyncStorage.setItem("daysCount", String(value));
      await AsyncStorage.setItem("batchStartDate", batchArr[idx].startDate);
    } catch (error) {
      console.error("Error saving days count:", error);
    }
  };

  const handleSaveHarvestDaysModal = async (value) => {
    const days = parseInt(value);
    if (!value || days < 1 || days > 365) {
      Alert.alert("Invalid Input", "Please enter a number between 1 and 365");
      return;
    }
    try {
      let batchArr = batches.slice();
      let idx = selectedBatchIndex;

      if (hasBatchData && idx !== null && batchArr[idx]) {
        batchArr[idx] = {
          ...batchArr[idx],
          chicksCount: String(chicksCount || "0"),
          daysCount: String(daysCount || "0"),
          harvestDays: String(value),
          startDate: batchArr[idx].startDate || new Date().toISOString(),
        };
      } else {
        const newBatch = {
          chicksCount: String(
            chicksCount && chicksCount !== "" ? chicksCount : "0",
          ),
          daysCount: String(daysCount && daysCount !== "" ? daysCount : "0"),
          harvestDays: String(value),
          startDate: new Date().toISOString(),
        };
        batchArr.push(newBatch);
        idx = batchArr.length - 1;
        setSelectedBatchIndex(idx);
        await AsyncStorage.setItem("selectedBatchIndex", String(idx));
      }

      setBatches(batchArr);
      setHarvestDays(String(value));
      setHasBatchData(true);
      await AsyncStorage.setItem("batches", JSON.stringify(batchArr));
      await AsyncStorage.setItem("harvestDays", String(value));
    } catch (error) {
      console.error("Error saving harvest days:", error);
    }
  };

  const handleOpenMortalityModal = () => {
    if (batches.length === 0) {
      Alert.alert(
        "No Batches Available",
        "Please add a batch first before reporting mortality.",
      );
      return;
    }
    setShowMortalityModal(true);
  };

  const handleCloseMortalityModal = async () => {
    setShowMortalityModal(false);
    // Refresh batches and latest batch after reporting mortality
    await fetchAllBatchesFromFirestore();
    await fetchLatestBatch();
  };

  const handleMortalitySuccess = (batchNumber) => {
    setToastMessage(`Mortality reported for Batch ${batchNumber}`);
    setShowToast(true);
  };

  // Swipe gesture handler - swipe left to go to Control screen
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
        // Swipe left (negative dx) to go to Control
        if (gestureState.dx < -50) {
          navigation.navigate("Control");
        }
      },
    }),
  ).current;

  return (
    <ErrorBoundary>
      <View style={{ flex: 1 }} {...panResponder.panHandlers}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.container}>
            {/* Welcome Section */}
            <View style={styles.welcomeSection}>
              <Text style={styles.greeting}>Hello, {userName}! 👋</Text>
              <Text style={styles.date}>{todayDate}</Text>
            </View>

            {/* System Status Card */}
            <View style={styles.statusCard}>
              <View style={styles.statusHeader}>
                <View>
                  <Text style={styles.statusLabel}>System Status</Text>
                  <Text style={styles.statusText}>All Systems Normal</Text>
                </View>
                <View style={styles.statusIconContainer}>
                  <Text style={styles.statusIcon}>⚡</Text>
                </View>
              </View>
            </View>

            {/* Brooder Information Card */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Brooder Information</Text>
              <TouchableOpacity onPress={handleViewAllBatches}>
                <Text style={styles.viewAllLink}>View All</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.brooderCard}>
              <View style={styles.brooderRow}>
                <View style={styles.brooderIconContainer}>
                  <Text style={styles.brooderIconText}>🐣</Text>
                </View>
                <View style={styles.brooderTextContainer}>
                  <Text style={styles.brooderLabel}>Total Chicks</Text>
                  <Text style={styles.brooderValue}>{chicksCount || "0"}</Text>
                </View>
              </View>

              <View style={styles.brooderDivider} />

              <View style={styles.brooderRow}>
                <View style={styles.brooderIconContainer}>
                  <Text style={styles.brooderIconText}>📅</Text>
                </View>
                <View style={styles.brooderTextContainer}>
                  <Text style={styles.brooderLabel}>Age</Text>
                  <Text style={styles.brooderValue}>
                    {daysCount ? `${daysCount} days` : "0 days"}
                  </Text>
                </View>
              </View>

              <View style={styles.brooderDivider} />

              <View style={styles.brooderRow}>
                <View style={styles.brooderIconContainer}>
                  <Text style={styles.brooderIconText}>🎯</Text>
                </View>
                <View style={styles.brooderTextContainer}>
                  <Text style={styles.brooderLabel}>Expected Harvest</Text>
                  <Text style={styles.brooderValue}>
                    {harvestDays && harvestDays !== "0"
                      ? `${harvestDays} days`
                      : "0 days"}
                  </Text>
                </View>
              </View>
            </View>

            {/* Action Buttons Section */}
            <View style={styles.buttonContainer}>
              {/* ADD Button - Green */}
              <TouchableOpacity
                style={styles.addBtn}
                activeOpacity={0.9}
                onPress={openQuickSetup}
              >
                <Text style={styles.addBtnText}>Add</Text>
              </TouchableOpacity>

              {/* EDIT Button - Blue */}
              <TouchableOpacity
                style={[
                  styles.editBtn,
                  (selectedBatchIndex === null ||
                    batches.length === 0 ||
                    (selectedBatchIndex !== null &&
                      batches[selectedBatchIndex]?.mortalityCount > 0)) &&
                    styles.editBtnDisabled,
                ]}
                activeOpacity={0.9}
                onPress={() => {
                  // Check if mortality exists
                  if (
                    selectedBatchIndex !== null &&
                    batches[selectedBatchIndex]?.mortalityCount > 0
                  ) {
                    Alert.alert(
                      "Cannot Edit",
                      "This batch has mortality records. Editing is disabled to preserve data accuracy.",
                    );
                    return;
                  }

                  if (
                    selectedBatchIndex !== null &&
                    selectedBatchIndex < batches.length
                  ) {
                    handleEditBatch(selectedBatchIndex);
                  } else {
                    Alert.alert(
                      "No Batch Selected",
                      "Please select a batch to edit",
                    );
                  }
                }}
                disabled={
                  selectedBatchIndex === null ||
                  batches.length === 0 ||
                  (selectedBatchIndex !== null &&
                    batches[selectedBatchIndex]?.mortalityCount > 0)
                }
              >
                <Text
                  style={[
                    styles.editBtnText,
                    (selectedBatchIndex === null ||
                      batches.length === 0 ||
                      (selectedBatchIndex !== null &&
                        batches[selectedBatchIndex]?.mortalityCount > 0)) &&
                      styles.editBtnTextDisabled,
                  ]}
                >
                  Edit
                </Text>
              </TouchableOpacity>
            </View>

            {/* Report Mortality Button - Centered Below */}
            <View style={styles.mortalityButtonContainer}>
              <TouchableOpacity
                style={styles.mortalityBtn}
                activeOpacity={0.9}
                onPress={handleOpenMortalityModal}
              >
                <Text style={styles.mortalityBtnText}>Report Mortality</Text>
              </TouchableOpacity>
            </View>

            {/* Sensor Monitoring Grid */}
            <Text style={styles.sectionTitle}>Live Monitoring</Text>
            <View style={styles.sensorGrid}>
              {/* Water Level Card */}
              <View style={styles.sensorCard}>
                <Text style={styles.sensorIcon}>💧</Text>
                <Text style={styles.sensorLabel}>Water Level</Text>
                <Text style={styles.sensorValue}>
                  {loadingSensorData ? "..." : `${sensorData.waterLevel}%`}
                </Text>
              </View>

              {/* Feed Level Card */}
              <View style={styles.sensorCard}>
                <Text style={styles.sensorIcon}>🍴</Text>
                <Text style={styles.sensorLabel}>Feed Level</Text>
                <Text style={styles.sensorValue}>
                  {loadingSensorData ? "..." : `${sensorData.feedLevel}%`}
                </Text>
              </View>

              {/* Solar Charge Card */}
              <View style={styles.sensorCard}>
                <Text style={styles.sensorIcon}>☀️</Text>
                <Text style={styles.sensorLabel}>Solar Charge</Text>
                <Text style={styles.sensorValue}>
                  {loadingSensorData ? "..." : `${sensorData.solarCharge}%`}
                </Text>
              </View>

              {/* Light Status Card */}
              <View style={styles.sensorCard}>
                <Text style={styles.sensorIcon}>💡</Text>
                <Text style={styles.sensorLabel}>Light Status</Text>
                <Text style={styles.sensorValue}>
                  {loadingSensorData ? "..." : sensorData.lightStatus}
                </Text>
              </View>
            </View>

            <QuickSetupModal
              visible={showQuickSetup}
              initialChicksCount={chicksCount}
              initialDaysCount={daysCount}
              initialHarvestDays={harvestDays}
              onSaveChicksCount={handleSaveChicksCountModal}
              onSaveDaysCount={handleSaveDaysCountModal}
              onSaveHarvestDays={handleSaveHarvestDaysModal}
              onSaveBatch={handleSaveBatch}
              onClose={closeQuickSetup}
              batches={batches}
            />

            {/* View All Batches Modal */}
            <ViewAllBatchesModal
              visible={showBatchesModal}
              batches={batches}
              selectedBatchIndex={selectedBatchIndex}
              onSelectBatch={handleSelectBatch}
              onDeleteBatch={handleDeleteBatch}
              onEditBatch={handleEditBatch}
              onClose={() => setShowBatchesModal(false)}
            />

            {/* Edit Batch Modal */}
            <EditBatchModal
              visible={showEditBatchModal}
              batchData={
                editingBatchIndex !== null && editingBatchIndex < batches.length
                  ? batches[editingBatchIndex]
                  : null
              }
              onSaveChanges={handleSaveEditBatch}
              onBatchUpdated={async (freshBatch) => {
                // Called when EditBatchModal successfully updates batch in Firestore
                console.log(
                  "[EditBatchCallback] Received fresh batch:",
                  freshBatch.id,
                );

                // Update display with fresh batch data
                updateBrooderCardFromBatch(
                  freshBatch,
                  setChicksCount,
                  setDaysCount,
                  setHarvestDays,
                  setBrooderInfo,
                  setHasBatchData,
                );

                // Update batches array with fresh data
                const updatedBatches = batches.map((batch) =>
                  batch.id === freshBatch.id ? freshBatch : batch,
                );
                setBatches(updatedBatches);

                // Reload all batches from Firestore
                await loadAllBatches();
              }}
              onClose={async () => {
                await loadAllBatches();
                setShowEditBatchModal(false);
                setEditingBatchIndex(null);
              }}
            />

            {/* Report Mortality Modal */}
            <ReportMortalityModal
              visible={showMortalityModal}
              batches={batches}
              onClose={handleCloseMortalityModal}
              onSuccess={handleMortalitySuccess}
            />

            {/* Toast Notification */}
            <Toast
              visible={showToast}
              message={toastMessage}
              onHide={() => setShowToast(false)}
            />

            {/* Confirmation Modal */}
            <Modal
              visible={showConfirmReplace}
              transparent
              animationType="fade"
            >
              <View style={styles.confirmModalOverlay}>
                <View style={styles.confirmModalCard}>
                  <Text style={styles.confirmModalTitle}>
                    Edit Existing Batch?
                  </Text>
                  <Text style={styles.confirmModalMessage}>
                    You already have an active batch. Do you want to edit it
                    with new values?
                  </Text>
                  <View style={styles.confirmModalButtons}>
                    <TouchableOpacity
                      style={[
                        styles.confirmModalButton,
                        styles.confirmModalButtonCancel,
                      ]}
                      onPress={handleReplaceCancel}
                      activeOpacity={0.9}
                    >
                      <Text style={styles.confirmModalButtonCancelText}>
                        Cancel
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.confirmModalButton,
                        styles.confirmModalButtonConfirm,
                      ]}
                      onPress={handleReplaceConfirm}
                      activeOpacity={0.9}
                    >
                      <Text style={styles.confirmModalButtonConfirmText}>
                        Edit
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>
          </View>
        </ScrollView>
      </View>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  container: {
    backgroundColor: "#f8fafc",
    padding: 16,
  },
  welcomeSection: {
    marginBottom: 20,
  },
  greeting: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1e293b",
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  date: {
    fontSize: 15,
    color: "#3b82f6",
    fontWeight: "600",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 12,
    marginTop: 8,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    marginTop: 8,
  },
  viewAllLink: {
    fontSize: 14,
    fontWeight: "600",
    color: "#3b82f6",
  },
  statusCard: {
    backgroundColor: "#22c55e",
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    shadowColor: "#22c55e",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  statusHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.9)",
    marginBottom: 4,
  },
  statusText: {
    fontSize: 22,
    fontWeight: "800",
    color: "#ffffff",
  },
  statusIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    justifyContent: "center",
    alignItems: "center",
  },
  statusIcon: {
    fontSize: 30,
  },
  sensorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  sensorCard: {
    width: "48%",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
    alignItems: "center",
  },
  sensorIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  sensorLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748b",
    marginBottom: 8,
  },
  sensorValue: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1e293b",
    marginBottom: 8,
  },
  statusBadge: {
    backgroundColor: "#dcfce7",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeWarning: {
    backgroundColor: "#fef3c7",
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#15803d",
  },
  alertsCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  alertItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  alertIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#dbeafe",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  alertItemIcon: {
    fontSize: 18,
  },
  alertContent: {
    flex: 1,
  },
  alertText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 2,
  },
  alertTime: {
    fontSize: 13,
    color: "#64748b",
  },
  alertDivider: {
    height: 1,
    backgroundColor: "#e2e8f0",
  },
  brooderCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  brooderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  brooderIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#dbeafe",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  brooderIconText: {
    fontSize: 24,
  },
  brooderTextContainer: {
    flex: 1,
  },
  brooderLabel: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "500",
    marginBottom: 2,
  },
  brooderValue: {
    fontSize: 20,
    color: "#1e293b",
    fontWeight: "700",
  },
  brooderDivider: {
    height: 1,
    backgroundColor: "#e2e8f0",
  },
  buttonContainer: {
    flexDirection: "row",
    gap: 12,
    marginHorizontal: 8,
    marginBottom: 24,
  },
  addBtn: {
    flex: 1,
    backgroundColor: "#22c55e",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    shadowColor: "#22c55e",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  addBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  editBtn: {
    flex: 1,
    backgroundColor: "#154b99",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    shadowColor: "#154b99",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  editBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  deleteBtn: {
    flex: 1,
    backgroundColor: "#ef4444",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    shadowColor: "#ef4444",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  deleteBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  confirmModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  confirmModalCard: {
    width: "90%",
    maxWidth: 400,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  confirmModalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 12,
    textAlign: "center",
  },
  confirmModalMessage: {
    fontSize: 15,
    color: "#334155",
    marginBottom: 24,
    textAlign: "center",
    lineHeight: 22,
  },
  confirmModalButtons: {
    flexDirection: "row",
    gap: 12,
  },
  confirmModalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  confirmModalButtonCancel: {
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  confirmModalButtonCancelText: {
    color: "#334155",
    fontWeight: "600",
    fontSize: 15,
  },
  confirmModalButtonConfirm: {
    backgroundColor: "#154b99",
  },
  confirmModalButtonConfirmText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 15,
  },
  batchesModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  batchesModalCard: {
    width: "90%",
    maxWidth: 400,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  batchesModalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 16,
    textAlign: "center",
  },
  batchItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  batchLabel: {
    fontSize: 14,
    color: "#64748b",
  },
  batchValue: {
    fontWeight: "700",
    color: "#1e293b",
  },
  deleteBatchBtn: {
    backgroundColor: "#ef4444",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginLeft: 12,
  },
  deleteBatchText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },
  closeBatchesBtn: {
    backgroundColor: "#154b99",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 16,
  },
  closeBatchesText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  editBtnDisabled: {
    backgroundColor: "#cccccc", // Grey background
    opacity: 0.5,
  },
  editBtnTextDisabled: {
    color: "#666666", // Grey text
  },
  mortalityButtonContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginHorizontal: 8,
    marginBottom: 24,
  },
  mortalityBtn: {
    backgroundColor: "#E53935",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: "center",
    shadowColor: "#E53935",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  mortalityBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
});
