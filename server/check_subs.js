const admin = require('firebase-admin');
require('dotenv').config();
const serviceAccount = require('../key.json');

async function checkSubCollections() {
    console.log('🧐 CHECKING SUB-COLLECTIONS...');
    try {
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
        const fb = admin.firestore();

        // Sometimes data is in campus folders like /campuses/MAIN/outpasses
        const collections = await fb.listCollections();
        for (const col of collections) {
            console.log(`Checking root: ${col.id}`);
            const docs = await col.limit(5).get();
            for (const doc of docs.docs) {
                const subCols = await doc.ref.listCollections();
                if (subCols.length > 0) {
                    console.log(`  -> Document ${doc.id} has sub-collections: ${subCols.map(s => s.id).join(', ')}`);
                    for (const sc of subCols) {
                        const sample = await sc.limit(1).get();
                        if (sample.size > 0) {
                            console.log(`    -> Data found in: ${col.id}/${doc.id}/${sc.id}`);
                        }
                    }
                }
            }
        }
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
checkSubCollections();
