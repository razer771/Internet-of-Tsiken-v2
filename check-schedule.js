// Quick diagnostic script to check watering schedule
const admin = require('firebase-admin');
const serviceAccount = require('./config/serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkSchedules() {
  console.log('\n🔍 Checking Watering Schedules...\n');
  
  try {
    const snapshot = await db.collection('wateringSchedules').get();
    
    if (snapshot.empty) {
      console.log('❌ No schedules found in wateringSchedules collection');
      return;
    }
    
    console.log(`Found ${snapshot.size} schedule(s):\n`);
    
    snapshot.forEach(doc => {
      const data = doc.data();
      console.log(`Schedule ID: ${doc.id}`);
      console.log(`  User ID: ${data.userId || 'NOT SET'}`);
      console.log(`  Time: ${data.time || 'NOT SET'}`);
      console.log(`  Date: ${data.date || 'NOT SET'}`);
      console.log(`  Duration: ${data.duration || 0} seconds`);
      console.log(`  Liters: ${data.liters || 0}`);
      console.log('');
    });
    
    // Get current time in Philippines
    const now = new Date();
    const phTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
    const currentTime = phTime.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    console.log(`\n⏰ Current Time (Philippines): ${currentTime}`);
    console.log(`📅 Current Date: ${phTime.toLocaleDateString()}`);
    
  } catch (error) {
    console.error('Error:', error);
  }
  
  process.exit(0);
}

checkSchedules();
