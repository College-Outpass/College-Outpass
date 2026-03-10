const admin = require('firebase-admin');
const fs = require('fs');
require('dotenv').config();
const serviceAccount = require('../key.json');

async function checkAllBuckets() {
    let out = '🧐 CHECKING STORAGE BUCKETS...\n';
    try {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        const storage = admin.storage();
        try {
            const bucket = storage.bucket();
            out += `Default bucket: ${bucket.name}\n`;
            const [files] = await bucket.getFiles();
            out += `Files: ${files.length}\n`;
            files.forEach(f => out += `- ${f.name}\n`);
        } catch (e) {
            out += 'Default bucket failed: ' + e.message + '\n';
        }
        fs.writeFileSync('bucket_check_result.txt', out);
        process.exit(0);
    } catch (e) {
        fs.writeFileSync('bucket_check_result.txt', 'ERROR: ' + e.message);
        process.exit(1);
    }
}
checkAllBuckets();
