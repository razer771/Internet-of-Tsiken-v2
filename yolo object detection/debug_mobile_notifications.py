#!/usr/bin/env python3
"""
Mobile App Push Token Debugger
Check if your phone's FCM token is properly registered
"""

import json
import sys
import os

# Add parent directory to path to import Firebase config
sys.path.append('/home/charles/Internet-of-Tsiken-v2')

def check_fcm_token_registration():
    """
    Check if FCM tokens are registered in Firestore
    This requires Firebase Admin SDK setup
    """
    try:
        from google.cloud import firestore

        print("🔍 Checking FCM token registration in Firestore...")

        # Initialize Firestore client
        db = firestore.Client()

        # Get all users with push tokens
        users_ref = db.collection('users')
        users = users_ref.where('pushToken', '!=', None).stream()

        token_count = 0
        user_details = []

        for user in users:
            user_data = user.to_dict()
            token_count += 1

            user_info = {
                'user_id': user.id,
                'has_push_token': bool(user_data.get('pushToken')),
                'is_logged_in': user_data.get('isLoggedIn', 'Unknown'),
                'role': user_data.get('role', 'Unknown'),
                'token_preview': user_data.get('pushToken', 'None')[:20] + '...' if user_data.get('pushToken') else 'None'
            }
            user_details.append(user_info)

        print(f"📊 Found {token_count} users with FCM tokens")

        for i, user in enumerate(user_details, 1):
            print(f"\n👤 User {i}:")
            print(f"   ID: {user['user_id']}")
            print(f"   Push Token: {user['token_preview']}")
            print(f"   Logged In: {user['is_logged_in']}")
            print(f"   Role: {user['role']}")

        if token_count == 0:
            print("❌ No FCM tokens found!")
            print("🔧 SOLUTION: Open your React Native app and log in")
            return False
        else:
            print(f"✅ Found {token_count} registered device(s)")
            return True

    except ImportError:
        print("⚠️ Firebase Admin SDK not available for direct token checking")
        print("💡 Alternative: Check Firebase Console manually")
        return None
    except Exception as e:
        print(f"❌ Error checking FCM tokens: {e}")
        return False

def check_firebase_project_config():
    """
    Verify Firebase project configuration
    """
    print("\n🔧 Checking Firebase project configuration...")

    config_files = [
        '/home/charles/Internet-of-Tsiken-v2/google-services.json',
        '/home/charles/Internet-of-Tsiken-v2/config/firebaseconfig.js',
        '/home/charles/Internet-of-Tsiken-v2/.firebaserc'
    ]

    for config_file in config_files:
        if os.path.exists(config_file):
            print(f"✅ Found: {config_file}")

            # Check project ID in .firebaserc
            if config_file.endswith('.firebaserc'):
                try:
                    with open(config_file, 'r') as f:
                        firebase_config = json.load(f)
                    project_id = firebase_config.get('projects', {}).get('default', 'Unknown')
                    print(f"   Project ID: {project_id}")
                except:
                    print("   Could not read project ID")
        else:
            print(f"❌ Missing: {config_file}")

def troubleshoot_mobile_app():
    """
    Provide mobile app troubleshooting steps
    """
    print("\n📱 MOBILE APP TROUBLESHOOTING CHECKLIST")
    print("=" * 50)

    steps = [
        {
            "step": "1. App Login Status",
            "check": "Open app and verify you're logged in",
            "fix": "Log out and log back in to refresh FCM token"
        },
        {
            "step": "2. Phone Notification Settings",
            "check": "Settings > Apps > [Your App] > Notifications",
            "fix": "Enable all notification permissions"
        },
        {
            "step": "3. Android Battery Optimization",
            "check": "Settings > Battery > Battery Optimization",
            "fix": "Set app to 'Not Optimized'"
        },
        {
            "step": "4. FCM Token Generation",
            "check": "Check app logs for 'Push token:' message",
            "fix": "Restart app to regenerate token"
        },
        {
            "step": "5. Firestore User Document",
            "check": "Verify user has pushToken field in Firestore",
            "fix": "Log out/in to update user document"
        }
    ]

    for step in steps:
        print(f"\n{step['step']}:")
        print(f"   📋 Check: {step['check']}")
        print(f"   🔧 Fix: {step['fix']}")

def main():
    print("📱 MOBILE APP PUSH NOTIFICATION DEBUGGER")
    print("=" * 50)

    # Check Firebase config
    check_firebase_project_config()

    # Check FCM token registration
    token_status = check_fcm_token_registration()

    # Provide troubleshooting steps
    troubleshoot_mobile_app()

    print("\n" + "=" * 50)
    print("🎯 RECOMMENDED NEXT STEPS:")
    print("=" * 50)

    if token_status == False:
        print("1. 🚨 PRIORITY: Open your React Native app and log in")
        print("2. Check app console logs for FCM token generation")
        print("3. Verify app has notification permissions")
    elif token_status == True:
        print("1. ✅ FCM tokens registered - check phone settings")
        print("2. Verify app is in foreground or background (not killed)")
        print("3. Test with app open vs closed vs background")
    else:
        print("1. 🔍 Check Firebase Console > Cloud Firestore")
        print("2. Look for users collection with pushToken fields")
        print("3. Verify React Native app FCM token registration")

if __name__ == "__main__":
    main()