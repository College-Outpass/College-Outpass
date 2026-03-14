const admin = require('firebase-admin');
const serviceAccount = require('../key.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function checkCollections() {
    try {
        const collections = await db.listCollections();
        console.log('Collections:', collections.map(c => c.id));
        
        for (const col of collections) {
            const snapshot = await col.limit(1).get();
            console.log(`Collection ${col.id} has ${snapshot.size} docs (limit 1)`);
            if (snapshot.size > 0) {
                console.log(`Sample from ${col.id}:`, snapshot.docs[0].data());
            }
        }
    } catch (err) {
        console.error('Error:', err);
    }
}

checkCollections();
