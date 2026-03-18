# 🚨 Predator Detection Valve System - Setup Guide

## Overview

This system automatically triggers a solenoid valve when predators (cat, dog, rat, snake) are detected continuously for 10 seconds.

### How It Works

```
┌─────────────────┐
│  Raspberry Pi 5 │  YOLO Detection
│  + Camera       │  Tracks predators
└────────┬────────┘
         │ USB Serial
         │ (sends OPEN_VALVE command)
         ▼
┌─────────────────┐
│  Arduino Uno    │  Controls MOSFET
│  Pin 4          │  Opens valve for 10s
└────────┬────────┘
         │ Gate Control
         ▼
┌─────────────────┐
│  MOSFET         │  Switches solenoid
│  (N-channel)    │  HIGH = Valve OPEN
└────────┬────────┘
         │ Power Control
         ▼
┌─────────────────┐
│ Solenoid Valve  │  Dispenses water
│ (12V)           │  for 10 seconds
└─────────────────┘
```

---

## Hardware Setup

### Required Components

1. **Raspberry Pi 5** with Camera Module 3 NoIR
2. **Arduino Uno** (for testing) or ESP32 (production)
3. **N-Channel MOSFET** (IRF520, IRF540, or IRLZ44N)
4. **Solenoid Valve** (12V DC)
5. **12V Power Supply** for solenoid
6. **USB A to B Cable** (Arduino Uno cable)
7. **Resistors**: 220Ω - 1kΩ (gate protection)

### Wiring Diagram (Arduino Uno)

```
Arduino Uno Pin 4 ──┬──[220Ω Resistor]──► MOSFET Gate
                    │
                    └──[10kΩ to GND]──► Pull-down resistor (optional)

MOSFET Drain ──────────────────────► Solenoid Valve (-)
MOSFET Source ─────────────────────► GND (Common Ground)

12V Power Supply (+) ──────────────► Solenoid Valve (+)
12V Power Supply (-) ──────────────► GND (Common Ground with Arduino)

⚠️ IMPORTANT: Share common ground between Arduino and 12V supply!
```

---

## Software Installation

### Step 1: Upload Arduino Code

1. Open Arduino IDE
2. Load `valve_controller.ino`
3. Select **Tools → Board → Arduino Uno**
4. Select **Tools → Port** (e.g., COM3 on Windows, /dev/ttyACM0 on Linux)
5. Click **Upload**
6. Open **Serial Monitor** (115200 baud) to verify it's working

**Expected Output:**
```
==============================================
  PREDATOR DETECTION VALVE CONTROLLER
  Pin 4 | 10s Duration | Serial Control
==============================================
System ready. Waiting for OPEN_VALVE command...
```

### Step 2: Install Python Dependencies on Raspberry Pi

```bash
cd "yolo object detection"
pip install pyserial
```

### Step 3: Connect Arduino to Raspberry Pi

1. Plug Arduino Uno into Raspberry Pi via USB
2. Check which port it's connected to:
   ```bash
   ls /dev/ttyUSB* /dev/ttyACM*
   ```
   You should see something like `/dev/ttyACM0`

---

## Testing the System

### Test 1: Manual Arduino Test

Send commands manually via Serial Monitor:

```
OPEN_VALVE    # Should open valve for 10 seconds
STATUS        # Check current valve state
```

**Expected Response:**
```
>>> VALVE OPENED <<<
Duration: 10 seconds
>>> VALVE CLOSED <<<
Ready for next command.
```

### Test 2: Python Serial Test

Run this on Raspberry Pi to test communication:

```bash
python3 << 'EOF'
import serial
import time

# Connect to Arduino
ser = serial.Serial('/dev/ttyACM0', 115200, timeout=2)
time.sleep(2)  # Wait for Arduino to reset

# Send test command
ser.write(b'OPEN_VALVE\n')
ser.flush()

# Read response
time.sleep(0.1)
if ser.in_waiting > 0:
    response = ser.readline().decode('utf-8')
    print(f"Arduino response: {response}")

ser.close()
EOF
```

### Test 3: Full YOLO + Valve Integration

1. Start the YOLO server:
   ```bash
   cd "yolo object detection"
   python stream_server_optimized.py
   ```

2. Check startup logs for valve detection:
   ```
   🔌 Detecting Arduino Uno valve controller...
   ✅ Arduino detected on /dev/ttyACM0
   ✅ Valve system ACTIVE on /dev/ttyACM0
   🎯 Predators: cat, dog, rat, snake
   ⏱️  Detection time: 10.0s
   ⏳ Cooldown: 120s
   ```

3. Test predator detection:
   - Point camera at a cat/dog/toy
   - Watch the logs for tracking messages:
     ```
     🔍 CAT detected - tracking started
     ⏱️ CAT tracking: 3.2s / 10.0s (6.8s remaining)
     ⏱️ CAT tracking: 7.5s / 10.0s (2.5s remaining)
     ⚠️ CAT present for 10.1s - ACTIVATING VALVE!
     🚨 VALVE TRIGGERED for CAT!
     ```

---

## Configuration Settings

Edit these values in `stream_server_optimized.py`:

```python
# Which predators trigger the valve
VALVE_PREDATORS = ["cat", "dog", "rat", "snake"]  # Not "mouse"

# Continuous detection time before activation
VALVE_DETECTION_DURATION = 10.0  # seconds

# Time between valve activations for same predator
VALVE_COOLDOWN_SECONDS = 120  # 2 minutes

# Serial port (auto-detected if None)
VALVE_SERIAL_PORT = None  # Or specify: "/dev/ttyACM0"
```

---

## Troubleshooting

### Valve doesn't open when predator detected

**Check 1: Arduino connection**
```bash
ls /dev/ttyACM* /dev/ttyUSB*
```
Should show `/dev/ttyACM0` or similar.

**Check 2: Server startup logs**
Look for:
```
✅ Valve system ACTIVE on /dev/ttyACM0
```

If you see:
```
⚠️ Valve system DISABLED (Arduino not found)
```
Check USB cable and Arduino power.

**Check 3: Python serial permissions**
```bash
sudo usermod -a -G dialout $USER
# Then logout and login again
```

**Check 4: Detection tracking**
Make sure predator is visible for full 10 seconds continuously. If it disappears, tracking resets.

### Valve stays open / won't close

**Cause:** Arduino sketch handles auto-close after 10 seconds.

**Fix:** Reset Arduino (press reset button) or re-upload sketch.

### No predator detection

**Check model:** Make sure you're using the custom trained model:
```python
MODEL_PATH_PT = "models/yolov8s-custom.pt"
```

**Test with known object:** Try detecting a cat, dog, or printed picture of a snake/rat.

---

## Safety Features

✅ **Hardware failsafe:** Arduino auto-closes valve after 10 seconds
✅ **Cooldown timer:** Prevents spam (2 minutes between activations per predator)
✅ **Continuous detection:** Must see predator for 10 seconds (prevents false triggers)
✅ **Graceful shutdown:** Closes serial connection properly on exit

---

## Production Deployment (ESP32)

When ready to move from Arduino Uno to ESP32:

1. **Wiring changes:**
   - Use GPIO pin 4 on ESP32 (same as Arduino)
   - Add level shifter if using 5V solenoid

2. **Code migration:**
   - Add serial command handler to your existing `sketch_dec9a_fixed.ino`
   - Reuse the same `OPEN_VALVE` command protocol

3. **Communication method:**
   - **Option A:** Keep USB serial (same as Arduino)
   - **Option B:** Switch to HTTP API (wireless)

4. **HTTP API Integration (Recommended for ESP32):**
   ```cpp
   // Add to your ESP32 sketch
   server.on("/api/valve/trigger", HTTP_POST, []() {
       digitalWrite(PIN_VALVE, HIGH);
       delay(10000);
       digitalWrite(PIN_VALVE, LOW);
       server.send(200, "application/json", "{\"status\":\"ok\"}");
   });
   ```

   Then modify Python code to use HTTP instead of serial:
   ```python
   def trigger_valve(predator_type: str):
       response = requests.post("http://192.168.x.x/api/valve/trigger")
       logger.info(f"Valve triggered: {response.json()}")
   ```

---

## Status & Monitoring

### Check valve system status

While server is running, check logs:
```bash
tail -f /path/to/server/logs.txt | grep VALVE
```

### Monitor via HTTP API

```bash
curl http://192.168.x.x:5000/status
```

Response includes valve system info.

---

## Questions?

- Arduino not detecting? → Check baud rate (115200)
- MOSFET not switching? → Verify gate resistor and wiring
- Valve constantly triggering? → Increase `VALVE_DETECTION_DURATION` or check for false detections
- Need help? → Share server logs from startup
