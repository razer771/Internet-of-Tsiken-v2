const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Add any custom Metro configuration here
config.resolver.assetExts.push("db");

// Enable package exports resolution (helps with Firebase v12+)
config.resolver.unstable_enablePackageExports = true;

// Explicitly set source extensions priority
config.resolver.sourceExts = ['js', 'jsx', 'json', 'ts', 'tsx', 'cjs', 'mjs'];

// Block only the local Firebase Cloud Functions directory at project root
config.resolver.blockList = [
  new RegExp(`${path.resolve(__dirname, 'functions')}/.*`)
];

module.exports = config;
