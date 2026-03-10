const admin = require('firebase-admin');
require('dotenv').config();
const serviceAccount = require('../key.json');

async function findRopaka() {
    console.log('🧐 SEARCHING FOR "Ropaka" ACROSS ALL COLLECTIONS...');
    try {
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
        const fb = admin.firestore();

        const collections = await fb.listCollections();
        for (const col of collections) {
            console.log(`Checking collection: ${col.id}`);
            const snapshot = await col.get();
            snapshot.forEach(doc => {
                const data = doc.data();
                const json = JSON.stringify(data).toLowerCase();
                if (json.includes('ropaka')) {
                    console.log(`✨ FOUND IN: ${col.id}/${doc.id}`);
                    console.log(JSON.stringify(data, null, 2));
                }
            });
        }
        console.log('Search complete.');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
findRopaka();
