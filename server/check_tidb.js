const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkDatabase() {
    console.log('🧐 CHECKING TiDB FOR "Ropaka"...');
    try {
        const tidb = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: process.env.DB_PORT,
            ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true }
        });

        const [rows] = await tidb.execute('SELECT * FROM security WHERE name LIKE "%ropaka%"');
        if (rows.length > 0) {
            console.log('✅ FOUND IN TIDB!');
            console.log(rows);
        } else {
            console.log('Not found in TiDB "security" table.');
            // Search other tables? outpasses?
            const [outpasses] = await tidb.execute('SELECT * FROM outpasses WHERE studentName LIKE "%ropaka%" OR fatherName LIKE "%ropaka%" OR requestedBy LIKE "%ropaka%" OR issuedBy LIKE "%ropaka%"');
            if (outpasses.length > 0) {
                console.log('✅ FOUND IN TIDB OUTPASSES!');
                console.log(outpasses);
            }
        }
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
checkDatabase();
