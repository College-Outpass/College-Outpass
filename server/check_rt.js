const admin = require('firebase-admin');
const fs = require('fs');
require('dotenv').config();
const serviceAccount = require('../key.json');

async function checkRT() {
    let out = '🧐 CHECKING REALTIME DB...\n';
    try {
        const urls = [
            `https://college-out-pass-system-62552.firebaseio.com/`,
            `https://college-out-pass-system-62552-default-rtdb.firebaseio.com/`
        ];

        for (const url of urls) {
            out += `Trying URL: ${url}\n`;
            try {
                const app = admin.initializeApp({
                    credential: admin.credential.cert(serviceAccount),
                    databaseURL: url
                }, url); // unique name

                const db = admin.database(app);
                const snap = await db.ref('/').limitToFirst(1).once('value');
                out += `Connection success! Data exists: ${snap.exists()}\n`;
                if (snap.exists()) {
                    out += JSON.stringify(snap.val(), null, 2) + '\n';
                }
            } catch (e) {
                out += `Error: ${e.message}\n`;
            }
        }
        fs.writeFileSync('rt_check_result.txt', out);
        process.exit(0);
    } catch (e) {
        fs.writeFileSync('rt_check_result.txt', 'FATAL: ' + e.message);
        process.exit(1);
    }
}
checkRT();
