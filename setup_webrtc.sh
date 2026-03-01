#!/bin/bash
# Quick Setup Script for WebRTC IoT Monitor
# Run this script to complete the mobile app setup

echo "========================================"
echo "WebRTC IoT Monitor - Quick Setup"
echo "========================================"
echo ""

# Step 1: Install Node dependencies
echo "📦 Installing dependencies..."
npm install

# Step 2: Prebuild for native modules
echo ""
echo "🔨 Prebuilding for react-native-webrtc..."
npx expo prebuild --clean

# Step 3: Build development client
echo ""
echo "📱 Building development client for Android..."
echo "   (Skip this if you'll use Expo Go or build later)"
read -p "Build now? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]
then
    npx expo run:android
fi

echo ""
echo "✅ Mobile app setup complete!"
echo ""
echo "Next steps:"
echo "1. Configure RemoteIoTMonitorScreen.js endpoints (lines 47-48)"
echo "2. Setup Raspberry Pi (see docs/WEBRTC_IOT_DEPLOYMENT_GUIDE.md)"
echo "3. Navigate to 'RemoteMonitor' screen in your app"
echo ""
