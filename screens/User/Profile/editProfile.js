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
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function EditProfile({ navigation }) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Form fields
  const [fullname, setFullname] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Original values for change detection
  const [originalFullname, setOriginalFullname] = useState("");
  const [originalPhone, setOriginalPhone] = useState("");

  // Success popup state
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("Your profile has been updated");
  
  // Unsaved changes modal state
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [canExit, setCanExit] = useState(false);
  const navigationActionRef = useRef(null);
  const justSavedRef = useRef(false);
  
  // Save confirmation modal state
  const [showSaveConfirmModal, setShowSaveConfirmModal] = useState(false);
  const [showPasswordConfirmModal, setShowPasswordConfirmModal] = useState(false);
  const [showPasswordErrorModal, setShowPasswordErrorModal] = useState(false);
  const [passwordErrorMessage, setPasswordErrorMessage] = useState("");

  useEffect(() => {
    fetchUserData();
  }, []);

  // Reset canExit flag when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setCanExit(false);
      justSavedRef.current = false;
    });
    
    return unsubscribe;
  }, [navigation]);

  // Prevent navigation if there are unsaved changes
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      // If canExit is true or just saved, allow navigation
      if (canExit || justSavedRef.current) {
        return;
      }

      // Check if there are unsaved changes
      const hasProfileChanges = fullname !== originalFullname || phone !== originalPhone;
      const hasPasswordChanges = currentPassword || newPassword || confirmPassword;
      
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
  }, [navigation, fullname, phone, originalFullname, originalPhone, currentPassword, newPassword, confirmPassword, canExit]);

  const fetchUserData = async () => {
    try {
      // Check if admin bypass
      const isAdminBypass = await AsyncStorage.getItem('isAdminBypass');
      const adminEmail = await AsyncStorage.getItem('adminEmail');
      
      if (isAdminBypass === 'true' && adminEmail === 'admin@example.com') {
        setIsAdmin(true);
        setFullname("Admin");
        setEmail("admin@example.com");
        setPhone("");
        setOriginalFullname("Admin");
        setOriginalPhone("");
        setLoading(false);
        return;
      }

      const currentUser = auth.currentUser;
      
      if (currentUser) {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        
        if (userDoc.exists()) {
          const data = userDoc.data();
          const fetchedFullname = data.fullname || data.name || "";
          const fetchedPhone = data.phone || "";
          
          setFullname(fetchedFullname);
          setEmail(data.email || currentUser.email || "");
          setPhone(fetchedPhone);
          
          // Store original values
          setOriginalFullname(fetchedFullname);
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

  const handleSaveProfile = () => {
    // Validation
    if (!fullname.trim()) {
      Alert.alert("Error", "Please enter your name");
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

      // Update Firestore profile
      await updateDoc(doc(db, "users", currentUser.uid), {
        fullname: fullname.trim(),
        phone: phone.trim(),
        updatedAt: new Date(),
      });

      console.log("✅ Profile updated successfully");
      
      // Update original values to reflect saved changes
      setOriginalFullname(fullname.trim());
      setOriginalPhone(phone.trim());
      
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
    if (newPassword !== confirmPassword) {
      setPasswordErrorMessage("New passwords do not match");
      setShowPasswordErrorModal(true);
      return;
    }
    if (newPassword.length < 8) {
      setPasswordErrorMessage("Password must be at least 8 characters");
      setShowPasswordErrorModal(true);
      return;
    }
    
    // Check for at least one number
    if (!/\d/.test(newPassword)) {
      setPasswordErrorMessage("Password must contain at least one number");
      setShowPasswordErrorModal(true);
      return;
    }
    
    // Check for at least one special character
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword)) {
      setPasswordErrorMessage("Password must contain at least one special character (!@#$%^&*...)");
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
      const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
      await reauthenticateWithCredential(currentUser, credential);
      
      // If successful, show confirmation modal
      setSaving(false);
      setShowPasswordConfirmModal(true);
    } catch (error) {
      setSaving(false);
      console.error("Current password validation error:", error);
      
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        setPasswordErrorMessage("Current password is incorrect");
      } else if (error.code === 'auth/too-many-requests') {
        setPasswordErrorMessage("Too many failed attempts. Please try again later");
      } else {
        setPasswordErrorMessage("Failed to verify current password. Please try again");
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
    const hasProfileChanges = fullname !== originalFullname || phone !== originalPhone;
    const hasPasswordChanges = currentPassword || newPassword || confirmPassword;
    
    if (hasProfileChanges || hasPasswordChanges) {
      setShowUnsavedModal(true);
    } else {
      navigation.goBack();
    }
  };

  if (loading) {
    return (
      <View style={[styles.scrollContainer, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#1D3B71" />
        <Text style={{ marginTop: 10, color: "#1D3B71" }}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <>
      {/* SAVE CONFIRMATION MODAL */}
      <Modal visible={showSaveConfirmModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Ionicons name="checkmark-circle-outline" size={60} color="#1D3B71" />
            
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
            <Text style={styles.modalMessage}>
              {passwordErrorMessage}
            </Text>
            
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
      <Modal visible={showPasswordConfirmModal} transparent animationType="fade">
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
              There are unsaved changes. Are you sure you want to close this page?
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
            <Image source={{ uri: 'https://img.icons8.com/color/96/checked--v1.png' }} style={styles.icon} />

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
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBackPress}
          >
            <Ionicons name="arrow-back" size={28} color="#1D3B71" />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>

          <View style={styles.centerContent}>
            {/* Profile Icon */}
            <View style={styles.profileContainer}>
              <View style={styles.profileCircle}>
                <Ionicons name="person" size={80} color="#1D3B71" />
              </View>
              <Text style={styles.name}>{originalFullname || "User"}</Text>
              <Text style={styles.subtitle}>Edit Profile</Text>
            </View>

            {/* Full Name */}
            <Text style={styles.label}>Full Name</Text>
            <TextInput 
              style={styles.input} 
              placeholder="Enter full name"
              value={fullname}
              onChangeText={setFullname}
            />

            {/* Email */}
            <Text style={styles.label}>Email</Text>
            <TextInput 
              style={[styles.input, styles.disabledInput]} 
              placeholder="Email"
              value={email}
              editable={false}
            />

            {/* Phone Number */}
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              placeholder="+639123456789"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={(text) => {
                // Remove any non-numeric characters except +
                let cleanText = text.replace(/[^0-9+]/g, '');
                
                // If starts with 0, replace with +63
                if (cleanText.startsWith('0')) {
                  cleanText = '+63' + cleanText.substring(1);
                }
                
                // If doesn't start with +63, add it
                if (!cleanText.startsWith('+63') && cleanText.length > 0 && !cleanText.startsWith('+')) {
                  cleanText = '+63' + cleanText;
                }
                
                // Limit to +63 + 10 digits = 13 characters
                if (cleanText.length <= 13) {
                  setPhone(cleanText);
                }
              }}
              maxLength={13}
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
                onChangeText={setNewPassword}
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

            {/* Confirm Password */}
            <Text style={styles.label}>Confirm New Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Confirm new password"
                secureTextEntry={!showConfirmPassword}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
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
  },
  subtitle: {
    fontSize: 16,
    color: "#555",
    marginTop: 5,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 5,
    color: "#000",
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
  },
  successSubtitle: {
    fontSize: 16,
    color: "#666",
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
    backgroundColor: "#1D3B71",
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
