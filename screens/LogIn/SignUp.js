import React, { useState, useRef } from "react";
// --- ADD FIRESTORE IMPORTS ---
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../../config/firebaseconfig";
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
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

// --- 1. IMPORT NAVIGATION ---
import { useNavigation } from "@react-navigation/native";

// The function name now matches your import in App.js
export default function SignUp() {
  const [fullname, setFullname] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  // ... (rest of your states are perfect)
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [passwordError, setPasswordError] = useState(false);
  const [loading, setLoading] = useState(false);

  // --- 2. INITIALIZE NAVIGATION ---
  const navigation = useNavigation();

  // ... (shakeAnim and triggerShake are perfect)
  const shakeAnim = {
    fullname: useRef(new Animated.Value(0)).current,
    email: useRef(new Animated.Value(0)).current,
    phone: useRef(new Animated.Value(0)).current,
    password: useRef(new Animated.Value(0)).current,
    confirmPassword: useRef(new Animated.Value(0)).current,
  };

  const triggerShake = (field) => {
    Animated.sequence([
      Animated.timing(shakeAnim[field], {
        toValue: 12,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim[field], {
        toValue: -12,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim[field], {
        toValue: 8,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim[field], {
        toValue: -8,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim[field], {
        toValue: 4,
        duration: 40,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim[field], {
        toValue: -4,
        duration: 40,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim[field], {
        toValue: 0,
        duration: 30,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleSignUp = async () => {
    // ... (Your validation logic is perfect)
    setErrors({});
    setPasswordError(false);

    const newErrors = {};
    if (!fullname) newErrors.fullname = true;
    if (!email) newErrors.email = true;
    if (!phone) newErrors.phone = true;
    if (!password) newErrors.password = true;
    if (!confirmPassword) newErrors.confirmPassword = true;

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      Object.keys(newErrors).forEach((field) => triggerShake(field));
      return;
    }

    if (password !== confirmPassword) {
      setPasswordError(true);
      triggerShake("password");
      triggerShake("confirmPassword");
      return;
    }

    setLoading(true);
    try {
      // Step 1: Create user in AUTHENTICATION
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      console.log("✅ Auth user created:", user.uid);

      // Step 2: Save profile data in FIRESTORE
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        fullname: fullname,
        mobile: phone,
        email: email,
        createdAt: new Date(),
      });
      console.log("✅ User profile saved to Firestore!");
      // --- END OF NEW BLOCK ---

      // SUCCESS!
      Alert.alert("Success", "Account created successfully!");

      // --- 3. NAVIGATE TO LOGIN SCREEN ---
      navigation.navigate("LogIn");
    } catch (error) {
      // ... (Your error handling is perfect)
      console.error("Firebase Sign Up Error:", error.code, error.message);
      let errorMessage = "An unexpected error occurred. Please try again.";
      if (error.code === "auth/email-already-in-use") {
        errorMessage = "This email address is already in use.";
        setErrors((prev) => ({ ...prev, email: true }));
        triggerShake("email");
      } else if (error.code === "auth/weak-password") {
        errorMessage =
          "Password is too weak. Please use at least 6 characters.";
        setErrors((prev) => ({ ...prev, password: true }));
        triggerShake("password");
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "The email address is not valid.";
        setErrors((prev) => ({ ...prev, email: true }));
        triggerShake("email");
      }
      Alert.alert("Sign Up Failed", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // --- ADDED THIS FUNCTION ---
  const handleGoToLogin = () => {
    navigation.navigate("LogIn");
  };

  // ... (The rest of your code (renderInput and styles) is perfect)
  const renderInput = (
    placeholder,
    value,
    setValue,
    field,
    isPassword = false
  ) => (
    <Animated.View
      style={[
        styles.inputContainer,
        (errors[field] ||
          (passwordError &&
            (field === "password" || field === "confirmPassword"))) &&
          styles.errorBorder,
        { transform: [{ translateX: shakeAnim[field] }] },
      ]}
    >
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor="#888"
        value={value}
        secureTextEntry={isPassword && !showPassword}
        onChangeText={(text) => {
          setValue(text);
          if (text) setErrors((prev) => ({ ...prev, [field]: false }));
          if (field === "password" || field === "confirmPassword")
            setPasswordError(false);
        }}
        autoCapitalize={field === "email" ? "none" : "sentences"}
        keyboardType={
          field === "email"
            ? "email-address"
            : field === "phone"
              ? "phone-pad"
              : "default"
        }
        maxLength={field === "phone" ? 11 : undefined}
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
              source={require("../../assets/logo.png")}
              style={styles.logo}
            />
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>
              Sign up to start managing your brooder
            </Text>

            {renderInput("Enter full name", fullname, setFullname, "fullname")}
            {renderInput("Enter email address", email, setEmail, "email")}
            {renderInput("Enter phone number", phone, setPhone, "phone")}
            {renderInput(
              "Enter password",
              password,
              setPassword,
              "password",
              true
            )}
            {renderInput(
              "Confirm password",
              confirmPassword,
              setConfirmPassword,
              "confirmPassword",
              true
            )}

            {passwordError && (
              <Text style={styles.passwordError}>Passwords do not match</Text>
            )}

            <TouchableOpacity
              style={styles.button}
              onPress={handleSignUp}
              disabled={loading} // Disable button while loading
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Sign Up</Text>
              )}
            </TouchableOpacity>

            {/* --- ADDED THIS BLOCK --- */}
            <View style={styles.loginRow}>
              <Text style={styles.loginText}>Already have an account? </Text>
              <TouchableOpacity onPress={handleGoToLogin}>
                <Text style={styles.loginLink}>Log In</Text>
              </TouchableOpacity>
            </View>
            {/* --- END OF ADDED BLOCK --- */}
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
    width: 120,
    height: 120,
    resizeMode: "contain",
    marginBottom: 10,
    borderRadius: 60,
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
    flexDirection: "row",
    alignItems: "center",
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
    flex: 1,
    color: "#333",
    fontSize: 16,
    paddingVertical: 8,
  },
  eyeButton: {
    padding: 8,
  },
  button: {
    backgroundColor: "#2D2A8C",
    borderRadius: 10,
    padding: 14,
    marginTop: 10,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
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
  // --- ADDED THESE STYLES ---
  loginRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 15, // Added some space
  },
  loginText: {
    color: "#555",
    fontSize: 14, // Matched font size
  },
  loginLink: {
    color: "#2D2A8C", // Matched your button color
    fontWeight: "bold",
    textDecorationLine: "underline",
    fontSize: 14, // Matched font size
  },
});
