# 🤖 Autonomous Predator Detection System

## Overview

This system provides **24/7 autonomous predator detection** that operates completely independently of the React Native mobile app. The system continuously monitors for predators and triggers valve deterrents automatically, ensuring your property is protected around the clock.

## 🔄 How Autonomous Operation Works

### Thread Architecture
```
Camera Thread (Producer) → Frame Buffer → AI Thread (Consumer) → Detection Buffer
                                            ↓
                                    Valve Control System
                                            ↓
                                    Flask Web Server (Optional Monitoring)
```

**Key Independence Features:**
- **🎥 Camera Thread**: Captures frames at 30 FPS continuously
- **🤖 AI Thread**: Processes YOLO detection at ~3 FPS in separate daemon thread
- **⚡ Valve Thread**: Monitors detections and triggers Arduino valve automatically
- **📡 Web Server**: Only provides optional monitoring - NOT required for operation

### True Autonomy Guarantees

✅ **System works when:**
- React Native app is closed
- Phone is turned off
- Network is disconnected (local operation continues)
- No one is monitoring the system
- After system reboots (auto-starts on boot)

❌ **System only stops when:**
- Hardware failure (camera, Raspberry Pi)
- Power loss
- Manual service shutdown

## 🧪 Validation Procedures

### Quick Validation Test
```bash
cd "/home/charles/Internet-of-Tsiken-v2/yolo object detection"
./validate_autonomous_operation.sh
```

**What this test does:**
1. Records initial AI status
2. Waits 60 seconds without any HTTP requests
3. Verifies AI continued processing independently
4. Confirms detection buffer updated autonomously

**Expected results:**
- ✅ Timestamps should change (AI is running)
- ✅ FPS > 0 (inference engine active)
- ✅ Autonomous logs appear in system journal

### Continuous Monitoring
```bash
cd "/home/charles/Internet-of-Tsiken-v2/yolo object detection"
./monitor_24_7_operation.sh
```

**What this shows:**
- Real-time autonomous status
- Live predator detection events
- Valve trigger confirmations
- System performance metrics

## 🔍 Testing Scenarios

### Test 1: App Independence
**Objective**: Verify system works without mobile app

**Procedure**:
1. Open React Native app and confirm camera works
2. Close app completely (force quit)
3. Point camera at cat/dog for 15+ seconds
4. Listen for valve activation (should trigger after 10 seconds)
5. Check logs: `sudo journalctl -u camera-stream -f`

**Expected behavior**:
- Valve triggers even with app closed
- Logs show predator tracking and valve activation
- System continues autonomous operation

### Test 2: Reboot Resilience
**Objective**: Confirm automatic startup after reboot

**Procedure**:
1. `sudo reboot` (restart Raspberry Pi)
2. Wait for system to boot up
3. Check service status: `sudo systemctl status camera-stream`
4. Test predator detection immediately after boot

**Expected behavior**:
- Service starts automatically (no manual intervention)
- Arduino valve controller detected and connected
- AI detection active within 30 seconds of boot

### Test 3: Network Independence
**Objective**: Verify local operation during network issues

**Procedure**:
1. Disconnect Ethernet/WiFi from Raspberry Pi
2. Test predator detection and valve operation
3. Reconnect network after 10 minutes
4. Verify system resumes Firebase notifications

**Expected behavior**:
- Local detection continues without network
- Valve triggering works offline
- Firebase updates resume when network returns

### Test 4: Long-term Operation
**Objective**: Validate 24+ hour continuous operation

**Procedure**:
1. Start monitoring: `./monitor_24_7_operation.sh`
2. Let system run for 24 hours minimum
3. Check autonomous status logs (should appear every ~90 seconds)
4. Verify memory usage remains stable
5. Test predator detection at different times

**Expected behavior**:
- Regular autonomous status logs
- Stable memory/CPU usage
- Consistent detection and valve performance

## 📋 System Status Indicators

### Healthy Autonomous Operation
```
🤖 [AUTONOMOUS] 24/7 Security Active | AI: 3.2 FPS | Frames: 300 | Objects: 0 | Valve: ⚡ Ready
   🔄 Independent Operation: Detecting predators without app connection
   ⚡ Valve Status: Armed | Active Tracking: 0 predators
```

### Predator Detection Sequence
```
🔍 CAT detected - tracking started
⏱️ CAT tracking: 5.1s / 10.0s (4.9s remaining)
⚠️ CAT present for 10.1s - INITIAL VALVE ACTIVATION!
🚨 VALVE TRIGGERED for CAT!
   Arduino: >>> VALVE OPENED <<<
⏳ CAT repeat trigger in 3.0s
🔄 CAT still present after 3.2s - REPEAT VALVE ACTIVATION!
✅ CAT no longer detected - reset tracking
```

### Service Health Check
```bash
# Check service status
sudo systemctl status camera-stream

# View recent logs
sudo journalctl -u camera-stream -n 50

# Test HTTP endpoints
curl -s "http://100.101.108.37:5000/status"
curl -s "http://100.101.108.37:5000/detections"
```

## 🛠️ Troubleshooting Guide

### Problem: No autonomous status logs appearing

**Possible causes:**
- Service not running: `sudo systemctl start camera-stream`
- AI thread crashed: Check logs for errors
- Model loading failed: Verify YOLO model file exists

**Solutions:**
```bash
# Restart service
sudo systemctl restart camera-stream

# Check for errors
sudo journalctl -u camera-stream -n 100 | grep -i error

# Verify model files
ls -la "/home/charles/Internet-of-Tsiken-v2/yolo object detection/models/"
```

### Problem: Valve not triggering during autonomous operation

**Possible causes:**
- Arduino not detected: Check `/dev/ttyUSB*` devices
- Insufficient detection duration: Need 10+ seconds continuous
- Cooldown period active: Wait 2+ minutes between triggers

**Solutions:**
```bash
# Check Arduino connection
ls -la /dev/ttyUSB* /dev/ttyACM*

# Test Arduino manually
python3 -c "
import serial, time
ser = serial.Serial('/dev/ttyUSB0', 115200, timeout=2)
time.sleep(2)
ser.write(b'OPEN_VALVE\\n')
time.sleep(0.1)
print(ser.readline().decode())
ser.close()
"

# Check valve logs
sudo journalctl -u camera-stream | grep -i valve
```

### Problem: System not starting autonomously after reboot

**Possible causes:**
- Service not enabled: `sudo systemctl enable camera-stream`
- Network dependency not met: Service waits for Tailscale
- Permission issues: Check user permissions

**Solutions:**
```bash
# Enable auto-start
sudo systemctl enable camera-stream

# Check dependency status
systemctl status network-online.target
systemctl status tailscaled.service

# Manual start if needed
sudo systemctl start camera-stream
```

## ⚙️ Configuration Details

### Autonomous Operation Settings
```python
# Detection requirements
VALVE_DETECTION_DURATION = 10.0    # Initial detection time (seconds)
VALVE_REPEAT_DELAY = 3.0           # Repeat trigger delay (seconds)
VALVE_COOLDOWN_SECONDS = 120       # Cooldown when predator leaves (seconds)

# Predator classes that trigger valve
VALVE_PREDATORS = ["Cat", "Dog", "Rat", "Snake"]

# AI processing settings
CONFIDENCE_THRESHOLD = 0.5         # 50% confidence required
TARGET_FPS = 30                    # Camera capture rate
```

### Service Configuration
```ini
# /etc/systemd/system/camera-stream.service
[Unit]
After=network-online.target tailscaled.service
Wants=network-online.target tailscaled.service

[Service]
Environment=PYTHONUNBUFFERED=1
Restart=always
RestartSec=30
StartLimitInterval=300
StartLimitBurst=5
```

## 📊 Performance Monitoring

### Normal Performance Metrics
- **Camera FPS**: 29-30 FPS (hardware ISP)
- **AI FPS**: 2-4 FPS (YOLO processing)
- **Inference Time**: 250-400ms per frame
- **Memory Usage**: ~200-300MB steady state
- **CPU Usage**: 30-50% on Raspberry Pi 5

### Alert Conditions
- **AI FPS < 1**: Possible performance issues
- **Inference Time > 1000ms**: Model loading problems
- **Memory > 500MB**: Potential memory leak
- **No autonomous logs for 10+ minutes**: Thread may have stopped

## 🔐 Security Features

### Aggressive Deterrent Behavior
1. **Initial Detection**: 10 seconds continuous → First valve trigger
2. **Persistent Deterrent**: Every 3 seconds while predator present
3. **Smart Cooldown**: 120 seconds only when predator leaves
4. **Multi-predator Tracking**: Handles multiple simultaneous threats

### 24/7 Protection Capabilities
- **Continuous Monitoring**: Never sleeps, always watching
- **Immediate Response**: Sub-second detection to valve trigger
- **Network Independent**: Protects even during internet outages
- **App Independent**: Works without any user interaction
- **Boot Resilient**: Starts automatically after power loss

## 📞 Support Information

### Log Analysis Commands
```bash
# View autonomous activity (no HTTP noise)
sudo journalctl -u camera-stream -f | grep -E "(AUTONOMOUS|tracking|VALVE)"

# Check system performance
curl -s "http://100.101.108.37:5000/status" | python3 -m json.tool

# Monitor real-time detections
curl -s "http://100.101.108.37:5000/detections" | python3 -m json.tool
```

### Emergency Recovery
```bash
# Complete system restart
sudo systemctl restart camera-stream

# Factory reset (reinstall service)
cd "/home/charles/Internet-of-Tsiken-v2/yolo object detection"
sudo ./install_camera_service.sh

# Check hardware connections
sudo dmesg | grep -i camera
sudo dmesg | grep -i usb
```

---

**🛡️ Your property is now protected by a fully autonomous predator detection system that works 24/7, even when you're not monitoring it!**