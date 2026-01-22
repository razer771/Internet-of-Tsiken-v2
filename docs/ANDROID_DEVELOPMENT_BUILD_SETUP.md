# Android Development Build Setup Guide

## Problem

When running `npx expo start` and trying to open on Android, you may encounter this error:

```
CommandError: No development build (com.ailynmay.capstone) for this project is installed.
Install a development build on the target device and try again.
```

This occurs because the project uses `expo-dev-client` which requires a custom development build instead of Expo Go.

## Prerequisites

- Android device (e.g., Pixel 8) with USB debugging enabled
- USB cable connected to computer
- Device authorized for development (see steps below if needed)

## Solution

### Step 1: Authorize Your Android Device

If you see "This computer is not authorized for developing on [Device Name]":

1. **Stop Expo/ADB** - Press `Ctrl+C` in terminal to stop running processes

2. **Disconnect** your Android device from the computer

3. **Revoke USB Debugging authorizations** on your device:
   - Open **Settings** app
   - Go to **Developer Options** (if not visible, enable it: Settings → About phone → tap Build number 7 times)
   - Tap **Revoke USB debugging authorizations**

4. **Reconnect** your device to the computer via USB

5. **Accept the authorization prompt** on your device:
   - A dialog will appear: "Allow USB debugging?"
   - Check "Always allow from this computer"
   - Tap **OK**

### Step 2: Build and Install Development Build

Run the following command to build and install the development build:

```bash
npx expo run:android
```

This command will:

- Build a development version of the app with all native modules
- Install it directly on your connected Android device
- Start the Metro bundler automatically

### Step 3: Start Development Server (for future use)

After the initial build, you can use:

```bash
npx expo start
```

Then press `a` to open on Android, or the app will auto-reload if already running.

## Why This is Needed

Projects using `expo-dev-client` require custom development builds because:

- They include custom native modules (expo-media-library, expo-av, etc.)
- Expo Go has limitations and doesn't support all native features
- Development builds provide full access to native APIs

## Alternative: Quick Testing with Expo Go

For simple testing without native features:

1. Install **Expo Go** from Google Play Store
2. Run: `npx expo start --go`
3. Scan QR code with Expo Go app

**Note:** This may not work with all features in this project due to custom native dependencies.

## Troubleshooting

**Build fails with Gradle errors:**

- Ensure Android SDK is properly installed
- Check `android/gradle.properties` settings
- Clear Gradle cache: `cd android && ./gradlew clean`

**Device not detected:**

- Check USB cable supports data transfer
- Verify USB debugging is enabled
- Run `adb devices` to confirm device is listed

**App crashes on launch:**

- Check logcat: `npx react-native log-android`
- Verify all dependencies are installed: `npm install`
- Rebuild: `npx expo run:android --clear`
