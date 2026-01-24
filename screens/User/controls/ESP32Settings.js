import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
  StatusBar,
  Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ESP32_CONFIG, testESP32Connection } from "../../../config/esp32config";

const Icon = Feather;

export default function ESP32Settings({ navigation }) {
  const [ipAddress, setIpAddress] = useState("");
  const [port, setPort] = useState("80");
  const [enabled, setEnabled] = useState(true);
  
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      // Load from AsyncStorage first, fallback to config file
      const savedIP = await AsyncStorage.getItem("esp32_ip");
      const savedPort = await AsyncStorage.getItem("esp32_port");
      const savedEnabled = await AsyncStorage.getItem("esp32_enabled");

      setIpAddress(savedIP || ESP32_CONFIG.ipAddress);
      setPort(savedPort || ESP32_CONFIG.port.toString());
      setEnabled(savedEnabled !== null ? savedEnabled === "true" : ESP32_CONFIG.enabled);
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);

      // Validate IP address
      if (enabled && !isValidIP(ipAddress)) {
        Alert.alert("Invalid IP", "Please enter a valid IP address");
        setSaving(false);
        return;
      }

      // Save to AsyncStorage
      await AsyncStorage.setItem("esp32_ip", ipAddress);
      await AsyncStorage.setItem("esp32_port", port);
      await AsyncStorage.setItem("esp32_enabled", enabled.toString());

      // Update the config in memory
      ESP32_CONFIG.ipAddress = ipAddress;
      ESP32_CONFIG.port = parseInt(port);
      ESP32_CONFIG.enabled = enabled;

      setSaving(false);
      Alert.alert(
        "Success",
        "ESP32 settings saved successfully!",
        [{ text: "OK" }]
      );
    } catch (error) {
      console.error("Error saving settings:", error);
      setSaving(false);
      Alert.alert("Error", "Failed to save settings");
    }
  };

  const testConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);

    try {
      // Temporarily update config for testing
      const originalConfig = { ...ESP32_CONFIG };
      
      ESP32_CONFIG.ipAddress = ipAddress;
      ESP32_CONFIG.port = parseInt(port);
      ESP32_CONFIG.enabled = enabled;

      const result = await testESP32Connection();
      setTestResult(result);

      // Restore original config
      ESP32_CONFIG.ipAddress = originalConfig.ipAddress;
      ESP32_CONFIG.port = originalConfig.port;
      ESP32_CONFIG.enabled = originalConfig.enabled;

      if (result.success) {
        Alert.alert(
          "Connection Successful",
          result.message + "\n\nDevice is reachable!\nBoth water and feeder sensors detected.",
          [{ text: "OK" }]
        );
      } else {
        Alert.alert(
          "Connection Failed",
          result.message + (result.hint ? `\n\n${result.hint}` : ""),
          [{ text: "OK" }]
        );
      }
    } catch (error) {
      Alert.alert("Test Failed", error.message);
    } finally {
      setTestingConnection(false);
    }
  };

  const isValidIP = (ip) => {
    const pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!pattern.test(ip)) return false;
    
    const parts = ip.split(".");
    return parts.every(part => {
      const num = parseInt(part);
      return num >= 0 && num <= 255;
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#154b99" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Icon name="arrow-left" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ESP32 Settings</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Info Card */}
        <View style={styles.infoCard}>
          <Icon name="info" size={20} color="#154b99" />
          <Text style={styles.infoText}>
            Configure your ESP32 device IP address. Your ESP32 provides both water and feeder sensor data through a single connection. Make sure your phone and ESP32 are on the same WiFi network.
          </Text>
        </View>

        {/* ESP32 Device Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon name="cpu" size={20} color="#154b99" />
            <Text style={styles.sectionTitle}>ESP32 Device</Text>
          </View>

          <TouchableOpacity
            style={styles.toggleContainer}
            onPress={() => setEnabled(!enabled)}
          >
            <Text style={styles.toggleLabel}>Enable ESP32</Text>
            <View
              style={[
                styles.toggle,
                enabled && styles.toggleActive,
              ]}
            >
              <View
                style={[
                  styles.toggleThumb,
                  enabled && styles.toggleThumbActive,
                ]}
              />
            </View>
          </TouchableOpacity>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>IP Address</Text>
            <TextInput
              style={styles.input}
              value={ipAddress}
              onChangeText={setIpAddress}
              placeholder="192.168.1.100"
              placeholderTextColor="#9ca3af"
              keyboardType="numeric"
              editable={enabled}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Port</Text>
            <TextInput
              style={styles.input}
              value={port}
              onChangeText={setPort}
              placeholder="80"
              placeholderTextColor="#9ca3af"
              keyboardType="numeric"
              editable={enabled}
            />
          </View>

          <TouchableOpacity
            style={[
              styles.testButton,
              (!enabled || testingConnection) && styles.testButtonDisabled,
            ]}
            onPress={testConnection}
            disabled={!enabled || testingConnection}
          >
            {testingConnection ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Icon name="wifi" size={18} color="#ffffff" />
                <Text style={styles.testButtonText}>Test Connection</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Sensor Status */}
          <View style={styles.sensorStatus}>
            <View style={styles.sensorRow}>
              <Icon name="droplet" size={16} color="#3b82f6" />
              <Text style={styles.sensorText}>Water Level Sensor</Text>
            </View>
            <View style={styles.sensorRow}>
              <Icon name="package" size={16} color="#10b981" />
              <Text style={styles.sensorText}>Feeder Level Sensor</Text>
            </View>
          </View>
        </View>

        {/* Instructions */}
        <View style={styles.instructionsCard}>
          <Text style={styles.instructionsTitle}>How to find ESP32 IP Address:</Text>
          <Text style={styles.instructionsText}>
            1. Open Arduino Serial Monitor{"\n"}
            2. Upload the ESP32 code{"\n"}
            3. Wait for WiFi connection{"\n"}
            4. Copy the IP address shown{"\n"}
            5. Enter it above and test connection
          </Text>
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={saveSettings}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <Icon name="save" size={20} color="#ffffff" />
              <Text style={styles.saveButtonText}>Save Settings</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.bottomSpacing} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    backgroundColor: "#154b99",
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight || 24 : 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#ffffff",
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  infoCard: {
    backgroundColor: "#eff6ff",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  infoText: {
    fontSize: 14,
    color: "#1e40af",
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
  },
  section: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
    marginLeft: 8,
  },
  toggleContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    padding: 12,
    backgroundColor: "#f8fafc",
    borderRadius: 8,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#cbd5e1",
    justifyContent: "center",
    padding: 2,
  },
  toggleActive: {
    backgroundColor: "#154b99",
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  toggleThumbActive: {
    alignSelf: "flex-end",
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#475569",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: "#1a1a1a",
  },
  testButton: {
    backgroundColor: "#154b99",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  testButtonDisabled: {
    backgroundColor: "#94a3b8",
  },
  testButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  sensorStatus: {
    marginTop: 16,
    padding: 12,
    backgroundColor: "#f0fdf4",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  sensorRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 4,
  },
  sensorText: {
    fontSize: 14,
    color: "#166534",
    marginLeft: 8,
    fontWeight: "500",
  },
  instructionsCard: {
    backgroundColor: "#fef3c7",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#fde047",
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#92400e",
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 14,
    color: "#92400e",
    lineHeight: 22,
  },
  saveButton: {
    backgroundColor: "#10b981",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 12,
    gap: 8,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  saveButtonDisabled: {
    backgroundColor: "#94a3b8",
  },
  saveButtonText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
    marginLeft: 8,
  },
  bottomSpacing: {
    height: 40,
  },
});
