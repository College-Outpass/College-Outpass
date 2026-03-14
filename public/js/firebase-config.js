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

// 2. DEFINE THE selective TIDB PROXY (ONLY for large data if needed)
// But following user request: "use completely the firebase only"
// We will reset window.db to REAL Firestore.

// To prevent data loss, we'll keep a small helper if they ever want to access TiDB data
window.tidb = {
    get: async (collection, id) => {
        const res = await fetch(`${API_URL}/${collection}/${id}`);
        return res.json();
    }
};

// 3. EXPOSE GLOBAL VARIABLES
// window.auth is REAL FIREBASE AUTH
window.auth = firebase.auth();
// window.db is NOW REAL FIREBASE FIRESTORE
window.db = firebase.firestore();

console.log("✅ Firebase Mode: Auth and DB are now PURE FIREBASE");
console.log("⚠️ Note: Outpasses and Staff will now be saved to and fetched from Firestore.");

console.log("✅ TiDB Bridge: Auth=Firebase, DB=TiDB");