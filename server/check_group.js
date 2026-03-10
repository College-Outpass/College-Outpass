const admin = require('firebase-admin');
require('dotenv').config();
const serviceAccount = require('../key.json');

async function checkCollectionGroup() {
    console.log('🧐 SEARCHING COLLECTION GROUP "security"...');
    try {
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
        const fb = admin.firestore();

        const names = ['security', 'Security', 'outpasses', 'outpass'];
        for (const name of names) {
            console.log(`Checking group: ${name}`);
            const snapshot = await fb.collectionGroup(name).limit(5).get();
            console.log(`Found: ${snapshot.size}`);
            snapshot.forEach(doc => {
                console.log(`Path: ${doc.ref.path}`);
                console.log(JSON.stringify(doc.data(), null, 2));
            });
        }
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
checkCollectionGroup();
