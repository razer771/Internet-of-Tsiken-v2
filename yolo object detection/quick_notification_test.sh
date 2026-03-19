#!/bin/bash
# Quick Push Notification Test Suite
# Run this script to test all aspects of push notifications

echo "🚨 QUICK PUSH NOTIFICATION TESTS"
echo "================================="

echo ""
echo "🧪 Test 1: Direct Firebase webhook test"
curl -s -X POST https://us-central1-internet-of-tsiken-f0ad4.cloudfunctions.net/notifyPredator \
  -H "Content-Type: application/json" \
  -d '{"predator_type":"Quick_Test","confidence":0.99,"camera_id":"Test_Script"}' \
  | grep -q "success" && echo "✅ Firebase webhook working" || echo "❌ Firebase webhook failed"

echo ""
echo "🔍 Test 2: Check if Pi is detecting objects"
DETECTION_COUNT=$(curl -s http://localhost:5000/detections | jq -r '.count // 0' 2>/dev/null || echo "0")
echo "📊 Current detections: $DETECTION_COUNT objects"

echo ""
echo "📱 Test 3: Check recent push notification activity"
echo "Recent push notifications from Pi:"
sudo journalctl -u camera-stream --since "30 minutes ago" | grep -E "PUSH NOTIFICATION SENT" | tail -3

echo ""
echo "📋 Test 4: Mobile App Checklist"
echo "Check these on your phone:"
echo "   1. Open your React Native app"
echo "   2. Verify you're logged in"
echo "   3. Check Settings > Notifications > [Your App] - Enable all"
echo "   4. Check Settings > Battery > Battery Optimization - Disable for your app"
echo ""
echo "🎯 Live Test: Point camera at yourself or show it a photo of a dog/cat"
echo "   Then check: sudo journalctl -u camera-stream -f | grep NOTIFICATION"