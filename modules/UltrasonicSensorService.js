/**
 * UltrasonicSensorService.js
 * 
 * Service to interface with ultrasonic sensor modules for water and feeder level detection.
 * This service handles communication with hardware modules and provides fallback error handling.
 * 
 * TODO: Connect to actual hardware modules (ESP32/Arduino) via WebSocket or HTTP API
 * TODO: Connect to Firestore for data persistence
 */

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
  try {
    // Merge custom config if provided
    if (config.waterSensor) {
      Object.assign(SENSOR_CONFIG.waterSensor, config.waterSensor);
    }
    if (config.feederSensor) {
      Object.assign(SENSOR_CONFIG.feederSensor, config.feederSensor);
    }

    // Attempt to connect to water sensor
    const waterResult = await connectToSensor('waterSensor');
    
    // Attempt to connect to feeder sensor
    const feederResult = await connectToSensor('feederSensor');

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
  
  try {
    // TODO: Replace with actual hardware connection logic
    // This could be:
    // 1. WebSocket connection to ESP32/Arduino
    // 2. HTTP polling to a local server
    // 3. Bluetooth connection
    // 4. Serial port communication
    
    if (!sensor.endpoint) {
      // No endpoint configured - module not connected
      throw new Error(`${sensor.name} module not detected. Please check the connection.`);
    }

    // Simulated connection attempt
    // In real implementation, this would ping the hardware
    const isConnected = await pingModule(sensor.endpoint);
    
    if (!isConnected) {
      throw new Error(`${sensor.name} module not responding. Please verify the module is powered on.`);
    }

    connectionStatus[sensorType] = {
      connected: true,
      lastUpdate: new Date().toISOString(),
      error: null,
    };

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

    console.warn(`Sensor connection warning: ${error.message}`);
    
    // Enable simulation mode as fallback
    simulationMode = true;
    
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
    // TODO: Implement actual ping logic
    // Example for HTTP-based module:
    // const response = await fetch(`${endpoint}/ping`, { timeout: 5000 });
    // return response.ok;
    
    // For now, return false to trigger simulation mode
    return false;
  } catch (error) {
    return false;
  }
};

/**
 * Read water level from ultrasonic sensor
 * @returns {Promise<Object>} Water level reading
 */
export const getWaterLevel = async () => {
  try {
    if (simulationMode || !connectionStatus.waterSensor.connected) {
      // Return simulated value with warning
      return {
        success: true,
        level: simulatedValues.waterLevel,
        unit: '%',
        isSimulated: true,
        warning: connectionStatus.waterSensor.error || 'Water level sensor module not detected. Using simulated data.',
        timestamp: new Date().toISOString(),
      };
    }

    // TODO: Implement actual sensor reading
    // const distance = await readUltrasonicDistance(SENSOR_CONFIG.waterSensor.endpoint);
    // const level = calculateLevelPercentage(distance, SENSOR_CONFIG.waterSensor);
    
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
  try {
    if (simulationMode || !connectionStatus.feederSensor.connected) {
      // Return simulated value with warning
      return {
        success: true,
        level: simulatedValues.feederLevel,
        unit: '%',
        isSimulated: true,
        warning: connectionStatus.feederSensor.error || 'Feeder level sensor module not detected. Using simulated data.',
        timestamp: new Date().toISOString(),
      };
    }

    // TODO: Implement actual sensor reading
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
    const [waterReading, feederReading] = await Promise.all([
      getWaterLevel(),
      getFeederLevel(),
    ]);

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
  
  // TODO: Implement actual hardware communication
  // Example for ESP32 via HTTP:
  /*
  const response = await fetch(`${sensor.endpoint}/read`);
  const data = await response.json();
  const distance = data.distance; // in cm
  return calculateLevelPercentage(distance, sensor);
  */
  
  // For now, throw error to trigger fallback
  throw new Error('Hardware communication not implemented');
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
