// Settings.js – App Info Screen (Based on Screenshot)

import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Linking,
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
      {/* Back + Title */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>App Info</Text>
      </View>

      {/* CONTENT */}
      <ScrollView contentContainerStyle={styles.content}>
        {/* ---- ABOUT APP ---- */}
        <Text style={styles.sectionTitle}>About App</Text>

        <TouchableOpacity onPress={() => navigation.navigate("InternetOfTsiken") }>
          <Text style={styles.linkText}>Internet Of Tsiken</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate("PrivacyPolicy") }>
          <Text style={styles.linkText}>Privacy Policy</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.navigate("TermsAndConditions")}
        >
          <Text style={styles.linkText}>Terms and Conditions</Text>
        </TouchableOpacity>

        {/* ---- REPORT ISSUE ---- */}
        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>
          Report an Issue
        </Text>

        <TouchableOpacity
          onPress={() =>
            openLink("https://forms.google.com/your-form")
          }
        >
          <Text style={[styles.linkText, styles.linkTextUnderlined]}>Google Form Link</Text>
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
          <Text style={styles.value}>v1.2.3</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Release Date</Text>
          <Text style={styles.value}>12/25/25</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Developer</Text>
          <Text style={styles.value}>Ako</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Contact</Text>
          <Text style={styles.value}>support@Tsiken.ph</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Check for Updates</Text>

          <TouchableOpacity
            onPress={() =>
              openLink("https://tsiken.ph/update")
            }
          >
            <Text style={[styles.linkText, styles.linkTextUnderlined]}>Update Link</Text>
          </TouchableOpacity>
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
  topBar: {
    height: 64,
    paddingTop: 18,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  backButton: {
    position: "absolute",
    top: 18,
    left: 12,
    zIndex: 2,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#000000ff",
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
    color: "#2A59D1",
    marginBottom: 5,
    textDecorationLine: "none",
  },
  linkTextUnderlined: {
    textDecorationLine: 'underline',
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
});
