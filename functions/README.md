# Firebase Cloud Functions - Sensor Data Aggregation

Cloud Functions that automatically calculate sensor data averages when new readings are written to Firebase Realtime Database and store the results in Firestore.

## 📋 Overview

This Firebase Cloud Function implementation provides three different approaches for aggregating sensor data:

1. **Per-User Sensor Averages** - Calculate averages for each user's sensors individually
2. **Global Sensor Averages** - Calculate averages across all users for each sensor type
3. **Multi-Sensor Aggregation** - Process multiple sensor types from a single reading

## 🏗️ Architecture

### Realtime Database Structure

**Option 1: Single Sensor Type per Path**

```
/sensorData/
  ├── {userId}/
  │   ├── temperature/
  │   │   ├── {timestamp1}: { value: 32, timestamp: 1701619200000 }
  │   │   └── {timestamp2}: { value: 31.5, timestamp: 1701619260000 }
  │   ├── humidity/
  │   │   ├── {timestamp1}: { value: 78, timestamp: 1701619200000 }
  │   │   └── {timestamp2}: { value: 76, timestamp: 1701619260000 }
  │   └── waterLevel/
  │       └── {timestamp1}: { value: 85, timestamp: 1701619200000 }
```

**Option 2: Multi-Sensor Readings**

```
/sensorData/
  ├── {userId}/
  │   └── readings/
  │       ├── {readingId1}: {
  │       │   temperature: 32,
  │       │   humidity: 78,
  │       │   waterLevel: 85,
  │       │   feedLevel: 62,
  │       │   solarCharge: 62,
  │       │   timestamp: 1701619200000
  │       │ }
  │       └── {readingId2}: { ... }
```

### Firestore Output Structure

**Collection: `sensorAverages`**

Per-User Document (e.g., `user123_temperature`):

```javascript
{
  average: 31.75,
  sensorType: "temperature",
  userId: "user123",
  totalReadings: 100,
  minValue: 28.5,
  maxValue: 35.2,
  updatedAt: Timestamp
}
```

Global Document (e.g., `global_temperature`):

```javascript
{
  average: 30.5,
  sensorType: "temperature",
  scope: "global",
  totalReadings: 500,
  minValue: 20.0,
  maxValue: 40.0,
  updatedAt: Timestamp
}
```

## 🚀 Setup Instructions

### Prerequisites

- Node.js 18 or higher
- Firebase CLI installed globally: `npm install -g firebase-tools`
- Firebase project with Realtime Database and Firestore enabled
- Firebase Admin SDK credentials

### Installation

1. **Navigate to the functions directory:**

   ```bash
   cd functions
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Login to Firebase:**

   ```bash
   firebase login
   ```

4. **Initialize Firebase (if not already done):**
   ```bash
   firebase init functions
   ```

   - Select your project
   - Choose JavaScript or TypeScript
   - Install dependencies

### Configuration

The project is already configured for the Firebase project `internet-of-tsiken-690dd`. The `.firebaserc` file contains:

```json
{
  "projects": {
    "default": "internet-of-tsiken-690dd"
  }
}
```

## 📦 Available Functions

### 1. `calculateSensorAverages`

Calculates per-user averages for individual sensor types.

**Trigger:** `/sensorData/{userId}/{sensorType}/{timestamp}`

**Use Case:** When you store each sensor type in separate paths

**Example:**

```javascript
// Writing data to Realtime Database
const db = getDatabase();
const userId = "user123";
const sensorType = "temperature";
const timestamp = Date.now();

await set(ref(db, `sensorData/${userId}/${sensorType}/${timestamp}`), {
  value: 32.5,
  timestamp: timestamp,
  userId: userId,
});

// Function automatically triggers and saves to Firestore:
// Collection: sensorAverages
// Document: temperature
```

### 2. `calculateGlobalSensorAverages`

Calculates global averages across all users for each sensor type.

**Trigger:** `/sensorData/{userId}/{sensorType}/{timestamp}`

**Use Case:** When you need system-wide statistics

**Output:** Documents named `global_{sensorType}` with aggregated data from all users

### 3. `calculateMultiSensorAverages`

Processes multiple sensor types from a single reading.

**Trigger:** `/sensorData/{userId}/readings/{readingId}`

**Use Case:** When your IoT device sends all sensor values in one update

**Example:**

```javascript
// Writing multi-sensor data
await set(ref(db, `sensorData/${userId}/readings/${readingId}`), {
  temperature: 32,
  humidity: 78,
  waterLevel: 85,
  feedLevel: 62,
  solarCharge: 62,
  timestamp: Date.now(),
});

// Function processes all sensor types and creates separate averages
```

## 🔧 Deployment

### Deploy All Functions

```bash
firebase deploy --only functions
```

### Deploy Specific Function

```bash
# Deploy only the per-user function
firebase deploy --only functions:calculateSensorAverages

# Deploy only the global function
firebase deploy --only functions:calculateGlobalSensorAverages

# Deploy only the multi-sensor function
firebase deploy --only functions:calculateMultiSensorAverages
```

### Deploy to Specific Region

Edit `index.js` and change the region:

```javascript
exports.calculateSensorAverages = onValueWritten(
  {
    ref: "/sensorData/{userId}/{sensorType}/{timestamp}",
    region: "asia-southeast1", // Change to your preferred region
  },
  async (event) => {
    // ...
  }
);
```

Available regions: `us-central1`, `us-east1`, `europe-west1`, `asia-southeast1`, etc.

## 🧪 Testing

### Local Testing with Emulators

1. **Start the Firebase emulators:**

   ```bash
   firebase emulators:start
   ```

2. **Connect your app to the emulators** (add to your React Native app):

   ```javascript
   import { connectDatabaseEmulator } from "firebase/database";
   import { connectFirestoreEmulator } from "firebase/firestore";

   if (__DEV__) {
     connectDatabaseEmulator(database, "localhost", 9000);
     connectFirestoreEmulator(firestore, "localhost", 8080);
   }
   ```

3. **Test writing data:**
   ```javascript
   const db = getDatabase();
   await set(ref(db, "sensorData/testUser/temperature/1234567890"), {
     value: 30,
     timestamp: 1234567890,
     userId: "testUser",
   });
   ```

### View Logs

**Real-time logs:**

```bash
firebase functions:log
```

**Stream logs:**

```bash
firebase functions:log --follow
```

## 📊 Usage Examples

### Example 1: IoT Device Sending Temperature Data

```javascript
import { getDatabase, ref, push, set } from "firebase/database";

async function sendTemperatureReading(userId, temperature) {
  const db = getDatabase();
  const timestamp = Date.now();

  await set(ref(db, `sensorData/${userId}/temperature/${timestamp}`), {
    value: temperature,
    timestamp: timestamp,
    userId: userId,
  });

  console.log("Temperature sent, average will be calculated automatically");
}

// Usage
await sendTemperatureReading("user123", 32.5);
```

### Example 2: Fetching Calculated Averages

```javascript
import { getFirestore, doc, getDoc } from "firebase/firestore";

async function getTemperatureAverage(sensorType) {
  const db = getFirestore();
  const docRef = doc(db, "sensorAverages", sensorType);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    const data = docSnap.data();
    console.log(`Average ${sensorType}:`, data.average);
    console.log(`Total readings:`, data.totalReadings);
    console.log(`Min:`, data.minValue);
    console.log(`Max:`, data.maxValue);
    return data;
  } else {
    console.log("No average calculated yet");
    return null;
  }
}

// Usage
const tempAvg = await getTemperatureAverage("temperature");
```

### Example 3: Multi-Sensor Data from ESP32/Arduino

```javascript
async function sendAllSensorReadings(userId, sensorData) {
  const db = getDatabase();
  const readingRef = ref(db, `sensorData/${userId}/readings`);
  const newReadingRef = push(readingRef);

  await set(newReadingRef, {
    temperature: sensorData.temperature,
    humidity: sensorData.humidity,
    waterLevel: sensorData.waterLevel,
    feedLevel: sensorData.feedLevel,
    solarCharge: sensorData.solarCharge,
    lightStatus: sensorData.lightStatus,
    timestamp: Date.now(),
  });

  console.log("All sensors sent, averages will be calculated");
}

// Usage (e.g., from IoT device HTTP endpoint)
await sendAllSensorReadings("user123", {
  temperature: 32,
  humidity: 78,
  waterLevel: 85,
  feedLevel: 62,
  solarCharge: 62,
  lightStatus: true,
});
```

## 🔐 Security Rules

### Realtime Database Rules

Add these rules to your Firebase Realtime Database:

```json
{
  "rules": {
    "sensorData": {
      "$userId": {
        ".read": "auth != null && auth.uid == $userId",
        ".write": "auth != null && auth.uid == $userId",
        "$sensorType": {
          "$timestamp": {
            ".validate": "newData.hasChildren(['value', 'timestamp']) &&
                         newData.child('value').isNumber() &&
                         newData.child('timestamp').isNumber()"
          }
        }
      }
    }
  }
}
```

### Firestore Security Rules

Add these rules to your Firestore:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /sensorAverages/{document=**} {
      // Anyone authenticated can read averages
      allow read: if request.auth != null;

      // Only Cloud Functions can write
      allow write: if false;
    }
  }
}
```

## 🐛 Troubleshooting

### Function Not Triggering

1. **Check logs:**

   ```bash
   firebase functions:log
   ```

2. **Verify path matches:** Ensure your data path matches the function trigger path exactly

3. **Check permissions:** Ensure the Firebase Admin SDK has the necessary permissions

### High Costs

If you have many sensor readings, consider:

1. **Batching:** Aggregate locally before sending
2. **Throttling:** Use a time-based trigger instead of on every write
3. **Sampling:** Only trigger on every Nth reading

### Optimization: Scheduled Aggregation

Instead of calculating on every write, use a scheduled function:

```javascript
const { onSchedule } = require("firebase-functions/v2/scheduler");

exports.scheduledSensorAverages = onSchedule(
  {
    schedule: "every 1 hours",
    region: "us-central1",
  },
  async (event) => {
    // Calculate averages for all sensor types
    // This runs once per hour instead of on every write
  }
);
```

## 📝 Notes

- **Costs:** Each function invocation costs money. For high-frequency sensors, consider scheduled aggregation
- **Cold Starts:** First invocation may be slow; subsequent calls are faster
- **Concurrency:** Functions automatically scale but may have quota limits
- **Data Retention:** Old sensor readings are kept in Realtime Database; implement cleanup if needed

## 🔗 Integration with Reports Screen

To use these averages in your Reports screen:

```javascript
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../../config/firebaseconfig";

async function fetchSensorAverages(userId) {
  const averages = {};
  const q = query(
    collection(db, "sensorAverages"),
    where("userId", "==", userId)
  );

  const querySnapshot = await getDocs(q);
  querySnapshot.forEach((doc) => {
    const data = doc.data();
    averages[data.sensorType] = data;
  });

  return averages;
}
```

## 📚 Additional Resources

- [Firebase Cloud Functions Documentation](https://firebase.google.com/docs/functions)
- [Realtime Database Documentation](https://firebase.google.com/docs/database)
- [Firestore Documentation](https://firebase.google.com/docs/firestore)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)

## 🤝 Support

For issues or questions:

1. Check Firebase Console logs
2. Review function execution history
3. Test with emulators first
4. Check Firebase status page for outages
