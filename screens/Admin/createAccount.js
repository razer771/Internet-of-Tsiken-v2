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
  Alert,
  LayoutAnimation,
} from "react-native";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import Header2 from "../navigation/adminHeader";
import { getFunctions, httpsCallable } from "firebase/functions";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import {
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "../../config/firebaseconfig";
import AsyncStorage from "@react-native-async-storage/async-storage";

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

  // Loading state to prevent multiple taps
  const [isCreating, setIsCreating] = useState(false);

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
    const hasMinLength = password.length >= 8;
    const hasMaxLength = password.length <= 20;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

    return (
      hasMinLength &&
      hasMaxLength &&
      hasUpperCase &&
      hasLowerCase &&
      hasNumber &&
      hasSymbol
    );
  };

  const handleSaveChanges = async () => {
    // Prevent multiple taps
    if (isCreating) {
      return;
    }

    const newErrors = {};

    // First Name validation
    if (!firstName.trim()) {
      newErrors.firstName = "First name is required.";
    } else if (firstName.length > 20) {
      newErrors.firstName = "First name must not exceed 20 characters.";
    } else if (!validateName(firstName.trim(), "First name")) {
      newErrors.firstName =
        "First name must be at least 2 characters and contain only letters, space, comma or period.";
    }

    // Last Name validation
    if (!lastName.trim()) {
      newErrors.lastName = "Last name is required.";
    } else if (lastName.length > 20) {
      newErrors.lastName = "Last name must not exceed 20 characters.";
    } else if (!validateName(lastName.trim(), "Last name")) {
      newErrors.lastName =
        "Last name must be at least 2 characters and contain only letters, space, comma or period.";
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
    } else if (password.length < 8) {
      newErrors.password = "Password must be at least 8 characters.";
    } else if (password.length > 20) {
      newErrors.password = "Password must not exceed 20 characters.";
    } else if (!/[A-Z]/.test(password)) {
      newErrors.password =
        "Password must contain at least one uppercase letter.";
    } else if (!/[a-z]/.test(password)) {
      newErrors.password =
        "Password must contain at least one lowercase letter.";
    } else if (!/[0-9]/.test(password)) {
      newErrors.password = "Password must contain at least one number.";
    } else if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      newErrors.password = "Password must contain at least one symbol.";
    }

    // Confirm Password validation
    if (!confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password.";
    } else if (!validatePassword(confirmPassword)) {
      newErrors.confirmPassword =
        "Confirm password must meet all password requirements.";
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = "Password don't match.";
    }

    // Role validation
    if (!role) {
      newErrors.role = "Role is required.";
    }

    LayoutAnimation.configureNext(
      LayoutAnimation.Presets.easeInEaseOut
    );
    setErrors(newErrors);

    // If no errors, proceed with save
    if (Object.keys(newErrors).length === 0) {
      console.log("Save Changes - Form is valid");

      // Set creating state to prevent multiple taps
      setIsCreating(true);

      // Set flag to prevent App.js from interfering during account creation
      await AsyncStorage.setItem("accountCreationInProgress", "true");

      try {
        // Step 1: Check if email already exists in Firestore
        console.log("Checking for duplicate email in Firestore...");
        const usersRef = collection(db, "users");
        const emailQuery = query(usersRef, where("email", "==", email.trim()));
        const emailSnapshot = await getDocs(emailQuery);

        if (!emailSnapshot.empty) {
          console.log("❌ Email already exists in database:", email);
          setIsCreating(false);
          await AsyncStorage.removeItem("accountCreationInProgress");
          showAlert(
            "error",
            "Email Already Exists",
            "This email is already registered.",
          );
          return; // Stop execution, do not create account
        }
        console.log("✅ Email is unique, proceeding with account creation");

        // Step 2: Call Firebase Function to create user (DOES NOT SIGN OUT ADMIN)
        console.log("Creating account via Firebase Function...");
        const functions = getFunctions();
        const createUserAccount = httpsCallable(functions, "createUserAccount");

        // Format mobile number from 9175246023 to 09175246023
        const formattedMobileNumber = "0" + mobileNumber;

        const result = await createUserAccount({
          email: email,
          password: password,
          firstName: firstName,
          middleName: middleName,
          lastName: lastName,
          mobileNumber: formattedMobileNumber,
          role: role,
        });

        if (!result.data.success) {
          setIsCreating(false);
          throw new Error("Failed to create account");
        }

        const newUserId = result.data.uid;
        console.log("✅ Account created successfully:", newUserId);

        // Step 3: Send credentials email
        console.log("Sending credentials email...");
        try {
          const sendAccountEmail = httpsCallable(functions, "sendAccountEmail");
          await sendAccountEmail({
            email: email,
            username: email,
            password: password,
            firstName: firstName,
          });
          console.log("✅ Email sent successfully");
        } catch (emailError) {
          console.error("⚠️ Failed to send email:", emailError);
          // Don't fail if email fails
        }

        // Step 4: Show success modal and navigate back
        setSuccessVisible(true);

        setTimeout(async () => {
          setSuccessVisible(false);
          setIsCreating(false);

          // Clear the flag before navigation
          await AsyncStorage.removeItem("accountCreationInProgress");

          navigation.reset({
            index: 0,
            routes: [{ name: "UserManagement" }],
          });
        }, 2500);
      } catch (error) {
        console.error("❌ Error creating account:", error);

        // Reset creating state
        setIsCreating(false);

        // Clear the flag in case of error
        await AsyncStorage.removeItem("accountCreationInProgress");

        // Handle specific Cloud Function errors
        if (error.code === "functions/already-exists") {
          showAlert(
            "error",
            "Email Exists",
            "This email is already registered.",
          );
        } else if (error.code === "functions/permission-denied") {
          showAlert(
            "error",
            "Permission Denied",
            "You don't have permission to create accounts.",
          );
        } else if (error.code === "functions/unauthenticated") {
          showAlert(
            "error",
            "Authentication Required",
            "Please log in again to create accounts.",
          );
        } else if (error.code === "functions/invalid-argument") {
          showAlert(
            "error",
            "Invalid Data",
            "Please check all fields and try again.",
          );
        } else {
          showAlert(
            "error",
            "Account Creation Failed",
            error.message || "An unexpected error occurred. Please try again.",
          );
        }
      }
    }
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  // Check if form fields are filled (for button disabled state)
  const isFormEmpty =
    !firstName.trim() ||
    !lastName.trim() ||
    !email.trim() ||
    !mobileNumber.trim() ||
    !password ||
    !confirmPassword ||
    !role;

  return (
    <SafeAreaView style={styles.safe}>
      <Header2 />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={true}
          scrollEventThrottle={16}
          removeClippedSubviews={false}
          nestedScrollEnabled={true}
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
                if (!text.trim()) {
                  setErrors({ ...errors, firstName: null });
                } else if (text.length < 2) {
                  setErrors({
                    ...errors,
                    firstName: "First name must be at least 2 characters.",
                  });
                } else if (text.length > 20) {
                  setErrors({
                    ...errors,
                    firstName: "First name must not exceed 20 characters.",
                  });
                } else if (!/^[a-zA-Z., ]+$/.test(text)) {
                  setErrors({
                    ...errors,
                    firstName:
                      "First name must contain only letters, spaces, periods, or commas.",
                  });
                } else {
                  setErrors({ ...errors, firstName: null });
                }
              }}
              onFocus={() => setFocusedField("firstName")}
              onBlur={() => setFocusedField(null)}
            />
            <Text style={styles.errorText}>{errors.firstName || ""}</Text>

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
                if (!text.trim()) {
                  setErrors({ ...errors, middleName: null });
                } else if (text.length < 2) {
                  setErrors({
                    ...errors,
                    middleName: "Middle name must be at least 2 characters.",
                  });
                } else if (text.length > 20) {
                  setErrors({
                    ...errors,
                    middleName: "Middle name must not exceed 20 characters.",
                  });
                } else if (!/^[a-zA-Z. ]+$/.test(text)) {
                  setErrors({
                    ...errors,
                    middleName:
                      "Middle name must contain only letters, spaces, or periods.",
                  });
                } else {
                  setErrors({ ...errors, middleName: null });
                }
              }}
              onFocus={() => setFocusedField("middleName")}
              onBlur={() => setFocusedField(null)}
            />
            <Text style={styles.errorText}>{errors.middleName || ""}</Text>

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
                if (!text.trim()) {
                  setErrors({ ...errors, lastName: null });
                } else if (text.length < 2) {
                  setErrors({
                    ...errors,
                    lastName: "Last name must be at least 2 characters.",
                  });
                } else if (text.length > 20) {
                  setErrors({
                    ...errors,
                    lastName: "Last name must not exceed 20 characters.",
                  });
                } else if (!/^[a-zA-Z., ]+$/.test(text)) {
                  setErrors({
                    ...errors,
                    lastName:
                      "Last name must contain only letters, spaces, periods, or commas.",
                  });
                } else {
                  setErrors({ ...errors, lastName: null });
                }
              }}
              onFocus={() => setFocusedField("lastName")}
              onBlur={() => setFocusedField(null)}
            />
            <Text style={styles.errorText}>{errors.lastName || ""}</Text>

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
                if (!text.trim()) {
                  setErrors({ ...errors, email: null });
                } else if (text.length > 50) {
                  setErrors({
                    ...errors,
                    email: "Email must not exceed 50 characters.",
                  });
                } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
                  setErrors({
                    ...errors,
                    email: "Please enter a valid email address.",
                  });
                } else {
                  setErrors({ ...errors, email: null });
                }
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              onFocus={() => setFocusedField("email")}
              onBlur={() => setFocusedField(null)}
            />
            <Text style={styles.errorText}>{errors.email || ""}</Text>

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
                  // Real-time validation
                  if (!numericText) {
                    setErrors({ ...errors, mobileNumber: null });
                  } else if (numericText.length < 10) {
                    setErrors({
                      ...errors,
                      mobileNumber: "Mobile number must be 10 digits.",
                    });
                  } else if (numericText.length === 10) {
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
            <Text style={styles.errorText}>{errors.mobileNumber || ""}</Text>

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
                  // Real-time validation for password requirements
                  if (!text) {
                    setErrors({ ...errors, password: null });
                  } else if (text.length < 8) {
                    setErrors({
                      ...errors,
                      password: "Password must be at least 8 characters.",
                    });
                  } else if (text.length > 20) {
                    setErrors({
                      ...errors,
                      password: "Password must not exceed 20 characters.",
                    });
                  } else if (!/[A-Z]/.test(text)) {
                    setErrors({
                      ...errors,
                      password:
                        "Password must contain at least one uppercase letter.",
                    });
                  } else if (!/[a-z]/.test(text)) {
                    setErrors({
                      ...errors,
                      password:
                        "Password must contain at least one lowercase letter.",
                    });
                  } else if (!/[0-9]/.test(text)) {
                    setErrors({
                      ...errors,
                      password: "Password must contain at least one number.",
                    });
                  } else if (
                    !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(text)
                  ) {
                    setErrors({
                      ...errors,
                      password: "Password must contain at least one symbol.",
                    });
                  } else {
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
            <Text style={styles.errorText}>{errors.password || ""}</Text>

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
                  // Real-time validation for confirm password
                  if (!text) {
                    setErrors({ ...errors, confirmPassword: null });
                  } else if (password && text !== password) {
                    setErrors({
                      ...errors,
                      confirmPassword: "Passwords don't match.",
                    });
                  } else {
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
            <Text style={styles.errorText}>{errors.confirmPassword || ""}</Text>

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
            <Text style={styles.errorText}>{errors.role || ""}</Text>

            {/* Buttons Container - Prevents flickering */}
            <View style={styles.buttonsContainer}>
              {/* Save Changes Button */}
              <TouchableOpacity
                style={[
                  styles.saveButton,
                  pressedBtn === "save" && styles.saveButtonPressed,
                  (isFormEmpty || isCreating) && styles.saveButtonDisabled,
                ]}
                activeOpacity={0.8}
                onPressIn={() => !isFormEmpty && !isCreating && setPressedBtn("save")}
                onPressOut={() => setPressedBtn(null)}
                onPress={handleSaveChanges}
                disabled={isFormEmpty || isCreating}
              >
                <Text
                  style={[
                    styles.saveButtonText,
                    pressedBtn === "save" && styles.saveButtonTextPressed,
                    (isFormEmpty || isCreating) && styles.saveButtonTextDisabled,
                  ]}
                >
                  {isCreating ? "Creating..." : "Create Account"}
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
              {" "}
              Credentials sent to user's email
            </Text>
            <Text style={styles.successLoading}></Text>
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
    flexGrow: 1,
    justifyContent: "flex-start",
    minHeight: "100%",
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
    width: "100%",
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
    minHeight: 18,
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
    backgroundColor: "#1E4D99",
    borderWidth: 0.4,
    borderColor: "#1E4D99",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 24,
    height: 48,
  },
  saveButtonPressed: {
    backgroundColor: "#163A73",
    borderColor: "#163A73",
  },
  saveButtonDisabled: {
    opacity: 0.6,
    backgroundColor: "#999",
    borderColor: "#999",
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fffdfdff",
  },
  saveButtonTextPressed: {
    color: "#fff",
  },
  saveButtonTextDisabled: {
    opacity: 0.8,
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
  buttonsContainer: {
    marginTop: 24,
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
