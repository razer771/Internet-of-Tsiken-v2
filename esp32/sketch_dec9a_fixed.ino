#include <WiFi.h>
#include <WebServer.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <ESP32Servo.h>
#include <DHT.h>
#include "HX711.h"


// =================================================================
// ============== PIN DEFINITIONS (FIXED FOR ALL SENSORS) ==========
// =================================================================

// --- Sensors ---
#define PIN_MQ135 34       // Air Quality (Analog - ADC1 only)
#define PIN_WATER_LEVEL 35 // Water Level (Analog - ADC1 only)
#define PIN_DHT 4          // Temp & Humidity (Changed from 4 - avoid servo conflict)
#define PIN_HX711_DT 32    // Load Cell Data
#define PIN_HX711_SCK 33   // Load Cell Clock

// --- Ultrasonic (Source Tanks) ---
// NOTE: Pin 5 can conflict with SPI - if sensor fails, try pin 25 or 26
#define PIN_TRIG_WATER 19 // Water tank ultrasonic trigger
#define PIN_ECHO_WATER 21 // Water tank ultrasonic echo
#define PIN_TRIG_FEED 5   // Feed tank ultrasonic trigger (WARNING: May conflict with SPI)
#define PIN_ECHO_FEED 18  // Feed tank ultrasonic echo

// --- Actuators ---
#define PIN_SERVO 13        // Servo motor for feeding
#define PIN_RELAY_PUMP 26   // Water pump relay
#define PIN_RELAY_FAN 27    // Exhaust fan relay
#define PIN_LIGHT_MOSFET 16  // Incandescent light (PWM capable)
#define PIN_RELAY_VITAMIN 14 // Peristaltic pump relay for vitamins
// ⚠️  GPIO16 NOTE: Can conflict with PSRAM on some ESP32 boards
// If MOSFET doesn't respond, try: GPIO 25, 32, or 33 instead

// --- Configuration ---
#define DHTTYPE DHT22
const char *WIFI_SSID = "mzkmbp";
const char *WIFI_PASSWORD = "ncmaganda";

// Firebase Configuration (Using API Key and Project ID for REST calls)
const char *FIREBASE_API_KEY = "AIzaSyBa6PE0nqkrFAqDm6AT2nIrZmv6qIfgiFM";
const char *FIREBASE_PROJECT_ID = "internet-of-tsiken-f0ad4";

// Safety Thresholds
const int MAX_BOWL_WEIGHT = 500; // Grams (Stop feeding if > 500g)
const int MAX_WATER_LEVEL = 80;  // Percent (Stop pumping if > 80%)
const int MIN_WATER_LEVEL = 10;  // Minimum water level to activate pump

// Timing
const unsigned long SENSOR_READ_INTERVAL = 2000;     // Read sensors every 2 seconds
const unsigned long MQ135_WARMUP_TIME = 60000;       // MQ135 needs 1 minute warmup minimum
const unsigned long SCHEDULE_CHECK_INTERVAL = 10000; // Check schedules every 10 seconds

// Objects
WebServer server(80);
HTTPClient http;
Servo feedServo;
DHT dht(PIN_DHT, DHTTYPE);
HX711 loadCell;

// State Variables
float temperature = 0;
float humidity = 0;
int airQuality = 0;
long currentWeight = 0;
int currentWaterLevel = 0;
int feederTankLevel = 0; // Ultrasonic 1 - Feeder storage
int waterTankLevel = 0;  // Ultrasonic 2 - Water storage
bool fanActive = false;
bool lightActive = false;
bool pumpActive = false;
bool vitaminPumpActive = false;
bool vitaminSystemEnabled = false; // If true, peristaltic pump dispenses at watering schedule; otherwise water pump does
unsigned long pumpStartTime = 0;
unsigned long pumpDuration = 0;
unsigned long vitaminPumpStartTime = 0;
unsigned long vitaminPumpDuration = 0;
unsigned long lastScheduleCheck = 0;
unsigned long lastSensorRead = 0;
unsigned long bootTime = 0;

// Firebase & Scheduling
String userId = "";
String lastExecutedWaterSchedule = "";
String lastExecutedFeedSchedule = "";
String deviceId = "";

// Sensor Status Flags
bool dhtReady = false;
bool loadCellReady = false;
bool mq135Ready = false;
bool wifiConnected = false;

// Calibration Factor for Load Cell (Adjust this value based on your setup)
float LOADCELL_CALIBRATION = 420.0;
const int TARE_WEIGHT = 250; // Bowl weight in grams to subtract from readings

// Water Level Sensor Calibration (Raw ADC values)
const int FULL_LEVEL = 2160;  // ADC value when water level is full
const int EMPTY_LEVEL = 1200; // ADC value when water level is empty

// =================================================================
// ====================== SETUP ====================================
// =================================================================

void setup()
{
    Serial.begin(115200);
    delay(500);

    Serial.println("\n\n╔════════════════════════════════════════════╗");
    Serial.println("║   ESP32 Smart Chicken Coop Controller     ║");
    Serial.println("║   Multi-Sensor + Actuator System          ║");
    Serial.println("╚════════════════════════════════════════════╝\n");

    bootTime = millis();

    // ========== Initialize Sensors ==========
    Serial.println("🔧 Initializing Sensors...");

    // DHT22 Temperature & Humidity
    Serial.print("  • DHT22 (Pin ");
    Serial.print(PIN_DHT);
    Serial.print(")... ");
    dht.begin();
    delay(2000); // DHT needs time to stabilize

    // Try reading multiple times
    float testTemp = -999;
    for (int i = 0; i < 3; i++)
    {
        testTemp = dht.readTemperature();
        if (!isnan(testTemp))
            break;
        delay(500);
    }

    if (!isnan(testTemp) && testTemp > -40 && testTemp < 80)
    {
        dhtReady = true;
        Serial.print("✓ Ready (Test read: ");
        Serial.print(testTemp);
        Serial.println("°C)");
    }
    else
    {
        Serial.println("✗ Failed");
        Serial.println("     Troubleshooting:");
        Serial.println("     1. Check wiring: VCC(3.3V), GND, DATA(Pin 4)");
        Serial.println("     2. Add 4.7K-10K pull-up resistor between DATA and VCC");
        Serial.println("     3. Verify DHT22 (not DHT11) - white sensor");
        Serial.println("     4. Try a different DHT sensor");
    }

    // HX711 Load Cell
    Serial.print("  • HX711 Load Cell (DT:");
    Serial.print(PIN_HX711_DT);
    Serial.print(", SCK:");
    Serial.print(PIN_HX711_SCK);
    Serial.print(")... ");
    loadCell.begin(PIN_HX711_DT, PIN_HX711_SCK);

    if (loadCell.wait_ready_timeout(1000))
    {
        loadCell.set_scale(LOADCELL_CALIBRATION);
        loadCell.tare(); // Reset scale to 0
        loadCellReady = true;
        Serial.println("✓ Ready & Tared");
    }
    else
    {
        Serial.println("✗ Not detected (Check wiring)");
    }

    // MQ135 Air Quality
    Serial.print("  • MQ135 Air Quality (Pin ");
    Serial.print(PIN_MQ135);
    Serial.println(")... ⏳ Warming up (needs 60s)");
    pinMode(PIN_MQ135, INPUT);

    // Water Level Sensor
    Serial.print("  • Water Level Sensor (Pin ");
    Serial.print(PIN_WATER_LEVEL);
    Serial.println(")... ✓ Ready");
    pinMode(PIN_WATER_LEVEL, INPUT);

    // Ultrasonic Sensors
    Serial.println("  • Ultrasonic Sensors:");
    pinMode(PIN_TRIG_WATER, OUTPUT);
    pinMode(PIN_ECHO_WATER, INPUT);
    pinMode(PIN_TRIG_FEED, OUTPUT);
    pinMode(PIN_ECHO_FEED, INPUT);
    Serial.print("    - Water Storage: Trig=");
    Serial.print(PIN_TRIG_WATER);
    Serial.print(", Echo=");
    Serial.println(PIN_ECHO_WATER);
    Serial.print("    - Feed Storage: Trig=");
    Serial.print(PIN_TRIG_FEED);
    Serial.print(", Echo=");
    Serial.print(PIN_ECHO_FEED);
    Serial.println(" ⚠️  (Pin 5 may conflict!)");
    Serial.println("    If feed sensor fails, consider using Pin 25 or 26 for trigger");

    // ========== Initialize Actuators ==========
    Serial.println("\n🔧 Initializing Actuators...");

    // Relays (Active LOW - OFF = HIGH)
    pinMode(PIN_RELAY_PUMP, OUTPUT);
    pinMode(PIN_RELAY_FAN, OUTPUT);
    pinMode(PIN_LIGHT_MOSFET, OUTPUT);

    digitalWrite(PIN_RELAY_PUMP, HIGH);  // OFF
    digitalWrite(PIN_RELAY_FAN, HIGH);   // OFF
    digitalWrite(PIN_LIGHT_MOSFET, LOW); // OFF
    pinMode(PIN_RELAY_VITAMIN, OUTPUT);
    digitalWrite(PIN_RELAY_VITAMIN, HIGH); // Vitamin pump OFF
    Serial.println("  • Pump Relay... ✓ OFF");
    Serial.println("  • Fan Relay... ✓ OFF");
    Serial.println("  • Vitamin Pump Relay (GPIO14)... ✓ OFF");

    // Test MOSFET with quick pulse
    Serial.print("  • Light MOSFET (GPIO");
    Serial.print(PIN_LIGHT_MOSFET);
    Serial.print(")... ");
    digitalWrite(PIN_LIGHT_MOSFET, HIGH);
    delay(100);
    digitalWrite(PIN_LIGHT_MOSFET, LOW);
    Serial.println("✓ OFF");
    Serial.println("    Troubleshooting if light doesn't work:");
    Serial.println("    1. Check MOSFET gate → GPIO16");
    Serial.println("    2. Use N-channel MOSFET (IRF520/IRF540/IRLZ44N)");
    Serial.println("    3. Add 220Ω-1KΩ resistor between GPIO and gate");
    Serial.println("    4. Try GPIO25, 32, or 33 if GPIO16 fails");
    Serial.println("    5. Verify power supply handles bulb load");

    // Servo
    feedServo.attach(PIN_SERVO);
    feedServo.write(0); // Closed position for 180° servo
    Serial.println("  • Feed Servo... ✓ Initialized at 0° (closed)");

    // ========== Generate Device ID ==========
    uint8_t mac[6];
    WiFi.macAddress(mac);
    char macStr[18];
    sprintf(macStr, "%02X%02X%02X%02X%02X%02X", mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
    deviceId = String(macStr);
    Serial.print("\n🆔 Device ID: ");
    Serial.println(deviceId);

    // ========== Connect to WiFi ==========
    Serial.println("\n📡 Connecting to WiFi...");
    Serial.print("  SSID: ");
    Serial.println(WIFI_SSID);

    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20)
    {
        delay(500);
        Serial.print(".");
        attempts++;
    }

    if (WiFi.status() == WL_CONNECTED)
    {
        wifiConnected = true;
        Serial.println("\n  ✓ WiFi Connected!");
        Serial.print("  IP Address: ");
        Serial.println(WiFi.localIP());
        Serial.print("  Signal: ");
        Serial.print(WiFi.RSSI());
        Serial.println(" dBm");

        // Sync time with NTP (GMT+8 Philippines)
        Serial.println("\n🕐 Syncing time with NTP server...");
        configTime(8 * 3600, 0, "pool.ntp.org", "time.nist.gov");
        int retries = 0;
        struct tm timeinfo;
        while (!getLocalTime(&timeinfo) && retries < 20)
        {
            Serial.print(".");
            delay(500);
            retries++;
        }
        if (retries < 20)
        {
            Serial.println("\n  ✓ Time synced successfully!");
            char timeStr[64];
            strftime(timeStr, sizeof(timeStr), "%Y-%m-%d %H:%M:%S", &timeinfo);
            Serial.print("  Current time: ");
            Serial.println(timeStr);
        }
        else
        {
            Serial.println("\n  ⚠️  Time sync timeout - schedules may not work");
        }
    }
    else
    {
        wifiConnected = false;
        Serial.println("\n  ✗ WiFi Connection Failed!");
        Serial.println("  System will work offline (no API access)");
    }

    // ========== Setup Web Server ==========
    if (wifiConnected)
    {
        setupWebServer();
        server.begin();
        Serial.println("\n✓ HTTP Server started on port 80");
        Serial.println("  Endpoints:");
        Serial.println("    GET  /api/sensors");
        Serial.println("    POST /api/pump/start");
        Serial.println("    POST /api/pump/stop");
        Serial.println("    POST /api/servo/start");
        Serial.println("    POST /api/fan/start");
        Serial.println("    POST /api/fan/stop");
        Serial.println("    POST /api/light/on");
        Serial.println("    POST /api/light/off");
    }

    Serial.println("\n╔════════════════════════════════════════════╗");
    Serial.println("║          System Ready!                     ║");
    Serial.println("╚════════════════════════════════════════════╝\n");
}

// =================================================================
// ====================== MAIN LOOP ================================
// =================================================================

void loop()
{
    if (wifiConnected)
    {
        server.handleClient();
    }

    // Read sensors periodically
    if (millis() - lastSensorRead >= SENSOR_READ_INTERVAL)
    {
        lastSensorRead = millis();
        readSensors();
    }

    // Check if MQ135 has warmed up
    if (!mq135Ready && (millis() - bootTime) > MQ135_WARMUP_TIME)
    {
        mq135Ready = true;
        Serial.println("✓ MQ135 warmed up - now providing reliable readings");
    }

    // Check schedules (every 10 seconds)
    if (wifiConnected && !userId.isEmpty() && (millis() - lastScheduleCheck >= SCHEDULE_CHECK_INTERVAL))
    {
        lastScheduleCheck = millis();
        checkSchedules();
    }

    // Auto-stop pump
    if (pumpActive && (millis() - pumpStartTime >= pumpDuration))
    {
        stopPump();
    }

    // Auto-stop vitamin pump
    if (vitaminPumpActive && (millis() - vitaminPumpStartTime >= vitaminPumpDuration))
    {
        stopVitaminPump();
    }
}

// =================================================================
// ====================== SENSOR READING ===========================
// =================================================================

void readSensors()
{
    Serial.println("\n📊 Reading Sensors:");

    // Temperature & Humidity (DHT22)
    if (dhtReady)
    {
        temperature = dht.readTemperature();
        humidity = dht.readHumidity();

        if (!isnan(temperature) && !isnan(humidity))
        {
            Serial.print("  🌡️  Temperature: ");
            Serial.print(temperature);
            Serial.println(" °C");
            Serial.print("  💧 Humidity: ");
            Serial.print(humidity);
            Serial.println(" %");
        }
        else
        {
            Serial.println("  ⚠️  DHT22 read failed");
            temperature = 0;
            humidity = 0;
        }
    }
    else
    {
        Serial.println("  ⚠️  DHT22 not ready");
    }

    // Air Quality (MQ135)
    int rawAirQuality = analogRead(PIN_MQ135);
    airQuality = map(rawAirQuality, 0, 4095, 0, 1000); // Convert to 0-1000 PPM range
    Serial.print("  🌫️  Air Quality: ");
    Serial.print(airQuality);
    Serial.print(" PPM (Raw: ");
    Serial.print(rawAirQuality);
    Serial.println(")");
    if (!mq135Ready)
    {
        Serial.println("     ⏳ Still warming up - readings may be inaccurate");
    }

    // Water Level (Analog)
    int rawWaterLevel = analogRead(PIN_WATER_LEVEL);
    currentWaterLevel = map(rawWaterLevel, EMPTY_LEVEL, FULL_LEVEL, 0, 100);
    currentWaterLevel = constrain(currentWaterLevel, 0, 100);
    Serial.print("  💦 Water Level: ");
    Serial.print(currentWaterLevel);
    Serial.print("% (Raw: ");
    Serial.print(rawWaterLevel);
    Serial.print(", Calibrated range: ");
    Serial.print(EMPTY_LEVEL);
    Serial.print("-");
    Serial.print(FULL_LEVEL);
    Serial.println(")");

    // Bowl Weight (HX711)
    if (loadCellReady && loadCell.wait_ready_timeout(200))
    {
        long rawWeight = loadCell.get_units(3);  // Average of 3 readings
        currentWeight = rawWeight - TARE_WEIGHT; // Subtract bowl weight
        currentWeight = max(0L, currentWeight);  // No negative weights
        Serial.print("  ⚖️  Bowl Weight: ");
        Serial.print(currentWeight);
        Serial.print(" g (Raw: ");
        Serial.print(rawWeight);
        Serial.println("g)");
    }
    else
    {
        Serial.println("  ⚠️  Load cell not ready");
        currentWeight = 0;
    }

    // Ultrasonic 1: Feeder Storage Tank Level
    feederTankLevel = readUltrasonic(PIN_TRIG_FEED, PIN_ECHO_FEED, 18.0, 5.0);
    Serial.print("  📦 Feeder Tank: ");
    Serial.print(feederTankLevel);
    Serial.println("%");

    // Ultrasonic 2: Water Storage Tank Level
    waterTankLevel = readUltrasonic(PIN_TRIG_WATER, PIN_ECHO_WATER, 17.0, 5.0);
    Serial.print("  🚰 Water Tank: ");
    Serial.print(waterTankLevel);
    Serial.println("%");

    Serial.println();
}

// Helper function to read ultrasonic sensor and convert to percentage
int readUltrasonic(int trigPin, int echoPin, float emptyDistance, float fullDistance)
{
    float total = 0;
    int validReadings = 0;

    Serial.print("    [Ultrasonic] Reading sensor (Trig:");
    Serial.print(trigPin);
    Serial.print(", Echo:");
    Serial.print(echoPin);
    Serial.print(")... ");

    for (int i = 0; i < 3; i++)
    {
        digitalWrite(trigPin, LOW);
        delayMicroseconds(2);
        digitalWrite(trigPin, HIGH);
        delayMicroseconds(10);
        digitalWrite(trigPin, LOW);

        long duration = pulseIn(echoPin, HIGH, 30000);

        if (duration > 0)
        {
            float dist = duration * 0.034 / 2;
            if (dist > 0 && dist < 400)
            {
                total += dist;
                validReadings++;
            }
        }
        delay(30);
    }

    if (validReadings > 0)
    {
        float distance = total / validReadings;

        Serial.print("Avg Distance: ");
        Serial.print(distance);
        Serial.print("cm, ");

        // Convert distance to percentage (inverted - closer = fuller)
        int result;
        if (distance <= fullDistance)
        {
            result = 100;
        }
        else if (distance >= emptyDistance)
        {
            result = 0;
        }
        else
        {
            float level = ((emptyDistance - distance) / (emptyDistance - fullDistance)) * 100.0;
            result = constrain((int)level, 0, 100);
        }

        Serial.print("Level: ");
        Serial.print(result);
        Serial.println("%");
        return result;
    }

    Serial.println("FAILED - No valid readings");
    return 0; // Return 0 if reading failed
}

// =================================================================
// ====================== WEB SERVER SETUP =========================
// =================================================================

void setupWebServer()
{
    // Root endpoint
    server.on("/", HTTP_GET, []()
              {
    String html = "<html><body>";
    html += "<h1>ESP32 Smart Coop Controller</h1>";
    html += "<p>Status: Online</p>";
    html += "<p>IP: " + WiFi.localIP().toString() + "</p>";
    html += "<h2>API Endpoints:</h2>";
    html += "<ul>";
    html += "<li>GET /api/sensors - Get all sensor data</li>";
    html += "<li>POST /api/pump/start - Start water pump</li>";
    html += "<li>POST /api/pump/stop - Stop water pump</li>";
    html += "<li>POST /api/servo/start - Dispense feed</li>";
    html += "<li>POST /api/fan/start - Turn on fan</li>";
    html += "<li>POST /api/fan/stop - Turn off fan</li>";
    html += "</ul>";
    html += "</body></html>";
    server.send(200, "text/html", html); });

    // Get all sensors
    server.on("/api/sensors", HTTP_GET, handleGetSensors);

    // Pump control
    server.on("/api/pump/start", HTTP_POST, handleStartPump);
    server.on("/api/pump/stop", HTTP_POST, handleStopPump);

    // Feed servo
    server.on("/api/servo/start", HTTP_POST, handleStartServo);

    // Fan control
    server.on("/api/fan/start", HTTP_POST, []()
              {
    digitalWrite(PIN_RELAY_FAN, LOW); // Active LOW relay
    fanActive = true;
    Serial.println("🌀 Fan turned ON");
    server.send(200, "application/json", "{\"fan_status\":\"on\",\"message\":\"Fan started\"}"); });

    server.on("/api/fan/stop", HTTP_POST, []()
              {
    digitalWrite(PIN_RELAY_FAN, HIGH); // Active LOW relay
    fanActive = false;
    Serial.println("🌀 Fan turned OFF");
    server.send(200, "application/json", "{\"fan_status\":\"off\",\"message\":\"Fan stopped\"}"); });

    // Vitamin pump control
    server.on("/api/vitamin/start", HTTP_POST, []()
              {
    if (vitaminPumpActive) {
        server.send(400, "application/json", "{\"error\":\"Vitamin pump already running\"}");
        return;
    }
    int duration = 5000;
    if (server.hasArg("plain")) {
        StaticJsonDocument<200> doc;
        DeserializationError err = deserializeJson(doc, server.arg("plain"));
        if (!err && doc.containsKey("duration")) {
            duration = constrain((int)doc["duration"], 1000, 30000);
        }
    }
    digitalWrite(PIN_RELAY_VITAMIN, LOW); // Active LOW = ON
    vitaminPumpActive = true;
    vitaminPumpStartTime = millis();
    vitaminPumpDuration = duration;
    Serial.println("💊 Vitamin pump started for " + String(duration / 1000) + "s");
    server.send(200, "application/json", "{\"vitamin_pump_status\":\"on\",\"message\":\"Vitamin pump started\"}"); });

    server.on("/api/vitamin/stop", HTTP_POST, []()
              {
    stopVitaminPump();
    server.send(200, "application/json", "{\"vitamin_pump_status\":\"off\",\"message\":\"Vitamin pump stopped\"}"); });

    server.on("/api/vitamin/enable", HTTP_POST, []()
              {
    vitaminSystemEnabled = true;
    Serial.println("💊 Vitamin system ENABLED - peristaltic pump will dispense at watering schedule");
    server.send(200, "application/json", "{\"vitamin_system_enabled\":true,\"message\":\"Vitamin system enabled\"}"); });

    server.on("/api/vitamin/disable", HTTP_POST, []()
              {
    vitaminSystemEnabled = false;
    Serial.println("💊 Vitamin system DISABLED - water pump will dispense at watering schedule");
    server.send(200, "application/json", "{\"vitamin_system_enabled\":false,\"message\":\"Vitamin system disabled\"}"); });

    // Light control
    server.on("/api/light/on", HTTP_POST, []()
              {
    digitalWrite(PIN_LIGHT_MOSFET, HIGH);
    lightActive = true;
    
    // Read back pin state for verification
    int pinState = digitalRead(PIN_LIGHT_MOSFET);
    Serial.print("   GPIO16 state: ");
    Serial.println(pinState == HIGH ? "HIGH (3.3V)" : "LOW (0V)");
    
    if (pinState != HIGH) {
        Serial.println("   ⚠️  WARNING: Pin didn't go HIGH - possible GPIO16 conflict!");
        Serial.println("   Try using GPIO25, 32, or 33 instead");
    }
    
    server.send(200, "application/json", "{\"light_status\":\"on\",\"message\":\"Light turned on\"}"); });

    server.on("/api/light/off", HTTP_POST, []()
              {
    Serial.println("\n💡 Light OFF command received");
    digitalWrite(PIN_LIGHT_MOSFET, LOW);
    lightActive = false;
    Serial.println("   Light turned OFF");
    server.send(200, "application/json", "{\"light_status\":\"off\",\"message\":\"Light turned off\"}"); });

    // System restart
    server.on("/api/system/restart", HTTP_POST, []()
              {
    server.send(200, "application/json", "{\"status\":\"restarting\"}");
    delay(500);
    ESP.restart(); });

    // User ID configuration
    server.on("/api/system/userid", HTTP_POST, handleSetUserId);

    // Not found handler
    server.onNotFound([]()
                      { server.send(404, "application/json", "{\"error\":\"Endpoint not found\"}"); });
}

// =================================================================
// ====================== API HANDLERS =============================
// =================================================================

void handleGetSensors()
{
    StaticJsonDocument<1024> doc;

    // Environment sensors
    doc["temperature"] = dhtReady ? temperature : 0;
    doc["humidity"] = dhtReady ? humidity : 0;
    doc["air_quality"] = mq135Ready ? airQuality : 0;

    // Resource levels
    doc["water_level"] = currentWaterLevel;
    doc["feed_weight"] = currentWeight;
    doc["feeder_tank_level"] = feederTankLevel; // Ultrasonic 1 - Feed storage
    doc["water_tank_level"] = waterTankLevel;   // Ultrasonic 2 - Water storage

    // Actuator status
    doc["fan_status"] = fanActive ? "on" : "off";
    doc["light_status"] = lightActive ? "on" : "off";
    doc["pump_status"] = pumpActive ? "on" : "off";
    doc["vitamin_pump_status"] = vitaminPumpActive ? "on" : "off";
    doc["vitamin_system_enabled"] = vitaminSystemEnabled;

    // System info
    JsonObject system = doc.createNestedObject("system");
    system["uptime"] = millis() / 1000;
    system["wifi_rssi"] = WiFi.RSSI();
    system["free_heap"] = ESP.getFreeHeap();

    // Sensor status
    JsonObject sensors = doc.createNestedObject("sensor_status");
    sensors["dht22"] = dhtReady ? "ready" : "failed";
    sensors["load_cell"] = loadCellReady ? "ready" : "failed";
    sensors["mq135"] = mq135Ready ? "ready" : "warming_up";

    String response;
    serializeJson(doc, response);
    server.send(200, "application/json", response);

    Serial.println("📤 Sensor data sent to client");
}

void handleStartPump()
{
    Serial.println("\n🚰 Pump start request received");

    // SAFETY CHECK 1: Water level too high
    if (currentWaterLevel > MAX_WATER_LEVEL)
    {
        Serial.println("  ⚠️  ABORT: Water level too high (" + String(currentWaterLevel) + "%)");
        server.send(400, "application/json",
                    "{\"error\":\"Water level too high (" + String(currentWaterLevel) + "%). Pump aborted for safety.\"}");
        return;
    }

    // SAFETY CHECK 2: Already running
    if (pumpActive)
    {
        Serial.println("  ⚠️  ABORT: Pump already running");
        server.send(400, "application/json", "{\"error\":\"Pump is already running\"}");
        return;
    }

    // Parse duration from request
    int duration = 5000; // Default 5 seconds
    if (server.hasArg("plain"))
    {
        StaticJsonDocument<200> doc;
        DeserializationError error = deserializeJson(doc, server.arg("plain"));
        if (!error && doc.containsKey("duration"))
        {
            duration = doc["duration"];
            duration = constrain(duration, 1000, 30000); // 1-30 seconds max
        }
    }

    // Start pump
    digitalWrite(PIN_RELAY_PUMP, LOW); // Active LOW relay = ON
    pumpActive = true;
    pumpStartTime = millis();
    pumpDuration = duration;

    Serial.println("  ✓ Pump started for " + String(duration / 1000) + " seconds");

    StaticJsonDocument<256> doc;
    doc["status"] = "started";
    doc["duration"] = duration;
    doc["water_level"] = currentWaterLevel;

    String response;
    serializeJson(doc, response);
    server.send(200, "application/json", response);
}

void handleStopPump()
{
    stopPump();
    server.send(200, "application/json", "{\"status\":\"stopped\"}");
}

void stopPump()
{
    if (pumpActive)
    {
        digitalWrite(PIN_RELAY_PUMP, HIGH); // Active LOW relay = OFF
        pumpActive = false;
        Serial.println("  ⏹️  Pump stopped");
    }
}

void stopVitaminPump()
{
    if (vitaminPumpActive)
    {
        digitalWrite(PIN_RELAY_VITAMIN, HIGH); // Active LOW relay = OFF
        vitaminPumpActive = false;
        Serial.println("  ⏹️  Vitamin pump stopped");
    }
}

void handleStartServo()
{
    Serial.println("\n🍗 Feed dispense request received");

    // SAFETY CHECK: Bowl is full
    if (currentWeight > MAX_BOWL_WEIGHT)
    {
        Serial.println("  ⚠️  ABORT: Bowl is full (" + String(currentWeight) + "g)");
        server.send(400, "application/json",
                    "{\"error\":\"Bowl is full (" + String(currentWeight) + "g). Feeding aborted for safety.\"}");
        return;
    }

    // 180° Servo Sequence
    // Open -> Wait -> Close

    Serial.println("  ✓ Starting feed dispense sequence...");

    // Step 1: Open to dispense position (180°)
    Serial.println("  → Opening to 180° (dispense position)");
    feedServo.write(180); // Open position
    delay(1000);          // Wait 1 second for servo to reach position

    // Step 2: Wait for feed to drop
    Serial.println("  → Waiting for feed to dispense (2s)");
    delay(2000);

    // Step 3: Close back to starting position (0°)
    Serial.println("  → Closing to 0° (closed position)");
    feedServo.write(0); // Closed position
    delay(1000);        // Wait 1 second for servo to reach position

    Serial.println("  ✓ Feed dispense sequence completed");

    StaticJsonDocument<256> doc;
    doc["status"] = "fed";
    doc["sequence"] = "open-180-wait-close-0";
    doc["bowl_weight"] = currentWeight;

    String response;
    serializeJson(doc, response);
    server.send(200, "application/json", response);
}

// =================================================================
// ====================== FIREBASE INTEGRATION =====================
// =================================================================

String getCurrentTimeString()
{
    struct tm timeinfo;
    if (!getLocalTime(&timeinfo))
    {
        Serial.println("⚠️  Unable to get current time");
        configTime(8 * 3600, 0, "pool.ntp.org", "time.nist.gov");
        delay(1000);
        if (!getLocalTime(&timeinfo))
        {
            return "";
        }
    }

    char timeStr[6];
    sprintf(timeStr, "%02d:%02d", timeinfo.tm_hour, timeinfo.tm_min);
    return String(timeStr);
}

String buildFirestoreQueryUrl()
{
    return "https://firestore.googleapis.com/v1/projects/" + String(FIREBASE_PROJECT_ID) +
           "/databases/(default)/documents:runQuery?key=" + String(FIREBASE_API_KEY);
}

void checkSchedules()
{
    String currentTime = getCurrentTimeString();
    if (currentTime.isEmpty())
    {
        return;
    }

    // Check both watering and feeding schedules
    checkWateringSchedules(currentTime);
    checkFeedingSchedules(currentTime);
}

void checkWateringSchedules(String currentTime)
{
    Serial.print("💧 Checking watering schedules at ");
    Serial.println(currentTime);

    String url = buildFirestoreQueryUrl();
    DynamicJsonDocument queryDoc(512);
    queryDoc["structuredQuery"]["from"][0]["collectionId"] = "wateringSchedules";

    String queryPayload;
    serializeJson(queryDoc, queryPayload);

    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    int httpCode = http.POST(queryPayload);

    if (httpCode == HTTP_CODE_OK)
    {
        String payload = http.getString();
        DynamicJsonDocument doc(4096);
        DeserializationError error = deserializeJson(doc, payload);

        if (!error)
        {
            for (JsonObject result : doc.as<JsonArray>())
            {
                if (result.containsKey("document"))
                {
                    JsonObject fields = result["document"]["fields"];
                    String scheduleTime = fields["time"]["stringValue"].as<String>();
                    // FIX: Firestore returns integerValue as a JSON string, not a number
                    int scheduleDuration = String(fields["duration"]["integerValue"].as<String>()).toInt() * 1000;
                    if (scheduleDuration <= 0) scheduleDuration = 5000; // Default 5s if parse fails
                    String scheduleUserId = fields["userId"]["stringValue"].as<String>();
                    String documentName = result["document"]["name"].as<String>();
                    String scheduleId = documentName.substring(documentName.lastIndexOf('/') + 1);

                    if (scheduleUserId == userId)
                    {
                        String scheduleHHMM = convertTo24Hour(scheduleTime);
                        // FIX: Track scheduleId+time so the same schedule can re-run daily
                        String execKey = scheduleId + "_" + currentTime;

                        if (scheduleHHMM == currentTime && lastExecutedWaterSchedule != execKey)
                        {
                            Serial.println("✅ Executing scheduled watering!");
                            if (vitaminSystemEnabled)
                            {
                                // Vitamin system ON: use peristaltic pump
                                Serial.println("💊 Vitamin system active - using peristaltic pump");
                                digitalWrite(PIN_RELAY_VITAMIN, LOW);
                                vitaminPumpActive = true;
                                vitaminPumpStartTime = millis();
                                vitaminPumpDuration = scheduleDuration;
                            }
                            else
                            {
                                // Vitamin system OFF: use water pump as usual
                                digitalWrite(PIN_RELAY_PUMP, LOW);
                                pumpActive = true;
                                pumpStartTime = millis();
                                pumpDuration = scheduleDuration;
                            }
                            lastExecutedWaterSchedule = execKey;
                        }
                    }
                }
            }
        }
    }
    http.end();
}

void checkFeedingSchedules(String currentTime)
{
    Serial.print("🍗 Checking feeding schedules at ");
    Serial.println(currentTime);

    String url = buildFirestoreQueryUrl();
    DynamicJsonDocument queryDoc(512);
    queryDoc["structuredQuery"]["from"][0]["collectionId"] = "feeds";

    String queryPayload;
    serializeJson(queryDoc, queryPayload);

    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    int httpCode = http.POST(queryPayload);

    if (httpCode == HTTP_CODE_OK)
    {
        String payload = http.getString();
        DynamicJsonDocument doc(4096);
        DeserializationError error = deserializeJson(doc, payload);

        if (!error)
        {
            for (JsonObject result : doc.as<JsonArray>())
            {
                if (result.containsKey("document"))
                {
                    JsonObject fields = result["document"]["fields"];
                    String scheduleTime = fields["time"]["stringValue"].as<String>();
                    String scheduleUserId = fields["userId"]["stringValue"].as<String>();
                    String documentName = result["document"]["name"].as<String>();
                    String scheduleId = documentName.substring(documentName.lastIndexOf('/') + 1);

                    if (scheduleUserId == userId)
                    {
                        String scheduleHHMM = convertTo24Hour(scheduleTime);
                        // FIX: Track scheduleId+time so the same schedule can re-run daily
                        String execKey = scheduleId + "_" + currentTime;

                        if (scheduleHHMM == currentTime && lastExecutedFeedSchedule != execKey)
                        {
                            // SAFETY CHECK: Don't feed if bowl is full
                            if (currentWeight > MAX_BOWL_WEIGHT)
                            {
                                Serial.println("⚠️  Scheduled feeding ABORTED: Bowl is full (" + String(currentWeight) + "g)");
                                lastExecutedFeedSchedule = execKey; // Mark as executed to avoid retries
                                continue;
                            }

                            Serial.println("✅ Executing scheduled feeding!");

                            // MG995 Continuous Servo Sequence
                            Serial.println("  → Moving forward (0.5s)");
                            feedServo.write(180); // Forward
                            delay(500);

                            Serial.println("  → Stopping");
                            feedServo.write(90); // Stop

                            Serial.println("  → Waiting (5s)");
                            delay(5000);

                            Serial.println("  → Moving backward (0.5s)");
                            feedServo.write(0); // Backward
                            delay(500);

                            Serial.println("  → Stopping");
                            feedServo.write(90); // Stop

                            Serial.println("  ✓ Scheduled feeding completed");
                            lastExecutedFeedSchedule = execKey;
                        }
                    }
                }
            }
        }
    }
    http.end();
}

String convertTo24Hour(String timeStr)
{
    // Convert "7:00 PM" or "7:00PM" to "19:00"
    String scheduleHHMM = timeStr;
    if (timeStr.indexOf("PM") > 0 || timeStr.indexOf("AM") > 0)
    {
        int colonPos = timeStr.indexOf(':');
        int hour = timeStr.substring(0, colonPos).toInt();
        String minute = timeStr.substring(colonPos + 1, colonPos + 3);

        if (timeStr.indexOf("PM") > 0)
        {
            if (hour != 12)
                hour += 12;
            scheduleHHMM = String(hour) + ":" + minute;
        }
        else
        {
            if (hour == 12)
                hour = 0;
            scheduleHHMM = (hour < 10 ? "0" : "") + String(hour) + ":" + minute;
        }
    }
    return scheduleHHMM;
}

void handleSetUserId()
{
    if (server.hasArg("plain"))
    {
        StaticJsonDocument<200> doc;
        DeserializationError error = deserializeJson(doc, server.arg("plain"));

        if (!error && doc.containsKey("userId"))
        {
            userId = doc["userId"].as<String>();

            Serial.print("👤 User ID set: ");
            Serial.println(userId);

            StaticJsonDocument<200> response;
            response["status"] = "success";
            response["userId"] = userId;
            response["message"] = "User ID configured successfully";

            String responseStr;
            serializeJson(response, responseStr);
            server.send(200, "application/json", responseStr);
            return;
        }
    }

    server.send(400, "application/json", "{\"error\":\"Invalid request\"}");
}
