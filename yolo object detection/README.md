# YOLO Camera Stream Integration

## Setup Instructions for Raspberry Pi

### 1. Install Dependencies

```bash
cd "yolo object detection"
pip install -r requirements.txt
```

### 2. Start the Stream Server

```bash
python stream_server.py
```

The server will start on `http://0.0.0.0:5000`

### 3. Find Your Raspberry Pi's IP Address

```bash
hostname -I
```

Example output: `192.168.1.100`

### 4. Configure React Native App

1. Open the app on your phone
2. Tap on "Live Camera Surveillance"
3. Tap "Server Settings"
4. Enter: `http://YOUR_PI_IP:5000` (e.g., `http://192.168.1.100:5000`)

### API Endpoints

- **`/video_feed`** - Live MJPEG video stream with YOLO annotations
- **`/detections`** - JSON data of detected objects
- **`/status`** - Server health check
- **`/snapshot`** - Single frame capture

### Features

✅ Real-time YOLO object detection (80 classes)
✅ Live video streaming to React Native
✅ FPS counter overlay
✅ Detection confidence scores
✅ Bounding boxes on detected objects
✅ Object counting and classification

### Troubleshooting

**Camera not found:**
```bash
libcamera-hello  # Test camera
```

**Port already in use:**
```bash
sudo lsof -i :5000  # Check what's using port 5000
sudo kill -9 <PID>  # Kill the process
```

**Cannot connect from app:**
- Ensure Raspberry Pi and phone are on same WiFi network
- Check firewall settings: `sudo ufw allow 5000`
- Verify IP address is correct

### Running on Boot (Optional)

Create systemd service:

```bash
sudo nano /etc/systemd/system/yolo-stream.service
```

Add:
```ini
[Unit]
Description=YOLO Camera Stream Server
After=network.target

[Service]
ExecStart=/usr/bin/python3 /path/to/stream_server.py
WorkingDirectory=/path/to/yolo object detection
StandardOutput=inherit
StandardError=inherit
Restart=always
User=pi

[Install]
WantedBy=multi-user.target
```

Enable:
```bash
sudo systemctl enable yolo-stream
sudo systemctl start yolo-stream
```

### Performance Tips

- Lower resolution = faster FPS (edit camera config in `stream_server.py`)
- Use `yolov8n` (nano) for best speed on Raspberry Pi
- NCNN format provides better performance than PyTorch
- Keep JPEG quality at 85 for balance between quality and bandwidth
