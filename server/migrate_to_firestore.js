const admin = require('firebase-admin');
const { pool, initDb } = require('./db');
const serviceAccount = require('../key.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function migrateUsers() {
    await initDb();
    console.log('Fetching users from TiDB...');
    const [users] = await pool.query('SELECT * FROM transfer_admins');
    
    console.log(`Found ${users.length} users in TiDB. Migrating to Firestore...`);
    
    for (const user of users) {
        try {
            // Update Firestore 'users' collection
            await db.collection('users').doc(user.uid || user.email).set({
                uid: user.uid,
                email: user.email.toLowerCase(),
                name: user.name,
                campus: user.campus,
                role: user.role,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            
            // Also update 'admins' collection if they are admin
            if (user.role === 'admin') {
                await db.collection('admins').doc(user.uid || user.email).set({
                    uid: user.uid,
                    email: user.email.toLowerCase(),
                    name: user.name,
                    campus: user.campus,
                    role: 'admin',
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            }
            
            console.log(`Migrated: ${user.email} (${user.role})`);
        } catch (err) {
            console.error(`Failed to migrate ${user.email}:`, err.message);
        }
    }
    
    console.log('Migration complete!');
    process.exit(0);
}

migrateUsers();
