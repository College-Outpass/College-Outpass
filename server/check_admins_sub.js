const admin = require('firebase-admin');
const fs = require('fs');
require('dotenv').config();
const serviceAccount = require('../key.json');

async function checkAdmins() {
    let out = '🧐 CHECKING ADMIN DOCUMENTS FOR DATA...\n';
    try {
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
        const fb = admin.firestore();

        const snapshot = await fb.collection('admins').get();
        for (const doc of snapshot.docs) {
            out += `Checking Admin: ${doc.id}\n`;
            const subCols = await doc.ref.listCollections();
            if (subCols.length > 0) {
                out += `  -> Sub-collections: ${subCols.map(s => s.id).join(', ')}\n`;
            }
        }
        fs.writeFileSync('admin_check_result.txt', out);
        process.exit(0);
    } catch (e) {
        fs.writeFileSync('admin_check_result.txt', 'ERROR: ' + e.message);
        process.exit(1);
    }
}
checkAdmins();
