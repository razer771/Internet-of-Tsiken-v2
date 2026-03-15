// Settings.js – App Info Screedn (Based on Screenshot)

import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Linking,
  Image,
} from "react-native";
import { MaterialIcons as Icon } from "@expo/vector-icons";
import SideNavigation from "../../navigation/SideNavigation";

const AppInfo = ({ navigation }) => {
  const [isSideNavVisible, setIsSideNavVisible] = useState(false);

  const openLink = (url) => {
    Linking.openURL(url);
  };

  return (
    <View style={styles.container}>
      {/* Back Button */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Icon name="arrow-back" size={28} color="#1D3B71" />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      {/* CONTENT */}
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.headerTitle}>App Info</Text>

        {/* ---- LOGO ---- */}
        <View style={styles.logoContainer}>
          <Image
            source={require("../../../assets/logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        {/* ---- ABOUT APP ---- */}
        <Text style={styles.sectionTitle}>About App</Text>

        <TouchableOpacity
          onPress={() => navigation.navigate("InternetOfTsiken")}
        >
          <Text style={styles.linkText}>Internet Of Tsiken</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate("PrivacyPolicy")}>
          <Text style={styles.linkText}>Privacy Policy</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.navigate("TermsAndConditions")}
        >
          <Text style={styles.linkText}>Terms and Conditions</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.navigate("OpenSourceLicenses")}
        >
          <Text style={styles.linkText}>Open Source Licenses</Text>
        </TouchableOpacity>

        {/* ---- REPORT ISSUE ---- */}
        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>
          Report an Issue
        </Text>

        <TouchableOpacity
          onPress={() => openLink("mailto:internetoftsiken.support@gmail.com")}
        >
          <Text style={[styles.linkText, styles.linkTextUnderlined]}>
            internetoftsiken.support@gmail.com
          </Text>
        </TouchableOpacity>

        {/* ---- APP VERSION ---- */}
        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>
          App Version
        </Text>

        {/* Two-column info list */}
        <View style={styles.row}>
          <Text style={styles.label}>App Name</Text>
          <Text style={styles.value}>Internet Of Tsiken</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Version</Text>
          <Text style={styles.value}>v1.0.2</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Release Date</Text>
          <Text style={styles.value}>January 28, 2026</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Developed by</Text>
          <Text style={styles.value}>QCU IT</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Contact</Text>
          <TouchableOpacity
            onPress={() =>
              openLink("mailto:internetoftsiken.support@gmail.com")
            }
          >
            <Text style={[styles.linkText, styles.linkTextUnderlined]}>
              Email
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Check for Updates</Text>

          <TouchableOpacity
            onPress={() =>
              openLink("https://charlesfrancisx.github.io/Internet-of-Tsiken/")
            }
          >
            <Text style={[styles.linkText, styles.linkTextUnderlined]}>
              Update Link
            </Text>
          </TouchableOpacity>
        </View>

        {/* ---- FOLLOW US ---- */}
        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Follow Us</Text>

        <TouchableOpacity
          onPress={() =>
            openLink("https://github.com/CharlesFrancisX/Internet-of-Tsiken")
          }
        >
          <Text style={[styles.linkText, styles.linkTextUnderlined]}>
            GitHub Repository
          </Text>
        </TouchableOpacity>

        {/* ---- COPYRIGHT FOOTER ---- */}
        <View style={styles.footerContainer}>
          <Text style={styles.footerText}>
            © 2026 Quezon City University IT.
          </Text>
          <Text style={styles.footerText}>All rights reserved.</Text>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
};

export default AppInfo;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  bottomNavContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },

  // Header
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    marginTop: 35,
    paddingHorizontal: 26,
  },
  backText: {
    fontSize: 18,
    color: "#1D3B71",
    marginLeft: 5,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#000",
    marginBottom: 10,
  },

  // Content
  content: {
    paddingHorizontal: 26,
    paddingTop: 10,
  },

  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 8,
    color: "#000",
  },
  linkText: {
    fontSize: 16,
    color: "#000000",
    marginBottom: 5,
    textDecorationLine: "underline",
  },
  linkTextUnderlined: {
    textDecorationLine: "underline",
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  label: {
    fontSize: 16,
  },
  value: {
    fontSize: 16,
    color: "#000",
  },
  logoContainer: {
    alignItems: "center",
    marginTop: 10,
    marginBottom: 20,
  },
  logo: {
    width: 120,
    height: 120,
  },
  footerContainer: {
    marginTop: 40,
    alignItems: "center",
  },
  footerText: {
    fontSize: 12,
    color: "#888888",
  },
});
