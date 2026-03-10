const admin = require('firebase-admin');
require('dotenv').config();
const serviceAccount = require('../key.json');

async function checkSettings() {
    console.log('🧐 ANALYZING SETTINGS COLLECTION...');
    try {
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
        const fb = admin.firestore();

        const snapshot = await fb.collection('settings').get();
        snapshot.forEach(doc => {
            console.log(`Document: ${doc.id}`);
            console.log(JSON.stringify(doc.data(), null, 2));
        });
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
checkSettings();
