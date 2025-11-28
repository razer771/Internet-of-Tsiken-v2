import React, { useState, useRef, useEffect } from "react";
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
  ScrollView,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { auth, db } from "../../config/firebaseconfig.js";
import { doc, updateDoc } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
// Removed Firebase phone-auth specific imports; using Twilio Verify exclusively
import {
  checkOTPLockout,
  incrementOTPAttempts,
  resetOTPAttempts,
  formatLockoutTime,
} from "./deviceLockout";

const Logo = require("../../assets/logo.png");

// Initialize Firebase Functions
const functions = getFunctions(undefined, "us-central1");

export default function OTPVerification() {
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [deviceLocked, setDeviceLocked] = useState(false);
  const [lockoutTime, setLockoutTime] = useState(null);
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes in seconds
  const [canResend, setCanResend] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(30); // 30 seconds cooldown between resends
  const [otpAttempts, setOtpAttempts] = useState(0);
  const [confirmationResult, setConfirmationResult] = useState(null);

  const inputs = useRef([]);
  const cooldownTimerRef = useRef(null);
  const navigation = useNavigation();
  const route = useRoute();

  const { mobileNumber, userId } = route.params;

  useEffect(() => {
    checkDeviceLockoutStatus();
    sendInitialOTP();
  }, []);

  useEffect(() => {
    // Timer for OTP expiry (5 minutes)
    let otpTimer;
    if (timeLeft > 0) {
      otpTimer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setCanResend(true);
    }
    return () => clearInterval(otpTimer);
  }, [timeLeft]);

  // Resend cooldown countdown (starts when value reset to 30)
  useEffect(() => {
    if (resendCooldown === 30 && cooldownTimerRef.current === null) {
      cooldownTimerRef.current = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(cooldownTimerRef.current);
            cooldownTimerRef.current = null;
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    if (resendCooldown === 0 && cooldownTimerRef.current) {
      clearInterval(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    }
  }, [resendCooldown]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) {
        clearInterval(cooldownTimerRef.current);
        cooldownTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    // Device lockout timer
    let lockoutTimer;
    if (deviceLocked && lockoutTime > 0) {
      lockoutTimer = setInterval(() => {
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
    return () => clearInterval(lockoutTimer);
  }, [deviceLocked, lockoutTime]);

  const checkDeviceLockoutStatus = async () => {
    const lockoutStatus = await checkOTPLockout();
    if (lockoutStatus.isLockedOut) {
      setDeviceLocked(true);
      setLockoutTime(lockoutStatus.remainingTime);
    }
  };

  const sendInitialOTP = async () => {
    try {
      await sendOTP();
    } catch (error) {
      console.error("Failed to send initial OTP:", error);
      Alert.alert("Error", "Failed to send OTP. Please try again.");
    }
  };

  // Twilio Verify only: send OTP
  const sendOTP = async () => {
    try {
      console.log("Sending OTP via Twilio Verify to:", mobileNumber);
      const sendSMSOTP = httpsCallable(functions, "sendSMSOTP");
      const response = await sendSMSOTP({
        phone: mobileNumber,
        useRealSMS: true,
      });

      if (!response.data || !response.data.success) {
        throw new Error("Failed to send Twilio Verify SMS");
      }

      // Update confirmation result with latest verification SID
      setConfirmationResult({
        phone: response.data.phone,
        method: "twilio-verify",
        verificationSid: response.data.verificationSid,
      });

      // Reset OTP expiry + cooldown
      setTimeLeft(300); // 5 minutes
      setCanResend(false);
      setResendCooldown(30); // restart cooldown

      console.log(
        "Twilio Verify SMS sent. SID:",
        response.data.verificationSid
      );
      return { success: true, verificationSid: response.data.verificationSid };
    } catch (error) {
      console.error("Twilio Verify send error:", error);
      Alert.alert(
        "Error",
        "Failed to send verification code. Please try again."
      );
      return { success: false, error: error.message };
    }
  };

  const handleResendOTP = async () => {
    if (resendCooldown > 0) {
      Alert.alert(
        "Please Wait",
        "You can resend OTP in " + resendCooldown + " seconds."
      );
      return;
    }

    setResendLoading(true);
    setErrors({});

    try {
      const result = await sendOTP();
      if (!result.success) {
        throw new Error(result.error || "Resend failed");
      }

      Alert.alert(
        "OTP Sent",
        "A new verification code was sent to your phone."
      );

      // Reset OTP input boxes
      setOtp(["", "", "", "", "", ""]);
      if (inputs.current[0]) {
        inputs.current[0].focus();
      }
    } catch (error) {
      console.error("Resend OTP error:", error);
      Alert.alert("Error", "Failed to resend OTP. Please try again.");
    } finally {
      setResendLoading(false);
    }
  };

  const handleOtpChange = (text, index) => {
    const digit = text.replace(/[^0-9]/g, "");
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    // Clear errors when user starts typing
    if (errors.otp) {
      setErrors({});
    }

    // Auto-focus next input
    if (digit && index < otp.length - 1) {
      inputs.current[index + 1].focus();
    }
  };

  const handleBackspace = (text, index) => {
    if (!text && index > 0) {
      inputs.current[index - 1].focus();
    }
  };

  const validateOTP = () => {
    const enteredOtp = otp.join("");
    setErrors({});

    if (enteredOtp.length !== 6) {
      setErrors({ otp: "Please enter the complete 6-digit OTP" });
      return false;
    }

    if (timeLeft <= 0) {
      setErrors({ otp: "OTP has expired. Please request a new one." });
      return false;
    }

    return true;
  };

  const handleVerifyOTP = async () => {
    console.log("=== OTP VERIFICATION STARTED ===");

    if (!validateOTP()) {
      console.log("OTP validation failed");
      return;
    }

    // Check device lockout
    try {
      const lockoutStatus = await checkOTPLockout();
      if (lockoutStatus && lockoutStatus.isLockedOut) {
        console.log("Device is locked for OTP attempts");
        setDeviceLocked(true);
        setLockoutTime(lockoutStatus.remainingTime);
        Alert.alert(
          "Account Locked",
          `Too many failed OTP attempts. Please try again in ${formatLockoutTime(
            lockoutStatus.remainingTime
          )}.`
        );
        return;
      }
    } catch (lockoutError) {
      console.log("Lockout check error (continuing anyway):", lockoutError);
    }

    const enteredOtp = otp.join("");
    setLoading(true);

    try {
      console.log("Verifying OTP:", enteredOtp);

      if (!confirmationResult) {
        throw new Error("No OTP session found. Please request a new OTP.");
      }
      // Twilio Verify only
      const verifySMSOTP = httpsCallable(functions, "verifySMSOTP");
      const response = await verifySMSOTP({
        phone: confirmationResult.phone,
        otp: enteredOtp,
      });

      if (response.data && response.data.success) {
        console.log("✅ OTP verified successfully!");

        // Reset OTP attempts on successful verification
        await resetOTPAttempts();

        // Update user document in Firestore
        const user = auth.currentUser;
        if (user) {
          await updateDoc(doc(db, "users", user.uid), {
            verified: true,
            lastVerified: new Date(),
            phone: confirmationResult.phone || mobileNumber,
            phoneVerified: true,
            otpVerified: true,
            lastOTPVerified: new Date(),
            failedOtpAttempts: 0,
          });
          console.log("✅ User verification status updated in Firestore");
        }
        // Navigate forward after successful verification
        navigation.navigate("LoginSuccess");
      } else {
        throw new Error("Invalid OTP code");
      }
    } catch (error) {
      console.error("OTP Verification Error:", error);

      // Increment OTP attempts
      const attempts = await incrementOTPAttempts();
      const remainingAttempts = 5 - attempts;
      setOtpAttempts(attempts);

      let errorMessage = "Invalid OTP code. Please try again.";

      if (error.message && error.message.includes("expired")) {
        errorMessage = "OTP has expired. Please request a new one.";
        setTimeLeft(0);
        setCanResend(true);
      } else if (error.message && error.message.includes("too many")) {
        errorMessage =
          "Too many verification attempts. Please request a new OTP.";
      } else if (error.message && error.message.includes("invalid")) {
        errorMessage = "Invalid verification code. Please check and try again.";
      }

      if (remainingAttempts <= 0) {
        setDeviceLocked(true);
        setLockoutTime(60000); // 1 minute for development
        Alert.alert(
          "Account Locked",
          "Too many failed OTP attempts. Your account is locked temporarily."
        );
      } else {
        setErrors({
          otp: `${errorMessage} ${remainingAttempts} attempts remaining.`,
        });
        // Clear OTP inputs on failed attempt
        setOtp(["", "", "", "", "", ""]);
        if (inputs.current[0]) {
          inputs.current[0].focus();
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    Alert.alert(
      "Go Back",
      "Are you sure you want to go back? You'll need to start the verification process again.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Go Back",
          onPress: () => navigation.goBack(),
        },
      ]
    );
  };

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const formatResendCooldown = (seconds) => {
    return `${seconds}s`;
  };

  if (deviceLocked) {
    return (
      <View style={styles.lockedContainer}>
        <View style={styles.lockedCard}>
          <Ionicons name="lock-closed" size={48} color="#c41e3a" />
          <Text style={styles.lockedTitle}>Account Locked</Text>
          <Text style={styles.lockedSubtitle}>
            Too many failed OTP attempts
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

            <Text style={styles.title}>ENTER OTP CODE</Text>
            <Text style={styles.subtitle}>
              We sent a 6-digit code to {mobileNumber}
            </Text>

            {/* Timer Display */}
            <View style={styles.timerContainer}>
              <Ionicons
                name={timeLeft > 60 ? "time-outline" : "warning-outline"}
                size={16}
                color={timeLeft > 60 ? "#3b4cca" : "#c41e3a"}
              />
              <Text
                style={[
                  styles.timerText,
                  timeLeft <= 60 && styles.timerTextUrgent,
                ]}
              >
                {timeLeft > 0
                  ? `Code expires in ${formatTime(timeLeft)}`
                  : "Code expired"}
              </Text>
            </View>

            {errors.otp && (
              <View style={styles.errorAlert}>
                <Text style={styles.errorAlertText}>{errors.otp}</Text>
              </View>
            )}

            {/* OTP Input */}
            <View style={styles.otpContainer}>
              {otp.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={(ref) => (inputs.current[index] = ref)}
                  style={[
                    styles.otpBox,
                    digit && styles.otpBoxFilled,
                    errors.otp && styles.otpBoxError,
                  ]}
                  keyboardType="number-pad"
                  maxLength={1}
                  value={digit}
                  onChangeText={(text) => handleOtpChange(text, index)}
                  onKeyPress={({ nativeEvent }) => {
                    if (nativeEvent.key === "Backspace") {
                      handleBackspace(digit, index);
                    }
                  }}
                  editable={!loading && !deviceLocked}
                />
              ))}
            </View>

            {/* Resend OTP Section */}
            <View style={styles.resendContainer}>
              <Text style={styles.resendText}>Didn't receive the code? </Text>
              <TouchableOpacity
                onPress={handleResendOTP}
                disabled={resendCooldown > 0 || resendLoading}
                style={styles.resendButton}
              >
                {resendLoading ? (
                  <ActivityIndicator size="small" color="#3b4cca" />
                ) : (
                  <Text
                    style={[
                      styles.resendLink,
                      resendCooldown > 0 && styles.resendLinkDisabled,
                    ]}
                  >
                    {resendCooldown > 0
                      ? `Resend (${formatResendCooldown(resendCooldown)})`
                      : "Resend OTP"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Attempt Counter hidden per requirement; tracking remains internal */}

            {/* Verify Button */}
            <Pressable
              style={({ pressed }) => [
                styles.verifyBtn,
                (loading || timeLeft <= 0) && styles.buttonDisabled,
                pressed && { opacity: 0.8 },
              ]}
              onPress={handleVerifyOTP}
              disabled={loading || timeLeft <= 0}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.verifyText}>
                  {timeLeft <= 0 ? "OTP Expired" : "Verify & Continue"}
                </Text>
              )}
            </Pressable>

            {/* Help Text */}
            <View style={styles.helpContainer}>
              <Ionicons
                name="information-circle-outline"
                size={16}
                color="#666"
              />
              <Text style={styles.helpText}>
                Enter the 6-digit code sent to your mobile number. The code is
                valid for 5 minutes.
              </Text>
            </View>

            {/* Recaptcha container for web */}
            {Platform.OS === "web" && <div id="recaptcha-container"></div>}
          </View>
        </ScrollView>
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
  timerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    padding: 10,
    backgroundColor: "#f8f9fa",
    borderRadius: 6,
  },
  timerText: {
    marginLeft: 8,
    fontSize: 14,
    color: "#3b4cca",
    fontWeight: "500",
  },
  timerTextUrgent: {
    color: "#c41e3a",
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
  otpContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    width: "100%",
  },
  otpBox: {
    width: 45,
    height: 50,
    borderWidth: 2,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    backgroundColor: "#fff",
  },
  otpBoxFilled: {
    borderColor: "#3b4cca",
    backgroundColor: "#f0f2ff",
  },
  otpBoxError: {
    borderColor: "#c41e3a",
    backgroundColor: "#ffebee",
  },
  resendContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    flexWrap: "wrap",
  },
  resendText: {
    fontSize: 14,
    color: "#666",
  },
  resendButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  resendLink: {
    fontSize: 14,
    color: "#3b4cca",
    fontWeight: "600",
  },
  resendLinkDisabled: {
    color: "#999",
  },
  attemptContainer: {
    marginBottom: 15,
    padding: 8,
    backgroundColor: "#fff3cd",
    borderRadius: 6,
    borderLeftWidth: 4,
    borderLeftColor: "#ffc107",
  },
  attemptText: {
    fontSize: 12,
    color: "#856404",
    textAlign: "center",
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
  helpContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 15,
    padding: 10,
    backgroundColor: "#f8f9fa",
    borderRadius: 6,
  },
  helpText: {
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
});
