// =============================================
// withdraw.js — Withdraw Page Logic
// Location: Javascript/withdraw.js
// =============================================

import { auth, db } from "../firebase/signIn-signUp.js";

import { onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";

import {
  doc, getDoc, updateDoc,
  collection, addDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

// ── Helpers ──────────────────────────────────

function formatCurrency(amount) {
  return "$" + Number(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
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

// ── Stored user info ──────────────────────────
let currentUser     = null;
let currentUserData = null;

// ── Load User Data ────────────────────────────
async function loadUserData(uid) {
  try {
    const userSnap = await getDoc(doc(db, "users", uid));
    if (!userSnap.exists()) {
      showMessage("error", "User profile not found.");
      return;
    }

    currentUserData = userSnap.data();

    const firstName = currentUserData.fullName
      ? currentUserData.fullName.split(" ")[0] : "User";
    document.getElementById("navGreeting").textContent = "Hello, " + firstName;
    document.getElementById("currentBalance").textContent =
      formatCurrency(currentUserData.balance || 0);

    // ── Block if banned ──
    if (currentUserData.status === "banned") {
      showMessage("error", "Your account is restricted. You cannot make withdrawals.");
      document.getElementById("withdrawBtn").disabled = true;
    }

  } catch (err) {
    console.error("Error loading user data:", err);
    showMessage("error", "Failed to load account details.");
  }
}

// ── Handle Withdraw Submission ────────────────
document.getElementById("withdrawForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  // Block banned users
  if (currentUserData && currentUserData.status === "banned") {
    showMessage("error", "Your account is restricted. Contact support.");
    return;
  }

  const amountInput      = document.getElementById("amount");
  const descriptionInput = document.getElementById("description");
  const btn              = document.getElementById("withdrawBtn");

  const amount      = parseFloat(amountInput.value);
  const description = descriptionInput.value.trim() || "Withdrawal";

  if (!amount || isNaN(amount) || amount <= 0) {
    showMessage("error", "Please enter a valid amount greater than $0.");
    return;
  }

  if (!currentUserData) {
    showMessage("error", "Account data not ready. Please wait.");
    return;
  }

  const currentBalance = currentUserData.balance || 0;

  if (amount > currentBalance) {
    showMessage("error", "Insufficient balance. Available: " + formatCurrency(currentBalance));
    return;
  }

  btn.disabled  = true;
  btn.innerHTML = "Processing…";

  try {
    const uid        = currentUser.uid;
    const newBalance = currentBalance - amount;

    await updateDoc(doc(db, "users", uid), { balance: newBalance });

    await addDoc(collection(db, "transactions"), {
      userId:        uid,
      type:          "withdraw",
      amount:        amount,
      accountNumber: currentUserData.accountNumber || "",
      status:        "success",
      description:   description,
      timestamp:     serverTimestamp()
    });

    currentUserData.balance = newBalance;
    document.getElementById("currentBalance").textContent = formatCurrency(newBalance);

    showMessage("success", formatCurrency(amount) + " withdrawn successfully!");
    amountInput.value      = "";
    descriptionInput.value = "";

  } catch (err) {
    console.error("Withdraw error:", err.code, err.message);
    showMessage("error", "Withdrawal failed: " + err.message);

  } finally {
    btn.disabled  = false;
    btn.innerHTML = '<i class="fa-solid fa-arrow-up-from-line"></i> Withdraw Funds';
  }
});

// ── Auth Guard ────────────────────────────────
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "./SignIn.html";
    return;
  }
  currentUser = user;
  loadUserData(user.uid);
});