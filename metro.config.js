const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Add any custom Metro configuration here
config.resolver.assetExts.push("db");

// Exclude Firebase functions directory from Metro bundler
config.resolver.blockList = [/functions\/.*/];

module.exports = config;
