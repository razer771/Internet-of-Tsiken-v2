import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { auth, db } from '../../config/firebaseconfig';
import { doc, updateDoc } from 'firebase/firestore';

export default function VerifyIdentityScreen() {
  const [selectedOption, setSelectedOption] = useState("email");
  const [inputValue, setInputValue] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [showOtpScreen, setShowOtpScreen] = useState(false);
  const inputs = useRef([]);
  const navigation = useNavigation();

  const handleSendOTP = () => {
    if (selectedOption === "mobile" && inputValue.length !== 11) {
      alert("Mobile number must be exactly 11 digits.");
      return;
    }
    setShowOtpScreen(true);
  };

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

  const handleVerifyLogin = async () => {
    try {
      const user = auth.currentUser;
      if (user) {
        // Update verification status in Firestore
        await updateDoc(doc(db, "users", user.uid), {
          verified: true,
          lastVerified: new Date(),
        });
        console.log("✅ User verification status updated");
      }
      navigation.navigate("LoginSuccess");
    } catch (error) {
      console.error("Error updating verification:", error);
      navigation.navigate("LoginSuccess");
    }
  };

  const handleBack = () => {
    setShowOtpScreen(false);
  };

  const handleOutsideTap = () => {
    Keyboard.dismiss();
    navigation.goBack(); // Go back instead of router.replace
  };

  return (
    <TouchableWithoutFeedback onPress={handleOutsideTap}>
      <View style={styles.container}>
        <View style={styles.card}>
          {showOtpScreen ? (
            <>
              <Text style={styles.title}>Enter OTP CODE</Text>
              <Text style={styles.subtitle}>
                We sent a 6-digit code to your {selectedOption === "email" ? "email" : "mobile number"}
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
                <Text style={styles.resendText}>Didn’t receive the code? </Text>
                <TouchableOpacity>
                  <Text style={styles.resendLink}>Resend</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.verifyButton} onPress={handleVerifyLogin}>
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
                Choose how you want to receive your OTP
              </Text>

              {/* Email Option */}
              <TouchableOpacity
                style={[
                  styles.optionContainer,
                  selectedOption === "email" && styles.selectedOption,
                ]}
                onPress={() => {
                  setSelectedOption("email");
                  setInputValue("");
                }}
                activeOpacity={1}
              >
                <Ionicons
                  name="mail-outline"
                  size={22}
                  color={selectedOption === "email" ? "#3B47FF" : "#555"}
                  style={styles.icon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Enter email address"
                  placeholderTextColor="#999"
                  value={selectedOption === "email" ? inputValue : ""}
                  onChangeText={setInputValue}
                  editable={selectedOption === "email"}
                  keyboardType="email-address"
                />
              </TouchableOpacity>

              {/* Mobile Option */}
              <TouchableOpacity
                style={[
                  styles.optionContainer,
                  selectedOption === "mobile" && styles.selectedOption,
                ]}
                onPress={() => {
                  setSelectedOption("mobile");
                  setInputValue("");
                }}
                activeOpacity={1}
              >
                <Ionicons
                  name="call-outline"
                  size={22}
                  color={selectedOption === "mobile" ? "#3B47FF" : "#555"}
                  style={styles.icon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Mobile Number"
                  placeholderTextColor="#999"
                  value={selectedOption === "mobile" ? inputValue : ""}
                  onChangeText={(text) => {
                    const numericText = text.replace(/[^0-9]/g, "");
                    if (numericText.length <= 11) {
                      setInputValue(numericText);
                    }
                  }}
                  editable={selectedOption === "mobile"}
                  keyboardType="number-pad"
                />
              </TouchableOpacity>

              <TouchableOpacity style={styles.button} onPress={handleSendOTP}>
                <Text style={styles.buttonText}>Send OTP Code</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F8FA",
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    width: "85%",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 25,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,
    elevation: 5,
    alignItems: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
    color: "#000",
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 20,
  },
  optionContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    width: "100%",
  },
  selectedOption: {
    borderColor: "#3B47FF",
    backgroundColor: "#f2f4ff",
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: "#000",
  },
  button: {
    backgroundColor: "#3b4cca",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
    width: "100%",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  otpContainer: {
    flexDirection: "row",
    justifyContent: "center",
    width: "100%",
    marginBottom: 20,
  },
  otpBox: {
    width: 40,
    height: 50,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    textAlign: "center",
    fontSize: 20,
    color: "#000",
    marginHorizontal: 6,
  },
  resendRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 13,
  },
  resendText: {
    fontSize: 13,
    color: "#555",
  },
  resendLink: {
    fontSize: 13,
    color: "#2E33A6",
    fontWeight: "700",
    textDecorationLine: "underline",
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
