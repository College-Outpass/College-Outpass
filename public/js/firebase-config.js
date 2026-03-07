// ==========================================
// REPLACE WITH YOUR ACTUAL RENDER URL LATER
// ==========================================
const RENDER_URL = 'https://outpass-api.onrender.com';

const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:5000/api'
  : `${RENDER_URL}/api`;


class MockAuth {
  constructor() {
    this.currentUser = JSON.parse(sessionStorage.getItem('authUser') || 'null');
    this.listeners = [];
  }

  onAuthStateChanged(callback) {
    this.listeners.push(callback);
    setTimeout(() => callback(this.currentUser), 0);
    return () => { };
  }

  async signInWithEmailAndPassword(email, password) {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const err = new Error(errData.code || 'Login failed');
      err.code = errData.code;
      throw err;
    }

    const data = await response.json();
    const user = data.user;
    this.currentUser = user;
    sessionStorage.setItem('authUser', JSON.stringify(user));
    sessionStorage.setItem('authToken', data.token);
    this.listeners.forEach(cb => cb(this.currentUser));
    return { user };
  }

  async signOut() {
    this.currentUser = null;
    sessionStorage.removeItem('authUser');
    sessionStorage.removeItem('authToken');
    this.listeners.forEach(cb => cb(null));
  }
}

class MockFirestore {
  constructor() { }

  collection(colName) {
    return {
      doc: (docId) => ({
        path: docId,
        get: async () => {
          if (colName === 'admins') {
            const token = sessionStorage.getItem('authToken');
            const response = await fetch(`${API_URL}/admins/${docId}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await response.json();
            return {
              exists: result.exists,
              data: () => result.data
            };
          }
          return { exists: false, data: () => null };
        }
      }),
      add: async (data) => {
        const token = sessionStorage.getItem('authToken');
        const response = await fetch(`${API_URL}/${colName}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error("Failed to add data");
        const result = await response.json();
        return { id: result.id };
      },
      orderBy: (field, direction) => {
        return this.collection(colName);
      },
      get: async () => {
        const token = sessionStorage.getItem('authToken');
        const response = await fetch(`${API_URL}/${colName}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error("Failed to get data");

        // Backend returns an array of objects
        const rawData = await response.json();

        const docsObj = rawData.map(d => ({
          id: d.id,
          data: () => {
            const r = d.data();
            // Firebase specific parsing simulation
            return r;
          }
        }));

        return {
          empty: rawData.length === 0,
          docs: rawData.map(d => {
            const objData = d.data();
            return {
              id: d.id,
              data: () => objData
            };
          }),
          forEach: (cb) => {
            rawData.forEach(d => {
              const objData = d.data();
              cb({
                id: d.id,
                data: () => objData
              });
            });
          }
        };
      }
    };
  }

  async runTransaction(callback) {
    let mockRef;
    const mockTransaction = {
      get: async (ref) => {
        mockRef = ref;
        return { exists: true, data: () => ({ count: 1 }) };
      },
      set: () => { }
    };

    await callback(mockTransaction);

    const token = sessionStorage.getItem('authToken');
    const response = await fetch(`${API_URL}/settings/increment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ collection: 'settings', doc: mockRef.path })
    });

    const result = await response.json();
    return result.currentCount;
  }
}

// Intercept window.firebase
window.firebase = {
  initializeApp: () => { },
  auth: () => new MockAuth(),
  firestore: () => {
    const firestoreObj = new MockFirestore();
    firestoreObj.FieldValue = {
      serverTimestamp: () => new Date().toISOString()
    };
    return firestoreObj;
  }
};

window.auth = window.firebase.auth();
window.db = window.firebase.firestore();

// Patch server backend's format map
const originalFetch = window.fetch;
window.fetch = async function () {
  const res = await originalFetch.apply(this, arguments);
  if (res.url.includes('/api/outpasses') && arguments[1]?.method === undefined) {
    const json = await res.json();
    const mockedRes = new Response(JSON.stringify(
      json.map(item => ({
        id: item.id,
        data: () => item.data() // Will error on json stringify unless careful
      }))
    ));
  }
  return res;
};

console.log("TiDB Proxy initialized successfully!");