const express = require('express');
const cors = require('cors');
const fs = require('fs');
const { pool, initDb } = require('./db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const path = require('path');
const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Settings
const publicPath = path.join(__dirname, '../public');

// Log all incoming requests for debugging
app.use((req, res, next) => {
    console.log(`[${new Date().toLocaleTimeString()}] Browser requested: ${req.method} ${req.url}`);
    next();
});

// Diagnostic Routes (Top Priority)
app.get('/', (req, res) => {
    res.send('<h1>Online</h1><p>Outpass API (TiDB Bridge) is active.</p>');
});

app.get('/hello', (req, res) => {
    console.log('✅ HELLO route hit!');
    res.send('<h1>I am alive!</h1><p>Server version: 2.5 (Students API Ready)</p>');
});

app.get('/diag/db', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT 1 as "connection_test"');
        const [security] = await pool.query('SELECT COUNT(*) as count FROM security');
        res.json({
            status: 'connected',
            test: rows[0].connection_test,
            security_count: security[0].count,
            time: new Date().toISOString()
        });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// Serve static files from the public directory
console.log('✅ Serving static files from:', publicPath);
try {
    const files = fs.readdirSync(publicPath);
    console.log('📂 Files in folder:', files.join(', '));
} catch (e) { console.log('❌ Error reading folder:', e.message); }

app.use(express.static(publicPath));

initDb();

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret12345';

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);

    try {
        const decoded = jwt.decode(token);
        if (decoded && decoded.email) {
            const email = decoded.email.toLowerCase();
            // Accept Firebase tokens (iss contains securetoken.google.com)
            const isFirebaseToken = decoded.iss && decoded.iss.includes('securetoken.google.com');
            if (isFirebaseToken || decoded.email_verified || email === 'srinivasnaidu.m@srichaitanyaschool.net') {
                req.user = { ...decoded, email };
                console.log(`✅ Firebase/verified token accepted for: ${email}`);
                return next();
            }
        }
    } catch (e) {
        console.warn('Token decode error:', e.message);
    }

    // Fallback: verify with our custom JWT secret (admin portal logins)
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            // Last resort decode — allow any token with an email
            try {
                const decoded = jwt.decode(token);
                if (decoded && decoded.email) {
                    req.user = { ...decoded, email: decoded.email.toLowerCase() };
                    console.log(`⚠️ Accepted via decode fallback: ${decoded.email}`);
                    return next();
                }
            } catch (e2) { }
            return res.sendStatus(403);
        }
        req.user = user;
        next();
    });
}


app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log(`🔑 Login attempt: ${email}`);

        // HOD BYPASS - Always allow the principal admin
        if (email.toLowerCase() === 'srinivasnaidu.m@srichaitanyaschool.net') {
            const token = jwt.sign({
                uid: 'hod_admin_placeholder',
                email: 'srinivasnaidu.m@srichaitanyaschool.net',
                role: 'admin'
            }, JWT_SECRET, { expiresIn: '24h' });

            return res.json({
                user: {
                    uid: 'hod_admin_placeholder',
                    email: 'srinivasnaidu.m@srichaitanyaschool.net',
                    role: 'admin'
                },
                token
            });
        }

        const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) return res.status(404).json({ code: 'auth/user-not-found' });

        const user = users[0];
        if (!user.password_hash) return res.status(401).json({ code: 'auth/no-password-set' });

        const pwdMatch = await bcrypt.compare(password, user.password_hash);
        if (!pwdMatch) return res.status(401).json({ code: 'auth/wrong-password' });

        const token = jwt.sign({ uid: user.uid, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ user: { uid: user.uid, email: user.email, role: user.role }, token });
    } catch (err) {
        console.error('❌ Login Error:', err);
        res.status(500).json({ error: 'Internal error' });
    }
});

app.post('/api/auth/verify', authenticateToken, (req, res) => {
    res.json({ user: req.user });
});

app.get('/api/admins/:uid', authenticateToken, async (req, res) => {
    try {
        const uid = req.params.uid;
        const email = req.user.email ? req.user.email.toLowerCase() : '';

        // PRINCIPAL BYPASS: If email matches the HOD email, they ARE an admin.
        if (email === 'srinivasnaidu.m@srichaitanyaschool.net') {
            console.log('👑 HOD detected in Admin Verification!');
            return res.json({
                exists: true,
                data: { role: 'admin', email: email, name: 'Head of Department' }
            });
        }

        // Standard check
        const [users] = await pool.query(
            'SELECT role, email FROM users WHERE (uid = ? OR email = ?) AND role = "admin"',
            [uid, email]
        );

        if (users.length > 0) {
            res.json({ exists: true, data: { ...users[0] } });
        } else {
            res.json({ exists: false });
        }
    } catch (err) {
        console.error('Admin check error:', err);
        res.status(500).json({ error: 'Failed' });
    }
});

app.post('/api/outpasses', authenticateToken, async (req, res) => {
    try {
        const data = req.body;
        const id = 'out_' + Date.now();
        await pool.query(
            `INSERT INTO outpasses (id, passNumber, studentId, studentName, category, section, fatherName, whatsappNumber, requestedBy, issuedBy, status, outDate, inDate, reason, issuedDate, issuedTime, studentPhoto, createdBy) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [id, data.passNumber, data.studentId, data.studentName, data.category, data.section, data.fatherName, data.whatsappNumber, data.requestedBy, data.issuedBy, data.status, data.outDate, data.inDate, data.reason, data.issuedDate, data.issuedTime, data.studentPhoto, data.createdBy]
        );
        res.json({ id });
    } catch (err) {
        res.status(500).json({ error: 'Failed' });
    }
});

app.get('/api/outpasses', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM outpasses ORDER BY timestamp DESC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed' });
    }
});

app.post('/api/sickSlips', authenticateToken, async (req, res) => {
    try {
        const data = req.body;
        const id = 'sick_' + Date.now();
        await pool.query(
            `INSERT INTO sick_slips (id, sickSlipNumber, studentId, studentName, date, time, reason, status, issuedBy, issuedDate, issuedTime, createdBy) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
            [id, data.sickSlipNumber, data.studentId, data.studentName, data.date, data.time, data.reason, data.status, data.issuedBy, data.issuedDate, data.issuedTime, data.createdBy]
        );
        res.json({ id });
    } catch (err) {
        res.status(500).json({ error: 'Failed' });
    }
});

app.get('/api/sickSlips', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM sick_slips ORDER BY timestamp DESC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed' });
    }
});

// Security Management
app.get('/api/security', async (req, res) => {
    try {
        const { campus } = req.query;
        let query = 'SELECT * FROM security';
        let params = [];
        if (campus) {
            query += ' WHERE campus = ?';
            params.push(campus);
        }
        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed' });
    }
});

app.post('/api/security', authenticateToken, async (req, res) => {
    try {
        const { name, campus, whatsappNumber } = req.body;
        console.log(`👤 Adding security: ${name} (${campus}) - ${whatsappNumber}`);

        if (!name || !campus || !whatsappNumber) {
            console.warn('⚠️ Missing data for security personnel');
            return res.status(400).json({ error: 'Missing required data' });
        }

        const [result] = await pool.query(
            'INSERT INTO security (name, campus, whatsapp_number) VALUES (?, ?, ?)',
            [name, campus, whatsappNumber]
        );

        console.log(`✅ Security added successfully! ID: ${result.insertId}`);
        res.json({ success: true, id: result.insertId });
    } catch (err) {
        console.error('❌ Failed to add security:', err.message);
        res.status(500).json({ error: 'Database failure: ' + err.message });
    }
});

// Students Collection - No authentication required for staff dashboard
app.get('/api/students/:id', async (req, res) => {
    try {
        const studentId = req.params.id.toUpperCase();
        console.log(`📚 Fetching student: ${studentId}`);
        const [rows] = await pool.query('SELECT * FROM students WHERE id = ?', [studentId]);

        if (rows.length === 0) {
            console.log(`❌ Student not found: ${studentId}`);
            return res.json({ exists: false, data: null });
        }

        console.log(`✅ Student found: ${rows[0].studentName}`);
        res.json({ exists: true, data: rows[0] });
    } catch (err) {
        console.error('❌ Error fetching student:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

app.get('/api/students', async (req, res) => {
    try {
        const { campus, limit } = req.query;
        console.log(`📚 Fetching students list - campus: ${campus}, limit: ${limit}`);
        let query = 'SELECT * FROM students';
        let params = [];

        if (campus) {
            query += ' WHERE campus = ?';
            params.push(campus);
        }

        if (limit) {
            query += ` LIMIT ${parseInt(limit, 10)}`;
        }

        const [rows] = await pool.query(query, params);
        console.log(`✅ Returning ${rows.length} student(s)`);

        const formattedRows = rows.map(row => ({
            id: row.id,
            ...row
        }));

        res.json(formattedRows);
    } catch (err) {
        console.error('❌ Error fetching students collection:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

app.post('/api/migrate/security-batch', authenticateToken, async (req, res) => {
    try {
        const { batch } = req.body; // Array of {name, campus, whatsappNumber}
        for (const item of batch) {
            // Check if already exists to avoid duplicates
            const [exists] = await pool.query(
                'SELECT id FROM security WHERE name = ? AND campus = ? AND whatsapp_number = ?',
                [item.name, item.campus, item.whatsappNumber]
            );
            if (exists.length === 0) {
                await pool.query(
                    'INSERT INTO security (name, campus, whatsapp_number) VALUES (?, ?, ?)',
                    [item.name, item.campus, item.whatsappNumber]
                );
            }
        }
        res.json({ success: true, count: batch.length });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed' });
    }
});

app.delete('/api/security/:id', authenticateToken, async (req, res) => {
    try {
        await pool.query('DELETE FROM security WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed' });
    }
});

app.post('/api/settings/increment', authenticateToken, async (req, res) => {
    const { collection, doc } = req.body;
    try {
        const connection = await pool.getConnection();
        await connection.beginTransaction();
        let [rows] = await connection.query('SELECT count_value FROM settings WHERE setting_key = ? FOR UPDATE', [doc]);
        let currentCount = 1;
        if (rows.length > 0) currentCount = rows[0].count_value;
        else await connection.query('INSERT INTO settings (setting_key, count_value) VALUES (?, 1)', [doc]);

        await connection.query('UPDATE settings SET count_value = ? WHERE setting_key = ?', [currentCount + 1, doc]);
        await connection.commit();
        connection.release();
        res.json({ currentCount });
    } catch (error) {
        res.status(500).json({ error: 'Transaction failed' });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => { console.log("TiDB backend API running on port " + PORT); });
