#include <WiFi.h>
#include <WebServer.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <ESP32Servo.h>

// =================================================================
// ============== CONFIGURATION (CRITICAL: CHANGE THESE) ===========
// =================================================================

// WiFi Credentials
const char *WIFI_SSID = "mzkmbp";
const char *WIFI_PASSWORD = "ncmaganda";

// Firebase Configuration (Using API Key and Project ID for REST calls)
const char *FIREBASE_API_KEY = "AIzaSyAOC8S6aOGvfnUzp0Twb-7O727Un9FoUGE";
const char *FIREBASE_PROJECT_ID = "internet-of-tsiken-690dd";

// ========== WATER SYSTEM PINS ==========
const int WATER_TRIGGER_PIN = 25; // HC-SR04 Trigger for water tank (Output)
const int WATER_ECHO_PIN = 26;    // HC-SR04 Echo for water tank (Input)
const int PUMP_PIN = 27;          // Micro water pump control (Output to Relay)

// ========== FEED SYSTEM PINS ==========
const int TRIGGER_PIN = 32; // HC-SR04 Trigger (Output)
const int ECHO_PIN = 33;    // HC-SR04 Echo (Input)
const int SERVO_PIN = 4;    // Servo motor control (PWM)

// ========== SHARED PIN ==========
const int LED_PIN = 2; // Built-in LED

// ========== WATER SENSOR CALIBRATION (Distance in cm) ==========
const float WATER_TANK_HEIGHT = 40.0; // Height of water container (cm) - ADJUST THIS
const float WATER_TANK_EMPTY = 40.0;  // Distance when tank is empty (cm)
const float WATER_TANK_FULL = 5.0;    // Distance when tank is full (cm)
const int WATER_DISTANCE_SAMPLES = 5; // Number of samples to average

// ========== FEED SENSOR CALIBRATION (Distance in cm) ==========
const float TANK_HEIGHT = 30.0; // Height of feeder container (cm) - ADJUST THIS
const float TANK_EMPTY = 30.0;  // Distance when tank is empty (cm)
const float TANK_FULL = 5.0;    // Distance when tank is full (cm)
const int DISTANCE_SAMPLES = 5; // Number of samples to average

// ========== PUMP CONFIGURATION ==========
const int DEFAULT_PUMP_DURATION = 50000; // 5 seconds default
const int MIN_WATER_LEVEL = 20;          // Don't pump if below 20%
const int MAX_PUMP_DURATION = 60000;     // Maximum 60 seconds
const int PUMP_COOLDOWN = 10000;         // 10 seconds between pump cycles

// ========== SERVO CONFIGURATION ==========
const int SERVO_IDLE_ANGLE = 90;            // Servo angle when idle (resting - closed)
const int SERVO_DISPENSE_ANGLE = 45;        // Servo angle when dispensing (open)
const int DEFAULT_DISPENSE_DURATION = 5000; // 5 seconds default
const int MIN_FEEDER_LEVEL = 0;             // Don't dispense if below 0% (disabled for testing)
const int MAX_DISPENSE_DURATION = 5000;     // Maximum 5 seconds
const int SERVO_COOLDOWN = 5000;            // 5 seconds between dispense cycles

// ========== UPDATE INTERVALS ==========
const unsigned long SENSOR_READ_INTERVAL = 5000;     // Read every 5 seconds
const unsigned long SCHEDULE_CHECK_INTERVAL = 10000; // Check schedule every 10 seconds (better timing accuracy)

// =================================================================
// =================== GLOBAL VARIABLES ============================
// =================================================================

WebServer server(80);
HTTPClient http;
Servo feedServo;

// ========== WATER SYSTEM DATA ==========
float waterLevel = 0;
float waterDistance = 0;
bool pumpActive = false;
unsigned long pumpStartTime = 0;
unsigned long pumpDuration = DEFAULT_PUMP_DURATION;
unsigned long lastPumpStop = 0;
String lastExecutedWaterSchedule = "";

// ========== FEED SYSTEM DATA ==========
float feederLevel = 0;
float distance = 0;
bool servoActive = false;
unsigned long servoStartTime = 0;
unsigned long servoDuration = DEFAULT_DISPENSE_DURATION;
unsigned long lastServoStop = 0;
String lastExecutedFeedSchedule = "";

// ========== SHARED DATA ==========
unsigned long lastSensorRead = 0;
unsigned long lastWaterScheduleCheck = 0;
unsigned long lastFeedScheduleCheck = 0;
bool wifiConnected = false;
String deviceId = "";
String userId = ""; // User ID for Firebase queries

// =================================================================
// =================== FORWARD DECLARATIONS ========================
// =================================================================

void setupWebServer();
void connectWiFi();

// Water system functions
void readWaterLevel();
void startPump(unsigned long duration);
void stopPump();
void checkWateringSchedules();

// Feed system functions
void readFeederLevel();
void startServo(int angle, unsigned long duration);
void stopServo();
void checkFeedingSchedules();

// Utility functions
String getDeviceId();
String getCurrentTimeString();
String buildFirestoreQueryUrl();

// Web handlers
void handleRoot();
void handleGetWaterLevel();
void handleGetFeederLevel();
void handleGetSensors();
void handleStartPump();
void handleStopPump();
void handleGetPumpStatus();
void handleStartServo();
void handleStopServo();
void handleGetServoStatus();
void handleSetUserId();

// =================================================================
// ============================= SETUP =============================
// =================================================================

void setup()
{
  Serial.begin(115200);
  delay(100);

  Serial.println("\n\n╔═══════════════════════════════════════════╗");
  Serial.println("║  ESP32 Combined Water & Feed Controller  ║");
  Serial.println("║           (Firestore Enabled)             ║");
  Serial.println("╚═══════════════════════════════════════════╝\n");

  // Initialize water system pins
  pinMode(WATER_TRIGGER_PIN, OUTPUT);
  pinMode(WATER_ECHO_PIN, INPUT);
  pinMode(PUMP_PIN, OUTPUT);
  digitalWrite(PUMP_PIN, LOW);

  // Initialize feed system pins
  pinMode(TRIGGER_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  feedServo.attach(SERVO_PIN);
  feedServo.write(SERVO_IDLE_ANGLE);

  // Initialize shared pins
  pinMode(LED_PIN, OUTPUT);
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

  Serial.println("\n╔═══════════════════════════════════════════╗");
  Serial.println("║            System Ready!                  ║");
  Serial.println("╚═══════════════════════════════════════════╝\n");
}

// =================================================================
// ============================= MAIN LOOP =========================
// =================================================================

void loop()
{
  server.handleClient();

  // Read sensors
  if (millis() - lastSensorRead >= SENSOR_READ_INTERVAL)
  {
    lastSensorRead = millis();
    readWaterLevel();
    readFeederLevel();
  }

  // Check watering schedules (every 60 seconds)
  if (millis() - lastWaterScheduleCheck >= SCHEDULE_CHECK_INTERVAL)
  {
    lastWaterScheduleCheck = millis();
    if (!userId.isEmpty())
    {
      checkWateringSchedules();
    }
  }

  // Check feeding schedules (every 60 seconds, offset by 30 seconds)
  if (millis() - lastFeedScheduleCheck >= SCHEDULE_CHECK_INTERVAL)
  {
    lastFeedScheduleCheck = millis();
    if (!userId.isEmpty())
    {
      checkFeedingSchedules();
    }
  }

  // Auto-stop pump
  if (pumpActive && (millis() - pumpStartTime >= pumpDuration))
  {
    stopPump();
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
// ======================= WATER SYSTEM LOGIC ======================
// =================================================================

void readWaterLevel()
{
  float total = 0;
  int validReadings = 0;

  for (int i = 0; i < WATER_DISTANCE_SAMPLES; i++)
  {
    digitalWrite(WATER_TRIGGER_PIN, LOW);
    delayMicroseconds(2);
    digitalWrite(WATER_TRIGGER_PIN, HIGH);
    delayMicroseconds(10);
    digitalWrite(WATER_TRIGGER_PIN, LOW);

    long duration = pulseIn(WATER_ECHO_PIN, HIGH, 30000);

    if (duration > 0)
    {
      float dist = duration * 0.034 / 2;
      if (dist > 0 && dist < 400)
      {
        total += dist;
        validReadings++;
      }
    }
    delay(50);
  }

  if (validReadings > 0)
  {
    waterDistance = total / validReadings;

    if (waterDistance <= WATER_TANK_FULL)
    {
      waterLevel = 100.0;
    }
    else if (waterDistance >= WATER_TANK_EMPTY)
    {
      waterLevel = 0.0;
    }
    else
    {
      waterLevel = ((WATER_TANK_EMPTY - waterDistance) / (WATER_TANK_EMPTY - WATER_TANK_FULL)) * 100.0;
    }

    waterLevel = constrain(waterLevel, 0, 100);

    Serial.print("💧 Water: ");
    Serial.print(waterLevel);
    Serial.print("% (Distance: ");
    Serial.print(waterDistance);
    Serial.println(" cm)");
  }
  else
  {
    Serial.println("⚠️  Failed to read water ultrasonic sensor");
  }
}

void startPump(unsigned long duration)
{
  if (pumpActive)
  {
    Serial.println("⚠️  Pump already running");
    return;
  }

  if (waterLevel < MIN_WATER_LEVEL)
  {
    Serial.println("⚠️  Water level too low!");
    return;
  }

  if (millis() - lastPumpStop < PUMP_COOLDOWN)
  {
    Serial.println("⚠️  Pump in cooldown period");
    return;
  }

  duration = constrain(duration, 1000, MAX_PUMP_DURATION);

  Serial.println("🚰 Starting pump for " + String(duration / 1000) + "s");
  digitalWrite(PUMP_PIN, HIGH);
  pumpActive = true;
  pumpStartTime = millis();
  pumpDuration = duration;
}

void stopPump()
{
  if (pumpActive)
  {
    Serial.println("⏹️  Stopping pump");
    digitalWrite(PUMP_PIN, LOW);
    pumpActive = false;
    lastPumpStop = millis();
  }
}

// =================================================================
// ======================= FEED SYSTEM LOGIC =======================
// =================================================================

void readFeederLevel()
{
  float total = 0;
  int validReadings = 0;

  for (int i = 0; i < DISTANCE_SAMPLES; i++)
  {
    digitalWrite(TRIGGER_PIN, LOW);
    delayMicroseconds(2);
    digitalWrite(TRIGGER_PIN, HIGH);
    delayMicroseconds(10);
    digitalWrite(TRIGGER_PIN, LOW);

    long duration = pulseIn(ECHO_PIN, HIGH, 30000);

    if (duration > 0)
    {
      float dist = duration * 0.034 / 2;
      if (dist > 0 && dist < 400)
      {
        total += dist;
        validReadings++;
      }
    }
    delay(50);
  }

  if (validReadings > 0)
  {
    distance = total / validReadings;

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

void startServo(int angle, unsigned long duration)
{
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
  angle = constrain(angle, 0, 180);

  Serial.println("🍗 Dispensing feed - Angle: " + String(angle) + "° for " + String(duration / 1000) + "s");
  feedServo.write(angle);
  servoActive = true;
  servoStartTime = millis();
  servoDuration = duration;
}

void stopServo()
{
  if (servoActive)
  {
    Serial.println("⏹️  Stopping feed dispenser");
    feedServo.write(SERVO_IDLE_ANGLE);
    servoActive = false;
    lastServoStop = millis();
  }
}

// =================================================================
// ========================= UTILITIES =============================
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

// =================================================================
// ======================= SCHEDULE CHECKING =======================
// =================================================================

void checkWateringSchedules()
{
  if (!wifiConnected || userId.isEmpty())
    return;

  String currentTime = getCurrentTimeString();
  if (currentTime.isEmpty())
  {
    Serial.println("⏰ Unable to get current time for watering check.");
    return;
  }

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
          int scheduleDuration = fields["duration"]["integerValue"].as<int>() * 1000;
          String scheduleUserId = fields["userId"]["stringValue"].as<String>();
          String documentName = result["document"]["name"].as<String>();
          String scheduleId = documentName.substring(documentName.lastIndexOf('/') + 1);

          if (scheduleUserId == userId)
          {
            String scheduleHHMM = scheduleTime;
            if (scheduleTime.indexOf("PM") > 0 || scheduleTime.indexOf("AM") > 0)
            {
              int colonPos = scheduleTime.indexOf(':');
              int hour = scheduleTime.substring(0, colonPos).toInt();
              String minute = scheduleTime.substring(colonPos + 1, colonPos + 3);

              if (scheduleTime.indexOf("PM") > 0)
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

            if (scheduleHHMM == currentTime && lastExecutedWaterSchedule != scheduleId)
            {
              Serial.println("✅ Executing scheduled watering!");
              startPump(scheduleDuration);
              lastExecutedWaterSchedule = scheduleId;
            }
          }
        }
      }
    }
  }
  http.end();
}

void checkFeedingSchedules()
{
  if (!wifiConnected || userId.isEmpty())
    return;

  String currentTime = getCurrentTimeString();
  if (currentTime.isEmpty())
  {
    Serial.println("⏰ Unable to get current time for feeding check.");
    return;
  }

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
          int scheduleDuration = DEFAULT_DISPENSE_DURATION;
          if (fields.containsKey("duration"))
          {
            scheduleDuration = fields["duration"]["integerValue"].as<int>() * 1000;
          }
          String scheduleUserId = fields["userId"]["stringValue"].as<String>();
          String documentName = result["document"]["name"].as<String>();
          String scheduleId = documentName.substring(documentName.lastIndexOf('/') + 1);

          if (scheduleUserId == userId)
          {
            String scheduleHHMM = scheduleTime;
            if (scheduleTime.indexOf("PM") > 0 || scheduleTime.indexOf("AM") > 0)
            {
              int colonPos = scheduleTime.indexOf(':');
              int hour = scheduleTime.substring(0, colonPos).toInt();
              String minute = scheduleTime.substring(colonPos + 1, colonPos + 3);

              if (scheduleTime.indexOf("PM") > 0)
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

            if (scheduleHHMM == currentTime && lastExecutedFeedSchedule != scheduleId)
            {
              Serial.println("✅ Executing scheduled feeding!");
              startServo(SERVO_DISPENSE_ANGLE, scheduleDuration);
              lastExecutedFeedSchedule = scheduleId;
            }
          }
        }
      }
    }
  }
  http.end();
}

// =================================================================
// ========================= WEB SERVER HANDLERS ===================
// =================================================================

void setupWebServer()
{
  server.on("/", HTTP_GET, handleRoot);
  server.on("/api/water/level", HTTP_GET, handleGetWaterLevel);
  server.on("/api/feeder/level", HTTP_GET, handleGetFeederLevel);
  server.on("/api/sensors", HTTP_GET, handleGetSensors);
  server.on("/api/pump/start", HTTP_POST, handleStartPump);
  server.on("/api/pump/stop", HTTP_POST, handleStopPump);
  server.on("/api/pump/status", HTTP_GET, handleGetPumpStatus);
  server.on("/api/servo/start", HTTP_POST, handleStartServo);
  server.on("/api/servo/stop", HTTP_POST, handleStopServo);
  server.on("/api/servo/status", HTTP_GET, handleGetServoStatus);
  server.on("/api/system/userid", HTTP_POST, handleSetUserId);
  server.on("/api/system/restart", HTTP_POST, []()
            {
    server.send(200, "application/json", "{\"status\":\"restarting\"}");
    delay(500);
    ESP.restart(); });
  server.onNotFound([]()
                    { server.send(404, "application/json", "{\"error\":\"Not Found\"}"); });
}

void handleRoot()
{
  StaticJsonDocument<512> doc;
  doc["device"] = "ESP32 Combined Water & Feed System";
  doc["id"] = deviceId;
  doc["version"] = "2.1.0";
  doc["status"] = "online";
  doc["ip"] = WiFi.localIP().toString();
  doc["rssi"] = WiFi.RSSI();
  doc["waterSystem"] = "ultrasonic sensor";
  doc["feedSystem"] = "ultrasonic + servo";

  String response;
  serializeJson(doc, response);
  server.send(200, "application/json", response);
}

void handleGetWaterLevel()
{
  StaticJsonDocument<256> doc;
  doc["level"] = waterLevel;
  doc["distance"] = waterDistance;
  doc["sensorType"] = "ultrasonic";
  doc["unit"] = "%";
  doc["timestamp"] = millis();
  doc["isSimulated"] = false;

  String response;
  serializeJson(doc, response);
  server.send(200, "application/json", response);
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
  StaticJsonDocument<1024> doc;

  JsonObject water = doc.createNestedObject("water");
  water["level"] = waterLevel;
  water["distance"] = waterDistance;
  water["sensorType"] = "ultrasonic";
  water["unit"] = "%";
  water["isSimulated"] = false;

  JsonObject feeder = doc.createNestedObject("feeder");
  feeder["level"] = feederLevel;
  feeder["distance"] = distance;
  feeder["sensorType"] = "ultrasonic";
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

void handleStartPump()
{
  unsigned long duration = DEFAULT_PUMP_DURATION;
  if (server.hasArg("plain"))
  {
    StaticJsonDocument<200> doc;
    DeserializationError error = deserializeJson(doc, server.arg("plain"));
    if (!error && doc.containsKey("duration"))
    {
      duration = doc["duration"];
    }
  }

  startPump(duration);

  StaticJsonDocument<256> doc;
  doc["status"] = pumpActive ? "started" : "failed";
  doc["duration"] = duration;
  doc["waterLevel"] = waterLevel;
  doc["message"] = pumpActive ? "Pump started successfully" : "Failed to start pump";

  String response;
  serializeJson(doc, response);
  server.send(200, "application/json", response);
}

void handleStopPump()
{
  stopPump();
  StaticJsonDocument<200> doc;
  doc["status"] = "stopped";
  doc["message"] = "Pump stopped";

  String response;
  serializeJson(doc, response);
  server.send(200, "application/json", response);
}

void handleGetPumpStatus()
{
  StaticJsonDocument<256> doc;
  doc["active"] = pumpActive;
  doc["waterLevel"] = waterLevel;

  if (pumpActive)
  {
    doc["elapsedTime"] = millis() - pumpStartTime;
    doc["remainingTime"] = pumpDuration - (millis() - pumpStartTime);
  }
  else
  {
    unsigned long cooldownRemaining = PUMP_COOLDOWN - (millis() - lastPumpStop);
    doc["cooldownRemaining"] = (millis() - lastPumpStop < PUMP_COOLDOWN) ? cooldownRemaining : 0;
  }

  String response;
  serializeJson(doc, response);
  server.send(200, "application/json", response);
}

void handleStartServo()
{
  unsigned long duration = DEFAULT_DISPENSE_DURATION;
  int angle = SERVO_DISPENSE_ANGLE;
  if (server.hasArg("plain"))
  {
    StaticJsonDocument<200> doc;
    DeserializationError error = deserializeJson(doc, server.arg("plain"));
    if (!error)
    {
      if (doc.containsKey("duration"))
      {
        duration = doc["duration"];
      }
      if (doc.containsKey("angle"))
      {
        angle = doc["angle"];
      }
    }
  }

  startServo(angle, duration);

  StaticJsonDocument<256> doc;
  doc["status"] = servoActive ? "started" : "failed";
  doc["duration"] = duration;
  doc["angle"] = angle;
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
