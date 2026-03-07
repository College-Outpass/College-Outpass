const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 4000,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: { rejectUnauthorized: true }
});

async function initDb() {
    try {
        const connection = await pool.getConnection();
        console.log('Connected to TiDB successfully!');
        
        // Settings table for counters
        await connection.query(`
            CREATE TABLE IF NOT EXISTS settings (
                setting_key VARCHAR(100) PRIMARY KEY,
                count_value INT DEFAULT 1
            )
        `);

        // Users block for auth (Staff & Admins)
        await connection.query(`
            CREATE TABLE IF NOT EXISTS users (
                uid VARCHAR(100) PRIMARY KEY,
                email VARCHAR(255) UNIQUE,
                password_hash VARCHAR(255),
                role VARCHAR(50) DEFAULT 'staff',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Outpasses table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS outpasses (
                id VARCHAR(100) PRIMARY KEY,
                passNumber VARCHAR(100),
                studentId VARCHAR(100),
                studentName VARCHAR(255),
                category VARCHAR(100),
                section VARCHAR(100),
                fatherName VARCHAR(255),
                whatsappNumber VARCHAR(50),
                requestedBy VARCHAR(255),
                issuedBy VARCHAR(255),
                status VARCHAR(50),
                outDate VARCHAR(100),
                inDate VARCHAR(100),
                reason TEXT,
                issuedDate VARCHAR(100),
                issuedTime VARCHAR(100),
                studentPhoto LONGTEXT,
                createdBy VARCHAR(255),
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Sick Slips table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS sick_slips (
                id VARCHAR(100) PRIMARY KEY,
                sickSlipNumber VARCHAR(100),
                studentId VARCHAR(100),
                studentName VARCHAR(255),
                date VARCHAR(100),
                time VARCHAR(100),
                reason TEXT,
                status VARCHAR(50),
                issuedBy VARCHAR(255),
                issuedDate VARCHAR(100),
                issuedTime VARCHAR(100),
                createdBy VARCHAR(255),
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Insert default admin if not exists
        const [users] = await connection.query("SELECT * FROM users WHERE email = 'admin@college.com'");
        if (users.length === 0) {
            const bcrypt = require('bcrypt');
            const adminHash = await bcrypt.hash('admin123', 10);
            await connection.query("INSERT INTO users (uid, email, password_hash, role) VALUES (?, ?, ?, 'admin')", ['admin_uid_1', 'admin@college.com', adminHash]);
        }
        
        // Insert default counters if not exist
        await connection.query("INSERT IGNORE INTO settings (setting_key, count_value) VALUES ('outpassCounter', 1)");
        await connection.query("INSERT IGNORE INTO settings (setting_key, count_value) VALUES ('sickSlipCounter', 1)");

        connection.release();
    } catch (error) {
        console.error('Failed to initialize TiDB:', error);
    }
}

module.exports = { pool, initDb };
