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
} from "react-native";
import QuickSetupModal from "./QuickSetupModal";
import { auth, db } from "../../../config/firebaseconfig";
import { doc, getDoc } from "firebase/firestore";

// Replace static import with a dynamic require + in-memory fallback.
// This avoids a crash when @react-native-async-storage/async-storage is not installed.
let AsyncStorage;
try {
  // try to require the community package (works in metro bundler environment)
  const mod = require("@react-native-async-storage/async-storage");
  AsyncStorage = mod && mod.default ? mod.default : mod;
} catch (e) {
  console.warn(
    "[AsyncStorage] @react-native-async-storage/async-storage not found — using in-memory fallback. Install the package to persist data between app restarts."
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
  const [userName, setUserName] = useState("User");

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
  }, []);

  const fetchUserName = async () => {
    try {
      const currentUser = auth.currentUser;
      
      if (currentUser) {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        
        if (userDoc.exists()) {
          const data = userDoc.data();
          // Get first name only for greeting
          const fullName = data.fullname || data.name || data.firstName || "User";
          const firstName = fullName.split(' ')[0];
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

      if (savedChicks !== null) {
        setChicksCount(savedChicks);
      }
      if (savedDays !== null) {
        setDaysCount(savedDays);
      }
      if (savedHarvest !== null) {
        setHarvestDays(savedHarvest);
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

  const openQuickSetup = () => setShowQuickSetup(true);
  const closeQuickSetup = () => setShowQuickSetup(false);

  const handleSaveChicksCountModal = async (value) => {
    setChicksCount(value);
    try {
      await AsyncStorage.setItem("chicksCount", value);
    } catch (error) {
      console.error("Error saving chicks count:", error);
    }
  };

  const handleSaveDaysCountModal = async (value) => {
    setDaysCount(value);
    try {
      await AsyncStorage.setItem("daysCount", value);
    } catch (error) {
      console.error("Error saving days count:", error);
    }
  };

  const handleSaveHarvestDaysModal = async (value) => {
    setHarvestDays(value);
    try {
      await AsyncStorage.setItem("harvestDays", value);
    } catch (error) {
      console.error("Error saving harvest days:", error);
    }
  };

  // Swipe gesture handler - swipe left to go to Control screen
  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Only respond to horizontal swipes (not vertical scrolling)
        return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 20;
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
                <Text style={styles.brooderValue}>
                  {chicksCount || "0"}
                </Text>
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
              <Text style={styles.ctaText}>Add Batch </Text>
            </View>
          </TouchableOpacity>

          {/* Sensor Monitoring Grid */}
          <Text style={styles.sectionTitle}>Live Monitoring</Text>
          <View style={styles.sensorGrid}>

            {/* Water Level Card */}
            <View style={styles.sensorCard}>
              <Text style={styles.sensorIcon}>💧</Text>
              <Text style={styles.sensorLabel}>Water Level</Text>
              <Text style={styles.sensorValue}>85%</Text>
            </View>

            {/* Feed Level Card */}
            <View style={styles.sensorCard}>
              <Text style={styles.sensorIcon}>🍴</Text>
              <Text style={styles.sensorLabel}>Feed Level</Text>
              <Text style={styles.sensorValue}>62%</Text>
            </View>

            {/* Solar Charge Card */}
            <View style={styles.sensorCard}>
              <Text style={styles.sensorIcon}>☀️</Text>
              <Text style={styles.sensorLabel}>Solar Charge</Text>
              <Text style={styles.sensorValue}>62%</Text>
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
            onSaveChicksCount={handleSaveChicksCountModal}
            onSaveDaysCount={handleSaveDaysCountModal}
            onSaveHarvestDays={handleSaveHarvestDaysModal}
            onClose={closeQuickSetup}
          />
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
  setupCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: "#1e293b",
    marginBottom: 12,
  },
  saveButton: {
    backgroundColor: "#3b82f6",
    borderRadius: 12,
    paddingVertical: 14,
    shadowColor: "#3b82f6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  saveButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    textAlign: "center",
    fontSize: 15,
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
});
