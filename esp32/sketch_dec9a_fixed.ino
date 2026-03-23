#include <WiFi.h>
#include <WebServer.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <ESP32Servo.h>
#include <DHT.h>
#include "HX711.h"

// =================================================================
// ============== PIN DEFINITIONS ==================================
// =================================================================

// --- Sensors ---
#define PIN_MQ135 34       // Air Quality
#define PIN_WATER_LEVEL 35 // Water Level
#define PIN_DHT 4          // Temp & Humidity
#define PIN_HX711_DT 32    // Load Cell Data
#define PIN_HX711_SCK 33   // Load Cell Clock

// --- Ultrasonic (Source Tanks) ---
#define PIN_TRIG_WATER 19
#define PIN_ECHO_WATER 21
#define PIN_TRIG_FEED 18
#define PIN_ECHO_FEED 25

// --- 6-Channel Relay Board (JUMPERS MUST BE SET TO 'HIGH') ---
#define PIN_RELAY_PUMP 26      // Relay 1: Water pump
#define PIN_RELAY_FAN 27       // Relay 2: Exhaust fan
#define PIN_RELAY_VITAMIN 14   // Relay 3: Peristaltic pump
#define PIN_RELAY_LIGHT 22     // Relay 4: Normal 12V light
#define PIN_RELAY_HEATER 16    // Relay 1 (20A): Ceramic Heater (⚠️ USE 20A EXTERNAL RELAY!)
#define PIN_RELAY_SPRINKLER 23 // Relay 5: Solenoid valve/sprinkler

// --- Actuators ---
#define PIN_SERVO 13 // Servo motor for feeding (180-degree)

// --- Configuration ---
#define DHTTYPE DHT22
const char *WIFI_SSID = "Converge_2.4GHz_nCW2"; // Replace with your WiFi SSID
const char *WIFI_PASSWORD = "bhUxE568";         // Replace with your WiFi password

// Firebase Configuration
const char *FIREBASE_API_KEY = "AIzaSyBa6PE0nqkrFAqDm6AT2nIrZmv6qIfgiFM";
const char *FIREBASE_PROJECT_ID = "internet-of-tsiken-f0ad4";

// Safety Thresholds
const int MAX_BOWL_WEIGHT = 500;
const int MAX_WATER_LEVEL = 80;
const int MIN_WATER_LEVEL = 10;

// Timing
const unsigned long SENSOR_READ_INTERVAL = 3000;
const unsigned long MQ135_WARMUP_TIME = 60000;
const unsigned long SCHEDULE_CHECK_INTERVAL = 10000;
const unsigned long SPRINKLER_OPEN_DURATION_MS = 10000;

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
int rawWaterLevelAdc = 0;
int feederTankLevel = 0;
int waterTankLevel = 0;
float feederDistanceCm = -1.0;
float waterDistanceCm = -1.0;
int feederValidEchoes = 0;
int waterValidEchoes = 0;
int feederEchoTimeouts = 0;
int waterEchoTimeouts = 0;
bool fanActive = false;
bool lightActive = false;
bool heaterActive = false;
bool pumpActive = false;
bool vitaminPumpActive = false;
bool sprinklerActive = false;
bool vitaminSystemEnabled = false;
unsigned long pumpStartTime = 0;
unsigned long pumpDuration = 0;
unsigned long vitaminPumpStartTime = 0;
unsigned long vitaminPumpDuration = 0;
unsigned long sprinklerStartTime = 0;
unsigned long sprinklerDuration = SPRINKLER_OPEN_DURATION_MS;
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
bool waterLevelConnected = true;

// Calibrations
float LOADCELL_CALIBRATION = 420.0;
const int TARE_WEIGHT = 250;
const int FULL_LEVEL = 2160;
const int EMPTY_LEVEL = 1200;

void handleSerialCommands();
void startSprinkler(unsigned long durationMs = SPRINKLER_OPEN_DURATION_MS);
void stopSprinkler();
void reportSprinklerStatus();
int readUltrasonic(int trigPin, int echoPin, float emptyDistance, float fullDistance, float &avgDistance, int &validReadingsOut, int &timeoutsOut);

// =================================================================
// ====================== SETUP ====================================
// =================================================================

void setup()
{
    Serial.begin(115200);
    delay(500);

    Serial.println("\n\n╔════════════════════════════════════════════╗");
    Serial.println("║   ESP32 Smart Chicken Coop Controller      ║");
    Serial.println("╚════════════════════════════════════════════╝\n");

    bootTime = millis();

    // ========== Initialize Actuators (ACTIVE-HIGH LOGIC) ==========
    Serial.println("\n🔧 Initializing Relays...");

    // Set pins to OUTPUT and send LOW (0V) to make sure they start completely OFF
    pinMode(PIN_RELAY_PUMP, OUTPUT);
    pinMode(PIN_RELAY_FAN, OUTPUT);
    pinMode(PIN_RELAY_VITAMIN, OUTPUT);
    pinMode(PIN_RELAY_LIGHT, OUTPUT);
    pinMode(PIN_RELAY_HEATER, OUTPUT);
    pinMode(PIN_RELAY_SPRINKLER, OUTPUT);

    digitalWrite(PIN_RELAY_PUMP, LOW);
    digitalWrite(PIN_RELAY_FAN, LOW);
    digitalWrite(PIN_RELAY_VITAMIN, LOW);
    digitalWrite(PIN_RELAY_LIGHT, LOW);
    digitalWrite(PIN_RELAY_HEATER, LOW);
    digitalWrite(PIN_RELAY_SPRINKLER, LOW);

    Serial.println("  • Pump Relay... ✓ OFF");
    Serial.println("  • Fan Relay... ✓ OFF");
    Serial.println("  • Vitamin Relay... ✓ OFF");
    Serial.println("  • Light Relay... ✓ OFF");
    Serial.println("  • Heater Relay... ✓ OFF");
    Serial.println("  • Sprinkler Relay... ✓ OFF");

    // Servo
    feedServo.attach(PIN_SERVO);
    feedServo.write(0);
    Serial.println("  • Feed Servo... ✓ Initialized at 0° (closed)");

    // ========== Initialize Sensors ==========
    Serial.println("\n🔧 Initializing Sensors...");

    dht.begin();
    delay(2000);

    float testTemp = -999;
    for (int i = 0; i < 3; i++)
    {
        testTemp = dht.readTemperature();
        if (!isnan(testTemp))
            break;
        delay(500);
    }
    if (!isnan(testTemp) && testTemp > -40 && testTemp < 80)
        dhtReady = true;

    loadCell.begin(PIN_HX711_DT, PIN_HX711_SCK);
    if (loadCell.wait_ready_timeout(1000))
    {
        long rawWeight = (long)loadCell.get_units(3);
        currentWeight = max(0L, rawWeight - TARE_WEIGHT);
        loadCell.set_scale(LOADCELL_CALIBRATION);
        loadCell.tare();
        loadCellReady = true;
    }

    pinMode(PIN_MQ135, INPUT);
    pinMode(PIN_WATER_LEVEL, INPUT);
    pinMode(PIN_TRIG_WATER, OUTPUT);
    pinMode(PIN_ECHO_WATER, INPUT);
    pinMode(PIN_TRIG_FEED, OUTPUT);
    pinMode(PIN_ECHO_FEED, INPUT);

    // ========== Connect to WiFi ==========
    Serial.println("\n📡 Connecting to WiFi...");
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
        configTime(8 * 3600, 0, "pool.ntp.org", "time.nist.gov");
    }

    if (wifiConnected)
    {
        setupWebServer();
        server.begin();
    }
}

// =================================================================
// ====================== MAIN LOOP ================================
// =================================================================

void loop()
{
    handleSerialCommands();

    if (wifiConnected)
        server.handleClient();

    if (millis() - lastSensorRead >= SENSOR_READ_INTERVAL)
    {
        lastSensorRead = millis();
        readSensors();
    }

    if (!mq135Ready && (millis() - bootTime) > MQ135_WARMUP_TIME)
        mq135Ready = true;

    if (wifiConnected && !userId.isEmpty() && (millis() - lastScheduleCheck >= SCHEDULE_CHECK_INTERVAL))
    {
        lastScheduleCheck = millis();
        checkSchedules();
    }

    if (pumpActive && (millis() - pumpStartTime >= pumpDuration))
        stopPump();
    if (vitaminPumpActive && (millis() - vitaminPumpStartTime >= vitaminPumpDuration))
        stopVitaminPump();
    if (sprinklerActive && (millis() - sprinklerStartTime >= sprinklerDuration))
        stopSprinkler();
}

void handleSerialCommands()
{
    if (!Serial.available())
        return;

    String command = Serial.readStringUntil('\n');
    command.trim();

    if (command.equalsIgnoreCase("OPEN_VALVE"))
    {
        if (sprinklerActive)
        {
            Serial.println("REJECTED: Valve already active");
            return;
        }
        startSprinkler();
    }
    else if (command.equalsIgnoreCase("CLOSE_VALVE"))
    {
        stopSprinkler();
    }
    else if (command.equalsIgnoreCase("STATUS"))
    {
        reportSprinklerStatus();
    }
    else if (command.length() > 0)
    {
        Serial.print("UNKNOWN COMMAND: ");
        Serial.println(command);
    }
}

// =================================================================
// ====================== SENSOR READING ===========================
// =================================================================

void readSensors()
{
    if (dhtReady)
    {
        temperature = dht.readTemperature();
        humidity = dht.readHumidity();
    }

    int rawAirQuality = analogRead(PIN_MQ135);
    airQuality = map(rawAirQuality, 0, 4095, 0, 1000);

    rawWaterLevelAdc = analogRead(PIN_WATER_LEVEL);

    // Detect floating/disconnected ADC input to avoid false 100% readings.
    if (rawWaterLevelAdc <= 40 || rawWaterLevelAdc >= 4050)
    {
        waterLevelConnected = false;
        currentWaterLevel = 0;
    }
    else
    {
        waterLevelConnected = true;
        currentWaterLevel = constrain(map(rawWaterLevelAdc, EMPTY_LEVEL, FULL_LEVEL, 0, 100), 0, 100);
    }

    if (loadCellReady && loadCell.wait_ready_timeout(200))
    {
        long rawWeight = (long)loadCell.get_units(3);
        currentWeight = max(0L, rawWeight - TARE_WEIGHT);
    }

    feederTankLevel = readUltrasonic(PIN_TRIG_FEED, PIN_ECHO_FEED, 18.0, 5.0, feederDistanceCm, feederValidEchoes, feederEchoTimeouts);
    waterTankLevel = readUltrasonic(PIN_TRIG_WATER, PIN_ECHO_WATER, 17.0, 5.0, waterDistanceCm, waterValidEchoes, waterEchoTimeouts);

    Serial.println("\n--- Sensor Status ---");
    Serial.print("Temp: ");
    Serial.print(temperature);
    Serial.print("°C | Hum: ");
    Serial.print(humidity);
    Serial.println("%");
    Serial.print("Water Trough Level: ");
    Serial.print(currentWaterLevel);
    Serial.print("% (raw ADC: ");
    Serial.print(rawWaterLevelAdc);
    Serial.print(", connected: ");
    Serial.print(waterLevelConnected ? "yes" : "no");
    Serial.println(")");
    Serial.print("Feed tank: ");
    Serial.print(feederTankLevel);
    Serial.print("% (dist cm: ");
    Serial.print(feederDistanceCm);
    Serial.print(", valid echoes: ");
    Serial.print(feederValidEchoes);
    Serial.print(", timeouts: ");
    Serial.print(feederEchoTimeouts);
    Serial.println(")");
    Serial.print("Water tank: ");
    Serial.print(waterTankLevel);
    Serial.print("% (dist cm: ");
    Serial.print(waterDistanceCm);
    Serial.print(", valid echoes: ");
    Serial.print(waterValidEchoes);
    Serial.print(", timeouts: ");
    Serial.print(waterEchoTimeouts);
    Serial.println(")");
}

int readUltrasonic(int trigPin, int echoPin, float emptyDistance, float fullDistance, float &avgDistance, int &validReadingsOut, int &timeoutsOut)
{
    float total = 0;
    int validReadings = 0;
    int timeouts = 0;

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
        else
        {
            timeouts++;
        }
        delay(10);
    }
    validReadingsOut = validReadings;
    timeoutsOut = timeouts;

    if (validReadings > 0)
    {
        float distance = total / validReadings;
        avgDistance = distance;
        if (distance <= fullDistance)
            return 100;
        if (distance >= emptyDistance)
            return 0;
        return constrain((int)(((emptyDistance - distance) / (emptyDistance - fullDistance)) * 100.0), 0, 100);
    }
    avgDistance = -1.0;
    return 0;
}

// =================================================================
// ====================== WEB SERVER SETUP =========================
// =================================================================

void setupWebServer()
{
    server.on("/api/sensors", HTTP_GET, handleGetSensors);
    server.on("/api/pump/start", HTTP_POST, handleStartPump);
    server.on("/api/pump/stop", HTTP_POST, handleStopPump);
    server.on("/api/servo/start", HTTP_POST, handleStartServo);
    server.on("/api/valve/open", HTTP_POST, []()
              {
        if (sprinklerActive) {
            server.send(400, "application/json", "{\"error\":\"Valve already active\"}");
            return;
        }
        startSprinkler();
        server.send(200, "application/json", "{\"valve_status\":\"open\"}"); });

    server.on("/api/valve/close", HTTP_POST, []()
              {
        stopSprinkler();
        server.send(200, "application/json", "{\"valve_status\":\"closed\"}"); });

    server.on("/api/valve/status", HTTP_GET, []()
              {
        StaticJsonDocument<128> doc;
        doc["valve_status"] = sprinklerActive ? "open" : "closed";
        if (sprinklerActive)
        {
            unsigned long elapsed = millis() - sprinklerStartTime;
            unsigned long remaining = (elapsed >= sprinklerDuration) ? 0 : (sprinklerDuration - elapsed);
            doc["remaining_seconds"] = remaining / 1000;
        }
        String response;
        serializeJson(doc, response);
        server.send(200, "application/json", response); });

    // ACTIVE-HIGH LOGIC: HIGH = ON, LOW = OFF
    server.on("/api/fan/start", HTTP_POST, []()
              {
        digitalWrite(PIN_RELAY_FAN, HIGH); 
        fanActive = true;
        server.send(200, "application/json", "{\"fan_status\":\"on\"}"); });

    server.on("/api/fan/stop", HTTP_POST, []()
              {
        digitalWrite(PIN_RELAY_FAN, LOW); 
        fanActive = false;
        server.send(200, "application/json", "{\"fan_status\":\"off\"}"); });

    server.on("/api/light/on", HTTP_POST, []()
              {
        digitalWrite(PIN_RELAY_LIGHT, HIGH); 
        lightActive = true;
        server.send(200, "application/json", "{\"light_status\":\"on\"}"); });

    server.on("/api/light/off", HTTP_POST, []()
              {
        digitalWrite(PIN_RELAY_LIGHT, LOW); 
        lightActive = false;
        server.send(200, "application/json", "{\"light_status\":\"off\"}"); });

    server.on("/api/heater/on", HTTP_POST, []()
              {
        digitalWrite(PIN_RELAY_HEATER, HIGH); 
        heaterActive = true;
        server.send(200, "application/json", "{\"heater_status\":\"on\"}"); });

    server.on("/api/heater/off", HTTP_POST, []()
              {
        digitalWrite(PIN_RELAY_HEATER, LOW); 
        heaterActive = false;
        server.send(200, "application/json", "{\"heater_status\":\"off\"}"); });

    server.on("/api/vitamin/start", HTTP_POST, []()
              {
        if (vitaminPumpActive) {
            server.send(400, "application/json", "{\"error\":\"Running\"}");
            return;
        }
        digitalWrite(PIN_RELAY_VITAMIN, HIGH); 
        vitaminPumpActive = true;
        vitaminPumpStartTime = millis();
        vitaminPumpDuration = 35000; // Default 35 seconds
        server.send(200, "application/json", "{\"vitamin_pump_status\":\"on\"}"); });

    server.on("/api/vitamin/stop", HTTP_POST, []()
              {
        stopVitaminPump();
        server.send(200, "application/json", "{\"vitamin_pump_status\":\"off\"}"); });

    server.on("/api/vitamin/enable", HTTP_POST, []()
              {
        vitaminSystemEnabled = true;
        server.send(200, "application/json", "{\"vitamin_system_enabled\":true}"); });

    server.on("/api/vitamin/disable", HTTP_POST, []()
              {
        vitaminSystemEnabled = false;
        server.send(200, "application/json", "{\"vitamin_system_enabled\":false}"); });

    server.on("/api/system/restart", HTTP_POST, []()
              {
        server.send(200, "application/json", "{\"status\":\"restarting\"}");
        delay(500);
        ESP.restart(); });

    server.on("/api/system/userid", HTTP_POST, handleSetUserId);
    server.onNotFound([]()
                      { server.send(404, "application/json", "{\"error\":\"Not found\"}"); });
}

// =================================================================
// ====================== API HANDLERS =============================
// =================================================================

void handleGetSensors()
{
    StaticJsonDocument<1536> doc;
    doc["temperature"] = dhtReady ? temperature : 0;
    doc["humidity"] = dhtReady ? humidity : 0;
    doc["air_quality"] = mq135Ready ? airQuality : 0;
    doc["water_level"] = currentWaterLevel;
    doc["water_level_connected"] = waterLevelConnected;
    doc["water_level_raw"] = rawWaterLevelAdc;
    doc["feed_weight"] = currentWeight;
    doc["feeder_tank_level"] = feederTankLevel;
    doc["water_tank_level"] = waterTankLevel;
    doc["feeder_distance_cm"] = feederDistanceCm;
    doc["water_distance_cm"] = waterDistanceCm;
    doc["feeder_valid_echoes"] = feederValidEchoes;
    doc["water_valid_echoes"] = waterValidEchoes;
    doc["feeder_echo_timeouts"] = feederEchoTimeouts;
    doc["water_echo_timeouts"] = waterEchoTimeouts;
    doc["feeder_ultrasonic_connected"] = feederValidEchoes > 0;
    doc["water_ultrasonic_connected"] = waterValidEchoes > 0;

    doc["fan_status"] = fanActive ? "on" : "off";
    doc["light_status"] = lightActive ? "on" : "off";
    doc["heater_status"] = heaterActive ? "on" : "off";
    doc["pump_status"] = pumpActive ? "on" : "off";
    doc["valve_status"] = sprinklerActive ? "open" : "closed";
    doc["vitamin_pump_status"] = vitaminPumpActive ? "on" : "off";
    doc["vitamin_system_enabled"] = vitaminSystemEnabled;

    String response;
    serializeJson(doc, response);
    server.send(200, "application/json", response);
}

void handleStartPump()
{
    if (currentWaterLevel > MAX_WATER_LEVEL || pumpActive)
    {
        server.send(400, "application/json", "{\"error\":\"Cannot start\"}");
        return;
    }
    digitalWrite(PIN_RELAY_PUMP, HIGH); // HIGH = ON
    pumpActive = true;
    pumpStartTime = millis();
    pumpDuration = 35000; // 35 seconds default
    server.send(200, "application/json", "{\"status\":\"started\"}");
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
        digitalWrite(PIN_RELAY_PUMP, LOW); // LOW = OFF
        pumpActive = false;
    }
}

void stopVitaminPump()
{
    if (vitaminPumpActive)
    {
        digitalWrite(PIN_RELAY_VITAMIN, LOW); // LOW = OFF
        vitaminPumpActive = false;
    }
}

void startSprinkler(unsigned long durationMs)
{
    if (sprinklerActive)
        return;

    digitalWrite(PIN_RELAY_SPRINKLER, HIGH); // HIGH = OPEN/ON
    sprinklerActive = true;
    sprinklerStartTime = millis();
    sprinklerDuration = durationMs;

    Serial.println(">>> VALVE OPENED <<<");
    Serial.print("Duration: ");
    Serial.print(durationMs / 1000);
    Serial.println(" seconds");
}

void stopSprinkler()
{
    if (!sprinklerActive)
        return;

    digitalWrite(PIN_RELAY_SPRINKLER, LOW); // LOW = CLOSED/OFF
    sprinklerActive = false;

    Serial.println(">>> VALVE CLOSED <<<");
    Serial.println("Ready for next command.");
}

void reportSprinklerStatus()
{
    Serial.print("Valve Status: ");
    Serial.println(sprinklerActive ? "OPEN" : "CLOSED");

    if (sprinklerActive)
    {
        unsigned long elapsed = millis() - sprinklerStartTime;
        unsigned long remaining = (elapsed >= sprinklerDuration) ? 0 : (sprinklerDuration - elapsed);
        Serial.print("Time remaining: ");
        Serial.print(remaining / 1000);
        Serial.println(" seconds");
    }
}

void handleStartServo()
{
    if (currentWeight > MAX_BOWL_WEIGHT)
    {
        server.send(400, "application/json", "{\"error\":\"Full\"}");
        return;
    }
    Serial.println("Manual Feed Triggered! (Double-Tap 40°)");

    // --- First Dispense ---
    feedServo.write(40);
    delay(1000);
    feedServo.write(0);
    delay(500);

    // --- Second Dispense ---
    feedServo.write(40);
    delay(1000);
    feedServo.write(0);
    delay(500);

    server.send(200, "application/json", "{\"status\":\"fed\"}");
}

// =================================================================
// ====================== FIREBASE INTEGRATION =====================
// =================================================================

String getCurrentTimeString()
{
    struct tm timeinfo;
    if (!getLocalTime(&timeinfo))
        return "";
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
        return;
    checkWateringSchedules(currentTime);
    checkFeedingSchedules(currentTime);
}

void checkWateringSchedules(String currentTime)
{
    String url = buildFirestoreQueryUrl();
    DynamicJsonDocument queryDoc(512);
    queryDoc["structuredQuery"]["from"][0]["collectionId"] = "wateringSchedules";
    String queryPayload;
    serializeJson(queryDoc, queryPayload);

    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    if (http.POST(queryPayload) == HTTP_CODE_OK)
    {
        DynamicJsonDocument doc(4096);
        if (!deserializeJson(doc, http.getString()))
        {
            for (JsonObject result : doc.as<JsonArray>())
            {
                if (result.containsKey("document"))
                {
                    JsonObject fields = result["document"]["fields"];
                    String scheduleTime = fields["time"]["stringValue"].as<String>();
                    int scheduleDuration = String(fields["duration"]["integerValue"].as<String>()).toInt() * 1000;
                    if (scheduleDuration <= 0)
                        scheduleDuration = 35000;
                    String scheduleUserId = fields["userId"]["stringValue"].as<String>();
                    String docName = result["document"]["name"].as<String>();
                    String scheduleId = docName.substring(docName.lastIndexOf('/') + 1);

                    if (scheduleUserId == userId)
                    {
                        String execKey = scheduleId + "_" + currentTime;
                        if (convertTo24Hour(scheduleTime) == currentTime && lastExecutedWaterSchedule != execKey)
                        {
                            if (vitaminSystemEnabled)
                            {
                                digitalWrite(PIN_RELAY_VITAMIN, HIGH); // HIGH = ON
                                vitaminPumpActive = true;
                                vitaminPumpStartTime = millis();
                                vitaminPumpDuration = scheduleDuration;
                                Serial.println("Scheduled Vitamin Pump Triggered!");
                            }
                            else
                            {
                                digitalWrite(PIN_RELAY_PUMP, HIGH); // HIGH = ON
                                pumpActive = true;
                                pumpStartTime = millis();
                                pumpDuration = scheduleDuration;
                                Serial.println("Scheduled Water Pump Triggered!");
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
    String url = buildFirestoreQueryUrl();
    DynamicJsonDocument queryDoc(512);
    queryDoc["structuredQuery"]["from"][0]["collectionId"] = "feeds";
    String queryPayload;
    serializeJson(queryDoc, queryPayload);

    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    if (http.POST(queryPayload) == HTTP_CODE_OK)
    {
        DynamicJsonDocument doc(4096);
        if (!deserializeJson(doc, http.getString()))
        {
            for (JsonObject result : doc.as<JsonArray>())
            {
                if (result.containsKey("document"))
                {
                    JsonObject fields = result["document"]["fields"];
                    String scheduleTime = fields["time"]["stringValue"].as<String>();
                    String scheduleUserId = fields["userId"]["stringValue"].as<String>();
                    String docName = result["document"]["name"].as<String>();
                    String scheduleId = docName.substring(docName.lastIndexOf('/') + 1);

                    if (scheduleUserId == userId)
                    {
                        String execKey = scheduleId + "_" + currentTime;
                        if (convertTo24Hour(scheduleTime) == currentTime && lastExecutedFeedSchedule != execKey)
                        {
                            if (currentWeight > MAX_BOWL_WEIGHT)
                            {
                                Serial.println("Scheduled Feed Skipped: Bowl Full!");
                                lastExecutedFeedSchedule = execKey;
                                continue;
                            }
                            Serial.println("Scheduled Feed Triggered! (Double-Tap 40°)");

                            // --- First Dispense ---
                            feedServo.write(40);
                            delay(1000);
                            feedServo.write(0);
                            delay(500);

                            // --- Second Dispense ---
                            feedServo.write(40);
                            delay(1000);
                            feedServo.write(0);
                            delay(500);

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
    String scheduleHHMM = timeStr;
    if (timeStr.indexOf("PM") > 0 || timeStr.indexOf("AM") > 0)
    {
        int colonPos = timeStr.indexOf(':');
        int hour = timeStr.substring(0, colonPos).toInt();
        String minute = timeStr.substring(colonPos + 1, colonPos + 3);

        if (timeStr.indexOf("PM") > 0 && hour != 12)
            hour += 12;
        else if (timeStr.indexOf("AM") > 0 && hour == 12)
            hour = 0;

        scheduleHHMM = (hour < 10 ? "0" : "") + String(hour) + ":" + minute;
    }
    return scheduleHHMM;
}

void handleSetUserId()
{
    if (server.hasArg("plain"))
    {
        StaticJsonDocument<200> doc;
        if (!deserializeJson(doc, server.arg("plain")) && doc.containsKey("userId"))
        {
            userId = doc["userId"].as<String>();
            server.send(200, "application/json", "{\"status\":\"success\"}");
            return;
        }
    }
    server.send(400, "application/json", "{\"error\":\"Invalid\"}");
}