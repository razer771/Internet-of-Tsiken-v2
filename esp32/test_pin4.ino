/*
 * TEST CODE - Pin 4 Signal Test
 * This code toggles Pin 4 HIGH/LOW every 2 seconds
 * Use a multimeter or LED to verify signal is working
 */

const uint8_t TEST_PIN = 4;

void setup() {
  Serial.begin(115200);
  pinMode(TEST_PIN, OUTPUT);
  Serial.println("Pin 4 Test - Toggling every 2 seconds");
  Serial.println("Use multimeter on Pin 4 to verify:");
  Serial.println("HIGH = ~5V, LOW = 0V");
}

void loop() {
  Serial.println("Pin 4 → HIGH (5V)");
  digitalWrite(TEST_PIN, HIGH);
  delay(2000);

  Serial.println("Pin 4 → LOW (0V)");
  digitalWrite(TEST_PIN, LOW);
  delay(2000);
}
