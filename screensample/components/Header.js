// components/Header.js
import React, { useState } from "react";
import { View, Text, TouchableOpacity, Image, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const PRIMARY = "#133E87";

export default function Header({ onOpenMenu, navigation }) {
  const [menuPressed, setMenuPressed] = useState(false);

  return (
    <View style={styles.header}>
      <View style={styles.left}>
        <Image source={require("../../assets/logo.png")} style={styles.logo} />
        <Text style={styles.title}>My Brooder</Text>
      </View>

      <View style={styles.right}>
        <TouchableOpacity
          onPress={() => navigation?.navigate("Notifications")}
          style={styles.iconBtn}
        >
          <Ionicons name="notifications-outline" size={22} color="#000" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            setMenuPressed(true);
            onOpenMenu && onOpenMenu();
            setTimeout(() => setMenuPressed(false), 200);
          }}
          style={styles.iconBtn}
        >
          <Ionicons
            name="menu"
            size={26}
            color={menuPressed ? PRIMARY : "#000"}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 64,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderColor: "#E4E4E4",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  left: { flexDirection: "row", alignItems: "center" },
  logo: { width: 36, height: 36, resizeMode: "contain", marginBottom: 5, borderRadius: 60 },
  title: { marginLeft: 10, fontSize: 25, fontWeight: "700", color: PRIMARY },
  right: { flexDirection: "row", alignItems: "center" },
  iconBtn: { marginLeft: 12, padding: 6 },
});
