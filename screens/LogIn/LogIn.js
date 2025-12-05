import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Platform,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "../../config/firebaseconfig.js";
import {
  checkLoginLockout,
  incrementLoginAttempts,
  resetLoginAttempts,
  formatLockoutTime,
  getLockoutMessage,
  getRemainingAttemptsMessage,
  LOCKOUT_DURATIONS, // ADD THIS
} from "./deviceLockout";

const Logo = require("../../assets/logo.png");

export default function Login() {
  const navigation = useNavigation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [deviceLocked, setDeviceLocked] = useState(false);
  const [lockoutTime, setLockoutTime] = useState(null);
  const [lockoutMessage, setLockoutMessage] = useState("");

  // Timer effect to countdown lockout time
  useEffect(() => {
    let timer;
    if (deviceLocked && lockoutTime > 0) {
      timer = setInterval(() => {
        setLockoutTime((prevTime) => {
          const newTime = prevTime - 1000; // Decrease by 1 second
          
          if (newTime <= 0) {
            // Lockout expired
            console.log("✅ Lockout timer expired, unlocking...");
            setDeviceLocked(false);
            setLockoutTime(null);
            setLockoutMessage("");
            
            // Clear lockout from AsyncStorage
            if (email && email.trim()) {
              resetLoginAttempts(email.trim());
            }
            
            return 0;
          }
          
          return newTime;
        });
      }, 1000); // Update every second
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [deviceLocked, lockoutTime, email]);

  // Check lockout status when email changes
  useEffect(() => {
    if (email && email.trim() !== "") {
      checkDeviceLockoutStatus();
    }
  }, [email]);

  const checkDeviceLockoutStatus = async () => {
    if (!email || email.trim() === "") return;
    
    console.log("🔍 Checking lockout status for account:", email);
    const lockoutStatus = await checkLoginLockout(email.trim());
    console.log("Lockout status:", lockoutStatus);
    
    if (lockoutStatus.isLockedOut) {
      console.log("🔒 Account was already locked");
      setDeviceLocked(true);
      setLockoutTime(lockoutStatus.remainingTime);
      setLockoutMessage(getLockoutMessage(lockoutStatus.totalAttempts));
    } else {
      console.log("✅ Account is not locked");
      setDeviceLocked(false);
      setLockoutTime(null);
      setLockoutMessage("");
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
      console.log("✅ Admin login successful!");
      setLoading(true);
      try {
        // Save admin bypass flag
        await AsyncStorage.setItem("isAdminBypass", "true");
        await AsyncStorage.setItem("adminEmail", "admin@example.com");
        
        // Reset login attempts on successful admin login
        await resetLoginAttempts();
        
        console.log("Navigating to AdminDashboard...");
        navigation.reset({
          index: 0,
          routes: [{ name: "AdminDashboard" }],
        });
      } catch (error) {
        console.error("Admin login error:", error);
        setErrors({ auth: "Failed to login as admin. Please try again." });
      } finally {
        setLoading(false);
      }
      return;
    }

    // Clear admin bypass flag for regular users
    await AsyncStorage.removeItem("isAdminBypass");
    await AsyncStorage.removeItem("adminEmail");

    console.log("Validation passed!");

    // Check if account is locked in Firestore
    try {
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("email", "==", email.trim()));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const userData = querySnapshot.docs[0].data();
        
        if (userData.accountLocked) {
          const lockedAt = new Date(userData.lockedAt);
          const lockDuration = userData.lockoutDuration || LOCKOUT_DURATIONS.FIRST;
          const unlockTime = lockedAt.getTime() + lockDuration;
          const now = Date.now();
          
          if (now < unlockTime) {
            const remainingTime = unlockTime - now;
            console.log("🔒 Account locked in Firestore - showing locked screen");
            setDeviceLocked(true);
            setLockoutTime(remainingTime);
            setLockoutMessage(getLockoutMessage(userData.totalAttempts || 5));
            return;
          } else {
            // Unlock the account
            await updateDoc(doc(db, "users", querySnapshot.docs[0].id), {
              accountLocked: false,
              lockedAt: null,
            });
            await resetLoginAttempts(email.trim());
          }
        }
      }
    } catch (checkError) {
      console.error("Error checking account lock:", checkError);
    }

    // Clear admin bypass flag for regular users
    await AsyncStorage.removeItem("isAdminBypass");
    await AsyncStorage.removeItem("adminEmail");

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

      // Reset attempts on successful login for this account
      await resetLoginAttempts(email.trim());

      try {
        const userRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userRef);

        if (userDoc.exists()) {
          console.log("✅ User data loaded:", userDoc.data());
          const userData = userDoc.data();
          // Check if user is already verified
          if (
            userData.verified === true ||
            userData.isVerified === true ||
            user.emailVerified
          ) {
            console.log("✅ User is verified, skipping OTP");
            navigation.navigate("Home");
            return;
          }

          console.log("✅ User data loaded:", userData);
        } else {
          console.log("❌ User document does not exist in Firestore");
          setLoading(false);
          setErrors({ auth: "User data not found. Please contact support." });
          return;
        }

        // Navigate to VerifyIdentity for OTP verification
        console.log("⏳ User not verified, redirecting to OTP");
        navigation.navigate("VerifyIdentity");
      } catch (firestoreError) {
        console.error("Firestore Error:", firestoreError);
        setErrors({ auth: "Error loading user data. Please try again." });
      }
    } catch (error) {
      console.error("Firebase Login Error:", error.code, error.message);
      
      const result = await incrementLoginAttempts(email.trim());
      
      console.log(`❌ Failed attempt #${result.attempts} for ${email}`);

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
      }

      if (result.shouldLock) {
        console.log(`🔒 LOCKING ACCOUNT ${email}: ${result.message}`);
        
        // Lock the account in Firestore
        try {
          const usersRef = collection(db, "users");
          const q = query(usersRef, where("email", "==", email.trim()));
          const querySnapshot = await getDocs(q);
          
          if (!querySnapshot.empty) {
            const userDoc = querySnapshot.docs[0];
            await updateDoc(doc(db, "users", userDoc.id), {
              accountLocked: true,
              lockedAt: new Date().toISOString(),
              lockoutDuration: result.duration,
              totalAttempts: result.attempts,
            });
            console.log(`✅ Account ${email} locked in Firestore: ${result.message}`);
          }
        } catch (lockError) {
          console.error("Error locking account in Firestore:", lockError);
        }

        // SHOW LOCKED SCREEN IMMEDIATELY
        setDeviceLocked(true);
        setLockoutTime(result.duration);
        setLockoutMessage(getLockoutMessage(result.attempts));
        console.log("🔒 LOCKED SCREEN SHOULD NOW BE VISIBLE");
      } else {
        const remainingMessage = getRemainingAttemptsMessage(result.attempts);
        setErrors({ 
          auth: `${errorMessage} (${remainingMessage})` 
        });
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
            {lockoutMessage}
          </Text>
          <Text style={styles.lockedTime}>
            {lockoutTime ? formatLockoutTime(lockoutTime) : "00:00"}
          </Text>
          <Text style={styles.lockedMessage}>
            Please wait for the timer to expire or contact support.
          </Text>
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
    justifyContent: "flex-start",
    alignItems: "center",
    width: "100%",
    marginVertical: 14,
  },
  forgotWrapper: {
    // Removed extra styles, inherits from parent
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
});
