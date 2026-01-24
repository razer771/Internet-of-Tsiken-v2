import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * ESP32 Hardware Configuration
 * 
 * Configure your ESP32 device IP address here.
 * Your ESP32 provides both water and feeder sensor data through a single endpoint.
 * After uploading the Arduino code to your ESP32, update the IP address below.
 * 
 * This value can be changed in the app via ESP32 Settings screen.
 */

// ESP32 Configuration (default values)
export const ESP32_CONFIG = {
  enabled: true,  // Set to true when ESP32 is connected
  ipAddress: '192.168.137.222', // Change to your ESP32's actual IP address
  port: 80,
};

/**
 * Load ESP32 settings from AsyncStorage
 * Call this on app startup to load user-configured settings
 */
export const loadESP32Settings = async () => {
  try {
    const savedIP = await AsyncStorage.getItem("esp32_ip");
    const savedPort = await AsyncStorage.getItem("esp32_port");
    const savedEnabled = await AsyncStorage.getItem("esp32_enabled");

    if (savedIP) ESP32_CONFIG.ipAddress = savedIP;
    if (savedPort) ESP32_CONFIG.port = parseInt(savedPort);
    if (savedEnabled !== null) ESP32_CONFIG.enabled = savedEnabled === "true";

    console.log("✅ ESP32 settings loaded from storage");
  } catch (error) {
    console.error("Error loading ESP32 settings:", error);
  }
};

/**
 * Get the base URL for ESP32 endpoints
 */
export const getESP32Url = () => {
  if (!ESP32_CONFIG.enabled) {
    return null;
  }
  return `http://${ESP32_CONFIG.ipAddress}:${ESP32_CONFIG.port}`;
};

// Backward compatibility - both return the same URL since it's one device
export const getWaterSystemUrl = () => getESP32Url();
export const getFeedSystemUrl = () => getESP32Url();

/**
 * Test connection to ESP32
 */
export const testESP32Connection = async () => {
  if (!ESP32_CONFIG.enabled) {
    return {
      success: false,
      message: 'ESP32 is not enabled in configuration',
    };
  }
  
  const url = `http://${ESP32_CONFIG.ipAddress}:${ESP32_CONFIG.port}/`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      timeout: 5000,
    });
    
    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        message: 'ESP32 connected successfully',
        deviceInfo: data,
      };
    }
    
    return {
      success: false,
      message: `ESP32 returned status ${response.status}`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Connection failed: ${error.message}`,
      hint: 'Make sure ESP32 is powered on and connected to the same WiFi network',
    };
  }
};

export default ESP32_CONFIG;
