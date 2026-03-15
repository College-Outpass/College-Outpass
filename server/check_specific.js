const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkSpecificStudent() {
    try {
        const pool = mysql.createPool({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: process.env.DB_PORT || 4000,
            ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: false }
        });
        const [rows] = await pool.query('SELECT * FROM students WHERE id = "SCS1601409" OR studentId = "SCS1601409"');
        console.log('Result:', rows);
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}
checkSpecificStudent();
