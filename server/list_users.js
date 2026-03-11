const { pool } = require('./db');
require('dotenv').config();

async function checkUsers() {
    try {
        const [rows] = await pool.query('SELECT * FROM users');
        console.log('--- USERS IN DATABASE ---');
        console.table(rows.map(r => ({ ...r, password_hash: '[REDACTED]' })));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
checkUsers();
