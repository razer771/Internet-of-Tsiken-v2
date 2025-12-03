import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Platform,
  StatusBar,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { db } from "../../../config/firebaseconfig";

const Icon = Feather;

export default function ViewReport({ route, navigation }) {
  const { report } = route.params;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sensorData, setSensorData] = useState({
    temperature: null,
    waterLevel: null,
    energy: null,
    humidity: null,
    feedLevel: null,
  });

  const handleBack = () => {
    navigation.goBack();
  };

  // Fetch sensor averages from Firestore
  useEffect(() => {
    const unsubscribers = [];

    const fetchSensorData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Define sensor types to fetch
        const sensorTypes = [
          "temperature",
          "waterLevel",
          "energy",
          "humidity",
          "feedLevel",
        ];

        // Set up real-time listeners for each sensor type
        sensorTypes.forEach((sensorType) => {
          const docRef = doc(db, "sensorAverages", sensorType);

          const unsubscribe = onSnapshot(
            docRef,
            {
              includeMetadataChanges: true,
            },
            (docSnapshot) => {
              if (docSnapshot.exists()) {
                const data = docSnapshot.data();
                setSensorData((prevState) => ({
                  ...prevState,
                  [sensorType]: data,
                }));

                // Check if data is from cache
                if (docSnapshot.metadata.fromCache) {
                  console.log(`${sensorType} data loaded from cache (offline)`);
                }
              } else {
                console.log(`No data found for ${sensorType}`);
                setSensorData((prevState) => ({
                  ...prevState,
                  [sensorType]: null,
                }));
              }
              setLoading(false);
            },
            (err) => {
              console.warn(`Error fetching ${sensorType}:`, err.message);
              // Don't set error state, just log and continue with other sensors
              setSensorData((prevState) => ({
                ...prevState,
                [sensorType]: null,
              }));
              setLoading(false);
            }
          );

          unsubscribers.push(unsubscribe);
        });
      } catch (err) {
        console.error("Error setting up sensor data listeners:", err);
        setError("Failed to load sensor data");
        setLoading(false);
      }
    };

    fetchSensorData();

    // Cleanup listeners on unmount
    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, []);

  // Compute statistics from sensor data
  const statistics = {
    minimum: sensorData.temperature?.minValue
      ? `${sensorData.temperature.minValue.toFixed(1)}°C`
      : "N/A",
    maximum: sensorData.temperature?.maxValue
      ? `${sensorData.temperature.maxValue.toFixed(1)}°C`
      : "N/A",
    average: sensorData.temperature?.average
      ? `${sensorData.temperature.average.toFixed(1)}°C`
      : "N/A",
  };

  const waterUsage = {
    currentLevel: sensorData.waterLevel?.average
      ? `${sensorData.waterLevel.average.toFixed(0)}%`
      : "N/A",
    dailyConsumption: sensorData.waterLevel?.average
      ? `${(100 - sensorData.waterLevel.average).toFixed(1)} L`
      : "N/A",
    weeklyTotal: sensorData.waterLevel?.totalReadings
      ? `${((100 - sensorData.waterLevel.average) * 7).toFixed(1)} L`
      : "N/A",
  };

  const energySummary = {
    solarGenerated: sensorData.energy?.average
      ? `${sensorData.energy.average.toFixed(1)} kWh`
      : "N/A",
    mainPowerUsed: sensorData.energy?.minValue
      ? `${sensorData.energy.minValue.toFixed(1)} kWh`
      : "N/A",
    solarEfficiency: sensorData.energy?.average
      ? `${Math.min(100, sensorData.energy.average).toFixed(0)}%`
      : "N/A",
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Report Title Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Icon name="chevron-left" size={24} color="#1a1a1a" />
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <Text style={styles.headerTitle}>
            {report?.displayName || "Report"}
          </Text>
        </View>
        <View style={styles.placeholder} />
      </View>

      {/* Loading State */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading sensor data...</Text>
        </View>
      )}

      {/* Error State */}
      {error && !loading && (
        <View style={styles.errorContainer}>
          <Icon name="alert-circle" size={48} color="#ef4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              setLoading(true);
              setError(null);
            }}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Content */}
      {!loading && !error && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Statistics Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Statistics</Text>
            <View style={styles.card}>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Minimum</Text>
                <Text style={styles.statValue}>{statistics.minimum}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Maximum</Text>
                <Text style={styles.statValue}>{statistics.maximum}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Average</Text>
                <Text style={styles.statValue}>{statistics.average}</Text>
              </View>
            </View>
          </View>

          {/* Water Usage Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Water Usage</Text>
            <View style={styles.card}>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Current Level</Text>
                <Text style={styles.statValue}>{waterUsage.currentLevel}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Daily Consumption</Text>
                <Text style={styles.statValue}>
                  {waterUsage.dailyConsumption}
                </Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Weekly Total</Text>
                <Text style={styles.statValue}>{waterUsage.weeklyTotal}</Text>
              </View>
            </View>
          </View>

          {/* Energy Summary Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Energy Summary</Text>
            <View style={styles.card}>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Solar Generated</Text>
                <Text style={styles.statValue}>
                  {energySummary.solarGenerated}
                </Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Main Power Used</Text>
                <Text style={styles.statValue}>
                  {energySummary.mainPowerUsed}
                </Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Solar Efficiency</Text>
                <Text style={styles.statValue}>
                  {energySummary.solarEfficiency}
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: "#f8fafc",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  backButton: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  titleContainer: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  placeholder: {
    width: 36,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  section: {
    marginTop: 20,
    marginHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 12,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingVertical: 8,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  statLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#64748b",
  },
  statValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  divider: {
    height: 1,
    backgroundColor: "#f1f5f9",
    marginHorizontal: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    fontWeight: "500",
    color: "#64748b",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    paddingVertical: 60,
  },
  errorText: {
    marginTop: 16,
    fontSize: 14,
    fontWeight: "500",
    color: "#ef4444",
    textAlign: "center",
  },
  retryButton: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 24,
    backgroundColor: "#3b82f6",
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
  },
  clearDateText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
  },
});
