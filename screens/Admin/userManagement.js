import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Modal,
} from "react-native";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import Icon from "react-native-vector-icons/Feather";
import Header2 from "../navigation/adminHeader";
import {
  doc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  orderBy,
  limit,
  updateDoc,
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

const roleColors = {
  owner: "#E3EAFD",
  manager: "#E3EAFD",
  worker: "#E3EAFD",
};
const roleTextColors = {
  owner: "#234187",
  manager: "#234187",
  worker: "#234187",
};

export default function UserManagement({ navigation }) {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedRole, setSelectedRole] = useState("All Roles");
  const [roleFilterOpen, setRoleFilterOpen] = useState(false);
  const roleFilterOptions = ["All Roles", "Admin", "User"];
  const [selectedStatus, setSelectedStatus] = useState("All Status");
  const [statusFilterOpen, setStatusFilterOpen] = useState(false);
  const statusFilterOptions = ["All Status", "Active", "Inactive"];

  const [pressedRow, setPressedRow] = useState(null);
  const [editUser, setEditUser] = useState({
    id: "",
    firstName: "",
    middleName: "",
    lastName: "",
    email: "",
    phone: "",
    role: "Worker",
  });
  const [originalEmail, setOriginalEmail] = useState("");
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [validationErrors, setValidationErrors] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    email: "",
    phone: "",
  });
  const roles = ["Admin", "User"];
  const [roleOpen, setRoleOpen] = useState(false);
  const [savedVisible, setSavedVisible] = useState(false);
  const [saveBtnPressed, setSaveBtnPressed] = useState(false);
  const [cancelBtnPressed, setCancelBtnPressed] = useState(false);
  const [pressedBtn, setPressedBtn] = useState(null);

  // Force Password Change Modal
  const [forcePasswordVisible, setForcePasswordVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [confirmBtnPressed, setConfirmBtnPressed] = useState(false);
  const [cancelPasswordBtnPressed, setCancelPasswordBtnPressed] =
    useState(false);
  const [passwordResetSuccessVisible, setPasswordResetSuccessVisible] =
    useState(false);

  // Delete User Modal
  const [deleteUserVisible, setDeleteUserVisible] = useState(false);
  const [deleteConfirmBtnPressed, setDeleteConfirmBtnPressed] = useState(false);
  const [deleteCancelBtnPressed, setDeleteCancelBtnPressed] = useState(false);
  const [deleteSuccessVisible, setDeleteSuccessVisible] = useState(false);

  // Alert Modal
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertType, setAlertType] = useState("info");
  const [alertTitle, setAlertTitle] = useState("");
  const [alertMessage, setAlertMessage] = useState("");

  const closeAlert = () => {
    setAlertVisible(false);
  };

  // Fetch users from Firestore and compute their status
  useEffect(() => {
    console.log("Setting up users listener...");
    const usersRef = collection(db, "users");

    const unsubscribe = onSnapshot(usersRef, async (snapshot) => {
      console.log("Fetched users:", snapshot.size);

      const usersData = await Promise.all(
        snapshot.docs.map(async (userDoc) => {
          const userData = userDoc.data();
          const userId = userDoc.id;

          // Fetch session logs for this user to determine status
          const sessionLogsRef = collection(db, "session_logs");
          const loginQuery = query(
            sessionLogsRef,
            where("userId", "==", userId),
            where("action", "==", "login"),
            orderBy("timestamp", "desc"),
            limit(1)
          );

          let status = "inactive";
          try {
            const sessionSnapshot = await getDocs(loginQuery);
            console.log(
              `Fetched session logs for user ${userId} (${userData.firstName} ${userData.lastName}):`,
              sessionSnapshot.size
            );

            if (!sessionSnapshot.empty) {
              const lastLogin = sessionSnapshot.docs[0].data().timestamp;
              const lastLoginDate = lastLogin?.toDate();

              if (lastLoginDate) {
                const now = new Date();
                const diffInDays =
                  (now - lastLoginDate) / (1000 * 60 * 60 * 24);

                // Active if logged in within past 3 days
                status = diffInDays <= 3 ? "active" : "inactive";
                console.log(
                  `Last login for user ${userId} (${userData.firstName} ${userData.lastName}): ${diffInDays.toFixed(2)} days ago → ${status}`
                );
              } else {
                console.log(
                  `No valid timestamp for user ${userId}, marking as inactive`
                );
              }
            } else {
              console.log(
                `No login logs found for user ${userId} (${userData.firstName} ${userData.lastName}), marking as inactive`
              );
            }
          } catch (error) {
            console.error(
              `Error fetching session logs for user ${userId}:`,
              error
            );
            console.log(`Marking user ${userId} as inactive due to error`);
          }

          // Format created date as YYYY-MMM-DD
          const createdAt = userData.createdAt?.toDate();
          let created = "N/A";
          if (createdAt) {
            const year = createdAt.getFullYear();
            const month = createdAt.toLocaleString("en-US", { month: "short" });
            const day = String(createdAt.getDate()).padStart(2, "0");
            created = `${year}-${month}-${day}`;
            console.log(
              `User ${userId} (${userData.firstName} ${userData.lastName}) created on ${created}`
            );
          }

          return {
            id: userId,
            firstName: userData.firstName || "",
            lastName: userData.lastName || "",
            email: userData.email || "",
            phone: userData.phone || userData.mobileNumber || "",
            role: userData.role?.toLowerCase() || "worker",
            accountStatus: userData.accountStatus || "inactive",
            status: status,
            created: created,
          };
        })
      );

      console.log("Users with computed status:", usersData);
      setUsers(usersData);
    });

    return () => {
      console.log("Cleaning up users listener");
      unsubscribe();
    };
  }, []);

  // Apply filters: role + status + search
  const filteredUsers = users.filter((u) => {
    // role filter
    const roleOk =
      selectedRole === "All Roles" ||
      u.role.toLowerCase() === selectedRole.toLowerCase();

    // status filter
    const statusOk =
      selectedStatus === "All Status" ||
      (u.accountStatus &&
        u.accountStatus.toLowerCase() === selectedStatus.toLowerCase());

    // search filter (name or email)
    const q = search.trim().toLowerCase();
    const name = `${u.firstName} ${u.lastName}`.toLowerCase();
    const searchOk =
      q === "" || name.includes(q) || u.email.toLowerCase().includes(q);

    return roleOk && statusOk && searchOk;
  });

  const handleEditUser = (user) => {
    console.log(
      `Opening edit modal for user: ${user.firstName} ${user.lastName}`
    );
    setEditUser({
      id: user.id,
      firstName: user.firstName,
      middleName: user.middleName || "",
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      role: user.role.charAt(0).toUpperCase() + user.role.slice(1), // Capitalize first letter
    });
    setOriginalEmail(user.email);
    setValidationErrors({
      firstName: "",
      middleName: "",
      lastName: "",
      email: "",
      phone: "",
    });
    setEditModalVisible(true);
  };

  const validateName = (name, fieldName) => {
    if (!name || name.trim().length < 2) {
      return `${fieldName} must be at least 2 characters`;
    }
    if (name.length > 20) {
      console.log(`${fieldName} too long: ${name.length} characters`);
      return `${fieldName} must not exceed 20 characters`;
    }
    if (!/^[a-zA-Z\s.]+$/.test(name)) {
      return `${fieldName} must contain only letters, spaces, or periods`;
    }
    return "";
  };

  const validateEmail = (email) => {
    if (!email) {
      return "Email is required";
    }
    if (email.length > 50) {
      console.log(`Email exceeds 50 characters: ${email.length} characters`);
      return "Email must not exceed 50 characters";
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return "Invalid email format";
    }
    return "";
  };

  const validatePhone = (phone) => {
    if (!phone) {
      return "Mobile number is required";
    }
    if (phone.length > 13) {
      console.log(`Mobile number too long: ${phone.length} characters`);
      return "Mobile number must not exceed 13 characters";
    }
    if (!/^\+639\d{9}$/.test(phone)) {
      return "Mobile number must be in format +639xxxxxxxxx";
    }
    return "";
  };

  const handleSaveUser = async () => {
    try {
      console.log("Validating form fields...");

      // Validate all fields
      const errors = {
        firstName: validateName(editUser.firstName, "First name"),
        middleName: editUser.middleName
          ? validateName(editUser.middleName, "Middle name")
          : "",
        lastName: validateName(editUser.lastName, "Last name"),
        email: validateEmail(editUser.email),
        phone: validatePhone(editUser.phone),
      };

      setValidationErrors(errors);

      // Check if any errors exist
      const hasErrors = Object.values(errors).some((error) => error !== "");
      if (hasErrors) {
        console.log("Validation failed:", errors);
        setAlertType("error");
        setAlertTitle("Validation Error");
        setAlertMessage("Please fix all validation errors before saving.");
        setAlertVisible(true);
        return;
      }

      console.log("Validation passed");

      // Check for duplicate email if email has changed
      if (editUser.email !== originalEmail) {
        console.log("Validating email...");
        const usersRef = collection(db, "users");
        const emailQuery = query(
          usersRef,
          where("email", "==", editUser.email)
        );
        const emailSnapshot = await getDocs(emailQuery);

        if (!emailSnapshot.empty) {
          console.log("Duplicate email found:", editUser.email);
          setAlertType("error");
          setAlertTitle("Email Already Exists");
          setAlertMessage("This email is already registered to another user.");
          setAlertVisible(true);
          return;
        }
        console.log("Email is unique, proceeding with update");
      }

      console.log(`Updating user ${editUser.id} in Firestore`);

      const userRef = doc(db, "users", editUser.id);

      // Compute displayName and fullname
      const displayName = `${editUser.firstName} ${editUser.lastName}`;
      const fullname = `${editUser.firstName} ${editUser.lastName}`;

      await updateDoc(userRef, {
        firstName: editUser.firstName,
        middleName: editUser.middleName,
        lastName: editUser.lastName,
        email: editUser.email,
        phone: editUser.phone,
        role: editUser.role.toLowerCase(),
        displayName: displayName,
        fullname: fullname,
      });

      console.log(
        `User ${editUser.id} updated successfully with displayName: "${displayName}" and fullname: "${fullname}"`
      );

      setEditModalVisible(false);
      setSavedVisible(true);
      setTimeout(() => setSavedVisible(false), 1500);

      // User list will auto-refresh via onSnapshot listener
    } catch (error) {
      console.error("Error updating user:", error);
      setAlertType("error");
      setAlertTitle("Update Failed");
      setAlertMessage("Failed to update user. Please try again.");
      setAlertVisible(true);
    }
  };

  const handleForcePasswordChange = (user) => {
    console.log(
      "Force Password Change modal opened for:",
      user.firstName,
      user.lastName
    );
    setSelectedUser(user);
    setForcePasswordVisible(true);
  };

  const handleConfirmPasswordChange = async () => {
    try {
      console.log("Force password change for:", selectedUser);

      if (!selectedUser || !selectedUser.id) {
        console.error("No user selected for password change");
        return;
      }

      const userRef = doc(db, "users", selectedUser.id);

      // Set requirePasswordChange flag to true in Firestore
      await updateDoc(userRef, {
        requirePasswordChange: true,
      });

      console.log(
        `User ${selectedUser.firstName} ${selectedUser.lastName} flagged for password change in Firestore`
      );

      setForcePasswordVisible(false);

      // Show success modal
      setPasswordResetSuccessVisible(true);

      // Redirect after 2.5 seconds
      setTimeout(() => {
        setPasswordResetSuccessVisible(false);
        setSelectedUser(null);
      }, 2500);
    } catch (error) {
      console.error("Error flagging user for password change:", error);
      setAlertType("error");
      setAlertTitle("Update Failed");
      setAlertMessage(
        "Failed to flag user for password change. Please try again."
      );
      setAlertVisible(true);
      setForcePasswordVisible(false);
      setSelectedUser(null);
    }
  };

  const handleDeleteUser = (user) => {
    setSelectedUser(user);
    setDeleteUserVisible(true);
  };

  const handleConfirmDelete = async () => {
    try {
      console.log("Marking user as Inactive:", selectedUser);

      if (!selectedUser || !selectedUser.id) {
        console.error("No user selected for deletion");
        return;
      }

      const userRef = doc(db, "users", selectedUser.id);

      // Update accountStatus to "inactive" in Firestore
      await updateDoc(userRef, {
        accountStatus: "inactive",
      });

      console.log(
        `User ${selectedUser.firstName} ${selectedUser.lastName} marked as Inactive in Firestore`
      );

      setDeleteUserVisible(false);

      // Show success modal
      setDeleteSuccessVisible(true);

      // Redirect after 2.5 seconds
      setTimeout(() => {
        setDeleteSuccessVisible(false);
        setSelectedUser(null);
      }, 2500);

      // User list will auto-refresh via onSnapshot listener
    } catch (error) {
      console.error("Error marking user as inactive:", error);
      setAlertType("error");
      setAlertTitle("Update Failed");
      setAlertMessage("Failed to mark user as inactive. Please try again.");
      setAlertVisible(true);
      setDeleteUserVisible(false);
      setSelectedUser(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <Header2 />

      {/* Create Account Action Card */}
      <View style={styles.createAccountCard}>
        {/* Back Button */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.navigate("AdminDashboard")}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color="#133E87" />
          <Text style={styles.backButtonText}>Back to Dashboard</Text>
        </TouchableOpacity>

        <View style={styles.createAccountRow}>
          <MaterialCommunityIcons
            name="account-plus-outline"
            size={28}
            color="#133E87"
            style={styles.createAccountIcon}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.createAccountTitle}>Create Account</Text>
            <Text style={styles.createAccountDesc}>
              Create a new user account
            </Text>
            <TouchableOpacity
              style={[
                styles.createAccountButton,
                { borderColor: "#234187" },
                pressedBtn === "createAccount" && {
                  backgroundColor: "#133E87",
                },
              ]}
              activeOpacity={0.85}
              onPressIn={() => setPressedBtn("createAccount")}
              onPressOut={() => setPressedBtn(null)}
              onPress={() => {
                console.log("Navigating to CreateAccount");
                navigation.navigate("CreateAccount");
              }}
            >
              <Text
                style={[
                  styles.createAccountButtonText,
                  pressedBtn === "createAccount" && { color: "#fff" },
                ]}
              >
                Create
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Search Bar and Filters Section */}
      <View style={styles.searchFiltersWrapper}>
        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Icon
            name="search"
            size={20}
            color="#8A99A8"
            style={{ marginRight: 8 }}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or email..."
            placeholderTextColor="#8A99A8"
            value={search}
            onChangeText={(text) => {
              setSearch(text);
              console.log("Searching users:", text || "cleared");
            }}
          />
        </View>
        {/* Filters */}
        <View style={styles.filtersRow}>
          {/* Role filter dropdown */}
          <View style={styles.filterDropdownWrapper}>
            <TouchableOpacity
              style={styles.filterButton}
              onPress={() => {
                setRoleFilterOpen((o) => !o);
                setStatusFilterOpen(false);
              }}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name="filter-variant"
                size={18}
                color="#000"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.filterText}>{selectedRole}</Text>
              <MaterialCommunityIcons
                name={roleFilterOpen ? "chevron-up" : "chevron-down"}
                size={18}
                color="#000"
              />
            </TouchableOpacity>

            {roleFilterOpen && (
              <View style={styles.filterDropdown}>
                {roleFilterOptions.map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={styles.filterDropdownItem}
                    onPress={() => {
                      setSelectedRole(opt);
                      setRoleFilterOpen(false);
                      console.log("Filtering users by role:", opt);
                    }}
                  >
                    <Text style={styles.filterDropdownItemText}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Status filter dropdown */}
          <View style={styles.filterDropdownWrapper}>
            <TouchableOpacity
              style={styles.filterButton}
              onPress={() => {
                setStatusFilterOpen((o) => !o);
                setRoleFilterOpen(false);
              }}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name="filter-variant"
                size={18}
                color="#000"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.filterText}>{selectedStatus}</Text>
              <MaterialCommunityIcons
                name={statusFilterOpen ? "chevron-up" : "chevron-down"}
                size={18}
                color="#000"
              />
            </TouchableOpacity>

            {statusFilterOpen && (
              <View style={styles.filterDropdown}>
                {statusFilterOptions.map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={styles.filterDropdownItem}
                    onPress={() => {
                      setSelectedStatus(opt);
                      setStatusFilterOpen(false);
                      console.log("Filtering users by status:", opt);
                    }}
                  >
                    <Text style={styles.filterDropdownItemText}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Close any open filter when tapping outside or scrolling */}
      {(roleFilterOpen || statusFilterOpen) && (
        <TouchableOpacity
          style={styles.fullscreenDismiss}
          activeOpacity={1}
          onPress={() => {
            setRoleFilterOpen(false);
            setStatusFilterOpen(false);
          }}
        />
      )}

      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 32 }}
        onScrollBeginDrag={() => {
          setRoleFilterOpen(false);
          setStatusFilterOpen(false);
        }}
      >
        <ScrollView
          horizontal
          style={styles.horizontalScroll}
          showsHorizontalScrollIndicator
          onScrollBeginDrag={() => {
            setRoleFilterOpen(false);
            setStatusFilterOpen(false);
          }}
        >
          <View style={styles.userListCard}>
            <Text style={styles.userListTitle}>
              User List ({filteredUsers.length} users)
            </Text>
            <View style={styles.userListHeader}>
              <View style={styles.nameColHeader}>
                <Text style={styles.userListHeaderText}>Name</Text>
              </View>
              <View style={styles.contactColHeader}>
                <Text style={styles.userListHeaderText}>Contact</Text>
              </View>
              <View style={styles.roleColHeader}>
                <Text
                  style={[styles.userListHeaderText, { textAlign: "center" }]}
                >
                  Role
                </Text>
              </View>
              <View style={styles.createdColHeader}>
                <Text
                  style={[styles.userListHeaderText, { textAlign: "center" }]}
                >
                  Created
                </Text>
              </View>
              <View style={styles.statusColHeader}>
                <Text
                  style={[styles.userListHeaderText, { textAlign: "center" }]}
                >
                  Status
                </Text>
              </View>
              <View style={styles.actionsColHeader}>
                <Text
                  style={[styles.userListHeaderText, { textAlign: "center" }]}
                >
                  Actions
                </Text>
              </View>
            </View>
            {filteredUsers.map((user) => {
              console.log(
                `Rendering user row: ${user.firstName} ${user.lastName}`
              );
              return (
                <TouchableOpacity
                  key={user.id}
                  style={[
                    styles.userRow,
                    pressedRow === user.id && { backgroundColor: "#F4F4F4" },
                  ]}
                  activeOpacity={1}
                  onPressIn={() => setPressedRow(user.id)}
                  onPressOut={() => setPressedRow(null)}
                >
                  {/* Name */}
                  <View style={styles.nameCol}>
                    <Text style={styles.userName} numberOfLines={2}>
                      {(() => {
                        const fullName = `${user.firstName} ${user.lastName}`
                          .trim()
                          .split(" ");
                        if (fullName.length <= 2) {
                          return fullName.join(" ");
                        } else {
                          return `${fullName.slice(0, 2).join(" ")}\n${fullName.slice(2).join(" ")}`;
                        }
                      })()}
                    </Text>
                  </View>
                  {/* Contact */}
                  <View style={styles.contactCol}>
                    <View style={styles.contactColumn}>
                      <View style={styles.contactRow}>
                        <MaterialCommunityIcons
                          name="email-outline"
                          size={16}
                          color="#8A99A8"
                        />
                        <Text style={styles.userContact} numberOfLines={1}>
                          {user.email}
                        </Text>
                      </View>
                      <View style={styles.contactRow}>
                        <MaterialCommunityIcons
                          name="phone-outline"
                          size={16}
                          color="#8A99A8"
                        />
                        <Text style={styles.userContact} numberOfLines={1}>
                          {user.phone}
                        </Text>
                      </View>
                    </View>
                  </View>
                  {/* Role */}
                  <View style={styles.roleCol}>
                    <View style={styles.roleCell}>
                      <MaterialCommunityIcons
                        name="shield-account-outline"
                        size={16}
                        color={roleTextColors[user.role]}
                      />
                      <Text
                        style={[
                          styles.roleBadgeText,
                          { color: roleTextColors[user.role] },
                        ]}
                      >
                        {user.role}
                      </Text>
                    </View>
                  </View>
                  {/* Created */}
                  <View style={styles.createdCol}>
                    <Text style={styles.createdDate}>{user.created}</Text>
                  </View>
                  {/* Status */}
                  <View style={styles.statusCol}>
                    <Text style={styles.statusText}>
                      {(() => {
                        const status = user.accountStatus || "inactive";
                        const formattedStatus =
                          status.charAt(0).toUpperCase() + status.slice(1);
                        console.log(
                          `Fetched accountStatus for user ${user.firstName} ${user.lastName}: ${formattedStatus}`
                        );
                        return formattedStatus;
                      })()}
                    </Text>
                  </View>
                  {/* Actions */}
                  <View style={styles.actionsCol}>
                    <TouchableOpacity onPress={() => handleEditUser(user)}>
                      <MaterialCommunityIcons
                        name="pencil-outline"
                        size={20}
                        color="#234187"
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleForcePasswordChange(user)}
                    >
                      <MaterialCommunityIcons
                        name="lock-outline"
                        size={20}
                        color="#234187"
                      />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteUser(user)}>
                      <MaterialCommunityIcons
                        name="trash-can-outline"
                        size={20}
                        color="#D9534F"
                      />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </ScrollView>

      {/* Edit User Account Modal */}
      <Modal
        transparent
        visible={editModalVisible}
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.editUserModal}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.editUserTitle}>Edit User Account</Text>

              <Text style={styles.editUserLabel}>
                First Name<Text style={styles.requiredAsterisk}> *</Text>
              </Text>
              <TextInput
                style={[
                  styles.editUserInput,
                  validationErrors.firstName && styles.editUserInputError,
                ]}
                value={editUser.firstName}
                onChangeText={(text) => {
                  setEditUser({ ...editUser, firstName: text });
                  setValidationErrors({
                    ...validationErrors,
                    firstName: validateName(text, "First name"),
                  });
                }}
                placeholder="Enter first name"
              />
              {validationErrors.firstName ? (
                <Text style={styles.errorText}>
                  {validationErrors.firstName}
                </Text>
              ) : null}

              <Text style={styles.editUserLabel}>Middle Name</Text>
              <TextInput
                style={[
                  styles.editUserInput,
                  validationErrors.middleName && styles.editUserInputError,
                ]}
                value={editUser.middleName}
                onChangeText={(text) => {
                  setEditUser({ ...editUser, middleName: text });
                  setValidationErrors({
                    ...validationErrors,
                    middleName: text ? validateName(text, "Middle name") : "",
                  });
                }}
                placeholder="Enter middle name"
              />
              {validationErrors.middleName ? (
                <Text style={styles.errorText}>
                  {validationErrors.middleName}
                </Text>
              ) : null}

              <Text style={styles.editUserLabel}>
                Last Name<Text style={styles.requiredAsterisk}> *</Text>
              </Text>
              <TextInput
                style={[
                  styles.editUserInput,
                  validationErrors.lastName && styles.editUserInputError,
                ]}
                value={editUser.lastName}
                onChangeText={(text) => {
                  setEditUser({ ...editUser, lastName: text });
                  setValidationErrors({
                    ...validationErrors,
                    lastName: validateName(text, "Last name"),
                  });
                }}
                placeholder="Enter last name"
              />
              {validationErrors.lastName ? (
                <Text style={styles.errorText}>
                  {validationErrors.lastName}
                </Text>
              ) : null}

              <Text style={styles.editUserLabel}>
                Email<Text style={styles.requiredAsterisk}> *</Text>
              </Text>
              <TextInput
                style={[
                  styles.editUserInput,
                  validationErrors.email && styles.editUserInputError,
                ]}
                value={editUser.email}
                onChangeText={(text) => {
                  setEditUser({ ...editUser, email: text });
                  setValidationErrors({
                    ...validationErrors,
                    email: validateEmail(text),
                  });
                }}
                placeholder="Email"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              {validationErrors.email ? (
                <Text style={styles.errorText}>{validationErrors.email}</Text>
              ) : null}

              <Text style={styles.editUserLabel}>
                Mobile Number<Text style={styles.requiredAsterisk}> *</Text>
              </Text>
              <TextInput
                style={[
                  styles.editUserInput,
                  validationErrors.phone && styles.editUserInputError,
                ]}
                value={editUser.phone}
                onChangeText={(text) => {
                  setEditUser({ ...editUser, phone: text });
                  setValidationErrors({
                    ...validationErrors,
                    phone: validatePhone(text),
                  });
                }}
                placeholder="+639xxxxxxxxx"
                keyboardType="phone-pad"
              />
              {validationErrors.phone ? (
                <Text style={styles.errorText}>{validationErrors.phone}</Text>
              ) : null}

              <Text style={styles.editUserLabel}>
                Role<Text style={styles.requiredAsterisk}> *</Text>
              </Text>
              <View style={styles.roleFieldContainer}>
                <View style={styles.roleFieldWrapper}>
                  <TouchableOpacity
                    onPress={() => setRoleOpen((o) => !o)}
                    style={styles.editUserPicker}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.roleValueText}>{editUser.role}</Text>
                    <MaterialCommunityIcons
                      name={roleOpen ? "chevron-up" : "chevron-down"}
                      size={20}
                      color="#000"
                    />
                  </TouchableOpacity>

                  {roleOpen && (
                    <View style={styles.roleDropdown}>
                      {roles.map((r) => (
                        <TouchableOpacity
                          key={r}
                          style={styles.roleOption}
                          onPress={() => {
                            setEditUser({ ...editUser, role: r });
                            setRoleOpen(false);
                          }}
                        >
                          <Text style={styles.roleOptionText}>{r}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.editUserButtonRow}>
                <TouchableOpacity
                  style={[
                    styles.editUserCancelBtn,
                    cancelBtnPressed && styles.btnPressedBg,
                  ]}
                  activeOpacity={0.8}
                  onPressIn={() => setCancelBtnPressed(true)}
                  onPressOut={() => setCancelBtnPressed(false)}
                  onPress={() => {
                    console.log("Cancel pressed");
                    setEditModalVisible(false);
                    setRoleOpen(false);
                  }}
                >
                  <MaterialCommunityIcons
                    name="close"
                    size={20}
                    color={cancelBtnPressed ? "#fff" : "#000"}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[
                      styles.editUserCancelBtnText,
                      cancelBtnPressed && { color: "#fff" },
                    ]}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.editUserSaveBtn,
                    saveBtnPressed && styles.editUserSaveBtnPressed,
                  ]}
                  activeOpacity={0.8}
                  onPressIn={() => setSaveBtnPressed(true)}
                  onPressOut={() => setSaveBtnPressed(false)}
                  onPress={() => {
                    console.log("Update pressed");
                    handleSaveUser();
                  }}
                >
                  <MaterialCommunityIcons
                    name="check"
                    size={20}
                    color="#fff"
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.editUserSaveBtnText}>Update</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Save success modal */}
      <Modal
        transparent
        visible={savedVisible}
        animationType="fade"
        onRequestClose={() => setSavedVisible(false)}
      >
        <View style={styles.overlay}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => setSavedVisible(false)}
          >
            <View style={styles.savedCard}>
              <View style={styles.iconOuter}>
                <View style={styles.iconInner}>
                  <MaterialCommunityIcons
                    name="check"
                    size={36}
                    color="#22C55E"
                  />
                </View>
              </View>
              <Text style={styles.savedText}>Saved Successful!</Text>
            </View>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Force Password Change Modal */}
      <Modal
        transparent
        visible={forcePasswordVisible}
        animationType="fade"
        onRequestClose={() => setForcePasswordVisible(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.passwordChangeModal}>
            <Text style={styles.passwordChangeTitle}>
              Force Password Change
            </Text>
            <Text style={styles.passwordChangeMessage}>
              Are you sure you want to force {selectedUser?.firstName}{" "}
              {selectedUser?.lastName} to reset his password?{"\n"}
              User will be notified and required to create a new password next
              login.
            </Text>

            <TouchableOpacity
              style={[
                styles.confirmButton,
                confirmBtnPressed && styles.confirmButtonPressed,
              ]}
              activeOpacity={0.8}
              onPressIn={() => setConfirmBtnPressed(true)}
              onPressOut={() => setConfirmBtnPressed(false)}
              onPress={handleConfirmPasswordChange}
            >
              <Text
                style={[
                  styles.confirmButtonText,
                  confirmBtnPressed && styles.confirmButtonTextPressed,
                ]}
              >
                Confirm
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.cancelPasswordButton,
                cancelPasswordBtnPressed && styles.cancelPasswordButtonPressed,
              ]}
              activeOpacity={0.8}
              onPressIn={() => setCancelPasswordBtnPressed(true)}
              onPressOut={() => setCancelPasswordBtnPressed(false)}
              onPress={() => {
                setForcePasswordVisible(false);
                setSelectedUser(null);
              }}
            >
              <Text
                style={[
                  styles.cancelPasswordButtonText,
                  cancelPasswordBtnPressed &&
                    styles.cancelPasswordButtonTextPressed,
                ]}
              >
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Password Reset Success Modal */}
      <Modal
        transparent
        visible={passwordResetSuccessVisible}
        animationType="fade"
      >
        <View style={styles.overlay}>
          <View style={styles.passwordResetSuccessModal}>
            <View style={styles.successIconContainer}>
              <MaterialCommunityIcons name="check" size={48} color="#4CAF50" />
            </View>
            <Text style={styles.passwordResetSuccessTitle}>
              Force Password Reset
            </Text>

            <Text style={styles.passwordResetSuccessLoading}>
              User will be prompted to change password on next login.
            </Text>
          </View>
        </View>
      </Modal>

      {/* Delete User Modal */}
      <Modal
        transparent
        visible={deleteUserVisible}
        animationType="fade"
        onRequestClose={() => setDeleteUserVisible(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.deleteUserModal}>
            <Text style={styles.deleteUserTitle}>Remove User Access</Text>
            <Text style={styles.deleteUserMessage}>
              Are you sure you want to remove {selectedUser?.firstName}{" "}
              {selectedUser?.lastName}?{"\n"}
              This will mark account as inactive and immediately disable all
              login access.
            </Text>

            <TouchableOpacity
              style={[
                styles.deleteConfirmButton,
                deleteConfirmBtnPressed && styles.deleteConfirmButtonPressed,
              ]}
              activeOpacity={0.8}
              onPressIn={() => setDeleteConfirmBtnPressed(true)}
              onPressOut={() => setDeleteConfirmBtnPressed(false)}
              onPress={handleConfirmDelete}
            >
              <Text
                style={[
                  styles.deleteConfirmButtonText,
                  deleteConfirmBtnPressed &&
                    styles.deleteConfirmButtonTextPressed,
                ]}
              >
                Confirm
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.deleteCancelButton,
                deleteCancelBtnPressed && styles.deleteCancelButtonPressed,
              ]}
              activeOpacity={0.8}
              onPressIn={() => setDeleteCancelBtnPressed(true)}
              onPressOut={() => setDeleteCancelBtnPressed(false)}
              onPress={() => {
                setDeleteUserVisible(false);
                setSelectedUser(null);
              }}
            >
              <Text
                style={[
                  styles.deleteCancelButtonText,
                  deleteCancelBtnPressed &&
                    styles.deleteCancelButtonTextPressed,
                ]}
              >
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Delete Success Modal */}
      <Modal transparent visible={deleteSuccessVisible} animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.deleteSuccessModal}>
            <View style={styles.successIconContainer}>
              <MaterialCommunityIcons name="check" size={48} color="#4CAF50" />
            </View>
            <Text style={styles.deleteSuccessTitle}>
              Account marked as inactive
            </Text>
            <Text style={styles.deleteSuccessSubtitle}>Access disabled</Text>
            <Text style={styles.deleteSuccessLoading}>
              Loading your dashboard...
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

const COLUMN_PADDING = 12;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#fff",
  },
  searchFiltersWrapper: {
    backgroundColor: "#fff",
    paddingHorizontal: 18,
    paddingTop: 0,
    paddingBottom: 12,
    zIndex: 10,
  },
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingHorizontal: 18,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F7F9FB",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#E3E8EF",
    marginBottom: 10,
    width: "100%",
    zIndex: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#222",
  },
  filtersRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
    gap: 12,
    marginBottom: 10,
    width: "100%",
    zIndex: 20,
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E3E8EF",
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 10,
  },
  filterText: {
    color: "#000",
    fontWeight: "500",
    fontSize: 15,
    marginRight: 2,
  },
  userListCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E3E8EF",
    marginBottom: 18,
    marginTop: 4,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    minWidth: 700,
    width: "auto",
    alignSelf: "flex-start",
  },
  userListTitle: {
    fontSize: 17,
    fontWeight: "bold",
    color: "#222",
    marginBottom: 12,
  },
  userListHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E3E8EF",
    paddingBottom: 10,
    marginBottom: 2,
    width: "100%",
  },
  userListHeaderText: {
    fontWeight: "700",
    color: "#222",
    fontSize: 15,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    minHeight: 60,
    width: "100%",
  },
  nameColHeader: {
    width: 150,
    justifyContent: "center",
    alignItems: "flex-start",
    paddingLeft: COLUMN_PADDING,
    paddingRight: COLUMN_PADDING,
  },
  contactColHeader: {
    width: 240,
    justifyContent: "center",
    alignItems: "flex-start",
    paddingLeft: COLUMN_PADDING,
    paddingRight: COLUMN_PADDING,
  },
  roleColHeader: {
    width: 120,
    justifyContent: "center",
    alignItems: "center",
    paddingLeft: COLUMN_PADDING,
    paddingRight: COLUMN_PADDING,
  },
  createdColHeader: {
    width: 120,
    justifyContent: "center",
    alignItems: "center",
    paddingLeft: COLUMN_PADDING,
    paddingRight: COLUMN_PADDING,
  },
  statusColHeader: {
    width: 100,
    justifyContent: "center",
    alignItems: "center",
    paddingLeft: COLUMN_PADDING,
    paddingRight: COLUMN_PADDING,
  },
  actionsColHeader: {
    width: 120,
    justifyContent: "center",
    alignItems: "center",
    paddingLeft: COLUMN_PADDING,
    paddingRight: COLUMN_PADDING,
  },
  nameCol: {
    width: 150,
    justifyContent: "center",
    alignItems: "flex-start",
    paddingLeft: COLUMN_PADDING,
    paddingRight: COLUMN_PADDING,
    minHeight: 60,
  },
  contactCol: {
    width: 240,
    justifyContent: "center",
    alignItems: "flex-start",
    paddingLeft: COLUMN_PADDING,
    paddingRight: COLUMN_PADDING,
    minHeight: 60,
  },
  roleCol: {
    width: 120,
    justifyContent: "center",
    alignItems: "center",
    paddingLeft: COLUMN_PADDING,
    paddingRight: COLUMN_PADDING,
    minHeight: 60,
  },
  createdCol: {
    width: 120,
    justifyContent: "center",
    alignItems: "center",
    paddingLeft: COLUMN_PADDING,
    paddingRight: COLUMN_PADDING,
    minHeight: 60,
  },
  statusCol: {
    width: 100,
    justifyContent: "center",
    alignItems: "center",
    paddingLeft: COLUMN_PADDING,
    paddingRight: COLUMN_PADDING,
    minHeight: 60,
  },
  actionsCol: {
    width: 120,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingLeft: COLUMN_PADDING,
    paddingRight: COLUMN_PADDING,
    minHeight: 60,
    gap: 12,
  },
  userName: {
    fontWeight: "600",
    fontSize: 15,
    color: "#222",
    lineHeight: 20,
  },
  userContact: {
    fontSize: 14,
    color: "#444",
    lineHeight: 18,
    flex: 1,
  },
  roleCell: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "#E3EAFD",
    borderRadius: 20,
    gap: 6,
  },
  roleBadgeText: {
    fontWeight: "600",
    fontSize: 14,
    textTransform: "capitalize",
    lineHeight: 18,
  },
  createdDate: {
    fontSize: 14,
    color: "#444",
    textAlign: "center",
    lineHeight: 18,
  },
  statusText: {
    fontSize: 14,
    color: "#444",
    textAlign: "center",
    lineHeight: 18,
    fontWeight: "500",
  },
  horizontalScroll: {
    marginBottom: 18,
  },
  contactColumn: {
    flexDirection: "column",
    alignItems: "flex-start",
    justifyContent: "center",
    gap: 4,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  editUserModal: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 32,
    width: "90%",
    maxWidth: 480,
    maxHeight: "85%",
  },
  editUserTitle: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 20,
    color: "#133E87",
    textAlign: "center",
  },
  editUserLabel: {
    fontSize: 15,
    marginBottom: 6,
    color: "#222",
  },
  requiredAsterisk: {
    color: "#c41e3a",
    fontSize: 15,
    fontWeight: "700",
  },
  editUserInput: {
    borderWidth: 1,
    borderColor: "#C9D3E0",
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
    backgroundColor: "#fff",
    fontSize: 15,
  },
  editUserInputError: {
    borderColor: "#c41e3a",
    borderWidth: 1.5,
  },
  errorText: {
    color: "#c41e3a",
    fontSize: 13,
    marginBottom: 10,
    marginTop: 2,
  },
  roleFieldContainer: {
    width: "100%",
    alignSelf: "flex-start",
  },
  roleFieldWrapper: {
    position: "relative",
    marginBottom: 18,
  },
  editUserPicker: {
    borderWidth: 1,
    borderColor: "rgba(13, 96, 156, 0.76)",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: "#fff",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  roleValueText: {
    color: "#000",
    fontSize: 15,
    fontWeight: "600",
  },
  roleDropdown: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#C9D3E0",
    borderRadius: 10,
    marginTop: 6,
    overflow: "hidden",
    zIndex: 20,
  },
  roleOption: {
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  roleOptionText: {
    color: "#000",
    fontSize: 15,
    fontWeight: "500",
  },
  editUserButtonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  editUserCancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#C9D3E0",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginRight: 8,
    flexDirection: "row",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  editUserCancelBtnText: {
    color: "#000",
    fontWeight: "600",
    fontSize: 16,
  },
  editUserSaveBtn: {
    flex: 1,
    backgroundColor: "#133E87",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginLeft: 8,
    flexDirection: "row",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#133E87",
  },
  editUserSaveBtnPressed: {
    backgroundColor: "#234187",
    borderColor: "#234187",
  },
  editUserSaveBtnText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  btnPressedBg: {
    backgroundColor: "#133E87",
    borderColor: "#133E87",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  savedCard: {
    width: 300,
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  iconOuter: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: "#E8FBE8",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  iconInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#fff",
    borderWidth: 4,
    borderColor: "#22C55E",
    justifyContent: "center",
    alignItems: "center",
  },
  savedText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#234187",
  },
  fullscreenDismiss: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 5,
    backgroundColor: "transparent",
  },
  filterDropdownWrapper: {
    position: "relative",
    zIndex: 30,
  },
  filterDropdown: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    marginTop: 6,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E3E8EF",
    borderRadius: 10,
    overflow: "hidden",
    zIndex: 40,
  },
  filterDropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  filterDropdownItemText: {
    fontSize: 15,
    color: "#000",
    fontWeight: "500",
  },
  // Force Password Change Modal Styles
  passwordChangeModal: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 32,
    width: "85%",
    maxWidth: 400,
    alignItems: "center",
  },
  passwordChangeTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#DC2626",
    marginBottom: 16,
    textAlign: "center",
  },
  passwordChangeMessage: {
    fontSize: 15,
    color: "#444",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  confirmButton: {
    width: "100%",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 12,
  },
  confirmButtonPressed: {
    backgroundColor: "#133E87",
    borderColor: "#133E87",
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
  },
  confirmButtonTextPressed: {
    color: "#fff",
  },
  cancelPasswordButton: {
    width: "100%",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
  },
  cancelPasswordButtonPressed: {
    backgroundColor: "#133E87",
    borderColor: "#133E87",
  },
  cancelPasswordButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
  },
  cancelPasswordButtonTextPressed: {
    color: "#fff",
  },
  // Password Reset Success Modal Styles
  passwordResetSuccessModal: {
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
  passwordResetSuccessTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#133E87",
    textAlign: "center",
    marginBottom: 8,
  },
  passwordResetSuccessSubtitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#133E87",
    textAlign: "center",
    marginBottom: 20,
  },
  passwordResetSuccessLoading: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
  // Delete User Modal Styles
  deleteUserModal: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 32,
    width: "85%",
    maxWidth: 400,
    alignItems: "center",
  },
  deleteUserTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#DC2626",
    marginBottom: 16,
    textAlign: "center",
  },
  deleteUserMessage: {
    fontSize: 15,
    color: "#444",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  deleteConfirmButton: {
    width: "100%",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 12,
  },
  deleteConfirmButtonPressed: {
    backgroundColor: "#133E87",
    borderColor: "#133E87",
  },
  deleteConfirmButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
  },
  deleteConfirmButtonTextPressed: {
    color: "#fff",
  },
  deleteCancelButton: {
    width: "100%",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
  },
  deleteCancelButtonPressed: {
    backgroundColor: "#133E87",
    borderColor: "#133E87",
  },
  deleteCancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
  },
  deleteCancelButtonTextPressed: {
    color: "#fff",
  },
  // Delete Success Modal Styles
  deleteSuccessModal: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 40,
    width: "90%",
    maxWidth: 400,
    alignItems: "center",
  },
  deleteSuccessTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#133E87",
    textAlign: "center",
    marginBottom: 8,
  },
  deleteSuccessSubtitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#133E87",
    textAlign: "center",
    marginBottom: 20,
  },
  deleteSuccessLoading: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
  // Create Account Action Card Styles
  createAccountCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 18,
    marginTop: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(13,96,156,0.21)",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    paddingVertical: 4,
  },
  backButtonText: {
    fontSize: 16,
    color: "#133E87",
    fontWeight: "500",
    marginLeft: 8,
  },
  createAccountRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  createAccountIcon: {
    marginRight: 12,
  },
  createAccountTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000000",
    marginBottom: 4,
  },
  createAccountDesc: {
    fontSize: 14,
    color: "#5A6B7B",
    lineHeight: 18,
    marginBottom: 8,
  },
  createAccountButton: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 4,
    borderWidth: 1.5,
    borderColor: "#234187",
  },
  createAccountButtonText: {
    color: "#000",
    fontSize: 17,
    fontWeight: "500",
    textAlign: "center",
    letterSpacing: 0.2,
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
