import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import { MaterialIcons as Icon } from "@expo/vector-icons";

const OpenSourceLicenses = ({ navigation }) => {
  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Open Source</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.paragraph}>
          The Internet of Tsiken app uses the following open-source libraries.
          We are grateful to the developer community for their work.
        </Text>

        <Text style={styles.sectionTitle}>React & React Native</Text>
        <Text style={styles.paragraph}>
          Copyright (c) Meta Platforms, Inc. and affiliates. Licensed under the
          MIT License.
        </Text>

        <Text style={styles.sectionTitle}>Expo</Text>
        <Text style={styles.paragraph}>
          Copyright (c) 650 Industries, Inc. Licensed under the MIT License.
        </Text>

        <Text style={styles.sectionTitle}>React Navigation</Text>
        <Text style={styles.paragraph}>
          Copyright (c) 2017 React Navigation Contributors. Licensed under the
          MIT License.
        </Text>

        <Text style={styles.sectionTitle}>Firebase</Text>
        <Text style={styles.paragraph}>
          Copyright (c) Google Inc. Licensed under the Apache License 2.0.
        </Text>

        <Text style={styles.sectionTitle}>NativeWind & TailwindCSS</Text>
        <Text style={styles.paragraph}>
          Copyright (c) NativeWind Contributors / Tailwind Labs, Inc. Licensed
          under the MIT License.
        </Text>

        <Text style={styles.sectionTitle}>Lottie by Airbnb</Text>
        <Text style={styles.paragraph}>
          Copyright (c) 2017 Airbnb, Inc. Licensed under the Apache License 2.0.
        </Text>

        <Text style={styles.sectionTitle}>React Native Chart Kit</Text>
        <Text style={styles.paragraph}>
          Copyright (c) 2018 Herbert. Licensed under the MIT License.
        </Text>

        <Text style={styles.sectionTitle}>YOLOv8 & YOLOv5 (NCNN)</Text>
        <Text style={styles.paragraph}>
          Copyright (c) Ultralytics. Licensed under the AGPL-3.0 License.
        </Text>

        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
};

export default OpenSourceLicenses;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
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
  content: {
    paddingHorizontal: 26,
    paddingTop: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginTop: 15,
    marginBottom: 4,
    color: "#000",
  },
  paragraph: {
    fontSize: 14,
    color: "#333",
    lineHeight: 20,
    marginBottom: 12,
  },
});
