# Complete Deployment Guide: WebRTC IoT Monitoring System

## Architecture Overview

This system consists of three decoupled components:

1. **MediaMTX (Raspberry Pi 5)**: Hardware-accelerated H.264 video streaming via WebRTC + RTSP
2. **Python AI Backend (Raspberry Pi 5)**: YOLOv8 NCNN inference + FastAPI control server
3. **React Native Expo Client (Mobile)**: WebRTC video player with AI detection overlay

```
┌─────────────────────────────────────────────────────────────┐
│ Raspberry Pi 5 (Debian 13)                                   │
│                                                               │
│  ┌──────────────┐     RTSP      ┌─────────────────────┐     │
│  │   MediaMTX   │◄──────────────│  Python AI Backend  │     │
│  │ (Port 8889)  │   localhost   │  - Inference (10fps)│     │
│  │              │   :8554/cam   │  - FastAPI (8000)   │     │
│  └──────┬───────┘               └──────────┬──────────┘     │
│         │ WebRTC WHEP                      │ WebSocket      │
│         │ (STUN NAT)                       │ /ws/alerts     │
└─────────┼──────────────────────────────────┼────────────────┘
          │                                  │
          │          Internet / LAN          │
          │      (Cloudflare Tunnel)         │
          │                                  │
┌─────────▼──────────────────────────────────▼────────────────┐
│ React Native Expo Client (Mobile)                            │
│  - WebRTC Stream Player                                      │
│  - AI Detection Overlay (Bounding Boxes)                     │
│  - IoT Control Interface                                     │
└───────────────────────────────────────────────────────────────┘
```

---

## Phase 1: MediaMTX Installation (Raspberry Pi 5)

### 1.1 Install MediaMTX

```bash
# Download latest MediaMTX for ARM64
cd /tmp
wget https://github.com/bluenviron/mediamtx/releases/latest/download/mediamtx_$(curl -s https://api.github.com/repos/bluenviron/mediamtx/releases/latest | grep -oP '"tag_name": "\K(.*)(?=")' | tr -d 'v')_linux_arm64v8.tar.gz

# Extract
tar -xzf mediamtx_*_linux_arm64v8.tar.gz

# Install
sudo mv mediamtx /usr/local/bin/
sudo chmod +x /usr/local/bin/mediamtx

# Copy configuration
sudo mkdir -p /usr/local/etc
sudo cp mediamtx.yml /usr/local/etc/
```

### 1.2 Configure Camera Permissions

```bash
# Add user to video group
sudo usermod -aG video $USER

# Verify camera detection
libcamera-hello --list-cameras

# Test camera stream
libcamera-vid -t 0 --width 1920 --height 1080 --framerate 30
```

### 1.3 Create Systemd Service

```bash
sudo nano /etc/systemd/system/mediamtx.service
```

Paste:

```ini
[Unit]
Description=MediaMTX RTSP/WebRTC Server
After=network.target
StartLimitIntervalSec=0

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi
ExecStart=/usr/local/bin/mediamtx /usr/local/etc/mediamtx.yml
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Start service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable mediamtx
sudo systemctl start mediamtx
sudo systemctl status mediamtx
```

### 1.4 Verify MediaMTX

```bash
# Check logs
journalctl -u mediamtx -f

# Test RTSP stream locally
ffplay rtsp://localhost:8554/cam

# Check stream info
ffprobe rtsp://localhost:8554/cam

# Access WebRTC endpoint (replace with your Pi's IP)
# http://192.168.1.100:8889
```

### 1.5 Network Configuration

```bash
# Find Raspberry Pi IP
ip addr show

# Open firewall ports (if enabled)
sudo ufw allow 8554/tcp  # RTSP
sudo ufw allow 8889/tcp  # WebRTC
sudo ufw allow 8189/udp  # ICE
```

---

## Phase 2: Python AI Backend Installation

### 2.1 Install System Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Python 3.11+
sudo apt install python3.11 python3.11-venv python3-pip -y

# Install OpenCV dependencies
sudo apt install libopencv-dev python3-opencv -y

# Install build tools for NCNN
sudo apt install cmake build-essential libvulkan-dev -y
```

### 2.2 Setup Python Environment

```bash
cd ~/Internet-of-Tsiken-v2/yolo\ object\ detection/

# Create virtual environment
python3.11 -m venv venv

# Activate
source venv/bin/activate

# Upgrade pip
pip install --upgrade pip setuptools wheel
```

### 2.3 Install Python Dependencies

```bash
pip install -r requirements_ai_backend.txt
```

### 2.4 Install NCNN (from source for optimal ARM64 performance)

```bash
cd /tmp

# Clone NCNN
git clone --depth=1 https://github.com/Tencent/ncnn.git
cd ncnn

# Build
mkdir -p build && cd build
cmake -DCMAKE_BUILD_TYPE=Release \
      -DNCNN_VULKAN=ON \
      -DNCNN_BUILD_EXAMPLES=OFF ..
make -j$(nproc)
sudo make install

# Install Python bindings
cd ../python
pip install .
```

### 2.5 Prepare YOLOv8 NCNN Model

If you don't have the NCNN model yet:

```bash
# Install ultralytics
pip install ultralytics

# Export YOLOv8n to NCNN format
python3 << 'EOF'
from ultralytics import YOLO

# Load model
model = YOLO('yolov8n.pt')

# Export to NCNN
model.export(format='ncnn', imgsz=640)
EOF

# This creates: yolov8n_ncnn_model/ directory
```

### 2.6 Configure Backend

Edit `ai_backend_server.py` configuration section:

```python
config = {
    "rtsp_url": "rtsp://localhost:8554/cam",
    "target_fps": 10,
    "model_param": "yolov8n_ncnn_model/model.param",
    "model_bin": "yolov8n_ncnn_model/model.bin",
    "conf_threshold": 0.5,
    "api_host": "0.0.0.0",
    "api_port": 8000
}
```

### 2.7 Test Backend Locally

```bash
# Run server
python ai_backend_server.py

# In another terminal, test WebSocket
pip install websocket-client
python3 << 'EOF'
import websocket
ws = websocket.create_connection("ws://localhost:8000/ws/alerts")
while True:
    print(ws.recv())
EOF
```

### 2.8 Create Systemd Service for Backend

```bash
sudo nano /etc/systemd/system/ai-backend.service
```

Paste:

```ini
[Unit]
Description=AI Inference & Control Backend
After=network.target mediamtx.service
Requires=mediamtx.service

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/Internet-of-Tsiken-v2/yolo object detection
Environment="PATH=/home/pi/Internet-of-Tsiken-v2/yolo object detection/venv/bin"
ExecStart=/home/pi/Internet-of-Tsiken-v2/yolo object detection/venv/bin/python ai_backend_server.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Start service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable ai-backend
sudo systemctl start ai-backend
sudo systemctl status ai-backend

# Monitor logs
journalctl -u ai-backend -f
```

---

## Phase 3: Cloudflare Tunnel Setup

### 3.1 Install Cloudflare Tunnel

```bash
# Download cloudflared
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64
sudo mv cloudflared-linux-arm64 /usr/local/bin/cloudflared
sudo chmod +x /usr/local/bin/cloudflared

# Authenticate
cloudflared tunnel login
```

### 3.2 Create Tunnel

```bash
# Create tunnel
cloudflared tunnel create iot-monitor

# Note the tunnel ID from output
```

### 3.3 Configure Tunnel

```bash
mkdir -p ~/.cloudflared
nano ~/.cloudflared/config.yml
```

Paste (replace YOUR_TUNNEL_ID):

```yaml
tunnel: YOUR_TUNNEL_ID
credentials-file: /home/pi/.cloudflared/YOUR_TUNNEL_ID.json

ingress:
  # WebRTC endpoint
  - hostname: iot-camera.yourdomain.com
    service: http://localhost:8889

  # API & WebSocket endpoint
  - hostname: iot-api.yourdomain.com
    service: http://localhost:8000

  # Catch-all
  - service: http_status:404
```

### 3.4 Route DNS

```bash
# Route your domain to the tunnel
cloudflared tunnel route dns iot-monitor iot-camera.yourdomain.com
cloudflared tunnel route dns iot-monitor iot-api.yourdomain.com
```

### 3.5 Start Tunnel

```bash
# Test tunnel
cloudflared tunnel run iot-monitor

# Install as service
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
```

---

## Phase 4: React Native Expo Client Setup

### 4.1 Install Dependencies

```bash
cd ~/Internet-of-Tsiken-v2

# Install required packages
npm install react-native-webrtc@124.0.1
npm install @react-native-community/netinfo@11.2.1

# Expo configuration
npx expo install expo-av
```

### 4.2 Configure Permissions (app.json)

Add to `app.json`:

```json
{
  "expo": {
    "plugins": [
      [
        "react-native-webrtc",
        {
          "cameraPermission": "Allow $(PRODUCT_NAME) to access your camera for video streaming",
          "microphonePermission": "Allow $(PRODUCT_NAME) to access your microphone"
        }
      ]
    ],
    "android": {
      "permissions": [
        "CAMERA",
        "RECORD_AUDIO",
        "MODIFY_AUDIO_SETTINGS",
        "INTERNET",
        "ACCESS_NETWORK_STATE"
      ]
    },
    "ios": {
      "infoPlist": {
        "NSCameraUsageDescription": "Camera access for video streaming",
        "NSMicrophoneUsageDescription": "Microphone access (not used but required by WebRTC)"
      }
    }
  }
}
```

### 4.3 Configure Endpoints

Edit `screens/User/RemoteIoTMonitorScreen.js`:

```javascript
const CONFIG = {
  // Replace with your Cloudflare Tunnel URL
  MEDIAMTX_WHEP_URL: "https://iot-camera.yourdomain.com/cam/whep",

  // Replace with your Cloudflare Tunnel WebSocket URL
  WEBSOCKET_URL: "wss://iot-api.yourdomain.com/ws/alerts",

  ICE_SERVERS: [{ urls: "stun:stun.l.google.com:19302" }],
};
```

### 4.4 Build Development Client

```bash
# For Android
npx expo run:android

# For iOS
npx expo run:ios

# Or create development build
eas build --profile development --platform android
```

### 4.5 Add Screen to Navigation

Edit your navigation file (e.g., `screens/navigation/UserStack.js`):

```javascript
import RemoteIoTMonitorScreen from "../User/RemoteIoTMonitorScreen";

// Add to stack navigator
<Stack.Screen
  name="RemoteMonitor"
  component={RemoteIoTMonitorScreen}
  options={{ title: "Camera Monitor" }}
/>;
```

---

## Testing & Validation

### Test MediaMTX

```bash
# Local RTSP
ffplay rtsp://localhost:8554/cam

# Remote WebRTC (browser)
# Navigate to: http://YOUR_PI_IP:8889
```

### Test AI Backend

```bash
# Health check
curl http://localhost:8000/api/health

# IoT control
curl -X POST http://localhost:8000/api/heater/on \
  -H "Content-Type: application/json" \
  -d '{"device_id": "heater_01", "action": "on"}'

# WebSocket test
wscat -c ws://localhost:8000/ws/alerts
```

### Test React Native App

1. Ensure MediaMTX and AI Backend are running
2. Launch Expo app on mobile device
3. Navigate to Remote Monitor screen
4. Video should connect automatically
5. Trigger a detection (show predator object to camera)
6. Verify bounding box appears on screen

---

## Troubleshooting

### MediaMTX Issues

**Camera not detected:**

```bash
# Check camera
libcamera-hello --list-cameras

# Check permissions
groups $USER | grep video

# Check MediaMTX logs
journalctl -u mediamtx -n 100
```

**WebRTC not connecting:**

- Verify firewall ports are open
- Check STUN server accessibility
- Ensure ICE candidates are generated

### AI Backend Issues

**RTSP stream fails:**

```bash
# Verify MediaMTX is running
systemctl status mediamtx

# Test RTSP manually
ffplay rtsp://localhost:8554/cam
```

**NCNN inference errors:**

```bash
# Verify model files exist
ls -lh yolov8n_ncnn_model/

# Test model loading
python3 -c "import ncnn; print('NCNN OK')"
```

### React Native Issues

**WebRTC not connecting:**

- Verify MEDIAMTX_WHEP_URL is correct
- Check network connectivity
- Enable debug logs in RTCPeerConnection

**Bounding boxes misaligned:**

- Ensure `onLayout` handler is firing
- Check video dimensions match scaling calculations

---

## Performance Optimization

### Reduce Latency

**MediaMTX:**

- Lower GOP size: `rpiCameraIDRPeriod: 30`
- Reduce bitrate: `rpiCameraBitrate: 1500000`

**AI Backend:**

- Reduce inference FPS: `target_fps: 5`
- Lower confidence threshold: `conf_threshold: 0.6`

### Reduce Bandwidth

**MediaMTX:**

- Use lower resolution: `cam_low` path
- Reduce framerate: `rpiCameraFPS: 15`

---

## Production Checklist

- [ ] MediaMTX running on boot (systemd)
- [ ] AI Backend running on boot (systemd)
- [ ] Cloudflare Tunnel configured with SSL
- [ ] Firewall rules configured
- [ ] Authentication enabled (optional)
- [ ] Monitoring setup (logs, metrics)
- [ ] Mobile app built and signed
- [ ] Network stability tested
- [ ] Backup/restore procedures documented

---

## Required Package Versions

### Python (Raspberry Pi)

- Python 3.11+
- fastapi 0.109.0+
- uvicorn 0.27.0+
- opencv-python 4.9.0+
- ncnn 1.0.20231027+

### React Native (Mobile)

- react-native-webrtc 124.0.1
- @react-native-community/netinfo 11.2.1
- expo SDK 50+

### System (Raspberry Pi)

- Debian 13 (Bookworm) 64-bit
- MediaMTX v1.7.0+
- libcamera 0.2.0+

---

## Additional Resources

- MediaMTX Documentation: https://github.com/bluenviron/mediamtx
- NCNN Documentation: https://github.com/Tencent/ncnn
- react-native-webrtc: https://github.com/react-native-webrtc/react-native-webrtc
- Cloudflare Tunnel: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/

---

**End of Deployment Guide**
