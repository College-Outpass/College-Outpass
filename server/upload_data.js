const fs = require('fs');
const xlsx = require('xlsx');
const { pool, initDb } = require('./db');
const path = require('path');

async function uploadData() {
    await initDb();
    const filePath = path.join(__dirname, '../public/student_data.xlsx');
    if (!fs.existsSync(filePath)) {
        console.error('File not found:', filePath);
        process.exit(1);
    }

    console.log('Dropping old table if exists...');
    await pool.query('DROP TABLE IF EXISTS students');

    console.log('Creating correct students table...');
    // Create students table
    await pool.query(`
        CREATE TABLE IF NOT EXISTS students (
            id VARCHAR(100) PRIMARY KEY,
            studentId VARCHAR(100),
            studentName VARCHAR(255),
            category VARCHAR(100),
            section VARCHAR(100),
            fatherName VARCHAR(255),
            whatsappNumber VARCHAR(50),
            campus VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    `);

    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    console.log(`Found ${data.length} records in Excel. Uploading to TiDB...`);

    let count = 0;
    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        try {
            // Normalize column names
            const scsNumber = (row['SCS Number'] || row['SCSNumber'] || row['SCS_Number'] || row['scs_number'] || '').toString().trim().toUpperCase();
            const studentName = (row['Student Name'] || row['StudentName'] || row['student_name'] || row['Name'] || '').toString().trim();
            const category = (row['Category'] || row['Choose Category'] || row['category'] || '').toString().trim();
            const section = (row['Section'] || row['section'] || '').toString().trim();
            const fatherName = (row["Father's Name"] || row['FathersName'] || row['Father Name'] || row['father_name'] || '').toString().trim();
            const whatsappNumber = (row['WhatsApp Number'] || row['WhatsAppNumber'] || row['whatsapp_number'] || row['Phone'] || '').toString().trim();
            const fileCampus = (row['Campus'] || row['campus'] || '').toString().trim().toUpperCase();

            if (!scsNumber) continue;

            const normalizedSCS = scsNumber.startsWith('SCS') ? scsNumber : 'SCS' + scsNumber.replace(/SCS/gi, '');
            if (!studentName) continue;

            const normalizedFileCampus = fileCampus
                .replace(/\s+/g, '_')
                .replace(/ECITY_?/gi, 'ECITY_')
                .replace(/NEET_BOYS/gi, 'NEET_BOYS')
                .replace(/GIRLS_RESIDENTIAL/gi, 'GIRLS_RESIDENTIAL')
                .replace(/ENGG_GIRLS_RESIDENTIAL/gi, 'ENGG_GIRLS_RESIDENTIAL')
                .replace(/SCHOOL/gi, 'SCHOOL');

            await pool.query(
                `INSERT INTO students (id, studentId, studentName, category, section, fatherName, whatsappNumber, campus) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?) 
                 ON DUPLICATE KEY UPDATE studentName=?, category=?, section=?, fatherName=?, whatsappNumber=?, campus=?`,
                [normalizedSCS, normalizedSCS, studentName, category, section, fatherName, whatsappNumber, normalizedFileCampus,
                    studentName, category, section, fatherName, whatsappNumber, normalizedFileCampus]
            );
            count++;
            if (count % 100 === 0) console.log(`Uploaded ${count} records...`);
        } catch (err) {
            console.error('Error inserting row', i, err);
        }
    }

    console.log(`Successfully synced ${count} students to TiDB.`);
    process.exit(0);
}

uploadData();
