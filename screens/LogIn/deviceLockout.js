import AsyncStorage from "@react-native-async-storage/async-storage";

// Environment detection - set to true for production
const IS_PRODUCTION = false; // Change to true for production builds

// Lockout durations
export const LOGIN_LOCKOUT_DURATION = IS_PRODUCTION
  ? 60 * 60 * 1000 // 1 hour in production
  : 10 * 1000; // 10 seconds in development

export const OTP_LOCKOUT_DURATION = IS_PRODUCTION
  ? 60 * 60 * 1000 // 1 hour in production
  : 10 * 1000; // 10 seconds in development
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

// --- Storage Keys ---
const getAttemptsKey = (email) => `loginAttempts:${email}`;
const getLockoutKey = (email) => `lockoutTime:${email}`;

// --- Core Logic Functions ---

/**
 * Gets the current lockout status for an email account.
 * @param {string} email - The email address to check.
 * @returns {object} - { isLockedOut, remainingTime, totalAttempts }
 */
export const checkLoginLockout = async (email) => {
  if (!email) return { isLockedOut: false, remainingTime: 0, totalAttempts: 0 };
  
  const attemptsKey = getAttemptsKey(email);
  const lockoutKey = getLockoutKey(email);

  try {
    const attemptsStr = await AsyncStorage.getItem(attemptsKey);
    const lockoutTimeStr = await AsyncStorage.getItem(lockoutKey);
    
    const totalAttempts = attemptsStr ? parseInt(attemptsStr, 10) : 0;
    const lockedUntil = lockoutTimeStr ? parseInt(lockoutTimeStr, 10) : 0;
    const now = Date.now();
    
    // Determine the current lockout duration based on attempt count
    let currentDuration = 0;
    if (totalAttempts >= MAX_ATTEMPTS * 3) { // 15+ attempts
      currentDuration = LOCKOUT_DURATIONS.THIRD_PLUS;
    } else if (totalAttempts >= MAX_ATTEMPTS * 2) { // 10+ attempts
      currentDuration = LOCKOUT_DURATIONS.SECOND;
    } else if (totalAttempts >= MAX_ATTEMPTS) { // 5+ attempts
      currentDuration = LOCKOUT_DURATIONS.FIRST;
    }

    let remainingTime = 0;
    // Check if lockedUntil is still in the future AND a valid duration threshold is set
    const isLockedOut = (lockedUntil > now) && (currentDuration > 0);
    
    if (isLockedOut) {
      remainingTime = lockedUntil - now;
    } else if (totalAttempts >= MAX_ATTEMPTS && lockedUntil > 0) {
      // Lockout has expired, clear the lockout time key ONLY.
      // The attempt counter (attemptsKey) is KEPT for cumulative locking.
      // This is the important logic change to prevent cumulative count reset.
      await AsyncStorage.removeItem(lockoutKey);
      // NO need to call resetLoginAttempts(email) here, because we want cumulative.
    }
    
    return { 
      isLockedOut, 
      remainingTime, 
      totalAttempts 
    };
  } catch (error) {
    console.error("AsyncStorage error in checkLoginLockout:", error);
    return { isLockedOut: false, remainingTime: 0, totalAttempts: 0 };
  }
};

/**
 * Increments the failed login attempt count and applies lock if MAX_ATTEMPTS is reached.
 * The attempt count is cumulative.
 * @param {string} email - The email address that failed to authenticate.
 * @returns {object} - { attempts, shouldLock, duration, message }
 */
export const incrementLoginAttempts = async (email) => {
  if (!email) return { attempts: 0, shouldLock: false };
  
  const attemptsKey = getAttemptsKey(email);
  const lockoutKey = getLockoutKey(email);

  try {
    const attemptsStr = await AsyncStorage.getItem(attemptsKey);
    let attempts = attemptsStr ? parseInt(attemptsStr, 10) + 1 : 1;
    
    // Cap the counter for visual clarity and to avoid overflow
    attempts = Math.min(attempts, MAX_ATTEMPTS * 3 + 1); 

    await AsyncStorage.setItem(attemptsKey, attempts.toString());

    let shouldLock = false;
    let duration = 0;
    let message = "";

    // Check if the current attempt count triggers a new lock duration
    if (attempts === MAX_ATTEMPTS || attempts === MAX_ATTEMPTS * 2 || attempts === MAX_ATTEMPTS * 3) {
      shouldLock = true;
      const now = Date.now();
      
      // Determine duration based on attempt thresholds
      if (attempts === MAX_ATTEMPTS) { // 5th attempt triggers 1 min lock
        duration = LOCKOUT_DURATIONS.FIRST;
        message = "First lockout applied (1 minute)";
      } else if (attempts === MAX_ATTEMPTS * 2) { // 10th attempt triggers 5 min lock
        duration = LOCKOUT_DURATIONS.SECOND;
        message = "Second lockout applied (5 minutes)";
      } else { // 15th attempt triggers 1 day lock
        duration = LOCKOUT_DURATIONS.THIRD_PLUS;
        message = "Third/Final lockout applied (1 day)";
      }
      
      const lockedUntil = now + duration;
      await AsyncStorage.setItem(lockoutKey, lockedUntil.toString());
      
      return { 
        attempts, 
        shouldLock, 
        duration, 
        message 
      };
    } else if (attempts > MAX_ATTEMPTS * 3) {
      // Already in long-term lockout (1 day), reconfirm lock time
      const lockoutStatus = await checkLoginLockout(email);
      if (lockoutStatus.isLockedOut) {
         // Return shouldLock=true to keep the Login screen in locked state
         return { 
           attempts, 
           shouldLock: true, 
           duration: lockoutStatus.remainingTime, 
           message: "Account remains locked." 
         };
      }
    }

    return { 
      attempts, 
      shouldLock: false, 
      duration: 0, 
      message: "Attempt recorded, not locked." 
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
    console.log(
      `🔒 Login locked for ${IS_PRODUCTION ? "1 hour" : "10 seconds"}`
    );
  } catch (error) {
    console.error("AsyncStorage error in incrementLoginAttempts:", error);
    return { attempts: 0, shouldLock: false };
  }
};

/**
 * Clears the failed login attempt count and lockout status.
 * @param {string} email - The email address to reset.
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
    console.log(`🔒 OTP locked for ${IS_PRODUCTION ? "1 hour" : "10 seconds"}`);
  } catch (error) {
    console.error("Error locking out OTP:", error);
  }
};

  const attemptsKey = getAttemptsKey(email);
  const lockoutKey = getLockoutKey(email);
  
  try {
    await AsyncStorage.removeItem(attemptsKey);
    await AsyncStorage.removeItem(lockoutKey);
    console.log(`✅ Login attempts reset for ${email}`);
  } catch (error) {
    console.error("AsyncStorage error in resetLoginAttempts:", error);
  }
};

// --- Helper Functions ---

/**
 * Formats milliseconds to a readable MM:SS or HH:MM:SS string.
 */
export const formatLockoutTime = (milliseconds) => {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  
  if (totalSeconds >= 3600) {
    // Show HH:MM:SS if duration is 1 hour or more (for 1 day lock)
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    const pad = (num) => (num < 10 ? "0" : "") + num;
    
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  } else {
    // Show MM:SS
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    
    const pad = (num) => (num < 10 ? "0" : "") + num;
    
    return `${pad(minutes)}:${pad(seconds)}`;
  }
};

/**
 * Generates a user-friendly lockout message based on attempt count.
 */
export const getLockoutMessage = (attempts) => {
  if (attempts >= MAX_ATTEMPTS * 3) {
    return "This account is temporarily locked due to 15 or more cumulative failed attempts (1 day).";
  } else if (attempts >= MAX_ATTEMPTS * 2) {
    return "This account is temporarily locked due to 10 cumulative failed attempts (5 minutes).";
  } else if (attempts >= MAX_ATTEMPTS) {
    return "This device is temporarily locked due to 5 cumulative failed attempts (1 minute).";
  }
  return "Account is locked.";
};

/**
 * Generates a message about remaining attempts before the next lock.
 */
export const getRemainingAttemptsMessage = (attempts) => {
  const attemptsToNextLock = MAX_ATTEMPTS - (attempts % MAX_ATTEMPTS);
  
  // If attempts is a multiple of MAX_ATTEMPTS (5, 10, 15, etc.) and greater than 0, it means it's locked.
  if (attempts > 0 && attempts % MAX_ATTEMPTS === 0) {
    return "Device is now locked.";
  }

  if (attempts < MAX_ATTEMPTS) {
    // Before first lock
    return `${attemptsToNextLock} attempt${attemptsToNextLock !== 1 ? 's' : ''} remaining before temporary device lock.`;
  }
  
  // Between first and second lock, or second and third lock.
  return `${attemptsToNextLock} attempt${attemptsToNextLock !== 1 ? 's' : ''} remaining before next temporary device lock.`;
};