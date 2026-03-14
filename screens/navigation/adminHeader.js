import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StatusBar,
  SafeAreaView,
  Modal,
} from "react-native";
import { Image } from "react-native";
import Icon from "react-native-vector-icons/Feather";
import { useNavigation } from "@react-navigation/native";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { auth, db } from "../../config/firebaseconfig";
import { signOut } from "firebase/auth";
import { doc, updateDoc, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useAdminNotifications } from "../Admin/AdminNotificationContext";

const MenuIcon = ({ size = 22, color = "#1a1a1a", style, ...props }) => (
  <View
    style={[
      {
        width: size,
        height: size,
        justifyContent: "center",
        alignItems: "center",
      },
      style,
    ]}
    {...props}
  >
    <View
      style={{
        width: size,
        height: 2.5,
        backgroundColor: color,
        marginBottom: 5,
        borderRadius: 1,
      }}
    />
    <View
      style={{
        width: size,
        height: 2.5,
        backgroundColor: color,
        marginBottom: 5,
        borderRadius: 1,
      }}
    />
    <View
      style={{
        width: size,
        height: 2.5,
        backgroundColor: color,
        borderRadius: 1,
      }}
    />
  </View>
);

export default function Header2() {
  const navigation = useNavigation();
  const { unreadCount } = useAdminNotifications();
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [confirmBtnPressed, setConfirmBtnPressed] = useState(false);
  const [cancelBtnPressed, setCancelBtnPressed] = useState(false);

  const handleNotificationPress = () => {
    navigation.navigate("AdminNotification");
  };

  const handleLogoutPress = () => {
    setLogoutModalVisible(true);
  };

  const handleConfirmLogout = async () => {
    try {
      const currentUser = auth.currentUser;

      // Log logout event to session_logs collection (non-blocking)
      if (currentUser) {
        try {
          await addDoc(collection(db, "session_logs"), {
            userId: currentUser.uid,
            action: "Log out",
            description: "Logged out",
            timestamp: serverTimestamp(),
            deviceInfo: Platform.OS,
            email: currentUser.email,
          });
          console.log("📝 Admin logout event logged to session_logs");
        } catch (logError) {
          console.log(
            "⚠️ Failed to log admin logout event (non-critical):",
            logError.message,
          );
        }

        try {
          await updateDoc(doc(db, "users", currentUser.uid), {
            isLoggedIn: false
          });
        } catch (e) {
          console.log("Failed to update isLoggedIn status:", e);
        }
      }

      // Sign out from Firebase
      await signOut(auth);

      // Clear stored admin data
      await AsyncStorage.removeItem("isAdminBypass");
      await AsyncStorage.removeItem("adminEmail");

      console.log("Admin logged out successfully");
      setLogoutModalVisible(false);

      // Navigate to Login screen and reset navigation stack
      navigation.reset({
        index: 0,
        routes: [{ name: "LogIn" }],
      });
    } catch (error) {
      console.error("Logout error:", error);
      setLogoutModalVisible(false);
    }
  };

  const handleCancelLogout = () => {
    setLogoutModalVisible(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View style={styles.header}>
        <View style={styles.leftSection}>
          <TouchableOpacity
            style={styles.logoContainer}
            onPress={() => navigation.navigate("AdminDashboard")}
            activeOpacity={0.7}
          >
            <Image
              source={require("../../assets/logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>

        <View style={styles.centerSection}>
          <Text style={styles.headerText}>My Brooder</Text>
        </View>

        <View style={styles.rightSection}>
          <TouchableOpacity
            style={styles.iconButton}
            activeOpacity={0.7}
            onPress={handleNotificationPress}
          >
            <Icon name="bell" size={22} color="#1a1a1a" />
            {unreadCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>
                  {unreadCount > 9 ? "9+" : String(unreadCount)}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconButton}
            activeOpacity={0.7}
            onPress={handleLogoutPress}
          >
            <Icon name="log-out" size={22} color="#1a1a1a" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Logout Confirmation Modal */}
      <Modal
        transparent
        visible={logoutModalVisible}
        animationType="fade"
        onRequestClose={() => setLogoutModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.logoutModal}>
            <View style={styles.warningIconContainer}>
              <MaterialCommunityIcons
                name="logout"
                size={48}
                color="#DC2626"
              />
            </View>
            <Text style={styles.logoutTitle}>Logout</Text>
            <Text style={styles.logoutMessage}>
              Are you sure you want to logout?
            </Text>

            <TouchableOpacity
              style={[
                styles.cancelLogoutButton,
                cancelBtnPressed && styles.cancelLogoutButtonPressed,
              ]}
              activeOpacity={0.8}
              onPressIn={() => setCancelBtnPressed(true)}
              onPressOut={() => setCancelBtnPressed(false)}
              onPress={handleCancelLogout}
            >
              <Text
                style={[
                  styles.cancelLogoutButtonText,
                  cancelBtnPressed && styles.cancelLogoutButtonTextPressed,
                ]}
              >
                Cancel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.confirmLogoutButton,
                confirmBtnPressed && styles.confirmLogoutButtonPressed,
              ]}
              activeOpacity={0.8}
              onPressIn={() => setConfirmBtnPressed(true)}
              onPressOut={() => setConfirmBtnPressed(false)}
              onPress={handleConfirmLogout}
            >
              <Text
                style={[
                  styles.confirmLogoutButtonText,
                  confirmBtnPressed && styles.confirmLogoutButtonTextPressed,
                ]}
              >
                Logout
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: "#ffffff",
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight || 24 : 0,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  leftSection: {
    width: 48,
    alignItems: "flex-start",
  },
  logoContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 60,
  },
  centerSection: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none",
  },
  rightSection: {
    width: 88,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
  },
  headerText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1a1a1a",
    textAlign: "center",
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  notificationBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#ef4444",
    justifyContent: "center",
    alignItems: "center",
  },
  notificationBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#ffffff",
  },
  // Logout Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  logoutModal: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 32,
    width: "90%",
    maxWidth: 400,
    alignItems: "center",
  },
  warningIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#FEE2E2",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  logoutTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#000",
    marginBottom: 12,
    textAlign: "center",
  },
  logoutMessage: {
    fontSize: 15,
    color: "#777",
    textAlign: "center",
    marginBottom: 24,
  },
  cancelLogoutButton: {
    width: "100%",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 12,
  },
  cancelLogoutButtonPressed: {
    backgroundColor: "#F3F4F6",
    borderColor: "#9CA3AF",
  },
  cancelLogoutButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6B7280",
  },
  cancelLogoutButtonTextPressed: {
    color: "#4B5563",
  },
  confirmLogoutButton: {
    width: "100%",
    backgroundColor: "#EF4444",
    borderWidth: 1,
    borderColor: "#EF4444",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
  },
  confirmLogoutButtonPressed: {
    backgroundColor: "#DC2626",
    borderColor: "#DC2626",
  },
  confirmLogoutButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  confirmLogoutButtonTextPressed: {
    color: "#fff",
  },
});
