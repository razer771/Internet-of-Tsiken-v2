import React, { useEffect } from "react";
import { View, StyleSheet, Text } from "react-native";
import LottieView from "lottie-react-native";

export default function JsonSplashScreen({ navigation }) {
  useEffect(() => {
    console.log("JsonSplashScreen mounted");
  }, []);

  return (
    <View style={styles.container}>
      <LottieView
        source={require("../assets/Jsplash.json")}
        autoPlay
        loop={false}
        style={styles.animation}
        resizeMode="cover"
        onAnimationFinish={() => {
          console.log("Animation finished");
        }}
        onLoad={() => {
          console.log("Animation loaded");
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
