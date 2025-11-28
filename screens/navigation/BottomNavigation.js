import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function BottomNavigation({ active, onNavigate }) {
  const tabs = [
    { name: "Home", label: "Home", icon: "home-outline", activeIcon: "home" },
    { name: "Control", label: "Control", icon: "options-outline", activeIcon: "options" },
    { name: "Analytics", label: "Analytics", icon: "bar-chart-outline", activeIcon: "bar-chart" },
  ];

  return (
    <View style={styles.tabBar}>
      {tabs.map((tab) => {
        const isFocused = active === tab.name;
        const color = isFocused ? "#1e40af" : "#6b7280";

        return (
          <TouchableOpacity
            key={tab.name}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            onPress={() => onNavigate && onNavigate(tab.name)}
            style={styles.tabButton}
            activeOpacity={0.7}
          >
            <View style={styles.iconContainer}>
              <Ionicons
                name={isFocused ? tab.activeIcon : tab.icon}
                size={24}
                color={color}
              />
            </View>
            <Text
              style={[styles.label, isFocused && styles.labelActive]}
              numberOfLines={1}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    paddingTop: 8,
    paddingBottom: 20,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 8,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  iconContainer: {
    width: 48,
    height: 36,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: "500",
    color: "#6b7280",
    letterSpacing: -0.1,
  },
  labelActive: {
    color: "#1e40af",
    fontWeight: "600",
  },
});