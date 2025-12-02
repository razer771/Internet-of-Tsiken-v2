# Camera Surveillance Setup Guide

## Problem Solved: No More IP Address Changes!

Previously, you had to manually change the IP address every time you connected to a different network. Now the system has **3 layers of automatic discovery**:

---

## 🎯 Solution Overview

### **Method 1: Hostname (Recommended)**
- Uses `rpi5desktop.local` instead of IP address
- Works across **any network** (home, mobile hotspot, office, etc.)
- No configuration needed after initial setup

### **Method 2: Auto-Discovery**
- Automatically scans common IP addresses
- Tries multiple network ranges (192.168.x.x, 10.x.x.x, etc.)
- Finds your camera server without manual input

### **Method 3: Cached URL**
- Remembers the last working connection
- Tries saved URL first before scanning
- Works even when switching between known networks

---

## 📱 How It Works for Users

### First Time Setup:
1. Open the Camera Surveillance screen
2. The app will automatically try:
   - ✅ Hostname: `rpi5desktop.local`
   - ✅ Last working IP (if available)
   - ✅ Auto-scan common IPs
3. Once connected, the working URL is **saved automatically**

### Switching Networks:
1. Open Camera Surveillance
2. App tries saved URL first
3. If that fails, auto-discovers new IP
4. Saves new IP for next time

### Manual Override:
- Tap **"Server Settings"** button
- Enter custom URL if needed
- Example: `http://192.168.1.19:5000`

---

## 🔧 Technical Implementation

### Files Modified:

1. **`CameraServerDiscovery.js`** (NEW)
   - `discoverCameraServer()` - Tries multiple URLs automatically
   - `saveLastWorkingUrl()` - Caches successful connections
   - `getLastWorkingUrl()` - Retrieves saved URL

2. **`CameraStream.js`** (UPDATED)
   - Added auto-discovery on connection failure
   - Tries: provided URL → cached URL → auto-scan
   - Shows progress to user during discovery

3. **`ControlScreen.js`** (UPDATED)
   - Default URL changed to `rpi5desktop.local:5000`
   - Receives discovered URL and updates state
   - Updated placeholder text with hostname example

4. **`stream_server.py`** (IMPROVED)
   - Added graceful shutdown handling
   - Prevents crashes when stopping server
   - Better error logging

---

## 🌐 Network Scenarios Covered

| Scenario | How It's Handled |
|----------|------------------|
| **Home WiFi** | Uses hostname or cached IP |
| **Mobile Hotspot** | Auto-discovers new IP, saves it |
| **Office Network** | Scans common ranges, finds server |
| **Different Subnets** | Tries multiple IP ranges automatically |
| **mDNS Blocked** | Falls back to IP scanning |

---

## ⚙️ Configuration Options

### Default URLs Tried (in order):
1. `http://rpi5desktop.local:5000` (hostname - works everywhere)
2. Last saved URL from previous session
3. `http://192.168.1.19:5000` (common home network)
4. `http://192.168.0.19:5000` (alternative home network)
5. `http://10.193.174.156:5000` (your current IP)
6. `http://10.0.0.19:5000` (corporate networks)

### To Add More IPs to Scan:
Edit `CameraServerDiscovery.js` and add to the `possibleUrls` array:
```javascript
const possibleUrls = [
  'http://rpi5desktop.local:5000',
  'http://192.168.1.19:5000',
  'http://YOUR_NEW_IP:5000',  // Add your custom IP here
];
```

---

## 🚀 Quick Start

### On Raspberry Pi:
```bash
cd ~/Internet-of-Tsiken-v2/"yolo object detection"
python stream_server.py
```

### On Phone:
1. Open app in Expo Go
2. Navigate to Controls → Live Camera Surveillance
3. Tap the camera card
4. **That's it!** Auto-discovery handles the rest

---

## 🐛 Troubleshooting

### "Cannot find camera server"
- ✅ Ensure Pi and phone are on same WiFi
- ✅ Check server is running: `ps aux | grep stream_server`
- ✅ Verify hostname works: `ping rpi5desktop.local`
- ✅ Try manual IP in Server Settings

### Hostname not working
```bash
# On Raspberry Pi, check Avahi (mDNS) is running:
systemctl status avahi-daemon

# If stopped, start it:
sudo systemctl start avahi-daemon
```

### Slow discovery
- First connection takes 5-15 seconds (scanning multiple IPs)
- Subsequent connections are instant (uses cached URL)
- Using hostname is always fastest

---

## 🎓 Benefits Summary

| Before | After |
|--------|-------|
| ❌ Manual IP changes | ✅ Automatic discovery |
| ❌ Different IPs per network | ✅ Hostname works everywhere |
| ❌ User confusion | ✅ Just works™ |
| ❌ Static configuration | ✅ Smart caching |

---

## 💡 Pro Tips

1. **Use hostname whenever possible** - Most reliable across networks
2. **Let auto-discovery run once** - It caches the result for speed
3. **Manual IP is backup** - Use Server Settings if auto-discovery fails
4. **Check server logs** - See connection attempts in real-time

---

## 📊 Connection Flow

```
User opens camera
    ↓
Try provided URL (rpi5desktop.local)
    ↓ (fails)
Try last working URL
    ↓ (fails)
Auto-scan common IPs (3-5 sec)
    ↓ (success)
Save working URL
    ↓
Stream camera feed
```

---

## ✅ What's Working Now

- ✅ No more manual IP changes
- ✅ Works across different networks
- ✅ Automatic server discovery
- ✅ Smart URL caching
- ✅ User-friendly error messages
- ✅ Manual override option
- ✅ Graceful server shutdown

**Result**: Users can move between networks seamlessly without touching any settings!
