#!/usr/bin/env python3
"""
System Pop-up Notification Tester
Tests if notifications appear as proper system pop-ups (not just in-app)
"""

import requests
import json
import time
from datetime import datetime

# Firebase Cloud Function URL
FIREBASE_WEBHOOK_URL = "https://us-central1-internet-of-tsiken-f0ad4.cloudfunctions.net/notifyPredator"

def test_popup_notification():
    """
    Test high-priority notification that should pop up on screen
    """
    print("🚨 TESTING SYSTEM POP-UP NOTIFICATION")
    print("=" * 50)

    # Create test data for maximum priority notification
    critical_alert_data = {
        "predator_type": "Emergency_Test_Alert",
        "confidence": 1.0,  # Maximum confidence
        "camera_id": "Pop_Up_Test_Camera",
        "timestamp": datetime.now().isoformat()
    }

    print("📱 INSTRUCTIONS BEFORE TESTING:")
    print("1. 🔒 Lock your phone screen")
    print("2. 📵 Put phone face down or in pocket")
    print("3. 🔇 Make sure phone is NOT in silent mode")
    print("4. ⏰ Wait for the notification...")
    print("")

    input("Press ENTER when your phone is locked and ready for testing...")

    print("\n🚀 Sending CRITICAL PRIORITY notification...")
    print("⏰ Timestamp:", datetime.now().strftime("%H:%M:%S"))

    try:
        response = requests.post(
            FIREBASE_WEBHOOK_URL,
            json=critical_alert_data,
            timeout=10,
            headers={'Content-Type': 'application/json'}
        )

        if response.status_code == 200:
            print("✅ Firebase response: SUCCESS")
            print("📱 CHECK YOUR PHONE NOW!")
            print("")
            print("🔍 You should see:")
            print("   📱 Pop-up notification on locked screen")
            print("   🔊 Sound/vibration")
            print("   💡 LED light (if available)")
            print("   🆘 Title: '🚨 PREDATOR ALERT!'")
            print("   📝 Message: 'URGENT: Emergency_Test_Alert detected...'")

            print("")
            response = input("❓ Did you get a POP-UP notification on your phone screen? (y/n): ")

            if response.lower().startswith('y'):
                print("🎉 SUCCESS: Pop-up notifications are working!")
                return True
            else:
                print("❌ FAILED: No pop-up notification received")
                print("🔧 Troubleshooting needed...")
                return False
        else:
            print(f"❌ Firebase error: {response.status_code}")
            print(f"Response: {response.text}")
            return False

    except Exception as e:
        print(f"💥 Error: {e}")
        return False

def test_multiple_scenarios():
    """
    Test different notification scenarios
    """
    print("\n🧪 TESTING MULTIPLE NOTIFICATION SCENARIOS")
    print("=" * 50)

    scenarios = [
        {
            "name": "App Closed",
            "predator": "App_Closed_Dog",
            "instruction": "Close the Internet of Tsiken app completely"
        },
        {
            "name": "App Background",
            "predator": "App_Background_Cat",
            "instruction": "Open app, then press home button (app in background)"
        },
        {
            "name": "Phone Locked",
            "predator": "Phone_Locked_Rat",
            "instruction": "Lock your phone screen"
        }
    ]

    results = {}

    for i, scenario in enumerate(scenarios, 1):
        print(f"\n--- Scenario {i}: {scenario['name']} ---")
        print(f"📋 {scenario['instruction']}")

        input("Press ENTER when ready...")

        test_data = {
            "predator_type": scenario['predator'],
            "confidence": 0.95,
            "camera_id": f"Test_{scenario['name'].replace(' ', '_')}",
            "timestamp": datetime.now().isoformat()
        }

        try:
            response = requests.post(FIREBASE_WEBHOOK_URL, json=test_data, timeout=5)

            if response.status_code == 200:
                print("✅ Notification sent")
                got_popup = input("❓ Did you get a POP-UP notification? (y/n): ")
                results[scenario['name']] = got_popup.lower().startswith('y')
            else:
                print(f"❌ Failed: {response.status_code}")
                results[scenario['name']] = False

        except Exception as e:
            print(f"💥 Error: {e}")
            results[scenario['name']] = False

        if i < len(scenarios):
            print("⏳ Waiting 3 seconds before next test...")
            time.sleep(3)

    return results

def show_troubleshooting_guide(popup_working, scenario_results):
    """
    Show troubleshooting guide based on test results
    """
    print("\n" + "=" * 60)
    print("📋 NOTIFICATION TEST RESULTS & TROUBLESHOOTING")
    print("=" * 60)

    if popup_working:
        print("✅ BASIC POP-UP: Working")
    else:
        print("❌ BASIC POP-UP: Not working")

    if scenario_results:
        print("\n📱 SCENARIO RESULTS:")
        for scenario, working in scenario_results.items():
            status = "✅ Working" if working else "❌ Not working"
            print(f"   {scenario}: {status}")

    if not popup_working or not all(scenario_results.values() if scenario_results else []):
        print("\n🔧 TROUBLESHOOTING STEPS:")
        print("=" * 30)

        print("\n1️⃣ CHECK PHONE NOTIFICATION SETTINGS:")
        print("   📱 Settings > Apps > Internet of Tsiken > Notifications")
        print("   ✅ Enable 'Show notifications'")
        print("   ✅ Enable 'Pop on screen' or 'Heads-up notifications'")
        print("   ✅ Set importance to 'High' or 'Urgent'")
        print("   ✅ Enable sound and vibration")

        print("\n2️⃣ CHECK SYSTEM SETTINGS:")
        print("   🔇 Turn OFF silent/Do Not Disturb mode")
        print("   🔋 Settings > Battery > Battery Optimization > Internet of Tsiken > Don't optimize")
        print("   🔔 Settings > Notifications > Advanced > Turn ON 'Pop notifications on screen'")

        print("\n3️⃣ CHECK APP CONFIGURATION:")
        print("   📱 Open app and verify you're logged in")
        print("   🔄 Log out and log back in to refresh FCM token")
        print("   🔥 Check app console logs for FCM token generation")

        print("\n4️⃣ REBUILD APP WITH NEW CONFIGURATION:")
        print("   cd /home/charles/Internet-of-Tsiken-v2")
        print("   npx expo prebuild --clear")
        print("   npx expo start --dev-client")
        print("   (Or build preview APK: eas build --platform android --profile preview)")
    else:
        print("\n🎉 ALL TESTS PASSED!")
        print("✅ Your pop-up notifications are working correctly!")
        print("🚨 You will receive proper alerts when predators are detected!")

def main():
    print("📱 SYSTEM POP-UP NOTIFICATION TESTER")
    print("This tests if notifications appear as proper system pop-ups")
    print("(not just in-app notifications)")
    print("")

    # Test 1: Basic pop-up test
    popup_working = test_popup_notification()

    # Test 2: Multiple scenarios (only if basic test works)
    scenario_results = None
    if popup_working:
        test_scenarios = input("\n❓ Test multiple scenarios (app closed/background/locked)? (y/n): ")
        if test_scenarios.lower().startswith('y'):
            scenario_results = test_multiple_scenarios()

    # Show troubleshooting guide
    show_troubleshooting_guide(popup_working, scenario_results)

if __name__ == "__main__":
    main()