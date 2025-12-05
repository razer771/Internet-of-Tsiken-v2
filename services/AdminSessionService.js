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
 * @param {string} userId - User ID
 * @param {string} email - Admin email address
 * @param {string} role - Admin role (optional)
 */
export const createAdminSession = async (userId, email, role = "admin") => {
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
      return { isValid: false, email: null, role: null };
    }

    const [isAdmin, adminEmail, timestamp, role] = await Promise.all([
      AsyncStorage.getItem(ADMIN_SESSION_KEYS.IS_ADMIN),
      AsyncStorage.getItem(ADMIN_SESSION_KEYS.ADMIN_EMAIL),
      AsyncStorage.getItem(ADMIN_SESSION_KEYS.SESSION_TIMESTAMP),
      AsyncStorage.getItem(ADMIN_SESSION_KEYS.ADMIN_ROLE),
    ]);

    // Check if this is an admin session (no admin data means regular user)
    if (isAdmin !== "true" || !adminEmail || !timestamp) {
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
 * Get current admin session info without validation
 * @returns {Object} { isAdmin: boolean, email: string | null, role: string | null }
 */
export const getAdminSessionInfo = async () => {
  try {
    const [isAdmin, email, role] = await Promise.all([
      AsyncStorage.getItem(ADMIN_SESSION_KEYS.IS_ADMIN),
      AsyncStorage.getItem(ADMIN_SESSION_KEYS.ADMIN_EMAIL),
      AsyncStorage.getItem(ADMIN_SESSION_KEYS.ADMIN_ROLE),
    ]);

    return {
      isAdmin: isAdmin === "true",
      email: email || null,
      role: role || null,
    };
  } catch (error) {
    console.error("Error getting admin session info:", error);
    return {
      isAdmin: false,
      email: null,
      role: null,
    };
  }
};

/**
 * Check if current session is admin without full validation
 * Useful for quick checks without triggering session expiry
 * @returns {boolean}
 */
export const isAdminSession = async () => {
  try {
    const isAdmin = await AsyncStorage.getItem(ADMIN_SESSION_KEYS.IS_ADMIN);
    return isAdmin === "true";
  } catch (error) {
    console.error("Error checking admin session:", error);
    return false;
  }
};

/**
 * Refresh admin session timestamp
 * Call this periodically to keep session alive
 */
export const refreshAdminSession = async () => {
  try {
    const isAdmin = await AsyncStorage.getItem(ADMIN_SESSION_KEYS.IS_ADMIN);
    if (isAdmin === "true") {
      await AsyncStorage.setItem(
        ADMIN_SESSION_KEYS.SESSION_TIMESTAMP,
        new Date().toISOString()
      );
      return true;
    }
    return false;
  } catch (error) {
    console.error("Error refreshing admin session:", error);
    return false;
  }
};
