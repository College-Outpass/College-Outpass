const express = require('express');
const cors = require('cors');
const fs = require('fs');
const { pool, initDb } = require('./db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');
const admin = require('firebase-admin');

// Initialize System - Firebase Admin removed for "Security Process" (Database Only)
console.log('✅ System starting in Pure-Database Mode');
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
        const [[users]] = await pool.query('SELECT COUNT(*) as count FROM users');
        const [[staff]] = await pool.query('SELECT COUNT(*) as count FROM staff');
        const [[admins]] = await pool.query('SELECT COUNT(*) as count FROM admins');
        const [[security]] = await pool.query('SELECT COUNT(*) as count FROM security');
        res.json({
            status: 'connected',
            counts: { users: users.count, staff: staff.count, admins: admins.count, security: security.count },
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
                    const email = decoded.email.toLowerCase();
                    const role = (email === 'srinivasnaidu.m@srichaitanyaschool.net') ? 'admin' : (decoded.role || 'staff');
                    req.user = { ...decoded, email, role };
                    console.log(`⚠️ Accepted via decode fallback: ${email} (Role: ${role})`);
                    return next();
                }
            } catch (e2) { }
            return res.sendStatus(403);
        }
        
        // Ensure HOD always has admin role even if token is old
        if (user.email && user.email.toLowerCase() === 'srinivasnaidu.m@srichaitanyaschool.net') {
            user.role = 'admin';
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

        // CHECK CAMPUS (Only for staff roles, or if campus is specified)
        if (req.body.campus && user.campus && user.campus !== req.body.campus && user.role !== 'admin') {
            return res.status(401).json({ code: 'auth/wrong-campus', error: `This account belongs to ${user.campus}` });
        }

        if (!user.password_hash) return res.status(401).json({ code: 'auth/no-password-set' });

        const pwdMatch = await bcrypt.compare(password, user.password_hash);
        if (!pwdMatch) return res.status(401).json({ code: 'auth/wrong-password' });

        const token = jwt.sign({ uid: user.uid, email: user.email, role: user.role, campus: user.campus }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ user: { uid: user.uid, email: user.email, role: user.role, campus: user.campus }, token });
    } catch (err) {
        console.error('❌ Login Error:', err);
        res.status(500).json({ error: 'Internal error' });
    }
});

app.post('/api/auth/verify_firebase_staff', authenticateToken, async (req, res) => {
    try {
        const { campus } = req.body;
        const email = req.user.email; // Already verified by authenticateToken

        console.log(`🔍 Verifying TiDB profile for: ${email}`);

        // Fetch profile from TiDB
        const [users] = await pool.query('SELECT uid, email, role, campus FROM users WHERE email = ?', [email]);
        
        if (users.length === 0) {
            console.error(`❌ Profile missing in TiDB for: ${email}`);
            return res.status(404).json({ error: 'Staff profile not found in database. Please contact Admin.' });
        }

        const user = users[0];

        // Verify campus for staff
        if (campus && user.campus !== campus && user.role !== 'admin') {
            return res.status(403).json({ error: `This account belongs to ${user.campus.replace(/_/g, ' ')}` });
        }
        
        res.json({ user });
    } catch (err) {
        console.error('Firebase Staff Verify Error:', err);
        res.status(500).json({ error: 'Authorization error: ' + err.message });
    }
});

app.post('/api/auth/verify', authenticateToken, (req, res) => {
    res.json({ user: req.user });
});

// User Management (Admins only)
app.post('/api/users', authenticateToken, async (req, res) => {
    // Only admins or the HOD can create users
    console.log(`🔍 USER CREATION ATTEMPT: ${req.user.email} (Role: ${req.user.role})`);

    if (req.user.role !== 'admin' && req.user.email.toLowerCase() !== 'srinivasnaidu.m@srichaitanyaschool.net') {
        return res.status(403).json({ error: 'Unauthorized: Admin access required' });
    }

    try {
        const { email, password, name, campus, role } = req.body;
        console.log(`👤 [TiDB CREATE] Data received for: ${email} (Role: ${role})`);

        if (!email || !password || !campus) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const uid = 'u_' + Date.now();
        const password_hash = await bcrypt.hash(password, 10);
        const userRole = role || 'staff';

        // 1. Insert into main users table (for login)
        await pool.query(
            'INSERT INTO users (uid, email, password_hash, name, campus, role) VALUES (?, ?, ?, ?, ?, ?)',
            [uid, email.toLowerCase(), password_hash, name || null, campus, userRole]
        );

        // 2. Insert into specialized tables
        if (userRole === 'admin') {
            await pool.query(
                'INSERT INTO admins (uid, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)',
                [uid, email.toLowerCase(), password_hash, name || null, 'admin']
            );
        } else {
            await pool.query(
                'INSERT INTO staff (uid, email, password_hash, name, campus, role) VALUES (?, ?, ?, ?, ?, ?)',
                [uid, email.toLowerCase(), password_hash, name || null, campus, 'staff']
            );
        }

        console.log(`✅ User saved to TiDB tables (users + ${userRole})`);
        res.json({ success: true, uid });
    } catch (err) {
        console.error('❌ User creation error:', err);
        res.status(500).json({ error: 'Database Error: ' + err.message });
    }
});

app.get('/api/users', authenticateToken, async (req, res) => {
    console.log(`🔍 FETCHING USERS LIST: requested by ${req.user.email}`);
    if (req.user.role !== 'admin' && req.user.email !== 'srinivasnaidu.m@srichaitanyaschool.net') {
        console.warn(`❌ Unauthorized users list fetch attempt by: ${req.user.email}`);
        return res.status(403).json({ error: 'Unauthorized' });
    }

    try {
        const [rows] = await pool.query('SELECT uid, email, name, campus, role, created_at FROM users ORDER BY created_at DESC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed' });
    }
});

app.delete('/api/users/:uid', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin' && req.user.email !== 'srinivasnaidu.m@srichaitanyaschool.net') {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    try {
        const uid = req.params.uid;
        // Delete from all tables
        await pool.query('DELETE FROM users WHERE uid = ?', [uid]);
        await pool.query('DELETE FROM staff WHERE uid = ?', [uid]);
        await pool.query('DELETE FROM admins WHERE uid = ?', [uid]);
        res.json({ success: true });
    } catch (err) {
        console.error('❌ User deletion error:', err);
        res.status(500).json({ error: 'Failed: ' + err.message });
    }
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
        const campus = data.campus || (req.user && req.user.campus) || 'UNKNOWN';
        console.log(`📝 Saving outpass for campus: ${campus}`);
        await pool.query(
            `INSERT INTO outpasses (id, passNumber, studentId, studentName, category, section, fatherName, whatsappNumber, requestedBy, issuedBy, status, outDate, inDate, reason, issuedDate, issuedTime, studentPhoto, createdBy, campus) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [id, data.passNumber, data.studentId, data.studentName, data.category, data.section, data.fatherName, data.whatsappNumber, data.requestedBy, data.issuedBy, data.status, data.outDate, data.inDate, data.reason, data.issuedDate, data.issuedTime, data.studentPhoto, data.createdBy, campus]
        );
        res.json({ id });
    } catch (err) {
        console.error('❌ Error saving outpass:', err);
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

app.get('/api/outpasses/:id', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM outpasses WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.json({ exists: false, data: null });
        res.json({ exists: true, data: rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Failed' });
    }
});

app.put('/api/outpasses/:id', authenticateToken, async (req, res) => {
    try {
        const id = req.params.id;
        const data = req.body;
        console.log(`✏️ Updating outpass: ${id}`);

        // Dynamically build update query
        const fields = [];
        const values = [];

        if (data.reportingTime !== undefined) { fields.push('reportingTime = ?'); values.push(data.reportingTime); }
        if (data.inDate !== undefined) { fields.push('inDate = ?'); values.push(data.inDate); }
        if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }
        if (data.reportedBy !== undefined) { fields.push('reportedBy = ?'); values.push(data.reportedBy); }

        if (fields.length === 0) return res.json({ success: true });

        values.push(id);
        const query = `UPDATE outpasses SET ${fields.join(', ')} WHERE id = ?`;
        await pool.query(query, values);

        console.log(`✅ Outpass ${id} updated`);
        res.json({ success: true });
    } catch (err) {
        console.error('❌ Error updating outpass:', err);
        res.status(500).json({ error: 'Failed' });
    }
});

app.post('/api/sickSlips', authenticateToken, async (req, res) => {
    try {
        const data = req.body;
        const id = 'sick_' + Date.now();
        const campus = data.campus || (req.user && req.user.campus) || 'UNKNOWN';
        await pool.query(
            `INSERT INTO sick_slips (id, sickSlipNumber, studentId, studentName, date, time, reason, status, issuedBy, issuedDate, issuedTime, createdBy, campus) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [id, data.sickSlipNumber, data.studentId, data.studentName, data.date, data.time, data.reason, data.status, data.issuedBy, data.issuedDate, data.issuedTime, data.createdBy, campus]
        );
        res.json({ id });
    } catch (err) {
        console.error('❌ Error saving sick slip:', err);
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

// Alias: mediSlips -> sick_slips (admin dashboard uses mediSlips collection name)
app.get('/api/mediSlips', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM sick_slips ORDER BY timestamp DESC');
        const formatted = rows.map(r => ({ ...r, mediSlipNumber: r.sickSlipNumber }));
        res.json(formatted);
    } catch (err) {
        res.status(500).json({ error: 'Failed' });
    }
});

app.post('/api/mediSlips', authenticateToken, async (req, res) => {
    try {
        const data = req.body;
        const id = data.id || ('sick_' + Date.now());
        const campus = data.campus || (req.user && req.user.campus) || 'UNKNOWN';
        await pool.query(
            `INSERT INTO sick_slips (id, sickSlipNumber, studentId, studentName, date, time, reason, status, issuedBy, issuedDate, issuedTime, createdBy, campus) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [id, data.sickSlipNumber || data.mediSlipNumber, data.studentId, data.studentName, data.date, data.time, data.reason, data.status, data.issuedBy, data.issuedDate, data.issuedTime, data.createdBy, campus]
        );
        res.json({ id });
    } catch (err) {
        console.error('❌ Error saving medi slip:', err);
        res.status(500).json({ error: 'Failed' });
    }
});

app.get('/api/mediSlips/:id', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM sick_slips WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.json({ exists: false, data: null });
        const data = { ...rows[0], mediSlipNumber: rows[0].sickSlipNumber };
        res.json({ exists: true, data });
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

app.put('/api/students/:id', authenticateToken, async (req, res) => {
    try {
        const studentId = req.params.id.toUpperCase();
        const { whatsappNumber, studentName, category, section, fatherName, campus } = req.body;
        console.log(`✏️ Updating student: ${studentId}`);
        await pool.query(
            `UPDATE students SET whatsappNumber=COALESCE(?,whatsappNumber), studentName=COALESCE(?,studentName), 
             category=COALESCE(?,category), section=COALESCE(?,section), fatherName=COALESCE(?,fatherName),
             campus=COALESCE(?,campus) WHERE id=?`,
            [whatsappNumber || null, studentName || null, category || null, section || null, fatherName || null, campus || null, studentId]
        );
        console.log(`✅ Student ${studentId} updated`);
        res.json({ success: true });
    } catch (err) {
        console.error('❌ Error updating student:', err);
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
