const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '../key.json');
if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log('🔥 Firebase Admin initialized');
} else {
    console.error('❌ key.json not found. Current dir:', __dirname);
    process.exit(1);
}

const HOD_EMAIL = 'srinivasnaidu.m@srichaitanyaschool.net';
const DEFAULT_PASSWORD = 'admin123';

async function ensureAdmin() {
    try {
        console.log(`Checking Firebase Auth for ${HOD_EMAIL}...`);
        let user;
        try {
            user = await admin.auth().getUserByEmail(HOD_EMAIL);
            console.log('✅ User already exists in Auth. Updating password...');
            await admin.auth().updateUser(user.uid, {
                password: DEFAULT_PASSWORD
            });
        } catch (e) {
            console.log('User not found. Creating in Auth...');
            user = await admin.auth().createUser({
                uid: 'admin_hod',
                email: HOD_EMAIL,
                password: DEFAULT_PASSWORD,
                displayName: 'Head of Department'
            });
        }

        console.log('Syncing Firestore profile...');
        await admin.firestore().collection('admins').doc(user.uid).set({
            uid: user.uid,
            email: HOD_EMAIL,
            name: 'Head of Department',
            role: 'admin',
            campus: 'ALL',
            updated_at: new Date().toISOString()
        }, { merge: true });

        console.log('\n--- SUCCESS ---');
        console.log(`HOD Admin is ready in Firebase.`);
        console.log(`Email: ${HOD_EMAIL}`);
        console.log(`Password: ${DEFAULT_PASSWORD}`);
        console.log('----------------\n');
        
    } catch (err) {
        console.error('❌ FATAL ERROR:', err.message);
    } finally {
        process.exit();
    }
}

ensureAdmin();
