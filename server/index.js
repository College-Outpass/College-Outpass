const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { pool, initDb } = require('./db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Firebase Admin Setup
const admin = require('firebase-admin');
const serviceAccountPath = path.join(__dirname, '../key.json');
if (process.env.FIREBASE_SERVICE_ACCOUNT_B64) {
    try {
        const decodedKey = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_B64, 'base64').toString('utf8');
        const serviceAccount = JSON.parse(decodedKey);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log('🔥 Firebase Admin initialized from ENV');
    } catch (e) {
        console.error('❌ Failed to initialize Firebase Admin from ENV:', e.message);
    }
} else if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log('🔥 Firebase Admin initialized from key.json');
} else {
    console.warn('⚠️ Firebase Admin Initialization failed: key.json or ENV not found');
}

console.log('🚀 Final Pure-Database Mode v3.1 - Fix Schema');
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret12345';

// Logger
const logs = [];
app.use((req, res, next) => {
    const msg = `[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`;
    logs.push(msg);
    if (logs.length > 100) logs.shift();
    console.log(msg);
    next();
});

app.get('/diag/logs', (req, res) => res.send(`<pre>${logs.join('\n')}</pre>`));
app.get('/', (req, res) => res.json({ 
    service: 'Outpass API', 
    version: '3.0', 
    mode: 'Pure-TiDB', 
    status: 'Online',
    time: new Date().toISOString()
}));
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
        const [[totalCount]] = await pool.query('SELECT COUNT(*) as count FROM transfer_admins');
        const [[staffCount]] = await pool.query("SELECT COUNT(*) as count FROM transfer_admins WHERE role = 'staff'");
        const [[adminsCount]] = await pool.query("SELECT COUNT(*) as count FROM transfer_admins WHERE role = 'admin'");
        const [[securityCount]] = await pool.query('SELECT COUNT(*) as count FROM security').catch(() => [{count: 0}]);
        const [[studentsCount]] = await pool.query('SELECT COUNT(*) as count FROM students').catch(() => [{count: 'ERROR/MISSING'}]);
        
        // Fetch last 5 users for verification
        const [lastUsers] = await pool.query('SELECT uid, email, role, created_at FROM transfer_admins ORDER BY created_at DESC LIMIT 5');

        res.json({
            status: 'connected',
            table: 'transfer_admins',
            counts: { 
                total: totalCount.count,
                staff: staffCount.count, 
                admins: adminsCount.count, 
                security: securityCount.count,
                students: studentsCount.count 
            },
            recent_users: lastUsers,
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



async function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        console.warn('⚠️ No token provided');
        return res.sendStatus(401);
    }

    const HOD_EMAIL = 'srinivasnaidu.m@srichaitanyaschool.net';

    try {
        // [PURE FIREBASE MODE] Verify using Firebase Admin SDK
        if (admin.apps.length > 0) {
            const decodedToken = await admin.auth().verifyIdToken(token);
            const email = (decodedToken.email || '').toLowerCase();
            
            // Check if HOD or has admin role in Firestore
            let role = 'staff';
            if (email === HOD_EMAIL) {
                role = 'admin';
            } else {
                // Check Firestore for role if not HOD
                const staffDoc = await admin.firestore().collection('staff').doc(decodedToken.uid).get();
                if (staffDoc.exists) {
                    role = staffDoc.data().role || 'staff';
                } else {
                    const adminDoc = await admin.firestore().collection('admins').doc(decodedToken.uid).get();
                    if (adminDoc.exists) role = 'admin';
                }
            }

            req.user = { 
                ...decodedToken, 
                email, 
                role,
                uid: decodedToken.uid 
            };
            
            console.log(`✅ Firebase Token verified: ${email} (${role})`);
            return next();
        } else {
            console.warn('⚠️ Firebase Admin not initialized, using legacy fallback');
            // Try legacy decode for HOD ONLY
            const decoded = jwt.decode(token);
            if (decoded && decoded.email && decoded.email.toLowerCase() === HOD_EMAIL) {
                req.user = { ...decoded, email: HOD_EMAIL, role: 'admin' };
                return next();
            }
        }
    } catch (error) {
        console.error('❌ Firebase Auth Error:', error.message);
        
        // Final fallback for HOD with any valid-looking token
        try {
            const decoded = jwt.decode(token);
            if (decoded && decoded.email && decoded.email.toLowerCase() === HOD_EMAIL) {
                console.warn('👑 HOD Emergency Bypass');
                req.user = { ...decoded, email: HOD_EMAIL, role: 'admin' };
                return next();
            }
        } catch(e) {}
    }

    console.error('❌ Authentication failed for token');
    return res.sendStatus(403);
}


// Legacy Login Endpoint - Re-enabled as a bridge to Firebase
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    console.warn(`⚠️ Legacy /api/auth/login hit by ${email}. Proxying to Firebase...`);

    try {
        // We use the Firebase Auth REST API to verify credentials on the server
        const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || "AIzaSyBFHwulhuw9NlGQi0DWzy9mU47RSO5TUkw";
        const firebaseRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email,
                password,
                returnSecureToken: true
            })
        });

        const data = await firebaseRes.json();

        if (!firebaseRes.ok) {
            console.error('❌ Firebase Auth proxy failed:', data.error);
            return res.status(401).json({ 
                error: 'Authentication failed', 
                details: data.error.message 
            });
        }

        // Successfully authenticated via Firebase
        console.log(`✅ Legacy login successful for ${email}`);
        
        // Return a response that looks like the old one
        res.json({
            token: data.idToken,
            refresh_token: data.refreshToken,
            user: {
                uid: data.localId,
                email: data.email,
                name: data.displayName || data.email.split('@')[0],
                role: 'staff' // Default role for legacy bridge
            }
        });

    } catch (error) {
        console.error('❌ Legacy login error:', error);
        res.status(500).json({ error: 'Internal server error during authentication bridge' });
    }
});

app.patch('/api/users/:uid/password', authenticateToken, async (req, res) => {
    // Only admins or the HOD can reset passwords
    if (req.user.role !== 'admin' && req.user.email.toLowerCase() !== 'srinivasnaidu.m@srichaitanyaschool.net') {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    try {
        const { password } = req.body;
        const { uid } = req.params;

        if (!password) return res.status(400).json({ error: 'New password required' });

        const hash = await bcrypt.hash(password, 10);
        
        // Update ONLY transfer_admins table
        await pool.query('UPDATE transfer_admins SET password_hash = ? WHERE uid = ?', [hash, uid]);

        // Sync with Firebase Auth
        try {
            await admin.auth().updateUser(uid, { password: password });
        } catch (fbErr) {
            console.warn(`⚠️ Could not update password in Firebase Auth for ${uid}`);
        }

        console.log(`✅ Password reset successful for UID: ${uid}`);
        res.json({ success: true });
    } catch (err) {
        console.error('❌ Password Reset Error:', err);
        res.status(500).json({ error: 'Failed' });
    }
});

app.post('/api/auth/verify_firebase_staff', authenticateToken, async (req, res) => {
    try {
        const { campus } = req.body;
        const email = req.user.email; // Already verified by authenticateToken

        console.log(`🔍 Verifying TiDB profile for: ${email}`);

        // Fetch profile from transfer_admins
        const [users] = await pool.query('SELECT uid, email, role, campus FROM transfer_admins WHERE email = ?', [email]);
        
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
    const adminUser = req.user;
    if (adminUser.role !== 'admin') {
        return res.status(403).json({ error: 'Unauthorized: Admin access required.' });
    }

    try {
        const { email, password, name, campus, role } = req.body;
        console.log(`👤 [USER CREATE FIREBASE] ${email} (${role}) at ${campus}`);

        if (!email || !password || !campus) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const normalizedEmail = email.toLowerCase().trim();
        const userRole = role || 'staff';

        // 1. Create in Firebase Auth
        const userRecord = await admin.auth().createUser({
            email: normalizedEmail,
            password: password,
            displayName: name || null
        });

        // 2. Save Profile in Firestore
        const collectionName = userRole === 'admin' ? 'admins' : 'staff';
        await admin.firestore().collection(collectionName).doc(userRecord.uid).set({
            uid: userRecord.uid,
            email: normalizedEmail,
            name: name || null,
            campus: campus,
            role: userRole,
            created_at: new Date().toISOString()
        });

        console.log(`✅ [USER CREATE] Firebase success for UID: ${userRecord.uid}`);
        res.json({ success: true, uid: userRecord.uid });

    } catch (err) {
        console.error('❌ [USER CREATE] Error:', err);
        res.status(500).json({ error: 'Firebase creation failed', details: err.message });
    }
});

app.get('/api/users', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    try {
        console.log('📡 Fetching users from Firestore...');
        const staffSnapshot = await admin.firestore().collection('staff').get();
        const adminsSnapshot = await admin.firestore().collection('admins').get();

        const staff = staffSnapshot.docs.map(doc => doc.data());
        const admins = adminsSnapshot.docs.map(doc => doc.data());

        res.json([...admins, ...staff]);
    } catch (err) {
        console.error('❌ Fetch error:', err);
        res.status(500).json({ error: 'Failed' });
    }
});

app.delete('/api/users/:uid', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });

    try {
        const uid = req.params.uid;
        console.log(`🗑️ Deleting user: ${uid}`);

        // Delete from Auth
        await admin.auth().deleteUser(uid).catch(e => console.warn('Auth deletion fail:', e.message));
        
        // Delete from Firestore (try both collections)
        await admin.firestore().collection('staff').doc(uid).delete();
        await admin.firestore().collection('admins').doc(uid).delete();

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/admins/:uid', authenticateToken, async (req, res) => {
    try {
        const uid = req.params.uid;
        const email = req.user.email ? req.user.email.toLowerCase() : '';

        // PRINCIPAL BYPASS
        if (email === 'srinivasnaidu.m@srichaitanyaschool.net') {
            return res.json({ exists: true, data: { role: 'admin', email: email } });
        }

        const adminDoc = await admin.firestore().collection('admins').doc(uid).get();
        if (adminDoc.exists) {
            res.json({ exists: true, data: adminDoc.data() });
        } else {
            res.json({ exists: false });
        }
    } catch (err) {
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
