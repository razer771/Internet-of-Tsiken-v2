import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";

export default function PasswordUpdatedScreen() {
  const navigation = useNavigation();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigation.replace("LogIn");
    }, 3000);

    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconWrapper}>
          <Image
            source={{
              uri: "https://img.icons8.com/color/96/checked--v1.png",
            }}
            style={styles.icon}
          />
        </View>

        <Text style={styles.title}>Password Updated!</Text>
        <Text style={styles.subtitle}>
          Your password has been successfully updated.
        </Text>
        <Text style={styles.redirectText}>Redirecting to login page…</Text>

        <ActivityIndicator size="large" color="#4CAF50" style={styles.spinner} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F8FA",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingVertical: 40,
    paddingHorizontal: 30,
    alignItems: "center",
    width: "90%",
    maxWidth: 400,
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  iconWrapper: {
    backgroundColor: "#E8F5E9",
    borderRadius: 50,
    padding: 20,
    marginBottom: 20,
  },
  icon: {
    width: 60,
    height: 60,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#2E7D32",
    marginBottom: 10,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#555",
    textAlign: "center",
    marginBottom: 20,
  },
  redirectText: {
    fontSize: 14,
    color: "#888",
    textAlign: "center",
    marginBottom: 10,
  },
  spinner: {
    marginTop: 10,
  },
});
