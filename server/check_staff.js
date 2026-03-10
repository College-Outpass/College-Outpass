const admin = require('firebase-admin');
require('dotenv').config();
const serviceAccount = require('../key.json');

async function checkStaff() {
    console.log('🧐 CHECKING staffUsers COLLECTION...');
    try {
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
        const fb = admin.firestore();

        const snapshot = await fb.collection('staffUsers').limit(5).get();
        console.log(`Documents found: ${snapshot.size}`);
        if (snapshot.size > 0) {
            snapshot.forEach(doc => {
                console.log(JSON.stringify(doc.data(), null, 2));
            });
        }
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
checkStaff();
