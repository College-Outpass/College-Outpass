const admin = require('firebase-admin');
const mysql = require('mysql2/promise');
require('dotenv').config();

const serviceAccount = require('../key.json');

async function checkCollection(fb, colName) {
    const snap = await fb.collection(colName).limit(3).get();
    if (snap.size === 0) return;

    console.log(`\n🔍 Checking "${colName}"...`);
    const uniqueFound = new Map();

    snap.forEach(doc => {
        const d = doc.data();
        // Look for any field with "security" or "phone" or a 10-digit number
        for (const key in d) {
            const val = String(d[key]);
            if (key.toLowerCase().includes('security') || key.toLowerCase().includes('whatsapp') || key.toLowerCase().includes('phone')) {
                console.log(`  [${key}]: ${val}`);
            }
        }
    });
}

async function searchEverywhere() {
    console.log('🧐 DEEP SEARCH FOR SECURITY DATA...');
    try {
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
        const fb = admin.firestore();

        const collections = ['outpasses', 'mediSlips', 'sickSlips', 'students', 'staffUsers'];
        for (const col of collections) {
            await checkCollection(fb, col);
        }
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
searchEverywhere();
