// =============================================
// profile.js — Profile Page Logic
// Location: Javascript/profile.js
// =============================================

import { auth, db } from "../firebase/signIn-signUp.js";

import { onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";

import {
  doc, getDoc, updateDoc
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

// ── Helpers ──────────────────────────────────

function formatCurrency(amount) {
  return "$" + Number(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatDate(timestamp) {
  if (!timestamp) return "—";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString("en-NG", {
    day: "2-digit", month: "long", year: "numeric"
  });
}

function showMessage(type, text) {
  const box = document.getElementById("message");
  box.className = "message " + type;
  box.textContent = text;
  setTimeout(() => {
    box.className = "message";
    box.textContent = "";
  }, 5000);
}

// ── Stored user uid ───────────────────────────
let currentUid = null;

// ── Load and Display User Profile ────────────
async function loadProfile(uid) {
  try {
    const userSnap = await getDoc(doc(db, "users", uid));

    if (!userSnap.exists()) {
      console.error("No profile found for this user.");
      return;
    }

    const data = userSnap.data();

    // Navbar greeting
    const firstName = data.fullName ? data.fullName.split(" ")[0] : "User";
    document.getElementById("navGreeting").textContent = "Hello, " + firstName;

    // Profile avatar — first letter of full name
    document.getElementById("profileAvatar").textContent =
      data.fullName ? data.fullName.charAt(0).toUpperCase() : "?";

    // Profile heading
    document.getElementById("profileName").textContent = data.fullName || "—";
    document.getElementById("profileRole").textContent = data.role || "user";

    // Detail fields
    document.getElementById("detailName").textContent          = data.fullName      || "—";
    document.getElementById("detailEmail").textContent         = data.email         || "—";
    document.getElementById("detailPhone").textContent         = data.phone         || "—";
    document.getElementById("detailAccountType").textContent   = data.accountType   || "—";
    document.getElementById("detailAccountNumber").textContent = data.accountNumber || "—";
    document.getElementById("detailBalance").textContent       = formatCurrency(data.balance || 0);
    document.getElementById("detailCreated").textContent       = formatDate(data.createdAt);

  } catch (err) {
    console.error("Error loading profile:", err);
  }
}

// ── Handle Phone Number Update ────────────────
document.getElementById("editPhoneForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const newPhone = document.getElementById("newPhone").value.trim();
  const btn      = document.getElementById("editBtn");

  // Validate phone
  if (!newPhone || newPhone.length < 7 || !/^\d+$/.test(newPhone)) {
    showMessage("error", "Please enter a valid phone number (digits only).");
    return;
  }

  if (!currentUid) {
    showMessage("error", "User not loaded. Please refresh.");
    return;
  }

  btn.disabled  = true;
  btn.textContent = "Saving…";

  try {
    // Update phone number in Firestore
    await updateDoc(doc(db, "users", currentUid), { phone: newPhone });

    // Update the displayed phone number instantly
    document.getElementById("detailPhone").textContent = newPhone;

    showMessage("success", "Phone number updated successfully!");
    document.getElementById("newPhone").value = "";

  } catch (err) {
    console.error("Phone update error:", err);
    showMessage("error", "Failed to update phone number. Please try again.");

  } finally {
    btn.disabled    = false;
    btn.textContent = "Save";
  }
});

// ── Auth Guard ────────────────────────────────
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "./SignIn.html";
    return;
  }
  currentUid = user.uid;
  loadProfile(user.uid);
});