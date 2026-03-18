import React, { useState, useEffect, useRef, useCallback } from "react";
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
  Image,
  ImageBackground,
  Platform,
  Pressable,
} from "react-native";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import ChickIcon from "./ChickIcon";
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
  setDoc,
  updateDoc,
  onSnapshot,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  addDoc,
  serverTimestamp,
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
      daysCount: data.daysCount || 0, // Use value from daily increment system
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
      daysCount: data.daysCount || 0, // Use value from daily increment system
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

/**
 * Check if more than 2 days have passed since batch start date
 * @param {Object} batch - Batch document with startDate field
 * @returns {boolean} True if 2 or more days have passed since start date, false otherwise
 */
const isMoreThan2DaysAfterStart = (batch) => {
  try {
    if (!batch || !batch.startDate) {
      return false;
    }

    // Convert Firestore timestamp to Date if needed
    let startDate = batch.startDate;
    if (batch.startDate && typeof batch.startDate.toDate === "function") {
      startDate = batch.startDate.toDate();
    } else if (!(batch.startDate instanceof Date)) {
      startDate = new Date(batch.startDate);
    }

    const now = new Date();
    const diffMs = now - startDate;
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    return diffDays >= 2;
  } catch (error) {
    console.error("[IsMoreThan2DaysAfterStart] Error:", error);
    return false;
  }
};

/**
 * Check if a batch is ready for harvest (age >= harvestDays)
 * @param {Object} batch - Batch document with daysCount and harvestDays fields
 * @returns {boolean} True if batch age equals or exceeds harvest days, false otherwise
 */
const isBatchReadyForHarvest = (batch) => {
  try {
    if (!batch) {
      return false;
    }

    const daysCount = parseInt(batch.daysCount) || 0;
    const harvestDays = parseInt(batch.harvestDays) || 0;
    const status = batch.status || "active";

    // Only consider active batches
    if (status === "harvest") {
      return false;
    }

    const isReady = daysCount >= harvestDays && harvestDays > 0;

    if (isReady) {
      console.log(
        `[IsBatchReadyForHarvest] Batch ${batch.batchNumber} is ready for harvest: ${daysCount} >= ${harvestDays}`,
      );
    }

    return isReady;
  } catch (error) {
    console.error("[IsBatchReadyForHarvest] Error:", error);
    return false;
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
  const [viewAllPreselectedBatchId, setViewAllPreselectedBatchId] =
    useState(null);
  const [showMortalityModal, setShowMortalityModal] = useState(false);
  const [showHarvestedBatchModal, setShowHarvestedBatchModal] = useState(false);
  const [harvestedBatchInfo, setHarvestedBatchInfo] = useState({
    id: "",
    number: "",
  });
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
  const [showHarvestReadyModal, setShowHarvestReadyModal] = useState(false);
  const [harvestReadyBatchInfo, setHarvestReadyBatchInfo] = useState({
    id: "",
    number: "",
    daysCount: 0,
    harvestDays: 0,
    chicksCount: 0,
  });
  const [showHarvestConfirmation, setShowHarvestConfirmation] = useState(false);
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

  // Check if there are more harvest-ready batches and show the next one
  const checkAndShowNextHarvestReadyBatch = useCallback((updatedBatches) => {
    try {
      if (!updatedBatches || updatedBatches.length === 0) {
        console.log("[CheckNextHarvest] No batches available");
        return false;
      }

      console.log(
        `[CheckNextHarvest] Checking ${updatedBatches.length} batches for harvest readiness`,
      );

      // Find the next batch that is ready for harvest
      for (const batch of updatedBatches) {
        console.log(
          `[CheckNextHarvest] Batch ${batch.batchNumber}: status=${batch.status}, daysCount=${batch.daysCount}, harvestDays=${batch.harvestDays}`,
        );

        if (isBatchReadyForHarvest(batch)) {
          console.log(
            `[CheckNextHarvest] Found next harvest-ready batch: ${batch.batchNumber}`,
          );

          setHarvestReadyBatchInfo({
            id: batch.id,
            number: batch.batchNumber || batch.batchNo || "Unknown",
            daysCount: batch.daysCount || 0,
            harvestDays: batch.harvestDays || 0,
            chicksCount: batch.chicksCount || 0,
          });
          setShowHarvestReadyModal(true);

          return true;
        } else {
          console.log(
            `[CheckNextHarvest] Batch ${batch.batchNumber} is NOT ready for harvest`,
          );
        }
      }

      console.log("[CheckNextHarvest] No more harvest-ready batches found");
      return false;
    } catch (error) {
      console.error("[CheckNextHarvest] Error:", error);
      return false;
    }
  }, []);

  // Load saved data when component mounts
  useEffect(() => {
    const initializeApp = async () => {
      fetchUserName();
      setupSensorMonitoring();

      // Fetch all batches on initial load to populate the batches array
      const allBatches = await fetchBatches();
      setBatches(allBatches || []);
      setHasBatchData(allBatches && allBatches.length > 0);
      console.log(
        "[App] Batches fetched on mount:",
        allBatches ? allBatches.length : 0,
      );

      // Check if there's a previously selected batch
      const previouslySelectedBatchId = await getSelectedBatch();

      if (previouslySelectedBatchId) {
        // Restore previously selected batch
        console.log(
          "[App] Restoring previously selected batch:",
          previouslySelectedBatchId,
        );
        const previousBatch = await getBatchById(previouslySelectedBatchId);
        if (previousBatch) {
          updateBrooderCardFromBatch(
            previousBatch,
            setChicksCount,
            setDaysCount,
            setHarvestDays,
            setBrooderInfo,
            setHasBatchData,
          );
          const restoredIndex = allBatches.findIndex(
            (batch) => batch.id === previouslySelectedBatchId,
          );
          if (restoredIndex !== -1) {
            setSelectedBatchIndex(restoredIndex);
          }
          console.log(
            "[App] Restored previously selected batch:",
            previouslySelectedBatchId,
          );
        } else {
          // Previously selected batch was deleted, select latest
          console.log(
            "[App] Previously selected batch not found, selecting latest",
          );
          let latestBatch = null;
          if (allBatches && allBatches.length > 0) {
            latestBatch = allBatches[0];
          } else {
            latestBatch = await getLatestBatch();
          }

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
            if (allBatches.length > 0 && latestBatch.id === allBatches[0].id) {
              setSelectedBatchIndex(0);
            }
            console.log("[App] Latest batch loaded on mount:", latestBatch.id);
          }
        }
      } else {
        // No previous selection, select the latest batch
        console.log("[App] No previous selection, selecting latest batch");
        let latestBatch = null;
        if (allBatches && allBatches.length > 0) {
          latestBatch = allBatches[0];
        } else {
          latestBatch = await getLatestBatch();
        }

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
          if (allBatches.length > 0 && latestBatch.id === allBatches[0].id) {
            setSelectedBatchIndex(0);
          }
          console.log("[App] Latest batch loaded on mount:", latestBatch.id);
        }
      }

      // Set today's date
      const today = new Date();
      const formattedDate = today.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      setTodayDate(formattedDate);

      console.log("[App] Mounted and batches initialized");

      // Check for harvest ready batches immediately after initialization
      try {
        const todayGMT8 = getTodayDateGMT8();
        const lastHarvestModalShowDate = await AsyncStorage.getItem(
          "lastHarvestModalShowDate",
        );

        // Only show if we haven't shown the modal today
        if (lastHarvestModalShowDate !== todayGMT8) {
          const allBatches = await fetchBatches();
          if (allBatches && allBatches.length > 0) {
            // Check each batch for harvest readiness
            for (const batch of allBatches) {
              if (isBatchReadyForHarvest(batch)) {
                console.log(
                  `[App] Showing harvest ready modal for Batch ${batch.batchNumber} on first login`,
                );

                setHarvestReadyBatchInfo({
                  id: batch.id,
                  number: batch.batchNumber || batch.batchNo || "Unknown",
                  daysCount: batch.daysCount || 0,
                  harvestDays: batch.harvestDays || 0,
                  chicksCount: batch.chicksCount || 0,
                });
                setShowHarvestReadyModal(true);

                // Record that we've shown the harvest modal today
                await AsyncStorage.setItem(
                  "lastHarvestModalShowDate",
                  todayGMT8,
                );

                break; // Only show one harvest modal at a time
              }
            }
          }
        }
      } catch (error) {
        console.error("[App] Error checking harvest readiness:", error);
      }
    };

    initializeApp();

    // Check and increment all eligible batches every minute
    const interval = setInterval(() => {
      if (auth.currentUser) {
        incrementAllBatchesIfEligible();
      }
    }, 60000); // Check every 60 seconds

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
   * IMPORTANT: Does NOT change the selected batch - just refreshes its data
   */
  useFocusEffect(
    React.useCallback(() => {
      console.log("[ScreenFocus] Home screen came into focus");

      const refreshSelectedBatch = async () => {
        try {
          // Re-fetch all batches to ensure the array is fresh
          const allBatches = await fetchBatches();
          setBatches(allBatches || []);
          setHasBatchData(allBatches && allBatches.length > 0);
          console.log(
            "[ScreenFocus] Batches refreshed:",
            allBatches ? allBatches.length : 0,
          );

          // Get the currently selected batch ID from AsyncStorage
          const selectedBatchId = await getSelectedBatch();

          if (selectedBatchId) {
            console.log(
              "[ScreenFocus] Refreshing selected batch:",
              selectedBatchId,
            );
            // Fetch fresh batch data from Firestore
            const freshBatch = await getBatchById(selectedBatchId);

            if (freshBatch) {
              // Batch exists, update display with fresh data
              updateBrooderCardFromBatch(
                freshBatch,
                setChicksCount,
                setDaysCount,
                setHarvestDays,
                setBrooderInfo,
                setHasBatchData,
              );
              const refreshedIndex = allBatches.findIndex(
                (batch) => batch.id === selectedBatchId,
              );
              if (refreshedIndex !== -1) {
                setSelectedBatchIndex(refreshedIndex);
              }

              console.log(
                "[ScreenFocus] Refreshed selected batch:",
                selectedBatchId,
              );
            } else {
              // Selected batch was deleted, fallback to latest
              console.log(
                "[ScreenFocus] Selected batch was deleted, falling back to latest",
              );
              await setSelectedBatch(null);
              if (allBatches && allBatches.length > 0) {
                const latestBatch = allBatches[0];
                await setSelectedBatch(latestBatch.id);
                updateBrooderCardFromBatch(
                  latestBatch,
                  setChicksCount,
                  setDaysCount,
                  setHarvestDays,
                  setBrooderInfo,
                  setHasBatchData,
                );
                console.log(
                  "[ScreenFocus] Switched to latest batch:",
                  latestBatch.id,
                );
              } else {
                // No batches at all
                console.log("[ScreenFocus] No batches available, resetting UI");
                setChicksCount("0");
                setDaysCount("0");
                setHarvestDays("0");
                setHasBatchData(false);
              }
            }
          } else {
            // No batch selected (shouldn't happen after initialization, but handle it)
            console.log("[ScreenFocus] No batch selected, selecting latest");
            if (allBatches && allBatches.length > 0) {
              const latestBatch = allBatches[0];
              await setSelectedBatch(latestBatch.id);
              updateBrooderCardFromBatch(
                latestBatch,
                setChicksCount,
                setDaysCount,
                setHarvestDays,
                setBrooderInfo,
                setHasBatchData,
              );
              console.log(
                "[ScreenFocus] Selected latest batch:",
                latestBatch.id,
              );
            } else {
              // No batches at all
              console.log("[ScreenFocus] No batches available, resetting UI");
              setChicksCount("0");
              setDaysCount("0");
              setHarvestDays("0");
              setHasBatchData(false);
            }
          }
        } catch (error) {
          console.error("[ScreenFocus] Error refreshing batch:", error);
        }

        // Check if any active batches are ready for harvest
        try {
          const todayGMT8 = getTodayDateGMT8();
          const lastHarvestModalShowDate = await AsyncStorage.getItem(
            "lastHarvestModalShowDate",
          );

          console.log(
            `[ScreenFocus] Harvest check - Today: ${todayGMT8}, Last shown: ${lastHarvestModalShowDate}`,
          );

          // Only check if we haven't shown the modal today
          if (lastHarvestModalShowDate !== todayGMT8) {
            console.log(
              "[ScreenFocus] Date condition passed, checking batches for harvest readiness",
            );
            const allBatches = await fetchBatches();
            console.log(
              `[ScreenFocus] Fetched ${allBatches?.length || 0} batches`,
            );

            if (allBatches && allBatches.length > 0) {
              // Check each batch for harvest readiness
              for (const batch of allBatches) {
                console.log(
                  `[ScreenFocus] Checking batch ${batch.batchNumber}: status=${batch.status}, daysCount=${batch.daysCount}, harvestDays=${batch.harvestDays}`,
                );

                if (isBatchReadyForHarvest(batch)) {
                  console.log(
                    `[ScreenFocus] Showing harvest ready modal for Batch ${batch.batchNumber}`,
                  );

                  setHarvestReadyBatchInfo({
                    id: batch.id,
                    number: batch.batchNumber || batch.batchNo || "Unknown",
                    daysCount: batch.daysCount || 0,
                    harvestDays: batch.harvestDays || 0,
                    chicksCount: batch.chicksCount || 0,
                  });
                  setShowHarvestReadyModal(true);

                  // Record that we've shown the harvest modal today
                  await AsyncStorage.setItem(
                    "lastHarvestModalShowDate",
                    todayGMT8,
                  );

                  break; // Only show one harvest modal at a time
                } else {
                  console.log(
                    `[ScreenFocus] Batch ${batch.batchNumber} not ready: isBatchReadyForHarvest returned false`,
                  );
                }
              }
            } else {
              console.log("[ScreenFocus] No batches found to check");
            }
          } else {
            console.log(
              "[ScreenFocus] Modal already shown today, skipping harvest check",
            );
          }
        } catch (error) {
          console.error(
            "[ScreenFocus] Error checking harvest readiness:",
            error,
          );
        }
      };

      refreshSelectedBatch();
    }, []),
  );

  // ==================== AUTH STATE LISTENER: TRIGGER HARVEST CHECK ON LOGIN ====================
  /**
   * Monitor auth state changes to detect when user logs in
   * When a new user authenticates, trigger harvest readiness check
   * This ensures the harvest modal shows on logout/login flow and for different users
   * Key: Clears harvest modal date flag when user changes, allowing new users to see modal
   */
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        const currentUserId = user.uid;
        console.log("[AuthChange] User authenticated:", currentUserId);

        // Check if this is a different user (logout/login scenario)
        const previousUserId = await AsyncStorage.getItem(
          "lastAuthenticatedUserId",
        );

        if (previousUserId !== currentUserId) {
          console.log(
            `[AuthChange] User changed from ${previousUserId} to ${currentUserId}, clearing harvest modal date flag`,
          );
          // Clear the harvest modal date flag for new user
          await AsyncStorage.removeItem("lastHarvestModalShowDate");
          // Store the new user ID
          await AsyncStorage.setItem("lastAuthenticatedUserId", currentUserId);
        } else {
          console.log(
            `[AuthChange] Same user re-authenticated (${currentUserId}), keeping harvest date flag`,
          );
        }

        // Trigger harvest readiness check on new authentication
        try {
          const todayGMT8 = getTodayDateGMT8();
          const lastHarvestModalShowDate = await AsyncStorage.getItem(
            "lastHarvestModalShowDate",
          );

          console.log(
            `[AuthChange] Harvest check - Today: ${todayGMT8}, Last shown: ${lastHarvestModalShowDate}`,
          );

          // Only show if we haven't shown the modal today
          if (lastHarvestModalShowDate !== todayGMT8) {
            console.log(
              "[AuthChange] Date condition passed, fetching batches for harvest check",
            );
            const allBatches = await fetchBatches();
            console.log(
              `[AuthChange] Fetched ${allBatches?.length || 0} batches`,
            );

            if (allBatches && allBatches.length > 0) {
              // Check each batch for harvest readiness
              for (const batch of allBatches) {
                console.log(
                  `[AuthChange] Checking batch ${batch.batchNumber}: status=${batch.status}, daysCount=${batch.daysCount}, harvestDays=${batch.harvestDays}`,
                );

                if (isBatchReadyForHarvest(batch)) {
                  console.log(
                    `[AuthChange] Batch ${batch.batchNumber} is ready for harvest! Showing modal.`,
                  );

                  setHarvestReadyBatchInfo({
                    id: batch.id,
                    number: batch.batchNumber || batch.batchNo || "Unknown",
                    daysCount: batch.daysCount || 0,
                    harvestDays: batch.harvestDays || 0,
                    chicksCount: batch.chicksCount || 0,
                  });
                  setShowHarvestReadyModal(true);

                  // Record that we've shown the harvest modal today
                  await AsyncStorage.setItem(
                    "lastHarvestModalShowDate",
                    todayGMT8,
                  );

                  break; // Only show one harvest modal at a time
                } else {
                  console.log(
                    `[AuthChange] Batch ${batch.batchNumber} not ready: isBatchReadyForHarvest returned false`,
                  );
                }
              }
            } else {
              console.log("[AuthChange] No batches found to check");
            }
          } else {
            console.log(
              "[AuthChange] Modal already shown today, skipping harvest check",
            );
          }
        } catch (error) {
          console.error(
            "[AuthChange] Error checking harvest readiness:",
            error,
          );
        }
      } else {
        console.log(
          "[AuthChange] User logged out, clearing harvest modal date flag",
        );
        // Clear the harvest modal date flag on logout
        // This ensures that when any user logs in again, the modal will show
        await AsyncStorage.removeItem("lastHarvestModalShowDate");
      }
    });

    return () => unsubscribe();
  }, []);

  // ==================== SYNC SELECTED BATCH INDEX ====================
  /**
   * After batches are fetched, find the index of the currently displayed batch
   * This keeps selectedBatchIndex in sync with the actual batch ID being displayed
   */
  useEffect(() => {
    let isActive = true;

    const syncSelectedBatchIndex = async () => {
      if (!isActive) {
        return;
      }

      if (batches.length === 0 && !hasBatchData) {
        // Only reset if we truly have no data
        console.log("[SyncIndex] No batches and no batch data, resetting UI");
        setChicksCount("0");
        setDaysCount("0");
        setHarvestDays("0");
        setSelectedBatchIndex(null);
        return;
      }

      if (batches.length === 0) {
        return;
      }

      const selectedBatchId = await getSelectedBatch();
      if (!isActive) {
        return;
      }

      if (selectedBatchId) {
        const indexById = batches.findIndex(
          (batch) => batch.id === selectedBatchId,
        );
        if (indexById !== -1) {
          setSelectedBatchIndex(indexById);
          return;
        }
      }

      if (chicksCount !== "0") {
        // Fall back to matching current display data
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
    };

    syncSelectedBatchIndex();

    return () => {
      isActive = false;
    };
  }, [batches, hasBatchData, chicksCount, daysCount, harvestDays]);

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

      // Query for the latest batch ordered by batchNumber descending
      const q = query(
        collection(firestoreDb, "brooderInfo"),
        orderBy("batchNumber", "desc"),
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        console.log("No brooder batches found in Firestore");
        setBrooderInfoError("No brooder information available");
        setChicksCount("0");
        setDaysCount("0");
        setHarvestDays("0");
      } else {
        // Get the latest batch (first document after ordering by batchNumber desc)
        const latestBatchDoc = querySnapshot.docs[0];
        const data = latestBatchDoc.data();

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
          "[FetchBrooderInfo] Latest batch fetched from Firestore:",
          latestBatchDoc.id,
          data,
        );

        // Check and perform daily age auto-increment
        const daysNum = parseInt(fetchedDaysCount);
        if (!isNaN(daysNum)) {
          await checkAndIncrementDailyAge(daysNum);
        }
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
        console.log(
          "[UpdateBrooderInfo] Updated batch:",
          latestDoc.id,
          updateData,
        );
        return true;
      } else {
        console.error("[UpdateBrooderInfo] No batch found to update");
        return false;
      }
    } catch (error) {
      console.error("Error updating brooder info in Firestore:", error);
      return false;
    }
  };

  const getTodayDateGMT8 = () => {
    // Get current date in GMT+8 timezone (YYYY-MM-DD format)
    const now = new Date();
    // Convert local time to UTC, then to GMT+8
    const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
    const gmt8Ms = utcMs + 8 * 60 * 60 * 1000;
    const gmt8Date = new Date(gmt8Ms);

    const year = gmt8Date.getFullYear();
    const month = String(gmt8Date.getMonth() + 1).padStart(2, "0");
    const day = String(gmt8Date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  /**
   * Get user information from Firestore
   */
  const getUserInfo = async (userId) => {
    try {
      const userDocRef = doc(firestoreDb, "users", userId);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        return {
          firstname: userData.firstName || "Unknown",
          lastname: userData.lastName || "Unknown",
        };
      } else {
        console.warn("[GetUserInfo] User document not found for:", userId);
        return {
          firstname: "Unknown",
          lastname: "Unknown",
        };
      }
    } catch (error) {
      console.error("[GetUserInfo] Error fetching user info:", error);
      return {
        firstname: "Unknown",
        lastname: "Unknown",
      };
    }
  };

  /**
   * Log harvested event to activity_logs collection
   * Records batch harvested actions for audit trail
   * Stores in: activity_logs/batchHarvested
   */
  const logHarvestedEvent = async (
    userId,
    firstName,
    lastName,
    batchId,
    batchNumber,
  ) => {
    try {
      const eventData = {
        userId: userId,
        batchId: batchId,
        action: `Harvested Batch ${batchNumber} `,
        description: `Batch ${batchNumber} has been harvested.`,
        timestamp: serverTimestamp(),
        deviceInfo: Platform.OS,
        firstName: firstName,
        lastName: lastName,
      };

      // Add document to activity_logs/batchHarvested collection
      const docRef = await addDoc(
        collection(firestoreDb, "activity_logs", "batchHarvested", "records"),
        eventData,
      );

      console.log("[LogHarvestedEvent] Event logged successfully:", docRef.id);
      return { success: true, logId: docRef.id };
    } catch (error) {
      console.error("[LogHarvestedEvent] Error logging event:", error);
      // Don't throw - logging failure shouldn't block batch harvested action
      return { success: false, error: error.message };
    }
  };

  /**
   * Mark a batch as harvested and stop age counting
   * Prevents further age increments and removes from selectable batches
   * @param {string} batchId - The batch document ID to mark as harvested
   * @param {object} batchData - The batch object containing batchNumber and chicksCount
   */
  const markBatchAsHarvested = async (batchId, batchData = null) => {
    try {
      if (!batchId) {
        console.error("[MarkHarvested] No batchId provided");
        return false;
      }

      await updateDoc(doc(firestoreDb, "brooderInfo", batchId), {
        status: "harvest",
        harvestedDate: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      console.log("[MarkHarvested] Batch marked as harvested:", batchId);

      // Log the harvested event
      const currentUser = auth.currentUser;
      if (currentUser) {
        const userInfo = await getUserInfo(currentUser.uid);
        logHarvestedEvent(
          currentUser.uid,
          userInfo.firstname,
          userInfo.lastname,
          batchId,
          batchData?.batchNumber || batchData?.batchNo || "Unknown",
        );
      }

      // Refresh batches list
      const allBatches = await fetchBatches();
      setBatches(allBatches || []);

      // If the harvested batch was selected, switch to the first active batch
      const selectedBatchId = await getSelectedBatch();
      if (selectedBatchId === batchId) {
        const activeBatches = allBatches.filter((b) => b.status !== "harvest");
        if (activeBatches.length > 0) {
          await setSelectedBatch(activeBatches[0].id);
          updateBrooderCardFromBatch(
            activeBatches[0],
            setChicksCount,
            setDaysCount,
            setHarvestDays,
            setBrooderInfo,
            setHasBatchData,
          );
          setSelectedBatchIndex(0);
          console.log(
            "[MarkHarvested] Switched to active batch:",
            activeBatches[0].id,
          );
        } else {
          // No active batches left
          await resetBrooderUI();
          setHasBatchData(false);
          console.log("[MarkHarvested] No active batches remaining");
        }
      }

      // Show success modal and auto-close after 1.5 seconds
      setHarvestedBatchInfo({
        id: batchId,
        batchNumber: batchData?.batchNumber || batchData?.batchNo || "Unknown",
        chicksCount: batchData?.chicksCount || 0,
      });
      setShowHarvestedBatchModal(true);

      // Auto-close modal after 1.5 seconds and check for next harvest-ready batch
      setTimeout(async () => {
        setShowHarvestedBatchModal(false);
        // Refetch the latest batches to ensure we have updated status
        const latestBatches = await fetchBatches();
        // Check if there's another batch ready for harvest and show it
        checkAndShowNextHarvestReadyBatch(latestBatches || []);
      }, 1500);

      return true;
    } catch (error) {
      console.error("[MarkHarvested] Error marking batch as harvested:", error);
      Alert.alert("Error", "Failed to mark batch as harvested");
      return false;
    }
  };

  /**
   * Increment age for all active batches (not harvested) that haven't been incremented today
   * Checks each batch's last update date and only increments eligible batches
   */
  const incrementAllBatchesIfEligible = async () => {
    try {
      const todayGMT8 = getTodayDateGMT8();
      console.log(
        `[IncrementAll] Starting daily age check for all batches. Today: ${todayGMT8}`,
      );

      // Fetch all batches from Firestore
      const allBatches = await fetchBatches();

      if (!allBatches || allBatches.length === 0) {
        console.log("[IncrementAll] No batches found to increment");
        return;
      }

      // Process each batch
      for (const batch of allBatches) {
        try {
          const batchId = batch.id;
          const currentDaysCount = batch.daysCount || 0;
          const lastIncrementDate = batch.lastIncrementDate || null;
          const status = batch.status || "active";

          console.log(
            `[IncrementAll] Processing Batch ${batchId}: daysCount=${currentDaysCount}, status=${status}, lastUpdate=${lastIncrementDate}`,
          );

          // Skip if batch is harvested
          if (status === "harvest") {
            console.log(
              `[IncrementAll] ⛔ Batch ${batchId} is harvested, skipping`,
            );
            continue;
          }

          // Check if batch is eligible for increment (not incremented today)
          if (lastIncrementDate !== todayGMT8) {
            const newDaysCount = currentDaysCount + 1;

            await updateDoc(doc(firestoreDb, "brooderInfo", batchId), {
              daysCount: newDaysCount,
              lastIncrementDate: todayGMT8,
              updatedAt: new Date().toISOString(),
            });

            console.log(
              `[IncrementAll] ✅ Batch ${batchId} incremented: ${currentDaysCount} → ${newDaysCount}`,
            );

            // If this is the currently selected batch, update local state
            const selectedBatchId = await getSelectedBatch();
            if (selectedBatchId === batchId) {
              setDaysCount(String(newDaysCount));
              setBrooderInfo((prev) => ({
                ...prev,
                daysCount: newDaysCount,
              }));
              console.log(
                `[IncrementAll] Updated selected batch in local state`,
              );
            }
          } else {
            console.log(
              `[IncrementAll] ⏸️  Batch ${batchId} skipped: already incremented today`,
            );
          }
        } catch (error) {
          console.error(
            `[IncrementAll] Error processing batch ${batch.id}:`,
            error,
          );
          continue; // Continue with next batch even if one fails
        }
      }

      console.log("[IncrementAll] Daily age increment check completed");
    } catch (error) {
      console.error("[IncrementAll] Error incrementing all batches:", error);
    }
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
      console.log("[ViewAllBatches] Opening batches modal");

      // Refresh all batches from Firestore when opening modal
      const refreshedBatches = await fetchAllBatchesFromFirestore();

      // Get the currently selected batch ID from AsyncStorage
      const currentSelectedBatchId = await getSelectedBatch();

      // Find the index of the currently selected batch in the refreshed list
      let currentBatchIndex = null;
      let preselectedBatchId = null;
      if (
        currentSelectedBatchId &&
        refreshedBatches &&
        refreshedBatches.length > 0
      ) {
        currentBatchIndex = refreshedBatches.findIndex(
          (batch) => batch.id === currentSelectedBatchId,
        );
        if (currentBatchIndex !== -1) {
          preselectedBatchId = currentSelectedBatchId;
        }
        console.log(
          "[ViewAllBatches] Current batch ID:",
          currentSelectedBatchId,
          "Index:",
          currentBatchIndex,
        );
      }

      // If we found the batch, set the selectedBatchIndex before opening modal
      if (currentBatchIndex !== -1 && currentBatchIndex !== null) {
        setSelectedBatchIndex(currentBatchIndex);
        console.log(
          "[ViewAllBatches] Set selectedBatchIndex to:",
          currentBatchIndex,
        );
      } else {
        // If not found, check if we have a displayed batch and find its index
        console.log(
          "[ViewAllBatches] Current batch not found, checking displayed batch",
        );
        if (
          chicksCount !== "0" &&
          refreshedBatches &&
          refreshedBatches.length > 0
        ) {
          const displayedBatchIndex = refreshedBatches.findIndex(
            (batch) =>
              String(batch.chicksCount) === chicksCount &&
              String(batch.daysCount) === daysCount &&
              String(batch.harvestDays) === harvestDays,
          );
          if (displayedBatchIndex !== -1) {
            setSelectedBatchIndex(displayedBatchIndex);
            preselectedBatchId = refreshedBatches[displayedBatchIndex].id;
            console.log(
              "[ViewAllBatches] Set selectedBatchIndex to displayed batch:",
              displayedBatchIndex,
            );
          }
        }
      }

      setViewAllPreselectedBatchId(preselectedBatchId);

      // Open modal after batches are loaded and index is set
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

  const handleHarvestedBatch = async (batchId) => {
    try {
      console.log(
        "[HandleHarvestedBatch] Marking batch as harvested:",
        batchId,
      );
      // Find batch details to pass to markBatchAsHarvested
      const batchToHarvest = batches.find((b) => b.id === batchId);
      await markBatchAsHarvested(batchId, batchToHarvest);
      setShowBatchesModal(false);
    } catch (error) {
      console.error(
        "[HandleHarvestedBatch] Error marking batch as harvested:",
        error,
      );
      Alert.alert("Error", "Failed to mark batch as harvested");
    }
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
      // Wait a brief moment to ensure Firestore has processed the batch creation
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Refetch all batches from Firestore to get the newly created batch with its ID
      const updatedBatches = await fetchBatches();
      console.log(
        "[HandleSaveBatch] Refetched batches after creation:",
        updatedBatches ? updatedBatches.length : 0,
      );

      if (updatedBatches && updatedBatches.length > 0) {
        // The newly created batch should be the latest one (first in the array)
        // based on the fetchBatches query ordering
        const newlyCreatedBatch = updatedBatches[0];

        // Update state with fetched batches
        setBatches(updatedBatches);
        setSelectedBatchIndex(0); // First batch is the newly created one
        setChicksCount(String(newlyCreatedBatch.chicksCount || 0));
        setDaysCount(String(newlyCreatedBatch.daysCount || 0));
        setHarvestDays(String(newlyCreatedBatch.harvestDays || 0));
        setHasBatchData(true);

        // Save selected batch ID and index to AsyncStorage
        await setSelectedBatch(newlyCreatedBatch.id);
        await AsyncStorage.setItem("selectedBatchIndex", "0");
        await AsyncStorage.setItem(
          "chicksCount",
          String(newlyCreatedBatch.chicksCount || 0),
        );
        await AsyncStorage.setItem(
          "daysCount",
          String(newlyCreatedBatch.daysCount || 0),
        );
        await AsyncStorage.setItem(
          "harvestDays",
          String(newlyCreatedBatch.harvestDays || 0),
        );
        await AsyncStorage.setItem(
          "batchStartDate",
          newlyCreatedBatch.startDate || "",
        );

        console.log(
          "[HandleSaveBatch] Successfully set newly created batch as selected:",
          newlyCreatedBatch.id,
        );
      } else {
        console.warn("[HandleSaveBatch] No batches found after creation");
      }
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
    // Only refresh the batches list, don't overwrite selected batch display
    // (handleMortalitySuccess already refreshed the selected batch with correct age)
    await fetchAllBatchesFromFirestore();
  };

  const handleMortalitySuccess = async (batchNumber) => {
    try {
      // Refresh the currently selected batch after mortality is reported
      const selectedBatchId = await getSelectedBatch();

      if (selectedBatchId) {
        // Fetch fresh batch data from Firestore
        const freshBatch = await getBatchById(selectedBatchId);

        if (freshBatch) {
          // Update brooder card with fresh batch data (age will be recalculated)
          updateBrooderCardFromBatch(
            freshBatch,
            setChicksCount,
            setDaysCount,
            setHarvestDays,
            setBrooderInfo,
            setHasBatchData,
          );

          // Refresh batches array
          const refreshedBatches = await fetchBatches();
          setBatches(refreshedBatches || []);

          // Update selectedBatchIndex to match the refreshed batch
          const updatedIndex = (refreshedBatches || []).findIndex(
            (batch) => batch.id === selectedBatchId,
          );
          if (updatedIndex !== -1) {
            setSelectedBatchIndex(updatedIndex);
          }

          console.log(
            "[MortalitySuccess] Refreshed batch after mortality report:",
            selectedBatchId,
          );
        }
      }

      setToastMessage(`Mortality reported for Batch ${batchNumber}`);
      setShowToast(true);
    } catch (error) {
      console.error("[MortalitySuccess] Error refreshing batch:", error);
      setToastMessage(`Mortality reported for Batch ${batchNumber}`);
      setShowToast(true);
    }
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
          {/* Welcome Section with header background */}
          <ImageBackground
            source={require("../../../assets/istockphoto-172476350-612x612.jpg")}
            style={styles.welcomeBackground}
            resizeMode="cover"
          >
            <View style={styles.welcomeOverlay} pointerEvents="none" />
            <View style={styles.welcomeSection}>
              <Text style={styles.greeting}>
                Hello, {userName}!{" "}
                <MaterialCommunityIcons
                  name="hand-wave-outline"
                  size={24}
                  color="#ffffff"
                />
              </Text>
              <Text style={styles.date}>{todayDate}</Text>
            </View>
          </ImageBackground>

          <View style={styles.container}>
            {/* System Status Card */}
            <View style={styles.statusCard}>
              <View style={styles.statusHeader}>
                <View>
                  <Text style={styles.statusLabel}>System Status</Text>
                  <Text style={styles.statusText}>All Systems Normal</Text>
                </View>
                <MaterialCommunityIcons
                  name="lightning-bolt-outline"
                  size={34}
                  color="#133E87"
                  style={{ marginLeft: 10 }}
                />
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
                <View style={styles.brooderIconWrapper}>
                  <ChickIcon size={28} color="#133E87" />
                </View>
                <View style={styles.brooderTextContainer}>
                  <Text style={styles.brooderLabel}>Total Chicks</Text>
                  <Text style={styles.brooderValue}>{chicksCount || "0"}</Text>
                </View>
              </View>

              <View style={styles.brooderDivider} />

              <View style={styles.brooderRow}>
                <View style={styles.brooderIconWrapper}>
                  <MaterialCommunityIcons
                    name="calendar-clock"
                    size={24}
                    color="#133E87"
                  />
                </View>
                <View style={styles.brooderTextContainer}>
                  <Text style={styles.brooderLabel}>Age</Text>
                  <Text style={styles.brooderValue}>
                    {daysCount && parseInt(daysCount) > 1
                      ? `${daysCount} days`
                      : `${daysCount || "0"} day`}
                  </Text>
                </View>
              </View>

              <View style={styles.brooderDivider} />

              <View style={styles.brooderRow}>
                <View style={styles.brooderIconWrapper}>
                  <MaterialCommunityIcons
                    name="target"
                    size={24}
                    color="#133E87"
                  />
                </View>
                <View style={styles.brooderTextContainer}>
                  <Text style={styles.brooderLabel}>Expected Harvest</Text>
                  <Text style={styles.brooderValue}>
                    {harvestDays && parseInt(harvestDays) > 1
                      ? `${harvestDays} days`
                      : `${harvestDays || "0"} day`}
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
                  (chicksCount === "0" ||
                    (selectedBatchIndex !== null &&
                      batches[selectedBatchIndex]?.mortalityCount > 0) ||
                    (selectedBatchIndex !== null &&
                      isMoreThan2DaysAfterStart(
                        batches[selectedBatchIndex],
                      ))) &&
                    styles.editBtnDisabled,
                ]}
                activeOpacity={0.9}
                onPress={() => {
                  // If no batch displayed, show error
                  if (chicksCount === "0") {
                    Alert.alert(
                      "No Batch Available",
                      "Please add a batch first to edit.",
                    );
                    return;
                  }

                  // Find the batch that matches the currently displayed data
                  const matchingBatchIndex = batches.findIndex(
                    (batch) =>
                      String(batch.chicksCount) === chicksCount &&
                      String(batch.daysCount) === daysCount &&
                      String(batch.harvestDays) === harvestDays,
                  );

                  if (matchingBatchIndex === -1) {
                    Alert.alert("Error", "Could not find batch to edit");
                    return;
                  }

                  // Check if mortality exists
                  if (batches[matchingBatchIndex]?.mortalityCount > 0) {
                    Alert.alert(
                      "Cannot Edit",
                      "This batch has mortality records. Editing is disabled to preserve data accuracy.",
                    );
                    return;
                  }

                  // Check if more than 2 days have passed since start date
                  if (isMoreThan2DaysAfterStart(batches[matchingBatchIndex])) {
                    Alert.alert(
                      "Cannot Edit",
                      "This batch is more than 2 days old. Editing is disabled to preserve historical data accuracy.",
                    );
                    return;
                  }

                  // Edit the matching batch
                  handleEditBatch(matchingBatchIndex);
                }}
                disabled={
                  chicksCount === "0" ||
                  (selectedBatchIndex !== null &&
                    batches[selectedBatchIndex]?.mortalityCount > 0) ||
                  (selectedBatchIndex !== null &&
                    isMoreThan2DaysAfterStart(batches[selectedBatchIndex]))
                }
              >
                <Text
                  style={[
                    styles.editBtnText,
                    (chicksCount === "0" ||
                      (selectedBatchIndex !== null &&
                        batches[selectedBatchIndex]?.mortalityCount > 0) ||
                      (selectedBatchIndex !== null &&
                        isMoreThan2DaysAfterStart(
                          batches[selectedBatchIndex],
                        ))) &&
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
                style={[
                  styles.mortalityBtn,
                  chicksCount === "0" && styles.mortalityBtnDisabled,
                ]}
                activeOpacity={0.9}
                onPress={handleOpenMortalityModal}
                disabled={chicksCount === "0"}
              >
                <Text
                  style={[
                    styles.mortalityBtnText,
                    chicksCount === "0" && styles.mortalityBtnTextDisabled,
                  ]}
                >
                  Report Loss
                </Text>
              </TouchableOpacity>
            </View>

            {/* Sensor Monitoring Grid */}
            <Text style={styles.sectionTitle}>Live Monitoring</Text>
            <View style={styles.sensorGrid}>
              {/* Water Level Card */}
              <View style={styles.sensorCard}>
                <MaterialCommunityIcons
                  name="water-outline"
                  size={32}
                  color="#133E87"
                />
                <Text style={styles.sensorLabel}>Water Level</Text>
                <Text style={styles.sensorValue}>
                  {loadingSensorData ? "..." : `${sensorData.waterLevel}%`}
                </Text>
              </View>

              {/* Feed Level Card */}
              <View style={styles.sensorCard}>
                <MaterialCommunityIcons
                  name="seed-outline"
                  size={32}
                  color="#133E87"
                />
                <Text style={styles.sensorLabel}>Feed Level</Text>
                <Text style={styles.sensorValue}>
                  {loadingSensorData ? "..." : `${sensorData.feedLevel}%`}
                </Text>
              </View>

              {/* Solar Charge Card */}
              <View style={styles.sensorCard}>
                <View style={{ marginTop: 8, marginBottom: 4 }}>
                  <MaterialCommunityIcons
                    name="white-balance-sunny"
                    size={32}
                    color="#133E87"
                  />
                </View>
                <Text style={styles.sensorLabel}>Solar Charge</Text>
                <Text style={styles.sensorValue}>
                  {loadingSensorData ? "..." : `${sensorData.solarCharge}%`}
                </Text>
              </View>

              {/* Light Status Card */}
              <View style={styles.sensorCard}>
                <View style={{ marginTop: 8, marginBottom: 4 }}>
                  <MaterialCommunityIcons
                    name="lightbulb-on-outline"
                    size={32}
                    color="#133E87"
                  />
                </View>
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
              preSelectedBatchId={viewAllPreselectedBatchId}
              onSelectBatch={handleSelectBatch}
              onDeleteBatch={handleDeleteBatch}
              onEditBatch={handleEditBatch}
              onHarvestedBatch={handleHarvestedBatch}
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
              preSelectedBatchId={
                selectedBatchIndex !== null &&
                selectedBatchIndex < batches.length
                  ? batches[selectedBatchIndex].id
                  : null
              }
              currentCalculatedAge={parseInt(daysCount) || 0}
              onClose={handleCloseMortalityModal}
              onSuccess={handleMortalitySuccess}
            />

            {/* Harvest Ready Modal */}
            <Modal
              visible={showHarvestReadyModal}
              transparent
              animationType="fade"
              onRequestClose={() => setShowHarvestReadyModal(false)}
            >
              <Pressable
                style={styles.overlay}
                onPress={() => setShowHarvestReadyModal(false)}
              >
                <Pressable
                  style={styles.harvestModalCard}
                  onPress={(e) => e.stopPropagation()}
                >
                  <Text style={styles.harvestIconLarge}>🐔</Text>
                  <Text style={styles.harvestTitleLarge}>
                    Ready for Harvest!
                  </Text>
                  <Text style={styles.harvestMessageLarge}>
                    Batch {harvestReadyBatchInfo.number} with{" "}
                    {harvestReadyBatchInfo.chicksCount} chicken
                    {harvestReadyBatchInfo.chicksCount !== 1 ? "s" : ""} has
                    reached {harvestReadyBatchInfo.daysCount} days.
                  </Text>
                  <Text style={styles.harvestQuestionText}>
                    Do you want to harvest now?
                  </Text>

                  <View style={styles.harvestActionButtons}>
                    <TouchableOpacity
                      style={styles.harvestLaterBtn}
                      activeOpacity={0.8}
                      onPress={() => {
                        // Date already recorded when modal opened, just close it
                        setShowHarvestReadyModal(false);
                      }}
                    >
                      <Text style={styles.harvestLaterBtnText}>Not Yet</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.harvestNowBtn}
                      activeOpacity={0.8}
                      onPress={() => {
                        setShowHarvestReadyModal(false);
                        setShowHarvestConfirmation(true);
                      }}
                    >
                      <Text style={styles.harvestNowBtnText}>Yes, Harvest</Text>
                    </TouchableOpacity>
                  </View>
                </Pressable>
              </Pressable>
            </Modal>

            {/* Harvest Confirmation Modal */}
            <Modal
              visible={showHarvestConfirmation}
              transparent
              animationType="fade"
              onRequestClose={() => setShowHarvestConfirmation(false)}
            >
              <Pressable
                style={styles.overlay}
                onPress={() => setShowHarvestConfirmation(false)}
              >
                <Pressable
                  style={styles.confirmModalCard}
                  onPress={(e) => e.stopPropagation()}
                >
                  <Text style={styles.confirmIconText}>⚠️</Text>
                  <Text style={styles.confirmTitleText}>Confirm Harvest</Text>
                  <Text style={styles.confirmMessageText}>
                    Are you sure you want to harvest Batch{" "}
                    {harvestReadyBatchInfo.number} with{" "}
                    {harvestReadyBatchInfo.chicksCount} chicken
                    {harvestReadyBatchInfo.chicksCount !== 1 ? "s" : ""}?
                  </Text>
                  <Text style={styles.confirmWarningText}>
                    This action cannot be undone.
                  </Text>

                  <View style={styles.confirmActionButtons}>
                    <TouchableOpacity
                      style={styles.confirmCancelButton}
                      activeOpacity={0.8}
                      onPress={() => {
                        setShowHarvestConfirmation(false);
                        setShowHarvestReadyModal(false);
                      }}
                    >
                      <Text style={styles.confirmCancelButtonText}>Cancel</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.confirmProceedButton}
                      activeOpacity={0.8}
                      onPress={async () => {
                        try {
                          setShowHarvestConfirmation(false);
                          const batchToHarvest = batches.find(
                            (b) => b.id === harvestReadyBatchInfo.id,
                          );
                          await markBatchAsHarvested(
                            harvestReadyBatchInfo.id,
                            batchToHarvest,
                          );
                        } catch (error) {
                          console.error("[HarvestConfirm] Error:", error);
                          Alert.alert("Error", "Failed to harvest batch");
                        }
                      }}
                    >
                      <Text style={styles.confirmProceedButtonText}>Yes</Text>
                    </TouchableOpacity>
                  </View>
                </Pressable>
              </Pressable>
            </Modal>

            {/* Harvested Batch Success Modal */}
            <Modal
              visible={showHarvestedBatchModal}
              transparent
              animationType="fade"
            >
              <View style={styles.overlay}>
                <View style={styles.successModalCard}>
                  <Text style={styles.successIcon}>✓</Text>
                  <Text style={styles.confirmTitleText}>
                    Harvested Successfully!
                  </Text>
                  <Text style={styles.successMessage}>
                    Batch {harvestedBatchInfo?.batchNumber} -{" "}
                    {harvestedBatchInfo?.chicksCount}{" "}
                    {harvestedBatchInfo?.chicksCount === 1
                      ? "chicken"
                      : "chickens"}
                  </Text>
                </View>
              </View>
            </Modal>

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
  welcomeBackground: {
    paddingTop: 24,
    paddingBottom: 70,
    paddingHorizontal: 16,
  },
  welcomeOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.38)",
  },
  container: {
    backgroundColor: "transparent",
    padding: 16,
    marginTop: -55,
  },
  welcomeSection: {},
  greeting: {
    fontSize: 28,
    fontWeight: "800",
    color: "#ffffff",
    marginBottom: 4,
    letterSpacing: -0.5,
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  date: {
    fontSize: 15,
    color: "rgba(255,255,255,0.9)",
    fontWeight: "600",
    textShadowColor: "rgba(0,0,0,0.2)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
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
    alignItems: "center",
    overflow: "visible",
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
  },
  brooderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  brooderIconWrapper: {
    marginRight: 12,
    justifyContent: "center",
    alignItems: "center",
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
  },
  mortalityBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  mortalityBtnDisabled: {
    backgroundColor: "#cccccc",
    opacity: 0.5,
    shadowOpacity: 0.1,
  },
  mortalityBtnTextDisabled: {
    color: "#666666",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  successModalCard: {
    width: "85%",
    maxWidth: 320,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  successIcon: {
    fontSize: 48,
    color: "#10b981",
    marginBottom: 12,
    fontWeight: "bold",
  },
  successTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 8,
    textAlign: "center",
  },
  successMessage: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 20,
  },
  harvestedDetailsText: {
    fontSize: 16,
    color: "#64748b",
    marginTop: 12,
    fontWeight: "500",
  },
  harvestModalCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 28,
    width: "85%",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
  harvestIconLarge: {
    fontSize: 64,
    marginBottom: 16,
  },
  harvestTitleLarge: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 12,
    textAlign: "center",
  },
  harvestMessageLarge: {
    fontSize: 16,
    color: "#475569",
    textAlign: "center",
    marginBottom: 8,
    lineHeight: 24,
  },
  harvestQuestionText: {
    fontSize: 15,
    color: "#64748b",
    marginBottom: 24,
    fontStyle: "italic",
  },
  harvestActionButtons: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
    marginTop: 8,
  },
  harvestLaterBtn: {
    flex: 1,
    backgroundColor: "#e5e7eb",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#e5e7eb",
  },
  harvestLaterBtnText: {
    color: "#475569",
    fontWeight: "600",
    fontSize: 15,
  },
  harvestNowBtn: {
    flex: 1,
    backgroundColor: "#16a34a",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  harvestNowBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
  confirmModalCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 28,
    width: "85%",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
  confirmIconText: {
    fontSize: 56,
    marginBottom: 16,
  },
  confirmTitleText: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 12,
    textAlign: "center",
  },
  confirmMessageText: {
    fontSize: 16,
    color: "#475569",
    textAlign: "center",
    marginBottom: 8,
    lineHeight: 24,
  },
  confirmWarningText: {
    fontSize: 14,
    color: "#ef4444",
    marginBottom: 24,
    textAlign: "center",
  },
  confirmActionButtons: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
    marginTop: 8,
  },
  confirmCancelButton: {
    flex: 1,
    backgroundColor: "#e5e7eb",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#e5e7eb",
  },
  confirmCancelButtonText: {
    color: "#475569",
    fontWeight: "600",
    fontSize: 15,
    textAlign: "center",
  },
  confirmProceedButton: {
    flex: 1,
    backgroundColor: "#dc2626",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  confirmProceedButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
    textAlign: "center",
  },
});
