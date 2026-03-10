const admin = require('firebase-admin');
require('dotenv').config();
const serviceAccount = require('../key.json');

async function checkStorage() {
    console.log('🧐 CHECKING CLOUD STORAGE FOR BACKUPS...');
    try {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            storageBucket: "college-out-pass-system-62552.firebasestorage.app"
        });
        const bucket = admin.storage().bucket();
        const [files] = await bucket.getFiles();
        console.log(`Found ${files.length} files in storage.`);
        files.forEach(file => {
            console.log(`- File: ${file.name}`);
        });
        process.exit(0);
    } catch (e) {
        console.error('ERROR:', e.message);
        process.exit(1);
    }
}
checkStorage();
