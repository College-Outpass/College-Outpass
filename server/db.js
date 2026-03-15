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
                name VARCHAR(255),
                campus VARCHAR(255),
                role VARCHAR(50) DEFAULT 'staff',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Separate Staff table (as requested)
        await connection.query(`
            CREATE TABLE IF NOT EXISTS staff (
                uid VARCHAR(100) PRIMARY KEY,
                email VARCHAR(255) UNIQUE,
                password_hash VARCHAR(255),
                name VARCHAR(255),
                campus VARCHAR(255),
                role VARCHAR(50) DEFAULT 'staff',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Separate Admins table (as requested)
        await connection.query(`
            CREATE TABLE IF NOT EXISTS admins (
                uid VARCHAR(100) PRIMARY KEY,
                email VARCHAR(255) UNIQUE,
                password_hash VARCHAR(255),
                name VARCHAR(255),
                role VARCHAR(50) DEFAULT 'admin',
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
                parentPhoto LONGTEXT,
                authorizedLetterPhoto LONGTEXT,
                createdBy VARCHAR(255),
                campus VARCHAR(255),
                reportingTime VARCHAR(100),
                reportedBy VARCHAR(255),
                reportedAt TIMESTAMP NULL,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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
                campus VARCHAR(255),
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Column migrations for outpasses
        const [outpassCols] = await connection.query("SHOW COLUMNS FROM outpasses");
        const existingOutpassCols = outpassCols.map(c => c.Field);
        if (!existingOutpassCols.includes('campus')) await connection.query("ALTER TABLE outpasses ADD COLUMN campus VARCHAR(255)");
        if (!existingOutpassCols.includes('reportingTime')) await connection.query("ALTER TABLE outpasses ADD COLUMN reportingTime VARCHAR(100)");
        if (!existingOutpassCols.includes('reportedBy')) await connection.query("ALTER TABLE outpasses ADD COLUMN reportedBy VARCHAR(255)");
        if (!existingOutpassCols.includes('reportedAt')) await connection.query("ALTER TABLE outpasses ADD COLUMN reportedAt TIMESTAMP NULL");
        if (!existingOutpassCols.includes('createdAt')) await connection.query("ALTER TABLE outpasses ADD COLUMN createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
        if (!existingOutpassCols.includes('parentPhoto')) await connection.query("ALTER TABLE outpasses ADD COLUMN parentPhoto LONGTEXT");
        if (!existingOutpassCols.includes('authorizedLetterPhoto')) await connection.query("ALTER TABLE outpasses ADD COLUMN authorizedLetterPhoto LONGTEXT");

        // Column migrations for sick_slips
        const [sickSlipCols] = await connection.query("SHOW COLUMNS FROM sick_slips");
        const existingSickSlipCols = sickSlipCols.map(c => c.Field);
        if (!existingSickSlipCols.includes('campus')) await connection.query("ALTER TABLE sick_slips ADD COLUMN campus VARCHAR(255)");
        if (!existingSickSlipCols.includes('createdAt')) await connection.query("ALTER TABLE sick_slips ADD COLUMN createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP");

        // Security Personnel table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS security (
                id INT AUTO_INCREMENT PRIMARY KEY,
                uid VARCHAR(128) UNIQUE,
                email VARCHAR(255) UNIQUE,
                name VARCHAR(255),
                campus VARCHAR(255),
                whatsapp_number VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Migration for security table (Fixed Split Commands)
        const [secCols] = await connection.query("SHOW COLUMNS FROM security");
        const existingSecCols = secCols.map(c => c.Field);
        if (!existingSecCols.includes('uid')) {
            await connection.query("ALTER TABLE security ADD COLUMN uid VARCHAR(128) AFTER id");
            await connection.query("ALTER TABLE security ADD UNIQUE(uid)");
        }
        if (!existingSecCols.includes('email')) {
            await connection.query("ALTER TABLE security ADD COLUMN email VARCHAR(255) AFTER uid");
            await connection.query("ALTER TABLE security ADD UNIQUE(email)");
        }

        // Insert default admin if not exists
        const [users] = await connection.query("SELECT * FROM users WHERE email = 'admin@college.com' OR email = 'srinivasnaidu.m@srichaitanyaschool.net'");
        if (users.length === 0) {
            const bcrypt = require('bcrypt');
            const adminHash = await bcrypt.hash('admin123', 10);
            await connection.query("INSERT INTO users (uid, email, password_hash, role) VALUES (?, ?, ?, 'admin')", ['admin_uid_1', 'admin@college.com', adminHash]);
        }

        // Specifically ensure the HOD admin exists in both users (for login) and admins table
        await connection.query("INSERT IGNORE INTO users (uid, email, role) VALUES (?, ?, 'admin')", ['hod_admin_placeholder', 'srinivasnaidu.m@srichaitanyaschool.net']);
        await connection.query("INSERT IGNORE INTO admins (uid, email, role, name) VALUES (?, ?, 'admin', ?)", ['hod_admin_placeholder', 'srinivasnaidu.m@srichaitanyaschool.net', 'Head of Department']);

        // Insert default counters if not exist
        await connection.query("INSERT IGNORE INTO settings (setting_key, count_value) VALUES ('outpassCounter', 1)");
        await connection.query("INSERT IGNORE INTO settings (setting_key, count_value) VALUES ('sickSlipCounter', 1)");

        connection.release();
    } catch (error) {
        console.error('Failed to initialize TiDB:', error);
    }
}

module.exports = { pool, initDb };
