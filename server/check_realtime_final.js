const admin = require('firebase-admin');
require('dotenv').config();
const serviceAccount = require('../key.json');

async function checkRealtime() {
    console.log('🧐 CHECKING REALTIME DB...');
    try {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: `https://college-out-pass-system-62552.firebaseio.com/`
        });
        const db = admin.database();
        const ref = db.ref('/');

        // Use a timeout
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 15000));
        const val = await Promise.race([ref.once('value'), timeout]);

        if (val.exists()) {
            console.log('✅ Realtime Data found!');
            const json = JSON.stringify(val.val());
            if (json.toLowerCase().includes('ropaka')) {
                console.log('✨ ROPAKA FOUND!');
            } else {
                console.log('Ropaka not found in RTDB.');
            }
        } else {
            console.log('RTDB is empty.');
        }
        process.exit(0);
    } catch (e) {
        console.error('ERROR:', e.message);
        process.exit(1);
    }
}
checkRealtime();
