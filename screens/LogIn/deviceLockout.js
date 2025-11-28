/**
 * Device Lockout Management
 * Handles login attempt limits and device lockout
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

// Environment detection - set to true for production
const IS_PRODUCTION = false; // Change to true for production builds

// Lockout durations
export const LOGIN_LOCKOUT_DURATION = IS_PRODUCTION
  ? 60 * 60 * 1000 // 1 hour in production
  : 60 * 1000; // 1 minute in development

export const OTP_LOCKOUT_DURATION = IS_PRODUCTION
  ? 60 * 60 * 1000 // 1 hour in production
  : 60 * 1000; // 1 minute in development

// Attempt limits
const LOGIN_ATTEMPT_LIMIT = 5;
const OTP_ATTEMPT_LIMIT = 5;

// Legacy export for backward compatibility
export const LOCKOUT_DURATION = LOGIN_LOCKOUT_DURATION;

const LOCKOUT_KEYS = {
  LOGIN: "device_login_lockout",
  OTP: "device_otp_lockout",
  LOGIN_ATTEMPTS: "device_login_attempts",
  OTP_ATTEMPTS: "device_otp_attempts",
};

/**
 * Check if device is locked out for login
 * @returns {Promise<object>} - { isLockedOut: boolean, remainingTime: number }
 */
export const checkLoginLockout = async () => {
  try {
    const lockoutData = await AsyncStorage.getItem(LOCKOUT_KEYS.LOGIN);

    if (!lockoutData) {
      return { isLockedOut: false, remainingTime: 0 };
    }

    const { lockoutTime } = JSON.parse(lockoutData);
    const now = Date.now();
    const remainingTime = lockoutTime - now;

    if (remainingTime > 0) {
      return { isLockedOut: true, remainingTime };
    } else {
      // Lockout period has expired
      await AsyncStorage.removeItem(LOCKOUT_KEYS.LOGIN);
      await AsyncStorage.removeItem(LOCKOUT_KEYS.LOGIN_ATTEMPTS);
      return { isLockedOut: false, remainingTime: 0 };
    }
  } catch (error) {
    console.error("Error checking login lockout:", error);
    return { isLockedOut: false, remainingTime: 0 };
  }
};

/**
 * Check if device is locked out for OTP
 * @returns {Promise<object>} - { isLockedOut: boolean, remainingTime: number }
 */
export const checkOTPLockout = async () => {
  try {
    const lockoutData = await AsyncStorage.getItem(LOCKOUT_KEYS.OTP);

    if (!lockoutData) {
      return { isLockedOut: false, remainingTime: 0 };
    }

    const { lockoutTime } = JSON.parse(lockoutData);
    const now = Date.now();
    const remainingTime = lockoutTime - now;

    if (remainingTime > 0) {
      return { isLockedOut: true, remainingTime };
    } else {
      // Lockout period has expired
      await AsyncStorage.removeItem(LOCKOUT_KEYS.OTP);
      await AsyncStorage.removeItem(LOCKOUT_KEYS.OTP_ATTEMPTS);
      return { isLockedOut: false, remainingTime: 0 };
    }
  } catch (error) {
    console.error("Error checking OTP lockout:", error);
    return { isLockedOut: false, remainingTime: 0 };
  }
};

/**
 * Increment login attempt counter
 * @returns {Promise<number>} - Current attempt count
 */
export const incrementLoginAttempts = async () => {
  try {
    const attempts = await AsyncStorage.getItem(LOCKOUT_KEYS.LOGIN_ATTEMPTS);
    const currentAttempts = attempts ? parseInt(attempts) + 1 : 1;

    await AsyncStorage.setItem(
      LOCKOUT_KEYS.LOGIN_ATTEMPTS,
      currentAttempts.toString()
    );

    if (currentAttempts >= LOGIN_ATTEMPT_LIMIT) {
      await lockoutLoginOnDevice();
    }

    return currentAttempts;
  } catch (error) {
    console.error("Error incrementing login attempts:", error);
    return 0;
  }
};

/**
 * Increment OTP attempt counter
 * @returns {Promise<number>} - Current attempt count
 */
export const incrementOTPAttempts = async () => {
  try {
    const attempts = await AsyncStorage.getItem(LOCKOUT_KEYS.OTP_ATTEMPTS);
    const currentAttempts = attempts ? parseInt(attempts) + 1 : 1;

    await AsyncStorage.setItem(
      LOCKOUT_KEYS.OTP_ATTEMPTS,
      currentAttempts.toString()
    );

    if (currentAttempts >= OTP_ATTEMPT_LIMIT) {
      await lockoutOTPOnDevice();
    }

    return currentAttempts;
  } catch (error) {
    console.error("Error incrementing OTP attempts:", error);
    return 0;
  }
};

/**
 * Lock out login on device
 * @returns {Promise<void>}
 */
export const lockoutLoginOnDevice = async () => {
  try {
    const lockoutTime = Date.now() + LOGIN_LOCKOUT_DURATION;
    await AsyncStorage.setItem(
      LOCKOUT_KEYS.LOGIN,
      JSON.stringify({
        lockoutTime,
        reason: "login_attempts",
        timestamp: Date.now(),
      })
    );
    console.log(`🔒 Login locked for ${IS_PRODUCTION ? "1 hour" : "1 minute"}`);
  } catch (error) {
    console.error("Error locking out login:", error);
  }
};

/**
 * Lock out OTP on device
 * @returns {Promise<void>}
 */
export const lockoutOTPOnDevice = async () => {
  try {
    const lockoutTime = Date.now() + OTP_LOCKOUT_DURATION;
    await AsyncStorage.setItem(
      LOCKOUT_KEYS.OTP,
      JSON.stringify({
        lockoutTime,
        reason: "otp_attempts",
        timestamp: Date.now(),
      })
    );
    console.log(`🔒 OTP locked for ${IS_PRODUCTION ? "1 hour" : "1 minute"}`);
  } catch (error) {
    console.error("Error locking out OTP:", error);
  }
};

/**
 * Reset login attempts
 * @returns {Promise<void>}
 */
export const resetLoginAttempts = async () => {
  try {
    await AsyncStorage.removeItem(LOCKOUT_KEYS.LOGIN_ATTEMPTS);
  } catch (error) {
    console.error("Error resetting login attempts:", error);
  }
};

/**
 * Reset OTP attempts
 * @returns {Promise<void>}
 */
export const resetOTPAttempts = async () => {
  try {
    await AsyncStorage.removeItem(LOCKOUT_KEYS.OTP_ATTEMPTS);
  } catch (error) {
    console.error("Error resetting OTP attempts:", error);
  }
};

/**
 * Format remaining lockout time
 * @param {number} milliseconds - Remaining time in milliseconds
 * @returns {string} - Formatted time (MM:SS or HH:MM:SS)
 */
export const formatLockoutTime = (milliseconds) => {
  const totalSeconds = Math.ceil(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }

  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
};

/**
 * Get current environment info
 * @returns {object} - Environment information
 */
export const getEnvironmentInfo = () => {
  return {
    isProduction: IS_PRODUCTION,
    loginLockoutDuration: LOGIN_LOCKOUT_DURATION,
    otpLockoutDuration: OTP_LOCKOUT_DURATION,
    loginAttemptLimit: LOGIN_ATTEMPT_LIMIT,
    otpAttemptLimit: OTP_ATTEMPT_LIMIT,
  };
};

/**
 * Clear all lockout data (for testing/debugging)
 * @returns {Promise<void>}
 */
export const clearAllLockoutData = async () => {
  try {
    await AsyncStorage.multiRemove([
      LOCKOUT_KEYS.LOGIN,
      LOCKOUT_KEYS.OTP,
      LOCKOUT_KEYS.LOGIN_ATTEMPTS,
      LOCKOUT_KEYS.OTP_ATTEMPTS,
    ]);
    console.log("✅ All lockout data cleared");
  } catch (error) {
    console.error("Error clearing lockout data:", error);
  }
};
