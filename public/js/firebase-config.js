// ==========================================
// Firebase Only Configuration (V5.0)
// ==========================================

const fbConfig = {
  apiKey: "AIzaSyBFHwulhuw9NlGQi0DWzy9mU47RSO5TUkw",
  authDomain: "college-out-pass-system-62552.firebaseapp.com",
  projectId: "college-out-pass-system-62552",
  storageBucket: "college-out-pass-system-62552.firebasestorage.app",
  messagingSenderId: "71169367861",
  appId: "1:71169367861:web:7105b401d52c049476f67c"
};

// Initialize Firebase if not already initialized
if (!firebase.apps.length) {
  firebase.initializeApp(fbConfig);
}

// Global variables for the app
window.auth = firebase.auth();
window.db = firebase.firestore();

console.log("🔥 Firebase Initialized - Pure Mode (No TiDB)");