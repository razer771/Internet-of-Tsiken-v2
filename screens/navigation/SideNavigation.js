import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Platform,
  StatusBar,
  Modal,
  Animated,
  Dimensions,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { CommonActions } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { auth, db } from "../../config/firebaseconfig";
import { signOut } from "firebase/auth";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

const Icon = Feather;

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function SideNavigation({ visible, onClose, navigation }) {
  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SCREEN_WIDTH,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleMenuItemPress = (item) => {
    console.log(`[SideNavigation] Menu item clicked: ${item}`);
    console.log("[SideNavigation] Navigation object exists:", !!navigation);
    onClose();

    if (item === "Reports" && navigation) {
      console.log("[SideNavigation] Attempting to navigate to Reports screen");
      try {
        navigation.reset({
          index: 0,
          routes: [{ name: "Reports" }],
        });
        console.log("[SideNavigation] Navigate successful");
      } catch (error) {
        console.error("[SideNavigation] Navigation error:", error);
      }
    } else if (item === "Activity Logs" && navigation) {
      console.log(
        "[SideNavigation] Attempting to navigate to Activity Logs screen"
      );
      try {
        navigation.navigate("ActivityLogs");
        console.log("[SideNavigation] Navigate to Activity Logs successful");
      } catch (error) {
        console.error("[SideNavigation] Navigation error:", error);
      }
    } else if (item === "User Profile" && navigation) {
      console.log(
        "[SideNavigation] Attempting to navigate to UserProfile screen"
      );
      try {
        navigation.navigate("UserProfile");
        console.log("[SideNavigation] Navigate to UserProfile successful");
      } catch (error) {
        console.error("[SideNavigation] Navigation error:", error);
      }
    } else if (item === "Settings" && navigation) {
      console.log("[SideNavigation] Attempting to navigate to Settings screen");
      try {
        navigation.navigate("Settings");
        console.log("[SideNavigation] Navigate to Settings successful");
      } catch (error) {
        console.error("[SideNavigation] Navigation error:", error);
      }
    }
  };

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = async () => {
    try {
      const currentUser = auth.currentUser;

      // Log logout event to session_logs collection (non-blocking)
      if (currentUser) {
        try {
          await addDoc(collection(db, "session_logs"), {
            userId: currentUser.uid,
            action: "logout",
            description: "Logged out",
            timestamp: serverTimestamp(),
            deviceInfo: Platform.OS,
            email: currentUser.email,
          });
          console.log("📝 Logout event logged to session_logs");
        } catch (logError) {
          console.log(
            "⚠️ Failed to log logout event (non-critical):",
            logError.message
          );
        }
      }

      // Sign out from Firebase
      await signOut(auth);

      // Clear stored data
      await AsyncStorage.removeItem("isAdminBypass");
      await AsyncStorage.removeItem("adminEmail");
      await AsyncStorage.removeItem("chicksCount");
      await AsyncStorage.removeItem("daysCount");

      console.log("Logged out successfully");
      setShowLogoutModal(false);
      onClose();

      // Navigate to Login screen and reset navigation stack
      navigation.reset({
        index: 0,
        routes: [{ name: "LogIn" }],
      });
    } catch (error) {
      console.error("Logout error:", error);
      setShowLogoutModal(false);
    }
  };

  const cancelLogout = () => {
    setShowLogoutModal(false);
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Animated.View
        style={[
          styles.modalOverlay,
          {
            opacity: fadeAnim,
          },
        ]}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />
        <Animated.View
          style={[
            styles.menuContainer,
            {
              transform: [{ translateX: slideAnim }],
            },
          ]}
        >
          <View style={styles.menuHeader}>
            <Text style={styles.menuHeaderText}>Menu</Text>
          </View>

          <View style={styles.menuContent}>
            <Pressable
              style={styles.menuItem}
              onPress={() => handleMenuItemPress("User Profile")}
            >
              {({ pressed }) => (
                <View
                  style={[
                    styles.menuItemInner,
                    pressed && styles.menuItemPressed,
                  ]}
                >
                  <Icon
                    name="user"
                    size={20}
                    color={pressed ? "#ffffff" : "#1a1a1a"}
                  />
                  <Text
                    style={[
                      styles.menuItemText,
                      pressed && styles.menuItemTextPressed,
                    ]}
                  >
                    User Profile
                  </Text>
                </View>
              )}
            </Pressable>

            <Pressable
              style={styles.menuItem}
              onPress={() => handleMenuItemPress("Activity Logs")}
            >
              {({ pressed }) => (
                <View
                  style={[
                    styles.menuItemInner,
                    pressed && styles.menuItemPressed,
                  ]}
                >
                  <Icon
                    name="activity"
                    size={20}
                    color={pressed ? "#ffffff" : "#1a1a1a"}
                  />
                  <Text
                    style={[
                      styles.menuItemText,
                      pressed && styles.menuItemTextPressed,
                    ]}
                  >
                    Activity Logs
                  </Text>
                </View>
              )}
            </Pressable>

            <Pressable
              style={styles.menuItem}
              onPress={() => handleMenuItemPress("Reports")}
            >
              {({ pressed }) => (
                <View
                  style={[
                    styles.menuItemInner,
                    pressed && styles.menuItemPressed,
                  ]}
                >
                  <Icon
                    name="file-text"
                    size={20}
                    color={pressed ? "#ffffff" : "#1a1a1a"}
                  />
                  <Text
                    style={[
                      styles.menuItemText,
                      pressed && styles.menuItemTextPressed,
                    ]}
                  >
                    Reports
                  </Text>
                </View>
              )}
            </Pressable>

            <Pressable
              style={styles.menuItem}
              onPress={() => handleMenuItemPress("Settings")}
            >
              {({ pressed }) => (
                <View
                  style={[
                    styles.menuItemInner,
                    pressed && styles.menuItemPressed,
                  ]}
                >
                  <Icon
                    name="info"
                    size={20}
                    color={pressed ? "#ffffff" : "#1a1a1a"}
                  />
                  <Text
                    style={[
                      styles.menuItemText,
                      pressed && styles.menuItemTextPressed,
                    ]}
                  >
                    App Info
                  </Text>
                </View>
              )}
            </Pressable>
          </View>

          <View style={styles.menuFooter}>
            <Pressable style={styles.logoutButton} onPress={handleLogout}>
              {({ pressed }) => (
                <View
                  style={[
                    styles.logoutButtonInner,
                    pressed && styles.logoutButtonPressed,
                  ]}
                >
                  <Icon
                    name="log-out"
                    size={20}
                    color={pressed ? "#ffffff" : "#ef4444"}
                  />
                  <Text
                    style={[
                      styles.logoutText,
                      pressed && styles.logoutTextPressed,
                    ]}
                  >
                    Logout
                  </Text>
                </View>
              )}
            </Pressable>
          </View>
        </Animated.View>
      </Animated.View>

      {/* Logout Confirmation Modal */}
      <Modal
        visible={showLogoutModal}
        transparent={true}
        animationType="fade"
        onRequestClose={cancelLogout}
      >
        <View style={styles.logoutModalOverlay}>
          <View style={styles.logoutModalContainer}>
            <View style={styles.logoutModalIconContainer}>
              <Icon name="log-out" size={32} color="#ef4444" />
            </View>
            <Text style={styles.logoutModalTitle}>Logout</Text>
            <Text style={styles.logoutModalMessage}>
              Are you sure you want to logout?
            </Text>

            <View style={styles.logoutModalButtons}>
              <Pressable
                onPress={cancelLogout}
                style={styles.logoutModalCancelButton}
              >
                {({ pressed }) => (
                  <View
                    style={[
                      styles.logoutModalButtonInner,
                      pressed && styles.logoutModalButtonPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.logoutModalCancelText,
                        pressed && styles.logoutModalButtonTextPressed,
                      ]}
                    >
                      Cancel
                    </Text>
                  </View>
                )}
              </Pressable>

              <Pressable
                onPress={confirmLogout}
                style={styles.logoutModalConfirmButton}
              >
                {({ pressed }) => (
                  <View
                    style={[
                      styles.logoutModalConfirmInner,
                      pressed && styles.logoutModalConfirmPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.logoutModalConfirmText,
                        pressed && styles.logoutModalConfirmTextPressed,
                      ]}
                    >
                      Logout
                    </Text>
                  </View>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-start",
    alignItems: "flex-end",
  },
  menuContainer: {
    width: "50%",
    maxWidth: 200,
    backgroundColor: "#ffffff",
    height: "100%",
    shadowColor: "#000",
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 10,
  },
  menuHeader: {
    backgroundColor: "#154b99",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingTop:
      Platform.OS === "android" ? (StatusBar.currentHeight || 24) + 16 : 60,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  menuHeaderText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#ffffff",
  },
  menuContent: {
    flex: 1,
    paddingTop: 8,
    backgroundColor: "#ffffff",
  },
  menuItem: {
    backgroundColor: "#ffffff",
  },
  menuItemInner: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginHorizontal: 8,
    borderWidth: 1,
    borderColor: "transparent",
  },
  menuItemPressed: {
    backgroundColor: "#154b99",
    borderColor: "#154b99",
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1a1a1a",
    marginLeft: 10,
  },
  menuItemTextPressed: {
    color: "#ffffff",
  },
  menuFooter: {
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingBottom: Platform.OS === "android" ? 24 : 40,
    backgroundColor: "#ffffff",
  },
  logoutButton: {},
  logoutButtonInner: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginHorizontal: 8,
    borderWidth: 1,
    borderColor: "transparent",
  },
  logoutButtonPressed: {
    backgroundColor: "#ef4444",
    borderColor: "#ef4444",
  },
  logoutText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#ef4444",
    marginLeft: 10,
  },
  logoutTextPressed: {
    color: "#ffffff",
  },
  // Logout Modal Styles
  logoutModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  logoutModalContainer: {
    width: "80%",
    maxWidth: 320,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
  },
  logoutModalIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#fef2f2",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  logoutModalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 8,
  },
  logoutModalMessage: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    marginBottom: 24,
  },
  logoutModalButtons: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  logoutModalCancelButton: {
    flex: 1,
  },
  logoutModalButtonInner: {
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
  },
  logoutModalButtonPressed: {
    backgroundColor: "#f1f5f9",
  },
  logoutModalCancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#64748b",
  },
  logoutModalButtonTextPressed: {
    color: "#1a1a1a",
  },
  logoutModalConfirmButton: {
    flex: 1,
  },
  logoutModalConfirmInner: {
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#ef4444",
    alignItems: "center",
  },
  logoutModalConfirmPressed: {
    backgroundColor: "#dc2626",
  },
  logoutModalConfirmText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#ffffff",
  },
  logoutModalConfirmTextPressed: {
    color: "#ffffff",
  },
});
