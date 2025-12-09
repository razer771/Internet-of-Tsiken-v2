# 🚀 Camera Server Deployment Guide

This guide explains how to transition from **development testing** to **production APK deployment**.

---

## 📖 Understanding the Architecture

### What Runs Where?

```
┌─────────────────────┐         WiFi          ┌─────────────────────┐
│   Raspberry Pi      │ ◄─────────────────► │   Android Phone     │
│                     │                       │                     │
│  • Camera Hardware  │                       │  • Mobile APK       │
│  • YOLO AI Model    │                       │  • User Interface   │
│  • Flask Server     │                       │  • Auto Discovery   │
│  • Port 5000        │                       │  • Video Display    │
└─────────────────────┘                       └─────────────────────┘
   Server (always on)                          Client (connects)
```

**Key Point:** The camera server runs on the Raspberry Pi, NOT on your phone. The APK just connects to it.

---

## 🎯 Two Deployment Modes

### Mode 1: Development (Testing with Expo Go)

**When:** You're developing and testing features

**How it works:**
1. You manually start the camera server
2. You run `npm start` for Expo
3. You test on phone with Expo Go app
4. You manually stop the server when done

**Commands:**
```bash
# Start camera server (in one terminal)
cd ~/Internet-of-Tsiken-v2/"yolo object detection"
python stream_server.py

# Start Expo (in another terminal)
cd ~/Internet-of-Tsiken-v2
npm start

# Stop camera server when done
Press Ctrl+C
```

### Mode 2: Production (APK Installed)

**When:** You've built an APK and users are installing it

**How it works:**
1. Camera server auto-starts when Raspberry Pi boots
2. Server runs 24/7 in the background
3. APK connects whenever user opens the app
4. No manual intervention needed

**One-time setup:**
```bash
cd ~/Internet-of-Tsiken-v2/"yolo object detection"
./install_service.sh
```

**That's it!** Server now runs forever.

---

## 📋 Step-by-Step Production Deployment

### Prerequisites Checklist

- ✅ Camera server tested and working in development mode
- ✅ Mobile app tested with Expo Go
- ✅ Firebase configured correctly
- ✅ Raspberry Pi has stable power supply
- ✅ Raspberry Pi connected to reliable WiFi

---

### Step 1: Install Auto-Start Service on Raspberry Pi

**What this does:** Makes the camera server start automatically when the Pi boots up, and restart if it crashes.

```bash
cd ~/Internet-of-Tsiken-v2/"yolo object detection"
./install_service.sh
```

**Expected output:**
```
📦 Installing YOLO Camera Server as systemd service...
✅ Service file created
✅ Service enabled for auto-start
✅ Service started
🚀 The camera server will now start automatically on boot!
```

**Verify it's working:**
```bash
# Check service status
sudo systemctl status yolo-camera

# You should see "active (running)" in green
```

**Test it survives reboot:**
```bash
# Reboot the Pi
sudo reboot

# Wait for Pi to boot up (30-60 seconds)

# SSH back in and check
sudo systemctl status yolo-camera

# Should still be running!
```

---

### Step 2: Verify Network Connectivity

**Test from the Raspberry Pi itself:**
```bash
curl http://localhost:5000/status
```

**Expected response:**
```json
{
  "camera": true,
  "model": true,
  "status": "online",
  "timestamp": "2025-12-04T07:45:30.123456"
}
```

**Test from your computer (on same network):**
```bash
# Replace with your Pi's IP
curl http://192.168.68.134:5000/status

# Or use hostname
curl http://rpi5desktop.local:5000/status
```

---

### Step 3: Build Production APK

**Option A: Using EAS Build (Recommended)**

```bash
cd ~/Internet-of-Tsiken-v2

# Make sure you're logged in
eas login

# Build for Android
eas build --platform android --profile preview

# Or for production release
eas build --platform android --profile production
```

**Option B: Local Build**

```bash
cd ~/Internet-of-Tsiken-v2

# Build locally
npx expo run:android --variant release
```

**Wait for build to complete** (5-15 minutes)

You'll get a download link or APK file location.

---

### Step 4: Install APK on Android Device

1. **Download the APK** from EAS build link to your phone
2. **Enable "Install from Unknown Sources"** in Android settings
3. **Install the APK**
4. **Open the app**

---

### Step 5: Test Camera Connection

1. Open the installed APK
2. Log in to your account
3. Navigate to **Control Screen** or **Camera Stream**
4. Click **"Detect Camera"** button

**What should happen:**
- ⏳ "Discovering camera server..." appears
- ✅ "Camera connected" message
- 📹 Live video stream with YOLO detections appears
- 📊 FPS counter visible on screen
- 🔴 Bounding boxes around detected objects

---

### Step 6: Test Auto-Reconnection

Test that the system works reliably:

**Test 1: App restart**
- Close the app completely
- Reopen it
- Camera should reconnect automatically

**Test 2: Network switch**
- Disconnect phone from WiFi
- Reconnect to same WiFi
- Camera should reconnect

**Test 3: Server restart**
```bash
# On Raspberry Pi
sudo systemctl restart yolo-camera

# On phone: close and reopen app
# Should reconnect within 5-10 seconds
```

**Test 4: Raspberry Pi reboot**
```bash
# On Raspberry Pi
sudo reboot

# Wait 60 seconds
# On phone: open app
# Should connect automatically
```

---

## 🔧 Managing the Camera Service

### Check Service Status

```bash
sudo systemctl status yolo-camera
```

**What to look for:**
- `Active: active (running)` = Good ✅
- `Active: inactive (dead)` = Not running ❌
- `Active: failed` = Crashed ❌

### View Live Logs

```bash
# Follow logs in real-time
sudo journalctl -u yolo-camera -f

# View last 50 lines
sudo journalctl -u yolo-camera -n 50

# View logs from today
sudo journalctl -u yolo-camera --since today
```

### Manual Control

```bash
# Stop the service
sudo systemctl stop yolo-camera

# Start the service
sudo systemctl start yolo-camera

# Restart the service
sudo systemctl restart yolo-camera
```

### Disable Auto-Start (go back to manual mode)

```bash
# Stop and disable
sudo systemctl stop yolo-camera
sudo systemctl disable yolo-camera

# Now you can run manually again
cd ~/Internet-of-Tsiken-v2/"yolo object detection"
python stream_server.py
```

### Re-enable Auto-Start

```bash
sudo systemctl enable yolo-camera
sudo systemctl start yolo-camera
```

### Completely Uninstall

```bash
cd ~/Internet-of-Tsiken-v2/"yolo object detection"
./uninstall_service.sh
```

---

## 🐛 Troubleshooting

### Camera server not starting

**Check logs:**
```bash
sudo journalctl -u yolo-camera -n 100
```

**Common issues:**

1. **Python packages missing:**
```bash
cd ~/Internet-of-Tsiken-v2/"yolo object detection"
pip install -r requirements.txt
sudo systemctl restart yolo-camera
```

2. **Camera already in use:**
```bash
# Kill other processes using camera
pkill -f libcamera
pkill -f picamera
sudo systemctl restart yolo-camera
```

3. **Permission issues:**
```bash
# Make sure your user is in video group
sudo usermod -a -G video $USER
# Log out and back in
```

### APK can't find camera server

**On Raspberry Pi:**
```bash
# Check if server is running
curl http://localhost:5000/status

# Check firewall
sudo ufw status
sudo ufw allow 5000
```

**On Android:**
- Make sure phone is on same WiFi as Pi
- Try forgetting and reconnecting to WiFi
- Check if mDNS is working: ping rpi5desktop.local from computer

**In the app:**
- Try manual camera server entry
- Go to Settings → Camera Server
- Enter: `http://192.168.68.134:5000` (your Pi's IP)

### Camera stream is laggy

**Reduce quality for better FPS:**

Edit `stream_server.py`:
```python
# Line ~42: Reduce resolution
camera.preview_configuration.main.size = (320, 320)  # Was 416x416

# Line ~91: Reduce JPEG quality
cv2.IMWRITE_JPEG_QUALITY, 50  # Was 70

# Line ~88: Skip more frames
if frame_count % 3 == 0:  # Was % 2
```

Then restart:
```bash
sudo systemctl restart yolo-camera
```

---

## 📊 Performance Optimization

### Default Settings (Balanced)
- Resolution: 416x416
- JPEG Quality: 70%
- Frame Skip: Every 2nd frame
- Expected FPS: 10-15

### High Quality (Slower)
- Resolution: 640x640
- JPEG Quality: 90%
- Frame Skip: None
- Expected FPS: 5-8

### High Speed (Lower Quality)
- Resolution: 320x320
- JPEG Quality: 50%
- Frame Skip: Every 3rd frame
- Expected FPS: 15-20

---

## 🔐 Security Considerations

### For Local Network Only (Current Setup)

✅ **Safe to use** on home/private WiFi
❌ **Do NOT expose** to public internet without authentication

### If You Need Remote Access

Use Cloudflare Tunnel (already configured):
```bash
cd ~/Internet-of-Tsiken-v2/"yolo object detection"
./start_tunnel.sh
```

This creates a secure public URL that works from anywhere.

---

## 📞 Support

If you encounter issues:

1. **Check logs:** `sudo journalctl -u yolo-camera -n 100`
2. **Test manually:** Stop service, run `python stream_server.py`
3. **Check network:** `ping rpi5desktop.local` from phone's network
4. **Reinstall service:** `./uninstall_service.sh` then `./install_service.sh`

---

## ✅ Production Checklist

Before deploying to end users:

- [ ] Camera server installed as service
- [ ] Service starts on boot (test with reboot)
- [ ] APK built and tested
- [ ] Camera auto-discovery working
- [ ] Predator detection tested
- [ ] Firebase notifications working
- [ ] Network reconnection tested
- [ ] Pi has UPS or stable power
- [ ] Pi has reliable WiFi connection
- [ ] Logs are clean (no errors)

---

**You're now ready for production deployment! 🎉**
