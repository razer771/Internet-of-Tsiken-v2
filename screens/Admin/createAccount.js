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
} from "react-native";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import Header2 from "../navigation/adminHeader";
import { getFunctions, httpsCallable } from "firebase/functions";
import { createUserWithEmailAndPassword } from "firebase/auth";
import {
  doc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "../../config/firebaseconfig";

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

  // Alert Modal State
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertType, setAlertType] = useState("info");
  const [alertTitle, setAlertTitle] = useState("");
  const [alertMessage, setAlertMessage] = useState("");

  const roles = ["Admin", "User"];

  const showAlert = (type, title, message) => {
    setAlertType(type);
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertVisible(true);
  };

  const closeAlert = () => {
    setAlertVisible(false);
  };

  const validateName = (name, fieldName = "Name") => {
    // Must be at least 2 characters, only letters, spaces, and periods allowed
    if (name.length > 20) {
      console.log(`${fieldName} too long: ${name.length} characters`);
      return false;
    }
    const nameRegex = /^[a-zA-Z. ]{2,}$/;
    return nameRegex.test(name);
  };

  const validateEmail = (email) => {
    if (email.length > 50) {
      console.log(`Email exceeds 50 characters: ${email.length} characters`);
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateMobileNumber = (number) => {
    // Must be exactly 10 digits, no spaces or special characters
    const mobileRegex = /^\d{10}$/;
    if (!mobileRegex.test(number)) {
      return false;
    }

    // Check if mobile number already exists (mock validation)
    const existingNumbers = ["09123456789", "09987654321"]; // Mock existing numbers
    return !existingNumbers.includes(number);
  };

  const validatePassword = (password) => {
    return password.length >= 6;
  };

  const handleSaveChanges = async () => {
    const newErrors = {};

    // First Name validation
    if (!firstName.trim()) {
      newErrors.firstName = "First name is required.";
    } else if (firstName.length > 20) {
      newErrors.firstName = "First name must not exceed 20 characters.";
    } else if (!validateName(firstName.trim(), "First name")) {
      newErrors.firstName =
        "First name must be at least 2 characters and contain only letters, spaces, or periods.";
    }

    // Last Name validation
    if (!lastName.trim()) {
      newErrors.lastName = "Last name is required.";
    } else if (lastName.length > 20) {
      newErrors.lastName = "Last name must not exceed 20 characters.";
    } else if (!validateName(lastName.trim(), "Last name")) {
      newErrors.lastName =
        "Last name must be at least 2 characters and contain only letters, spaces, or periods.";
    }

    // Email validation
    if (!email.trim()) {
      newErrors.email = "Email is required.";
    } else if (email.length > 50) {
      newErrors.email = "Email must not exceed 50 characters.";
    } else if (!validateEmail(email)) {
      newErrors.email = "Please enter a valid email address.";
    }

    // Mobile Number validation
    if (!mobileNumber.trim()) {
      newErrors.mobileNumber = "Mobile number is required.";
    } else if (!/^\d{10}$/.test(mobileNumber)) {
      newErrors.mobileNumber =
        "Mobile number must be 10 digits with no spaces or special characters.";
    } else if (!validateMobileNumber(mobileNumber)) {
      newErrors.mobileNumber = "Mobile Number already exist.";
    }

    // Password validation
    if (!password) {
      newErrors.password = "Password is required.";
    } else if (!validatePassword(password)) {
      newErrors.password = "Password must be six or more characters.";
    }

    // Confirm Password validation
    if (!confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password.";
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = "Password don't match.";
    }

    // Role validation
    if (!role) {
      newErrors.role = "Role is required.";
    }

    setErrors(newErrors);

    // If no errors, proceed with save
    if (Object.keys(newErrors).length === 0) {
      console.log("Save Changes - Form is valid");

      try {
        // Step 1: Check if email already exists in Firestore
        console.log("Checking for duplicate email in Firestore...");
        const usersRef = collection(db, "users");
        const emailQuery = query(usersRef, where("email", "==", email.trim()));
        const emailSnapshot = await getDocs(emailQuery);

        if (!emailSnapshot.empty) {
          console.log("❌ Email already exists in database:", email);
          showAlert(
            "error",
            "Email Already Exists",
            "This email is already registered."
          );
          return; // Stop execution, do not create account
        }
        console.log("✅ Email is unique, proceeding with account creation");

        // Step 2: Create Firebase Authentication account
        console.log("Creating Firebase Authentication account...");
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );
        const user = userCredential.user;
        console.log("Firebase Auth account created:", user.uid);

        // Step 3: Store additional user data in Firestore
        console.log("Saving user profile to Firestore...");
        const fullName = middleName
          ? `${firstName} ${middleName} ${lastName}`
          : `${firstName} ${lastName}`;

        // Format phone number with country code
        const formattedPhone = `+63${mobileNumber}`;

        await setDoc(doc(db, "users", user.uid), {
          uid: user.uid,
          email: email,
          firstName: firstName,
          middleName: middleName || "",
          lastName: lastName,
          fullname: fullName,
          displayName: fullName,
          role: role,
          mobileNumber: mobileNumber,
          phone: formattedPhone,
          accountStatus: "active",
          accountType: "standard",
          verified: false,
          phoneVerified: false,
          otpVerified: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          failedLoginAttempts: 0,
          failedOtpAttempts: 0,
          mobileVerificationAttempts: 0,
          passwordHistory: [],
          loginHistory: [],
          mustShowPasswordUpdated: false,
          deviceLockUntil: null,
          lastFailedLogin: null,
          lastLoginAttempt: null,
          lastVerified: null,
          lastOTPVerified: null,
          lastMobileVerified: null,
          ipAddress: null,
          userAgent: null,
        });
        console.log("User profile saved to Firestore");

        // Step 4: Send credentials email via Firebase Function
        console.log("Sending credentials email...");
        try {
          const functions = getFunctions();
          const sendAccountEmail = httpsCallable(functions, "sendAccountEmail");

          const result = await sendAccountEmail({
            email: email,
            username: email, // Using email as username
            password: password,
            firstName: firstName, // Pass first name for personalization
          });

          if (result.data.success) {
            console.log("Email sent successfully");
          } else {
            console.error("Failed to send email:", result.data.error);
            // Don't fail the entire process if email fails
          }
        } catch (emailError) {
          console.error("Error sending email:", emailError);
          // Don't fail the entire process if email fails
        }

        // Step 5: Show success modal
        setSuccessVisible(true);

        // Step 6: Redirect after 2.5 seconds
        setTimeout(() => {
          setSuccessVisible(false);
          navigation.navigate("AdminDashboard");
        }, 2500);
      } catch (error) {
        console.error("Error creating account:", error);

        // Handle Firebase Authentication errors
        let errorMessage = "Failed to create account. Please try again.";

        if (error.code === "auth/email-already-in-use") {
          errorMessage = "This email is already registered.";
          setErrors({ ...errors, email: errorMessage });
        } else if (error.code === "auth/invalid-email") {
          errorMessage = "Invalid email address.";
          setErrors({ ...errors, email: errorMessage });
        } else if (error.code === "auth/weak-password") {
          errorMessage = "Password is too weak.";
          setErrors({ ...errors, password: errorMessage });
        } else if (error.code === "auth/network-request-failed") {
          errorMessage = "Network error. Please check your connection.";
        } else {
          // Generic error for other cases
          errorMessage = error.message || errorMessage;
        }

        // Show alert for non-field-specific errors
        if (
          error.code !== "auth/email-already-in-use" &&
          error.code !== "auth/invalid-email" &&
          error.code !== "auth/weak-password"
        ) {
          showAlert("error", "Account Creation Failed", errorMessage);
        }
      }
    }
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <Header2 />

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
            <View style={styles.labelRow}>
              <Text style={styles.label}>First Name</Text>
              <Text style={styles.required}>*</Text>
            </View>
            <TextInput
              style={[
                styles.input,
                (focusedField === "firstName" || firstName) &&
                  styles.inputFocused,
                errors.firstName && styles.inputError,
              ]}
              value={firstName}
              onChangeText={(text) => {
                setFirstName(text);
                // Real-time validation
                if (text.length > 20) {
                  setErrors({
                    ...errors,
                    firstName: "First name must not exceed 20 characters.",
                  });
                } else if (errors.firstName) {
                  setErrors({ ...errors, firstName: null });
                }
              }}
              onFocus={() => setFocusedField("firstName")}
              onBlur={() => setFocusedField(null)}
            />
            {errors.firstName && (
              <Text style={styles.errorText}>{errors.firstName}</Text>
            )}

            {/* Middle Name */}
            <Text style={styles.label}>Middle Name</Text>
            <TextInput
              style={[
                styles.input,
                (focusedField === "middleName" || middleName) &&
                  styles.inputFocused,
                errors.middleName && styles.inputError,
              ]}
              value={middleName}
              onChangeText={(text) => {
                setMiddleName(text);
                // Real-time validation
                if (text.length > 20) {
                  setErrors({
                    ...errors,
                    middleName: "Middle name must not exceed 20 characters.",
                  });
                } else if (errors.middleName) {
                  setErrors({ ...errors, middleName: null });
                }
              }}
              onFocus={() => setFocusedField("middleName")}
              onBlur={() => setFocusedField(null)}
            />
            {errors.middleName && (
              <Text style={styles.errorText}>{errors.middleName}</Text>
            )}

            {/* Last Name */}
            <View style={styles.labelRow}>
              <Text style={styles.label}>Last Name</Text>
              <Text style={styles.required}>*</Text>
            </View>
            <TextInput
              style={[
                styles.input,
                (focusedField === "lastName" || lastName) &&
                  styles.inputFocused,
                errors.lastName && styles.inputError,
              ]}
              value={lastName}
              onChangeText={(text) => {
                setLastName(text);
                // Real-time validation
                if (text.length > 20) {
                  setErrors({
                    ...errors,
                    lastName: "Last name must not exceed 20 characters.",
                  });
                } else if (errors.lastName) {
                  setErrors({ ...errors, lastName: null });
                }
              }}
              onFocus={() => setFocusedField("lastName")}
              onBlur={() => setFocusedField(null)}
            />
            {errors.lastName && (
              <Text style={styles.errorText}>{errors.lastName}</Text>
            )}

            {/* Email */}
            <View style={styles.labelRow}>
              <Text style={styles.label}>Email</Text>
              <Text style={styles.required}>*</Text>
            </View>
            <TextInput
              style={[
                styles.input,
                (focusedField === "email" || email) && styles.inputFocused,
                errors.email && styles.inputError,
              ]}
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                // Real-time validation
                if (text.length > 50) {
                  setErrors({
                    ...errors,
                    email: "Email must not exceed 50 characters.",
                  });
                } else if (errors.email) {
                  setErrors({ ...errors, email: null });
                }
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              onFocus={() => setFocusedField("email")}
              onBlur={() => setFocusedField(null)}
            />
            {errors.email && (
              <Text style={styles.errorText}>{errors.email}</Text>
            )}

            {/* Mobile Number */}
            <View style={styles.labelRow}>
              <Text style={styles.label}>Mobile Number</Text>
              <Text style={styles.required}>*</Text>
            </View>
            <View
              style={[
                styles.mobileInputContainer,
                (focusedField === "mobileNumber" || mobileNumber) &&
                  styles.inputFocused,
                errors.mobileNumber && styles.inputError,
              ]}
            >
              <Text style={styles.countryCode}>+63</Text>
              <TextInput
                style={styles.mobileInput}
                value={mobileNumber}
                onChangeText={(text) => {
                  // Only allow numeric input
                  const numericText = text.replace(/[^0-9]/g, "");
                  setMobileNumber(numericText);
                  if (errors.mobileNumber) {
                    setErrors({ ...errors, mobileNumber: null });
                  }
                }}
                placeholder="9xxxxxxxxx"
                keyboardType="phone-pad"
                maxLength={10}
                onFocus={() => setFocusedField("mobileNumber")}
                onBlur={() => setFocusedField(null)}
              />
            </View>
            {errors.mobileNumber && (
              <Text style={styles.errorText}>{errors.mobileNumber}</Text>
            )}

            {/* Password */}
            <View style={styles.labelRow}>
              <Text style={styles.label}>Password</Text>
              <Text style={styles.required}>*</Text>
            </View>
            <View style={styles.passwordContainer}>
              <TextInput
                style={[
                  styles.input,
                  styles.passwordInput,
                  (focusedField === "password" || password) &&
                    styles.inputFocused,
                  errors.password && styles.inputError,
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
            {errors.password && (
              <Text style={styles.errorText}>{errors.password}</Text>
            )}

            {/* Confirm Password */}
            <View style={styles.labelRow}>
              <Text style={styles.label}>Confirm Password</Text>
              <Text style={styles.required}>*</Text>
            </View>
            <View style={styles.passwordContainer}>
              <TextInput
                style={[
                  styles.input,
                  styles.passwordInput,
                  (focusedField === "confirmPassword" || confirmPassword) &&
                    styles.inputFocused,
                  errors.confirmPassword && styles.inputError,
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
            {errors.confirmPassword && (
              <Text style={styles.errorText}>{errors.confirmPassword}</Text>
            )}

            {/* Role */}
            <View style={styles.labelRow}>
              <Text style={styles.label}>Role</Text>
              <Text style={styles.required}>*</Text>
            </View>
            <View style={styles.dropdownWrapper}>
              <TouchableOpacity
                style={[
                  styles.input,
                  (roleOpen || focusedField === "role" || role) &&
                    styles.inputFocused,
                  errors.role && styles.inputError,
                ]}
                onPress={() => {
                  setFocusedField("role");
                  setRoleOpen((o) => !o);
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
                  {roles.map((r) => (
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

            {/* Save Changes Button */}
            <TouchableOpacity
              style={[
                styles.saveButton,
                pressedBtn === "save" && styles.saveButtonPressed,
              ]}
              activeOpacity={0.8}
              onPressIn={() => setPressedBtn("save")}
              onPressOut={() => setPressedBtn(null)}
              onPress={handleSaveChanges}
            >
              <Text
                style={[
                  styles.saveButtonText,
                  pressedBtn === "save" && styles.saveButtonTextPressed,
                ]}
              >
                Create Account
              </Text>
            </TouchableOpacity>

            {/* Cancel Button */}
            <TouchableOpacity
              style={[
                styles.cancelButton,
                pressedBtn === "cancel" && styles.cancelButtonPressed,
              ]}
              activeOpacity={0.8}
              onPressIn={() => setPressedBtn("cancel")}
              onPressOut={() => setPressedBtn(null)}
              onPress={handleCancel}
            >
              <Text
                style={[
                  styles.cancelButtonText,
                  pressedBtn === "cancel" && styles.cancelButtonTextPressed,
                ]}
              >
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Success Modal */}
      <Modal transparent visible={successVisible} animationType="fade">
        <View style={styles.successOverlay}>
          <View style={styles.successModal}>
            <View style={styles.successIconContainer}>
              <MaterialCommunityIcons name="check" size={48} color="#4CAF50" />
            </View>
            <Text style={styles.successTitle}>
              Account successfully created
            </Text>
            <Text style={styles.successSubtitle}>
              Credentials sent to user's email
            </Text>
            <Text style={styles.successLoading}>
              Redirecting to dashboard...
            </Text>
          </View>
        </View>
      </Modal>

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
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: -8,
  },
  required: {
    fontSize: 16,
    fontWeight: "400",
    color: "#DC2626",
    marginLeft: 4,
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
  mobileInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    backgroundColor: "#fff",
    height: 48,
    overflow: "hidden",
  },
  countryCode: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#000",
    backgroundColor: "#F3F4F6",
    fontWeight: "500",
    borderRightWidth: 1,
    borderRightColor: "#D1D5DB",
  },
  mobileInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#000",
    backgroundColor: "#fff",
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
    backgroundColor: "#3b4cca",
    borderWidth: 0.4,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 24,
    height: 48,
  },
  saveButtonPressed: {
    backgroundColor: "#3b4cca",
    borderColor: "#3b4cca",
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fffdfdff",
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
