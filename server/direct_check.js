const admin = require('firebase-admin');
const fs = require('fs');
require('dotenv').config();
const serviceAccount = require('../key.json');

async function directCheck() {
    let out = '🧐 DIRECT COLLECTION CHECK...\n';
    try {
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
        const fb = admin.firestore();

        const names = ['outpasses', 'outpass', 'Security', 'security', 'Staff', 'staff'];
        for (const name of names) {
            const snap = await fb.collection(name).limit(1).get();
            const status = snap.size > 0 ? 'FOUND' : 'EMPTY/NOT FOUND';
            out += `- Collection "${name}": ${status}\n`;
            console.log(`- Collection "${name}": ${status}`);
        }
        fs.writeFileSync('direct_result.txt', out);
        process.exit(0);
    } catch (e) {
        fs.writeFileSync('direct_result.txt', 'ERROR: ' + e.message);
        process.exit(1);
    }
}
directCheck();
