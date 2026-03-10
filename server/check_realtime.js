const admin = require('firebase-admin');
require('dotenv').config();
const serviceAccount = require('../key.json');

async function checkRealtime() {
    console.log('🧐 CHECKING REALTIME DATABASE...');
    try {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: "https://college-out-pass-system-62552.firebaseio.com"
        });
        const db = admin.database();
        const ref = db.ref('/');
        const snap = await ref.once('value');
        if (snap.exists()) {
            console.log('✅ Realtime Data found!');
            // Search for Ropaka in the JSON
            const json = JSON.stringify(snap.val()).toLowerCase();
            if (json.includes('ropaka')) {
                console.log('✨ ROPAKA FOUND IN REALTIME DB!');
                // Print the specific path if possible, but for now just the fact it's there
            } else {
                console.log('Ropaka not found in Realtime DB.');
            }
        } else {
            console.log('Realtime DB is empty.');
        }
        process.exit(0);
    } catch (e) {
        console.error('ERROR:', e.message);
        process.exit(1);
    }
}
checkRealtime();
