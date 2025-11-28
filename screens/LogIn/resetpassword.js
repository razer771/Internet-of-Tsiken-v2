import React, { useState } from "react";
import { useNavigation } from "@react-navigation/native";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { Ionicons } from "@expo/vector-icons";
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
      password
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
      password
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
    const trimmed = (email || "").trim();
    console.log("Attempting to send password reset email to:", trimmed);

    // 1) Check if email exists in Firestore users collection
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("email", "==", trimmed));
    const snap = await getDocs(q);
    const exists = !snap.empty;

    if (!exists) {
      return {
        success: false,
        error: "This email is not registered. Please check and try again.",
      };
    }

    // 2) Send the password reset email only if user exists in DB
    await sendPasswordResetEmail(auth, trimmed);
    console.log("✅ Password reset email sent successfully");
    return { success: true, error: null };
  } catch (error) {
    console.error("Password reset error:", error.code, error.message);
    let errorMessage = "Failed to send password reset email";

    if (error.code === "auth/invalid-email") {
      errorMessage = "Invalid email address";
    } else if (error.code === "auth/missing-email") {
      errorMessage = "Email is required";
    } else if (error.code === "auth/user-not-found") {
      // Do not send reset links to emails not stored in DB
      errorMessage =
        "This email is not registered. Please check and try again.";
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
 * Confirm password reset
 * @param {string} code - Password reset code from email link
 * @param {string} newPassword - New password
 * @returns {Promise<object>} - { success: boolean, error: string }
 */
export const confirmPasswordResetWithCode = async (code, newPassword) => {
  try {
    await confirmPasswordReset(auth, code, newPassword);
    return { success: true, error: null };
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

// ---- Screen Component (default export) ----
export default function ResetPassword() {
  const navigation = useNavigation();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleResetRequest = async () => {
    setError("");

    if (!email || email.trim() === "") {
      setError("Email is required");
      return;
    }

    if (!email.includes("@")) {
      setError("Please enter a valid email");
      return;
    }

    setLoading(true);

    try {
      const result = await sendPasswordReset(email);

      if (result.success) {
        setSubmitted(true);
        Alert.alert(
          "Email Sent",
          "Check your email for password reset instructions. Don't forget to check your spam/junk folder!",
          [{ text: "OK" }]
        );
      } else {
        setError(result.error || "Failed to send reset email");
      }
    } catch (err) {
      console.error("Password reset error:", err);
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAwareScrollView
          style={styles.container}
          contentContainerStyle={styles.scrollContent}
          enableOnAndroid={true}
          extraScrollHeight={20}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <TouchableOpacity
              onPress={() => {
                setEmail("");
                setError("");
                navigation.goBack();
              }}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={24} color="#3b4cca" />
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>

            {!submitted ? (
              <>
                <Text style={styles.title}>Reset Password</Text>
                <Text style={styles.subtitle}>
                  Enter your email address and we'll send you a link to reset
                  your password.
                </Text>

                <Text style={styles.label}>Email Address</Text>
                <TextInput
                  style={[styles.input, error && styles.inputError]}
                  placeholder="Enter email"
                  value={email}
                  onChangeText={setEmail}
                  editable={!loading}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                {error && <Text style={styles.errorText}>{error}</Text>}

                <TouchableOpacity
                  style={[styles.loginBtn, loading && styles.buttonDisabled]}
                  onPress={handleResetRequest}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.loginText}>Send Reset Email</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    setEmail("");
                    setError("");
                    navigation.goBack();
                  }}
                ></TouchableOpacity>
              </>
            ) : (
              <View style={styles.successContainer}>
                <View style={styles.successIcon}>
                  <Ionicons name="checkmark-circle" size={64} color="#2e7d32" />
                </View>
                <Text style={styles.successTitle}>Check Your Email</Text>
                <Text style={styles.successSubtitle}>
                  We've sent password reset instructions to:
                </Text>
                <Text style={styles.emailDisplay}>{email}</Text>

                <TouchableOpacity
                  style={styles.loginBtn}
                  onPress={() => {
                    setEmail("");
                    setSubmitted(false);
                    navigation.goBack();
                  }}
                >
                  <Text style={styles.loginText}>Back to Login</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </KeyboardAwareScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scrollContent: {
    alignItems: "center",
    justifyContent: "center",
    flexGrow: 1,
  },
  card: {
    width: "85%",
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 25,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,
    elevation: 4,
    marginVertical: 20,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    alignSelf: "flex-start",
  },
  backText: {
    color: "#3b4cca",
    marginLeft: 8,
    fontSize: 14,
    fontWeight: "500",
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#000",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 24,
    lineHeight: 20,
  },
  label: {
    alignSelf: "flex-start",
    color: "#333",
    fontWeight: "500",
    marginTop: 8,
    marginBottom: 4,
  },
  input: {
    width: "100%",
    height: 45,
    borderColor: "#ccc",
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  inputError: {
    borderColor: "#c41e3a",
    backgroundColor: "#ffebee",
  },
  errorText: {
    color: "#c41e3a",
    fontSize: 12,
    marginBottom: 12,
    alignSelf: "flex-start",
  },
  loginBtn: {
    backgroundColor: "#3b4cca",
    width: "100%",
    height: 45,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  loginText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  signupLink: {
    color: "#3b4cca",
    fontSize: 13,
    textAlign: "center",
    fontWeight: "bold",
    textDecorationLine: "underline",
    marginTop: 10,
  },
  successContainer: {
    alignItems: "center",
    paddingVertical: 20,
  },
  successIcon: {
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#2e7d32",
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
    textAlign: "center",
  },
  emailDisplay: {
    fontSize: 13,
    fontWeight: "500",
    color: "#000",
    marginBottom: 16,
    backgroundColor: "#f5f5f5",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
});
