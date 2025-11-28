import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Platform,
  StatusBar,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import HeaderUpdated from "../navigation/Header";
import BottomNavigation from "../navigation/BottomNavigation";

const Icon = Feather;

export default function ViewReport({ route, navigation }) {
  const { report } = route.params;

  const handleBack = () => {
    navigation.goBack();
  };

  // Fake data for the report
  const statistics = {
    minimum: "30°C",
    maximum: "34°C",
    average: "31.8°C",
  };

  const waterUsage = {
    currentLevel: "80%",
    dailyConsumption: "21.5 L",
    weeklyTotal: "145 L",
  };

  const energySummary = {
    solarGenerated: "89.3 kWh",
    mainPowerUsed: "12.7 kWh",
    solarEfficiency: "87%",
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      
      {/* Header with SideNavigation */}
      <HeaderUpdated />

      {/* Report Title Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Icon name="chevron-left" size={24} color="#1a1a1a" />
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <Text style={styles.headerTitle}>{report?.displayName || "Report"}</Text>
        </View>
        <View style={styles.placeholder} />
      </View>

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
              <Text style={styles.statValue}>{waterUsage.dailyConsumption}</Text>
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
              <Text style={styles.statValue}>{energySummary.solarGenerated}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Main Power Used</Text>
              <Text style={styles.statValue}>{energySummary.mainPowerUsed}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Solar Efficiency</Text>
              <Text style={styles.statValue}>{energySummary.solarEfficiency}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Navigation */}
      <BottomNavigation 
        active="" 
        onNavigate={(screen) => navigation.navigate(screen)} 
      />
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
  clearDateText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
  },
});