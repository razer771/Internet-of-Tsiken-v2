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
import Header2 from "./header";

export default function ManageAccount({ navigation }) {
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

  const roles = ["Owner", "Manager", "Worker"];

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateMobileNumber = (number) => {
    // Check if mobile number already exists (mock validation)
    const existingNumbers = ["09123456789", "09987654321"]; // Mock existing numbers
    return !existingNumbers.includes(number);
  };

  const validatePassword = (password) => {
    return password.length >= 6;
  };

  const handleSaveChanges = () => {
    const newErrors = {};

    // First Name validation
    if (!firstName.trim()) {
      newErrors.firstName = "First name is required.";
    }

    // Last Name validation
    if (!lastName.trim()) {
      newErrors.lastName = "Last name is required.";
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
      
      // Show success modal
      setSuccessVisible(true);
      
      // Redirect after 2.5 seconds
      setTimeout(() => {
        setSuccessVisible(false);
        navigation.navigate("AdminDashboard");
      }, 2500);
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
            <Text style={styles.title}>Edit Account</Text>

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
                setFirstName(text);
                if (errors.firstName) {
                  setErrors({ ...errors, firstName: null });
                }
              }}
              onFocus={() => setFocusedField("firstName")}
              onBlur={() => setFocusedField(null)}
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
              onChangeText={setMiddleName}
              onFocus={() => setFocusedField("middleName")}
              onBlur={() => setFocusedField(null)}
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
                setLastName(text);
                if (errors.lastName) {
                  setErrors({ ...errors, lastName: null });
                }
              }}
              onFocus={() => setFocusedField("lastName")}
              onBlur={() => setFocusedField(null)}
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
                setMobileNumber(text);
                if (errors.mobileNumber) {
                  setErrors({ ...errors, mobileNumber: null });
                }
              }}
              keyboardType="phone-pad"
              onFocus={() => setFocusedField("mobileNumber")}
              onBlur={() => setFocusedField(null)}
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

            {/* Save Changes Button */}
            <TouchableOpacity
              style={[
                styles.saveButton,
                pressedBtn === "save" && styles.saveButtonPressed
              ]}
              activeOpacity={0.8}
              onPressIn={() => setPressedBtn("save")}
              onPressOut={() => setPressedBtn(null)}
              onPress={handleSaveChanges}
            >
              <Text style={[
                styles.saveButtonText,
                pressedBtn === "save" && styles.saveButtonTextPressed
              ]}>
                Save Changes
              </Text>
            </TouchableOpacity>

            {/* Cancel Button */}
            <TouchableOpacity
              style={[
                styles.cancelButton,
                pressedBtn === "cancel" && styles.cancelButtonPressed
              ]}
              activeOpacity={0.8}
              onPressIn={() => setPressedBtn("cancel")}
              onPressOut={() => setPressedBtn(null)}
              onPress={handleCancel}
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
            <Text style={styles.successTitle}>Account successfully updated</Text>
            <Text style={styles.successSubtitle}>Activity logged</Text>
            <Text style={styles.successLoading}>Loading your dashboard...</Text>
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