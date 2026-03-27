// =============================================
// firebase.js — Firebase Initialization
// =============================================
// Replace the placeholders below with your
// actual Firebase project configuration from:
// https://console.firebase.google.com/
// Project Settings → Your Apps → Firebase SDK snippet
// =============================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

// ⚠️ Replace these values with your own Firebase config
const firebaseConfig = {
    apiKey: "AIzaSyBd5Slv65jPEqImW2XIvy7EYNc8pByeGSg",
    authDomain: "eaobank-ec500.firebaseapp.com",
    projectId: "eaobank-ec500",
    storageBucket: "eaobank-ec500.firebasestorage.app",
    messagingSenderId: "306553380148",
    appId: "1:306553380148:web:69b1268fd00ec332451961"
};


// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Export for use in login.js and signup.js
export { auth, db };