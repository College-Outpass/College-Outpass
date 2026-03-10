const admin = require('firebase-admin');
require('dotenv').config();
const serviceAccount = require('../key.json');

async function checkProject() {
    console.log('🧐 CHECKING PROJECT INFO...');
    try {
        const app = admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
        console.log('Project ID from cert:', serviceAccount.project_id);
        const fb = admin.firestore();
        const collections = await fb.listCollections();
        console.log('Detected Root Collections:', collections.map(c => c.id).join(', '));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
checkProject();
