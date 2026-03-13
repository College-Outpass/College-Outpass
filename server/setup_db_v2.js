const mysql = require('mysql2/promise');
require('dotenv').config({ path: 'f:/Projects/college-outpass-system/server/.env' });

async function setup() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('--- DB SETUP START ---');
        
        // 1. Drop old tables if they exist
        console.log('Dropping old tables...');
        await pool.query('DROP TABLE IF EXISTS transfer_admins');
        await pool.query('DROP TABLE IF EXISTS users');
        await pool.query('DROP TABLE IF EXISTS staff');
        await pool.query('DROP TABLE IF EXISTS admins');

        // 2. Create the unified table
        console.log('Creating unified transfer_admins table...');
        await pool.query(`
            CREATE TABLE transfer_admins (
                uid VARCHAR(50) PRIMARY KEY,
                email VARCHAR(100) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                name VARCHAR(100),
                campus VARCHAR(100),
                role VARCHAR(20) DEFAULT 'staff',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 3. Create the initial HOD/Admin account
        console.log('Creating initial Admin account...');
        const bcrypt = require('bcrypt');
        const hash = await bcrypt.hash('admin123', 10); // Default password for now
        await pool.query(
            'INSERT INTO transfer_admins (uid, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)',
            ['admin_001', 'srinivasnaidu.m@srichaitanyaschool.net', hash, 'Srinivas Naidu', 'admin']
        );

        console.log('--- DB SETUP COMPLETE! ---');
        console.log('Now saving and fetching will only use the "transfer_admins" table.');
    } catch (e) {
        console.error('❌ SETUP ERROR:', e.message);
    } finally {
        await pool.end();
    }
}

setup();
