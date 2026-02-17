/**
 * Test Data Script - Add Sensor Averages to Firestore
 *
 * This script adds sample sensor average data to Firestore
 * so you can test the ViewReport component without real sensors.
 *
 * Run this script with Node.js:
 * node scripts/addTestSensorData.js
 */

const { initializeApp } = require("firebase/app");
const {
  getFirestore,
  doc,
  setDoc,
  serverTimestamp,
} = require("firebase/firestore");

// Your Firebase configuration (same as in firebaseconfig.js)
const firebaseConfig = {
  apiKey: "AIzaSyBa6PE0nqkrFAqDm6AT2nIrZmv6qIfgiFM",
  authDomain: "internet-of-tsiken-f0ad4.firebaseapp.com",
  projectId: "internet-of-tsiken-f0ad4",
  storageBucket: "internet-of-tsiken-f0ad4.firebasestorage.app",
  messagingSenderId: "403239833979",
  appId: "1:403239833979:web:7b8656be94583bc45aedde",
  measurementId: "G-LD936L51CP",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Sample sensor data
const sensorData = {
  temperature: {
    average: 31.8,
    sensorType: "temperature",
    totalReadings: 150,
    minValue: 28.5,
    maxValue: 34.2,
  },
  waterLevel: {
    average: 82.5,
    sensorType: "waterLevel",
    totalReadings: 120,
    minValue: 65.0,
    maxValue: 95.0,
  },
  energy: {
    average: 89.3,
    sensorType: "energy",
    totalReadings: 100,
    minValue: 12.7,
    maxValue: 120.5,
  },
  humidity: {
    average: 78.0,
    sensorType: "humidity",
    totalReadings: 150,
    minValue: 68.0,
    maxValue: 85.0,
  },
  feedLevel: {
    average: 62.0,
    sensorType: "feedLevel",
    totalReadings: 110,
    minValue: 45.0,
    maxValue: 98.0,
  },
};

async function addSensorData() {
  try {
    console.log("Starting to add sensor data to Firestore...\n");

    for (const [sensorType, data] of Object.entries(sensorData)) {
      console.log(`Adding ${sensorType} data...`);

      const docRef = doc(db, "sensorAverages", sensorType);

      await setDoc(docRef, {
        ...data,
        updatedAt: new Date(), // Using regular Date since serverTimestamp() works differently in client SDK
      });

      console.log(`✓ ${sensorType} data added successfully`);
    }

    console.log("\n✅ All sensor data has been added to Firestore!");
    console.log(
      "\nYou can now view the Reports screen in your app to see the data.",
    );
    process.exit(0);
  } catch (error) {
    console.error("❌ Error adding sensor data:", error);
    process.exit(1);
  }
}

// Run the function
addSensorData();
