const admin = require('firebase-admin');
const fs = require('fs');
require('dotenv').config();
const serviceAccount = require('../key.json');

async function checkAuth() {
    let out = '🧐 CHECKING AUTH USERS...\n';
    try {
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
        const list = await admin.auth().listUsers();
        out += `Found ${list.users.length} users.\n`;
        list.users.forEach(u => {
            out += `- User: ${u.email} (${u.displayName || 'No Name'})\n`;
        });
        fs.writeFileSync('auth_check_result.txt', out);
        process.exit(0);
    } catch (e) {
        fs.writeFileSync('auth_check_result.txt', 'ERROR: ' + e.message);
        process.exit(1);
    }
}
checkAuth();
