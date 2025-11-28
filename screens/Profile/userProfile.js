import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { auth, db } from "../../config/firebaseconfig";
import { doc, getDoc } from "firebase/firestore";
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function UserProfile({ navigation }) {
  const [showPassword, setShowPassword] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState({
    name: "",
    email: "",
    phone: "",
    role: "",
  });

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      // First check if this is an admin bypass login
      const isAdminBypass = await AsyncStorage.getItem('isAdminBypass');
      const adminEmail = await AsyncStorage.getItem('adminEmail');
      
      if (isAdminBypass === 'true' && adminEmail === 'admin@example.com') {
        setUserData({
          name: "Admin",
          email: "admin@example.com",
          phone: "",
          role: "Admin",
        });
        setLoading(false);
        return;
      }

      const currentUser = auth.currentUser;
      
      if (currentUser) {
        // Fetch user data from Firestore
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUserData({
            name: data.fullname || data.name || data.firstName || "User",
            email: data.email || currentUser.email || "",
            phone: data.phone || data.phoneNumber || "",
            role: data.role || "User",
          });
        } else {
          // If no Firestore doc, use auth data
          setUserData({
            name: currentUser.displayName || "User",
            email: currentUser.email || "",
            phone: currentUser.phoneNumber || "",
            role: "User",
          });
        }
      } else {
        // No current user and no admin bypass
        setUserData({
          name: "Guest",
          email: "",
          phone: "",
          role: "Guest",
        });
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#1F3C88" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Back Button */}
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color="#1F3C88" />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      {/* Profile Container */}
      <View style={styles.profileContainer}>
        <View style={styles.imageWrapper}>
          <Ionicons name="person" size={80} color="#1F3C88" />
        </View>
        <Text style={styles.name}>{userData.name}</Text>
      </View>

      {/* Edit Button */}
      <TouchableOpacity 
        style={[styles.editButton, { backgroundColor: isPressed ? "#133E87" : "transparent" }]}
        onPress={() => navigation.navigate("EditProfile")}
        onPressIn={() => setIsPressed(true)}
        onPressOut={() => setIsPressed(false)}
      >
        <Text style={styles.editText}>Edit Profile</Text>
      </TouchableOpacity>

      {/* Role */}
      <View style={styles.section}>
        <Text style={styles.label}>Role</Text>
        <Text style={styles.value}>{userData.role}</Text>
      </View>

      {/* Email */}
      <View style={styles.section}>
        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{userData.email}</Text>
      </View>

      {/* Phone */}
      <View style={styles.section}>
        <Text style={styles.label}>Phone Number</Text>
        <Text style={styles.value}>{userData.phone || "Not set"}</Text>
      </View>

      {/* Password */}
      <View style={styles.section}>
        <Text style={styles.label}>Password</Text>

        <View style={styles.inlineRow}>
          <Text style={styles.value}>
            {showPassword ? "********" : "********"}
          </Text>

          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <Ionicons
              name={showPassword ? "eye-off-outline" : "eye-outline"}
              size={24}
              color="#333"
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 70,
    alignItems: "center",
    backgroundColor: "#fff",
  },

  loadingContainer: {
    justifyContent: "center",
  },

  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#1F3C88",
  },

  backButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginLeft: 20,
    marginBottom: 10,
  },

  backText: {
    color: "#1F3C88",
    fontSize: 18,
    marginLeft: 6,
  },

  imageWrapper: {
    width: 140,
    height: 140,
    borderWidth: 3,
    borderColor: "#1F3C88",
    borderRadius: 70,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },

  profileContainer: {
    alignItems: "center",
    marginBottom: 20,
  },

  name: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#000",
    marginTop: 10,
  },

  subtitle: {
    fontSize: 16,
    color: "#1F3C88",
    marginTop: 4,
  },

  editButton: {
    marginTop: -8,
    paddingHorizontal: 25,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#ccc",
  },

  editText: {
    fontSize: 16,
    color: "#333",
  },

  section: {
    width: "85%",
    marginTop: 25,
  },

  label: {
    fontSize: 18,
    color: "#777",
    marginBottom: 4,
  },

  value: {
    fontSize: 20,
    fontWeight: "600",
    color: "#000",
  },

  /* SIMPLE INLINE ROW – NO BACKGROUND, NO BORDER */
  inlineRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
});
