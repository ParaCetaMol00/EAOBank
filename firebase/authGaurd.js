// =============================================
// authGuard.js — Reusable Auth Guard
// Location: Javascript/authGuard.js
// =============================================
// HOW TO USE:
// Import and call guardPage() at the top of any
// protected page's JS file, like this:
//
//   import { guardPage, guardAdmin } from "./authGuard.js";
//   guardPage();   // for regular user pages
//   guardAdmin();  // for admin-only pages
// =============================================

import { auth, db } from "../firebase/signIn-signUp.js";

import { onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";

import { doc, getDoc }
  from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

// ── guardPage ────────────────────────────────
// Use this on all regular user pages.
// Redirects to SignIn.html if no user is logged in.
// Returns a Promise that resolves with the Firebase user object.
export function guardPage() {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, (user) => {
      if (!user) {
        // Not logged in — redirect to login
        window.location.href = "./SignIn.html";
        return;
      }
      // Logged in — pass the user object back
      resolve(user);
    });
  });
}

// ── guardAdmin ───────────────────────────────
// Use this on the admin page only.
// Checks Firebase Auth AND Firestore role.
// Redirects if not logged in OR not an admin.
// Returns a Promise that resolves with the user object if admin.
export function guardAdmin() {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.href = "./SignIn.html";
        return;
      }

      try {
        // Check the user's role in Firestore
        const userSnap = await getDoc(doc(db, "users", user.uid));

        if (!userSnap.exists() || userSnap.data().role !== "admin") {
          // Not an admin — redirect to dashboard
          alert("Access denied. Admins only.");
          window.location.href = "../dashboard.html";
          return;
        }

        // User is admin — resolve with user object
        resolve(user);

      } catch (err) {
        console.error("Auth guard error:", err);
        window.location.href = "./SignIn.html";
      }
    });
  });
}