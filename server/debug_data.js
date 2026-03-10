const admin = require('firebase-admin');
require('dotenv').config();
const serviceAccount = require('../key.json');

async function debugData() {
    console.log('🧐 DEBUGGING FIREBASE DATA...');
    try {
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
        const fb = admin.firestore();

        const snapshot = await fb.collection('outpasses').limit(5).get();
        console.log(`Documents fetched: ${snapshot.size}`);

        snapshot.forEach(doc => {
            console.log('--- Document ID:', doc.id, '---');
            console.log(JSON.stringify(doc.data(), null, 2));
        });
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
debugData();
