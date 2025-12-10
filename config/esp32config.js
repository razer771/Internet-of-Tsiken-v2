/**
 * ESP32 Hardware Configuration
 * 
 * Configure your ESP32 device IP addresses or hostnames here.
 * 
 * AUTO-DISCOVERY (Recommended):
 * - Leave ipAddress as 'tsiken-esp32.local' to use mDNS auto-discovery
 * - ESP32 will be automatically discovered on your local network
 * - No need to manually find or update IP addresses
 * 
 * MANUAL IP (Fallback):
 * - If auto-discovery doesn't work, find IP from ESP32 Serial Monitor
 * - Update ipAddress to the actual IP (e.g., '192.168.1.100')
 */

// ESP32 Configuration
export const ESP32_CONFIG = {
  // Water System (Water Level Sensor + Micro Water Pump)
  waterSystem: {
    enabled: true,  // Set to true when ESP32 is connected
    ipAddress: 'tsiken-esp32.local', // mDNS hostname (auto-discovery) or IP address
    port: 80,
  },
  
  // Feed Dispenser (if using separate ESP32)
  feedSystem: {
    enabled: true,  // Set to true when ESP32 is connected
    ipAddress: 'tsiken-esp32.local', // mDNS hostname (auto-discovery) or IP address
    port: 80,
  },
};

/**
 * Get the base URL for ESP32 endpoints
 */
export const getWaterSystemUrl = () => {
  if (!ESP32_CONFIG.waterSystem.enabled) {
    return null;
  }
  return `http://${ESP32_CONFIG.waterSystem.ipAddress}:${ESP32_CONFIG.waterSystem.port}`;
};

export const getFeedSystemUrl = () => {
  if (!ESP32_CONFIG.feedSystem.enabled) {
    return null;
  }
  return `http://${ESP32_CONFIG.feedSystem.ipAddress}:${ESP32_CONFIG.feedSystem.port}`;
};

/**
 * Test connection to ESP32
 */
export const testESP32Connection = async (systemType = 'waterSystem') => {
  const config = ESP32_CONFIG[systemType];
  
  if (!config.enabled) {
    return {
      success: false,
      message: `${systemType} is not enabled in configuration`,
    };
  }
  
  const url = `http://${config.ipAddress}:${config.port}/`;
  
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
