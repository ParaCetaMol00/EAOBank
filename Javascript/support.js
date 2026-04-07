// support.js — Location: Javascript/support.js
// Accessible to both logged-in and non-logged users

import { auth, db } from "../firebase/signIn-signUp.js";
import { onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import {
  doc, getDoc, collection,
  addDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

function showMessage(type, text) {
  const box = document.getElementById("formMessage");
  box.className   = "message " + type;
  box.textContent = text;
  // Scroll to message
  box.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// ── Auto-fill if user is logged in ───────────
onAuthStateChanged(auth, async (user) => {
  if (!user) return; // not logged in — leave form empty

  try {
    const userSnap = await getDoc(doc(db, "users", user.uid));
    if (!userSnap.exists()) return;

    const data = userSnap.data();

    // Auto-fill name, email, account number
    if (data.fullName)      document.getElementById("fullName").value      = data.fullName;
    if (data.email)         document.getElementById("email").value         = data.email;
    if (data.accountNumber) document.getElementById("accountNumber").value = data.accountNumber;

    // Make auto-filled fields read-only so user can't accidentally clear them
    document.getElementById("fullName").readOnly      = true;
    document.getElementById("email").readOnly         = true;
    document.getElementById("accountNumber").readOnly = true;

  } catch (err) {
    console.error("Error auto-filling support form:", err);
  }
});

// ── Form Submission ───────────────────────────
document.getElementById("supportForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const fullName      = document.getElementById("fullName").value.trim();
  const email         = document.getElementById("email").value.trim();
  const accountNumber = document.getElementById("accountNumber").value.trim();
  const issueType     = document.getElementById("issueType").value;
  const message       = document.getElementById("message").value.trim();
  const btn           = document.getElementById("submitBtn");

  // Validate
  if (!fullName) { showMessage("error", "Please enter your full name."); return; }
  if (!email || !/\S+@\S+\.\S+/.test(email)) {
    showMessage("error", "Please enter a valid email address."); return;
  }
  if (!issueType) { showMessage("error", "Please select an issue type."); return; }
  if (!message || message.length < 10) {
    showMessage("error", "Please describe your issue (at least 10 characters)."); return;
  }

  btn.disabled  = true;
  btn.innerHTML = "Submitting…";

  try {
    await addDoc(collection(db, "support"), {
      userId: auth.currentUser ? auth.currentUser.uid : null,
      fullName:      fullName,
      email:         email,
      accountNumber: accountNumber || "",
      issueType:     issueType,
      message:       message,
      status:        "open",
      createdAt:     serverTimestamp()
    });

    showMessage(
      "success",
      "Your complaint has been submitted. Our team will contact you shortly."
    );

    // Clear form (but keep auto-filled fields)
    document.getElementById("issueType").value = "";
    document.getElementById("message").value   = "";

    // If fields weren't auto-filled, also clear them
    if (!document.getElementById("fullName").readOnly) {
      document.getElementById("fullName").value      = "";
      document.getElementById("email").value         = "";
      document.getElementById("accountNumber").value = "";
    }

  } catch (err) {
    console.error("Support submit error:", err);
    showMessage("error", "Failed to submit. Please try again.");
  } finally {
    btn.disabled  = false;
    btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submit Complaint';
  }
});