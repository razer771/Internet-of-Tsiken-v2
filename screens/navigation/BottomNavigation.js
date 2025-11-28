import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

function CustomTabBar({ state, descriptors, navigation }) {
  // Define which tabs should be visible in bottom navigation
  const visibleTabs = ["Home", "Control", "Analytics"];

  return (
    <View style={styles.tabBar}>
      {state.routes
        .filter((route) => visibleTabs.includes(route.name))
        .map((route) => {
          const { options } = descriptors[route.key];
          const label = options.tabBarLabel || options.title || route.name;

          const isFocused = state.routes[state.index].name === route.name;
          const color = isFocused ? "#1e40af" : "#6b7280";

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          let iconEl = null;
          if (typeof options.tabBarIcon === "function") {
            iconEl = options.tabBarIcon({ focused: isFocused, color, size: 22 });
          }

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              onPress={onPress}
              style={styles.tabButton}
              activeOpacity={0.7}
            >
              <View style={styles.iconContainer}>
                {iconEl ?? (
                  <Text style={[styles.icon, { color }]}>{label?.[0]}</Text>
                )}
              </View>
              <Text
                style={[styles.label, isFocused && styles.labelActive]}
                numberOfLines={1}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
    </View>
  );
}

export default CustomTabBar;

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
  icon: {
    fontSize: 22,
  },
  label: {
    fontSize: 12,  // ✅ Fixed: Changed from 0 to 12
    fontWeight: "500",
    color: "#000000",
    letterSpacing: -0.1,
    opacity: 0,  // ✅ Added: This hides the labels
  },
  labelActive: {
    color: "#1e40af",
    fontWeight: "600",
  },
});