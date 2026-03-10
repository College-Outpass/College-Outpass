const admin = require('firebase-admin');
require('dotenv').config();
const serviceAccount = require('../key.json');

async function searchStudents() {
    console.log('🧐 SEARCHING STUDENTS FOR "Ropaka"...');
    try {
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
        const fb = admin.firestore();

        const snapshot = await fb.collection('students').get();
        console.log(`Checking ${snapshot.size} students...`);
        snapshot.forEach(doc => {
            const d = doc.data();
            const str = JSON.stringify(d).toLowerCase();
            if (str.includes('ropaka')) {
                console.log('✅ FOUND IN STUDENTS:', doc.id);
                console.log(JSON.stringify(d, null, 2));
            }
        });
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
searchStudents();
