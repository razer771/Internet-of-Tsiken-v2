/**
 * Add Realtime Database Test Data
 *
 * This script adds sample sensor readings to Firebase Realtime Database
 * so the Cloud Functions can process them and calculate averages.
 *
 * Run this script with Node.js:
 * node scripts/addRealtimeTestData.js
 */

const { initializeApp } = require("firebase/app");
const { getDatabase, ref, set, push } = require("firebase/database");

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAOC8S6aOGvfnUzp0Twb-7O727Un9FoUGE",
  authDomain: "internet-of-tsiken-690dd.firebaseapp.com",
  databaseURL: "https://internet-of-tsiken-690dd-default-rtdb.firebaseio.com", // Add your Realtime Database URL
  projectId: "internet-of-tsiken-690dd",
  storageBucket: "internet-of-tsiken-690dd.appspot.com",
  messagingSenderId: "296742448098",
  appId: "1:296742448098:web:8163021d84af262c6527bb",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Test user ID
const TEST_USER_ID = "testUser123";

/**
 * Generate random sensor readings
 */
function generateSensorReading() {
  return {
    temperature: (28 + Math.random() * 8).toFixed(1), // 28-36°C
    humidity: (65 + Math.random() * 20).toFixed(1), // 65-85%
    waterLevel: (70 + Math.random() * 25).toFixed(1), // 70-95%
    feedLevel: (50 + Math.random() * 45).toFixed(1), // 50-95%
    solarCharge: (60 + Math.random() * 35).toFixed(1), // 60-95%
    timestamp: Date.now(),
  };
}

/**
 * Add test data using multi-sensor structure
 */
async function addMultiSensorData() {
  try {
    console.log("Adding multi-sensor test data to Realtime Database...\n");

    const readingsRef = ref(database, `sensorData/${TEST_USER_ID}/readings`);

    // Add 10 sample readings
    for (let i = 0; i < 10; i++) {
      const reading = generateSensorReading();
      const newReadingRef = push(readingsRef);

      await set(newReadingRef, reading);
      console.log(`✓ Reading ${i + 1}/10 added:`, reading);

      // Small delay to simulate real-time data
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    console.log("\n✅ Multi-sensor test data added successfully!");
    console.log(
      "\nIf Cloud Functions are deployed, they will automatically calculate averages."
    );
    console.log('Check Firestore collection "sensorAverages" for results.');
  } catch (error) {
    console.error("❌ Error adding test data:", error);
  }
}

/**
 * Add test data using single-sensor structure
 */
async function addSingleSensorData() {
  try {
    console.log("Adding single-sensor test data to Realtime Database...\n");

    const sensorTypes = [
      "temperature",
      "waterLevel",
      "energy",
      "humidity",
      "feedLevel",
    ];

    for (const sensorType of sensorTypes) {
      console.log(`\nAdding ${sensorType} readings...`);

      // Add 5 readings for each sensor type
      for (let i = 0; i < 5; i++) {
        const timestamp = Date.now() + i;
        const sensorRef = ref(
          database,
          `sensorData/${TEST_USER_ID}/${sensorType}/${timestamp}`
        );

        let value;
        switch (sensorType) {
          case "temperature":
            value = (28 + Math.random() * 8).toFixed(1);
            break;
          case "waterLevel":
          case "feedLevel":
          case "humidity":
            value = (70 + Math.random() * 25).toFixed(1);
            break;
          case "energy":
            value = (80 + Math.random() * 30).toFixed(1);
            break;
          default:
            value = (50 + Math.random() * 50).toFixed(1);
        }

        await set(sensorRef, {
          value: parseFloat(value),
          timestamp: timestamp,
          userId: TEST_USER_ID,
        });

        console.log(`  ✓ Reading ${i + 1}/5: ${value}`);
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    console.log("\n✅ Single-sensor test data added successfully!");
    console.log(
      "\nIf Cloud Functions are deployed, they will automatically calculate averages."
    );
  } catch (error) {
    console.error("❌ Error adding test data:", error);
  }
}

// Main execution
async function main() {
  console.log("=".repeat(60));
  console.log("Firebase Realtime Database - Test Data Generator");
  console.log("=".repeat(60));
  console.log("\nChoose data structure:");
  console.log(
    "1. Multi-sensor readings (recommended for calculateMultiSensorAverages function)"
  );
  console.log(
    "2. Single-sensor readings (for calculateSensorAverages function)"
  );
  console.log("3. Both\n");

  // For automation, we'll add both types
  console.log("Adding both types of test data...\n");

  await addMultiSensorData();
  console.log("\n" + "-".repeat(60) + "\n");
  await addSingleSensorData();

  console.log("\n" + "=".repeat(60));
  console.log("Test data generation complete!");
  console.log("=".repeat(60));

  process.exit(0);
}

main();
