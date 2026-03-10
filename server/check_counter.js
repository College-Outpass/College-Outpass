const admin = require('firebase-admin');
require('dotenv').config();
const serviceAccount = require('../key.json');

async function checkCounter() {
    console.log('🧐 CHECKING OUTPASS COUNTERS...');
    try {
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
        const fb = admin.firestore();

        const doc = await fb.collection('settings').doc('outpassCounter').get();
        if (doc.exists) {
            console.log('Outpass Counter Status:', doc.data());
        } else {
            console.log('Outpass Counter settings not found.');
        }
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
checkCounter();
