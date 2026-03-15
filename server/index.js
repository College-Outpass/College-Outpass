const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
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

        const pKey = process.env.FB_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY;
        const cEmail = process.env.FB_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL;
        const pId = process.env.FB_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;

        if (pKey && cEmail) {
            serviceAccount = {
                project_id: pId || 'college-out-pass-system-62552',
                client_email: cEmail,
                private_key: pKey
            };
            console.log('📦 Firebase: Using Individual Variables from ENV (v4.0)');
        } else if (process.env.FIREBASE_SERVICE_ACCOUNT_B64) {
            let rawData = process.env.FIREBASE_SERVICE_ACCOUNT_B64.trim();
            rawData = rawData.replace(/['"]+$/g, '').replace(/^['"]+/g, '');
            try {
                serviceAccount = JSON.parse(rawData);
            } catch (e) {
                const decoded = Buffer.from(rawData.replace(/\s+/g, ''), 'base64').toString('utf8');
                serviceAccount = JSON.parse(decoded);
            }
        } else if (fs.existsSync(serviceAccountPath)) {
            serviceAccount = require(serviceAccountPath);
            console.log('🔥 Firebase Admin: Found key.json');
        }

        if (serviceAccount) {
            if (serviceAccount.private_key) {
                let key = serviceAccount.private_key;
                let base64Only = key.replace(/\\n/g, '').replace(/\n/g, '').replace(/\s/g, '');
                base64Only = base64Only.replace('-----BEGINPRIVATEKEY-----', '').replace('-----ENDPRIVATEKEY-----', '').replace(/[^A-Za-z0-9+/=]/g, '');
                
                let formatted = '';
                for (let i = 0; i < base64Only.length; i += 64) {
                    formatted += base64Only.substring(i, i + 64) + '\n';
                }
                serviceAccount.private_key = `-----BEGIN PRIVATE KEY-----\n${formatted}-----END PRIVATE KEY-----\n`;
            }

            admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
            console.log('✅ Firebase Admin initialized successfully');
            return true;
        }
        return false;
    } catch (err) {
        console.error('❌ Firebase Init Error:', err.message);
        firebaseInitError = err.message;
        return false;
    }
}

initializeFirebase();

console.log('🚀 Firebase-Only Mode Active (Pure Cloud Architecture)');
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret12345';
const logs = [];

app.use((req, res, next) => {
    const msg = `[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`;
    logs.push(msg);
    if (logs.length > 100) logs.shift();
    console.log(msg);
    next();
});

// Auth Middleware
async function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);

    try {
        if (admin.apps.length) {
            try {
                const decodedToken = await admin.auth().verifyIdToken(token);
                const email = decodedToken.email.toLowerCase();
                const db = admin.firestore();
                let role = 'staff';
                let campus = 'ALL';
                let name = decodedToken.name || '';

                const adminDoc = await db.collection('admins').doc(decodedToken.uid).get();
                if (adminDoc.exists) {
                    role = 'admin';
                    campus = adminDoc.data().campus || 'ALL';
                    name = adminDoc.data().name || name;
                } else {
                    const userDoc = await db.collection('users').doc(decodedToken.uid).get();
                    if (userDoc.exists) {
                        role = userDoc.data().role || 'staff';
                        campus = userDoc.data().campus || 'ALL';
                        name = userDoc.data().name || name;
                    }
                }

                if (email === 'srinivasnaidu.m@srichaitanyaschool.net') role = 'admin';

                req.user = { uid: decodedToken.uid, email, role, campus, name };
                return next();
            } catch (fbErr) {}
        }
        res.sendStatus(403);
    } catch (e) {
        res.sendStatus(403);
    }
}

// Routes
app.get('/', (req, res) => res.json({ service: 'Outpass API', status: 'Online', mode: 'Firebase-Only' }));

app.get('/diag/db', async (req, res) => {
    try {
        const db = admin.firestore();
        const users = await db.collection('users').count().get();
        const admins = await db.collection('admins').count().get();
        const security = await db.collection('security').count().get();
        const students = await db.collection('students').count().get();
        const outpasses = await db.collection('outpasses').count().get();

        res.json({
            status: 'connected',
            provider: 'Firestore',
            counts: {
                users: users.data().count,
                admins: admins.data().count,
                security: security.data().count,
                students: students.data().count,
                outpasses: outpasses.data().count
            }
        });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// User Management
app.post('/api/users', async (req, res) => {
    try {
        const { email, password, name, campus, role } = req.body;
        if (!email || !password || !campus) return res.status(400).json({ error: 'Missing fields' });
        
        const emailLower = email.toLowerCase();
        const fbUser = await admin.auth().createUser({ email: emailLower, password, displayName: name || null });
        
        const db = admin.firestore();
        const userData = { uid: fbUser.uid, email: emailLower, name: name || null, campus, role: role || 'staff', updatedAt: admin.firestore.FieldValue.serverTimestamp() };
        
        await db.collection('users').doc(fbUser.uid).set(userData);
        if (role === 'admin') await db.collection('admins').doc(fbUser.uid).set(userData);

        res.json({ success: true, uid: fbUser.uid });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/users', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
    try {
        const db = admin.firestore();
        const snapshot = await db.collection('users').get();
        const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Security Management
app.get('/api/security', async (req, res) => {
    try {
        const { campus } = req.query;
        const db = admin.firestore();
        let query = db.collection('security');
        if (campus) query = query.where('campus', '==', campus);
        const snapshot = await query.get();
        res.json(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/security', async (req, res) => {
    try {
        const { name, campus, whatsappNumber } = req.body;
        if (!name || !campus || !whatsappNumber) return res.status(400).json({ error: 'Missing data' });
        const db = admin.firestore();
        const doc = await db.collection('security').add({ name, campus, whatsappNumber, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        res.json({ success: true, id: doc.id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Students
app.get('/api/students/:id', async (req, res) => {
    try {
        const sid = req.params.id.toUpperCase().trim();
        const rawId = sid.replace(/SCS/gi, '');
        const db = admin.firestore();
        let doc = await db.collection('students').doc('SCS' + rawId).get();
        if (!doc.exists) doc = await db.collection('students').doc(rawId).get();
        if (!doc.exists) return res.json({ exists: false });
        res.json({ exists: true, data: { id: doc.id, ...doc.data() } });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/students', async (req, res) => {
    try {
        const { studentId, studentName, campus } = req.body;
        if (!studentId) return res.status(400).json({ error: 'ID required' });
        const db = admin.firestore();
        await db.collection('students').doc(studentId.toUpperCase()).set({ ...req.body, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Outpasses & mediSlips
app.post('/api/outpasses', authenticateToken, async (req, res) => {
    try {
        const db = admin.firestore();
        const doc = await db.collection('outpasses').add({ ...req.body, createdAt: admin.firestore.FieldValue.serverTimestamp() });
        res.json({ id: doc.id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/mediSlips', authenticateToken, async (req, res) => {
    try {
        const db = admin.firestore();
        const doc = await db.collection('mediSlips').add({ ...req.body, createdAt: admin.firestore.FieldValue.serverTimestamp() });
        res.json({ id: doc.id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/outpasses', authenticateToken, async (req, res) => {
    try {
        const snapshot = await admin.firestore().collection('outpasses').orderBy('createdAt', 'desc').limit(100).get();
        res.json(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/migrate/security-batch', async (req, res) => {
    try {
        const { entries } = req.body;
        const db = admin.firestore();
        const batch = db.batch();
        entries.forEach(e => {
            const ref = db.collection('security').doc();
            batch.set(ref, { ...e, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        });
        await batch.commit();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Final fallback for static files
app.use(express.static(path.join(__dirname, '../public')));

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Firebase-Only Server running on port ${PORT}`);
});
