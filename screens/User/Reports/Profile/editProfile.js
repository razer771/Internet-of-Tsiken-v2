import React, { useState, useEffect } from "react";
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
import { auth, db } from "../../../../config/firebaseconfig";
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
  const [role, setRole] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Success popup state
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    fetchUserData();
  }, []);

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
        setRole("Admin");
        setLoading(false);
        return;
      }

      const currentUser = auth.currentUser;
      
      if (currentUser) {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        
        if (userDoc.exists()) {
          const data = userDoc.data();
          setFullname(data.fullname || data.name || "");
          setEmail(data.email || currentUser.email || "");
          setPhone(data.phone || "");
          setRole(data.role || "User");
        } else {
          setEmail(currentUser.email || "");
          setRole("User");
        }
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
      Alert.alert("Error", "Failed to load profile data");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    // Validation
    if (!fullname.trim()) {
      Alert.alert("Error", "Please enter your name");
      return;
    }

    if (!phone.trim()) {
      Alert.alert("Error", "Please enter your phone number");
      return;
    }

    // Password validation if user wants to change password
    if (newPassword || confirmPassword) {
      if (!currentPassword) {
        Alert.alert("Error", "Please enter your current password to change password");
        return;
      }
      if (newPassword !== confirmPassword) {
        Alert.alert("Error", "New passwords do not match");
        return;
      }
      if (newPassword.length < 6) {
        Alert.alert("Error", "Password must be at least 6 characters");
        return;
      }
    }

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
        role: role,
        updatedAt: new Date(),
      });

      // Update password if provided
      if (newPassword && currentPassword) {
        try {
          // Re-authenticate user before changing password
          const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
          await reauthenticateWithCredential(currentUser, credential);
          await updatePassword(currentUser, newPassword);
          console.log("✅ Password updated successfully");
        } catch (passwordError) {
          console.error("Password update error:", passwordError);
          if (passwordError.code === 'auth/wrong-password') {
            Alert.alert("Error", "Current password is incorrect");
          } else {
            Alert.alert("Error", "Failed to update password. Please try again.");
          }
          setSaving(false);
          return;
        }
      }

      console.log("✅ Profile updated successfully");
      setShowSuccess(true);

      // Clear password fields
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      // Auto redirect after 2 seconds
      setTimeout(() => {
        setShowSuccess(false);
        navigation.navigate("UserProfile");
      }, 2000);

    } catch (error) {
      console.error("Error saving profile:", error);
      Alert.alert("Error", "Failed to save changes. Please try again.");
    } finally {
      setSaving(false);
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
      {/* SUCCESS POPUP MODAL */}
      <Modal visible={showSuccess} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Image source={{ uri: 'https://img.icons8.com/color/96/checked--v1.png' }} style={styles.icon} />

            <Text style={styles.successTitle}>Profile changes saved!</Text>
            <Text style={styles.successSubtitle}>Redirecting to User Profile...</Text>
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
            onPress={() => navigation.goBack()}
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
              <Text style={styles.name}>{fullname || "User"}</Text>
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

            {/* Role */}
            <Text style={styles.label}>Role</Text>
            <TextInput 
              style={[styles.input, styles.disabledInput]} 
              placeholder="Role"
              value={role}
              editable={false}
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
              placeholder="Enter phone number"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />

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

            {/* Save Button */}
            <TouchableOpacity 
              style={[styles.saveButton, saving && styles.saveButtonDisabled]} 
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>Save Changes</Text>
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
});
