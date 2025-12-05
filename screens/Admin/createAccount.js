import React, { useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Modal,
  ActivityIndicator,
} from "react-native";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import Header2 from "../navigation/adminHeader";
import { auth, db } from "../../config/firebaseconfig";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, collection, query, where, getDocs, serverTimestamp } from "firebase/firestore";

export default function CreateAccount({ navigation }) {
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState("");
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [pressedBtn, setPressedBtn] = useState(null);

  // Validation errors
  const [errors, setErrors] = useState({});
  
  // Success modal
  const [successVisible, setSuccessVisible] = useState(false);
  
  // Loading state
  const [loading, setLoading] = useState(false);

  const roles = ["Admin", "User"];

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateMobileNumber = (number) => {
    // Philippine mobile number format: 09XXXXXXXXX (11 digits)
    const mobileRegex = /^09\d{9}$/;
    return mobileRegex.test(number);
  };

  const validatePassword = (password) => {
    // At least 8 characters, one uppercase, one lowercase, one number
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    return passwordRegex.test(password);
  };

  const validateName = (name) => {
    // Only letters, spaces, hyphens, and apostrophes
    const nameRegex = /^[a-zA-Z\s'-]+$/;
    return nameRegex.test(name) && name.trim().length >= 2;
  };

  // Check if email already exists in Firestore
  const checkEmailExists = async (email) => {
    try {
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("email", "==", email.toLowerCase().trim()));
      const querySnapshot = await getDocs(q);
      return !querySnapshot.empty;
    } catch (error) {
      console.error("Error checking email:", error);
      return false;
    }
  };

  // Check if mobile number already exists in Firestore
  const checkMobileExists = async (mobile) => {
    try {
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("mobileNumber", "==", mobile.trim()));
      const querySnapshot = await getDocs(q);
      return !querySnapshot.empty;
    } catch (error) {
      console.error("Error checking mobile:", error);
      return false;
    }
  };

  const handleSaveChanges = async () => {
    console.log("🔍 Create Account button clicked");
    const newErrors = {};

    // First Name validation
    if (!firstName.trim()) {
      newErrors.firstName = "First name is required.";
    } else if (!validateName(firstName)) {
      newErrors.firstName = "Please enter a valid name (letters only, min 2 characters).";
    }

    // Last Name validation
    if (!lastName.trim()) {
      newErrors.lastName = "Last name is required.";
    } else if (!validateName(lastName)) {
      newErrors.lastName = "Please enter a valid name (letters only, min 2 characters).";
    }

    // Middle Name validation (optional but if provided must be valid)
    if (middleName.trim() && !validateName(middleName)) {
      newErrors.middleName = "Please enter a valid middle name (letters only).";
    }

    // Email validation
    if (!email.trim()) {
      newErrors.email = "Email is required.";
    } else if (!validateEmail(email)) {
      newErrors.email = "Please enter a valid email address.";
    }

    // Mobile Number validation
    if (!mobileNumber.trim()) {
      newErrors.mobileNumber = "Mobile number is required.";
    } else if (!validateMobileNumber(mobileNumber)) {
      newErrors.mobileNumber = "Invalid format. Use: 09XXXXXXXXX (11 digits).";
    }

    // Password validation
    if (!password) {
      newErrors.password = "Password is required.";
    } else if (!validatePassword(password)) {
      newErrors.password = "Password must be 8+ characters with uppercase, lowercase, and number.";
    }

    // Confirm Password validation
    if (!confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password.";
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords don't match.";
    }

    // Role validation
    if (!role) {
      newErrors.role = "Role is required.";
    } else if (!roles.includes(role)) {
      newErrors.role = "Please select a valid role (Admin or User).";
    }

    setErrors(newErrors);

    // If validation errors exist, stop here
    if (Object.keys(newErrors).length > 0) {
      console.log("❌ Validation failed:", newErrors);
      return;
    }

    console.log("✅ Validation passed, creating account...");

    // Start loading
    setLoading(true);

    try {
      // Check if email already exists
      const emailExists = await checkEmailExists(email);
      if (emailExists) {
        setErrors({ email: "This email is already registered." });
        setLoading(false);
        return;
      }

      // Check if mobile number already exists
      const mobileExists = await checkMobileExists(mobileNumber);
      if (mobileExists) {
        setErrors({ mobileNumber: "This mobile number is already registered." });
        setLoading(false);
        return;
      }

      // Create user account in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email.toLowerCase().trim(),
        password
      );
      const user = userCredential.user;

      // Create user document in Firestore
      await setDoc(doc(db, "users", user.uid), {
        firstName: firstName.trim(),
        middleName: middleName.trim() || "",
        lastName: lastName.trim(),
        email: email.toLowerCase().trim(),
        mobileNumber: mobileNumber.trim(),
        role: role,
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser?.email || "admin",
        verified: false,
        isVerified: false,
        accountLocked: false,
        totalAttempts: 0,
        lastLogin: null,
      });

      console.log("✅ Account created successfully:", user.uid);

      // Reset form
      setFirstName("");
      setMiddleName("");
      setLastName("");
      setEmail("");
      setMobileNumber("");
      setPassword("");
      setConfirmPassword("");
      setRole("");

      // Show success modal
      console.log("📢 Showing success modal...");
      setLoading(false);
      setSuccessVisible(true);

      // Redirect after 2.5 seconds
      setTimeout(() => {
        console.log("🔄 Redirecting to UserManagement...");
        setSuccessVisible(false);
        navigation.navigate("UserManagement");
      }, 2500);
    } catch (error) {
      console.error("Error creating account:", error);
      setLoading(false);

      // Handle specific Firebase errors
      if (error.code === "auth/email-already-in-use") {
        setErrors({ email: "This email is already registered." });
      } else if (error.code === "auth/invalid-email") {
        setErrors({ email: "Invalid email address." });
      } else if (error.code === "auth/weak-password") {
        setErrors({ password: "Password is too weak." });
      } else if (error.code === "auth/network-request-failed") {
        setErrors({ auth: "Network error. Please check your connection." });
      } else {
        setErrors({ auth: "Failed to create account. Please try again." });
      }
    }
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <Header2 showBackButton={true} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Card Container */}
          <View style={styles.card}>
            <Text style={styles.title}>Create Account</Text>

            {/* First Name */}
            <Text style={styles.label}>First Name</Text>
            <TextInput
              style={[
                styles.input,
                (focusedField === "firstName" || firstName) && styles.inputFocused,
                errors.firstName && styles.inputError
              ]}
              value={firstName}
              onChangeText={(text) => {
                // Only allow letters, spaces, hyphens, and apostrophes
                const filteredText = text.replace(/[^a-zA-Z\s'-]/g, '');
                setFirstName(filteredText);
                if (errors.firstName) {
                  setErrors({ ...errors, firstName: null });
                }
              }}
              onFocus={() => setFocusedField("firstName")}
              onBlur={() => setFocusedField(null)}
              maxLength={50}
            />
            {errors.firstName && <Text style={styles.errorText}>{errors.firstName}</Text>}

            {/* Middle Name */}
            <Text style={styles.label}>Middle Name</Text>
            <TextInput
              style={[
                styles.input,
                (focusedField === "middleName" || middleName) && styles.inputFocused
              ]}
              value={middleName}
              onChangeText={(text) => {
                // Only allow letters, spaces, hyphens, and apostrophes
                const filteredText = text.replace(/[^a-zA-Z\s'-]/g, '');
                setMiddleName(filteredText);
              }}
              onFocus={() => setFocusedField("middleName")}
              onBlur={() => setFocusedField(null)}
              maxLength={50}
            />

            {/* Last Name */}
            <Text style={styles.label}>Last Name</Text>
            <TextInput
              style={[
                styles.input,
                (focusedField === "lastName" || lastName) && styles.inputFocused,
                errors.lastName && styles.inputError
              ]}
              value={lastName}
              onChangeText={(text) => {
                // Only allow letters, spaces, hyphens, and apostrophes
                const filteredText = text.replace(/[^a-zA-Z\s'-]/g, '');
                setLastName(filteredText);
                if (errors.lastName) {
                  setErrors({ ...errors, lastName: null });
                }
              }}
              onFocus={() => setFocusedField("lastName")}
              onBlur={() => setFocusedField(null)}
              maxLength={50}
            />
            {errors.lastName && <Text style={styles.errorText}>{errors.lastName}</Text>}

            {/* Email */}
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={[
                styles.input,
                (focusedField === "email" || email) && styles.inputFocused,
                errors.email && styles.inputError
              ]}
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (errors.email) {
                  setErrors({ ...errors, email: null });
                }
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              onFocus={() => setFocusedField("email")}
              onBlur={() => setFocusedField(null)}
            />
            {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}

            {/* Mobile Number */}
            <Text style={styles.label}>Mobile Number</Text>
            <TextInput
              style={[
                styles.input,
                (focusedField === "mobileNumber" || mobileNumber) && styles.inputFocused,
                errors.mobileNumber && styles.inputError
              ]}
              value={mobileNumber}
              onChangeText={(text) => {
                // Only allow numbers and limit to 11 digits
                const filteredText = text.replace(/[^0-9]/g, '').slice(0, 11);
                setMobileNumber(filteredText);
                if (errors.mobileNumber) {
                  setErrors({ ...errors, mobileNumber: null });
                }
              }}
              keyboardType="phone-pad"
              onFocus={() => setFocusedField("mobileNumber")}
              onBlur={() => setFocusedField(null)}
              maxLength={11}
              placeholder="09XXXXXXXXX"
            />
            {errors.mobileNumber && <Text style={styles.errorText}>{errors.mobileNumber}</Text>}

            {/* Password */}
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={[
                  styles.input,
                  styles.passwordInput,
                  (focusedField === "password" || password) && styles.inputFocused,
                  errors.password && styles.inputError
                ]}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (errors.password) {
                    setErrors({ ...errors, password: null });
                  }
                }}
                secureTextEntry={!showPassword}
                onFocus={() => setFocusedField("password")}
                onBlur={() => setFocusedField(null)}
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowPassword(!showPassword)}
              >
                <MaterialCommunityIcons
                  name={showPassword ? "eye-outline" : "eye-off-outline"}
                  size={22}
                  color="#666"
                />
              </TouchableOpacity>
            </View>
            {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}

            {/* Confirm Password */}
            <Text style={styles.label}>Confirm Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={[
                  styles.input,
                  styles.passwordInput,
                  (focusedField === "confirmPassword" || confirmPassword) && styles.inputFocused,
                  errors.confirmPassword && styles.inputError
                ]}
                value={confirmPassword}
                onChangeText={(text) => {
                  setConfirmPassword(text);
                  if (errors.confirmPassword) {
                    setErrors({ ...errors, confirmPassword: null });
                  }
                }}
                secureTextEntry={!showConfirmPassword}
                onFocus={() => setFocusedField("confirmPassword")}
                onBlur={() => setFocusedField(null)}
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                <MaterialCommunityIcons
                  name={showConfirmPassword ? "eye-outline" : "eye-off-outline"}
                  size={22}
                  color="#666"
                />
              </TouchableOpacity>
            </View>
            {errors.confirmPassword && <Text style={styles.errorText}>{errors.confirmPassword}</Text>}

            {/* Role */}
            <Text style={styles.label}>Role</Text>
            <View style={styles.dropdownWrapper}>
              <TouchableOpacity
                style={[
                  styles.input,
                  (roleOpen || focusedField === "role" || role) && styles.inputFocused,
                  errors.role && styles.inputError
                ]}
                onPress={() => {
                  setFocusedField("role");
                  setRoleOpen(o => !o);
                }}
                activeOpacity={0.8}
              >
                <Text style={[styles.inputText, !role && styles.placeholder]}>
                  {role || "Select Role"}
                </Text>
                <MaterialCommunityIcons
                  name={roleOpen ? "chevron-up" : "chevron-down"}
                  size={20}
                  color="#666"
                />
              </TouchableOpacity>

              {roleOpen && (
                <View style={styles.dropdown}>
                  {roles.map(r => (
                    <TouchableOpacity
                      key={r}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setRole(r);
                        setRoleOpen(false);
                        setFocusedField(null);
                        if (errors.role) {
                          setErrors({ ...errors, role: null });
                        }
                      }}
                    >
                      <Text style={styles.dropdownItemText}>{r}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
            {errors.role && <Text style={styles.errorText}>{errors.role}</Text>}

            {/* General Error Message */}
            {errors.auth && (
              <View style={styles.generalErrorContainer}>
                <MaterialCommunityIcons name="alert-circle" size={20} color="#DC2626" />
                <Text style={styles.generalErrorText}>{errors.auth}</Text>
              </View>
            )}

            {/* Save Changes Button */}
            <TouchableOpacity
              style={[
                styles.saveButton,
                pressedBtn === "save" && styles.saveButtonPressed,
                loading && styles.saveButtonDisabled
              ]}
              activeOpacity={0.8}
              onPressIn={() => !loading && setPressedBtn("save")}
              onPressOut={() => setPressedBtn(null)}
              onPress={handleSaveChanges}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#133E87" />
              ) : (
                <Text style={[
                  styles.saveButtonText,
                  pressedBtn === "save" && styles.saveButtonTextPressed
                ]}>
                  Create Account
                </Text>
              )}
            </TouchableOpacity>

            {/* Cancel Button */}
            <TouchableOpacity
              style={[
                styles.cancelButton,
                pressedBtn === "cancel" && styles.cancelButtonPressed,
                loading && styles.cancelButtonDisabled
              ]}
              activeOpacity={0.8}
              onPressIn={() => !loading && setPressedBtn("cancel")}
              onPressOut={() => setPressedBtn(null)}
              onPress={handleCancel}
              disabled={loading}
            >
              <Text style={[
                styles.cancelButtonText,
                pressedBtn === "cancel" && styles.cancelButtonTextPressed
              ]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Success Modal */}
      <Modal
        transparent
        visible={successVisible}
        animationType="fade"
      >
        <View style={styles.successOverlay}>
          <View style={styles.successModal}>
            <View style={styles.successIconContainer}>
              <MaterialCommunityIcons name="check" size={48} color="#4CAF50" />
            </View>
            <Text style={styles.successTitle}>Account Successfully Created!</Text>
            <Text style={styles.successSubtitle}>User credentials sent via email</Text>
            <Text style={styles.successLoading}>Redirecting to user management...</Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scrollContent: {
    padding: 18,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(13,96,156,0.21)",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#000",
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: "400",
    color: "#000",
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    color: "#000",
    backgroundColor: "#fff",
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  inputFocused: {
    borderColor: "#133E87",
    borderWidth: 2,
  },
  inputError: {
    borderColor: "#DC2626",
    borderWidth: 1,
  },
  inputText: {
    fontSize: 15,
    color: "#000",
    flex: 1,
  },
  placeholder: {
    color: "#999",
  },
  errorText: {
    fontSize: 13,
    color: "#DC2626",
    marginTop: 4,
    marginLeft: 2,
  },
  passwordContainer: {
    position: "relative",
  },
  passwordInput: {
    paddingRight: 50,
  },
  eyeIcon: {
    position: "absolute",
    right: 14,
    top: 12,
    padding: 4,
  },
  dropdownWrapper: {
    position: "relative",
  },
  dropdown: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    marginTop: 4,
    zIndex: 10,
    overflow: "hidden",
  },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  dropdownItemText: {
    fontSize: 15,
    color: "#000",
  },
  saveButton: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 24,
    height: 48,
  },
  saveButtonPressed: {
    backgroundColor: "#133E87",
    borderColor: "#133E87",
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
  },
  saveButtonTextPressed: {
    color: "#fff",
  },
  cancelButton: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 12,
    height: 48,
  },
  cancelButtonPressed: {
    backgroundColor: "#133E87",
    borderColor: "#133E87",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
  },
  cancelButtonTextPressed: {
    color: "#fff",
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  cancelButtonDisabled: {
    opacity: 0.6,
  },
  generalErrorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEE2E2",
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    gap: 8,
  },
  generalErrorText: {
    fontSize: 14,
    color: "#DC2626",
    flex: 1,
  },
  successOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  successModal: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 40,
    width: "90%",
    maxWidth: 400,
    alignItems: "center",
  },
  successIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#E8F5E9",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#133E87",
    textAlign: "center",
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#133E87",
    textAlign: "center",
    marginBottom: 20,
  },
  successLoading: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
});