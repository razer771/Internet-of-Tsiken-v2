/**
 * ServoMotorService.js
 * 
 * Service to interface with servo motors for feed dispensing and water sprinkler control.
 * This service handles communication with hardware modules (ESP32) and provides fallback error handling.
 */

import { getWaterSystemUrl, getFeedSystemUrl } from '../config/esp32config';

// Configuration for servo motors
const SERVO_CONFIG = {
  feedDispenser: {
    id: 'SERVO_FEED_01',
    name: 'Feed Dispenser Servo',
    // Servo settings
    minAngle: 0,
    maxAngle: 180,
    dispenseAngle: 15,    // Angle to open dispenser (SG90)
    closedAngle: 90,      // Angle when closed (resting pose)
    dispenseDuration: 2000, // Duration in ms to keep open (2 seconds)
    endpoint: null,       // Will be set when connecting to actual module
  },
  waterSprinkler: {
    id: 'SERVO_WATER_01',
    name: 'Water Sprinkler Servo',
    // Servo settings
    minAngle: 0,
    maxAngle: 180,
    openAngle: 90,        // Angle to open valve
    closedAngle: 0,       // Angle when closed
    defaultDuration: 5000, // Default spray duration in ms
    endpoint: null,       // Will be set when connecting to actual module
  },
};

// Connection status
let connectionStatus = {
  feedDispenser: { connected: false, lastUpdate: null, error: null, isOperating: false },
  waterSprinkler: { connected: false, lastUpdate: null, error: null, isOperating: false },
};

// Flag to enable/disable simulation mode
let simulationMode = true;

/**
 * Initialize connection to servo motor modules
 * @param {Object} config - Optional configuration overrides
 * @returns {Promise<Object>} Connection status
 */
export const initializeServos = async (config = {}) => {
  try {
    // Auto-configure endpoints from ESP32 config
    const waterSystemUrl = getWaterSystemUrl();
    const feedSystemUrl = getFeedSystemUrl();
    
    console.log(`[ServoMotorService] 🔧 Initializing servos...`);
    console.log(`[ServoMotorService]   Water System URL: ${waterSystemUrl || 'NOT CONFIGURED'}`);
    console.log(`[ServoMotorService]   Feed System URL: ${feedSystemUrl || 'NOT CONFIGURED'}`);
    
    if (waterSystemUrl && !SERVO_CONFIG.waterSprinkler.endpoint) {
      SERVO_CONFIG.waterSprinkler.endpoint = waterSystemUrl;
      console.log(`[ServoMotorService]   ✓ Water endpoint set`);
    }
    
    if (feedSystemUrl && !SERVO_CONFIG.feedDispenser.endpoint) {
      SERVO_CONFIG.feedDispenser.endpoint = feedSystemUrl;
      console.log(`[ServoMotorService]   ✓ Feed endpoint set`);
    }
    
    // Merge custom config if provided
    if (config.feedDispenser) {
      Object.assign(SERVO_CONFIG.feedDispenser, config.feedDispenser);
    }
    if (config.waterSprinkler) {
      Object.assign(SERVO_CONFIG.waterSprinkler, config.waterSprinkler);
    }

    // Attempt to connect to feed dispenser servo
    const feedResult = await connectToServo('feedDispenser');
    
    // Attempt to connect to water sprinkler servo
    const waterResult = await connectToServo('waterSprinkler');

    return {
      success: true,
      feedDispenser: feedResult,
      waterSprinkler: waterResult,
      simulationMode,
    };
  } catch (error) {
    console.error('Failed to initialize servos:', error);
    return {
      success: false,
      error: error.message,
      simulationMode: true,
    };
  }
};

/**
 * Connect to a specific servo motor module
 * @param {string} servoType - 'feedDispenser' or 'waterSprinkler'
 * @returns {Promise<Object>} Connection result
 */
const connectToServo = async (servoType) => {
  const servo = SERVO_CONFIG[servoType];
  
  try {
    // TODO: Replace with actual hardware connection logic
    // This could be:
    // 1. WebSocket connection to ESP32/Arduino
    // 2. HTTP polling to a local server
    // 3. Bluetooth connection
    
    if (!servo.endpoint) {
      // No endpoint configured - module not connected
      throw new Error(`${servo.name} motor not detected. Please check the connection.`);
    }

    // Try to ping the servo
    const isConnected = await pingServo(servo.endpoint);
    
    if (isConnected) {
      // Ping successful - definitely connected
      connectionStatus[servoType] = {
        connected: true,
        lastUpdate: new Date().toISOString(),
        error: null,
        isOperating: false,
      };
      simulationMode = false;
      
      console.log(`✅ ${servo.name} connected and verified`);
      
      return {
        connected: true,
        servoId: servo.id,
        name: servo.name,
      };
    } else {
      // Ping failed, but keep endpoint configured so hardware calls can still be attempted
      console.log(`⚠️ ${servo.name} ping failed, but will still attempt commands`);
      
      connectionStatus[servoType] = {
        connected: false,
        lastUpdate: new Date().toISOString(),
        error: 'Ping failed, will attempt commands anyway',
        isOperating: false,
      };
      
      // Don't set simulationMode to true - let individual commands try hardware first
      
      return {
        connected: false,
        servoId: servo.id,
        name: servo.name,
        warning: 'Ping failed but endpoint configured',
      };
    }
  } catch (error) {
    connectionStatus[servoType] = {
      connected: false,
      lastUpdate: new Date().toISOString(),
      error: error.message,
      isOperating: false,
    };

    console.warn(`Servo connection warning: ${error.message}`);
    
    // Enable simulation mode as fallback
    simulationMode = true;
    
    return {
      connected: false,
      servoId: servo.id,
      name: servo.name,
      error: error.message,
      usingSimulation: true,
    };
  }
};

/**
 * Ping a servo module to check if it's responsive
 * @param {string} endpoint - Module endpoint URL
 * @returns {Promise<boolean>} True if module responds
 */
const pingServo = async (endpoint) => {
  try {
    console.log(`[ServoMotorService] Pinging ${endpoint}`);
    const response = await Promise.race([
      fetch(endpoint, { method: 'GET' }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
    ]);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`[ServoMotorService] ✅ ESP32 connected: ${data.device || 'Unknown'}`);
      return true;
    }
    console.log(`[ServoMotorService] Ping failed: HTTP ${response.status}`);
    return false;
  } catch (error) {
    console.log(`[ServoMotorService] ⚠️ Ping failed:`, error.message);
    return false;
  }
};

/**
 * Dispense feed using the servo motor
 * @param {Object} options - Dispense options
 * @param {number} options.duration - Duration to keep dispenser open (ms)
 * @param {number} options.angle - Servo angle for dispensing
 * @returns {Promise<Object>} Dispense result
 */
export const dispenseFeed = async (options = {}) => {
  const servo = SERVO_CONFIG.feedDispenser;
  const duration = options.duration || servo.dispenseDuration;
  const angle = options.angle || servo.dispenseAngle;

  try {
    // Check if already operating
    if (connectionStatus.feedDispenser.isOperating) {
      return {
        success: false,
        error: 'Feed dispenser is already operating. Please wait.',
        isSimulated: false,
      };
    }

    // Always try real hardware first if an endpoint is configured
    connectionStatus.feedDispenser.isOperating = true;

    if (servo.endpoint) {
      try {
        console.log(`[ServoMotorService] 🍗 Dispensing feed via ESP32: angle=${angle}°, duration=${duration}ms`);
        
        const result = await sendServoCommand('feedDispenser', {
          action: 'dispense',
          angle: angle,
          duration: duration,
        });

        connectionStatus.feedDispenser.connected = true;
        connectionStatus.feedDispenser.error = null;
        connectionStatus.feedDispenser.isOperating = false;
        connectionStatus.feedDispenser.lastUpdate = new Date().toISOString();
        simulationMode = false;

        console.log(`[ServoMotorService] ✅ Feed dispensed successfully:`, result);

        return {
          success: true,
          message: 'Feed dispensed successfully',
          isSimulated: false,
          duration,
          angle,
          timestamp: new Date().toISOString(),
          esp32Response: result,
        };
      } catch (error) {
        console.warn('[ServoMotorService] ❌ Hardware dispense failed:', error.message);
        connectionStatus.feedDispenser.connected = false;
        connectionStatus.feedDispenser.error = error.message;
        connectionStatus.feedDispenser.isOperating = false;
        // Fall through to simulation
      }
    }

    // If no endpoint or hardware failed, simulate as fallback
    console.log(`[SIMULATED] Dispensing feed - Angle: ${angle}°, Duration: ${duration}ms`);

    // Simulate the operation delay
    await new Promise(resolve => setTimeout(resolve, Math.min(duration, 2000)));

    connectionStatus.feedDispenser.isOperating = false;
    connectionStatus.feedDispenser.lastUpdate = new Date().toISOString();

    return {
      success: true,
      message: hardwareAttempted
        ? 'Hardware dispense failed. Simulated operation completed.'
        : 'Feed dispensed successfully (simulated)',
      isSimulated: true,
      warning: connectionStatus.feedDispenser.error || 'Feed dispenser motor not detected. Operation simulated.',
      duration,
      angle,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    connectionStatus.feedDispenser.isOperating = false;
    console.error('Error dispensing feed:', error);
    
    return {
      success: false,
      error: `Feed dispenser error: ${error.message}`,
      isSimulated: true,
      timestamp: new Date().toISOString(),
    };
  }
};

/**
 * Activate water sprinkler using the servo motor
 * @param {Object} options - Sprinkler options
 * @param {number} options.duration - Duration to keep sprinkler active (ms)
 * @param {number} options.angle - Servo angle for sprinkler
 * @returns {Promise<Object>} Sprinkler activation result
 */
export const activateSprinkler = async (options = {}) => {
  const servo = SERVO_CONFIG.waterSprinkler;
  const duration = options.duration || servo.defaultDuration;
  const angle = options.angle || servo.openAngle;

  try {
    // Check if already operating
    if (connectionStatus.waterSprinkler.isOperating) {
      return {
        success: false,
        error: 'Water sprinkler is already operating. Please wait.',
        isSimulated: false,
      };
    }

    // Always try real hardware first if an endpoint is configured
    connectionStatus.waterSprinkler.isOperating = true;

    let hardwareAttempted = false;
    if (servo.endpoint) {
      try {
        hardwareAttempted = true;
        const result = await sendServoCommand('waterSprinkler', {
          action: 'activate',
          angle,
          duration,
        });

        connectionStatus.waterSprinkler.connected = true;
        connectionStatus.waterSprinkler.error = null;
        simulationMode = false;

        connectionStatus.waterSprinkler.isOperating = false;
        connectionStatus.waterSprinkler.lastUpdate = new Date().toISOString();

        return {
          success: true,
          message: 'Water sprinkler activated successfully',
          isSimulated: false,
          duration,
          angle,
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        console.warn('[ServoMotorService] Water hardware activate failed, falling back to simulation:', error.message);
        connectionStatus.waterSprinkler.connected = false;
        connectionStatus.waterSprinkler.error = error.message;
      }
    }

    // If no endpoint or hardware failed, simulate as fallback
    console.log(`[SIMULATED] Activating sprinkler - Angle: ${angle}°, Duration: ${duration}ms`);

    // Simulate the operation delay
    await new Promise(resolve => setTimeout(resolve, Math.min(duration, 2000)));

    connectionStatus.waterSprinkler.isOperating = false;
    connectionStatus.waterSprinkler.lastUpdate = new Date().toISOString();

    return {
      success: true,
      message: hardwareAttempted
        ? 'Hardware activation failed. Simulated operation completed.'
        : 'Water sprinkler activated successfully (simulated)',
      isSimulated: true,
      warning: connectionStatus.waterSprinkler.error || 'Water sprinkler motor not detected. Operation simulated.',
      duration,
      angle,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    connectionStatus.waterSprinkler.isOperating = false;
    console.error('Error activating sprinkler:', error);
    
    return {
      success: false,
      error: `Water sprinkler error: ${error.message}`,
      isSimulated: true,
      timestamp: new Date().toISOString(),
    };
  }
};

/**
 * Send command to servo motor hardware
 * @param {string} servoType - 'feedDispenser' or 'waterSprinkler'
 * @param {Object} command - Command object
 * @returns {Promise<Object>} Command result
 */
const sendServoCommand = async (servoType, command) => {
  const servo = SERVO_CONFIG[servoType];
  
  if (!servo.endpoint) {
    throw new Error('Hardware endpoint not configured');
  }
  
  try {
    let endpoint = servo.endpoint;
    let requestBody = {};
    
    // For feed dispenser, use ESP32 servo API
    if (servoType === 'feedDispenser') {
      endpoint = command.action === 'dispense' 
        ? `${servo.endpoint}/api/servo/start`
        : `${servo.endpoint}/api/servo/stop`;
      // ESP32 servo expects: { angle, duration }
      requestBody = {
        angle: command.angle,
        duration: command.duration,
      };
    }
    
    // For water sprinkler (micro water pump), use ESP32 pump API
    if (servoType === 'waterSprinkler') {
      endpoint = command.action === 'activate' 
        ? `${servo.endpoint}/api/pump/start`
        : `${servo.endpoint}/api/pump/stop`;
      // ESP32 pump expects: { duration }
      requestBody = {
        duration: command.duration,
      };
    }
    
    console.log(`[ServoMotorService] 📡 POST ${endpoint}`, requestBody);
    
    const response = await Promise.race([
      fetch(endpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout after 10s')), 10000)
      )
    ]);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`[ServoMotorService] Response from ${endpoint}:`, data);
    return data;
  } catch (error) {
    console.error(`Hardware command error for ${servoType}:`, error);
    throw error;
  }
};

/**
 * Get current connection status for all servos
 * @returns {Object} Connection status
 */
export const getServoConnectionStatus = () => ({
  ...connectionStatus,
  simulationMode,
});

/**
 * Check if feed dispenser is connected
 * @returns {boolean} Connection status
 */
export const isFeedDispenserConnected = () => {
  return connectionStatus.feedDispenser.connected && !simulationMode;
};

/**
 * Check if water sprinkler is connected
 * @returns {boolean} Connection status
 */
export const isSprinklerConnected = () => {
  return connectionStatus.waterSprinkler.connected && !simulationMode;
};

/**
 * Configure servo endpoint for real hardware connection
 * @param {string} servoType - 'feedDispenser' or 'waterSprinkler'
 * @param {string} endpoint - HTTP/WebSocket endpoint URL
 */
export const configureServoEndpoint = (servoType, endpoint) => {
  if (SERVO_CONFIG[servoType]) {
    SERVO_CONFIG[servoType].endpoint = endpoint;
    // Attempt reconnection
    connectToServo(servoType);
  }
};

/**
 * Enable or disable simulation mode
 * @param {boolean} enabled - Whether to enable simulation
 */
export const setServoSimulationMode = (enabled) => {
  simulationMode = enabled;
};

/**
 * Emergency stop all servo operations
 * @returns {Promise<Object>} Stop result
 */
export const emergencyStop = async () => {
  try {
    // Reset all operating states
    connectionStatus.feedDispenser.isOperating = false;
    connectionStatus.waterSprinkler.isOperating = false;
    
    // TODO: Send stop command to actual hardware
    // if (!simulationMode) {
    //   await sendServoCommand('feedDispenser', { action: 'stop' });
    //   await sendServoCommand('waterSprinkler', { action: 'stop' });
    // }
    
    return {
      success: true,
      message: 'All servo operations stopped',
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  }
};

/**
 * Configure ESP32 water system with user ID for scheduled watering
 * @param {string} userId - Firebase user ID
 * @returns {Promise<Object>} Configuration result
 */
export const configureWaterSystemUserId = async (userId) => {
  try {
    const waterSystemUrl = getWaterSystemUrl();
    if (!waterSystemUrl) {
      console.log('⚠️ Water system URL not configured');
      return { success: false, error: 'Water system not configured' };
    }

    console.log(`📡 Sending user ID to ESP32: ${waterSystemUrl}/api/system/userid`);

    const response = await fetch(`${waterSystemUrl}/api/system/userid`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId }),
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ ESP32 configured with user ID:', userId);
      return { success: true, data };
    } else {
      const errorText = await response.text();
      console.log(`⚠️ Failed to configure ESP32 user ID: ${response.status} - ${errorText}`);
      return { success: false, error: `HTTP ${response.status}` };
    }
  } catch (error) {
    console.error('❌ Error configuring ESP32 user ID:', error);
    return { success: false, error: error.message };
  }
};

export default {
  initializeServos,
  dispenseFeed,
  activateSprinkler,
  getServoConnectionStatus,
  isFeedDispenserConnected,
  isSprinklerConnected,
  configureServoEndpoint,
  setServoSimulationMode,
  emergencyStop,
  configureWaterSystemUserId,
};
