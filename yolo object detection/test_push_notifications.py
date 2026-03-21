#!/usr/bin/env python3
"""
Push Notification Testing Script
Comprehensive testing for the predator detection notification system
"""

import requests
import json
import time
from datetime import datetime

# Firebase Cloud Function URL (from your stream server)
FIREBASE_WEBHOOK_URL = "https://us-central1-internet-of-tsiken-f0ad4.cloudfunctions.net/notifyPredator"

def test_firebase_webhook_direct():
    """
    Method 1: Test Firebase Cloud Function directly
    This bypasses the camera/AI and tests if Firebase can send notifications
    """
    print("🧪 Testing Firebase Cloud Function directly...")

    test_data = {
        "predator_type": "Test_Dog",
        "confidence": 0.95,
        "camera_id": "Test_Camera",
        "timestamp": datetime.now().isoformat()
    }

    try:
        response = requests.post(
            FIREBASE_WEBHOOK_URL,
            json=test_data,
            timeout=10,
            headers={'Content-Type': 'application/json'}
        )

        print(f"✅ Response Status: {response.status_code}")
        print(f"📄 Response Body: {response.text}")

        if response.status_code == 200:
            print("🎉 SUCCESS: Firebase Cloud Function is working!")
            print("📱 Check your phone for the push notification")
            return True
        else:
            print("❌ FAILED: Firebase Cloud Function error")
            return False

    except requests.exceptions.Timeout:
        print("⏰ TIMEOUT: Firebase Cloud Function didn't respond")
        return False
    except Exception as e:
        print(f"💥 ERROR: {e}")
        return False

def test_different_predators():
    """
    Method 2: Test notifications for different predator types
    """
    predators = ["Cat", "Dog", "Rat", "Snake", "Person"]

    print(f"\n🦅 Testing notifications for {len(predators)} predator types...")

    for i, predator in enumerate(predators):
        print(f"\n--- Test {i+1}/{len(predators)}: {predator} ---")

        test_data = {
            "predator_type": predator,
            "confidence": 0.85 + (i * 0.03),  # Varying confidence
            "camera_id": "RaspberryPi_Test",
            "timestamp": datetime.now().isoformat()
        }

        try:
            response = requests.post(FIREBASE_WEBHOOK_URL, json=test_data, timeout=5)

            if response.status_code == 200:
                print(f"✅ {predator}: Notification sent successfully")
            else:
                print(f"❌ {predator}: Failed ({response.status_code})")

        except Exception as e:
            print(f"💥 {predator}: Error - {e}")

        # Wait between tests to respect cooldown
        if i < len(predators) - 1:
            print("⏳ Waiting 2 seconds between tests...")
            time.sleep(2)

def test_notification_cooldown():
    """
    Method 3: Test notification cooldown logic (5-minute limit)
    """
    print(f"\n⏱️ Testing notification cooldown (5-minute limit)...")

    test_data = {
        "predator_type": "Cooldown_Test_Cat",
        "confidence": 0.90,
        "camera_id": "RaspberryPi_Cooldown_Test",
        "timestamp": datetime.now().isoformat()
    }

    print("🔥 Sending first notification...")
    response1 = requests.post(FIREBASE_WEBHOOK_URL, json=test_data, timeout=5)

    if response1.status_code == 200:
        print("✅ First notification sent")

        print("🔥 Sending second notification immediately (should still work - different timestamp)...")
        test_data["timestamp"] = datetime.now().isoformat()
        response2 = requests.post(FIREBASE_WEBHOOK_URL, json=test_data, timeout=5)

        if response2.status_code == 200:
            print("✅ Second notification sent (Firebase handles its own cooldown)")
        else:
            print(f"❌ Second notification failed: {response2.status_code}")
    else:
        print(f"❌ First notification failed: {response1.status_code}")

def check_ui_detection_endpoint():
    """
    Method 4: Check if the Pi's detection system is detecting objects
    """
    print(f"\n🔍 Checking Pi's detection system...")

    try:
        # Try both local and Tailscale IPs
        endpoints = [
            "http://localhost:5000/detections",
            "http://100.101.108.37:5000/detections",
            "http://10.227.118.156:5000/detections"
        ]

        for endpoint in endpoints:
            try:
                response = requests.get(endpoint, timeout=3)
                if response.status_code == 200:
                    data = response.json()
                    print(f"✅ Detection endpoint reachable: {endpoint}")
                    print(f"📊 Current detections: {data.get('count', 0)} objects")
                    print(f"🤖 AI FPS: {data.get('fps', 'N/A')}")
                    print(f"⏱️ Last update: {data.get('timestamp', 'N/A')}")

                    objects = data.get('objects', [])
                    if objects:
                        print("🎯 Current objects detected:")
                        for obj in objects:
                            print(f"   - {obj.get('class', 'Unknown')}: {obj.get('confidence', 0)}%")
                    else:
                        print("🔍 No objects currently detected")

                    return True
            except:
                continue

        print("❌ Could not reach detection endpoint on any IP")
        return False

    except Exception as e:
        print(f"💥 Error checking detection endpoint: {e}")
        return False

def main():
    """Run comprehensive push notification tests"""
    print("=" * 60)
    print("🚨 PUSH NOTIFICATION COMPREHENSIVE TESTING")
    print("=" * 60)

    print(f"🕒 Test started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"🌐 Firebase URL: {FIREBASE_WEBHOOK_URL}")

    # Test 1: Direct Firebase test
    firebase_ok = test_firebase_webhook_direct()

    # Test 2: Detection system check
    detection_ok = check_ui_detection_endpoint()

    # Test 3: Multiple predator types
    test_different_predators()

    # Test 4: Cooldown logic
    test_notification_cooldown()

    print("\n" + "=" * 60)
    print("📋 TEST SUMMARY")
    print("=" * 60)
    print(f"🔥 Firebase Cloud Function: {'✅ WORKING' if firebase_ok else '❌ FAILED'}")
    print(f"🤖 Detection System: {'✅ WORKING' if detection_ok else '❌ FAILED'}")
    print("\n📱 NEXT STEPS:")

    if firebase_ok:
        print("✅ Firebase is working - check your phone for notifications!")
        print("🎯 If no notifications appear on phone:")
        print("   1. Check phone notification settings")
        print("   2. Verify app is logged in")
        print("   3. Check FCM token registration")
    else:
        print("❌ Firebase webhook failed - check network/authentication")

    if detection_ok:
        print("✅ Live detection system is running")
        print("🧪 Test by showing objects to camera")
    else:
        print("❌ Detection system not reachable")
        print("🔧 Check: sudo systemctl status camera-stream")

if __name__ == "__main__":
    main()