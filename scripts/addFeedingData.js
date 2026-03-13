/**
 * Add Feeding Execution Data to Firestore
 *
 * Adds 3 feeding schedule executions per day for the past 7 days
 * into the feedingExecutions_logs collection.
 *
 * Run: node scripts/addFeedingData.js
 */

const { initializeApp } = require("firebase/app");
const {
  getFirestore,
  collection,
  addDoc,
  Timestamp,
} = require("firebase/firestore");

const firebaseConfig = {
  apiKey: "AIzaSyBa6PE0nqkrFAqDm6AT2nIrZmv6qIfgiFM",
  authDomain: "internet-of-tsiken-f0ad4.firebaseapp.com",
  projectId: "internet-of-tsiken-f0ad4",
  storageBucket: "internet-of-tsiken-f0ad4.firebasestorage.app",
  messagingSenderId: "403239833979",
  appId: "1:403239833979:web:7b8656be94583bc45aedde",
  measurementId: "G-LD936L51CP",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 3 feeding times per day (morning, noon, evening)
const FEEDING_TIMES_HOURS = [7, 12, 17];

async function addFeedingData() {
  const feedingRef = collection(db, "feedingExecutions_logs");
  let count = 0;

  const startDate = new Date(2026, 1, 1); // Feb 1, 2026
  const endDate = new Date(2026, 2, 12);  // Mar 12, 2026

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    for (const hour of FEEDING_TIMES_HOURS) {
      const feedTime = new Date(d);
      feedTime.setHours(hour, 0, 0, 0);

      const docData = {
        status: "success",
        executedAt: Timestamp.fromDate(feedTime),
        scheduledTime: `${String(hour).padStart(2, "0")}:00`,
        type: "scheduled",
        source: "automation",
        durationSeconds: 30,
        note: "Scheduled feeding execution",
      };

      await addDoc(feedingRef, docData);
      count++;
      console.log(
        `Added: ${feedTime.toDateString()} ${feedTime.toLocaleTimeString()}`
      );
    }
  }

  console.log(`\nDone! Added ${count} feeding records.`);
  process.exit(0);
}

addFeedingData().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
