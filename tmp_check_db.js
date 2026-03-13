const mysql = require('mysql2/promise');
require('dotenv').config({ path: './server/.env' });

async function check() {
    try {
        const pool = mysql.createPool({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: process.env.DB_PORT || 4000,
            ssl: { rejectUnauthorized: true }
        });

        const [users] = await pool.query('SELECT uid, email, role FROM users');
        console.log('👥 USERS:', users);

        const [staff] = await pool.query('SELECT uid, email FROM staff');
        console.log('👔 STAFF:', staff);

        const [admins] = await pool.query('SELECT uid, email FROM admins');
        console.log('👑 ADMINS:', admins);

        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err);
        process.exit(1);
    }
}
check();
