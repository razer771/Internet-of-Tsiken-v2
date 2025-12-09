/*
 * ESP32 Water Level & Micro Water Pump Controller
 * Internet-of-Tsiken-v2
 * * NOTE: THIS CODE IS CONFIGURED FOR FIREBASE FIRESTORE.
 * - Only schedule checking (GET) is implemented using the Firestore REST API.
 * - Sensor updates (PUT/POST) are DISABLED because they require a complex Firestore rewrite.
 * * * Features:
 * - Water level monitoring via analog water sensor
 * - Micro water pump control
 * - HTTP REST API for local mobile app control
 * - Firebase Firestore schedule checking.
 * * * Pins:
 * - Water Sensor: GPIO 34 (ADC1_CH6)
 * - Pump Control: GPIO 23 (Connects to Relay IN)
 * - Status LED: GPIO 2 (built-in)
 */

#include <WiFi.h>
#include <WebServer.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>

// =================================================================
// ============== CONFIGURATION (CRITICAL: CHANGE THESE) ===========
// =================================================================

// WiFi Credentials
const char* WIFI_SSID = "DESKTOP-PO2GELH 2223";
const char* WIFI_PASSWORD = "3@1y9K87";

// Firebase Configuration (Using API Key and Project ID for REST calls)
const char* FIREBASE_API_KEY = "AIzaSyAOC8S6aOGvfnUzp0Twb-7O727Un9FoUGE";
const char* FIREBASE_PROJECT_ID = "internet-of-tsiken-690dd"; 

// Pin Definitions
const int WATER_SENSOR_PIN = 34;    // Analog water level sensor (Input)
const int PUMP_PIN = 23;            // Micro water pump control (Output to Relay)
const int LED_PIN = 2;              // Built-in LED

// Water Sensor Calibration
const int WATER_SENSOR_MIN = 0;     // ADC value when tank is empty
const int WATER_SENSOR_MAX = 4095;  // ADC value when tank is full
const int ADC_SAMPLES = 10;         // Number of samples to average

// Pump Configuration
const int DEFAULT_PUMP_DURATION = 5000;    // 5 seconds default
const int MIN_WATER_LEVEL = 20;            // Don't pump if below 20%
const int MAX_PUMP_DURATION = 60000;       // Maximum 60 seconds
const int PUMP_COOLDOWN = 10000;           // 10 seconds between pump cycles

// Update Intervals
const unsigned long SENSOR_READ_INTERVAL = 2000;       // Read every 2 seconds
const unsigned long FIREBASE_UPDATE_INTERVAL = 30000;  // Update Firebase every 30 seconds
const unsigned long SCHEDULE_CHECK_INTERVAL = 60000;   // Check schedule every 60 seconds

// =================================================================
// =================== GLOBAL VARIABLES & FORWARD DECLARATIONS =====
// =================================================================

WebServer server(80);
HTTPClient http;

// Sensor data
float waterLevel = 0;
int rawSensorValue = 0;
unsigned long lastSensorRead = 0;
unsigned long lastFirebaseUpdate = 0;

// Pump control
bool pumpActive = false;
unsigned long pumpStartTime = 0;
unsigned long pumpDuration = DEFAULT_PUMP_DURATION;
unsigned long lastPumpStop = 0;

// Scheduled watering
unsigned long lastScheduleCheck = 0;
String lastExecutedSchedule = "";   // Track last executed schedule to prevent duplicates

// System status
bool wifiConnected = false;
String deviceId = "";
String userId = "";  // User ID for Firebase queries

// Forward declarations
void setupWebServer();
void connectWiFi(); // <-- THIS WAS MISSING ITS DEFINITION
void readWaterLevel();
void startPump(unsigned long duration);
void stopPump();
void updateFirebase();
void logPumpActivity(String action, unsigned long duration);
void checkWateringSchedules();
String getDeviceId();
String getCurrentTimeString();
String buildFirestoreQueryUrl(); 
void handleGetWaterLevel();
void handleGetSensors();
void handleStartPump();
void handleStopPump();
void handleGetPumpStatus();
void handleSetUserId();
void logScheduledExecution(String scheduleId, String scheduleTime, unsigned long duration);

// =================================================================
// ============================= SETUP =============================
// =================================================================

void setup() {
  Serial.begin(115200);
  delay(100);
  
  Serial.println("\n\n╔═══════════════════════════════════╗");
  Serial.println("║  ESP32 Water Pump Controller (Firestore)  ║");
  Serial.println("╚═══════════════════════════════════╝\n");
  
  // Initialize pins
  pinMode(WATER_SENSOR_PIN, INPUT);
  pinMode(PUMP_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);
  
  // Configure ADC
  analogReadResolution(12);     
  analogSetAttenuation(ADC_11db); 
  
  // Ensure pump is OFF
  digitalWrite(PUMP_PIN, LOW);
  digitalWrite(LED_PIN, LOW);
  
  // Generate device ID
  deviceId = getDeviceId();
  Serial.println("Device ID: " + deviceId);
  
  // Connect to WiFi
  connectWiFi(); // <--- Function call is here
  
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
  while (!getLocalTime(&timeinfo) && retries < 20) {
    Serial.print(".");
    delay(500);
    retries++;
  }
  
  if (retries < 20) {
    Serial.println("\n✓ Time synced successfully!");
    char timeStr[64];
    strftime(timeStr, sizeof(timeStr), "%Y-%m-%d %H:%M:%S", &timeinfo);
    Serial.println("Current time: " + String(timeStr));
  } else {
    Serial.println("\n⚠️  Time sync timeout - schedules may not work until time is synced");
  }
  
  Serial.println("╔═══════════════════════════════════╗");
  Serial.println("║          System Ready!            ║");
  Serial.println("╚═══════════════════════════════════╝\n");
}

// =================================================================
// ============================= MAIN LOOP =========================
// =================================================================

void loop() {
  server.handleClient();
  
  // Read water sensor
  if (millis() - lastSensorRead >= SENSOR_READ_INTERVAL) {
    lastSensorRead = millis();
    readWaterLevel();
  }
  
  /* * FIREBASE UPDATE IS DISABLED: 
   * Must be completely rewritten for Firestore's Document PATCH API. 
   */
  // if (millis() - lastFirebaseUpdate >= FIREBASE_UPDATE_INTERVAL) {
  //   lastFirebaseUpdate = millis();
  //   updateFirebase();
  // }
  
  // Check watering schedules
  if (millis() - lastScheduleCheck >= SCHEDULE_CHECK_INTERVAL) {
    lastScheduleCheck = millis();
    if (!userId.isEmpty()) {
      checkWateringSchedules(); // This uses the Firestore Query API
    }
  }
  
  // Auto-stop pump
  if (pumpActive && (millis() - pumpStartTime >= pumpDuration)) {
    stopPump();
  }
  
  // WiFi status LED
  if (wifiConnected) {
    static unsigned long lastBlink = 0;
    if (millis() - lastBlink > 2000) {
      digitalWrite(LED_PIN, !digitalRead(LED_PIN));
      lastBlink = millis();
    }
  }
}

// =================================================================
// ======================= CONNECTION FUNCTION (FIXED) =============
// =================================================================

void connectWiFi() {
  Serial.print("Connecting to WiFi: ");
  Serial.println(WIFI_SSID);
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    wifiConnected = true;
    Serial.println("\n✓ WiFi Connected!");
    Serial.print("  IP Address: ");
    Serial.println(WiFi.localIP());
    Serial.print("  Signal: ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm\n");
  } else {
    wifiConnected = false;
    Serial.println("\n✗ WiFi Connection Failed!\n");
  }
}

// =================================================================
// ======================= SENSOR & PUMP LOGIC =====================
// =================================================================

void readWaterLevel() {
  long total = 0;
  for (int i = 0; i < ADC_SAMPLES; i++) {
    total += analogRead(WATER_SENSOR_PIN);
    delay(10);
  }
  rawSensorValue = total / ADC_SAMPLES;
  
  waterLevel = map(rawSensorValue, WATER_SENSOR_MIN, WATER_SENSOR_MAX, 0, 100);
  waterLevel = constrain(waterLevel, 0, 100);
  
  Serial.print("💧 Water: ");
  Serial.print(waterLevel);
  Serial.print("% (ADC: ");
  Serial.print(rawSensorValue);
  Serial.println(")");
}

void startPump(unsigned long duration) {
  // Safety checks
  if (pumpActive) {
    Serial.println("⚠️  Pump already running");
    return;
  }
  
  if (waterLevel < MIN_WATER_LEVEL) {
    Serial.println("⚠️  Water level too low!");
    return;
  }
  
  if (millis() - lastPumpStop < PUMP_COOLDOWN) {
    Serial.println("⚠️  Pump in cooldown period");
    return;
  }
  
  duration = constrain(duration, 1000, MAX_PUMP_DURATION);
  
  Serial.println("🚰 Starting pump for " + String(duration / 1000) + "s");
  digitalWrite(PUMP_PIN, HIGH); 
  pumpActive = true;
  pumpStartTime = millis();
  pumpDuration = duration;
  
  // logPumpActivity("started", duration); // DISABLED
}

void stopPump() {
  if (pumpActive) {
    Serial.println("⏹️  Stopping pump");
    digitalWrite(PUMP_PIN, LOW); 
    pumpActive = false;
    lastPumpStop = millis();
    
    // logPumpActivity("stopped", actualDuration); // DISABLED
  }
}

// =================================================================
// ========================= UTILITIES & FIRESTORE HTTP ============
// =================================================================

String getDeviceId() {
  uint8_t mac[6];
  WiFi.macAddress(mac);
  char macStr[18];
  sprintf(macStr, "%02X%02X%02X%02X%02X%02X", 
           mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
  return String(macStr);
}

String getCurrentTimeString() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    Serial.println("⚠️  Unable to get current time. Check WiFi sync.");
    // Try to re-sync time
    configTime(8 * 3600, 0, "pool.ntp.org", "time.nist.gov");
    delay(1000);
    if (!getLocalTime(&timeinfo)) {
      return "";  // Still failed
    }
  }
  
  char timeStr[6];
  sprintf(timeStr, "%02d:%02d", timeinfo.tm_hour, timeinfo.tm_min);
  return String(timeStr);
}

// Helper function to build the Firestore Structured Query URL
String buildFirestoreQueryUrl() {
  // Format: https://firestore.googleapis.com/v1/projects/[PROJECT_ID]/databases/(default)/documents:runQuery?key=[API_KEY]
  return "https://firestore.googleapis.com/v1/projects/" + String(FIREBASE_PROJECT_ID) + "/databases/(default)/documents:runQuery?key=" + String(FIREBASE_API_KEY);
}

// These functions are DISABLED as they require a full rewrite for the Firestore Document API.
void updateFirebase() { /* Function Disabled */ }
void logPumpActivity(String action, unsigned long duration) { /* Function Disabled */ }
void logScheduledExecution(String scheduleId, String scheduleTime, unsigned long duration) { /* Function Disabled */ }


// =================================================================
// ======================= SCHEDULED WATERING (FIRESTORE) ==========
// =================================================================

void checkWateringSchedules() {
  if (!wifiConnected || userId.isEmpty()) return;
  
  String currentTime = getCurrentTimeString();
  if (currentTime.isEmpty()) {
    Serial.println("⏰ Unable to get current time. Check WiFi sync.");
    return;
  }
  
  Serial.print("📅 Checking Firestore schedules at ");
  Serial.println(currentTime);
  
  // 1. Build the Firestore Structured Query URL
  String url = buildFirestoreQueryUrl();
  
  // 2. Build the JSON Structured Query Payload (Selects all documents in the collection)
  DynamicJsonDocument queryDoc(512); 
  queryDoc["structuredQuery"]["from"][0]["collectionId"] = "wateringSchedules";

  String queryPayload;
  serializeJson(queryDoc, queryPayload);
  
  // 3. Send POST request to run the query
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  Serial.println("Query Payload: " + queryPayload); // Debug Query Payload
  
  int httpCode = http.POST(queryPayload);
  
  if (httpCode == HTTP_CODE_OK) {
    String payload = http.getString();
    Serial.println("Firestore Query Success.");
    
    // DEBUG: Print response
    Serial.println("📦 Firestore Response:");
    Serial.println(payload);
    
    // Firestore query results are returned as a JSON array
    DynamicJsonDocument doc(4096); 
    DeserializationError error = deserializeJson(doc, payload);
    
    if (error) {
      Serial.println("❌ Failed to parse Firestore schedules response");
      Serial.print("Parse error: ");
      Serial.println(error.c_str());
      http.end();
      return;
    }
    
    // Count schedules
    int scheduleCount = 0;
    
    // Iterate through the array of results
    for (JsonObject result : doc.as<JsonArray>()) {
      scheduleCount++;
      Serial.print("📋 Schedule #");
      Serial.println(scheduleCount);
      
      // Check if the result is a valid document 
      if (result.containsKey("document")) {
        JsonObject fields = result["document"]["fields"];
        
        // Extract data using Firestore's nested structure
        String scheduleTime = fields["time"]["stringValue"].as<String>();
        int scheduleDuration = fields["duration"]["integerValue"].as<int>() | 0;
        // Convert seconds to milliseconds
        scheduleDuration = scheduleDuration * 1000;
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
        if (scheduleUserId == userId) {
          Serial.println("   ✓ UserId matches!");
          
          // Convert schedule time to 24-hour format for comparison
          String scheduleHHMM = "";
          if (scheduleTime.indexOf("PM") > 0) {
            // Extract hour and minute from "10:47 PM" format
            int colonPos = scheduleTime.indexOf(':');
            int hour = scheduleTime.substring(0, colonPos).toInt();
            String minute = scheduleTime.substring(colonPos + 1, colonPos + 3);
            
            // Convert PM to 24-hour (except 12 PM stays 12)
            if (hour != 12) {
              hour += 12;
            }
            scheduleHHMM = String(hour) + ":" + minute;
          } else if (scheduleTime.indexOf("AM") > 0) {
            // Extract hour and minute from "10:47 AM" format
            int colonPos = scheduleTime.indexOf(':');
            int hour = scheduleTime.substring(0, colonPos).toInt();
            String minute = scheduleTime.substring(colonPos + 1, colonPos + 3);
            
            // Convert 12 AM to 00:xx
            if (hour == 12) {
              hour = 0;
            }
            // Pad single digit hours
            if (hour < 10) {
              scheduleHHMM = "0" + String(hour) + ":" + minute;
            } else {
              scheduleHHMM = String(hour) + ":" + minute;
            }
          } else {
            // Already in 24-hour format
            scheduleHHMM = scheduleTime;
          }
          
          Serial.print("   Schedule 24h: ");
          Serial.print(scheduleHHMM);
          Serial.print(" vs Current: ");
          Serial.println(currentTime);
          
          if (scheduleHHMM == currentTime) {
            
            if (lastExecutedSchedule == scheduleId) {
              Serial.println("⏭️  Schedule already executed in this minute");
              continue;
            }
            
            Serial.println("✅ Executing scheduled watering!");
            startPump(scheduleDuration);
            lastExecutedSchedule = scheduleId;
          } else {
            Serial.println("   ✗ Time doesn't match");
          }
        } else {
          Serial.println("   ✗ UserId doesn't match");
        }
      }
    }
    
    if (scheduleCount == 0) {
      Serial.println("❌ No schedules found in Firestore response");
    }
  } else {
    Serial.printf("⚠️  Failed to fetch schedules (HTTP %d)\n", httpCode);
    Serial.print("Error Body: ");
    Serial.println(http.getString());
  }
  
  http.end();
}

// =================================================================
// ========================= WEB SERVER HANDLERS ===================
// =================================================================

void setupWebServer() {
  // System info
  server.on("/", HTTP_GET, []() {
    StaticJsonDocument<512> doc;
    doc["device"] = "ESP32 Water System";
    doc["id"] = deviceId;
    doc["version"] = "1.0.0";
    doc["status"] = "online";
    doc["ip"] = WiFi.localIP().toString();
    doc["rssi"] = WiFi.RSSI();
    doc["sensorType"] = "analog";
    doc["pumpType"] = "micro";
    
    String response;
    serializeJson(doc, response);
    server.send(200, "application/json", response);
  });
  
  // Get water level
  server.on("/api/water/level", HTTP_GET, handleGetWaterLevel);
  
  // Get all sensors
  server.on("/api/sensors", HTTP_GET, handleGetSensors);
  
  // Pump control
  server.on("/api/pump/start", HTTP_POST, handleStartPump);
  server.on("/api/pump/stop", HTTP_POST, handleStopPump);
  server.on("/api/pump/status", HTTP_GET, handleGetPumpStatus);
  
  // Set user ID for schedule checking
  server.on("/api/system/userid", HTTP_POST, handleSetUserId);
  
  // System restart
  server.on("/api/system/restart", HTTP_POST, []() {
    server.send(200, "application/json", "{\"status\":\"restarting\"}");
    delay(500);
    ESP.restart();
  });
  
  // 404
  server.onNotFound([]() {
    server.send(404, "application/json", "{\"error\":\"Not Found\"}");
  });
}

void handleGetWaterLevel() {
  StaticJsonDocument<256> doc;
  doc["level"] = waterLevel;
  doc["sensorValue"] = rawSensorValue;
  doc["sensorType"] = "analog";
  doc["unit"] = "%";
  doc["timestamp"] = millis();
  doc["isSimulated"] = false;
  
  String response;
  serializeJson(doc, response);
  server.send(200, "application/json", response);
}

void handleGetSensors() {
  StaticJsonDocument<512> doc;
  
  JsonObject water = doc.createNestedObject("water");
  water["level"] = waterLevel;
  water["sensorValue"] = rawSensorValue;
  water["sensorType"] = "analog";
  water["minValue"] = WATER_SENSOR_MIN;
  water["maxValue"] = WATER_SENSOR_MAX;
  water["unit"] = "%";
  water["isSimulated"] = false;
  
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

void handleStartPump() {
  unsigned long duration = DEFAULT_PUMP_DURATION;
  
  if (server.hasArg("plain")) {
    StaticJsonDocument<200> doc;
    DeserializationError error = deserializeJson(doc, server.arg("plain"));
    
    if (!error && doc.containsKey("duration")) {
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

void handleStopPump() {
  stopPump();
  
  StaticJsonDocument<200> doc;
  doc["status"] = "stopped";
  doc["message"] = "Pump stopped";
  
  String response;
  serializeJson(doc, response);
  server.send(200, "application/json", response);
}

void handleGetPumpStatus() {
  StaticJsonDocument<256> doc;
  doc["active"] = pumpActive;
  doc["waterLevel"] = waterLevel;
  
  if (pumpActive) {
    doc["elapsedTime"] = millis() - pumpStartTime;
    doc["remainingTime"] = pumpDuration - (millis() - pumpStartTime);
  } else {
    unsigned long cooldownRemaining = PUMP_COOLDOWN - (millis() - lastPumpStop);
    doc["cooldownRemaining"] = (millis() - lastPumpStop < PUMP_COOLDOWN) ? cooldownRemaining : 0;
  }
  
  String response;
  serializeJson(doc, response);
  server.send(200, "application/json", response);
}

void handleSetUserId() {
  if (server.hasArg("plain")) {
    StaticJsonDocument<200> doc;
    DeserializationError error = deserializeJson(doc, server.arg("plain"));
    
    if (!error && doc.containsKey("userId")) {
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