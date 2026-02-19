const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Add any custom Metro configuration here
config.resolver.assetExts.push("db");

// Exclude the root 'functions' folder where backend code lives,
// but be careful NOT to exclude 'node_modules/firebase/functions'.
config.resolver.blockList = [
  new RegExp(`^${__dirname}/functions/.*`),
];

// ─── Fix "Component auth has not been registered yet" ─────────────────────────
//
// ROOT CAUSE: @firebase/app ships both a CJS build and an ESM build, each with
// its own private `_apps = new Map()` registry.  When Metro loads the user's
// `import { initializeApp } from "firebase/app"` it picks the ESM build, but
// @firebase/auth's React-Native bundle is compiled as CJS and does
// `require('@firebase/app')` which resolves to the *CJS* build.  The two builds
// are separate module instances, so `registerAuth` writes into the CJS registry
// while `initializeApp` / `getAuth` read from the ESM registry → "not registered".
//
// FIX: Use `resolveRequest` to hard-wire every import of the shared Firebase
// packages to the same single CJS file.  CJS modules are singletons in both
// Metro and Node (cached by `require`), so all code ends up sharing one registry.
//
const firebaseCjsMap = {
  "@firebase/app":       "node_modules/@firebase/app/dist/index.cjs.js",
  "@firebase/component": "node_modules/@firebase/component/dist/index.cjs.js",
  "@firebase/auth":      "node_modules/@firebase/auth/dist/rn/index.js",
  "@firebase/util":      "node_modules/@firebase/util/dist/index.cjs.js",
  "@firebase/logger":    "node_modules/@firebase/logger/dist/index.cjs.js",
  "firebase/app":        "node_modules/@firebase/app/dist/index.cjs.js",
  "firebase/auth":       "node_modules/@firebase/auth/dist/rn/index.js",
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const mapped = firebaseCjsMap[moduleName];
  if (mapped) {
    return { filePath: path.resolve(__dirname, mapped), type: "sourceFile" };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
