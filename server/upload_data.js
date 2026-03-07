const fs = require('fs');
const xlsx = require('xlsx');
const { pool, initDb } = require('./db');

async function uploadData() {
    await initDb();
    const filePath = '../Contact no.s.xlsx';
    if (!fs.existsSync(filePath)) {
        console.error('File not found:', filePath);
        process.exit(1);
    }

    // Create students table
    await pool.query(`
        CREATE TABLE IF NOT EXISTS students (
            sno INT,
            branch VARCHAR(255),
            admission VARCHAR(255) PRIMARY KEY,
            contact_number VARCHAR(100)
        )
    `);

    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    console.log(`Found ${data.length} records. Uploading to TiDB...`);

    let count = 0;
    for (const record of data) {
        try {
            const keys = Object.keys(record);
            const snoKey = keys.find(k => k.toLowerCase().includes('sno'));
            const branchKey = keys.find(k => k.toLowerCase().includes('branch'));
            const admissionKey = keys.find(k => k.toLowerCase().includes('admission'));
            const contactKey = keys.find(k => k.toLowerCase().includes('contact'));

            const sno = snoKey ? record[snoKey] : null;
            const branch = branchKey ? record[branchKey] : '';
            const admission = admissionKey ? String(record[admissionKey]).trim() : '';
            const contact = contactKey ? String(record[contactKey]).trim() : '';

            if (!admission) continue;

            await pool.query(
                `INSERT INTO students (sno, branch, admission, contact_number) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE branch=?, contact_number=?`,
                [sno, branch, admission, contact, branch, contact]
            );
            count++;
            if (count % 100 === 0) console.log(`Uploaded ${count} records...`);
        } catch (err) {
            console.error('Error inserting row:', err);
        }
    }

    console.log(`Successfully synced ${count} students to TiDB.`);
    process.exit(0);
}

uploadData();
