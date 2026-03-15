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
let firebaseInitError = null;

function initializeFirebase() {
    if (admin.apps.length > 0) return true;

    try {
        let serviceAccount = null;

        if (process.env.FIREBASE_SERVICE_ACCOUNT_B64) {
            let rawData = process.env.FIREBASE_SERVICE_ACCOUNT_B64.trim();
            // Remove quotes
            rawData = rawData.replace(/['"]+$/g, '').replace(/^['"]+/g, '');
            
            try {
                // Try parsing as raw JSON first
                serviceAccount = JSON.parse(rawData);
                console.log('📦 Firebase: Using raw JSON from ENV');
            } catch (e) {
                // Not raw JSON, try Base64
                try {
                    const decoded = Buffer.from(rawData.replace(/\s+/g, ''), 'base64').toString('utf8');
                    serviceAccount = JSON.parse(decoded);
                    console.log('📦 Firebase: Using Base64 from ENV');
                } catch (e2) {
                    throw new Error('Failed to parse FIREBASE_SERVICE_ACCOUNT_B64 as JSON or Base64');
                }
            }
        } else if (fs.existsSync(serviceAccountPath)) {
            serviceAccount = require(serviceAccountPath);
            console.log('🔥 Firebase Admin: Found key.json');
        }

        if (serviceAccount) {
            if (serviceAccount.private_key) {
                let key = serviceAccount.private_key;
                key = key.replace(/\\n/g, '\n').replace(/\\n/g, '\n');
                
                // PEM Reformation
                const pemMatch = key.match(/-----BEGIN PRIVATE KEY-----([\s\S]+?)-----END PRIVATE KEY-----/);
                if (pemMatch) {
                    const body = pemMatch[1].replace(/\s/g, '');
                    let formatted = '';
                    for (let i = 0; i < body.length; i += 64) formatted += body.substring(i, i + 64) + '\n';
                    key = `-----BEGIN PRIVATE KEY-----\n${formatted}-----END PRIVATE KEY-----\n`;
                } else if (!key.includes('---')) {
                    const body = key.replace(/\s/g, '');
                    let formatted = '';
                    for (let i = 0; i < body.length; i += 64) formatted += body.substring(i, i + 64) + '\n';
                    key = `-----BEGIN PRIVATE KEY-----\n${formatted}-----END PRIVATE KEY-----\n`;
                }
                serviceAccount.private_key = key.trim();
            }

            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
            console.log('✅ Firebase Admin initialized successfully');
            return true;
        } else {
            console.warn('⚠️ No Firebase credentials found (ENV or key.json)');
            firebaseInitError = 'No credentials found';
            return false;
        }
    } catch (err) {
        console.error('❌ Firebase Init Error:', err.message);
        firebaseInitError = err.message;
        return false;
    }
}

// Initial attempt
initializeFirebase();

console.log('🚀 Final Pure-Database Mode v3.3');
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
app.get('/', (req, res) => {
    res.json({ 
        service: 'Outpass API', 
        version: '3.5', 
        mode: 'Pure-TiDB', 
        firebase: admin.apps.length > 0 ? 'Initialized' : 'Failed',
        status: 'Online',
        time: new Date().toISOString()
    });
});

app.get('/hello', (req, res) => {
    const fbCount = admin.apps.length;
    res.send(`<h1>API Version 3.5</h1><p>Firebase Status: ${fbCount > 0 ? 'READY' : 'ERROR'}</p>`);
});
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
    const fbCount = admin.apps.length;
    const status = fbCount > 0 ? 'READY' : 'ERROR/FAILED';
    const detail = firebaseInitError ? `(Error: ${firebaseInitError})` : `(Apps: ${fbCount})`;
    res.send(`<h1>I am alive!</h1><p>Server version: 3.3</p><p>Firebase Status: <b>${status}</b> ${detail}</p>`);
});

app.get('/diag/db', async (req, res) => {
    try {
        const [[totalCount]] = await pool.query('SELECT COUNT(*) as count FROM users');
        const [[staffCount]] = await pool.query("SELECT COUNT(*) as count FROM users WHERE role = 'staff'");
        const [[adminsCount]] = await pool.query("SELECT COUNT(*) as count FROM users WHERE role = 'admin'");
        const [[securityCount]] = await pool.query('SELECT COUNT(*) as count FROM security').catch(() => [{count: 0}]);
        const [[studentsCount]] = await pool.query('SELECT COUNT(*) as count FROM students').catch(() => [{count: 'ERROR/MISSING'}]);
        
        // Fetch last 5 users for verification
        const [lastUsers] = await pool.query('SELECT uid, email, role, created_at FROM users ORDER BY created_at DESC LIMIT 5');

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
    if (token == null) return res.sendStatus(401);

    try {
        // 1. Try Firebase Admin Verify
        if (admin.apps.length) {
            try {
                const decodedToken = await admin.auth().verifyIdToken(token);
                const email = decodedToken.email.toLowerCase();
                
                // Fetch extra info (role, campus) from Firestore
                const db = admin.firestore();
                let role = 'staff';
                let campus = 'ALL';
                let name = decodedToken.name || '';

                // Check admins collection for HOD
                const adminDoc = await db.collection('admins').doc(decodedToken.uid).get();
                if (adminDoc.exists) {
                    role = 'admin';
                    campus = adminDoc.data().campus || 'ALL';
                    name = adminDoc.data().name || name;
                } else {
                    // Check users collection for Staff/Principals
                    const userDoc = await db.collection('users').doc(decodedToken.uid).get();
                    if (userDoc.exists) {
                        role = userDoc.data().role || 'staff';
                        campus = userDoc.data().campus || 'ALL';
                        name = userDoc.data().name || name;
                    } else {
                        // Check if email is in settings -> principal list
                        const settingsDoc = await db.collection('settings').doc('emails').get();
                        if (settingsDoc.exists) {
                            const principalEmails = settingsDoc.data().emails || [];
                            if (principalEmails.some(e => e.trim().toLowerCase() === email)) {
                                role = 'admin';
                            }
                        }
                    }
                }

                // Force HOD admin status
                if (email === 'srinivasnaidu.m@srichaitanyaschool.net') {
                    role = 'admin';
                    campus = 'ALL';
                }

                req.user = { 
                    uid: decodedToken.uid, 
                    email: email, 
                    role: role, 
                    campus: campus,
                    name: name
                };
                
                console.log(`✅ [FIREBASE AUTH] ${email} (Role: ${role}, Campus: ${campus})`);
                return next();
            } catch (fbErr) {
                // Not a valid Firebase token, or verification failed
                // Fallback to JWT or Decode (for legacy support during transition)
            }
        }

        // 2. Legacy JWT Verify (Fallback)
        jwt.verify(token, JWT_SECRET, (err, user) => {
            if (user) {
                const email = user.email.toLowerCase();
                const role = (email === 'srinivasnaidu.m@srichaitanyaschool.net') ? 'admin' : (user.role || 'staff');
                req.user = { ...user, email, role };
                return next();
            }
            
            // 3. Last Resort: Decode (only for transition/dev)
            const decoded = jwt.decode(token);
            if (decoded && decoded.email) {
                const email = decoded.email.toLowerCase();
                const role = (email === 'srinivasnaidu.m@srichaitanyaschool.net') ? 'admin' : (decoded.role || 'staff');
                req.user = { ...decoded, email, role };
                return next();
            }
            
            res.sendStatus(403);
        });

    } catch (e) {
        console.error('Auth Middleware Error:', e.message);
        res.sendStatus(403);
    }
}


app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log(`🔑 Login attempt: ${email}`);

        // [SECURE MODE] Fetch user from users table
        const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
        
        if (users.length === 0) {
            return res.status(404).json({ code: 'auth/user-not-found' });
        }

        const user = users[0];

        // CHECK CAMPUS (Only for staff roles, or if campus is specified)
        if (req.body.campus && user.campus && user.campus !== req.body.campus && user.role !== 'admin') {
            return res.status(401).json({ code: 'auth/wrong-campus', error: `This account belongs to ${user.campus}` });
        }

        if (!user.password_hash) {
            return res.status(401).json({ code: 'auth/no-password-set' });
        }

        const pwdMatch = await bcrypt.compare(password, user.password_hash);
        if (!pwdMatch) {
            return res.status(401).json({ code: 'auth/wrong-password' });
        }

        const token = jwt.sign({ 
            uid: user.uid, 
            email: user.email, 
            role: user.role, 
            campus: user.campus 
        }, JWT_SECRET, { expiresIn: '24h' });

        // Create Firebase Custom Token to allow frontend Firestore access
        let firebaseToken = null;
        try {
            firebaseToken = await admin.auth().createCustomToken(user.uid);
        } catch (fbErr) {
            console.warn('⚠️ Could not create Firebase custom token (user missing in FB?)');
        }

        res.json({ 
            user: { 
                uid: user.uid, 
                email: user.email, 
                role: user.role, 
                campus: user.campus 
            }, 
            token,
            firebaseToken
        });
    } catch (err) {
        console.error('❌ Login Error:', err);
        res.status(500).json({ error: 'Internal error' });
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
        
        // Update ONLY users table
        await pool.query('UPDATE users SET password_hash = ? WHERE uid = ?', [hash, uid]);

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

        // Fetch profile from users
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

// User Management (Firebase + TiDB Synced)
app.post('/api/users', async (req, res) => {
    console.log(`👤 PUBLIC CREATION REQUEST: ${req.body.email || 'no-email'}`);
    
    try {
        const { email, password, name, campus, role, whatsapp_number } = req.body;
        if (!email || !password || !campus) {
            console.error('❌ Missing fields in creation request');
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const userRole = role || 'staff';
        const emailLower = email.toLowerCase();
        console.log(`🛠️ Creating ${userRole} for ${emailLower}...`);
        
        // 1. Create in Firebase Auth
        let uid;
        try {
            const fbUser = await admin.auth().createUser({
                email: emailLower,
                password: password,
                displayName: name || null
            });
            uid = fbUser.uid;
            console.log('🔥 User created in Firebase Auth:', uid);
        } catch (fbErr) {
            if (fbErr.code === 'auth/email-already-exists') {
                const existingUser = await admin.auth().getUserByEmail(emailLower);
                uid = existingUser.uid;
                console.log('♻️ Using existing Firebase User:', uid);
            } else {
                throw fbErr;
            }
        }

        // 2. Sync to Firestore (Mandatory for new Firebase-only Auth)
        const db = admin.firestore();
        const userData = {
            uid: uid,
            email: emailLower,
            name: name || null,
            campus: campus,
            role: userRole,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('users').doc(uid).set(userData);
        if (userRole === 'admin') {
            await db.collection('admins').doc(uid).set(userData);
        }
        console.log('🔥 Firestore metadata updated');

        // 3. Keep TiDB in sync for data relations (Preserving original logic)
        const password_hash = await bcrypt.hash(password, 10);
        
        // Sync to primary users table
        await pool.query(
            'INSERT INTO users (uid, email, password_hash, name, campus, role) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=?, campus=?, role=?, password_hash=?',
            [uid, emailLower, password_hash, name || null, campus, userRole, name || null, campus, userRole, password_hash]
        );

        // Sync to specific role tables
        if (userRole === 'admin') {
            await pool.query(
                'INSERT INTO admins (uid, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=?, role=?, password_hash=?',
                [uid, emailLower, password_hash, name || null, userRole, name || null, userRole, password_hash]
            );
        } else if (userRole === 'security') {
            await pool.query(
                'INSERT INTO security (uid, email, name, campus, whatsapp_number) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=?, campus=?, whatsapp_number=?',
                [uid, emailLower, name || null, campus, whatsapp_number || null, name || null, campus, whatsapp_number || null]
            );
        } else {
            await pool.query(
                'INSERT INTO staff (uid, email, password_hash, name, campus, role) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=?, campus=?, role=?, password_hash=?',
                [uid, emailLower, password_hash, name || null, campus, userRole, name || null, campus, userRole, password_hash]
            );
        }
        
        console.log(`✅ User synced to TiDB`);

        res.json({ success: true, uid });
    } catch (err) {
        console.error('❌ User creation error:', err);
        res.status(500).json({ error: 'Server Error: ' + err.message });
    }
});

app.get('/api/users', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin' && req.user.email !== 'srinivasnaidu.m@srichaitanyaschool.net') {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    try {
        // Try Firestore first if available
        if (admin.apps.length) {
            const db = admin.firestore();
            const snapshot = await db.collection('users').get();
            if (!snapshot.empty) {
                const users = snapshot.docs.map(doc => ({
                    ...doc.data(),
                    id: doc.id,
                    created_at: doc.data().updatedAt ? doc.data().updatedAt.toDate() : new Date()
                }));
                return res.json(users);
            }
        }

        // Fallback to TiDB
        const [rows] = await pool.query('SELECT uid, email, name, campus, role, created_at FROM users ORDER BY created_at DESC');
        res.json(rows);
    } catch (err) {
        console.error('Fetch users error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/users/:uid', authenticateToken, async (req, res) => {
    const { uid } = req.params;
    try {
        if (admin.apps.length) {
            const db = admin.firestore();
            const userDoc = await db.collection('users').doc(uid).get();
            if (userDoc.exists) {
                return res.json({ exists: true, data: userDoc.data() });
            }
            
            // Check admins collection too
            const adminDoc = await db.collection('admins').doc(uid).get();
            if (adminDoc.exists) {
                return res.json({ exists: true, data: adminDoc.data() });
            }
        }
        
        // Fallback to TiDB
        const [rows] = await pool.query('SELECT * FROM users WHERE uid = ?', [uid]);
        if (rows.length > 0) {
            return res.json({ exists: true, data: rows[0] });
        }
        
        res.status(404).json({ exists: false });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


app.delete('/api/users/:uid', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin' && req.user.email !== 'srinivasnaidu.m@srichaitanyaschool.net') {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    try {
        // Delete from TiDB tables
        await pool.query('DELETE FROM users WHERE uid = ?', [uid]);
        await pool.query('DELETE FROM staff WHERE uid = ?', [uid]);
        await pool.query('DELETE FROM admins WHERE uid = ?', [uid]);

        // Delete from Firebase Auth
        try {
            await admin.auth().deleteUser(uid);
            console.log(`🔥 Deleted user from Firebase Auth: ${uid}`);
        } catch (e) { }

        // Delete from Firestore
        try {
            const db = admin.firestore();
            await db.collection('users').doc(uid).delete();
            await db.collection('admins').doc(uid).delete();
            console.log(`🔥 Deleted user from Firestore: ${uid}`);
        } catch (e) { }

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
            'SELECT role, email FROM admins WHERE (uid = ? OR email = ?) AND role = "admin"',
            [uid, email]
        );

        if (users.length > 0) {
            res.json({ exists: true, data: { ...users[0] } });
        } else {
            // Check users table as well
            const [genUsers] = await pool.query(
                'SELECT role, email FROM users WHERE (uid = ? OR email = ?) AND role = "admin"',
                [uid, email]
            );
            if (genUsers.length > 0) {
                res.json({ exists: true, data: { ...genUsers[0] } });
            } else {
                res.json({ exists: false });
            }
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
        // Get campus from request body or user session
        const campus = data.campus || (req.user ? req.user.campus : 'ALL');

        console.log(`📝 Inserting outpass: ${data.passNumber} for student: ${data.studentId}`);
        
        await pool.query(
            `INSERT INTO outpasses (
                id, passNumber, studentId, studentName, category, section, 
                fatherName, whatsappNumber, requestedBy, issuedBy, status, 
                outDate, inDate, reason, issuedDate, issuedTime, 
                studentPhoto, parentPhoto, authorizedLetterPhoto, createdBy, campus
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [
                id, data.passNumber, data.studentId, data.studentName, data.category, data.section, 
                data.fatherName, data.whatsappNumber, data.requestedBy, data.issuedBy, data.status, 
                data.outDate, data.inDate, data.reason, data.issuedDate, data.issuedTime, 
                data.studentPhoto || null, data.parentPhoto || null, data.authorizedLetterPhoto || null, 
                data.createdBy || (req.user ? req.user.email : 'system'), campus
            ]
        );
        
        console.log(`✅ Outpass ${id} saved successfully`);
        res.json({ id, message: 'Saved to TiDB' });
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
        const studentId = req.params.id.toUpperCase().trim();
        const rawId = studentId.replace(/SCS/gi, '');
        const prefixedId = 'SCS' + rawId;

        console.log(`📚 Fetching student: ${studentId} (Checking ${prefixedId} and ${rawId})`);
        
        // Check for both variations
        const [rows] = await pool.query(
            'SELECT * FROM students WHERE id = ? OR id = ?', 
            [prefixedId, rawId]
        );

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
