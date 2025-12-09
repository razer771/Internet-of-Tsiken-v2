import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  SafeAreaView,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { Ionicons } from "@expo/vector-icons";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { updatePassword, signInWithEmailAndPassword } from "firebase/auth";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { auth, db } from "../../config/firebaseconfig.js";

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

export default function CreateNewPassword() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Alert Modal State
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertType, setAlertType] = useState("info");
  const [alertTitle, setAlertTitle] = useState("");
  const [alertMessage, setAlertMessage] = useState("");

  const navigation = useNavigation();
  const route = useRoute();
  const userId = route.params?.userId;

  const showAlert = (type, title, message) => {
    setAlertType(type);
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertVisible(true);
  };

  const closeAlert = () => {
    setAlertVisible(false);
  };

  const validatePassword = (password) => {
    const minLength = 6;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (password.length < minLength) {
      return "Password must be at least 6 characters long";
    }
    if (!hasUpperCase) {
      return "Password must contain at least one uppercase letter";
    }
    if (!hasLowerCase) {
      return "Password must contain at least one lowercase letter";
    }
    if (!hasNumber) {
      return "Password must contain at least one number";
    }
    if (!hasSpecialChar) {
      return "Password must contain at least one special character";
    }
    return "";
  };

  const validateForm = () => {
    setErrors({});
    const newErrors = {};

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      newErrors.newPassword = passwordError;
    }

    if (!confirmPassword || confirmPassword.trim() === "") {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    console.log("Validation errors:", newErrors);
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleUpdatePassword = async () => {
    console.log("Update Password button clicked");

    if (!validateForm()) {
      console.log("Validation failed, stopping password update");
      return;
    }

    console.log("Validation passed!");
    setLoading(true);

    try {
      const user = auth.currentUser;
      if (!user) {
        console.error("No authenticated user found");
        setLoading(false);
        showAlert(
          "error",
          "Authentication Error",
          "No user is currently logged in. Please log in again."
        );
        return;
      }

      console.log("Updating password for user:", user.uid);

      // Get user email from Firestore
      const userRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userRef);
      const userEmail = userDoc.data()?.email || user.email;

      // Check if new password is the same as current password
      try {
        await signInWithEmailAndPassword(auth, userEmail, newPassword);
        // If sign-in succeeds, the new password is the same as current password
        console.log(
          "❌ New password matches current password, blocking update"
        );
        setLoading(false);
        setErrors({
          ...errors,
          newPassword:
            "New password must not be the same as the current password",
        });
        return;
      } catch (authError) {
        // If sign-in fails, the new password is different (which is what we want)
        if (
          authError.code === "auth/invalid-credential" ||
          authError.code === "auth/wrong-password"
        ) {
          console.log(
            "✅ New password is different from current password, proceeding with update"
          );
        } else {
          // Other authentication errors
          console.error(
            "Re-authentication error:",
            authError.code,
            authError.message
          );
          throw authError;
        }
      }

      // Update password in Firebase Auth
      await updatePassword(user, newPassword);
      console.log("✅ Password updated in Firebase Auth");

      // Update requirePasswordChange flag in Firestore
      await updateDoc(userRef, {
        requirePasswordChange: false,
      });
      console.log("✅ requirePasswordChange flag set to false in Firestore");

      setLoading(false);
      showAlert(
        "success",
        "Password Updated",
        "Your password has been successfully updated. You will be redirected to login."
      );

      // Navigate to login after 2 seconds
      setTimeout(async () => {
        await auth.signOut();
        navigation.reset({
          index: 0,
          routes: [{ name: "LogIn" }],
        });
      }, 2000);
    } catch (error) {
      console.error("Password update error:", error.code, error.message);
      setLoading(false);

      let errorMessage = "Failed to update password. Please try again.";
      if (error.code === "auth/requires-recent-login") {
        errorMessage =
          "For security reasons, please log in again before changing your password.";
      } else if (error.code === "auth/weak-password") {
        errorMessage = "Password is too weak. Please use a stronger password.";
      }

      showAlert("error", "Update Failed", errorMessage);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAwareScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid={true}
        extraScrollHeight={20}
      >
        {/* Logo */}
        <View style={styles.logoContainer}>
          <Image source={Logo} style={styles.logo} resizeMode="contain" />
        </View>

        {/* Title */}
        <Text style={styles.title}>Create New Password</Text>
        <Text style={styles.subtitle}>
          Your administrator has requested that you change your password. Please
          create a strong password below.
        </Text>

        {/* New Password Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>
            New Password<Text style={styles.requiredAsterisk}> *</Text>
          </Text>
          <View
            style={[
              styles.inputWrapper,
              errors.newPassword && styles.inputError,
            ]}
          >
            <Ionicons
              name="lock-closed-outline"
              size={18}
              color="#8A99A8"
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="Enter new password"
              placeholderTextColor="#8A99A8"
              value={newPassword}
              onChangeText={(text) => {
                setNewPassword(text);
                if (errors.newPassword) {
                  setErrors({ ...errors, newPassword: "" });
                }
              }}
              secureTextEntry={!showNewPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity
              onPress={() => setShowNewPassword(!showNewPassword)}
              style={styles.eyeIcon}
            >
              <Ionicons
                name={showNewPassword ? "eye-outline" : "eye-off-outline"}
                size={18}
                color="#8A99A8"
              />
            </TouchableOpacity>
          </View>
          {errors.newPassword ? (
            <Text style={styles.errorText}>{errors.newPassword}</Text>
          ) : null}
        </View>

        {/* Confirm Password Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>
            Confirm Password<Text style={styles.requiredAsterisk}> *</Text>
          </Text>
          <View
            style={[
              styles.inputWrapper,
              errors.confirmPassword && styles.inputError,
            ]}
          >
            <Ionicons
              name="lock-closed-outline"
              size={16}
              color="#8A99A8"
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="Confirm new password"
              placeholderTextColor="#8A99A8"
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                if (errors.confirmPassword) {
                  setErrors({ ...errors, confirmPassword: "" });
                }
              }}
              secureTextEntry={!showConfirmPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              style={styles.eyeIcon}
            >
              <Ionicons
                name={showConfirmPassword ? "eye-outline" : "eye-off-outline"}
                size={18}
                color="#8A99A8"
              />
            </TouchableOpacity>
          </View>
          {errors.confirmPassword ? (
            <Text style={styles.errorText}>{errors.confirmPassword}</Text>
          ) : null}
        </View>

        {/* Update Password Button */}
        <TouchableOpacity
          style={[styles.updateButton, loading && styles.updateButtonDisabled]}
          onPress={handleUpdatePassword}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.updateButtonText}>Update Password</Text>
          )}
        </TouchableOpacity>

        {/* Password Requirements */}
        <View style={styles.requirementsContainer}>
          <Text style={styles.requirementsTitle}>Password must contain:</Text>
          <Text style={styles.requirementItem}>• At least 6 characters</Text>
          <Text style={styles.requirementItem}>
            • One uppercase letter (A-Z)
          </Text>
          <Text style={styles.requirementItem}>
            • One lowercase letter (a-z)
          </Text>
          <Text style={styles.requirementItem}>• One number (0-9)</Text>
          <Text style={styles.requirementItem}>
            • One special character (!@#$%^&*)
          </Text>
        </View>
      </KeyboardAwareScrollView>

      {/* Branded Alert Modal */}
      <BrandedAlertModal
        visible={alertVisible}
        type={alertType}
        title={alertTitle}
        message={alertMessage}
        onClose={closeAlert}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 32,
  },
  logo: {
    width: 80,
    height: 80,
    resizeMode: "contain",
    borderRadius: 40,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#133E87",
    textAlign: "center",
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: "#5A6B7B",
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
    color: "#222",
    marginBottom: 8,
  },
  requiredAsterisk: {
    color: "#c41e3a",
    fontSize: 15,
    fontWeight: "700",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F7F9FB",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E3E8EF",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inputError: {
    borderColor: "#c41e3a",
    borderWidth: 1.5,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: "#222",
  },
  eyeIcon: {
    padding: 4,
  },
  errorText: {
    color: "#c41e3a",
    fontSize: 13,
    marginTop: 6,
    marginLeft: 4,
  },
  requirementsContainer: {
    backgroundColor: "#F7F9FB",
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#E3E8EF",
  },
  requirementsTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#133E87",
    marginBottom: 8,
  },
  requirementItem: {
    fontSize: 13,
    color: "#5A6B7B",
    marginBottom: 4,
    lineHeight: 20,
  },
  updateButton: {
    backgroundColor: "#133E87",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
    shadowColor: "#133E87",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  updateButtonDisabled: {
    backgroundColor: "#8A99A8",
    shadowOpacity: 0,
    elevation: 0,
  },
  updateButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "600",
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
