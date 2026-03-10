const fs = require('fs');
const xlsx = require('xlsx');
const bcrypt = require('bcrypt');
const { pool, initDb } = require('./db');

async function uploadStaff() {
    await initDb();
    const filePath = '../public/staff_users.xlsx';
    if (!fs.existsSync(filePath)) {
        console.error('File not found:', filePath);
        process.exit(1);
    }

    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    console.log(`Found ${data.length} staff/security records. Uploading to TiDB...`);

    let count = 0;
    for (const record of data) {
        try {
            const email = String(record['email'] || '').trim().toLowerCase();
            const displayName = record['displayName'] || '';
            const campus = record['Campus'] || '';
            const password = String(record['PWD'] || 'Outpass@123'); // Default password if missing

            if (!email) continue;

            const passwordHash = await bcrypt.hash(password, 10);
            const uid = 'staff_' + Date.now() + '_' + Math.floor(Math.random() * 1000);

            // Using ON DUPLICATE KEY UPDATE to avoid errors if script is run twice
            await pool.query(
                `INSERT INTO users (uid, email, password_hash, name, campus, role) 
                 VALUES (?, ?, ?, ?, ?, 'staff') 
                 ON DUPLICATE KEY UPDATE name=?, campus=?, password_hash=?`,
                [uid, email, passwordHash, displayName, campus, displayName, campus, passwordHash]
            );

            count++;
            if (count % 10 === 0) console.log(`Uploaded ${count} staff records...`);
        } catch (err) {
            console.error('Error inserting staff:', record.email, err);
        }
    }

    console.log(`Successfully synced ${count} staff/security users to TiDB.`);
    process.exit(0);
}

uploadStaff();
