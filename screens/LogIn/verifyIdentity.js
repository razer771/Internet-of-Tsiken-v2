import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
  Keyboard,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { auth, db } from "../../config/firebaseconfig.js";
import { doc, updateDoc } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";

// Initialize Firebase Functions
const functions = getFunctions(undefined, "us-central1");

export default function VerifyIdentityScreen() {
  const [selectedOption, setSelectedOption] = useState("mobile");
  const [inputValue, setInputValue] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [showOtpScreen, setShowOtpScreen] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [verificationId, setVerificationId] = useState(null);
  const inputs = useRef([]);
  const navigation = useNavigation();

  // Send OTP using Firebase Functions (working version)
  const handleSendOTP = async () => {
    if (selectedOption === "mobile") {
      if (inputValue.length < 10) {
        Alert.alert("Error", "Enter the 10-digit mobile number");
        return;
      }
      try {
        // Format phone number with country code
        const phoneNumber = `+63${inputValue}`; // Philippines country code

        console.log("🔄 Sending SMS to:", phoneNumber);

        // Call our deployed Firebase Function to send SMS
        const sendSMSOTP = httpsCallable(functions, "sendSMSOTP");
        const requestData = { mobileNumber: phoneNumber };
        console.log("🔄 Request data being sent:", requestData);
        console.log("🔄 Request data type:", typeof requestData);
        console.log("🔄 Request data keys:", Object.keys(requestData));

        const response = await sendSMSOTP(requestData);

        if (response.data && response.data.success) {
          setConfirmationResult({
            mobileNumber: response.data.mobileNumber,
            testOTP: response.data.testOTP,
          });
          setVerificationId(response.data.mobileNumber);
        } else {
          throw new Error("Failed to send SMS");
        }

        console.log("==========================================");
        console.log(`📱 SMS sent to: ${response.data.mobileNumber}`);
        console.log("SMS sent successfully");
        if (response.data.testOTP) {
          console.log(`🔐 OTP CODE: ${response.data.testOTP}`);
        }
        console.log("==========================================");

        setShowOtpScreen(true);
        Alert.alert(
          "SMS Sent",
          `SMS verification code sent to ${response.data.mobileNumber}${
            response.data.testOTP
              ? `\\n\\n🔐 TEST OTP: ${response.data.testOTP}\\n\\nUse this code to continue (SMS delivery in progress...)`
              : "\\n\\nCheck your messages for the code."
          }`
        );
      } catch (error) {
        console.error("🚨 OTP Generation Error:", error);
        console.error("Error details:", {
          code: error.code,
          message: error.message,
          details: error.details,
          stack: error.stack,
        });

        let errorMessage = "Failed to send OTP";
        if (error.code) {
          errorMessage += ` (${error.code})`;
        }
        if (error.message) {
          errorMessage += `: ${error.message}`;
        }

        Alert.alert("Error", errorMessage);
      }
    } else {
      Alert.alert("Error", "Only mobile OTP is supported.");
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
      Alert.alert("Error", "No OTP request found.");
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

        // Update Firestore verification status
        const user = auth.currentUser;
        if (user) {
          await updateDoc(doc(db, "users", user.uid), {
            verified: true,
            lastVerified: new Date(),
            phone: response.data.phone,
            phoneVerified: true,
          });
          console.log("✅ User verification status updated");
        }

        Alert.alert(
          "Success",
          "Phone number verified successfully!\\n\\n🎉 SMS verification completed via Firebase Functions."
        );
        navigation.navigate("LoginSuccess");
      } else {
        Alert.alert("Error", "Invalid OTP code. Please try again.");
      }
    } catch (error) {
      console.error("OTP Verification Error:", error);
      Alert.alert(
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
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
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
});
