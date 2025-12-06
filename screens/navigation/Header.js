import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StatusBar,
  SafeAreaView,
} from "react-native";
import { Image } from "react-native";
import { Feather } from "@expo/vector-icons";
import SideNavigation from "./SideNavigation";
import { useNavigation } from "@react-navigation/native";
import { useNotifications } from "../User/controls/NotificationContext";

const Icon = Feather;

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
  const [menuVisible, setMenuVisible] = useState(false);
  const navigation = useNavigation();
  const { unreadCount } = useNotifications();

  const toggleMenu = () => {
    setMenuVisible(!menuVisible);
  };

  const handleNotificationPress = () => {
    navigation.navigate("Notification");
  };

  const handleLogoPress = () => {
    navigation.navigate("Home");
  };

  return (
    <>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <View style={styles.header}>
          <View style={styles.leftSection}>
            <TouchableOpacity 
              style={styles.logoContainer}
              activeOpacity={0.7}
              onPress={handleLogoPress}
            >
              <Image
                source={require("../../assets/logo.png")}
                style={styles.logo}
                resizeMode="contain"
              />
            </TouchableOpacity>
            <Text style={styles.headerText}>Internet of Tsiken</Text>
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
                  <Text style={styles.notificationBadgeText}>{unreadCount > 99 ? "99+" : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.iconButton}
              activeOpacity={0.7}
              onPress={toggleMenu}
            >
              <MenuIcon size={22} color="#1a1a1a" />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      <SideNavigation
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        navigation={navigation}
      />
    </>
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
  },
  leftSection: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
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
    fontSize: 17,
    fontWeight: "700",
    color: "#1a1a1a",
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
});
