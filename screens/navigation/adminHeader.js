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
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [confirmBtnPressed, setConfirmBtnPressed] = useState(false);
  const [cancelBtnPressed, setCancelBtnPressed] = useState(false);

  const handleNotificationPress = () => {
    navigation.navigate("Notification");
  };

  const handleLogoutPress = () => {
    setLogoutModalVisible(true);
  };

  const handleConfirmLogout = () => {
    console.log("Logout confirmed");
    setLogoutModalVisible(false);
    navigation.replace("Login");
  };

  const handleCancelLogout = () => {
    setLogoutModalVisible(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View style={styles.header}>
        <View style={styles.leftSection}>
          <View style={styles.logoContainer}>
            <Image
              source={require("../../assets/logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
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
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationBadgeText}>2</Text>
            </View>
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
              <MaterialCommunityIcons name="alert-outline" size={48} color="#DC2626" />
            </View>
            <Text style={styles.logoutTitle}>Confirm Logout</Text>
            <Text style={styles.logoutMessage}>Are you sure you want to log out?</Text>
            
            <TouchableOpacity
              style={[
                styles.confirmLogoutButton,
                confirmBtnPressed && styles.confirmLogoutButtonPressed
              ]}
              activeOpacity={0.8}
              onPressIn={() => setConfirmBtnPressed(true)}
              onPressOut={() => setConfirmBtnPressed(false)}
              onPress={handleConfirmLogout}
            >
              <Text style={[
                styles.confirmLogoutButtonText,
                confirmBtnPressed && styles.confirmLogoutButtonTextPressed
              ]}>
                Confirm
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.cancelLogoutButton,
                cancelBtnPressed && styles.cancelLogoutButtonPressed
              ]}
              activeOpacity={0.8}
              onPressIn={() => setCancelBtnPressed(true)}
              onPressOut={() => setCancelBtnPressed(false)}
              onPress={handleCancelLogout}
            >
              <Text style={[
                styles.cancelLogoutButtonText,
                cancelBtnPressed && styles.cancelLogoutButtonTextPressed
              ]}>
                Cancel
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
    borderBottomColor: "#f0f0f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 4,
  },
  leftSection: {
    flex: 1,
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
    flex: 2,
    alignItems: "center",
    paddingHorizontal: 8,
  },
  rightSection: {
    flex: 1,
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
    color: "#DC2626",
    marginBottom: 12,
    textAlign: "center",
  },
  logoutMessage: {
    fontSize: 15,
    color: "#444",
    textAlign: "center",
    marginBottom: 24,
  },
  confirmLogoutButton: {
    width: "100%",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 12,
  },
  confirmLogoutButtonPressed: {
    backgroundColor: "#133E87",
    borderColor: "#133E87",
  },
  confirmLogoutButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
  },
  confirmLogoutButtonTextPressed: {
    color: "#fff",
  },
  cancelLogoutButton: {
    width: "100%",
    backgroundColor: "#133E87",
    borderWidth: 1,
    borderColor: "#133E87",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
  },
  cancelLogoutButtonPressed: {
    backgroundColor: "#0F2D5C",
    borderColor: "#0F2D5C",
  },
  cancelLogoutButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  cancelLogoutButtonTextPressed: {
    color: "#E0E0E0",
  },
});