/*
 * PREDATOR DETECTION VALVE CONTROLLER
 *
 * Hardware: Arduino Uno + MOSFET Module (Pin 4)
 * Connection: USB Serial to Raspberry Pi 5
 * Protocol: Receives "OPEN_VALVE" command via Serial
 *
 * Behavior:
 * - Listens for serial commands from Raspberry Pi YOLO detection
 * - When "OPEN_VALVE" received, opens valve for 10 seconds
 * - Prevents multiple activations during valve operation
 * - Built-in LED (Pin 13) lights up when valve is active
 *
 * WIRING:
 *   12V Adapter → MOSFET IN (+) and IN (-)
 *   MOSFET OUT → Solenoid (with flyback diode)
 *   Arduino Pin 4 → MOSFET Signal
 *   Arduino GND → MOSFET GND (shared ground!)
 *
 * MOSFET MODULE TYPE:
 *   Most modules are ACTIVE HIGH (HIGH = ON, LOW = OFF)
 *   If your module is ACTIVE LOW, uncomment the lines marked with // ACTIVE-LOW
 */

const uint8_t VALVE_PIN = 4;
const uint8_t LED_PIN = LED_BUILTIN; // Pin 13 on Arduino Uno
const unsigned long VALVE_OPEN_DURATION_MS = 10000; // 10 seconds

bool isValveActive = false;
unsigned long valveStartTime = 0;

void setup() {
  Serial.begin(115200);

  // Configure valve pin
  pinMode(VALVE_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);

  // ACTIVE HIGH (most common): LOW = closed
  digitalWrite(VALVE_PIN, LOW); // Default: CLOSED
  digitalWrite(LED_PIN, LOW); // LED off

  // ACTIVE LOW (uncomment if valve behavior is reversed):
  // digitalWrite(VALVE_PIN, HIGH); // Default: CLOSED

  Serial.println("==============================================");
  Serial.println("  PREDATOR DETECTION VALVE CONTROLLER");
  Serial.println("  Pin 4 | 10s Duration | Serial Control");
  Serial.println("==============================================");
  Serial.println("System ready. Waiting for OPEN_VALVE command...");
}

void loop() {
  // Check for incoming serial commands
  if (Serial.available() > 0) {
    String command = Serial.readStringUntil('\n');
    command.trim(); // Remove whitespace/newlines

    if (command == "OPEN_VALVE") {
      if (!isValveActive) {
        openValve();
      } else {
        Serial.println("REJECTED: Valve already active");
      }
    } else if (command == "STATUS") {
      reportStatus();
    } else {
      Serial.print("UNKNOWN COMMAND: ");
      Serial.println(command);
    }
  }

  // Auto-close valve after duration
  if (isValveActive && (millis() - valveStartTime >= VALVE_OPEN_DURATION_MS)) {
    closeValve();
  }
}

void openValve() {
  // ACTIVE HIGH (most common): HIGH = open
  digitalWrite(VALVE_PIN, HIGH); // MOSFET ON = Valve OPEN
  digitalWrite(LED_PIN, HIGH); // LED ON (visual confirmation)

  // ACTIVE LOW (uncomment if valve behavior is reversed):
  // digitalWrite(VALVE_PIN, LOW); // MOSFET ON = Valve OPEN

  isValveActive = true;
  valveStartTime = millis();

  Serial.println(">>> VALVE OPENED <<<");
  Serial.print("Duration: ");
  Serial.print(VALVE_OPEN_DURATION_MS / 1000);
  Serial.println(" seconds");
}

void closeValve() {
  // ACTIVE HIGH (most common): LOW = closed
  digitalWrite(VALVE_PIN, LOW); // MOSFET OFF = Valve CLOSED
  digitalWrite(LED_PIN, LOW); // LED OFF

  // ACTIVE LOW (uncomment if valve behavior is reversed):
  // digitalWrite(VALVE_PIN, HIGH); // MOSFET OFF = Valve CLOSED

  isValveActive = false;

  Serial.println(">>> VALVE CLOSED <<<");
  Serial.println("Ready for next command.");
}

void reportStatus() {
  Serial.print("Valve Status: ");
  Serial.println(isValveActive ? "OPEN" : "CLOSED");

  if (isValveActive) {
    unsigned long elapsed = millis() - valveStartTime;
    unsigned long remaining = VALVE_OPEN_DURATION_MS - elapsed;
    Serial.print("Time remaining: ");
    Serial.print(remaining / 1000);
    Serial.println(" seconds");
  }
}
