const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const XLSX = require('xlsx');
const cron = require('node-cron');

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

            admin.initializeApp({ 
                credential: admin.credential.cert(serviceAccount),
                storageBucket: pId ? `${pId}.firebasestorage.app` : 'college-out-pass-system-62552.firebasestorage.app'
            });
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
                    userData = adminDoc.data();
                    role = userData.role || 'admin';
                    campus = userData.campus || 'ALL';
                    name = userData.name || name;
                } else {
                    const userDoc = await db.collection('users').doc(decodedToken.uid).get();
                    if (userDoc.exists) {
                        userData = userDoc.data();
                        role = userData.role || 'staff';
                        campus = userData.campus || 'ALL';
                        name = userData.name || name;
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

// --- STABILITY & RECOVERY SYSTEM (PERMANENT SOLUTION) ---
// 1. Robotic Health Check: Dedicated endpoint for UptimeRobot
app.get('/api/health', (req, res) => {
    const memoryUsage = process.memoryUsage();
    res.status(200).json({
        service: 'Outpass API',
        status: 'Online',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        firebase: admin.apps.length > 0 ? 'connected' : 'error',
        memory: {
            rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
            heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`
        }
    });
});

// 2. Active Self-Ping System: Prevents Render from sleeping
const SELF_URL = process.env.RENDER_EXTERNAL_URL || 'https://college-outpass-api.onrender.com';
setInterval(() => {
    const http = require('http');
    const https = require('https');
    const client = SELF_URL.startsWith('https') ? https : http;
    
    client.get(`${SELF_URL}/api/health`, (res) => {
        console.log(`💓 Self-ping (Health Check): ${res.statusCode}`);
    }).on('error', (err) => {
        console.error('❌ Self-ping failed:', err.message);
    });
}, 300000); // Every 5 minutes

// 3. Main Routes
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
        if (role === 'admin' || role === 'hod') await db.collection('admins').doc(fbUser.uid).set(userData);

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

// --- DATABASE MAINTENANCE (CLEANUP & BACKUP) ---
async function performCleanup() {
    try {
        const db = admin.firestore();
        const bucket = admin.storage().bucket();
        console.log('🧹 [CRON] Starting Automated Database Cleanup...');

        // 1. Fetch all outpasses and mediSlips
        const [outpassSnap, mediSnap] = await Promise.all([
            db.collection('outpasses').get(),
            db.collection('mediSlips').get()
        ]);

        const allRecords = [];
        outpassSnap.forEach(doc => allRecords.push({ id: doc.id, collection: 'outpasses', ...doc.data() }));
        mediSnap.forEach(doc => allRecords.push({ id: doc.id, collection: 'mediSlips', ...doc.data() }));

        if (allRecords.length === 0) {
            console.log('✨ [CRON] No records found to clean up.');
            return { success: true, message: 'No records found to clean up.' };
        }

        // 2. Identify the oldest date
        const dates = allRecords.map(r => {
            if (r.createdAt && r.createdAt.toDate) return r.createdAt.toDate().toISOString().split('T')[0];
            if (r.date && r.date !== 'N/A') return r.date;
            if (r.outDate) return r.outDate;
            if (r.issuedDate) return r.issuedDate;
            return null;
        }).filter(d => d !== null);

        if (dates.length === 0) {
            console.log('⚠️ [CRON] Could not determine record dates.');
            return { success: false, error: 'Could not determine record dates.' };
        }

        const sortedDates = [...new Set(dates)].sort();
        const oldestDate = sortedDates[0];
        
        // Don't delete today's only records
        if (sortedDates.length <= 1) {
            console.log(`✨ [CRON] Only records for ${oldestDate} found. Skipping deletion.`);
            return { success: true, message: `Only records for ${oldestDate} found. Keeping them.` };
        }

        // 3. Filter records for the oldest date
        const recordsToDelete = allRecords.filter(r => {
            const rDate = (r.createdAt && r.createdAt.toDate) ? r.createdAt.toDate().toISOString().split('T')[0] : (r.date || r.outDate || r.issuedDate);
            return rDate === oldestDate;
        });

        console.log(`📦 [CRON] Archiving ${recordsToDelete.length} records from ${oldestDate}...`);

        // 4. Generate Excel data
        const excelData = recordsToDelete.map(r => ({
            ID: r.id,
            Type: r.collection,
            PassNumber: r.passNumber || r.mediSlipNumber || '--',
            StudentName: r.studentName || '--',
            StudentID: r.studentId || '--',
            Date: oldestDate,
            Reason: r.reason || '--',
            Campus: r.campus || '--',
            CreatedBy: r.createdBy || '--',
            Status: r.status || '--'
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(excelData);
        XLSX.utils.book_append_sheet(wb, ws, "Backup");

        // 5. Save to local temp and upload to Firebase Storage (Persistent)
        const fileName = `backups/backup_${oldestDate}_${Date.now()}.xlsx`;
        const tempPath = path.join(__dirname, `temp_backup_${Date.now()}.xlsx`);
        XLSX.writeFile(wb, tempPath);

        // Upload to Storage
        await bucket.upload(tempPath, {
            destination: fileName,
            metadata: { contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
        });

        // Delete temp file
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        console.log(`✅ [CRON] Backup uploaded to Firebase Storage: ${fileName}`);

        // 6. Delete from Firestore in batches
        const batch = db.batch();
        recordsToDelete.forEach(r => {
            const ref = db.collection(r.collection).doc(r.id);
            batch.delete(ref);
        });

        await batch.commit();
        console.log(`🗑️ [CRON] Deleted ${recordsToDelete.length} records from ${oldestDate}.`);

        return {
            success: true,
            message: `Successfully archived and deleted ${recordsToDelete.length} records from ${oldestDate}.`,
            count: recordsToDelete.length,
            date: oldestDate
        };

    } catch (err) {
        console.error('❌ [CRON] Cleanup Error:', err);
        return { success: false, error: err.message };
    }
}

// Scheduled Task: Run every day at 00:00 (Midnight)
cron.schedule('0 0 * * *', () => {
    performCleanup().then(res => {
        if (res.success) console.log('✅ Automated Daily Cleanup Finished:', res.message);
        else console.log('❌ Automated Daily Cleanup Failed:', res.error);
    });
});

app.post('/api/admin/cleanup', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
    const result = await performCleanup();
    if (result.success) res.json(result);
    else res.status(500).json(result);
});

// --- LIST BACKUPS FOR HOD ---
app.get('/api/admin/backups', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
    
    try {
        const bucket = admin.storage().bucket();
        const [files] = await bucket.getFiles({ prefix: 'backups/' });
        
        const backupList = files.map(file => ({
            name: file.name.replace('backups/', ''),
            path: file.name,
            size: file.metadata.size,
            updated: file.metadata.updated
        }));

        res.json({ success: true, backups: backupList.sort((a, b) => new Date(b.updated) - new Date(a.updated)) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- DOWNLOAD BACKUP ---
app.get('/api/admin/backups/download', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
    
    const fileName = req.query.file;
    if (!fileName) return res.status(400).json({ error: 'File name required' });

    try {
        const bucket = admin.storage().bucket();
        const file = bucket.file(`backups/${fileName}`);
        
        const [exists] = await file.exists();
        if (!exists) return res.status(404).json({ error: 'Backup file not found' });

        // Download to buffer and send
        const [content] = await file.download();
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
        res.send(content);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Final fallback for static files
app.use(express.static(path.join(__dirname, '../public')));

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Firebase-Only Server running on port ${PORT}`);
});
