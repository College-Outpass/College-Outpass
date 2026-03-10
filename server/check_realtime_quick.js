const admin = require('firebase-admin');
require('dotenv').config();
const serviceAccount = require('../key.json');

async function checkRealtime() {
    console.log('🧐 QUICK REALTIME DB CHECK...');
    try {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: "https://college-out-pass-system-62552-default-rtdb.firebaseio.com"
        });
        const db = admin.database();
        const snap = await db.ref('/').limitToFirst(5).once('value');
        if (snap.exists()) {
            console.log('✅ Data found in Realtime DB!');
            console.log(snap.val());
        } else {
            console.log('Realtime DB is empty at root.');
        }
        process.exit(0);
    } catch (e) {
        console.error('ERROR:', e.message);
        process.exit(1);
    }
}
checkRealtime();
