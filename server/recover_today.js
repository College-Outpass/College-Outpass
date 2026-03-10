const admin = require('firebase-admin');
const mysql = require('mysql2/promise');
require('dotenv').config();

const serviceAccount = require('../key.json');

async function recoverAll() {
    console.log('🚀 Starting Universal Security Recovery...');
    try {
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
        const fb = admin.firestore();

        const tidb = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: process.env.DB_PORT,
            ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true }
        });

        console.log('📡 Fetching ALL outpasses...');
        const snapshot = await fb.collection('outpasses').get();
        console.log(`📊 Documents found: ${snapshot.size}`);

        const uniqueSecurity = new Map();

        snapshot.forEach(doc => {
            const d = doc.data();

            // Check every possible field name
            const name = d.security || d.Security || d.securityName || d.security_name || d.SecurityName || d.security_Name;
            const phone = d.securityWhatsapp || d.SecurityWhatsapp || d.securityPhone || d.security_phone || d.SecurityPhone || d.security_whatsapp;
            const campus = d.campus || d.Campus || 'UNKNOWN';

            if (name && phone && name !== '--') {
                const cleanName = String(name).trim();
                const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);

                if (cleanPhone.length === 10) {
                    const key = `${cleanName.toLowerCase()}_${cleanPhone}`;
                    uniqueSecurity.set(key, { name: cleanName, campus: String(campus), phone: cleanPhone });
                }
            }
        });

        console.log(`🔎 Detected ${uniqueSecurity.size} unique security personnel.`);

        let count = 0;
        for (const s of uniqueSecurity.values()) {
            const [exists] = await tidb.execute('SELECT id FROM security WHERE whatsapp_number = ?', [s.phone]);
            if (exists.length === 0) {
                await tidb.execute('INSERT INTO security (name, campus, whatsapp_number) VALUES (?, ?, ?)', [s.name, s.campus, s.phone]);
                console.log(`✅ Recovered: ${s.name} (${s.phone})`);
                count++;
            }
        }

        console.log(`\n🎉 DONE! Total profiles restored to TiDB: ${count}`);
        process.exit(0);
    } catch (e) {
        console.error('❌ ERROR:', e.message);
        process.exit(1);
    }
}
recoverAll();
