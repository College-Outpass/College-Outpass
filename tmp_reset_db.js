const mysql = require('mysql2/promise');
require('dotenv').config({ path: './server/.env' });

async function reset() {
    try {
        console.log('🔄 Connecting to TiDB...');
        const pool = mysql.createPool({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: process.env.DB_PORT || 4000,
            ssl: { rejectUnauthorized: true }
        });

        const connection = await pool.getConnection();
        console.log('✅ Connected!');

        // Truncate tables
        console.log('🧹 Truncating tables...');
        await connection.query('TRUNCATE TABLE users');
        await connection.query('TRUNCATE TABLE staff');
        await connection.query('TRUNCATE TABLE admins');

        // Insert HOD admin
        console.log('👑 Inserting HOD Admin...');
        const hodEmail = 'srinivasnaidu.m@srichaitanyaschool.net';
        const hodUid = 'hod_admin_' + Date.now();
        
        // We use a simple hash for now
        const password_hash = '$2b$10$7Rksyv.0E1v7zKzW.oJq2u6p8E8V.q8Z.q8Z.q8Z.q8Z.q8Z.q8Z'; // dummy but valid format

        await connection.query(
            'INSERT INTO users (uid, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)',
            [hodUid, hodEmail, password_hash, 'Head of Department', 'admin']
        );

        await connection.query(
            'INSERT INTO admins (uid, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)',
            [hodUid, hodEmail, password_hash, 'Head of Department', 'admin']
        );

        console.log('✅ Database Reset Successful!');
        connection.release();
        process.exit(0);
    } catch (err) {
        console.error('❌ Reset failed:', err);
        process.exit(1);
    }
}

reset();
