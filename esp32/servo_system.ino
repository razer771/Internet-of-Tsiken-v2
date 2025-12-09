/*
 * ESP32 Feeder Level & Servo Motor Controller
 * Internet-of-Tsiken-v2
 *
 * NOTE: THIS CODE IS CONFIGURED FOR FIREBASE FIRESTORE.
 * - Only schedule checking (GET) is implemented using the Firestore REST API.
 * - Sensor updates (PUT/POST) are DISABLED because they require a complex Firestore rewrite.
 *
 * Features:
 * - Feeder level monitoring via HC-SR04 ultrasonic sensor
 * - Servo motor control for feed dispensing
 * - HTTP REST API for local mobile app control
 * - Firebase Firestore schedule checking
 *
 * Pins:
 * - HC-SR04 Trigger: GPIO 26
 * - HC-SR04 Echo: GPIO 27
 * - Servo Control: GPIO 25 (PWM)
 * - Status LED: GPIO 2 (built-in)
 */

#include <WiFi.h>
#include <WebServer.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <ESP32Servo.h>

// =================================================================
// ============== CONFIGURATION (CRITICAL: CHANGE THESE) ===========
// =================================================================

// WiFi Credentials
const char *WIFI_SSID = "DESKTOP-PO2GELH 2223";
const char *WIFI_PASSWORD = "3@1y9K87";

// Firebase Configuration (Using API Key and Project ID for REST calls)
const char *FIREBASE_API_KEY = "AIzaSyAOC8S6aOGvfnUzp0Twb-7O727Un9FoUGE";
const char *FIREBASE_PROJECT_ID = "internet-of-tsiken-690dd";

// Pin Definitions
const int TRIGGER_PIN = 26; // HC-SR04 Trigger (Output)
const int ECHO_PIN = 27;    // HC-SR04 Echo (Input)
const int SERVO_PIN = 25;   // Servo motor control (PWM)
const int LED_PIN = 2;      // Built-in LED

// HC-SR04 Sensor Calibration (Distance in cm)
const float TANK_HEIGHT = 30.0; // Height of feeder container (cm) - ADJUST THIS
const float TANK_EMPTY = 30.0;  // Distance when tank is empty (cm)
const float TANK_FULL = 5.0;    // Distance when tank is full (cm)
const int DISTANCE_SAMPLES = 5; // Number of samples to average

// Servo Configuration
const int SERVO_IDLE_ANGLE = 0;             // Servo angle when idle (closed)
const int SERVO_DISPENSE_ANGLE = 90;        // Servo angle when dispensing (open)
const int DEFAULT_DISPENSE_DURATION = 3000; // 3 seconds default
const int MIN_FEEDER_LEVEL = 10;            // Don't dispense if below 10%
const int MAX_DISPENSE_DURATION = 30000;    // Maximum 30 seconds
const int SERVO_COOLDOWN = 5000;            // 5 seconds between dispense cycles

// Update Intervals
const unsigned long SENSOR_READ_INTERVAL = 2000;      // Read every 2 seconds
const unsigned long FIREBASE_UPDATE_INTERVAL = 30000; // Update Firebase every 30 seconds
const unsigned long SCHEDULE_CHECK_INTERVAL = 60000;  // Check schedule every 60 seconds

// =================================================================
// =================== GLOBAL VARIABLES & FORWARD DECLARATIONS =====
// =================================================================

WebServer server(80);
HTTPClient http;
Servo feedServo;

// Sensor data
float feederLevel = 0;
float distance = 0;
unsigned long lastSensorRead = 0;
unsigned long lastFirebaseUpdate = 0;

// Servo control
bool servoActive = false;
unsigned long servoStartTime = 0;
unsigned long servoDuration = DEFAULT_DISPENSE_DURATION;
unsigned long lastServoStop = 0;

// Scheduled feeding
unsigned long lastScheduleCheck = 0;
String lastExecutedSchedule = ""; // Track last executed schedule to prevent duplicates

// System status
bool wifiConnected = false;
String deviceId = "";
String userId = ""; // User ID for Firebase queries

// Forward declarations
void setupWebServer();
void connectWiFi();
void readFeederLevel();
void startServo(unsigned long duration);
void stopServo();
void updateFirebase();
void logServoActivity(String action, unsigned long duration);
void checkFeedingSchedules();
String getDeviceId();
String getCurrentTimeString();
String buildFirestoreQueryUrl();
void handleGetFeederLevel();
void handleGetSensors();
void handleStartServo();
void handleStopServo();
void handleGetServoStatus();
void handleSetUserId();
void logScheduledExecution(String scheduleId, String scheduleTime, unsigned long duration);

// =================================================================
// ============================= SETUP =============================
// =================================================================

void setup()
{
    Serial.begin(115200);
    delay(100);

    Serial.println("\n\n╔═══════════════════════════════════╗");
    Serial.println("║  ESP32 Servo Feed Controller (Firestore)  ║");
    Serial.println("╚═══════════════════════════════════╝\n");

    // Initialize pins
    pinMode(TRIGGER_PIN, OUTPUT);
    pinMode(ECHO_PIN, INPUT);
    pinMode(LED_PIN, OUTPUT);

    // Initialize servo
    feedServo.attach(SERVO_PIN);
    feedServo.write(SERVO_IDLE_ANGLE); // Start at idle position

    digitalWrite(LED_PIN, LOW);

    // Generate device ID
    deviceId = getDeviceId();
    Serial.println("Device ID: " + deviceId);

    // Connect to WiFi
    connectWiFi();

    // Setup web server
    setupWebServer();
    server.begin();
    Serial.println("✓ HTTP Server started on port 80\n");

    // Sync time with Philippines timezone (GMT+8)
    Serial.println("🕐 Syncing time with NTP server...");
    configTime(8 * 3600, 0, "pool.ntp.org", "time.nist.gov");

    // Wait for time sync (max 10 seconds)
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
        Serial.println("\n✓ Time synced successfully!");
        char timeStr[64];
        strftime(timeStr, sizeof(timeStr), "%Y-%m-%d %H:%M:%S", &timeinfo);
        Serial.println("Current time: " + String(timeStr));
    }
    else
    {
        Serial.println("\n⚠️  Time sync timeout - schedules may not work until time is synced");
    }

    Serial.println("╔═══════════════════════════════════╗");
    Serial.println("║          System Ready!            ║");
    Serial.println("╚═══════════════════════════════════╝\n");
}

// =================================================================
// ============================= MAIN LOOP =========================
// =================================================================

void loop()
{
    server.handleClient();

    // Read ultrasonic sensor
    if (millis() - lastSensorRead >= SENSOR_READ_INTERVAL)
    {
        lastSensorRead = millis();
        readFeederLevel();
    }

    /* FIREBASE UPDATE IS DISABLED:
     * Must be completely rewritten for Firestore's Document PATCH API.
     */
    // if (millis() - lastFirebaseUpdate >= FIREBASE_UPDATE_INTERVAL) {
    //   lastFirebaseUpdate = millis();
    //   updateFirebase();
    // }

    // Check feeding schedules
    if (millis() - lastScheduleCheck >= SCHEDULE_CHECK_INTERVAL)
    {
        lastScheduleCheck = millis();
        if (!userId.isEmpty())
        {
            checkFeedingSchedules(); // This uses the Firestore Query API
        }
    }

    // Auto-stop servo
    if (servoActive && (millis() - servoStartTime >= servoDuration))
    {
        stopServo();
    }

    // WiFi status LED
    if (wifiConnected)
    {
        static unsigned long lastBlink = 0;
        if (millis() - lastBlink > 2000)
        {
            digitalWrite(LED_PIN, !digitalRead(LED_PIN));
            lastBlink = millis();
        }
    }
}

// =================================================================
// ======================= CONNECTION FUNCTION =====================
// =================================================================

void connectWiFi()
{
    Serial.print("Connecting to WiFi: ");
    Serial.println(WIFI_SSID);

    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 30)
    {
        delay(500);
        Serial.print(".");
        attempts++;
    }

    if (WiFi.status() == WL_CONNECTED)
    {
        wifiConnected = true;
        Serial.println("\n✓ WiFi Connected!");
        Serial.print("  IP Address: ");
        Serial.println(WiFi.localIP());
        Serial.print("  Signal: ");
        Serial.print(WiFi.RSSI());
        Serial.println(" dBm\n");
    }
    else
    {
        wifiConnected = false;
        Serial.println("\n✗ WiFi Connection Failed!\n");
    }
}

// =================================================================
// ======================= SENSOR & SERVO LOGIC ====================
// =================================================================

void readFeederLevel()
{
    float total = 0;
    int validReadings = 0;

    // Take multiple samples
    for (int i = 0; i < DISTANCE_SAMPLES; i++)
    {
        // Clear trigger
        digitalWrite(TRIGGER_PIN, LOW);
        delayMicroseconds(2);

        // Send 10us pulse
        digitalWrite(TRIGGER_PIN, HIGH);
        delayMicroseconds(10);
        digitalWrite(TRIGGER_PIN, LOW);

        // Read echo pulse
        long duration = pulseIn(ECHO_PIN, HIGH, 30000); // 30ms timeout

        if (duration > 0)
        {
            // Calculate distance in cm (speed of sound = 343 m/s)
            float dist = duration * 0.034 / 2;

            // Filter out invalid readings
            if (dist > 0 && dist < 400)
            { // HC-SR04 range: 2cm - 400cm
                total += dist;
                validReadings++;
            }
        }

        delay(50);
    }

    if (validReadings > 0)
    {
        distance = total / validReadings;

        // Convert distance to percentage
        // When distance is small (near TANK_FULL), tank is full (100%)
        // When distance is large (near TANK_EMPTY), tank is empty (0%)
        if (distance <= TANK_FULL)
        {
            feederLevel = 100.0;
        }
        else if (distance >= TANK_EMPTY)
        {
            feederLevel = 0.0;
        }
        else
        {
            feederLevel = ((TANK_EMPTY - distance) / (TANK_EMPTY - TANK_FULL)) * 100.0;
        }

        feederLevel = constrain(feederLevel, 0, 100);

        Serial.print("🍗 Feeder: ");
        Serial.print(feederLevel);
        Serial.print("% (Distance: ");
        Serial.print(distance);
        Serial.println(" cm)");
    }
    else
    {
        Serial.println("⚠️  Failed to read ultrasonic sensor");
    }
}

void startServo(unsigned long duration)
{
    // Safety checks
    if (servoActive)
    {
        Serial.println("⚠️  Servo already running");
        return;
    }

    if (feederLevel < MIN_FEEDER_LEVEL)
    {
        Serial.println("⚠️  Feeder level too low!");
        return;
    }

    if (millis() - lastServoStop < SERVO_COOLDOWN)
    {
        Serial.println("⚠️  Servo in cooldown period");
        return;
    }

    duration = constrain(duration, 1000, MAX_DISPENSE_DURATION);

    Serial.println("🍗 Dispensing feed for " + String(duration / 1000) + "s");
    feedServo.write(SERVO_DISPENSE_ANGLE);
    servoActive = true;
    servoStartTime = millis();
    servoDuration = duration;

    // logServoActivity("started", duration); // DISABLED
}

void stopServo()
{
    if (servoActive)
    {
        Serial.println("⏹️  Stopping feed dispenser");
        feedServo.write(SERVO_IDLE_ANGLE);
        servoActive = false;
        lastServoStop = millis();

        // logServoActivity("stopped", actualDuration); // DISABLED
    }
}

// =================================================================
// ========================= UTILITIES & FIRESTORE HTTP ============
// =================================================================

String getDeviceId()
{
    uint8_t mac[6];
    WiFi.macAddress(mac);
    char macStr[18];
    sprintf(macStr, "%02X%02X%02X%02X%02X%02X",
            mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
    return String(macStr);
}

String getCurrentTimeString()
{
    struct tm timeinfo;
    if (!getLocalTime(&timeinfo))
    {
        Serial.println("⚠️  Unable to get current time. Check WiFi sync.");
        // Try to re-sync time
        configTime(8 * 3600, 0, "pool.ntp.org", "time.nist.gov");
        delay(1000);
        if (!getLocalTime(&timeinfo))
        {
            return ""; // Still failed
        }
    }

    char timeStr[6];
    sprintf(timeStr, "%02d:%02d", timeinfo.tm_hour, timeinfo.tm_min);
    return String(timeStr);
}

// Helper function to build the Firestore Structured Query URL
String buildFirestoreQueryUrl()
{
    // Format: https://firestore.googleapis.com/v1/projects/[PROJECT_ID]/databases/(default)/documents:runQuery?key=[API_KEY]
    return "https://firestore.googleapis.com/v1/projects/" + String(FIREBASE_PROJECT_ID) + "/databases/(default)/documents:runQuery?key=" + String(FIREBASE_API_KEY);
}

// These functions are DISABLED as they require a full rewrite for the Firestore Document API.
void updateFirebase() { /* Function Disabled */ }
void logServoActivity(String action, unsigned long duration) { /* Function Disabled */ }
void logScheduledExecution(String scheduleId, String scheduleTime, unsigned long duration) { /* Function Disabled */ }

// =================================================================
// ======================= SCHEDULED FEEDING (FIRESTORE) ===========
// =================================================================

void checkFeedingSchedules()
{
    if (!wifiConnected || userId.isEmpty())
        return;

    String currentTime = getCurrentTimeString();
    if (currentTime.isEmpty())
    {
        Serial.println("⏰ Unable to get current time. Check WiFi sync.");
        return;
    }

    Serial.print("📅 Checking Firestore feeding schedules at ");
    Serial.println(currentTime);

    // 1. Build the Firestore Structured Query URL
    String url = buildFirestoreQueryUrl();

    // 2. Build the JSON Structured Query Payload (Selects all documents in the collection)
    DynamicJsonDocument queryDoc(512);
    queryDoc["structuredQuery"]["from"][0]["collectionId"] = "feeds";

    String queryPayload;
    serializeJson(queryDoc, queryPayload);

    // 3. Send POST request to run the query
    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    Serial.println("Query Payload: " + queryPayload); // Debug Query Payload

    int httpCode = http.POST(queryPayload);

    if (httpCode == HTTP_CODE_OK)
    {
        String payload = http.getString();
        Serial.println("Firestore Query Success.");

        // DEBUG: Print response
        Serial.println("📦 Firestore Response:");
        Serial.println(payload);

        // Firestore query results are returned as a JSON array
        DynamicJsonDocument doc(4096);
        DeserializationError error = deserializeJson(doc, payload);

        if (error)
        {
            Serial.println("❌ Failed to parse Firestore schedules response");
            Serial.print("Parse error: ");
            Serial.println(error.c_str());
            http.end();
            return;
        }

        // Count schedules
        int scheduleCount = 0;

        // Iterate through the array of results
        for (JsonObject result : doc.as<JsonArray>())
        {
            scheduleCount++;
            Serial.print("📋 Schedule #");
            Serial.println(scheduleCount);

            // Check if the result is a valid document
            if (result.containsKey("document"))
            {
                JsonObject fields = result["document"]["fields"];

                // Extract data using Firestore's nested structure
                String scheduleTime = fields["time"]["stringValue"].as<String>();
                // Default duration is 3 seconds for feeding
                int scheduleDuration = DEFAULT_DISPENSE_DURATION;

                // Check if duration field exists
                if (fields.containsKey("duration"))
                {
                    scheduleDuration = fields["duration"]["integerValue"].as<int>() * 1000;
                }

                String scheduleUserId = fields["userId"]["stringValue"].as<String>();

                String documentName = result["document"]["name"].as<String>();
                String scheduleId = documentName.substring(documentName.lastIndexOf('/') + 1);

                Serial.print("   Time: ");
                Serial.println(scheduleTime);
                Serial.print("   Duration (seconds): ");
                Serial.print(scheduleDuration / 1000);
                Serial.print("s (");
                Serial.print(scheduleDuration);
                Serial.println("ms)");
                Serial.print("   UserId: ");
                Serial.println(scheduleUserId);
                Serial.print("   Current UserId: ");
                Serial.println(userId);

                // Check user and time
                if (scheduleUserId == userId)
                {
                    Serial.println("   ✓ UserId matches!");

                    // Convert schedule time to 24-hour format for comparison
                    String scheduleHHMM = "";
                    if (scheduleTime.indexOf("PM") > 0)
                    {
                        // Extract hour and minute from "10:47 PM" format
                        int colonPos = scheduleTime.indexOf(':');
                        int hour = scheduleTime.substring(0, colonPos).toInt();
                        String minute = scheduleTime.substring(colonPos + 1, colonPos + 3);

                        // Convert PM to 24-hour (except 12 PM stays 12)
                        if (hour != 12)
                        {
                            hour += 12;
                        }
                        scheduleHHMM = String(hour) + ":" + minute;
                    }
                    else if (scheduleTime.indexOf("AM") > 0)
                    {
                        // Extract hour and minute from "10:47 AM" format
                        int colonPos = scheduleTime.indexOf(':');
                        int hour = scheduleTime.substring(0, colonPos).toInt();
                        String minute = scheduleTime.substring(colonPos + 1, colonPos + 3);

                        // Convert 12 AM to 00:xx
                        if (hour == 12)
                        {
                            hour = 0;
                        }
                        // Pad single digit hours
                        if (hour < 10)
                        {
                            scheduleHHMM = "0" + String(hour) + ":" + minute;
                        }
                        else
                        {
                            scheduleHHMM = String(hour) + ":" + minute;
                        }
                    }
                    else
                    {
                        // Already in 24-hour format
                        scheduleHHMM = scheduleTime;
                    }

                    Serial.print("   Schedule 24h: ");
                    Serial.print(scheduleHHMM);
                    Serial.print(" vs Current: ");
                    Serial.println(currentTime);

                    if (scheduleHHMM == currentTime)
                    {

                        if (lastExecutedSchedule == scheduleId)
                        {
                            Serial.println("⏭️  Schedule already executed in this minute");
                            continue;
                        }

                        Serial.println("✅ Executing scheduled feeding!");
                        startServo(scheduleDuration);
                        lastExecutedSchedule = scheduleId;
                    }
                    else
                    {
                        Serial.println("   ✗ Time doesn't match");
                    }
                }
                else
                {
                    Serial.println("   ✗ UserId doesn't match");
                }
            }
        }

        if (scheduleCount == 0)
        {
            Serial.println("❌ No feeding schedules found in Firestore response");
        }
    }
    else
    {
        Serial.printf("⚠️  Failed to fetch schedules (HTTP %d)\n", httpCode);
        Serial.print("Error Body: ");
        Serial.println(http.getString());
    }

    http.end();
}

// =================================================================
// ========================= WEB SERVER HANDLERS ===================
// =================================================================

void setupWebServer()
{
    // System info
    server.on("/", HTTP_GET, []()
              {
    StaticJsonDocument<512> doc;
    doc["device"] = "ESP32 Servo Feed System";
    doc["id"] = deviceId;
    doc["version"] = "1.0.0";
    doc["status"] = "online";
    doc["ip"] = WiFi.localIP().toString();
    doc["rssi"] = WiFi.RSSI();
    doc["sensorType"] = "ultrasonic";
    doc["actuatorType"] = "servo";
    
    String response;
    serializeJson(doc, response);
    server.send(200, "application/json", response); });

    // Get feeder level
    server.on("/api/feeder/level", HTTP_GET, handleGetFeederLevel);

    // Get all sensors
    server.on("/api/sensors", HTTP_GET, handleGetSensors);

    // Servo control
    server.on("/api/servo/start", HTTP_POST, handleStartServo);
    server.on("/api/servo/stop", HTTP_POST, handleStopServo);
    server.on("/api/servo/status", HTTP_GET, handleGetServoStatus);

    // Set user ID for schedule checking
    server.on("/api/system/userid", HTTP_POST, handleSetUserId);

    // System restart
    server.on("/api/system/restart", HTTP_POST, []()
              {
    server.send(200, "application/json", "{\"status\":\"restarting\"}");
    delay(500);
    ESP.restart(); });

    // 404
    server.onNotFound([]()
                      { server.send(404, "application/json", "{\"error\":\"Not Found\"}"); });
}

void handleGetFeederLevel()
{
    StaticJsonDocument<256> doc;
    doc["level"] = feederLevel;
    doc["distance"] = distance;
    doc["sensorType"] = "ultrasonic";
    doc["unit"] = "%";
    doc["timestamp"] = millis();
    doc["isSimulated"] = false;

    String response;
    serializeJson(doc, response);
    server.send(200, "application/json", response);
}

void handleGetSensors()
{
    StaticJsonDocument<512> doc;

    JsonObject feeder = doc.createNestedObject("feeder");
    feeder["level"] = feederLevel;
    feeder["distance"] = distance;
    feeder["sensorType"] = "ultrasonic";
    feeder["tankHeight"] = TANK_HEIGHT;
    feeder["tankFull"] = TANK_FULL;
    feeder["tankEmpty"] = TANK_EMPTY;
    feeder["unit"] = "%";
    feeder["isSimulated"] = false;

    JsonObject system = doc.createNestedObject("system");
    system["rssi"] = WiFi.RSSI();
    system["uptime"] = millis() / 1000;
    system["freeHeap"] = ESP.getFreeHeap();

    doc["timestamp"] = millis();
    doc["simulationMode"] = false;

    String response;
    serializeJson(doc, response);
    server.send(200, "application/json", response);
}

void handleStartServo()
{
    unsigned long duration = DEFAULT_DISPENSE_DURATION;

    if (server.hasArg("plain"))
    {
        StaticJsonDocument<200> doc;
        DeserializationError error = deserializeJson(doc, server.arg("plain"));

        if (!error && doc.containsKey("duration"))
        {
            duration = doc["duration"];
        }
    }

    startServo(duration);

    StaticJsonDocument<256> doc;
    doc["status"] = servoActive ? "started" : "failed";
    doc["duration"] = duration;
    doc["feederLevel"] = feederLevel;
    doc["message"] = servoActive ? "Servo started successfully" : "Failed to start servo";

    String response;
    serializeJson(doc, response);
    server.send(200, "application/json", response);
}

void handleStopServo()
{
    stopServo();

    StaticJsonDocument<200> doc;
    doc["status"] = "stopped";
    doc["message"] = "Servo stopped";

    String response;
    serializeJson(doc, response);
    server.send(200, "application/json", response);
}

void handleGetServoStatus()
{
    StaticJsonDocument<256> doc;
    doc["active"] = servoActive;
    doc["feederLevel"] = feederLevel;
    doc["currentAngle"] = servoActive ? SERVO_DISPENSE_ANGLE : SERVO_IDLE_ANGLE;

    if (servoActive)
    {
        doc["elapsedTime"] = millis() - servoStartTime;
        doc["remainingTime"] = servoDuration - (millis() - servoStartTime);
    }
    else
    {
        unsigned long cooldownRemaining = SERVO_COOLDOWN - (millis() - lastServoStop);
        doc["cooldownRemaining"] = (millis() - lastServoStop < SERVO_COOLDOWN) ? cooldownRemaining : 0;
    }

    String response;
    serializeJson(doc, response);
    server.send(200, "application/json", response);
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
