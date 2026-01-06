# 🔴 CRITICAL: Network Request Failed - SOLUTION

## The Problem

**"Network request failed"** happens because:

### 🌐 **Expo Tunnel Mode vs Local Network**
- **Your setup**: Expo running in `--tunnel` mode
- **The issue**: Tunnel routes through Expo's internet servers
- **Camera server**: Running on local network (192.168.1.19)
- **Result**: Phone → Internet (Expo) ❌ Cannot reach → Local Pi (192.168.1.19)

## ✅ THE FIX: Use LAN Mode Instead

### Step 1: Stop Current Expo Server
```bash
# Press Ctrl+C in the Expo terminal
```

### Step 2: Restart Expo in LAN Mode
```bash
cd ~/Internet-of-Tsiken-v2
npx expo start
# Do NOT use --tunnel
```

### Step 3: Ensure Same WiFi Network
- Raspberry Pi: Connected to WiFi
- Phone: Connected to **SAME** WiFi network
- Check IP: `hostname -I` → Should show 192.168.1.x

### Step 4: Scan QR Code
- Expo will show QR code
- Scan with Expo Go app
- App will load via LAN (local network)

### Step 5: Test Camera
- Open app
- Tap "Live Camera Surveillance"
- Should connect to `http://192.168.1.19:5000`

## 🔧 Start Camera Server

```bash
cd "yolo object detection"
python stream_server.py
```

## 🧪 Test Connection

```bash
# From Raspberry Pi
curl http://localhost:5000/status

# Should return:
# {"status":"online","camera":true,"model":true,"timestamp":"..."}
```

## 📱 Alternative: Expo LAN + ngrok (Advanced)

If you MUST use tunnel mode, expose Pi server to internet:

```bash
# Install ngrok on Raspberry Pi
sudo apt install ngrok

# Start ngrok tunnel
ngrok http 5000

# Use ngrok URL in app (e.g., https://abc123.ngrok.io)
```

## ⚠️ Why Tunnel Mode Fails

```
Phone (anywhere) 
  ↓
Expo Tunnel (internet) 
  ↓
❌ Cannot reach local 192.168.1.19
```

## ✅ Why LAN Mode Works

```
Phone (same WiFi)
  ↓
Local Network (192.168.1.x)
  ↓
✅ Reaches Pi at 192.168.1.19:5000
```

## Quick Checklist

- [ ] Stop Expo tunnel mode
- [ ] Run `npx expo start` (without --tunnel)
- [ ] Confirm same WiFi network
- [ ] Start camera server: `python stream_server.py`
- [ ] Test: `curl http://localhost:5000/status`
- [ ] Scan QR in Expo Go
- [ ] Open camera surveillance in app

## Current Server Status

**Server IP**: `http://192.168.1.19:5000`
**Endpoints**:
- `/status` - Health check
- `/video_feed` - MJPEG stream
- `/detections` - Detection data
- `/snapshot` - Single frame

The fix is simple: **Stop using `--tunnel` and use regular LAN mode!**
