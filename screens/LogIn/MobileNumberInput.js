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
  ScrollView,
  Pressable,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { useNavigation } from "@react-navigation/native";
import { auth, db } from "../../config/firebaseconfig.js";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import {
  checkLoginLockout,
  incrementLoginAttempts,
  resetLoginAttempts,
  formatLockoutTime,
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

export default function MobileNumberInput() {
  const [mobileNumber, setMobileNumber] = useState("");
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
  }, []);

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

  const validateMobileNumber = () => {
    setErrors({});
    const newErrors = {};

    if (!mobileNumber || mobileNumber.trim() === "") {
      newErrors.mobile = "Mobile number is required";
    } else if (mobileNumber.length !== 10) {
      newErrors.mobile = "Please enter your 10-digit mobile number";
    } else if (!/^[9]\d{9}$/.test(mobileNumber)) {
      newErrors.mobile = "Mobile number must start with 9 and be 10 digits";
    }

    console.log("Mobile validation errors:", newErrors);
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleVerifyMobile = async () => {
    console.log("=== MOBILE VERIFICATION STARTED ===");
    console.log("Mobile Number:", mobileNumber);

    if (!validateMobileNumber()) {
      console.log("Mobile validation failed, stopping verification");
      return;
    }

    console.log("Mobile validation passed!");

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
          `Too many failed attempts. Please try again in ${formatLockoutTime(
            lockoutStatus.remainingTime
          )}.`
        );
        return;
      }
    } catch (lockoutError) {
      console.log("Lockout check error (continuing anyway):", lockoutError);
    }

    console.log("Starting mobile number verification...");
    setLoading(true);

    try {
      const user = auth.currentUser;
      if (!user) {
        showAlert(
          "error",
          "Error",
          "User not authenticated. Please login again."
        );
        setTimeout(() => {
          navigation.navigate("LogIn");
        }, 2000);
        return;
      }

      console.log("Checking user's mobile number in Firestore...");
      const userRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        console.log("❌ User document does not exist in Firestore");
        showAlert(
          "error",
          "Error",
          "User data not found. Please contact support."
        );
        setLoading(false);
        return;
      }

      const userData = userDoc.data();
      const storedMobile = userData.mobile;
      const enteredMobile = `+63${mobileNumber}`;

      console.log("Stored mobile:", storedMobile);
      console.log("Entered mobile:", enteredMobile);

      if (!storedMobile) {
        showAlert(
          "info",
          "Mobile Number Not Set",
          "No mobile number found for your account. Please contact the owner to add your mobile number."
        );
        setLoading(false);
        return;
      }

      if (storedMobile !== enteredMobile) {
        console.log("❌ Mobile number mismatch");
        const attempts = await incrementLoginAttempts();
        const remainingAttempts = 5 - attempts;

        if (remainingAttempts <= 0) {
          setDeviceLocked(true);
          setLockoutTime(60000); // 1 minute lockout for development
          showAlert(
            "error",
            "Account Locked",
            "Too many failed mobile verification attempts. Your account is locked temporarily."
          );
        } else {
          showAlert(
            "error",
            "Mobile Number Mismatch",
            `The mobile number you have entered does not match your account.`
          );
        }
        setErrors({ mobile: "Mobile number does not match your account" });
        setLoading(false);
        return;
      }

      console.log("✅ Mobile number verified, proceeding to OTP");

      // Reset login attempts on successful mobile verification
      await resetLoginAttempts();

      // Update user document with verification timestamp
      await updateDoc(userRef, {
        lastMobileVerified: new Date(),
        mobileVerificationAttempts: 0,
      });

      setLoading(false);

      // Navigate to OTP screen with mobile number
      navigation.navigate("OTPVerification", {
        mobileNumber: enteredMobile,
        userId: user.uid,
      });
    } catch (error) {
      console.error("Mobile verification error:", error);
      setLoading(false);
      showAlert(
        "error",
        "Error",
        "Failed to verify mobile number. Please try again."
      );
    }
  };

  const handleBack = () => {
    navigation.goBack();
  };

  if (deviceLocked) {
    return (
      <View style={styles.lockedContainer}>
        <View style={styles.lockedCard}>
          <Ionicons name="lock-closed" size={48} color="#c41e3a" />
          <Text style={styles.lockedTitle}>Account Locked</Text>
          <Text style={styles.lockedSubtitle}>
            Too many failed verification attempts
          </Text>
          <Text style={styles.lockedTime}>
            {lockoutTime ? formatLockoutTime(lockoutTime) : "00:00"}
          </Text>
          <Text style={styles.lockedMessage}>
            Please try again later or contact support.
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
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.card}>
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <Ionicons name="arrow-back" size={20} color="#3b4cca" />
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>

            <Image source={Logo} style={styles.logo} />

            <Text style={styles.title}>VERIFY MOBILE NUMBER</Text>
            <Text style={styles.subtitle}></Text>

            {errors.mobile && (
              <View style={styles.errorAlert}>
                <Text style={styles.errorAlertText}>{errors.mobile}</Text>
              </View>
            )}

            {/* Mobile Number Input */}
            <Text style={styles.label}>Mobile Number</Text>
            <View style={styles.phoneContainer}>
              <Text style={styles.countryCode}>+63</Text>
              <TextInput
                style={styles.phoneInput}
                placeholder="Enter mobile number"
                value={mobileNumber}
                onChangeText={setMobileNumber}
                editable={!loading}
                keyboardType="phone-pad"
                maxLength={10}
                autoCapitalize="none"
              />
            </View>

            <Text style={styles.helpText}>
              Enter the 10-digit mobile number associated with your account to
              proceed with verification.
            </Text>

            {/* Verify Button */}
            <Pressable
              style={({ pressed }) => [
                styles.verifyBtn,
                loading && styles.buttonDisabled,
                pressed && { opacity: 0.8 },
              ]}
              onPress={handleVerifyMobile}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.verifyText}>Send OTP</Text>
              )}
            </Pressable>

            <View style={styles.infoContainer}>
              <Ionicons
                name="information-circle-outline"
                size={16}
                color="#666"
              />
              <Text style={styles.infoText}>
                We need to verify your mobile number matches the one registered
                with your account for security purposes.
              </Text>
            </View>
          </View>
        </ScrollView>
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
    textAlign: "center",
  },
  label: {
    alignSelf: "flex-start",
    color: "#333",
    fontWeight: "500",
    marginTop: 8,
    marginBottom: 4,
  },
  phoneContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    width: "100%",
    height: 45,
    marginBottom: 8,
  },
  countryCode: {
    paddingHorizontal: 12,
    fontSize: 16,
    color: "#333",
    backgroundColor: "#f8f8f8",
    borderTopLeftRadius: 6,
    borderBottomLeftRadius: 6,
    height: "100%",
    textAlignVertical: "center",
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 10,
    fontSize: 16,
  },
  helpText: {
    fontSize: 12,
    color: "#666",
    marginBottom: 20,
    textAlign: "center",
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
  verifyBtn: {
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
  verifyText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  infoContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 15,
    padding: 10,
    backgroundColor: "#f8f9fa",
    borderRadius: 6,
  },
  infoText: {
    color: "#666",
    fontSize: 12,
    marginLeft: 8,
    flex: 1,
    lineHeight: 16,
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
