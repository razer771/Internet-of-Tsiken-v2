# Scheduled Watering System - Setup Guide

## Overview
Your ESP32 water pump system now supports **automatic scheduled watering** based on schedules created in your React Native app. The ESP32 will automatically check Firebase for scheduled watering times and execute them without manual intervention.

## How It Works

### 1. **Mobile App (React Native)**
- Users create watering schedules in the ControlScreen
- Schedules are saved to Firebase Realtime Database in the `wateringSchedules` collection
- Each schedule includes:
  - `userId`: The user who created the schedule
  - `time`: Time in HH:MM format (e.g., "14:30")
  - `duration`: How long to run the pump (in milliseconds)
  - `liters`: Amount of water (for reference)
  - `label`: Optional label for the schedule

### 2. **ESP32 (Arduino)**
- Connects to WiFi and Firebase
- Receives the user ID from the mobile app on initialization
- Every 60 seconds, checks Firebase for schedules
- Compares current time with scheduled times
- Automatically activates the pump when a match is found
- Logs execution to prevent duplicate runs

### 3. **Firebase Structure**
```
wateringSchedules/
  ├── {userId}_1/
  │   ├── userId: "abc123"
  │   ├── time: "08:00"
  │   ├── duration: 10000
  │   ├── liters: 2
  │   └── label: "Morning watering"
  └── {userId}_2/
      ├── userId: "abc123"
      ├── time: "18:00"
      ├── duration: 15000
      ├── liters: 3
      └── label: "Evening watering"

devices/
  └── {deviceId}/
      ├── sensors/
      │   ├── waterLevel: 75
      │   ├── pumpActive: false
      │   └── timestamp: 1234567890
      ├── pumpLogs/
      │   └── {timestamp}/
      │       ├── action: "started"
      │       ├── duration: 10000
      │       └── waterLevel: 75
      └── scheduledExecutions/
          └── {timestamp}/
              ├── scheduleId: "abc123_1"
              ├── scheduleTime: "08:00"
              ├── duration: 10000
              └── executedAt: 1234567890
```

## Setup Instructions

### Step 1: Update Arduino Code

Your ESP32 code has already been updated with:
- Schedule checking every 60 seconds
- User ID configuration endpoint
- Automatic pump activation when schedules match
- Execution logging to prevent duplicates

**Upload the updated code** (`esp32/water_pump_system.ino`) to your ESP32 using Arduino IDE.

### Step 2: Configure Firebase

1. Make sure you have **Firebase Realtime Database** enabled (not just Firestore)
2. Go to Firebase Console → Realtime Database → Rules
3. Update rules to allow ESP32 to read schedules:

```json
{
  "rules": {
    "wateringSchedules": {
      ".read": "auth != null",
      ".write": "auth != null"
    },
    "devices": {
      "$deviceId": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

### Step 3: Configure ESP32 Connection

1. **Update WiFi credentials** in `water_pump_system.ino`:
   ```cpp
   const char* WIFI_SSID = "jeromeee";  // Your WiFi name
   const char* WIFI_PASSWORD = "Jac.(0911868)***";  // Your password
   ```

2. **Firebase is already configured** with your project:
   ```cpp
   const char* FIREBASE_API_KEY = "AIzaSyAOC8S6aOGvfnUzp0Twb-7O727Un9FoUGE";
   const char* FIREBASE_PROJECT_ID = "internet-of-tsiken-690dd";
   ```

3. **Upload code to ESP32** and get the IP address from Serial Monitor

4. **Update** `config/esp32config.js` with ESP32 IP:
   ```javascript
   waterSystem: {
     enabled: true,
     ipAddress: "192.168.x.x",  // Your ESP32 IP
     port: 80
   }
   ```

### Step 4: Test the System

1. **Start your mobile app** and navigate to Controls screen
2. The app will automatically send your user ID to the ESP32
3. **Create a watering schedule** in the app
4. Set the time to ~2 minutes from now for testing
5. **Monitor ESP32 Serial Monitor** to see:
   ```
   📅 Checking schedules at 14:30
   ✅ Executing scheduled watering!
      Time: 14:30
      Duration: 10s
   🚰 Starting pump for 10s
   ```

## API Endpoints

Your ESP32 now provides these endpoints:

### Get System Info
```http
GET http://{ESP32_IP}/
```

### Get Water Level
```http
GET http://{ESP32_IP}/api/water/level
```

### Manual Pump Control
```http
POST http://{ESP32_IP}/api/pump/start
Content-Type: application/json

{
  "duration": 5000
}
```

```http
POST http://{ESP32_IP}/api/pump/stop
```

### Get Pump Status
```http
GET http://{ESP32_IP}/api/pump/status
```

### Configure User ID (Called automatically by app)
```http
POST http://{ESP32_IP}/api/system/userid
Content-Type: application/json

{
  "userId": "abc123xyz"
}
```

## How Scheduling Works

1. **User creates schedule** in mobile app at 2:00 PM for 6:30 PM watering
2. **Schedule saved** to Firebase: `time: "18:30"`, `duration: 10000`
3. **Mobile app sends** user ID to ESP32 on connection
4. **ESP32 checks every minute**: 
   - 6:28 PM: No match
   - 6:29 PM: No match
   - 6:30 PM: ✅ Match found! → Start pump for 10 seconds
5. **ESP32 logs execution** to prevent running again
6. **Reset at midnight** - schedules can run again the next day

## Safety Features

The ESP32 has built-in safety features:

- ✅ **Minimum water level check** (20%) - Won't pump if tank is too low
- ✅ **Cooldown period** (10 seconds) - Prevents rapid cycling
- ✅ **Maximum duration** (60 seconds) - Prevents overwatering
- ✅ **Duplicate prevention** - Won't execute the same schedule twice in a row
- ✅ **Auto-stop** - Pump automatically stops after duration expires

## Troubleshooting

### ESP32 not checking schedules
- Check Serial Monitor for "📅 Checking schedules" messages
- Verify user ID was set: Look for "👤 User ID set: {userId}"
- Ensure WiFi is connected: "✓ WiFi Connected!"

### Schedules not executing
- Check time format in Firebase (must be "HH:MM")
- Verify ESP32 clock is synchronized (NTP)
- Check Serial Monitor for schedule matching logs
- Ensure `userId` in schedule matches configured user ID

### Firebase errors
- Error 401: Check FIREBASE_API_KEY is correct
- Error 404: Verify Realtime Database is enabled
- Connection timeout: Check WiFi and internet connection

### Water level issues
- Calibrate sensor: Update `WATER_SENSOR_MIN` and `WATER_SENSOR_MAX`
- Check wiring: Sensor → GPIO 34, VCC → 3.3V, GND → GND
- Monitor Serial Monitor for "💧 Water: X% (ADC: Y)" readings

## Next Steps

1. **Test manual pump control** from the app first
2. **Calibrate water sensor** with actual tank (empty vs full)
3. **Create test schedule** 2-3 minutes in the future
4. **Monitor execution** via Serial Monitor and app
5. **Check Firebase logs** in `devices/{deviceId}/scheduledExecutions`

## Files Modified

✅ **esp32/water_pump_system.ino** - Added schedule checking and execution
✅ **modules/ServoMotorService.js** - Added `configureWaterSystemUserId()` function
✅ **screens/User/controls/ControlScreen.js** - Calls configuration on startup

---

**Your IoT chicken farm now has automatic scheduled watering! 🐔💧**
