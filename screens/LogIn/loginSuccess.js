import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Image,
  TouchableOpacity,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { auth, db } from "../../config/firebaseconfig";
import { doc, getDoc } from "firebase/firestore";

export default function LoginSuccess() {
  const navigation = useNavigation();
  const [countdown, setCountdown] = useState(60); // 60 seconds lock
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    const loadUserDataAndNavigate = async () => {
      try {
        const user = auth.currentUser;
        if (user) {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            console.log("✅ User dashboard data loaded:", userData);
            
            // Determine destination based on user role
            const userRole = (userData.role || "").toLowerCase();
            let destination = "Home"; // default for regular users
            
            if (userRole === "admin") {
              destination = "AdminDashboard";
              console.log("🔀 Admin user detected, will navigate to AdminDashboard");
            } else if (userRole === "user") {
              destination = "Home";
              console.log("🔀 Regular user detected, will navigate to Home");
            } else {
              console.log(`⚠️ Unknown role "${userRole}", defaulting to Home`);
              destination = "Home";
            }
            
            // Set timer to navigate after 3 seconds
            const timer = setTimeout(() => {
              console.log(`Dashboard loaded! Navigating to ${destination}...`);
              navigation.replace(destination);
            }, 3000);
            
            return () => clearTimeout(timer);
          }
        }
      } catch (error) {
        console.error("Error loading user data:", error);
        // Fallback navigation after 3 seconds if there's an error
        const timer = setTimeout(() => {
          console.log("Error loading user data. Navigating to Home...");
          navigation.replace("Home");
        }, 3000);
        
        return () => clearTimeout(timer);
      }
    };

    loadUserDataAndNavigate();
  }, [navigation]);

  // Countdown effect
  useEffect(() => {
    let interval;
    if (!canResend && countdown > 0) {
      interval = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (countdown === 0) {
      setCanResend(true);
    }
    return () => clearInterval(interval);
  }, [countdown, canResend]);

  const handleResend = () => {
    if (canResend) {
      console.log("Resending OTP...");
      // Call your resend OTP logic here
      setCountdown(60); // reset countdown
      setCanResend(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Image
          source={{ uri: "https://img.icons8.com/color/96/checked--v1.png" }}
          style={styles.icon}
        />
        <Text style={styles.title}>Login Successful!</Text>
        <Text style={styles.subtitle}>Welcome to Internet of Tsiken</Text>
        <Text style={styles.loading}>Loading your dashboard...</Text>
        <ActivityIndicator
          size="large"
          color="#4CAF50"
          style={styles.spinner}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  card: {
    backgroundColor: "#FFFFFF",
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
  icon: {
    width: 80,
    height: 80,
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#2E7D32",
    marginBottom: 10,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 18,
    color: "#555",
    marginBottom: 20,
    textAlign: "center",
  },
  loading: {
    fontSize: 16,
    color: "#888",
    marginBottom: 10,
    textAlign: "center",
  },
  spinner: {
    marginTop: 10,
  },
  resendButton: {
    marginTop: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  resendButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
});
