// ==========================================
// TiDB <-> Firebase Bridge (V2.5)
// ==========================================

const RENDER_URL = 'https://college-outpass-api.onrender.com';
const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:5000/api'
  : `${RENDER_URL}/api`;

console.log("🚀 TiDB Bridge Initializing...");

// 1. SETUP REAL FIREBASE (If not already done)
const fbConfig = {
  apiKey: "AIzaSyBFHwulhuw9NlGQi0DWzy9mU47RSO5TUkw",
  authDomain: "college-out-pass-system-62552.firebaseapp.com",
  projectId: "college-out-pass-system-62552",
  storageBucket: "college-out-pass-system-62552.firebasestorage.app",
  messagingSenderId: "71169367861",
  appId: "1:71169367861:web:7105b401d52c049476f67c"
};

if (!firebase.apps.length) {
  firebase.initializeApp(fbConfig);
}

// 2. DEFINE THE TIDB PROXY
class TiDBFirestoreProxy {
  constructor() {
    this.FieldValue = firebase.firestore.FieldValue;
  }

  collection(colName) {
    return {
      doc: (docId) => ({
        path: docId,
        delete: async () => {
          const user = firebase.auth().currentUser;
          const token = user ? await user.getIdToken() : '';
          const response = await fetch(`${API_URL}/${colName}/${docId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          return { success: response.ok };
        },
        get: async () => {
          const user = firebase.auth().currentUser;
          const token = user ? await user.getIdToken() : '';

          // Admin check fallback
          if (colName === 'admins') {
            try {
              const res = await fetch(`${API_URL}/admins/${docId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
              });
              if (!res.ok) throw new Error();
              const result = await res.json();
              return { exists: result.exists, data: () => result.data };
            } catch (e) {
              // Local safety check for HOD
              if (user && user.email === 'srinivasnaidu.m@srichaitanyaschool.net') {
                return { exists: true, data: () => ({ email: user.email, role: 'admin' }) };
              }
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
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Request failed');
        return { id: result.id };
      },
      get: async () => {
        const user = firebase.auth().currentUser;
        const token = user ? await user.getIdToken() : '';
        const response = await fetch(`${API_URL}/${colName}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const rawData = await response.json().catch(() => []);
        const docs = rawData.map(d => ({
          id: d.id,
          data: () => ({ ...d, whatsappNumber: d.whatsapp_number || d.whatsappNumber })
        }));
        return {
          empty: docs.length === 0,
          docs: docs,
          forEach: (cb) => docs.forEach(cb),
          size: docs.length
        };
      },
      where: () => this.collection(colName),
      orderBy: () => this.collection(colName)
    };
  }

  async runTransaction(callback) {
    let mockRef;
    const mockTransaction = {
      get: async (ref) => { mockRef = ref; return { exists: true, data: () => ({ count: 1 }) }; },
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

// 3. EXPOSE GLOBAL VARIABLES
// window.auth REMAINS REAL FIREBASE AUTH
window.auth = firebase.auth();
// window.db BECOMES THE TIDB PROXY
window.db = new TiDBFirestoreProxy();

console.log("✅ TiDB Bridge: Auth=Firebase, DB=TiDB");