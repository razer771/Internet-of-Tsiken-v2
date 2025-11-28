// components/BottomNavigation.js
import React from "react";
import { View, TouchableOpacity, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from '@react-navigation/native';

const PRIMARY = "#133E87";

export default function BottomNavigation({ active = "Control", onNavigate }) {
  const navigation = useNavigation();

  const handleNavigate = (screen) => {
    if (typeof onNavigate === 'function') return onNavigate(screen);
    if (navigation && typeof navigation.navigate === 'function') return navigation.navigate(screen);
  };

  return (
    <View style={styles.bar}>
      <NavBtn icon="home" label="Home" active={active === "Home"} onPress={() => handleNavigate("Home")} />
      <NavBtn icon="options" label="Control" active={active === "Control"} onPress={() => handleNavigate("Control")} />
      <NavBtn icon="bar-chart" label="Analytics" active={active === "Analytics"} onPress={() => handleNavigate("Analytics")} />
    </View>
  );
}

function NavBtn({ icon, label, active, onPress }) {
  return (
    <TouchableOpacity style={styles.btn} onPress={onPress}>
      <Ionicons name={icon} size={22} color={active ? PRIMARY : "#777"} />
      <Text style={[styles.label, active && { color: PRIMARY, fontWeight: "700" }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  bar: { height: 66, backgroundColor: "#fff", borderTopWidth: 1, borderColor: "#E4E4E4", flexDirection: "row", justifyContent: "space-around", alignItems: "center", position: "absolute", left: 0, right: 0, bottom: 0 },
  btn: { alignItems: "center" },
  label: { fontSize: 12, color: "#777", marginTop: 4 },
});
