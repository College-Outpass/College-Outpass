const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixAdmin() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 4000,
        ssl: { rejectUnauthorized: true }
    });

    try {
        console.log('--- FIXING ADMIN CREDENTIALS ---');
        const email = 'srinivasnaidu.m@srichaitanyaschool.net';
        const bcrypt = require('bcrypt');
        const hash = await bcrypt.hash('admin123', 10);

        console.log(`Checking if user ${email} exists...`);
        const [users] = await pool.query('SELECT * FROM transfer_admins WHERE email = ?', [email]);

        if (users.length > 0) {
            console.log('User found. Updating password...');
            await pool.query('UPDATE transfer_admins SET password_hash = ?, role = "admin" WHERE email = ?', [hash, email]);
            console.log('Password updated successfully.');
        } else {
            console.log('User not found. Creating new admin account...');
            await pool.query(
                'INSERT INTO transfer_admins (uid, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)',
                ['admin_' + Date.now(), email, hash, 'Head of Department', 'admin']
            );
            console.log('Admin account created successfully.');
        }

        console.log('\n--- VERIFICATION ---');
        const [verify] = await pool.query('SELECT email, role FROM transfer_admins WHERE email = ?', [email]);
        console.log('User in DB:', verify[0]);
        console.log('\nCredential set to:');
        console.log(`Email: ${email}`);
        console.log('Password: admin123');
        console.log('--- DONE ---');

    } catch (e) {
        console.error('❌ ERROR:', e.message);
    } finally {
        await pool.end();
    }
}

fixAdmin();
