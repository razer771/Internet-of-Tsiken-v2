import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from '@expo/vector-icons';

export default function SignupScreen() {
  const [fullname, setFullname] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [passwordError, setPasswordError] = useState(false);

  const shakeAnim = {
    fullname: useRef(new Animated.Value(0)).current,
    email: useRef(new Animated.Value(0)).current,
    phone: useRef(new Animated.Value(0)).current,
    password: useRef(new Animated.Value(0)).current,
    confirmPassword: useRef(new Animated.Value(0)).current,
  };

  const triggerShake = (field) => {
    Animated.sequence([
      Animated.timing(shakeAnim[field], { toValue: 12, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim[field], { toValue: -12, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim[field], { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim[field], { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim[field], { toValue: 4, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim[field], { toValue: -4, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim[field], { toValue: 0, duration: 30, useNativeDriver: true }),
    ]).start();
  };

  const handleSignUp = () => {
    const newErrors = {};
    if (!fullname) newErrors.fullname = true;
    if (!email) newErrors.email = true;
    if (!phone) newErrors.phone = true;
    if (!password) newErrors.password = true;
    if (!confirmPassword) newErrors.confirmPassword = true;

    setErrors(newErrors);
    Object.keys(newErrors).forEach(field => triggerShake(field));

    if (password && confirmPassword && password !== confirmPassword) {
      setPasswordError(true);
      triggerShake("password");
      triggerShake("confirmPassword");
      return;
    } else {
      setPasswordError(false);
    }

    if (Object.keys(newErrors).length === 0 && !passwordError) {
      console.log("✅ Sign Up Successful!");
    }
  };

  const renderInput = (placeholder, value, setValue, field, isPassword = false) => (
    <Animated.View
      style={[
        styles.inputContainer,
        (errors[field] || (passwordError && (field === "password" || field === "confirmPassword"))) && styles.errorBorder,
        { transform: [{ translateX: shakeAnim[field] }] }
      ]}
    >
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor="#888"
        value={value}
        secureTextEntry={isPassword && !showPassword}
        onChangeText={text => {
          setValue(text);
          if (text) setErrors(prev => ({ ...prev, [field]: false }));
          if (field === "password" || field === "confirmPassword") setPasswordError(false);
        }}
      />
      {isPassword && (
        <TouchableOpacity
          onPress={() => setShowPassword(!showPassword)}
          style={styles.eyeButton}
        >
          <Ionicons
            name={showPassword ? "eye-off" : "eye"}
            size={20}
            color="#555"
          />
        </TouchableOpacity>
      )}
    </Animated.View>
  );

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1, width: "100%" }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.modal}>
            <Image
              source={require("../assets/icon.png")}
              style={styles.logo}
            />
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Sign up to start managing your brooder</Text>

            {renderInput("Enter full name", fullname, setFullname, "fullname")}
            {renderInput("Enter email address", email, setEmail, "email")}
            {renderInput("Enter phone number", phone, setPhone, "phone")}
            {renderInput("Enter password", password, setPassword, "password", true)}
            {renderInput("Confirm password", confirmPassword, setConfirmPassword, "confirmPassword", true)}

            {passwordError && <Text style={styles.passwordError}>Passwords do not match</Text>}

            <TouchableOpacity style={styles.button} onPress={handleSignUp}>
              <Text style={styles.buttonText}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 20,
  },
  modal: {
    backgroundColor: "#fff",
    padding: 30,
    borderRadius: 25,
    width: "85%",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 15,
  },
  logo: {
    width: 80,
    height: 80,
    resizeMode: "contain",
    marginBottom: 15,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#2D2A8C",
    textAlign: "center",
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: "#555",
    textAlign: "center",
    marginBottom: 20,
  },
  inputContainer: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: 15,
    backgroundColor: "#fff",
    width: "100%",
    position: "relative",
  },
  input: {
    color: "#333",
    fontSize: 16,
  },
  eyeButton: {
    position: "absolute",
    right: 15,
    top: "35%",
  },
  button: {
    backgroundColor: "#2D2A8C",
    borderRadius: 10,
    padding: 14,
    marginTop: 10,
    width: "100%",
  },
  buttonText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "bold",
    fontSize: 16,
  },
  errorBorder: {
    borderColor: "red",
  },
  passwordError: {
    color: "red",
    marginBottom: 10,
    fontSize: 14,
    textAlign: "center",
  },
});
