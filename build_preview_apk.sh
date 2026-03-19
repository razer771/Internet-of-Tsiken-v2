#!/bin/bash
# Build Preview APK for Push Notification Testing
# This creates a proper APK with full FCM integration

echo "📦 BUILDING PREVIEW APK FOR PUSH NOTIFICATIONS"
echo "=============================================="
echo ""

cd "/home/charles/Internet-of-Tsiken-v2"

echo "🔧 Step 1: Check EAS CLI installation"
if command -v eas &> /dev/null; then
    echo "✅ EAS CLI available"
else
    echo "❌ EAS CLI not found - installing..."
    npm install -g eas-cli
fi

echo ""
echo "🔧 Step 2: Login to EAS (if needed)"
echo "If this is your first time, you'll need to login:"
echo "  eas login"

echo ""
echo "🔧 Step 3: Configure project (if needed)"
echo "If this is your first time building:"
echo "  eas build:configure"

echo ""
echo "🎯 Step 4: Build Preview APK"
echo "This creates a real APK with full push notification support:"
echo ""
echo "Building preview APK..."
echo "Command: eas build --platform android --profile preview"
echo ""

# Show them what the command looks like without running it automatically
echo "🚨 MANUAL STEP REQUIRED:"
echo "Run this command when ready:"
echo ""
echo "  cd /home/charles/Internet-of-Tsiken-v2"
echo "  eas build --platform android --profile preview"
echo ""
echo "📱 This will:"
echo "  ✅ Create a proper APK file"
echo "  ✅ Include full FCM integration"
echo "  ✅ Work with real push notifications"
echo "  ✅ Bypass development build limitations"
echo ""
echo "⏱️ Build time: ~5-10 minutes"
echo "📥 Result: Download link for APK file"
echo ""
echo "🔧 After APK is built:"
echo "  1. Download APK to your phone"
echo "  2. Install it (enable 'Install from unknown sources')"
echo "  3. Open app and login"
echo "  4. Test push notifications from Pi"
echo ""
echo "🎯 This APK will have FULL push notification support!"