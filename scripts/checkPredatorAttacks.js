const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs } = require("firebase/firestore");

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

async function checkData() {
  const ref = collection(db, "predator_attacks");
  const snap = await getDocs(ref);
  console.log("Documents in predator_attacks:", snap.docs.length);
  snap.docs.forEach((d) => console.log(d.id, d.data()));
  process.exit(0);
}

checkData().catch((e) => {
  console.error(e);
  process.exit(1);
});
