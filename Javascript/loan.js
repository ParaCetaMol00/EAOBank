// loan.js — Location: Javascript/loan.js

import { auth, db } from "../firebase/signIn-signUp.js";
import { onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import {
  doc, getDoc, collection,
  addDoc, query, where,
  getDocs, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

function formatCurrency(amount) {
  return "$" + Number(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  });
}

function formatDate(timestamp) {
  if (!timestamp) return "—";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString("en-US", {
    day: "2-digit", month: "short", year: "numeric"
  });
}

function showMessage(type, text) {
  const box = document.getElementById("message");
  box.className   = "message " + type;
  box.textContent = text;
  setTimeout(() => { box.className = "message"; box.textContent = ""; }, 6000);
}

let currentUser     = null;
let currentUserData = null;

// ── Load user and auto-fill ───────────────────
async function loadUserData(uid) {
  try {
    const userSnap = await getDoc(doc(db, "users", uid));
    if (!userSnap.exists()) return;

    currentUserData = userSnap.data();
    const firstName = currentUserData.fullName
      ? currentUserData.fullName.split(" ")[0] : "User";

    document.getElementById("navGreeting").textContent = "Hello, " + firstName;
    document.getElementById("fullName").value          = currentUserData.fullName      || "";
    document.getElementById("accountNumber").value     = currentUserData.accountNumber || "";

    // Warn unverified users before they even submit
    if (!currentUserData.verified) {
      showMessage(
        "error",
        "⚠ Your account is not verified. Loan applications will be automatically declined. " +
        "Please update your phone number on your profile to get verified."
      );
    }

  } catch (err) {
    console.error("Error loading user:", err);
  }
}

// ── Load previous loan applications ──────────
async function loadPreviousLoans(uid) {
  const container = document.getElementById("prevLoans");
  try {
    const snapshot = await getDocs(query(
      collection(db, "loans"),
      where("userId", "==", uid)
    ));

    if (snapshot.empty) {
      container.innerHTML = '<p class="prev-empty">No loan applications yet.</p>';
      return;
    }

    let loans = [];
    snapshot.forEach((d) => loans.push({ id: d.id, ...d.data() }));
    loans.sort((a, b) => {
      const tA = a.createdAt ? a.createdAt.toMillis() : 0;
      const tB = b.createdAt ? b.createdAt.toMillis() : 0;
      return tB - tA;
    });

    container.innerHTML = loans.map((l) => `
      <div class="prev-loan-item">
        <div class="prev-loan-info">
          <span class="prev-loan-amount">${formatCurrency(l.amount)}</span>
          <span class="prev-loan-meta">${l.type} Loan — ${l.duration} month(s)</span>
          <span class="prev-loan-meta">Purpose: ${l.purpose || "—"}</span>
          <span class="prev-loan-meta">Applied: ${formatDate(l.createdAt)}</span>
          ${l.declineReason
            ? `<span class="prev-loan-reason">Reason: ${l.declineReason}</span>`
            : ""}
        </div>
        <span class="prev-loan-status status-${l.status || "pending"}">
          ${l.status || "pending"}
        </span>
      </div>
    `).join("");

  } catch (err) {
    container.innerHTML = '<p class="prev-empty">Could not load applications.</p>';
    console.error("Error loading loans:", err);
  }
}

// ── Handle Form Submission ────────────────────
document.getElementById("loanForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const amount   = parseFloat(document.getElementById("amount").value);
  const loanType = document.getElementById("loanType").value;
  const duration = parseInt(document.getElementById("duration").value);
  const income   = parseFloat(document.getElementById("income").value);
  const purpose  = document.getElementById("purpose").value.trim();
  const btn      = document.getElementById("loanBtn");

  // Validate fields
  if (!amount || isNaN(amount) || amount <= 0) {
    showMessage("error", "Please enter a valid loan amount greater than $0."); return;
  }
  if (!loanType) {
    showMessage("error", "Please select a loan type."); return;
  }
  if (!duration || isNaN(duration) || duration < 1) {
    showMessage("error", "Please enter a valid duration in months."); return;
  }
  if (!income || isNaN(income) || income <= 0) {
    showMessage("error", "Please enter your monthly income."); return;
  }
  if (!purpose || purpose.length < 10) {
    showMessage("error", "Please describe your loan purpose (at least 10 characters)."); return;
  }

  btn.disabled  = true;
  btn.innerHTML = "Submitting…";

  // ── Check verification status ──
  // If user is not verified, instantly decline the loan
  const isVerified = currentUserData && currentUserData.verified === true;

  try {
    if (!isVerified) {
      // Save as declined immediately
      await addDoc(collection(db, "loans"), {
        userId:        currentUser.uid,
        fullName:      currentUserData.fullName      || "",
        accountNumber: currentUserData.accountNumber || "",
        amount:        amount,
        type:          loanType,
        duration:      duration,
        income:        income,
        purpose:       purpose,
        status:        "declined",
        declineReason: "Account not verified. Please update your phone number on your profile.",
        createdAt:     serverTimestamp()
      });

      showMessage(
        "error",
        "Your loan application was automatically declined because your account is not verified. " +
        "Please update your phone number on your Profile page to get verified, then apply again."
      );

      // Refresh list to show the declined record
      loadPreviousLoans(currentUser.uid);
      return;
    }

    // User is verified — save as pending for admin review
    await addDoc(collection(db, "loans"), {
      userId:        currentUser.uid,
      fullName:      currentUserData.fullName      || "",
      accountNumber: currentUserData.accountNumber || "",
      amount:        amount,
      type:          loanType,
      duration:      duration,
      income:        income,
      purpose:       purpose,
      status:        "pending",
      createdAt:     serverTimestamp()
    });

    showMessage(
      "success",
      "Loan application submitted successfully. Your application is under review."
    );

    // Clear form fields
    document.getElementById("amount").value   = "";
    document.getElementById("loanType").value = "";
    document.getElementById("duration").value = "";
    document.getElementById("income").value   = "";
    document.getElementById("purpose").value  = "";

    loadPreviousLoans(currentUser.uid);

  } catch (err) {
    console.error("Loan submit error:", err);
    showMessage("error", "Failed to submit application: " + err.message);
  } finally {
    btn.disabled  = false;
    btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submit Application';
  }
});

// ── Auth Guard ────────────────────────────────
onAuthStateChanged(auth, (user) => {
  if (!user) { window.location.href = "./SignIn.html"; return; }
  currentUser = user;
  loadUserData(user.uid);
  loadPreviousLoans(user.uid);
});