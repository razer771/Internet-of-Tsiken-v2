import AsyncStorage from "@react-native-async-storage/async-storage";

// --- Lockout Configuration ---
// Maximum cumulative number of failed attempts before the FIRST device lock.
// The attempt counter is ONLY reset when the user successfully logs in.
export const MAX_ATTEMPTS = 5;

// Lockout Duration in milliseconds (1 minute, 5 minutes, 1 day)
const MINUTE = 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

export const LOCKOUT_DURATIONS = {
  FIRST: MINUTE * 1, // 1 minute (After 5 cumulative failed attempts)
  SECOND: MINUTE * 5, // 5 minutes (After 10 cumulative failed attempts)
  THIRD_PLUS: DAY * 1, // 1 day (After 15+ cumulative failed attempts)
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

  } catch (error) {
    console.error("AsyncStorage error in incrementLoginAttempts:", error);
    return { attempts: 0, shouldLock: false };
  }
};

/**
 * Clears the failed login attempt count and lockout status.
 * @param {string} email - The email address to reset.
 */
export const resetLoginAttempts = async (email) => {
  if (!email) return;

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