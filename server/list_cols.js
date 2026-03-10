const admin = require('firebase-admin');
require('dotenv').config();
const serviceAccount = require('../key.json');

async function listCollections() {
    console.log('🧐 LISTING ALL COLLECTIONS...');
    try {
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
        const fb = admin.firestore();

        const collections = await fb.listCollections();
        console.log('Found collections:', collections.map(c => c.id).join(', '));

        for (const col of collections) {
            const snap = await col.limit(1).get();
            console.log(`- Collection "${col.id}" has documents: ${snap.size > 0 ? 'Yes' : 'No'}`);
        }
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
listCollections();
