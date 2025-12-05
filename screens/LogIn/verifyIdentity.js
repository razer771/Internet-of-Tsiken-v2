import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
  Keyboard,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { useNavigation } from "@react-navigation/native";
import { auth, db } from "../../config/firebaseconfig.js";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";

// Initialize Firebase Functions
const functions = getFunctions(undefined, "us-central1");

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

export default function VerifyIdentityScreen() {
  const [selectedOption, setSelectedOption] = useState("mobile");
  const [inputValue, setInputValue] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [showOtpScreen, setShowOtpScreen] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [verificationId, setVerificationId] = useState(null);
  const [successModalVisible, setSuccessModalVisible] = useState(false);

  // Alert Modal State
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertType, setAlertType] = useState("info");
  const [alertTitle, setAlertTitle] = useState("");
  const [alertMessage, setAlertMessage] = useState("");

  const inputs = useRef([]);
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

  // Send OTP using Firebase Functions (working version)
  const handleSendOTP = async () => {
    if (selectedOption === "mobile") {
      if (inputValue.length < 10) {
        showAlert(
          "error",
          "Incomplete Mobile Number",
          "Enter the 10-digit mobile number"
        );
        return;
      }
      try {
        // Format phone number with country code
        const phoneNumber = `+63${inputValue}`; // Philippines country code

        console.log("🔄 Sending SMS to:", phoneNumber);

        // Call our deployed Firebase Function to send SMS
        const sendSMSOTP = httpsCallable(functions, "sendSMSOTP");
        const requestData = { phone: phoneNumber };
        console.log("🔄 Request data being sent:", requestData);
        console.log("🔄 Request data type:", typeof requestData);
        console.log("🔄 Request data keys:", Object.keys(requestData));

        const response = await sendSMSOTP(requestData);

        if (response.data && response.data.success) {
          setConfirmationResult({
            phone: response.data.phone || phoneNumber,
            testOTP: response.data.testOTP,
          });
          setVerificationId(response.data.phone || phoneNumber);
        } else {
          throw new Error("Failed to send SMS");
        }

        console.log("==========================================");
        console.log(`📱 SMS sent to: ${response.data.phone || phoneNumber}`);
        console.log("SMS sent successfully");
        if (response.data.testOTP) {
          console.log(`🔐 OTP CODE: ${response.data.testOTP}`);
        }
        console.log("==========================================");

        setShowOtpScreen(true);
        setSuccessModalVisible(true);

        // Auto-hide modal after 2 seconds
        setTimeout(() => {
          setSuccessModalVisible(false);
        }, 2000);
      } catch (error) {
        console.error("🚨 OTP Generation Error:", error);
        console.error("Error details:", {
          code: error.code,
          message: error.message,
          details: error.details,
          stack: error.stack,
        });

        let errorMessage = "Mobile number does not match user records";

        showAlert("error", "Invalid Mobile Number", errorMessage);
      }
    } else {
      showAlert("error", "Error", "Only mobile OTP is supported.");
    }
  };

  // Handle OTP input
  const handleOtpChange = (text, index) => {
    const digit = text.replace(/[^0-9]/g, "");
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    if (digit && index < otp.length - 1) {
      inputs.current[index + 1].focus();
    }
  };

  const handleBackspace = (text, index) => {
    if (!text && index > 0) {
      inputs.current[index - 1].focus();
    }
  };

  // Verify OTP using Firebase Functions
  const handleVerifyLogin = async () => {
    const enteredOtp = otp.join("");
    if (!confirmationResult) {
      showAlert("error", "Error", "No OTP request found.");
      return;
    }

    try {
      // Verify OTP using Firebase Functions
      const verifySMSOTP = httpsCallable(functions, "verifySMSOTP");
      const response = await verifySMSOTP({
        phone: confirmationResult.phone,
        otp: enteredOtp,
      });

      if (response.data && response.data.success) {
        console.log("✅ Phone number verified successfully!");
        console.log("Phone:", response.data.phone);

        // Update Firestore verification status and fetch user data
        const user = auth.currentUser;
        if (user) {
          const userRef = doc(db, "users", user.uid);
          await updateDoc(userRef, {
            verified: true,
            lastVerified: new Date(),
            phone: response.data.phone,
            phoneVerified: true,
          });
          console.log("✅ User verification status updated");

          // Fetch updated user document to check role
          const userDoc = await getDoc(userRef);
          if (userDoc.exists()) {
            const userData = userDoc.data();
            console.log("👤 User role:", userData.role || "Regular user");

            showAlert(
              "success",
              "Success",
              "Phone number verified successfully!\n\n🎉 SMS verification completed via Firebase Functions."
            );

            // Navigate based on user role after a short delay
            setTimeout(() => {
              if (userData.role === "Admin") {
                console.log(
                  "🔀 Navigating to AdminDashboard (OTP verified admin)"
                );
                navigation.reset({
                  index: 0,
                  routes: [{ name: "AdminDashboard" }],
                });
              } else {
                console.log(
                  "🔀 Navigating to Home (OTP verified regular user)"
                );
                navigation.reset({
                  index: 0,
                  routes: [{ name: "Home" }],
                });
              }
            }, 2000);
          } else {
            throw new Error("User document not found after verification");
          }
        }
      } else {
        showAlert("error", "Error", "Invalid OTP code. Please try again.");
      }
    } catch (error) {
      console.error("OTP Verification Error:", error);
      showAlert(
        "error",
        "Error",
        error.message || "Failed to verify OTP. Please try again."
      );
    }
  };

  const handleBack = () => {
    setShowOtpScreen(false);
    setOtp(["", "", "", "", "", ""]);
  };

  const handleOutsideTap = () => {
    Keyboard.dismiss();
    navigation.goBack();
  };

  return (
    <TouchableWithoutFeedback onPress={handleOutsideTap}>
      <View style={styles.container}>
        <View style={styles.formContainer}>
          {/* Back Arrow Button */}
          <TouchableOpacity
            style={styles.backArrow}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#3b4cca" />
          </TouchableOpacity>

          {showOtpScreen ? (
            <>
              <Text style={styles.title}>Enter OTP CODE</Text>
              <Text style={styles.subtitle}>
                We sent a 6-digit code to your mobile number
              </Text>

              <View style={styles.otpContainer}>
                {otp.map((digit, index) => (
                  <TextInput
                    key={index}
                    ref={(ref) => (inputs.current[index] = ref)}
                    style={styles.otpBox}
                    keyboardType="number-pad"
                    maxLength={1}
                    value={digit}
                    onChangeText={(text) => handleOtpChange(text, index)}
                    onKeyPress={({ nativeEvent }) => {
                      if (nativeEvent.key === "Backspace") {
                        handleBackspace(digit, index);
                      }
                    }}
                  />
                ))}
              </View>

              <View style={styles.resendRow}>
                <Text style={styles.resendText}>Didn't receive the code? </Text>
                <TouchableOpacity onPress={handleSendOTP}>
                  <Text style={styles.resendLink}>Resend</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.verifyButton}
                onPress={handleVerifyLogin}
              >
                <Text style={styles.verifyText}>Verify & Login</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                <Text style={styles.backText}>Back</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.title}>Verify Your Identity</Text>
              <Text style={styles.subtitle}>
                Enter your mobile number to receive OTP
              </Text>

              <TouchableOpacity
                style={[
                  styles.optionButton,
                  selectedOption === "mobile" && styles.selectedOption,
                ]}
                onPress={() => setSelectedOption("mobile")}
              >
                <Ionicons
                  name="phone-portrait-outline"
                  size={20}
                  color={selectedOption === "mobile" ? "#3b4cca" : "#666"}
                />
                <Text
                  style={[
                    styles.optionText,
                    selectedOption === "mobile" && styles.selectedOptionText,
                  ]}
                >
                  Mobile Number
                </Text>
              </TouchableOpacity>

              <View style={styles.inputContainer}>
                <Text style={styles.countryCode}>+63</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter 10-digit mobile number"
                  keyboardType="phone-pad"
                  maxLength={10}
                  value={inputValue}
                  onChangeText={setInputValue}
                />
              </View>

              <TouchableOpacity
                style={styles.sendButton}
                onPress={handleSendOTP}
              >
                <Text style={styles.sendText}>Send OTP</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Success Modal for OTP Sent */}
        <Modal transparent visible={successModalVisible} animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.successIconContainer}>
                <MaterialCommunityIcons
                  name="check-circle"
                  size={60}
                  color="#4CAF50"
                />
              </View>
              <Text style={styles.modalTitle}>OTP Sent Successfully!</Text>
              <Text style={styles.modalMessage}>
                A 6-digit verification code has been sent to your mobile number.
              </Text>
              <Text style={styles.modalSubMessage}>
                Please check your messages.
              </Text>
            </View>
          </View>
        </Modal>

        {/* Branded Alert Modal */}
        <BrandedAlertModal
          visible={alertVisible}
          type={alertType}
          title={alertTitle}
          message={alertMessage}
          onClose={closeAlert}
        />
      </View>
    </TouchableWithoutFeedback>
  );
}

// Keep existing styles...
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F8FA",
    justifyContent: "center",
    alignItems: "center",
  },
  formContainer: {
    width: "90%",
    maxWidth: 400,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    color: "#1a1a1a",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    color: "#666",
    marginBottom: 30,
  },
  optionButton: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  selectedOption: {
    borderColor: "#3b4cca",
    backgroundColor: "#f0f2ff",
  },
  optionText: {
    marginLeft: 12,
    fontSize: 16,
    color: "#666",
  },
  selectedOptionText: {
    color: "#3b4cca",
    fontWeight: "500",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    marginBottom: 20,
  },
  countryCode: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: "#333",
    backgroundColor: "#f8f8f8",
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
  },
  input: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 16,
    fontSize: 15,
    color: "#333",
  },
  sendButton: {
    backgroundColor: "#3b4cca",
    borderRadius: 8,
    width: "100%",
    paddingVertical: 16,
    alignItems: "center",
  },
  sendText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  otpContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 30,
  },
  otpBox: {
    width: 45,
    height: 50,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  resendRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 30,
  },
  resendText: {
    fontSize: 14,
    color: "#666",
  },
  resendLink: {
    fontSize: 14,
    color: "#3b4cca",
    fontWeight: "600",
  },
  verifyButton: {
    backgroundColor: "#3b4cca",
    borderRadius: 8,
    width: "100%",
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 10,
  },
  verifyText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  backButton: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    width: "100%",
    paddingVertical: 12,
    alignItems: "center",
  },
  backText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 30,
    width: "85%",
    maxWidth: 350,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  successIconContainer: {
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1a1a1a",
    textAlign: "center",
    marginBottom: 12,
  },
  modalMessage: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    marginBottom: 8,
    lineHeight: 22,
  },
  modalSubMessage: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
  },
  backArrow: {
    alignSelf: "flex-start",
    marginBottom: 16,
    padding: 8,
    marginLeft: -8,
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
