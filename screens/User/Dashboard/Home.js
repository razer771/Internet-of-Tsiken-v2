import React, { useState, useEffect } from "react";
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
import { auth, db } from "../../../config/firebaseconfig";
import { doc, getDoc } from "firebase/firestore";
import {
  initializeSensors,
  getAllSensorReadings,
  startSensorPolling,
} from "../../../modules/UltrasonicSensorService";
import { configureWaterSystemUserId } from "../../../modules/ServoMotorService";

// Replace static import with a dynamic require + in-memory fallback.
// This avoids a crash when @react-native-async-storage/async-storage is not installed.

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
  const [showChangesSaved, setShowChangesSaved] = useState(false);
  const [chicksCount, setChicksCount] = useState("");
  const [daysCount, setDaysCount] = useState("");
  const [harvestDays, setHarvestDays] = useState("");
  const [todayDate, setTodayDate] = useState("");
  const [showQuickSetup, setShowQuickSetup] = useState(false);
  const [showConfirmReplace, setShowConfirmReplace] = useState(false);
  const [hasBatchData, setHasBatchData] = useState(false);
  const [userName, setUserName] = useState("User");
  const [currentBatchId, setCurrentBatchId] = useState(null);
  const [addBatchDisabled, setAddBatchDisabled] = useState(false);
  const [lastAgeEdit, setLastAgeEdit] = useState(null);

  // Load saved data when component mounts
  useEffect(() => {
    loadSavedData();
    fetchUserName();

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

    // --- Midnight GMT+8 auto-increment logic ---
    let lastIncrementDate = null;
    const checkMidnight = async () => {
      // Get current time in GMT+8
      const now = new Date();
      const utc = now.getTime() + now.getTimezoneOffset() * 60000;
      const gmt8 = new Date(utc + 8 * 60 * 60000);
      const hours = gmt8.getHours();
      const minutes = gmt8.getMinutes();
      const todayStr = gmt8.toISOString().slice(0, 10); // YYYY-MM-DD

      // Only run at 00:00 GMT+8, and only once per day
      if (
        hours === 0 &&
        minutes === 0 &&
        lastIncrementDate !== todayStr &&
        currentBatchId &&
        daysCount !== ""
      ) {
        try {
          const newDays = parseInt(daysCount) + 1;
          // Use Firestore serverTimestamp for updatedAt/startDate, but also store local GMT+8 for display
          await updateDoc(doc(db, "brooderInfo", currentBatchId), {
            daysCount: newDays,
            updatedAt: serverTimestamp(),
          });
          setDaysCount(newDays.toString());
          lastIncrementDate = todayStr;
          // Optionally, reload batch data
          loadSavedData();
        } catch (err) {
          console.error("Failed to auto-increment daysCount at midnight:", err);
        }
      }
    };
    const interval = setInterval(() => {
      loadSavedData();
      checkMidnight();
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [currentBatchId, daysCount]);

  // Initialize sensors and start real-time polling
  useEffect(() => {
    let stopPolling = null;

    const initSensors = async () => {
      try {
        // Initialize sensor connections first
        console.log("🚀 [Home] Initializing sensors...");
        await initializeSensors();
        
        // Configure ESP32 with user ID for scheduled watering/feeding
        const user = auth.currentUser;
        if (user) {
          console.log("📡 [Home] Configuring ESP32 with user ID for scheduled tasks...");
          await configureWaterSystemUserId(user.uid);
        }
        
        // Get initial readings
        const readings = await getAllSensorReadings();
        console.log("📊 [Home] Initial sensor readings:", JSON.stringify(readings, null, 2));
        
        if (readings) {
          if (readings.water) {
            console.log("💧 [Home] Water level:", readings.water.level, "Simulated:", readings.water.isSimulated);
            setWaterLevel(readings.water.level || 85);
            setIsSimulated(readings.water.isSimulated || false);
          }
          if (readings.feeder) {
            console.log("🌾 [Home] Feeder level:", readings.feeder.level, "Simulated:", readings.feeder.isSimulated);
              const feederLevel = readings.feeder.level !== undefined ? readings.feeder.level : 62;
              setFeedLevel(Math.round(feederLevel));
            setIsFeederSimulated(readings.feeder.isSimulated || false);
          }
        }

        // Start polling for continuous updates (every 5 seconds)
        stopPolling = startSensorPolling((readings) => {
          // Reduced logging - only log if values change significantly or errors occur
          if (readings) {
            if (readings.water) {
              setWaterLevel(readings.water.level || 85);
              setIsSimulated(readings.water.isSimulated || false);
            }
            if (readings.feeder) {
              const feederLevel = readings.feeder.level !== undefined ? readings.feeder.level : 62;
              setFeedLevel(Math.round(feederLevel));
              setIsFeederSimulated(readings.feeder.isSimulated || false);
            }
          }
        }, 5000);
      } catch (error) {
        console.error("Sensor initialization error:", error);
        // Keep default values on error
        setWaterLevel(85);
        setFeedLevel(62);
        setIsSimulated(true);
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

  const fetchUserName = async () => {
    try {
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

  const loadSavedData = async () => {
    try {
      
      const savedChicks = await AsyncStorage.getItem("chicksCount");
      const savedDays = await AsyncStorage.getItem("daysCount");
      const savedHarvest = await AsyncStorage.getItem("harvestDays");
      const savedStartDate = await AsyncStorage.getItem("batchStartDate");

      // Check if there's any batch data
      const hasData = !!(savedChicks || savedDays || savedHarvest);
      setHasBatchData(hasData);
      const currentUser = auth.currentUser;

      if (!currentUser) {
        console.log("No user authenticated, cannot load brooder data");
        return;
      }

      // Fetch brooder info from Firestore - get latest batch by createdAt
      const brooderQuery = query(
        collection(db, "brooderInfo"),
        where("userId", "==", currentUser.uid)
      );

      const querySnapshot = await getDocs(brooderQuery);

      if (!querySnapshot.empty) {
        // Sort by createdAt to get the latest batch
        const batches = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Sort by createdAt (most recent first)
        batches.sort((a, b) => {
          const aTime = a.createdAt?.toDate?.() || new Date(0);
          const bTime = b.createdAt?.toDate?.() || new Date(0);
          return bTime - aTime;
        });

        const latestBatch = batches[0];
        const brooderData = latestBatch;

        // Store the current batchId
        setCurrentBatchId(latestBatch.id);

        console.log("Loaded latest batch from Firestore:", brooderData);
        console.log("Current batchId:", latestBatch.id);

        // Check if there's any batch data
        const hasData = !!(
          brooderData.chicksCount ||
          brooderData.daysCount ||
          brooderData.harvestDays
        );
        setHasBatchData(hasData);

        if (brooderData.chicksCount !== undefined) {
          setChicksCount(brooderData.chicksCount.toString());
        }

        if (brooderData.daysCount !== undefined && brooderData.startDate) {
          // Calculate days passed since batch started
          const startDate = brooderData.startDate.toDate();
          const currentDate = new Date();
          const daysPassed = Math.floor(
            (currentDate - startDate) / (1000 * 60 * 60 * 24)
          );

          // Calculate remaining days
          const initialDays = parseInt(brooderData.daysCount);
          const remainingDays = Math.max(0, initialDays - daysPassed);

          setDaysCount(remainingDays.toString());
        } else if (brooderData.daysCount !== undefined) {
          setDaysCount(brooderData.daysCount.toString());
        }

        if (brooderData.harvestDays !== undefined) {
          setHarvestDays(brooderData.harvestDays.toString());
        }
      } else {
        console.log("No brooder data found in Firestore");
        setHasBatchData(false);
        setCurrentBatchId(null);
      }
    } catch (error) {
      console.error("Error loading brooder data from Firestore:", error);
    }
  };

  const handleSaveChicksCount = async () => {
    if (!chicksCount || parseInt(chicksCount) <= 0) {
      Alert.alert("Invalid Input", "Please enter a valid number of chicks");
      return;
    }
  };

  const handleSaveDaysCount = async () => {
    const days = parseInt(daysCount);
    if (!daysCount || days < 1 || days > 45) {
      Alert.alert("Invalid Input", "Please enter a number between 1 and 45");
      return;
    }
  };

  const handleBack = () => {
    console.log("Navigate back to dashboard");
  };

  const openQuickSetup = async () => {
    // Check if there's existing batch data using currentBatchId
    if (currentBatchId && hasBatchData) {
      // Existing batch found, show confirmation modal
      setShowConfirmReplace(true);
    } else {
      // No existing data, open modal directly
      setShowQuickSetup(true);
    }
  };

  const closeQuickSetup = () => setShowQuickSetup(false);

  const handleReplaceConfirm = () => {
    setShowConfirmReplace(false);
    setShowQuickSetup(true);
  };

  const handleReplaceCancel = () => {
    setShowConfirmReplace(false);
  };

  const handleSaveChicksCountModal = async (value) => {
    setChicksCount(value);
    setHasBatchData(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      if (currentBatchId) {
        // Update existing batch using the stored batchId
        await updateDoc(doc(db, "brooderInfo", currentBatchId), {
          chicksCount: parseInt(value),
          updatedAt: serverTimestamp(),
        });
        console.log("Chicks count updated in batch:", currentBatchId);
        // Log to session_logs
        await addDoc(collection(db, "session_logs"), {
          userId: currentUser.uid,
          action: "Edit Brooder Info",
          description: `Chicks count updated to ${value} in ${currentBatchId}`,
          timestamp: serverTimestamp(),
          email: currentUser.email,
        });
        setShowChangesSaved(true);
        setTimeout(() => setShowChangesSaved(false), 1500);
      } else {
        // Create new batch
        const newBatchRef = await addDoc(collection(db, "brooderInfo"), {
          userId: currentUser.uid,
          chicksCount: parseInt(value),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        setCurrentBatchId(newBatchRef.id);
        console.log("New batch created with chicks count:", newBatchRef.id);
        // Log to session_logs
        await addDoc(collection(db, "session_logs"), {
          userId: currentUser.uid,
          action: "Created new batch",
          description: `Created new batch (default age set to 1, chicks count ${value}) (ID: ${newBatchRef.id})`,
          timestamp: serverTimestamp(),
          email: currentUser.email,
        });
      }
    } catch (error) {
      console.error("Error saving chicks count to Firestore:", error);
    }
  };

  const handleSaveDaysCountModal = async (value) => {
    setDaysCount(value);
    setHasBatchData(true);
    setLastAgeEdit(new Date());
    // Reload brooder data to update UI immediately
    await loadSavedData();
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      const startDate = serverTimestamp();

      if (currentBatchId) {
        // Update existing batch using the stored batchId
        await updateDoc(doc(db, "brooderInfo", currentBatchId), {
          daysCount: parseInt(value),
          startDate: startDate,
          updatedAt: serverTimestamp(),
        });
        console.log("Days count updated in batch:", currentBatchId);
        // Log to session_logs
        await addDoc(collection(db, "session_logs"), {
          userId: currentUser.uid,
          action: "Edit Brooder Info",
          description: `Days count updated to ${value} in ${currentBatchId}`,
          timestamp: serverTimestamp(),
          email: currentUser.email,
        });
        setShowChangesSaved(true);
        setTimeout(() => setShowChangesSaved(false), 1500);
      } else {
        // Create new batch
        const newBatchRef = await addDoc(collection(db, "brooderInfo"), {
          userId: currentUser.uid,
          daysCount: parseInt(value),
          startDate: startDate,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        setCurrentBatchId(newBatchRef.id);
        console.log("New batch created with days count:", newBatchRef.id);
        // Log to session_logs
        await addDoc(collection(db, "session_logs"), {
          userId: currentUser.uid,
          action: "Created new batch",
          description: `Created new batch (default age set to 1, days count ${value}) (ID: ${newBatchRef.id})`,
          timestamp: serverTimestamp(),
          email: currentUser.email,
        });
      }
    } catch (error) {
      console.error("Error saving days count to Firestore:", error);
    }
  };

  const handleSaveHarvestDaysModal = async (value) => {
    setHarvestDays(value);
    setHasBatchData(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      if (currentBatchId) {
        // Update existing batch using the stored batchId
        await updateDoc(doc(db, "brooderInfo", currentBatchId), {
          harvestDays: parseInt(value),
          updatedAt: serverTimestamp(),
        });
        console.log("Harvest days updated in batch:", currentBatchId);
        // Log to session_logs
        await addDoc(collection(db, "session_logs"), {
          userId: currentUser.uid,
          action: "Edit Brooder Info",
          description: `Harvest days updated to ${value} in ${currentBatchId}`,
          timestamp: serverTimestamp(),
          email: currentUser.email,
        });
        setShowChangesSaved(true);
        setTimeout(() => setShowChangesSaved(false), 1500);
      } else {
        // Create new batch
        const newBatchRef = await addDoc(collection(db, "brooderInfo"), {
          userId: currentUser.uid,
          harvestDays: parseInt(value),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        setCurrentBatchId(newBatchRef.id);
        console.log("New batch created with harvest days:", newBatchRef.id);
        // Log to session_logs
        await addDoc(collection(db, "session_logs"), {
          userId: currentUser.uid,
          action: "Created new batch",
          description: `Created new batch (default age set to 1, harvest days ${value}) (ID: ${newBatchRef.id})`,
          timestamp: serverTimestamp(),
          email: currentUser.email,
        });
      }
    } catch (error) {
      console.error("Error saving harvest days to Firestore:", error);
    }
    {
      /* Branded Changes Saved Modal */
    }
    <Modal visible={showChangesSaved} transparent animationType="fade">
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "rgba(0,0,0,0.25)",
        }}
      >
        <View
          style={{
            backgroundColor: "#154b99",
            borderRadius: 20,
            padding: 32,
            alignItems: "center",
            shadowColor: "#000",
            shadowOpacity: 0.2,
            shadowRadius: 8,
            elevation: 8,
          }}
        >
          <Text
            style={{
              color: "#fff",
              fontSize: 22,
              fontWeight: "bold",
              marginBottom: 8,
            }}
          >
            ✔️ Changes Saved
          </Text>
          <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>
            Your brooder info has been updated.
          </Text>
        </View>
      </View>
    </Modal>;
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
    })
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
            <Text style={styles.sectionTitle}>Brooder Information</Text>
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
                    {daysCount !== ""
                      ? `${daysCount} ${parseInt(daysCount) === 1 || parseInt(daysCount) === 0 ? "day" : "days"}`
                      : "0 day"}
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
                    {harvestDays ? `${harvestDays} days` : "0 days"}
                  </Text>
                </View>
              </View>
            </View>

            {/* Big CTA button styled similar to the screenshot */}
            <TouchableOpacity
              style={styles.ctaWrapper}
              activeOpacity={0.9}
              onPress={openQuickSetup}
            >
              <View style={styles.ctaButton}>
                <Text style={styles.ctaText}>
                  {hasBatchData ? "Edit Batch" : "Add Batch"}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Add Batch button if age is 35 or more and after midnight GMT+8 if age was edited */}
            {(() => {
              if (daysCount !== "" && parseInt(daysCount) >= 35) {
                // Only show Add Batch if lastAgeEdit is null or before last midnight GMT+8
                let showAddBatch = true;
                if (lastAgeEdit) {
                  // Get current time in GMT+8
                  const now = new Date();
                  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
                  const gmt8 = new Date(utc + 8 * 60 * 60000);
                  // Get last midnight GMT+8
                  const midnightGmt8 = new Date(gmt8);
                  midnightGmt8.setHours(0, 0, 0, 0);
                  // Only show if lastAgeEdit is before last midnight GMT+8
                  showAddBatch = lastAgeEdit < midnightGmt8;
                }
                if (showAddBatch) {
                  return (
                    <TouchableOpacity
                      style={[
                        styles.ctaWrapper,
                        addBatchDisabled && { opacity: 0.5 },
                      ]}
                      activeOpacity={0.9}
                      onPress={async () => {
                        if (addBatchDisabled) return;
                        setAddBatchDisabled(true);
                        try {
                          const currentUser = auth.currentUser;
                          if (!currentUser) return;
                          // Get all batches for this user to determine next batchId
                          const brooderQuery = query(
                            collection(db, "brooderInfo"),
                            where("userId", "==", currentUser.uid)
                          );
                          const querySnapshot = await getDocs(brooderQuery);
                          let maxBatchId = 0;
                          let lastBatch = null;
                          querySnapshot.forEach((docSnap) => {
                            const data = docSnap.data();
                            if (data.batchId && data.batchId > maxBatchId)
                              maxBatchId = data.batchId;
                            if (
                              !lastBatch ||
                              (data.createdAt &&
                                data.createdAt.toDate() >
                                  lastBatch.createdAt?.toDate?.())
                            )
                              lastBatch = data;
                          });
                          const nextBatchId = maxBatchId + 1;
                          // Custom batch name: Batch{nextBatchId}
                          const customBatchName = `Batch${nextBatchId}`;
                          // Carry over chicksCount from last batch if available
                          const carryChicks = lastBatch?.chicksCount || 0;
                          // Prompt for harvestDays if needed (for now, reuse previous or default to 30)
                          const newHarvestDays = lastBatch?.harvestDays || 30;
                          // Calculate GMT+8 timestamps
                          const now = new Date();
                          const utc =
                            now.getTime() + now.getTimezoneOffset() * 60000;
                          const gmt8 = new Date(utc + 8 * 60 * 60000);
                          const gmt8ISOString = gmt8.toISOString();
                          // Create new batch with custom document ID
                          const batchDocId = `batch${nextBatchId}`;
                          await setDoc(doc(db, "brooderInfo", batchDocId), {
                            batchId: nextBatchId,
                            batchNumber: customBatchName,
                            chicksCount: carryChicks,
                            createdAt: serverTimestamp(),
                            createdAtGMT8: gmt8ISOString,
                            daysCount: 1, // Set default age to 1
                            harvestDays: newHarvestDays,
                            startDate: serverTimestamp(),
                            startDateGMT8: gmt8ISOString,
                            updatedAt: serverTimestamp(),
                            updatedAtGMT8: gmt8ISOString,
                            userId: currentUser.uid,
                          });
                          setCurrentBatchId(batchDocId);
                          setDaysCount("1"); // Set UI age to 1
                          setHarvestDays(newHarvestDays.toString());
                          setChicksCount(carryChicks.toString());
                          setHasBatchData(true);
                          // Log to session_logs
                          await addDoc(collection(db, "session_logs"), {
                            userId: currentUser.uid,
                            action: "Created new batch",
                            description: `Created new batch ${customBatchName} (default age set to 1)`,
                            timestamp: serverTimestamp(),
                            timestampGMT8: gmt8ISOString,
                            deviceInfo: Platform.OS,
                            email: currentUser.email,
                          });
                          // Delay reload to allow Firestore timestamps to update
                          setTimeout(() => {
                            loadSavedData();
                          }, 700);
                        } catch (err) {
                          console.error("Failed to add new batch:", err);
                        }
                        // Prevent duplicate batch creation
                        setTimeout(() => setAddBatchDisabled(false), 3000);
                      }}
                      disabled={addBatchDisabled}
                    >
                      <View style={styles.ctaButton}>
                        <Text style={styles.ctaText}>Add Batch</Text>
                      </View>
                    </TouchableOpacity>
                  );
                }
              }
              return null;
            })()}

            {/* Sensor Monitoring Grid */}
            <Text style={styles.sectionTitle}>Live Monitoring</Text>
            <View style={styles.sensorGrid}>
              {/* Water Level Card */}
              <View style={styles.sensorCard}>
                <Text style={styles.sensorIcon}>💧</Text>
                <Text style={styles.sensorLabel}>Water Level</Text>
                <Text style={styles.sensorValue}>85%</Text>
              </View>

            {/* Water Level Card */}
            <View style={styles.sensorCard}>
              <Text style={styles.sensorIcon}>💧</Text>
              <Text style={styles.sensorLabel}>Water Level</Text>
              <Text style={styles.sensorValue}>{waterLevel.toFixed(0)}%</Text>
              {isSimulated && (
                <Text style={styles.simulatedText}>Simulated</Text>
              )}
            </View>

            {/* Feed Level Card */}
            <View style={styles.sensorCard}>
              <Text style={styles.sensorIcon}>🍴</Text>
              <Text style={styles.sensorLabel}>Feed Level</Text>
              <Text style={styles.sensorValue}>{feedLevel.toFixed(0)}%</Text>
              {isFeederSimulated && (
                <Text style={styles.simulatedText}>Simulated</Text>
              )}
            </View>

              {/* Light Status Card */}
              <View style={styles.sensorCard}>
                <Text style={styles.sensorIcon}>💡</Text>
                <Text style={styles.sensorLabel}>Light Status</Text>
                <Text style={styles.sensorValue}>On</Text>
              </View>
            </View>

            <QuickSetupModal
              visible={showQuickSetup}
              initialChicksCount={chicksCount}
              initialDaysCount={daysCount}
              initialHarvestDays={harvestDays}
              currentBatchId={currentBatchId}
              onSaveChicksCount={handleSaveChicksCountModal}
              onSaveDaysCount={handleSaveDaysCountModal}
              onSaveHarvestDays={handleSaveHarvestDaysModal}
              onClose={closeQuickSetup}
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
  simulatedText: {
    fontSize: 10,
    color: "#f59e0b",
    fontWeight: "600",
    marginTop: 4,
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
  ctaWrapper: {
    backgroundColor: "#154b99",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    alignSelf: "stretch",
    marginHorizontal: 8,
    marginBottom: 24,
  },
  ctaButton: {
    alignItems: "center",
  },
  ctaText: { color: "#fff", fontWeight: "700", fontSize: 16 },
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
});
