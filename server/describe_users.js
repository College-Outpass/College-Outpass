const { pool } = require('./db');
require('dotenv').config();

async function describeTable() {
    try {
        const [rows] = await pool.query('DESCRIBE users');
        console.log('--- USERS TABLE SCHEMA ---');
        console.log(JSON.stringify(rows, null, 2));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
describeTable();
