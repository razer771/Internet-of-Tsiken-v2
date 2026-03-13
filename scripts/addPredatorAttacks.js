/**
 * Add Predator Attack Data to Firestore
 *
 * Adds 3 predator attacks per week (cat & dog alternating)
 * from Feb 1 to Mar 12, 2026, all under "Batch 1" in brooderInfo.
 *
 * Structure: /predatorAttacks/{batchId}/attacks/{docId}
 * Fields: attack_datetime (Timestamp), predator_type (string)
 *
 * Run: node scripts/addPredatorAttacks.js
 */

const { initializeApp } = require("firebase/app");
const {
  getFirestore,
  collection,
  getDocs,
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

async function findBatch1Id() {
  const brooderRef = collection(db, "brooderInfo");
  const snapshot = await getDocs(brooderRef);

  // Find batch with batchNumber 1
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const batchNum = data.batchNumber || data.batchNo || data.batch_number;
    if (String(batchNum) === "1") {
      console.log(`Found Batch 1 with id: ${doc.id}`);
      return doc.id;
    }
  }

  // If no batchNumber=1 found, list all and use the first one
  console.log("No batch with batchNumber=1 found. Available batches:");
  snapshot.docs.forEach((doc) => {
    console.log(`  id: ${doc.id}, data:`, JSON.stringify(doc.data()));
  });

  if (snapshot.docs.length > 0) {
    const firstId = snapshot.docs[0].id;
    console.log(`Using first available batch: ${firstId}`);
    return firstId;
  }

  // Fallback: just use "Batch 1" as document ID
  console.log('No batches found in brooderInfo. Using "Batch 1" as document ID.');
  return "Batch 1";
}

async function addPredatorAttacks() {
  const batchId = await findBatch1Id();

  const attacksRef = collection(db, "predatorAttacks", batchId, "attacks");

  // 3 attacks per week: Mon, Wed, Fri alternating cat/dog/cat
  // Predators cycle: cat, dog, cat, dog, dog, cat...
  const PREDATOR_CYCLE = ["cat", "dog", "cat", "dog", "cat", "dog"];
  // Attack hours spread across day
  const ATTACK_HOURS = [6, 14, 20]; // early morning, afternoon, evening

  const startDate = new Date(2026, 1, 1); // Feb 1
  const endDate = new Date(2026, 2, 12);  // Mar 12

  let count = 0;
  let predatorIndex = 0;

  // Collect all weeks
  const current = new Date(startDate);
  while (current <= endDate) {
    const dayOfWeek = current.getDay(); // 0=Sun, 1=Mon...

    // Attack days: Monday(1), Wednesday(3), Friday(5)
    if (dayOfWeek === 1 || dayOfWeek === 3 || dayOfWeek === 5) {
      const attackTime = new Date(current);
      const hour = ATTACK_HOURS[count % ATTACK_HOURS.length];
      attackTime.setHours(hour, Math.floor(Math.random() * 60), 0, 0);

      const predator = PREDATOR_CYCLE[predatorIndex % PREDATOR_CYCLE.length];
      predatorIndex++;

      await addDoc(attacksRef, {
        attack_datetime: Timestamp.fromDate(attackTime),
        predator_type: predator,
        batchId: batchId,
        detected_by: "yolo_camera",
        confidence: parseFloat((0.82 + Math.random() * 0.15).toFixed(2)),
        location: "brooder_area",
        note: `${predator.charAt(0).toUpperCase() + predator.slice(1)} detected near brooder`,
      });

      count++;
      console.log(
        `Added: ${attackTime.toDateString()} ${attackTime.toLocaleTimeString()} - predator: ${predator}`
      );
    }

    current.setDate(current.getDate() + 1);
  }

  console.log(`\nDone! Added ${count} predator attack records to batch: ${batchId}`);
  process.exit(0);
}

addPredatorAttacks().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
