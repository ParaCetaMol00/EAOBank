

import { auth, db } from "../firebase/signIn-signUp.js";

import { onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";

import { doc, getDoc }
  from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";


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
          
          alert("Access denied. Admins only.");
          window.location.href = "../dashboard.html";
          return;
        }

        
        resolve(user);

      } catch (err) {
        console.error("Auth guard error:", err);
        window.location.href = "./SignIn.html";
      }
    });
  });
}