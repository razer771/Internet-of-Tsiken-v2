import subprocess
import requests
import json
import time
import datetime

# Firebase Project Info
PROJECT_ID = "internet-of-tsiken-f0ad4"
# Using the Firestore REST API
FIRESTORE_URL = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents/camera_settings/latest"

def get_tailscale_ip():
    try:
        # Run the 'tailscale ip -4' command to get the IPv4 address
        result = subprocess.run(['tailscale', 'ip', '-4'], capture_output=True, text=True, check=True)
        ip = result.stdout.strip()
        if ip:
            return ip
    except Exception as e:
        print(f"Error getting Tailscale IP: {e}")
    return None

def update_firebase(ip_address):
    # Prepare the document structure for Firestore REST API
    port = "5000"
    full_url = f"http://{ip_address}:{port}"
    current_time = datetime.datetime.now().isoformat()
    
    data = {
        "fields": {
            "ip": {
                "stringValue": ip_address
            },
            "url": {
                "stringValue": full_url
            },
            "port": {
                "stringValue": port
            },
            "last_updated": {
                "stringValue": current_time
            },
            "status": {
                "stringValue": "online"
            }
        }
    }
    
    try:
        print(f"Updating Firebase with URL: {full_url}")
        # PATCH request to create or update the document
        # updateMask ensures we only update the fields provided, without deleting others
        params = {
            "updateMask.fieldPaths": ["ip", "url", "port", "last_updated", "status"]
        }
        
        response = requests.patch(FIRESTORE_URL, params=params, json=data)
        
        if response.status_code == 200:
            print("Successfully updated Firebase!")
        else:
            print(f"Failed to update Firebase: {response.status_code}")
            print(response.text)
            
    except Exception as e:
        print(f"Error connecting to Firebase: {e}")

if __name__ == "__main__":
    print("Fetching Tailscale IP...")
    # Wait a moment for network to establish on boot
    time.sleep(2) 

    ip = get_tailscale_ip()
    
    if ip:
        print(f"Using Tailscale IP: {ip}")
        update_firebase(ip)
    else:
        print("Could not find a Tailscale IP. Are you connected to Tailscale?")
