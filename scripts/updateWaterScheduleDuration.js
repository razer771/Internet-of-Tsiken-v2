// Script to update all water schedules to have 15 second duration
// Run this in your browser console on Firebase Console or use Firebase CLI

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, updateDoc, doc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyAOC8S6aOGvfnUzp0Twb-7O727Un9FoUGE",
  projectId: "internet-of-tsiken-690dd",
  storageBucket: "internet-of-tsiken-690dd.firebasestorage.app"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function updateWaterSchedules() {
  try {
    console.log('🔍 Fetching all water schedules...');
    
    const schedulesRef = collection(db, 'wateringSchedules');
    const snapshot = await getDocs(schedulesRef);
    
    if (snapshot.empty) {
      console.log('❌ No water schedules found');
      return;
    }
    
    console.log(`📋 Found ${snapshot.size} schedule(s)`);
    
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      console.log(`\n📄 Document ID: ${docSnap.id}`);
      console.log(`   Current duration: ${data.duration || 'not set'}`);
      console.log(`   Time: ${data.time}`);
      console.log(`   UserId: ${data.userId}`);
      
      // Update duration to 15 seconds
      await updateDoc(doc(db, 'wateringSchedules', docSnap.id), { duration: 15 });
      console.log(`   ✅ Updated to 15 seconds`);
    }
    
    console.log('\n✅ All water schedules updated successfully!');
    
  } catch (error) {
    console.error('❌ Error updating schedules:', error);
  } finally {
    process.exit();
  }
}

updateWaterSchedules();
