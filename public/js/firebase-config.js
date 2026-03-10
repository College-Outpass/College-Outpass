// ==========================================
// TiDB <-> Firebase Bridge Configuration
// ==========================================

// Your Render URL (Backend API)
const RENDER_URL = 'https://college-outpass-api.onrender.com';

// Local vs Production API selection
const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:5000/api'
  : `${RENDER_URL}/api`;

console.log("🚀 TiDB Bridge: Using API at", API_URL);

// Standard Firebase Config (shared across files)
const firebaseConfig = {
  apiKey: "AIzaSyBFHwulhuw9NlGQi0DWzy9mU47RSO5TUkw",
  authDomain: "college-out-pass-system-62552.firebaseapp.com",
  projectId: "college-out-pass-system-62552",
  storageBucket: "college-out-pass-system-62552.firebasestorage.app",
  messagingSenderId: "71169367861",
  appId: "1:71169367861:web:7105b401d52c049476f67c"
};

// Initialize Real Firebase for AUTH and HOSTING
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Keep real Auth
window.auth = firebase.auth();

// Create Proxy for Firestore to redirect data to TiDB
class TiDBFirestoreProxy {
  constructor() {
    this.FieldValue = firebase.firestore.FieldValue;
  }

  collection(colName) {
    return {
      doc: (docId) => ({
        path: docId,
        delete: async () => {
          // Get Firebase ID Token for security
          const user = firebase.auth().currentUser;
          const token = user ? await user.getIdToken() : '';

          const response = await fetch(`${API_URL}/${colName}/${docId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (!response.ok) throw new Error("Failed to delete from TiDB");
          return { success: true };
        },
        get: async () => {
          const user = firebase.auth().currentUser;
          const token = user ? await user.getIdToken() : '';

          // Admin check is the most common .doc().get() call
          if (colName === 'admins') {
            try {
              const response = await fetch(`${API_URL}/admins/${docId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
              });
              // If Render is down/old, fallback to allowing the known HOD
              if (!response.ok) {
                console.warn("TiDB Admin check failed, checking local HOD rule");
                const email = user ? user.email : '';
                if (email === 'srinivasnaidu.m@srichaitanyaschool.net') {
                  return { exists: true, data: () => ({ email, role: 'admin' }) };
                }
                return { exists: false };
              }
              const result = await response.json();
              return {
                exists: result.exists,
                data: () => result.data
              };
            } catch (e) {
              // Fallback for HOD while Render updates
              if (user && user.email === 'srinivasnaidu.m@srichaitanyaschool.net') {
                return { exists: true, data: () => ({ email: user.email, role: 'admin' }) };
              }
              return { exists: false };
            }
          }
          return { exists: false, data: () => null };
        }
      }),
      add: async (data) => {
        const user = firebase.auth().currentUser;
        const token = user ? await user.getIdToken() : '';

        const response = await fetch(`${API_URL}/${colName}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error("Failed to save to TiDB");
        const result = await response.json();
        return { id: result.id };
      },
      get: async () => {
        const user = firebase.auth().currentUser;
        const token = user ? await user.getIdToken() : '';

        const response = await fetch(`${API_URL}/${colName}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) return { empty: true, docs: [], forEach: () => { } };

        const rawData = await response.json();
        const docs = rawData.map(d => ({
          id: d.id,
          data: () => ({ ...d, whatsappNumber: d.whatsapp_number || d.whatsappNumber })
        }));

        return {
          empty: docs.length === 0,
          docs: docs,
          forEach: (cb) => docs.forEach(cb)
        };
      },
      orderBy: () => this.collection(colName),
      where: () => this.collection(colName)
    };
  }

  async runTransaction(callback) {
    // Simplified transaction proxy for ID counters
    let mockRef;
    const mockTransaction = {
      get: async (ref) => {
        mockRef = ref;
        return { exists: true, data: () => ({ count: 1 }) };
      },
      set: () => { }
    };

    await callback(mockTransaction);

    const user = firebase.auth().currentUser;
    const token = user ? await user.getIdToken() : '';

    const response = await fetch(`${API_URL}/settings/increment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ collection: 'settings', doc: mockRef.path })
    });

    const result = await response.json();
    return result.currentCount;
  }
}

// Set global DB to use the TiDB Proxy
if (!window.dbBridgedFlag) {
  window.db = new TiDBFirestoreProxy();
  window.dbBridgedFlag = true;
  console.log("✅ TiDB <-> Firebase Bridge active (Auth via Firebase, Data via TiDB)");
}