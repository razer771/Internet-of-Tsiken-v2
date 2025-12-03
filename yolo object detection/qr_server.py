#!/usr/bin/env python3
"""
qr_server.py - Display camera server connection info
Shows current IP that mobile app should connect to
"""

import socket

def get_local_ip():
    """Get the primary local IP address"""
    try:
        # Connect to external server to determine local IP
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return "127.0.0.1"

if __name__ == "__main__":
    ip = get_local_ip()
    hostname = socket.gethostname()
    
    print("\n" + "="*60)
    print("🎥  CAMERA SERVER CONNECTION INFO  🎥")
    print("="*60)
    print(f"\n📡 Current IP: {ip}")
    print(f"🖥️  Hostname: {hostname}.local")
    print(f"\n📱 ENTER ONE OF THESE IN YOUR APP:")
    print(f"\n   Option 1 (Recommended): http://{hostname}.local:5000")
    print(f"   Option 2 (Backup):      http://{ip}:5000")
    print("\n💡 Option 1 works on ANY network automatically!")
    print("💡 Option 2 changes when you switch WiFi networks")
    print("\n" + "="*60 + "\n")

