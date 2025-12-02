import React, { useEffect, useRef } from "react";
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
import Icon from "react-native-vector-icons/Feather";
import { CommonActions } from "@react-navigation/native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function SideNavigation({ visible, onClose, navigation }) {
  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

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
      console.log("[SideNavigation] Attempting to navigate to Activity Logs screen");
      try {
        navigation.navigate("ActivityLogs");
        console.log("[SideNavigation] Navigate to Activity Logs successful");
      } catch (error) {
        console.error("[SideNavigation] Navigation error:", error);
      }
    } else if (item === "User Profile" && navigation) {
      console.log("User Profile - not yet implemented");
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
    console.log("Logging out...");
    onClose();
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
              onPress={() => handleMenuItemPress("Reports")}
            >
              {({ pressed }) => (
                <View style={[styles.menuItemInner, pressed && styles.menuItemPressed]}>
                  <Text style={[styles.menuItemText, pressed && styles.menuItemTextPressed]}>
                    Reports
                  </Text>
                </View>
              )}
            </Pressable>

            <Pressable
              style={styles.menuItem}
              onPress={() => handleMenuItemPress("Activity Logs")}
            >
              {({ pressed }) => (
                <View style={[styles.menuItemInner, pressed && styles.menuItemPressed]}>
                  <Text style={[styles.menuItemText, pressed && styles.menuItemTextPressed]}>
                    Activity Logs
                  </Text>
                </View>
              )}
            </Pressable>

            <Pressable
              style={styles.menuItem}
              onPress={() => handleMenuItemPress("User Profile")}
            >
              {({ pressed }) => (
                <View style={[styles.menuItemInner, pressed && styles.menuItemPressed]}>
                  <Text style={[styles.menuItemText, pressed && styles.menuItemTextPressed]}>
                    User Profile
                  </Text>
                </View>
              )}
            </Pressable>

            <Pressable
              style={styles.menuItem}
              onPress={() => handleMenuItemPress("Settings")}
            >
              {({ pressed }) => (
                <View style={[styles.menuItemInner, pressed && styles.menuItemPressed]}>
                  <Text style={[styles.menuItemText, pressed && styles.menuItemTextPressed]}>
                    App Info
                  </Text>
                </View>
              )}
            </Pressable>
          </View>

          <View style={styles.menuFooter}>
            <Pressable
              style={styles.logoutButton}
              onPress={handleLogout}
            >
              {({ pressed }) => (
                <View style={[styles.logoutButtonInner, pressed && styles.logoutButtonPressed]}>
                  <Icon name="log-out" size={20} color={pressed ? "#ffffff" : "#1a1a1a"} />
                  <Text style={[styles.logoutText, pressed && styles.logoutTextPressed]}>
                    Logout
                  </Text>
                </View>
              )}
            </Pressable>
          </View>
        </Animated.View>
      </Animated.View>
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
    backgroundColor: "#ffffff",
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
    color: "#1a1a1a",
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
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginHorizontal: 8,
    borderWidth: 1,
    borderColor: "transparent",
  },
  menuItemPressed: {
    backgroundColor: "#3b82f6",
    borderColor: "#3b82f6",
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1a1a1a",
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
  logoutButton: {
  },
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
    backgroundColor: "#3b82f6",
    borderColor: "#3b82f6",
  },
  logoutText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1a1a1a",
    marginLeft: 10,
  },
  logoutTextPressed: {
    color: "#ffffff",
  },
});
