import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { auth, db } from "../../../config/firebaseconfig";
import {
  doc,
  getDoc,
  updateDoc,
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";
import {
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function EditProfile({ navigation }) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Form fields
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Name error states
  const [firstNameError, setFirstNameError] = useState("");
  const [middleNameError, setMiddleNameError] = useState("");
  const [lastNameError, setLastNameError] = useState("");

  // Password error states
  const [currentPasswordError, setCurrentPasswordError] = useState("");
  const [newPasswordError, setNewPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");

  // Original values for change detection
  const [originalFirstName, setOriginalFirstName] = useState("");
  const [originalMiddleName, setOriginalMiddleName] = useState("");
  const [originalLastName, setOriginalLastName] = useState("");
  const [originalPhone, setOriginalPhone] = useState("");

  // Success popup state
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState(
    "Your profile has been updated",
  );

  // Unsaved changes modal state
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [canExit, setCanExit] = useState(false);
  const navigationActionRef = useRef(null);
  const justSavedRef = useRef(false);

  // Save confirmation modal state
  const [showSaveConfirmModal, setShowSaveConfirmModal] = useState(false);
  const [showPasswordConfirmModal, setShowPasswordConfirmModal] =
    useState(false);
  const [showPasswordErrorModal, setShowPasswordErrorModal] = useState(false);
  const [passwordErrorMessage, setPasswordErrorMessage] = useState("");

  useEffect(() => {
    fetchUserData();
  }, []);

  // Reset canExit flag when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      setCanExit(false);
      justSavedRef.current = false;
    });

    return unsubscribe;
  }, [navigation]);

  // Prevent navigation if there are unsaved changes
  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (e) => {
      // If canExit is true or just saved, allow navigation
      if (canExit || justSavedRef.current) {
        return;
      }

      // Check if there are unsaved changes
      const hasProfileChanges =
        firstName !== originalFirstName ||
        middleName !== originalMiddleName ||
        lastName !== originalLastName ||
        phone !== originalPhone;
      const hasPasswordChanges =
        currentPassword || newPassword || confirmPassword;

      if (!hasProfileChanges && !hasPasswordChanges) {
        // No unsaved changes, allow navigation
        return;
      }

      // Prevent default navigation
      e.preventDefault();

      // Store the navigation action
      navigationActionRef.current = e.data.action;

      // Show confirmation modal
      setShowUnsavedModal(true);
    });

    return unsubscribe;
  }, [
    navigation,
    firstName,
    middleName,
    lastName,
    phone,
    originalFirstName,
    originalMiddleName,
    originalLastName,
    originalPhone,
    currentPassword,
    newPassword,
    confirmPassword,
    canExit,
  ]);

  const fetchUserData = async () => {
    try {
      // Check if admin bypass
      const isAdminBypass = await AsyncStorage.getItem("isAdminBypass");
      const adminEmail = await AsyncStorage.getItem("adminEmail");

      if (isAdminBypass === "true" && adminEmail === "admin@example.com") {
        setIsAdmin(true);
        setFirstName("Admin");
        setMiddleName("");
        setLastName("");
        setEmail("admin@example.com");
        setPhone("");
        setOriginalFirstName("Admin");
        setOriginalMiddleName("");
        setOriginalLastName("");
        setOriginalPhone("");
        setLoading(false);
        return;
      }

      const currentUser = auth.currentUser;

      if (currentUser) {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));

        if (userDoc.exists()) {
          const data = userDoc.data();
          const fetchedPhone = data.phone || "";

          let fetchedFirstName = "";
          let fetchedMiddleName = "";
          let fetchedLastName = "";

          // Strategy 1: Check for individual name fields (preferred)
          if (data.firstName || data.lastName) {
            // Map individual fields explicitly to avoid misplacement
            fetchedFirstName = data.firstName || "";
            fetchedMiddleName = data.middleName || "";
            fetchedLastName = data.lastName || "";
            console.log("✅ Loaded individual name fields from Firestore:", {
              firstName: fetchedFirstName,
              middleName: fetchedMiddleName,
              lastName: fetchedLastName,
            });
          }
          // Strategy 2: Fall back to parsing combined fullname field
          else if (data.fullname || data.name) {
            const fullname = data.fullname || data.name;
            const nameParts = fullname.trim().split(/\s+/);

            if (nameParts.length === 1) {
              fetchedFirstName = nameParts[0];
            } else if (nameParts.length === 2) {
              fetchedFirstName = nameParts[0];
              fetchedLastName = nameParts[1];
            } else if (nameParts.length >= 3) {
              fetchedFirstName = nameParts[0];
              fetchedMiddleName = nameParts.slice(1, -1).join(" ");
              fetchedLastName = nameParts[nameParts.length - 1];
            }
            console.log("⚠️ Parsed combined fullname into individual fields:", {
              firstName: fetchedFirstName,
              middleName: fetchedMiddleName,
              lastName: fetchedLastName,
            });
          }

          // Map fetched values to state variables explicitly
          setFirstName(fetchedFirstName);
          setMiddleName(fetchedMiddleName);
          setLastName(fetchedLastName);
          setEmail(data.email || currentUser.email || "");
          setPhone(fetchedPhone);

          // Store original values for change detection
          setOriginalFirstName(fetchedFirstName);
          setOriginalMiddleName(fetchedMiddleName);
          setOriginalLastName(fetchedLastName);
          setOriginalPhone(fetchedPhone);
        } else {
          setEmail(currentUser.email || "");
        }
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
      Alert.alert("Error", "Failed to load profile data");
    } finally {
      setLoading(false);
    }
  };

  // Format name to Title Case
  // Format phone number from any format to local format (09XXXXXXXXX)
  const formatPhoneNumber = (phone) => {
    if (!phone) return null;

    // Remove all spaces, dashes, and parentheses
    let cleaned = phone.replace(/[\s\-\(\)]/g, "");

    // If it starts with +63, convert to 0 format
    if (cleaned.startsWith("+63")) {
      return "0" + cleaned.substring(3);
    }

    // If it already starts with 09, return as is
    if (cleaned.startsWith("09")) {
      return cleaned;
    }

    // If it starts with 63 (without +), convert to 0 format
    if (cleaned.startsWith("63")) {
      return "0" + cleaned.substring(2);
    }

    return cleaned;
  };

  const formatToTitleCase = (name) => {
    return name
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  // Auto-capitalize to Title Case (capitalize first letter of each word)
  const autoCapitalizeName = (name) => {
    if (!name) return "";

    return name
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  // Validate first name in real-time
  const validateFirstName = (name) => {
    if (!name) {
      setFirstNameError("");
      return;
    }

    let error = "";

    // Check maximum length first
    if (name.length >= 20) {
      error = "First name cannot exceed 20 characters";
    }
    // Check minimum length
    else if (name.length < 2) {
      error = "First name must be at least 2 letters";
    }
    // Check for numbers
    else if (/\d/.test(name)) {
      error = "Numbers are not allowed";
    }
    // Check for invalid characters (only letters, spaces, and periods allowed)
    else if (!/^[a-zA-Z\.\s]+$/.test(name)) {
      error = "Invalid characters in first name";
    }

    setFirstNameError(error);
  };

  // Validate middle name in real-time
  const validateMiddleName = (name) => {
    if (!name) {
      setMiddleNameError("");
      return;
    }

    let error = "";

    // Check maximum length
    if (name.length >= 20) {
      error = "Middle name cannot exceed 20 characters";
    }
    // Check for numbers
    else if (/\d/.test(name)) {
      error = "Numbers are not allowed";
    }
    // Check for invalid characters (only letters, spaces, and periods allowed)
    else if (!/^[a-zA-Z\.\s]+$/.test(name)) {
      error = "Invalid characters in middle name";
    }

    setMiddleNameError(error);
  };

  // Validate last name in real-time
  const validateLastName = (name) => {
    if (!name) {
      setLastNameError("");
      return;
    }

    let error = "";

    // Check maximum length first
    if (name.length >= 20) {
      error = "Last name cannot exceed 20 characters";
    }
    // Check minimum length
    else if (name.length < 2) {
      error = "Last name must be at least 2 letters";
    }
    // Check for numbers
    else if (/\d/.test(name)) {
      error = "Numbers are not allowed";
    }
    // Check for invalid characters (only letters, spaces, and periods allowed)
    else if (!/^[a-zA-Z\.\s]+$/.test(name)) {
      error = "Invalid characters in last name";
    }

    setLastNameError(error);
  };

  const handleSaveProfile = () => {
    // Validation
    if (!firstName.trim()) {
      Alert.alert("Error", "Please enter your first name");
      return;
    }

    if (!lastName.trim()) {
      Alert.alert("Error", "Please enter your last name");
      return;
    }

    // Check for validation errors
    if (firstNameError || middleNameError || lastNameError) {
      Alert.alert("Error", "Please fix name validation errors before saving");
      return;
    }

    if (!phone.trim()) {
      Alert.alert("Error", "Please enter your phone number");
      return;
    }

    // Show confirmation modal
    setShowSaveConfirmModal(true);
  };

  const confirmSaveProfile = async () => {
    setShowSaveConfirmModal(false);
    setSaving(true);

    try {
      // Admin bypass - just show success
      if (isAdmin) {
        setShowSuccess(true);
        setTimeout(() => {
          setShowSuccess(false);
          navigation.navigate("UserProfile");
        }, 2000);
        setSaving(false);
        return;
      }

      const currentUser = auth.currentUser;

      if (!currentUser) {
        Alert.alert("Error", "No user logged in");
        setSaving(false);
        return;
      }

      // Format names to Title Case
      const formattedFirstName = formatToTitleCase(firstName);
      const formattedMiddleName = formatToTitleCase(middleName);
      const formattedLastName = formatToTitleCase(lastName);
      const formattedPhone = formatPhoneNumber(phone.trim());

      // Build update object with only changed fields
      const updateData = {};
      const fieldsChanged = [];

      // Check each field for changes and only update if different
      if (formattedFirstName !== originalFirstName) {
        updateData.firstName = formattedFirstName;
        fieldsChanged.push(
          `firstName: "${originalFirstName}" → "${formattedFirstName}"`,
        );
      }

      if (formattedMiddleName !== originalMiddleName) {
        updateData.middleName = formattedMiddleName;
        fieldsChanged.push(
          `middleName: "${originalMiddleName}" → "${formattedMiddleName}"`,
        );
      }

      if (formattedLastName !== originalLastName) {
        updateData.lastName = formattedLastName;
        fieldsChanged.push(
          `lastName: "${originalLastName}" → "${formattedLastName}"`,
        );
      }

      if (formattedPhone && formattedPhone !== originalPhone) {
        // Update only "phone" field
        updateData.phone = formattedPhone;
        fieldsChanged.push(`phone: "${originalPhone}" → "${formattedPhone}"`);
      }

      // Always update timestamp
      updateData.updatedAt = new Date();

      // Only proceed if there are actual changes
      if (Object.keys(updateData).length > 1) {
        // Generate combined fullname for reference (optional backup field)
        const fullname = [
          formattedFirstName,
          formattedMiddleName,
          formattedLastName,
        ]
          .filter((name) => name)
          .join(" ");
        updateData.fullname = fullname;

        // Update Firestore profile with only changed fields
        await updateDoc(doc(db, "users", currentUser.uid), updateData);

        console.log("✅ Profile updated successfully");
        console.log("📝 Fields changed:", fieldsChanged);

        // Log activity to activity_logs/editProfile/userprofile
        try {
          await addDoc(
            collection(db, "activity_logs", "editProfile", "userprofile"),
            {
              userId: currentUser.uid,
              action: "Profile updated",
              description: `Updated profile: ${fieldsChanged.join(", ")}`,
              timestamp: serverTimestamp(),
              deviceInfo: Platform.OS,
              firstName: formattedFirstName,
              lastName: formattedLastName,
            },
          );
          console.log("✅ Activity logged successfully");
        } catch (logError) {
          console.error("⚠️ Failed to log activity:", logError);
          // Don't block the flow if logging fails
        }
      } else {
        console.log("ℹ️ No changes detected - profile not updated");
      }

      // Update original values to reflect saved changes
      setOriginalFirstName(formattedFirstName);
      setOriginalMiddleName(formattedMiddleName);
      setOriginalLastName(formattedLastName);
      setOriginalPhone(formattedPhone);
      setPhone(formattedPhone); // Update the display value to formatted version

      // Clear password fields to prevent unsaved changes warning
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      // Set flag to indicate changes were just saved
      justSavedRef.current = true;

      // Show success modal
      setSuccessMessage("Your profile has been updated");
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        // Auto-navigate back to UserProfile after success
        navigation.navigate("UserProfile");
      }, 2000);
    } catch (error) {
      console.error("Error saving profile:", error);
      Alert.alert("Error", "Failed to save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const cancelSaveProfile = () => {
    setShowSaveConfirmModal(false);
  };

  const cancelSavePassword = () => {
    setShowPasswordConfirmModal(false);
  };

  const closePasswordErrorModal = () => {
    setShowPasswordErrorModal(false);
    setPasswordErrorMessage("Close");
  };

  // Validate new password in real-time
  const validateNewPassword = (password, currentPwd = "") => {
    if (!password) {
      setNewPasswordError("");
      setConfirmPasswordError("");
      return;
    }

    let error = "";

    // Check if new password equals current password (run this check first)
    if (currentPwd && password === currentPwd) {
      error = "New password must be different from your current password";
    }
    // Check length
    else if (password.length < 8) {
      error = "Minimum 8 characters required";
    } else if (password.length > 20) {
      error = "Maximum 20 characters allowed";
    }
    // Check for uppercase
    else if (!/[A-Z]/.test(password)) {
      error = "At least 1 uppercase letter required";
    }
    // Check for lowercase
    else if (!/[a-z]/.test(password)) {
      error = "At least 1 lowercase letter required";
    }
    // Check for number
    else if (!/\d/.test(password)) {
      error = "At least 1 number required";
    }
    // Check for special character
    else if (!/[!@#$%^&*]/.test(password)) {
      error = "At least 1 special character required (!@#$%^&*)";
    }

    setNewPasswordError(error);

    // If new password is valid and confirm password exists, check match
    if (!error && confirmPassword) {
      if (password !== confirmPassword) {
        setConfirmPasswordError("Passwords do not match");
      } else {
        setConfirmPasswordError("");
      }
    }
  };

  // Validate confirm password in real-time
  const validateConfirmPassword = (password) => {
    if (!password) {
      setConfirmPasswordError("");
      return;
    }

    if (password !== newPassword) {
      setConfirmPasswordError("Passwords do not match");
    } else {
      setConfirmPasswordError("");
    }
  };

  const handleSavePassword = () => {
    // Password validation
    if (!currentPassword) {
      setPasswordErrorMessage("Please enter your current password");
      setShowPasswordErrorModal(true);
      return;
    }
    if (!newPassword) {
      setPasswordErrorMessage("Please enter a new password");
      setShowPasswordErrorModal(true);
      return;
    }
    if (!confirmPassword) {
      setPasswordErrorMessage("Please confirm your new password");
      setShowPasswordErrorModal(true);
      return;
    }

    // Check for inline validation errors
    if (newPasswordError || confirmPasswordError) {
      setPasswordErrorMessage("Please fix password errors before saving");
      setShowPasswordErrorModal(true);
      return;
    }

    // Validate current password before showing confirmation modal
    validateCurrentPassword();
  };

  const validateCurrentPassword = async () => {
    // Skip validation for admin
    if (isAdmin) {
      setShowPasswordConfirmModal(true);
      return;
    }

    setSaving(true);

    try {
      const currentUser = auth.currentUser;

      if (!currentUser) {
        setPasswordErrorMessage("No user logged in");
        setShowPasswordErrorModal(true);
        setSaving(false);
        return;
      }

      // Try to reauthenticate with current password
      const credential = EmailAuthProvider.credential(
        currentUser.email,
        currentPassword,
      );
      await reauthenticateWithCredential(currentUser, credential);

      // If successful, show confirmation modal
      setSaving(false);
      setShowPasswordConfirmModal(true);
    } catch (error) {
      setSaving(false);
      console.error("Current password validation error:", error);

      if (
        error.code === "auth/wrong-password" ||
        error.code === "auth/invalid-credential"
      ) {
        setPasswordErrorMessage("Current password is incorrect");
      } else if (error.code === "auth/too-many-requests") {
        setPasswordErrorMessage(
          "Too many failed attempts. Please try again later",
        );
      } else {
        setPasswordErrorMessage(
          "Failed to verify current password. Please try again",
        );
      }
      setShowPasswordErrorModal(true);
    }
  };

  const confirmSavePassword = async () => {
    setShowPasswordConfirmModal(false);
    setSaving(true);

    try {
      // Admin bypass - just show success
      if (isAdmin) {
        Alert.alert("Success", "Password updated successfully!");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setSaving(false);
        return;
      }

      const currentUser = auth.currentUser;

      if (!currentUser) {
        Alert.alert("Error", "No user logged in");
        setSaving(false);
        return;
      }

      // Update password (already authenticated in validateCurrentPassword)
      try {
        await updatePassword(currentUser, newPassword);
        console.log("✅ Password updated successfully");

        // Log activity to activity_logs/editProfile/passwordChange
        try {
          await addDoc(
            collection(db, "activity_logs", "editProfile", "passwordChange"),
            {
              userId: currentUser.uid,
              action: "Password changed",
              description: "User successfully changed their password",
              timestamp: serverTimestamp(),
              deviceInfo: Platform.OS,
              firstName: firstName,
              lastName: lastName,
            },
          );
          console.log("✅ Password change activity logged successfully");
        } catch (logError) {
          console.error("⚠️ Failed to log password change activity:", logError);
          // Don't block the flow if logging fails
        }

        // Clear password fields
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");

        // Set flag to indicate changes were just saved
        justSavedRef.current = true;

        // Show success modal
        setSuccessMessage("You successfully changed your password");
        setShowSuccess(true);
        setTimeout(() => {
          setShowSuccess(false);
          // Navigate back to previous screen after password update
          navigation.goBack();
        }, 2000);
      } catch (passwordError) {
        console.error("Password update error:", passwordError);
        Alert.alert("Error", "Failed to update password. Please try again.");
        setSaving(false);
        return;
      }
    } catch (error) {
      console.error("Error updating password:", error);
      Alert.alert("Error", "Failed to update password. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDiscardChanges = () => {
    setShowUnsavedModal(false);
    // Set flag to allow navigation
    setCanExit(true);

    // Use setTimeout to ensure state is updated before navigating
    setTimeout(() => {
      if (navigationActionRef.current) {
        navigation.dispatch(navigationActionRef.current);
      } else {
        navigation.goBack();
      }
    }, 100);
  };

  const handleCancelDiscard = () => {
    setShowUnsavedModal(false);
  };

  const handleBackPress = () => {
    const hasProfileChanges =
      firstName !== originalFirstName ||
      middleName !== originalMiddleName ||
      lastName !== originalLastName ||
      phone !== originalPhone;
    const hasPasswordChanges =
      currentPassword || newPassword || confirmPassword;

    if (hasProfileChanges || hasPasswordChanges) {
      setShowUnsavedModal(true);
    } else {
      navigation.goBack();
    }
  };

  if (loading) {
    return (
      <View
        style={[
          styles.scrollContainer,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <ActivityIndicator size="large" color="#1D3B71" />
        <Text style={{ marginTop: 10, color: "#1D3B71" }}>
          Loading profile...
        </Text>
      </View>
    );
  }

  return (
    <>
      {/* SAVE CONFIRMATION MODAL */}
      <Modal visible={showSaveConfirmModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Ionicons
              name="checkmark-circle-outline"
              size={60}
              color="#22C55E"
            />

            <Text style={styles.modalTitle}>Save Changes</Text>
            <Text style={styles.modalMessage}>
              Are you sure you want to save the changes?
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={cancelSaveProfile}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={confirmSaveProfile}
              >
                <Text style={styles.confirmButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* PASSWORD ERROR MODAL */}
      <Modal visible={showPasswordErrorModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Ionicons name="alert-circle-outline" size={60} color="#D32F2F" />

            <Text style={styles.modalTitle}>Validation Error</Text>
            <Text style={styles.modalMessage}>{passwordErrorMessage}</Text>

            <TouchableOpacity
              style={styles.singleModalButton}
              onPress={closePasswordErrorModal}
            >
              <Text style={styles.confirmButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* PASSWORD SAVE CONFIRMATION MODAL */}
      <Modal
        visible={showPasswordConfirmModal}
        transparent
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Ionicons name="lock-closed-outline" size={60} color="#1D3B71" />

            <Text style={styles.modalTitle}>Save Password</Text>
            <Text style={styles.modalMessage}>
              Are you sure you want to change your password?
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={cancelSavePassword}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={confirmSavePassword}
              >
                <Text style={styles.confirmButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* UNSAVED CHANGES MODAL */}
      <Modal visible={showUnsavedModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Ionicons name="warning-outline" size={60} color="#FF9800" />

            <Text style={styles.modalTitle}>Unsaved Changes</Text>
            <Text style={styles.modalMessage}>
              There are unsaved changes. Are you sure you want to close this
              page?
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={handleCancelDiscard}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.discardButton]}
                onPress={handleDiscardChanges}
              >
                <Text style={styles.discardButtonText}>Discard</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* SUCCESS POPUP MODAL */}
      <Modal visible={showSuccess} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Image
              source={{
                uri: "https://img.icons8.com/color/96/checked--v1.png",
              }}
              style={styles.icon}
            />

            <Text style={styles.successTitle}>Changes Saved Successfully!</Text>
            <Text style={styles.successSubtitle}>{successMessage}</Text>
          </View>
        </View>
      </Modal>

      {/* MAIN SCREEN */}
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: "#fff" }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          {/* Back Button */}
          <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
            <Ionicons name="arrow-back" size={28} color="#1D3B71" />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>

          <View style={styles.centerContent}>
            {/* Profile Icon */}
            <View style={styles.profileContainer}>
              <View style={styles.profileCircle}>
                <Ionicons name="person" size={80} color="#1D3B71" />
              </View>
              <Text style={styles.name}>
                {[originalFirstName, originalLastName]
                  .filter((name) => name)
                  .join(" ") || "User"}
              </Text>
              <Text style={styles.subtitle}>Edit Profile</Text>
            </View>

            {/* First Name */}
            <View style={styles.labelContainer}>
              <Text style={styles.label}>First Name</Text>
              <Text style={styles.requiredAsterisk}>*</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Enter first name"
              value={firstName}
              maxLength={20}
              onChangeText={(text) => {
                setFirstName(text);
                validateFirstName(text);
              }}
            />
            {firstNameError ? (
              <Text style={styles.errorText}>{firstNameError}</Text>
            ) : null}

            {/* Middle Name */}
            <Text style={styles.label}>Middle Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter middle name"
              value={middleName}
              maxLength={20}
              onChangeText={(text) => {
                setMiddleName(text);
                validateMiddleName(text);
              }}
            />
            {middleNameError ? (
              <Text style={styles.errorText}>{middleNameError}</Text>
            ) : null}

            {/* Last Name */}
            <View style={styles.labelContainer}>
              <Text style={styles.label}>Last Name</Text>
              <Text style={styles.requiredAsterisk}>*</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Enter last name"
              value={lastName}
              maxLength={20}
              onChangeText={(text) => {
                setLastName(text);
                validateLastName(text);
              }}
            />
            {lastNameError ? (
              <Text style={styles.errorText}>{lastNameError}</Text>
            ) : null}

            {/* Email */}
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={[styles.input, styles.disabledInput]}
              placeholder="Email"
              value={email}
              editable={false}
            />

            {/* Phone Number */}
            <View style={styles.labelContainer}>
              <Text style={styles.label}>Phone Number</Text>
              <Text style={styles.requiredAsterisk}>*</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="09123456789"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={(text) => {
                // Remove any non-numeric characters
                let cleanText = text.replace(/[^0-9]/g, "");

                // Limit to 11 digits (09XXXXXXXXX)
                if (cleanText.length <= 11) {
                  setPhone(cleanText);
                }
              }}
              maxLength={11}
            />

            {/* Save Changes Button */}
            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleSaveProfile}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>Save Changes</Text>
              )}
            </TouchableOpacity>

            {/* Divider for password section */}
            <View style={styles.divider}>
              <Text style={styles.dividerText}>Change Password (Optional)</Text>
            </View>

            {/* Current Password */}
            <Text style={styles.label}>Current Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Enter current password"
                secureTextEntry={!showCurrentPassword}
                value={currentPassword}
                onChangeText={setCurrentPassword}
              />
              <TouchableOpacity
                onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                style={styles.eyeIcon}
              >
                <Ionicons
                  name={showCurrentPassword ? "eye-off-outline" : "eye-outline"}
                  size={22}
                  color="#444"
                />
              </TouchableOpacity>
            </View>

            {/* New Password */}
            <Text style={styles.label}>New Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Enter new password"
                secureTextEntry={!showPassword}
                value={newPassword}
                onChangeText={(text) => {
                  setNewPassword(text);
                  validateNewPassword(text, currentPassword);
                }}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeIcon}
              >
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={22}
                  color="#444"
                />
              </TouchableOpacity>
            </View>
            {newPasswordError ? (
              <Text style={styles.errorText}>{newPasswordError}</Text>
            ) : null}

            {/* Confirm Password */}
            <Text style={styles.label}>Confirm New Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Confirm new password"
                secureTextEntry={!showConfirmPassword}
                value={confirmPassword}
                onChangeText={(text) => {
                  setConfirmPassword(text);
                  validateConfirmPassword(text);
                }}
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                style={styles.eyeIcon}
              >
                <Ionicons
                  name={showConfirmPassword ? "eye-off-outline" : "eye-outline"}
                  size={22}
                  color="#444"
                />
              </TouchableOpacity>
            </View>
            {confirmPasswordError ? (
              <Text style={styles.errorText}>{confirmPasswordError}</Text>
            ) : null}

            {/* Save Password Button */}
            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleSavePassword}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>Save Password</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 40,
  },
  backButton: {
    flexDirection: "row",
    marginBottom: 20,
    marginTop: 10,
    alignItems: "center",
  },
  backText: {
    fontSize: 18,
    color: "#1D3B71",
    marginLeft: 5,
  },
  centerContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
  profileContainer: {
    alignItems: "center",
    marginBottom: 30,
    width: "100%",
  },
  profileCircle: {
    borderWidth: 3,
    borderColor: "#1D3B71",
    width: 130,
    height: 130,
    borderRadius: 100,
    justifyContent: "center",
    alignItems: "center",
  },
  name: {
    fontSize: 28,
    fontWeight: "bold",
    marginTop: 9,
    color: "#000",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#555",
    marginTop: 5,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
  },
  labelContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 5,
  },
  requiredAsterisk: {
    fontSize: 16,
    fontWeight: "600",
    color: "#D32F2F",
    marginLeft: 3,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    padding: 12,
    fontSize: 16,
    marginBottom: 15,
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    marginBottom: 15,
    paddingRight: 45,
  },
  passwordInput: {
    flex: 1,
    padding: 12,
    fontSize: 16,
  },
  eyeIcon: {
    position: "absolute",
    right: 10,
  },
  saveButton: {
    backgroundColor: "#1D3B71",
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  disabledInput: {
    backgroundColor: "#f0f0f0",
    color: "#888",
  },
  divider: {
    marginTop: 20,
    marginBottom: 15,
    borderTopWidth: 1,
    borderTopColor: "#ddd",
    paddingTop: 15,
  },
  dividerText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1D3B71",
  },
  errorText: {
    color: "#D32F2F",
    fontSize: 13,
    fontWeight: "400",
    marginTop: -10,
    marginBottom: 15,
  },

  // MODAL STYLES
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    width: "90%",
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 30,
    alignItems: "center",
  },
  // Removed successIconContainer as per LoginSuccess.js styling
  icon: {
    width: 80,
    height: 80,
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#2E7D32",
    marginBottom: 10,
    textAlign: "center",
  },
  successSubtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#333",
    marginTop: 15,
    marginBottom: 10,
  },
  modalMessage: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 25,
    lineHeight: 22,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    gap: 10,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#f0f0f0",
    borderWidth: 1,
    borderColor: "#ddd",
  },
  cancelButtonText: {
    color: "#333",
    fontSize: 16,
    fontWeight: "600",
  },
  discardButton: {
    backgroundColor: "#D32F2F",
  },
  discardButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  confirmButton: {
    backgroundColor: "#22C55E",
  },
  confirmButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  singleModalButton: {
    width: "100%",
    backgroundColor: "#1D3B71",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
  },
});
