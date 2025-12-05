import AsyncStorage from "@react-native-async-storage/async-storage";
import { auth } from "../config/firebaseconfig";

/**
 * Admin Session Service
 * Manages admin authentication sessions with secure storage
 */

const ADMIN_SESSION_KEYS = {
  IS_ADMIN: "isAdminBypass",
  ADMIN_EMAIL: "adminEmail",
  SESSION_TIMESTAMP: "adminSessionTimestamp",
  ADMIN_ROLE: "adminRole",
};

// Session timeout in milliseconds (24 hours)
const SESSION_TIMEOUT = 24 * 60 * 60 * 1000;

/**
 * Create a new admin session
 * @param {string} email - Admin email address
 * @param {string} role - Admin role (optional)
 */
export const createAdminSession = async (email, role = "admin") => {
  try {
    const sessionData = {
      [ADMIN_SESSION_KEYS.IS_ADMIN]: "true",
      [ADMIN_SESSION_KEYS.ADMIN_EMAIL]: email,
      [ADMIN_SESSION_KEYS.SESSION_TIMESTAMP]: new Date().toISOString(),
      [ADMIN_SESSION_KEYS.ADMIN_ROLE]: role,
    };

    // Store all session data
    await Promise.all(
      Object.entries(sessionData).map(([key, value]) =>
        AsyncStorage.setItem(key, value)
      )
    );

    console.log("✓ Admin session created for:", email);
    return true;
  } catch (error) {
    console.error("Error creating admin session:", error);
    return false;
  }
};

/**
 * Validate existing admin session
 * @returns {Object} { isValid: boolean, email: string | null, role: string | null }
 */
export const validateAdminSession = async () => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      await clearAdminSession();
      return { isValid: false, email: null, role: null };
    }

    const [isAdmin, adminEmail, timestamp, role] = await Promise.all([
      AsyncStorage.getItem(ADMIN_SESSION_KEYS.IS_ADMIN),
      AsyncStorage.getItem(ADMIN_SESSION_KEYS.ADMIN_EMAIL),
      AsyncStorage.getItem(ADMIN_SESSION_KEYS.SESSION_TIMESTAMP),
      AsyncStorage.getItem(ADMIN_SESSION_KEYS.ADMIN_ROLE),
    ]);

    // Check if all required data exists
    if (isAdmin !== "true" || !adminEmail || !timestamp) {
      await clearAdminSession();
      return { isValid: false, email: null, role: null };
    }

    // Check if email matches current user
    if (adminEmail !== currentUser.email) {
      console.log("⚠ Admin email mismatch - clearing session");
      await clearAdminSession();
      return { isValid: false, email: null, role: null };
    }

    // Check session timeout
    const sessionAge = Date.now() - new Date(timestamp).getTime();
    if (sessionAge > SESSION_TIMEOUT) {
      console.log("⚠ Admin session expired - clearing session");
      await clearAdminSession();
      return { isValid: false, email: null, role: null };
    }

    // Session is valid - update timestamp
    await AsyncStorage.setItem(
      ADMIN_SESSION_KEYS.SESSION_TIMESTAMP,
      new Date().toISOString()
    );

    console.log("✓ Admin session valid for:", adminEmail);
    return { isValid: true, email: adminEmail, role: role || "admin" };
  } catch (error) {
    console.error("Error validating admin session:", error);
    await clearAdminSession();
    return { isValid: false, email: null, role: null };
  }
};

/**
 * Clear admin session data
 */
export const clearAdminSession = async () => {
  try {
    await Promise.all(
      Object.values(ADMIN_SESSION_KEYS).map((key) =>
        AsyncStorage.removeItem(key)
      )
    );
    console.log("✓ Admin session cleared");
    return true;
  } catch (error) {
    console.error("Error clearing admin session:", error);
    return false;
  }
};

/**
 * Check if current user has an active admin session
 * @returns {boolean}
 */
export const isAdminSession = async () => {
  const { isValid } = await validateAdminSession();
  return isValid;
};

/**
 * Get admin session info
 * @returns {Object} { email: string | null, role: string | null, timestamp: string | null }
 */
export const getAdminSessionInfo = async () => {
  try {
    const [email, role, timestamp] = await Promise.all([
      AsyncStorage.getItem(ADMIN_SESSION_KEYS.ADMIN_EMAIL),
      AsyncStorage.getItem(ADMIN_SESSION_KEYS.ADMIN_ROLE),
      AsyncStorage.getItem(ADMIN_SESSION_KEYS.SESSION_TIMESTAMP),
    ]);

    return { email, role, timestamp };
  } catch (error) {
    console.error("Error getting admin session info:", error);
    return { email: null, role: null, timestamp: null };
  }
};

/**
 * Refresh admin session timestamp
 */
export const refreshAdminSession = async () => {
  try {
    const { isValid } = await validateAdminSession();
    if (isValid) {
      await AsyncStorage.setItem(
        ADMIN_SESSION_KEYS.SESSION_TIMESTAMP,
        new Date().toISOString()
      );
      console.log("✓ Admin session refreshed");
      return true;
    }
    return false;
  } catch (error) {
    console.error("Error refreshing admin session:", error);
    return false;
  }
};

export default {
  createAdminSession,
  validateAdminSession,
  clearAdminSession,
  isAdminSession,
  getAdminSessionInfo,
  refreshAdminSession,
};
