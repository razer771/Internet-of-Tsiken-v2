/**
 * Cloud Functions for Firebase - Sensor Data Aggregation
 *
 * This function listens to changes in the Realtime Database under the "sensorData" path.
 * When a new sensor reading is written, it:
 * 1. Identifies the sensor type from the data structure
 * 2. Fetches all values for that sensor type
 * 3. Computes the average
 * 4. Saves the result to Firestore in the "sensorAverages" collection
 *
 * Realtime Database Structure Expected:
 * /sensorData/{userId}/{sensorType}/{timestamp}
 * Example: /sensorData/user123/temperature/1701619200000
 *
 * Each sensor reading should contain:
 * {
 *   value: number,
 *   timestamp: number,
 *   userId: string
 * }
 */

const { onValueWritten } = require("firebase-functions/v2/database");
const { initializeApp } = require("firebase-admin/app");
const { getDatabase } = require("firebase-admin/database");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

// Initialize Firebase Admin
initializeApp();

const db = getFirestore();
const rtdb = getDatabase();

/**
 * Cloud Function triggered when sensor data is written to Realtime Database
 * Path pattern: /sensorData/{userId}/{sensorType}/{timestamp}
 */
exports.calculateSensorAverages = onValueWritten(
  {
    ref: "/sensorData/{userId}/{sensorType}/{timestamp}",
    region: "us-central1", // Change to your preferred region
  },
  async (event) => {
    try {
      // Extract path parameters
      const { userId, sensorType, timestamp } = event.params;

      console.log(
        `Processing sensor data: userId=${userId}, sensorType=${sensorType}, timestamp=${timestamp}`
      );

      // Get the data that was written
      const newData = event.data.after.val();

      // If data was deleted (null), skip processing
      if (!newData) {
        console.log("Data was deleted, skipping average calculation");
        return null;
      }

      // Fetch all sensor readings for this sensor type and user
      const sensorRef = rtdb.ref(`/sensorData/${userId}/${sensorType}`);
      const snapshot = await sensorRef.once("value");

      if (!snapshot.exists()) {
        console.log(`No data found for sensor type: ${sensorType}`);
        return null;
      }

      // Calculate average from all readings
      const readings = snapshot.val();
      const values = Object.values(readings)
        .filter((reading) => reading && typeof reading.value === "number")
        .map((reading) => reading.value);

      if (values.length === 0) {
        console.log(`No valid numeric values found for ${sensorType}`);
        return null;
      }

      const sum = values.reduce((acc, val) => acc + val, 0);
      const average = sum / values.length;

      console.log(
        `Calculated average for ${sensorType}: ${average} (from ${values.length} readings)`
      );

      // Save to Firestore sensorAverages collection
      const docRef = db.collection("sensorAverages").doc(sensorType);

      await docRef.set({
        average: parseFloat(average.toFixed(2)), // Round to 2 decimal places
        sensorType: sensorType,
        userId: userId,
        totalReadings: values.length,
        minValue: Math.min(...values),
        maxValue: Math.max(...values),
        updatedAt: FieldValue.serverTimestamp(),
      });

      console.log(`Successfully saved average for ${sensorType} to Firestore`);

      return {
        success: true,
        sensorType,
        average: average.toFixed(2),
        totalReadings: values.length,
      };
    } catch (error) {
      console.error("Error calculating sensor averages:", error);
      throw error;
    }
  }
);

/**
 * Alternative function for global sensor averages (all users)
 * Path pattern: /sensorData/{userId}/{sensorType}/{timestamp}
 * This calculates averages across ALL users for each sensor type
 */
exports.calculateGlobalSensorAverages = onValueWritten(
  {
    ref: "/sensorData/{userId}/{sensorType}/{timestamp}",
    region: "us-central1",
  },
  async (event) => {
    try {
      const { sensorType } = event.params;

      console.log(`Processing global average for sensor type: ${sensorType}`);

      const newData = event.data.after.val();

      if (!newData) {
        console.log("Data was deleted, skipping global average calculation");
        return null;
      }

      // Fetch all sensor readings for this sensor type across all users
      const allUsersRef = rtdb.ref("/sensorData");
      const snapshot = await allUsersRef.once("value");

      if (!snapshot.exists()) {
        console.log("No sensor data found in database");
        return null;
      }

      const allUserData = snapshot.val();
      const allValues = [];

      // Iterate through all users and collect values for this sensor type
      Object.keys(allUserData).forEach((userId) => {
        const userData = allUserData[userId];
        if (userData[sensorType]) {
          const sensorReadings = userData[sensorType];
          Object.values(sensorReadings).forEach((reading) => {
            if (reading && typeof reading.value === "number") {
              allValues.push(reading.value);
            }
          });
        }
      });

      if (allValues.length === 0) {
        console.log(`No valid values found globally for ${sensorType}`);
        return null;
      }

      const sum = allValues.reduce((acc, val) => acc + val, 0);
      const average = sum / allValues.length;

      console.log(
        `Global average for ${sensorType}: ${average} (from ${allValues.length} readings)`
      );

      // Save to Firestore with "global_" prefix
      const docRef = db
        .collection("sensorAverages")
        .doc(`global_${sensorType}`);

      await docRef.set({
        average: parseFloat(average.toFixed(2)),
        sensorType: sensorType,
        scope: "global",
        totalReadings: allValues.length,
        minValue: Math.min(...allValues),
        maxValue: Math.max(...allValues),
        updatedAt: FieldValue.serverTimestamp(),
      });

      console.log(`Successfully saved global average for ${sensorType}`);

      return {
        success: true,
        sensorType,
        average: average.toFixed(2),
        totalReadings: allValues.length,
      };
    } catch (error) {
      console.error("Error calculating global sensor averages:", error);
      throw error;
    }
  }
);

/**
 * Multi-sensor type aggregation function
 * Handles multiple sensor types in a single update
 * Path: /sensorData/{userId}/readings/{readingId}
 *
 * Expected data structure:
 * {
 *   temperature: 32,
 *   humidity: 78,
 *   waterLevel: 85,
 *   feedLevel: 62,
 *   solarCharge: 62,
 *   timestamp: 1701619200000
 * }
 */
exports.calculateMultiSensorAverages = onValueWritten(
  {
    ref: "/sensorData/{userId}/readings/{readingId}",
    region: "us-central1",
  },
  async (event) => {
    try {
      const { userId, readingId } = event.params;

      console.log(
        `Processing multi-sensor reading: userId=${userId}, readingId=${readingId}`
      );

      const newData = event.data.after.val();

      if (!newData) {
        console.log("Data was deleted, skipping processing");
        return null;
      }

      // Define sensor types to process (exclude timestamp and metadata fields)
      const excludedFields = [
        "timestamp",
        "userId",
        "readingId",
        "deviceId",
        "location",
      ];
      const sensorTypes = Object.keys(newData).filter(
        (key) => !excludedFields.includes(key)
      );

      if (sensorTypes.length === 0) {
        console.log("No sensor data fields found");
        return null;
      }

      console.log(`Found ${sensorTypes.length} sensor types:`, sensorTypes);

      // Process each sensor type
      const results = await Promise.all(
        sensorTypes.map(async (sensorType) => {
          try {
            // Fetch all readings for this user
            const readingsRef = rtdb.ref(`/sensorData/${userId}/readings`);
            const snapshot = await readingsRef.once("value");

            if (!snapshot.exists()) {
              return { sensorType, error: "No readings found" };
            }

            const allReadings = snapshot.val();
            const values = Object.values(allReadings)
              .filter(
                (reading) => reading && typeof reading[sensorType] === "number"
              )
              .map((reading) => reading[sensorType]);

            if (values.length === 0) {
              return { sensorType, error: "No valid values" };
            }

            const sum = values.reduce((acc, val) => acc + val, 0);
            const average = sum / values.length;

            // Save to Firestore
            const docRef = db
              .collection("sensorAverages")
              .doc(`${userId}_${sensorType}`);

            await docRef.set({
              average: parseFloat(average.toFixed(2)),
              sensorType: sensorType,
              userId: userId,
              totalReadings: values.length,
              minValue: Math.min(...values),
              maxValue: Math.max(...values),
              updatedAt: FieldValue.serverTimestamp(),
            });

            console.log(
              `Saved average for ${sensorType}: ${average.toFixed(2)}`
            );

            return {
              sensorType,
              average: average.toFixed(2),
              totalReadings: values.length,
            };
          } catch (error) {
            console.error(`Error processing ${sensorType}:`, error);
            return { sensorType, error: error.message };
          }
        })
      );

      console.log("Multi-sensor processing complete:", results);

      return {
        success: true,
        userId,
        processedSensors: results.filter((r) => !r.error),
        errors: results.filter((r) => r.error),
      };
    } catch (error) {
      console.error("Error in multi-sensor average calculation:", error);
      throw error;
    }
  }
);
