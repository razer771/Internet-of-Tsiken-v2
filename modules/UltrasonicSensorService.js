/**
 * UltrasonicSensorService.js
 * 
 * Service to interface with water level sensor modules for water and feeder level detection.
 * This service handles communication with hardware modules (ESP32) and provides fallback error handling.
 */

import { getWaterSystemUrl, getFeedSystemUrl } from '../config/esp32config';

// Configuration for sensor modules
const SENSOR_CONFIG = {
  waterSensor: {
    id: 'WATER_ULTRASONIC_01',
    name: 'Water Level Sensor',
    // Tank dimensions (in cm) - adjust based on actual tank
    maxDistance: 100, // Empty tank distance from sensor
    minDistance: 10,  // Full tank distance from sensor
    endpoint: null,   // Will be set when connecting to actual module
  },
  feederSensor: {
    id: 'FEEDER_ULTRASONIC_01', 
    name: 'Feeder Level Sensor',
    // Feeder dimensions (in cm) - adjust based on actual feeder
    maxDistance: 50,  // Empty feeder distance from sensor
    minDistance: 5,   // Full feeder distance from sensor
    endpoint: null,   // Will be set when connecting to actual module
  },
};

// Connection status
let connectionStatus = {
  waterSensor: { connected: false, lastUpdate: null, error: null },
  feederSensor: { connected: false, lastUpdate: null, error: null },
};

// Simulated sensor values (for development/testing)
let simulatedValues = {
  waterLevel: 85,
  feederLevel: 62,
};

// Flag to enable/disable simulation mode
let simulationMode = true;

/**
 * Initialize connection to ultrasonic sensor modules
 * @param {Object} config - Optional configuration overrides
 * @returns {Promise<Object>} Connection status
 */
export const initializeSensors = async (config = {}) => {
  console.log('🚀 Initializing sensors...');
  
  try {
    // Auto-configure endpoints from ESP32 config
    const waterSystemUrl = getWaterSystemUrl();
    const feedSystemUrl = getFeedSystemUrl();
    
    console.log(`   Water system URL: ${waterSystemUrl || 'not configured'}`);
    console.log(`   Feed system URL: ${feedSystemUrl || 'not configured'}`);
    
    if (waterSystemUrl && !SENSOR_CONFIG.waterSensor.endpoint) {
      SENSOR_CONFIG.waterSensor.endpoint = `${waterSystemUrl}/api/sensors`;
      console.log(`   ✓ Water sensor endpoint set: ${SENSOR_CONFIG.waterSensor.endpoint}`);
    }
    
    if (feedSystemUrl && !SENSOR_CONFIG.feederSensor.endpoint) {
      SENSOR_CONFIG.feederSensor.endpoint = `${feedSystemUrl}/api/sensors`;
      console.log(`   ✓ Feed sensor endpoint set: ${SENSOR_CONFIG.feederSensor.endpoint}`);
    }
    
    // Merge custom config if provided
    if (config.waterSensor) {
      Object.assign(SENSOR_CONFIG.waterSensor, config.waterSensor);
    }
    if (config.feederSensor) {
      Object.assign(SENSOR_CONFIG.feederSensor, config.feederSensor);
    }

    // Attempt to connect to water sensor
    console.log('🔍 Connecting to water sensor...');
    const waterResult = await connectToSensor('waterSensor');
    
    // Attempt to connect to feeder sensor
    console.log('🔍 Connecting to feeder sensor...');
    const feederResult = await connectToSensor('feederSensor');

    console.log(`✅ Sensor initialization complete - simulationMode: ${simulationMode}`);

    return {
      success: true,
      waterSensor: waterResult,
      feederSensor: feederResult,
      simulationMode,
    };
  } catch (error) {
    console.error('Failed to initialize sensors:', error);
    return {
      success: false,
      error: error.message,
      simulationMode: true,
    };
  }
};

/**
 * Connect to a specific sensor module
 * @param {string} sensorType - 'waterSensor' or 'feederSensor'
 * @returns {Promise<Object>} Connection result
 */
const connectToSensor = async (sensorType) => {
  const sensor = SENSOR_CONFIG[sensorType];
  
  console.log(`🔌 Connecting to ${sensorType}...`);
  console.log(`   Endpoint: ${sensor.endpoint}`);
  
  try {
    if (!sensor.endpoint) {
      // No endpoint configured - module not connected
      throw new Error(`${sensor.name} module not detected. Please check the connection.`);
    }

    // Test connection to hardware
    const isConnected = await pingModule(sensor.endpoint);
    
    console.log(`   Connection result: ${isConnected}`);
    
    if (!isConnected) {
      throw new Error(`${sensor.name} module not responding. Please verify the module is powered on.`);
    }

    connectionStatus[sensorType] = {
      connected: true,
      lastUpdate: new Date().toISOString(),
      error: null,
    };
    
    console.log(`✅ ${sensor.name} connected successfully`);

    return {
      connected: true,
      sensorId: sensor.id,
      name: sensor.name,
    };
  } catch (error) {
    connectionStatus[sensorType] = {
      connected: false,
      lastUpdate: new Date().toISOString(),
      error: error.message,
    };

    console.warn(`⚠️ Sensor connection warning: ${error.message}`);
    
    // DON'T enable global simulation mode - let each sensor work independently
    // simulationMode = true;  // REMOVED - this was breaking working sensors!
    console.log(`   ${sensorType} will use simulation, but other sensors can still work`);
    
    return {
      connected: false,
      sensorId: sensor.id,
      name: sensor.name,
      error: error.message,
      usingSimulation: true,
    };
  }
};

/**
 * Ping a module to check if it's responsive
 * @param {string} endpoint - Module endpoint URL
 * @returns {Promise<boolean>} True if module responds
 */
const pingModule = async (endpoint) => {
  try {
    console.log(`🔍 Testing connection to: ${endpoint}`);
    
    // Test connection to ESP32 by calling the sensors endpoint
    const response = await fetch(endpoint, { 
      method: 'GET'
    });
    
    console.log(`📡 Response status: ${response.status}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('📦 Response data:', JSON.stringify(data));
      
      // Check if it's a valid sensor response
      if (data.water || data.feeder || data.timestamp !== undefined) {
        console.log(`✅ Module connected successfully: ${endpoint}`);
        simulationMode = false; // Disable simulation if hardware is available
        return true;
      } else {
        console.log('⚠️ Invalid sensor data format');
      }
    } else {
      console.log(`❌ HTTP error: ${response.status}`);
    }
    return false;
  } catch (error) {
    console.log(`❌ Module connection failed: ${endpoint}`);
    console.log(`   Error: ${error.message}`);
    return false;
  }
};

/**
 * Read water level from ultrasonic sensor
 * @returns {Promise<Object>} Water level reading
 */
export const getWaterLevel = async () => {
  console.log(`💧 getWaterLevel called - simulationMode: ${simulationMode}, connected: ${connectionStatus.waterSensor.connected}`);
  
  try {
    if (simulationMode || !connectionStatus.waterSensor.connected) {
      // Return simulated value with warning
      console.log('⚠️ Using simulated water level');
      return {
        success: true,
        level: simulatedValues.waterLevel,
        unit: '%',
        isSimulated: true,
        warning: connectionStatus.waterSensor.error || 'Water level sensor module not detected. Using simulated data.',
        timestamp: new Date().toISOString(),
      };
    }

    console.log('📡 Reading from hardware...');
    const level = await readFromHardware('waterSensor');
    
    connectionStatus.waterSensor.lastUpdate = new Date().toISOString();
    
    return {
      success: true,
      level,
      unit: '%',
      isSimulated: false,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error reading water level:', error);
    
    // Fallback to simulation on error
    return {
      success: false,
      level: simulatedValues.waterLevel,
      unit: '%',
      isSimulated: true,
      error: `Water level sensor error: ${error.message}`,
      timestamp: new Date().toISOString(),
    };
  }
};

/**
 * Read feeder level from ultrasonic sensor
 * @returns {Promise<Object>} Feeder level reading
 */
export const getFeederLevel = async () => {
  console.log(`🌾 getFeederLevel called - simulationMode: ${simulationMode}, connected: ${connectionStatus.feederSensor.connected}`);
  
  try {
    if (simulationMode || !connectionStatus.feederSensor.connected) {
      // Return simulated value with warning
      console.log('⚠️ Using simulated feeder level');
      return {
        success: true,
        level: simulatedValues.feederLevel,
        unit: '%',
        isSimulated: true,
        warning: connectionStatus.feederSensor.error || 'Feeder level sensor module not detected. Using simulated data.',
        timestamp: new Date().toISOString(),
      };
    }

    console.log('📡 Reading from hardware...');
    const level = await readFromHardware('feederSensor');
    
    connectionStatus.feederSensor.lastUpdate = new Date().toISOString();
    
    return {
      success: true,
      level,
      unit: '%',
      isSimulated: false,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error reading feeder level:', error);
    
    // Fallback to simulation on error
    return {
      success: false,
      level: simulatedValues.feederLevel,
      unit: '%',
      isSimulated: true,
      error: `Feeder level sensor error: ${error.message}`,
      timestamp: new Date().toISOString(),
    };
  }
};

/**
 * Get both sensor readings at once
 * @returns {Promise<Object>} Both water and feeder levels
 */
export const getAllSensorReadings = async () => {
  try {
    console.log("📊 [getAllSensorReadings] Starting...");
    
    const [waterReading, feederReading] = await Promise.all([
      getWaterLevel(),
      getFeederLevel(),
    ]);

    console.log("📊 [getAllSensorReadings] Results:");
    console.log("   💧 Water:", JSON.stringify(waterReading));
    console.log("   🌾 Feeder:", JSON.stringify(feederReading));

    return {
      success: true,
      water: waterReading,
      feeder: feederReading,
      connectionStatus: { ...connectionStatus },
      simulationMode,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error reading sensors:', error);
    return {
      success: false,
      error: error.message,
      water: { level: simulatedValues.waterLevel, isSimulated: true },
      feeder: { level: simulatedValues.feederLevel, isSimulated: true },
      timestamp: new Date().toISOString(),
    };
  }
};

/**
 * Read raw distance from hardware sensor
 * @param {string} sensorType - 'waterSensor' or 'feederSensor'
 * @returns {Promise<number>} Level percentage
 */
const readFromHardware = async (sensorType) => {
  const sensor = SENSOR_CONFIG[sensorType];
  
  if (!sensor.endpoint) {
    throw new Error('Sensor endpoint not configured');
  }
  
  try {
    console.log(`📊 Reading ${sensorType} from: ${sensor.endpoint}`);
    
    // Call ESP32 /api/sensors endpoint
    const response = await fetch(sensor.endpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`📦 Sensor data received:`, JSON.stringify(data));
    
    // Parse response based on sensor type
    // ESP32 returns: { "water": { "level": 75, ... }, "simulationMode": false, ... }
    if (sensorType === 'waterSensor' && data.water) {
      console.log(`💧 Water level: ${data.water.level}%`);
      return data.water.level || 0;
    } else if (sensorType === 'feederSensor' && data.feeder) {
      console.log(`🌾 Feeder level: ${data.feeder.level}%`);
      return data.feeder.level || 0;
    }
    
    throw new Error('Invalid sensor data format');
  } catch (error) {
    console.error(`❌ Hardware read error for ${sensorType}:`, error.message);
    throw error;
  }
};

/**
 * Calculate level percentage from ultrasonic distance reading
 * @param {number} distance - Distance reading in cm
 * @param {Object} sensor - Sensor configuration
 * @returns {number} Level percentage (0-100)
 */
const calculateLevelPercentage = (distance, sensor) => {
  // Clamp distance to valid range
  const clampedDistance = Math.max(sensor.minDistance, Math.min(sensor.maxDistance, distance));
  
  // Calculate percentage (inverse relationship - smaller distance = higher level)
  const range = sensor.maxDistance - sensor.minDistance;
  const level = ((sensor.maxDistance - clampedDistance) / range) * 100;
  
  return Math.round(level);
};

/**
 * Set simulated values for testing
 * @param {Object} values - { waterLevel, feederLevel }
 */
export const setSimulatedValues = (values) => {
  if (values.waterLevel !== undefined) {
    simulatedValues.waterLevel = Math.max(0, Math.min(100, values.waterLevel));
  }
  if (values.feederLevel !== undefined) {
    simulatedValues.feederLevel = Math.max(0, Math.min(100, values.feederLevel));
  }
};

/**
 * Get current connection status
 * @returns {Object} Connection status for all sensors
 */
export const getConnectionStatus = () => ({
  ...connectionStatus,
  simulationMode,
});

/**
 * Configure sensor endpoint for real hardware connection
 * @param {string} sensorType - 'waterSensor' or 'feederSensor'
 * @param {string} endpoint - HTTP/WebSocket endpoint URL
 */
export const configureSensorEndpoint = (sensorType, endpoint) => {
  if (SENSOR_CONFIG[sensorType]) {
    SENSOR_CONFIG[sensorType].endpoint = endpoint;
    // Attempt reconnection
    connectToSensor(sensorType);
  }
};

/**
 * Enable or disable simulation mode
 * @param {boolean} enabled - Whether to enable simulation
 */
export const setSimulationMode = (enabled) => {
  simulationMode = enabled;
};

/**
 * Start continuous sensor polling
 * @param {Function} callback - Callback function to receive readings
 * @param {number} intervalMs - Polling interval in milliseconds (default: 5000)
 * @returns {Function} Stop polling function
 */
export const startSensorPolling = (callback, intervalMs = 5000) => {
  let isPolling = true;
  
  const poll = async () => {
    if (!isPolling) return;
    
    const readings = await getAllSensorReadings();
    callback(readings);
    
    if (isPolling) {
      setTimeout(poll, intervalMs);
    }
  };
  
  // Start polling
  poll();
  
  // Return stop function
  return () => {
    isPolling = false;
  };
};

/**
 * Simulate random fluctuations for demo purposes
 * Call this periodically to make the demo more realistic
 */
export const simulateFluctuation = () => {
  // Small random changes (-2 to +2)
  const waterChange = Math.floor(Math.random() * 5) - 2;
  const feederChange = Math.floor(Math.random() * 5) - 2;
  
  simulatedValues.waterLevel = Math.max(0, Math.min(100, simulatedValues.waterLevel + waterChange));
  simulatedValues.feederLevel = Math.max(0, Math.min(100, simulatedValues.feederLevel + feederChange));
};

export default {
  initializeSensors,
  getWaterLevel,
  getFeederLevel,
  getAllSensorReadings,
  getConnectionStatus,
  configureSensorEndpoint,
  setSimulationMode,
  setSimulatedValues,
  startSensorPolling,
  simulateFluctuation,
};
