#!/bin/bash
# Deploy Enhanced Pop-up Notification System
# This script helps deploy all the changes for proper system pop-up notifications

echo "🚀 DEPLOYING ENHANCED POP-UP NOTIFICATION SYSTEM"
echo "================================================="
echo ""

cd "/home/charles/Internet-of-Tsiken-v2"

echo "📋 STEP 1: Deploy Firebase Cloud Function Updates"
echo "================================================="
echo "The Firebase Cloud Function has been updated to send high-priority notifications."
echo ""

if command -v firebase &> /dev/null; then
    echo "✅ Firebase CLI found"
    echo "🚀 Deploying Cloud Functions..."
    firebase deploy --only functions
    echo ""
else
    echo "⚠️ Firebase CLI not found"
    echo "📥 Install with: npm install -g firebase-tools"
    echo "🔐 Login with: firebase login"
    echo "🚀 Then run: firebase deploy --only functions"
    echo ""
fi

echo "📋 STEP 2: App Configuration Updates Applied"
echo "============================================="
echo "✅ app.json - Added expo-notifications plugin"
echo "✅ app.json - Added Android notification permissions"
echo "✅ PushNotificationService.js - Enhanced notification channels"
echo ""

echo "📋 STEP 3: Rebuild Mobile App"
echo "============================="
echo "The app needs to be rebuilt to include the new notification configuration."
echo ""

echo "Choose your rebuild method:"
echo ""
echo "🔧 OPTION A: Development Build (Faster)"
echo "   1. npx expo prebuild --clear"
echo "   2. npx expo start --dev-client"
echo "   3. Reinstall development client on phone"
echo ""

echo "📦 OPTION B: Preview APK Build (More Reliable for Notifications)"
echo "   1. eas build --platform android --profile preview"
echo "   2. Download and install APK on phone"
echo ""

read -p "❓ Which option do you want to use? (A/B): " choice

if [[ $choice == "A" || $choice == "a" ]]; then
    echo ""
    echo "🔧 Starting development build process..."
    echo "⚠️ Make sure to close Expo development server first!"
    echo ""

    read -p "Press ENTER to continue with development build..."

    echo "🧹 Clearing previous build..."
    npx expo prebuild --clear

    echo "🚀 Starting development server..."
    echo "📱 Scan QR code on your phone to reinstall development client"
    npx expo start --dev-client

elif [[ $choice == "B" || $choice == "b" ]]; then
    echo ""
    echo "📦 Starting preview APK build..."
    echo "⏱️ This will take ~5-10 minutes"
    echo ""

    if command -v eas &> /dev/null; then
        echo "✅ EAS CLI found"
        echo "🚀 Building preview APK..."
        eas build --platform android --profile preview
    else
        echo "⚠️ EAS CLI not found"
        echo "📥 Install with: npm install -g eas-cli"
        echo "🔐 Login with: eas login"
        echo "🚀 Then run: eas build --platform android --profile preview"
    fi
else
    echo "❌ Invalid choice. Please run this script again and choose A or B."
    exit 1
fi

echo ""
echo "📋 STEP 4: Test Pop-up Notifications"
echo "===================================="
echo "After your app is rebuilt and running:"
echo ""
echo "🧪 Run the pop-up notification tester:"
echo "   cd '/home/charles/Internet-of-Tsiken-v2/yolo object detection'"
echo "   python3 test_popup_notifications.py"
echo ""

echo "📋 STEP 5: Phone Settings Checklist"
echo "==================================="
echo "Make sure these are enabled on your phone:"
echo ""
echo "📱 Notification Settings:"
echo "   • Settings > Apps > Internet of Tsiken > Notifications > Enable all"
echo "   • Settings > Apps > Internet of Tsiken > Notifications > Pop on screen: ON"
echo "   • Settings > Apps > Internet of Tsiken > Notifications > Sound: ON"
echo "   • Settings > Apps > Internet of Tsiken > Notifications > Importance: High/Urgent"
echo ""
echo "🔋 Battery Settings:"
echo "   • Settings > Battery > Battery Optimization > Internet of Tsiken > Don't optimize"
echo ""
echo "🔔 System Settings:"
echo "   • Turn OFF Do Not Disturb mode"
echo "   • Turn OFF Silent mode"
echo "   • Settings > Notifications > Pop notifications on screen: ON"
echo ""

echo "🎯 SUMMARY OF CHANGES"
echo "====================="
echo "✅ Firebase Cloud Function: Enhanced for high-priority pop-up notifications"
echo "✅ App Notification Channels: Critical predator alerts with max priority"
echo "✅ Android Permissions: Added POST_NOTIFICATIONS, VIBRATE, WAKE_LOCK"
echo "✅ Notification Behavior: Bypass DND, force sound/vibration, LED lights"
echo ""
echo "🚨 RESULT: You should now get PROPER POP-UP notifications that:"
echo "   📱 Appear on locked screen"
echo "   🔊 Make sound even in silent mode (critical alerts)"
echo "   📳 Vibrate with strong pattern"
echo "   💡 Flash LED lights"
echo "   🆘 Show as high-priority system alerts"
echo ""

echo "🧪 TEST YOUR NOTIFICATIONS:"
echo "   Point camera at yourself or show it a pet photo"
echo "   Or run: python3 test_popup_notifications.py"