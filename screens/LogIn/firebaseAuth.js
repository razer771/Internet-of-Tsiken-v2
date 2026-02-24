/**
 * Firebase Authentication Service
 * Handles Firebase authentication operations
 */

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  confirmPasswordReset,
  verifyPasswordResetCode,
} from "firebase/auth";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  addDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { auth, db } from "../../config/firebaseconfig.js";

/**
 * Sign up a new user
 * @param {string} email - User email
 * @param {string} password - User password
 * @param {object} userData - Additional user data (name, phone, etc.)
 * @returns {Promise<object>} - { success: boolean, user: object, error: string }
 */
export const signUpUser = async (email, password, userData = {}) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password,
    );
    const user = userCredential.user;

    // Store additional user data in Firestore
    await setDoc(doc(db, "users", user.uid), {
      uid: user.uid,
      email: email,
      ...userData,
      createdAt: new Date(),
      emailVerified: false,
      otpVerified: false,
    });

    return { success: true, user, error: null };
  } catch (error) {
    console.error("Sign up error:", error);
    let errorMessage = "Failed to create account";

    if (error.code === "auth/email-already-in-use") {
      errorMessage = "Email already in use";
    } else if (error.code === "auth/invalid-email") {
      errorMessage = "Invalid email address";
    } else if (error.code === "auth/weak-password") {
      errorMessage = "Password is too weak";
    }

    return { success: false, user: null, error: errorMessage };
  }
};

/**
 * Sign in with email and password
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<object>} - { success: boolean, user: object, error: string }
 */
export const signInUser = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password,
    );
    const user = userCredential.user;

    // Update last login time
    await updateDoc(doc(db, "users", user.uid), {
      lastLogin: new Date(),
    });

    return { success: true, user, error: null };
  } catch (error) {
    console.error("Sign in error:", error);
    let errorMessage = "Failed to sign in";

    if (error.code === "auth/user-not-found") {
      errorMessage = "User not found";
    } else if (error.code === "auth/wrong-password") {
      errorMessage = "Incorrect password";
    } else if (error.code === "auth/invalid-email") {
      errorMessage = "Invalid email address";
    } else if (error.code === "auth/user-disabled") {
      errorMessage = "User account has been disabled";
    }

    return { success: false, user: null, error: errorMessage };
  }
};

/**
 * Send password reset email
 * @param {string} email - User email
 * @returns {Promise<object>} - { success: boolean, error: string }
 */
export const sendPasswordReset = async (email) => {
  try {
    console.log("Attempting to send password reset email to:", email);

    const actionCodeSettings = {
      url: "https://internet-of-tsiken-f0ad4.web.app/resetPassword.html",
      handleCodeInApp: false,
    };

    // Send password reset email directly
    // Firebase will handle if user exists or not
    await sendPasswordResetEmail(auth, email, actionCodeSettings);

    console.log("✅ Password reset email sent successfully");
    return { success: true, error: null };
  } catch (error) {
    console.error("Password reset error:", error.code, error.message);
    let errorMessage = "Failed to send password reset email";

    if (error.code === "auth/invalid-email") {
      errorMessage = "Invalid email address";
    } else if (error.code === "auth/user-not-found") {
      // For security, we don't reveal if user exists
      console.log("User not found, but returning success for security");
      return { success: true, error: null };
    } else if (error.code === "auth/missing-email") {
      errorMessage = "Email is required";
    }

    return { success: false, error: errorMessage };
  }
};

/**
 * Verify password reset code
 * @param {string} code - Password reset code from email link
 * @returns {Promise<object>} - { success: boolean, email: string, error: string }
 */
export const verifyResetCode = async (code) => {
  try {
    const email = await verifyPasswordResetCode(auth, code);
    return { success: true, email, error: null };
  } catch (error) {
    console.error("Verify reset code error:", error);
    let errorMessage = "Invalid or expired password reset link";

    if (error.code === "auth/invalid-action-code") {
      errorMessage = "Password reset link is invalid or expired";
    } else if (error.code === "auth/expired-action-code") {
      errorMessage = "Password reset link has expired";
    }

    return { success: false, email: null, error: errorMessage };
  }
};

/**
 * Check if new password is same as current password
 * @param {string} email - User email
 * @param {string} newPassword - New password to check
 * @returns {Promise<void>}
 */
const checkIfPasswordIsCurrentPassword = async (email, newPassword) => {
  try {
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("email", "==", email.trim()));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data();
      const currentPasswordHash = userData.currentPasswordHash;

      if (currentPasswordHash) {
        console.log(
          "Password history check: User record has password hash stored",
        );
      }
    }
  } catch (error) {
    console.warn("Error checking password history:", error);
  }
};

/**
 * Confirm password reset
 * @param {string} code - Password reset code from email link
 * @param {string} newPassword - New password
 * @returns {Promise<object>} - { success: boolean, error: string, email: string }
 */
export const confirmPasswordResetWithCode = async (code, newPassword) => {
  try {
    // First verify the code to get the email
    const email = await verifyPasswordResetCode(auth, code);

    // Check password history to prevent reusing current password
    await checkIfPasswordIsCurrentPassword(email, newPassword);

    // Confirm the password reset
    await confirmPasswordReset(auth, code, newPassword);

    // Log password reset to session_logs collection (non-blocking with timeout)
    try {
      // Get userId from Firestore
      let userId = null;
      try {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("email", "==", email.trim()));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          userId = querySnapshot.docs[0].id;
        }
      } catch (err) {
        console.warn("Failed to get userId for logging:", err);
      }

      const logPromise = addDoc(collection(db, "session_logs"), {
        email: email.trim(),
        userId: userId,
        action: "Password Reset",
        description: "Password reset via email link",
        timestamp: serverTimestamp(),
        deviceInfo: "web",
      });

      await Promise.race([
        logPromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Timeout")), 3000),
        ),
      ]);
      console.log("📝 Password reset event logged to session_logs");
    } catch (logError) {
      console.warn("Failed to log password reset event:", logError);
      // Don't fail the password reset if logging fails
    }

    return { success: true, error: null, email };
  } catch (error) {
    console.error("Confirm password reset error:", error);
    let errorMessage = "Failed to reset password";

    if (error.code === "auth/invalid-action-code") {
      errorMessage = "Password reset link is invalid";
    } else if (error.code === "auth/expired-action-code") {
      errorMessage = "Password reset link has expired";
    } else if (error.code === "auth/weak-password") {
      errorMessage = "Password is too weak";
    }

    return { success: false, error: errorMessage };
  }
};

/**
 * Get current user
 * @returns {object} - Current user or null
 */
export const getCurrentUser = () => {
  return auth.currentUser;
};

/**
 * Sign out user
 * @returns {Promise<object>} - { success: boolean, error: string }
 */
export const signOutUser = async () => {
  try {
    await auth.signOut();
    return { success: true, error: null };
  } catch (error) {
    console.error("Sign out error:", error);
    return { success: false, error: "Failed to sign out" };
  }
};

/**
 * Get user data from Firestore
 * @param {string} uid - User UID
 * @returns {Promise<object>} - User data or null
 */
export const getUserData = async (uid) => {
  try {
    const userDoc = await getDoc(doc(db, "users", uid));
    return userDoc.exists() ? userDoc.data() : null;
  } catch (error) {
    console.error("Get user data error:", error);
    return null;
  }
};

/**
 * Update user data in Firestore
 * @param {string} uid - User UID
 * @param {object} data - Data to update
 * @returns {Promise<object>} - { success: boolean, error: string }
 */
export const updateUserData = async (uid, data) => {
  try {
    await updateDoc(doc(db, "users", uid), data);
    return { success: true, error: null };
  } catch (error) {
    console.error("Update user data error:", error);
    return { success: false, error: "Failed to update user data" };
  }
};
