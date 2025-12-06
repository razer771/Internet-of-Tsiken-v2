module.exports = ({ config }) => {
  // Read app.json
  const appJson = require("./app.json");

  return {
    ...appJson.expo,
    // Enable New Architecture (required by react-native-reanimated)
    newArchEnabled: true,
    // Plugins from app.json
    plugins: appJson.expo.plugins || [],
  };
};
