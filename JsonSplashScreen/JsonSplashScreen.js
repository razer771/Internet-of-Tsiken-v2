import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import LottieView from "lottie-react-native";

export default function JsonSplashScreen({ navigation }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        navigation.replace("LogIn"); // Go to screens/LogIn/LogIn.js
      } catch (error) {
        console.error("Navigation failed:", error);
      }
    }, 3000); // Adjust to match your animation length

    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <View style={styles.container}>
      <LottieView
        source={require("../assets/Jsplash.json")} // 👈 your animation file
        autoPlay
        loop={false}
        style={styles.animation}
        onAnimationFinish={() => {
          console.log("Animation finished");
          // Optional: Navigate immediately when animation finishes
          // navigation.replace("LogIn");
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#24208fff", // or match your theme
    justifyContent: "center",
    alignItems: "center",
  },
  animation: {
    width: 450,
    height: 910,
  },
});
