import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

export default function PasswordUpdated() {
  const navigation = useNavigation();

  const handleContinue = () => {
    navigation.replace("LoginSuccess");
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Ionicons name="checkmark-circle-outline" size={60} color="#3b4cca" style={styles.icon} />
        <Text style={styles.title}>Password Updated</Text>
        <Text style={styles.subtitle}>
          Your password has been successfully updated. You are now logged in.
        </Text>
        <TouchableOpacity style={styles.button} onPress={handleContinue}>
          <Text style={styles.buttonText}>Go to Dashboard</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", justifyContent: "center", alignItems: "center" },
  card: {
    width: "85%", backgroundColor: "#fff", borderRadius: 12, padding: 25,
    shadowColor: "#000", shadowOpacity: 0.1, shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6, elevation: 5, alignItems: "center",
  },
  icon: { marginBottom: 20 },
  title: { fontSize: 22, fontWeight: "bold", color: "#000", marginBottom: 10 },
  subtitle: { fontSize: 14, color: "#666", textAlign: "center", marginBottom: 20 },
  button: { backgroundColor: "#3b4cca", borderRadius: 8, paddingVertical: 12, paddingHorizontal: 20, alignItems: "center" },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
