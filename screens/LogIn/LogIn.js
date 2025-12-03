import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Platform,
  ActivityIndicator,
  Pressable,
  Modal,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { Ionicons } from "@expo/vector-icons";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import Checkbox from "expo-checkbox";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { signInWithEmailAndPassword } from "firebase/auth";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "../../config/firebaseconfig.js";
import {
  checkLoginLockout,
  incrementLoginAttempts,
  resetLoginAttempts,
  formatLockoutTime,
  LOCKOUT_DURATION,
} from "./deviceLockout";

const Logo = require("../../assets/logo.png");

// Reusable Branded Alert Modal Component
const BrandedAlertModal = ({ visible, type, title, message, onClose }) => {
  const getIconConfig = () => {
    switch (type) {
      case "success":
        return { name: "check-circle", color: "#4CAF50" };
      case "error":
        return { name: "alert-circle", color: "#c41e3a" };
      case "info":
        return { name: "information", color: "#2196F3" };
      default:
        return { name: "information", color: "#2196F3" };
    }
  };

  const iconConfig = getIconConfig();

  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.alertOverlay}>
        <View style={styles.alertModal}>
          <View
            style={[
              styles.alertIconContainer,
              { backgroundColor: `${iconConfig.color}20` },
            ]}
          >
            <MaterialCommunityIcons
              name={iconConfig.name}
              size={48}
              color={iconConfig.color}
            />
          </View>
          <Text style={styles.alertTitle}>{title}</Text>
          <Text style={styles.alertMessage}>{message}</Text>
          <TouchableOpacity style={styles.alertButton} onPress={onClose}>
            <Text style={styles.alertButtonText}>OK</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [deviceLocked, setDeviceLocked] = useState(false);
  const [lockoutTime, setLockoutTime] = useState(null);

  // Alert Modal State
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertType, setAlertType] = useState("info");
  const [alertTitle, setAlertTitle] = useState("");
  const [alertMessage, setAlertMessage] = useState("");

  const navigation = useNavigation();

  const showAlert = (type, title, message) => {
    setAlertType(type);
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertVisible(true);
  };

  const closeAlert = () => {
    setAlertVisible(false);
  };

  useEffect(() => {
    checkDeviceLockoutStatus();
    // Temporary: Clear old lockout data for testing
    clearOldLockoutData();
  }, []);

  const clearOldLockoutData = async () => {
    try {
      await AsyncStorage.removeItem("device_login_lockout");
      await AsyncStorage.removeItem("device_login_attempts");
      console.log("Cleared old lockout data");
    } catch (error) {
      console.error("Error clearing lockout data:", error);
    }
  };

  // Always clear email, password, and errors whenever Login regains focus
  useFocusEffect(
    React.useCallback(() => {
      setEmail("");
      setPassword("");
      setErrors({});
    }, [])
  );

  useEffect(() => {
    let interval;
    if (deviceLocked && lockoutTime > 0) {
      interval = setInterval(() => {
        setLockoutTime((prev) => {
          const newTime = prev - 1000;
          if (newTime <= 0) {
            setDeviceLocked(false);
            return null;
          }
          return newTime;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [deviceLocked, lockoutTime]);

  const checkDeviceLockoutStatus = async () => {
    const lockoutStatus = await checkLoginLockout();
    if (lockoutStatus.isLockedOut) {
      setDeviceLocked(true);
      setLockoutTime(lockoutStatus.remainingTime);
    }
  };

  const validateLoginForm = () => {
    setErrors({});
    const newErrors = {};

    // Basic email validation - just check if it's not empty and has @
    if (!email || email.trim() === "") {
      newErrors.email = "Email is required";
    } else if (!email.includes("@")) {
      newErrors.email = "Please enter a valid email";
    }

    // Just check if password is provided
    if (!password || password.trim() === "") {
      newErrors.password = "Password is required";
    }

    console.log("Validation errors:", newErrors);
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    console.log("Login button clicked");

    if (!validateLoginForm()) {
      console.log("Validation failed, stopping login");
      return;
    }

    // Admin bypass login
    if (email === "admin@example.com" && password === "admin1234") {
      console.log("✅ Admin bypass login successful! (admin@example.com)");
      console.log("🔀 Navigating to AdminDashboard (bypass route)");

      // Log admin bypass login event to session_logs collection (non-blocking)
      try {
        await addDoc(collection(db, "session_logs"), {
          userId: "admin_bypass",
          action: "login",
          description: "Logged in",
          timestamp: serverTimestamp(),
          deviceInfo: Platform.OS,
          email: "admin@example.com",
          loginType: "admin_bypass",
        });
        console.log("📝 Admin bypass login event logged to session_logs");
      } catch (logError) {
        console.log(
          "⚠️ Failed to log admin bypass login (non-critical):",
          logError.message
        );
      }

      // Save admin bypass flag
      await AsyncStorage.setItem("isAdminBypass", "true");
      await AsyncStorage.setItem("adminEmail", "admin@example.com");
      navigation.reset({
        index: 0,
        routes: [{ name: "AdminDashboard" }],
      });
      return;
    }

    // Clear admin bypass flag for regular users
    await AsyncStorage.removeItem("isAdminBypass");
    await AsyncStorage.removeItem("adminEmail");

    console.log("Validation passed!");

    try {
      console.log("Checking lockout status...");
      const lockoutStatus = await checkLoginLockout();
      console.log("Lockout status:", lockoutStatus);

      if (lockoutStatus && lockoutStatus.isLockedOut) {
        console.log("Account is locked");
        setDeviceLocked(true);
        setLockoutTime(lockoutStatus.remainingTime);
        showAlert(
          "error",
          "Account Locked",
          `Too many failed login attempts. Please try again in ${formatLockoutTime(
            lockoutStatus.remainingTime
          )}.`
        );
        return;
      }
    } catch (lockoutError) {
      console.log("Lockout check error (continuing anyway):", lockoutError);
    }

    console.log("Starting Firebase authentication...");
    setLoading(true);

    try {
      console.log("Calling signInWithEmailAndPassword...");
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );
      const user = userCredential.user;
      console.log("✅ Login successful! User ID:", user.uid);

      // Log login event to session_logs collection (non-blocking)
      try {
        await addDoc(collection(db, "session_logs"), {
          userId: user.uid,
          action: "login",
          description: "Logged in",
          timestamp: serverTimestamp(),
          deviceInfo: Platform.OS,
          email: email.trim(),
        });
        console.log("📝 Login event logged to session_logs");
      } catch (logError) {
        console.log(
          "⚠️ Failed to log login event (non-critical):",
          logError.message
        );
      }

      try {
        const userRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userRef);

        if (userDoc.exists()) {
          console.log("✅ User data loaded:", userDoc.data());
          const userData = userDoc.data();

          // Check if account is inactive
          if (
            userData.accountStatus === "inactive" ||
            userData.accountStatus === "Inactive"
          ) {
            console.log("❌ Account is inactive, blocking login");
            setLoading(false);
            showAlert(
              "error",
              "Account Inactive",
              "Your account has been deactivated. Please contact the administrator for assistance."
            );
            // Sign out the user
            await auth.signOut();
            return;
          }

          // Check if password change is required
          if (userData.requirePasswordChange === true) {
            console.log(
              "⚠️ Password change required, redirecting to Create New Password screen"
            );
            setLoading(false);
            // Navigate to Create New Password screen
            navigation.navigate("CreateNewPassword", { userId: user.uid });
            return;
          }

          // Check if user is already verified in Firestore
          if (userData.verified === true || userData.isVerified === true) {
            console.log("✅ User is verified, skipping OTP");

            try {
              await resetLoginAttempts();
            } catch (resetError) {
              console.log(
                "Error resetting login attempts (non-critical):",
                resetError
              );
            }

            // Check user role and navigate accordingly
            if (userData.role === "Admin") {
              console.log("👤 User role: Admin");
              console.log(
                "🔀 Navigating to AdminDashboard (verified admin user)"
              );
              navigation.reset({
                index: 0,
                routes: [{ name: "AdminDashboard" }],
              });
            } else {
              console.log("👤 User role:", userData.role || "Regular user");
              console.log("🔀 Navigating to Home (verified regular user)");
              navigation.reset({
                index: 0,
                routes: [{ name: "Home" }],
              });
            }
            return;
          }

          console.log("✅ User data loaded:", userData);
          // You can store userData in global state (Context/Redux) if needed
        } else {
          console.log("❌ User document does not exist in Firestore");
          setLoading(false);
          setErrors({ auth: "User data not found." });
          return;
        }

        // Navigate to VerifyIdentity for OTP verification (only if not verified)
        console.log("⏳ User not verified, redirecting to OTP");
        navigation.navigate("VerifyIdentity");
      } catch (firestoreError) {
        console.error("Firestore Error:", firestoreError);
        setErrors({ auth: "Error loading user data. Please try again." });
      }
    } catch (error) {
      console.error("Firebase Login Error:", error.code, error.message);

      try {
        const attempts = await incrementLoginAttempts();
        const remainingAttempts = 5 - attempts;

        let errorMessage = "Invalid email or password.";
        if (error.code === "auth/invalid-credential") {
          errorMessage = "Invalid email or password.";
        } else if (error.code === "auth/invalid-email") {
          errorMessage = "Invalid email address format.";
        } else if (error.code === "auth/too-many-requests") {
          errorMessage = "Too many login attempts. Please try again later.";
        } else if (error.code === "auth/user-not-found") {
          errorMessage = "No account found with this email.";
        } else if (error.code === "auth/wrong-password") {
          errorMessage = "Incorrect password.";
        } else if (error.code === "auth/network-request-failed") {
          errorMessage = "Network error. Please check your connection.";
        } else {
          errorMessage = "Login failed. Please try again.";
        }

        if (remainingAttempts <= 0) {
          setDeviceLocked(true);
          setLockoutTime(LOCKOUT_DURATION);
        } else {
          setErrors({ auth: errorMessage });
        }
      } catch (lockoutError) {
        console.error("Lockout handling error:", lockoutError);
        setErrors({ auth: "Login failed. Please try again." });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    navigation.navigate("ResetPassword");
  };

  if (deviceLocked) {
    return (
      <View style={styles.lockedContainer}>
        <View style={styles.lockedCard}>
          <Ionicons name="lock-closed" size={48} color="#c41e3a" />
          <Text style={styles.lockedTitle}>Account Locked</Text>
          <Text style={styles.lockedSubtitle}>
            Too many failed login attempts
          </Text>
          <Text style={styles.lockedTime}>
            {lockoutTime ? formatLockoutTime(lockoutTime) : "00:00"}
          </Text>
          <Text style={styles.lockedMessage}>Please try again later.</Text>
        </View>
      </View>
    );
  }

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
            <Image source={Logo} style={styles.logo} />

            <Text style={styles.title}>WELCOME</Text>
            <Text style={styles.subtitle}>Login to your Account</Text>

            {errors.auth && (
              <View style={styles.errorAlert}>
                <Text style={styles.errorAlertText}>{errors.auth}</Text>
              </View>
            )}

            {/* Email Input */}
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter email"
              value={email}
              onChangeText={setEmail}
              editable={!loading}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            {errors.email && (
              <Text style={styles.errorText}>{errors.email}</Text>
            )}

            {/* Password Input */}
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Enter password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                editable={!loading}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color="#555"
                />
              </TouchableOpacity>
            </View>
            {errors.password && (
              <View style={{ alignItems: "flex-start", width: "100%" }}>
                {Array.isArray(errors.password) ? (
                  errors.password.map((err, idx) => (
                    <Text key={idx} style={styles.errorText}>
                      • {err}
                    </Text>
                  ))
                ) : (
                  <Text style={styles.errorText}>{errors.password}</Text>
                )}
              </View>
            )}

            {/* Options Row */}
            <View style={styles.optionsRow}>
              <View style={styles.checkboxContainer}>
                <Checkbox
                  value={remember}
                  onValueChange={setRemember}
                  color={remember ? "#3b4cca" : undefined}
                  style={styles.checkbox}
                />
                <Text style={styles.rememberText}>Remember password</Text>
              </View>

              <View style={styles.forgotWrapper}>
                <TouchableOpacity onPress={handleForgotPassword}>
                  <Text style={styles.forgotText}>Forgot password?</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Login Button */}
            <Pressable
              style={({ pressed }) => [
                styles.loginBtn,
                loading && styles.buttonDisabled,
                pressed && { opacity: 0.8 },
              ]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.loginText}>Login</Text>
              )}
            </Pressable>
          </View>
        </KeyboardAwareScrollView>
      </TouchableWithoutFeedback>

      {/* Branded Alert Modal */}
      <BrandedAlertModal
        visible={alertVisible}
        type={alertType}
        title={alertTitle}
        message={alertMessage}
        onClose={closeAlert}
      />
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
    alignItems: "center",
    marginVertical: 20,
  },
  logo: {
    width: 120,
    height: 120,
    resizeMode: "contain",
    marginBottom: 10,
    borderRadius: 60,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#000",
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 20,
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
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    width: "100%",
    height: 45,
    paddingHorizontal: 10,
    justifyContent: "space-between",
    marginBottom: 8,
  },
  passwordInput: {
    flex: 1,
  },
  errorAlert: {
    width: "100%",
    backgroundColor: "#ffebee",
    borderLeftColor: "#c41e3a",
    borderLeftWidth: 4,
    borderRadius: 6,
    padding: 10,
    marginBottom: 16,
  },
  errorAlertText: {
    color: "#c41e3a",
    fontSize: 12,
  },
  errorText: {
    color: "#c41e3a",
    fontSize: 11,
    marginBottom: 8,
    alignSelf: "flex-start",
  },
  optionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    marginVertical: 14,
    gap: 12,
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkbox: {
    marginRight: 2,
  },
  rememberText: {
    color: "#333",
  },
  forgotText: {
    color: "#3b4cca",
    fontWeight: "500",
    textDecorationLine: "underline",
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
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    alignSelf: "flex-start",
  },
  backText: {
    color: "#3b4cca",
    marginLeft: 8,
    fontSize: 14,
    fontWeight: "500",
  },
  otpInput: {
    width: "100%",
    borderColor: "#ccc",
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 14,
    paddingHorizontal: 12,
    fontSize: 24,
    textAlign: "center",
    marginBottom: 12,
    letterSpacing: 8,
    fontWeight: "600",
  },
  resendButton: {
    paddingVertical: 12,
  },
  resendText: {
    color: "#3b4cca",
    textAlign: "center",
    fontSize: 13,
    fontWeight: "600",
  },
  resendTextDisabled: {
    color: "#999",
  },
  lockedContainer: {
    flex: 1,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  lockedCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 32,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,
    elevation: 4,
  },
  lockedTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#c41e3a",
    marginTop: 16,
    marginBottom: 8,
  },
  lockedSubtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 16,
    textAlign: "center",
  },
  lockedTime: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#c41e3a",
    marginBottom: 16,
  },
  lockedMessage: {
    fontSize: 13,
    color: "#666",
    textAlign: "center",
  },
  // Alert Modal Styles
  alertOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  alertModal: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 40,
    width: "90%",
    maxWidth: 400,
    alignItems: "center",
  },
  alertIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  alertTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#133E87",
    textAlign: "center",
    marginBottom: 8,
  },
  alertMessage: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  alertButton: {
    backgroundColor: "#133E87",
    paddingVertical: 12,
    paddingHorizontal: 48,
    borderRadius: 8,
    minWidth: 120,
  },
  alertButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
});
