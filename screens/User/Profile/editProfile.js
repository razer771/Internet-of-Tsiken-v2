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
  Keyboard,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { auth, db } from "../../../config/firebaseconfig";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import {
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function EditProfile({ navigation }) {
  // State hooks
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showPasswordError, setShowPasswordError] = useState(false);
  const [passwordErrorMsg, setPasswordErrorMsg] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [newPasswordError, setNewPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [firstNameError, setFirstNameError] = useState("");
  const [middleNameError, setMiddleNameError] = useState("");
  const [lastNameError, setLastNameError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [passwordValidations, setPasswordValidations] = useState({
    minLength: false,
    maxLength: true,
    upper: false,
    lower: false,
    number: false,
    special: false,
  });

  useEffect(() => {
    fetchUserData();
  }, []);

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      "keyboardDidShow",
      () => {
        navigation.setOptions({
          tabBarStyle: { display: "none" },
        });
      }
    );

    const keyboardDidHideListener = Keyboard.addListener(
      "keyboardDidHide",
      () => {
        navigation.setOptions({
          tabBarStyle: {
            display: "flex",
            backgroundColor: "#1D3B71",
            borderTopWidth: 0,
            elevation: 10,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            height: 60,
          },
        });
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, [navigation]);

  const validateName = (name) => {
    if (!name.trim()) return "This field is required.";
    if (name.length < 2) return "Must be at least 2 characters.";
    if (name.length > 20) return "Must not exceed 20 characters.";
    const nameRegex = /^[a-zA-Z. ]+$/;
    if (!nameRegex.test(name))
      return "Only letters, spaces, and periods allowed.";
    return "";
  };

  const validatePhone = (phone) => {
    if (!phone.trim()) return "Phone number is required.";
    if (!phone.startsWith("+639")) return "Must start with +639.";
    if (phone.length !== 13)
      return "Must be exactly 13 characters (including +639).";
    const phoneRegex = /^\+639\d{9}$/;
    if (!phoneRegex.test(phone)) return "Invalid phone number format.";
    return "";
  };

  const fetchUserData = async () => {
    try {
      const isAdminBypass = await AsyncStorage.getItem("isAdminBypass");
      const adminEmail = await AsyncStorage.getItem("adminEmail");

      if (isAdminBypass === "true" && adminEmail === "admin@example.com") {
        setIsAdmin(true);
        setFirstName("Admin");
        setMiddleName("");
        setLastName("User");
        setEmail("admin@example.com");
        setPhone("+639");
        setLoading(false);
        return;
      }

      const currentUser = auth.currentUser;
      if (currentUser) {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setFirstName(userData.firstName || "");
          setMiddleName(userData.middleName || "");
          setLastName(userData.lastName || "");
          setEmail(userData.email || "");
          setPhone(userData.phone || userData.mobile || "");
        }
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
    } finally {
      setLoading(false);
    }
  };

  async function handleSave() {
    // Validate all fields
    const firstNameValidation = validateName(firstName);
    const lastNameValidation = validateName(lastName);
    const middleNameValidation = middleName ? validateName(middleName) : "";
    const phoneValidation = validatePhone(phone);

    setFirstNameError(firstNameValidation);
    setLastNameError(lastNameValidation);
    setMiddleNameError(middleNameValidation);
    setPhoneError(phoneValidation);

    if (
      firstNameValidation ||
      lastNameValidation ||
      middleNameValidation ||
      phoneValidation
    ) {
      return;
    }

    if (newPassword || confirmPassword) {
      if (!currentPassword) {
        setPasswordErrorMsg("Please input your current password to proceed.");
        setShowPasswordError(true);
        return;
      }

      if (newPassword === currentPassword) {
        setPasswordErrorMsg(
          "New password cannot be the same as your current password."
        );
        setShowPasswordError(true);
        return;
      }

      if (newPassword !== confirmPassword) {
        setPasswordErrorMsg("New passwords do not match.");
        setShowPasswordError(true);
        return;
      }

      if (
        !passwordValidations.minLength ||
        !passwordValidations.maxLength ||
        !passwordValidations.upper ||
        !passwordValidations.lower ||
        !passwordValidations.number ||
        !passwordValidations.special
      ) {
        setPasswordErrorMsg("New password does not meet all requirements.");
        setShowPasswordError(true);
        return;
      }
    }

    setSaving(true);
    try {
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

      const fullNameCombined = middleName.trim()
        ? `${firstName.trim()} ${middleName.trim()} ${lastName.trim()}`
        : `${firstName.trim()} ${lastName.trim()}`;

      await updateDoc(doc(db, "users", currentUser.uid), {
        firstName: firstName.trim(),
        middleName: middleName.trim(),
        lastName: lastName.trim(),
        fullname: fullNameCombined,
        displayName: fullNameCombined,
        phone: phone.trim(),
        mobile: phone.trim(),
        updatedAt: new Date(),
      });

      if (newPassword && currentPassword) {
        try {
          const credential = EmailAuthProvider.credential(
            currentUser.email,
            currentPassword
          );
          await reauthenticateWithCredential(currentUser, credential);
          await updatePassword(currentUser, newPassword);
          console.log("✅ Password updated successfully");
        } catch (passwordError) {
          console.error("Password update error:", passwordError);
          if (passwordError.code === "auth/wrong-password") {
            setPasswordErrorMsg("Current password is incorrect.");
            setShowPasswordError(true);
          } else {
            setPasswordErrorMsg(
              "Incorrect current password. Failed to update new password."
            );
            setShowPasswordError(true);
          }
          setSaving(false);
          return;
        }
      }

      console.log("✅ Profile updated successfully");

      try {
        await addDoc(collection(db, "session_logs"), {
          userId: currentUser.uid,
          action: "Updated profile",
          description: "Account details updated",
          timestamp: serverTimestamp(),
          deviceInfo: Platform.OS,
          email: currentUser.email,
        });
        console.log("📝 Profile update logged to session_logs");
      } catch (logError) {
        console.log(
          "⚠️ Failed to log profile update (non-critical):",
          logError.message
        );
      }

      setShowSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

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
  }

  if (loading) {
    return (
      <View style={{ flex: 1 }}>
        <Modal visible={showPasswordError} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Image
                source={{
                  uri: "https://img.icons8.com/color/96/high-priority.png",
                }}
                style={styles.icon}
              />
              <Text style={[styles.successTitle, { color: "#c41e3a" }]}>
                Incorrect Password
              </Text>
              <Text style={styles.successSubtitle}>{passwordErrorMsg}</Text>
              <TouchableOpacity
                style={{ marginTop: 18 }}
                onPress={() => setShowPasswordError(false)}
              >
                <Text
                  style={{ color: "#1D3B71", fontWeight: "bold", fontSize: 16 }}
                >
                  OK
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal visible={showSuccess} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Image
                source={{
                  uri: "https://img.icons8.com/color/96/checked--v1.png",
                }}
                style={styles.icon}
              />
              <Text style={styles.successTitle}>Profile changes saved!</Text>
              <Text style={styles.successSubtitle}>
                Redirecting to User Profile...
              </Text>
            </View>
          </View>
        </Modal>

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
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Modal visible={showPasswordError} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Image
              source={{
                uri: "https://img.icons8.com/color/96/high-priority.png",
              }}
              style={styles.icon}
            />
            <Text style={[styles.successTitle, { color: "#c41e3a" }]}>
              Password Error
            </Text>
            <Text style={styles.successSubtitle}>{passwordErrorMsg}</Text>
            <TouchableOpacity
              style={{ marginTop: 18 }}
              onPress={() => setShowPasswordError(false)}
            >
              <Text
                style={{ color: "#1D3B71", fontWeight: "bold", fontSize: 16 }}
              >
                OK
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showSuccess} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Image
              source={{
                uri: "https://img.icons8.com/color/96/checked--v1.png",
              }}
              style={styles.icon}
            />
            <Text style={styles.successTitle}>Profile changes saved!</Text>
            <Text style={styles.successSubtitle}>
              Redirecting to User Profile...
            </Text>
          </View>
        </View>
      </Modal>

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={28} color="#1D3B71" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <View style={styles.centerContent}>
          <View style={styles.profileContainer}>
            <View style={styles.profileCircle}>
              <Ionicons name="person" size={50} color="#1D3B71" />
            </View>
            <Text style={[styles.name, { textAlign: "center" }]}>
              {middleName
                ? `${firstName} ${middleName} ${lastName}`.trim()
                : `${firstName} ${lastName}`.trim() || "User"}
            </Text>
            <Text style={styles.subtitle}>Edit Profile</Text>
          </View>

          <Text style={styles.label}>First Name</Text>
          <TextInput
            style={[styles.input, firstNameError && styles.inputError]}
            placeholder="Enter first name"
            value={firstName}
            onChangeText={(text) => {
              setFirstName(text);
              setFirstNameError(validateName(text));
            }}
          />
          {firstNameError ? (
            <Text style={styles.errorText}>{firstNameError}</Text>
          ) : null}

          <Text style={styles.label}>Middle Name (Optional)</Text>
          <TextInput
            style={[styles.input, middleNameError && styles.inputError]}
            placeholder="Enter middle name"
            value={middleName}
            onChangeText={(text) => {
              setMiddleName(text);
              if (text) {
                setMiddleNameError(validateName(text));
              } else {
                setMiddleNameError("");
              }
            }}
          />
          {middleNameError ? (
            <Text style={styles.errorText}>{middleNameError}</Text>
          ) : null}

          <Text style={styles.label}>Last Name</Text>
          <TextInput
            style={[styles.input, lastNameError && styles.inputError]}
            placeholder="Enter last name"
            value={lastName}
            onChangeText={(text) => {
              setLastName(text);
              setLastNameError(validateName(text));
            }}
          />
          {lastNameError ? (
            <Text style={styles.errorText}>{lastNameError}</Text>
          ) : null}

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={[styles.input, styles.disabledInput]}
            placeholder="Email"
            value={email}
            editable={false}
          />

          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            style={[styles.input, phoneError && styles.inputError]}
            placeholder="+639XXXXXXXXX"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={(text) => {
              setPhone(text);
              setPhoneError(validatePhone(text));
            }}
          />
          {phoneError ? (
            <Text style={styles.errorText}>{phoneError}</Text>
          ) : null}

          <View style={styles.divider}>
            <Text style={styles.dividerText}>Change Password (Optional)</Text>
          </View>

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

          <Text style={styles.label}>New Password</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Enter new password"
              secureTextEntry={!showPassword}
              value={newPassword}
              onChangeText={(text) => {
                setNewPassword(text);
                const validations = {
                  minLength: text.length >= 6,
                  maxLength: text.length <= 20,
                  upper: /[A-Z]/.test(text),
                  lower: /[a-z]/.test(text),
                  number: /[0-9]/.test(text),
                  special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(text),
                };
                setPasswordValidations(validations);
                let errorMsg = "";
                if (!validations.minLength) errorMsg = "Minimum 6 characters.";
                else if (!validations.maxLength)
                  errorMsg = "Maximum 20 characters.";
                else if (!validations.upper)
                  errorMsg = "At least one uppercase letter.";
                else if (!validations.lower)
                  errorMsg = "At least one lowercase letter.";
                else if (!validations.number) errorMsg = "At least one number.";
                else if (!validations.special)
                  errorMsg = "At least one special character.";
                setNewPasswordError(errorMsg);
                if (confirmPassword && text !== confirmPassword) {
                  setConfirmPasswordError("Passwords do not match.");
                } else {
                  setConfirmPasswordError("");
                }
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
            <Text style={{ color: "#c41e3a", marginLeft: 4, marginBottom: 8 }}>
              {newPasswordError}
            </Text>
          ) : null}

          <Text style={styles.label}>Confirm New Password</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Confirm new password"
              secureTextEntry={!showConfirmPassword}
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                if (newPassword && text !== newPassword) {
                  setConfirmPasswordError("Passwords do not match.");
                } else {
                  setConfirmPasswordError("");
                }
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
            <Text style={{ color: "#c41e3a", marginLeft: 4, marginBottom: 8 }}>
              {confirmPasswordError}
            </Text>
          ) : null}

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
    </View>
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
    width: 100,
    height: 100,
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
  inputError: {
    borderColor: "#c41e3a",
    borderWidth: 1,
  },
  errorText: {
    color: "#c41e3a",
    fontSize: 13,
    marginTop: -10,
    marginBottom: 10,
    marginLeft: 4,
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
});
