# ESP32 Auto-Discovery Setup Guide

## Overview

Your ESP32 can now be automatically discovered on the network using **mDNS (Multicast DNS)**. This eliminates the need to manually find and configure IP addresses.

---

## What Changed?

### ✅ ESP32 Firmware (combined_system.ino)
- Added mDNS support with hostname: `tsiken-esp32.local`
- ESP32 automatically advertises itself on the network
- No IP address configuration needed

### ✅ React Native App (esp32config.js)
- Changed from hard-coded IP `192.168.137.42`
- Now uses hostname `tsiken-esp32.local` for auto-discovery
- Works seamlessly across different networks

---

## How to Use

### Step 1: Upload New Firmware to ESP32

1. Open Arduino IDE
2. Load `esp32/combined_system.ino`
3. Upload to your ESP32
4. Open Serial Monitor (115200 baud)

### Step 2: Verify mDNS Started

After WiFi connects, you should see:
```
✓ WiFi Connected!
  IP Address: 192.168.x.x
  Signal: -45 dBm

✓ mDNS responder started
  Hostname: tsiken-esp32.local
  Service: HTTP on port 80
```

### Step 3: Test Connection

#### On Windows (PowerShell):
```powershell
ping tsiken-esp32.local
```

#### On Mac/Linux:
```bash
ping tsiken-esp32.local
```

You should see responses from the ESP32's IP address.

### Step 4: Run Your App

The app will automatically connect to `http://tsiken-esp32.local:80` - no configuration needed!

---

## How It Works

### mDNS (Multicast DNS)
- Also known as "Bonjour" (Apple) or "Avahi" (Linux)
- Allows devices to find each other by hostname on local networks
- Works without DNS servers or manual configuration

### Network Flow
```
App → "tsiken-esp32.local" → Network broadcasts mDNS query
                           ↓
                     ESP32 responds with IP
                           ↓
App connects to ESP32's IP address automatically
```

---

## Troubleshooting

### Problem: Can't ping tsiken-esp32.local

**Solution 1: Check ESP32 Serial Monitor**
- Verify mDNS started successfully
- Look for "✓ mDNS responder started"

**Solution 2: Ensure Same Network**
- ESP32 and phone/computer must be on same WiFi network
- Check WiFi SSID in ESP32 firmware matches your network

**Solution 3: Windows mDNS Support**
- Install Bonjour Print Services: https://support.apple.com/kb/DL999
- Or use IP address as fallback

### Problem: App can't connect

**Fallback to IP Address:**
1. Check ESP32 Serial Monitor for IP address
2. Edit `config/esp32config.js`:
```javascript
ipAddress: '192.168.x.x', // Use actual IP instead of hostname
```

### Problem: Connection works at home but not elsewhere

**This is normal!** mDNS only works on local networks. Each network may assign different IPs, but the hostname `tsiken-esp32.local` will always work.

---

## Customization

### Change Hostname

Edit `esp32/combined_system.ino` line 8:
```cpp
const char *MDNS_HOSTNAME = "my-custom-name"; // Will be my-custom-name.local
```

Then update `config/esp32config.js`:
```javascript
ipAddress: 'my-custom-name.local',
```

---

## Technical Details

### ESP32 Code Changes

**Added Include:**
```cpp
#include <ESPmDNS.h>
```

**mDNS Initialization (after WiFi connects):**
```cpp
if (MDNS.begin(MDNS_HOSTNAME)) {
  Serial.println("✓ mDNS responder started");
  MDNS.addService("http", "tcp", 80);
}
```

**Loop Update:**
```cpp
void loop() {
  MDNS.update(); // Keep mDNS alive
  // ... rest of code
}
```

### App Code Changes

**esp32config.js:**
```javascript
// Before: ipAddress: '192.168.137.42'
// After:  ipAddress: 'tsiken-esp32.local'
```

---

## Benefits

✅ **No Manual Configuration** - ESP32 automatically discovered  
✅ **Works Across Networks** - Hostname stays the same  
✅ **No IP Hunting** - No need to check Serial Monitor  
✅ **User-Friendly** - Just upload firmware and connect  
✅ **Standard Protocol** - Works with iOS, Android, Windows, Mac, Linux  

---

## Next Steps

1. Upload the updated firmware to ESP32
2. Verify mDNS started in Serial Monitor
3. Test with `ping tsiken-esp32.local`
4. Run your app - it should connect automatically!

---

## Support

If auto-discovery doesn't work on your network:
- Firewall may block mDNS (port 5353 UDP)
- Some routers disable mDNS/Bonjour
- Use IP address as fallback in esp32config.js

---

**Last Updated:** December 2024  
**Firmware Version:** 2.0.0  
**mDNS Hostname:** tsiken-esp32.local  
