# Test Data Scripts

Scripts to add sample sensor data to Firebase for testing without physical sensors.

## Quick Start - Add Test Data to Firestore Directly

The **easiest way** to test the ViewReport screen is to add data directly to Firestore:

### Option 1: Using Firebase Console (No coding required)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `internet-of-tsiken-690dd`
3. Click **Firestore Database** in the left menu
4. Click **Start collection**
5. Collection ID: `sensorAverages`
6. Add documents with these values:

**Document ID: `temperature`**

```
average: 31.8 (number)
sensorType: "temperature" (string)
totalReadings: 150 (number)
minValue: 28.5 (number)
maxValue: 34.2 (number)
updatedAt: (click "Add field" → select "timestamp" type → use current time)
```

**Document ID: `waterLevel`**

```
average: 82.5 (number)
sensorType: "waterLevel" (string)
totalReadings: 120 (number)
minValue: 65.0 (number)
maxValue: 95.0 (number)
updatedAt: (timestamp)
```

**Document ID: `energy`**

```
average: 89.3 (number)
sensorType: "energy" (string)
totalReadings: 100 (number)
minValue: 12.7 (number)
maxValue: 120.5 (number)
updatedAt: (timestamp)
```

**Document ID: `humidity`**

```
average: 78.0 (number)
sensorType: "humidity" (string)
totalReadings: 150 (number)
minValue: 68.0 (number)
maxValue: 85.0 (number)
updatedAt: (timestamp)
```

**Document ID: `feedLevel`**

```
average: 62.0 (number)
sensorType: "feedLevel" (string)
totalReadings: 110 (number)
minValue: 45.0 (number)
maxValue: 98.0 (number)
updatedAt: (timestamp)
```

### Option 2: Using Node.js Script

If you prefer automation:

1. **Install dependencies:**

   ```bash
   cd scripts
   npm install
   ```

2. **Add Firestore test data:**

   ```bash
   npm run add-sensor-data
   ```

   This will add all sensor averages to Firestore instantly.

## For Cloud Functions Testing

If you want to test the Cloud Functions that calculate averages:

1. **Add Realtime Database URL** to `addRealtimeTestData.js`:
   - Get your database URL from Firebase Console → Realtime Database
   - Update line 17: `databaseURL: "https://YOUR-PROJECT.firebaseio.com"`

2. **Run the script:**

   ```bash
   npm run add-realtime-data
   ```

   This adds sample sensor readings to Realtime Database, which triggers your Cloud Functions.

## What Each Script Does

### `addTestSensorData.js`

- Adds pre-calculated sensor averages directly to Firestore
- **Use this to quickly test the ViewReport UI**
- No Cloud Functions needed
- Data appears immediately in the app

### `addRealtimeTestData.js`

- Adds raw sensor readings to Realtime Database
- Triggers Cloud Functions to calculate averages
- **Use this to test the complete data pipeline**
- Requires Cloud Functions to be deployed

## Testing the ViewReport Screen

After adding data using either method:

1. Open your React Native app
2. Navigate to **Reports** screen
3. Click any report to view
4. You should see real data instead of "Loading..." or "N/A"

## Data Structure

### Firestore Collection: `sensorAverages`

Each document contains:

```javascript
{
  average: number,        // Average value
  sensorType: string,     // Type of sensor
  totalReadings: number,  // Number of readings used
  minValue: number,       // Minimum recorded value
  maxValue: number,       // Maximum recorded value
  updatedAt: Timestamp    // Last update time
}
```

### Realtime Database Structure

**Multi-sensor readings:**

```
/sensorData/{userId}/readings/{readingId}
  ├── temperature: 32
  ├── humidity: 78
  ├── waterLevel: 85
  ├── feedLevel: 62
  ├── solarCharge: 62
  └── timestamp: 1701619200000
```

**Single-sensor readings:**

```
/sensorData/{userId}/{sensorType}/{timestamp}
  ├── value: 32.5
  ├── timestamp: 1701619200000
  └── userId: "user123"
```

## Troubleshooting

**Script fails with authentication error:**

- Make sure your Firebase config is correct in the scripts
- Check that Firestore/Realtime Database is enabled in Firebase Console

**Data not showing in app:**

- Verify collection name is exactly `sensorAverages`
- Check document IDs match sensor types: `temperature`, `waterLevel`, `energy`
- Make sure field names are exactly as shown above
- Check Firestore rules allow read access

**Cloud Functions not triggering:**

- Ensure functions are deployed: `firebase deploy --only functions`
- Check Cloud Functions logs: `firebase functions:log`
- Verify Realtime Database URL is set in Firebase config

## Clean Up Test Data

To remove test data from Firestore:

1. Go to Firebase Console → Firestore Database
2. Select the `sensorAverages` collection
3. Delete the collection or individual documents

## Next Steps

Once you have physical sensors:

1. Send real sensor data to Realtime Database using the same structure
2. Cloud Functions will automatically calculate and update averages
3. ViewReport screen will display live data in real-time
