const admin = require('firebase-admin');
require('dotenv').config();
const serviceAccount = require('../key.json');

async function searchRopakaCol() {
    console.log('🧐 SEARCHING FOR "Ropaka" AS A COLLECTION...');
    try {
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
        const fb = admin.firestore();

        const names = ['Ropaka', 'ropaka', 'ROPKA', 'ropka'];
        for (const name of names) {
            const snap = await fb.collection(name).limit(5).get();
            if (snap.size > 0) {
                console.log(`✅ FOUND DATA IN COLLECTION: ${name}`);
                snap.forEach(d => console.log(JSON.stringify(d.data(), null, 2)));
            }
        }
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
searchRopakaCol();
