// =============================================
// dashboard.js — Dashboard Page Logic
// Location: Javascript/dashboard.js
// =============================================

import { auth, db } from "../firebase/signIn-signUp.js";
import { onAuthStateChanged, signOut } 
  from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import {
  doc, getDoc, collection, query,
  where, limit, getDocs
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

/* ── 1. Helpers ────────────────────────────────── */

function formatCurrency(amount) {
  return "$" + Number(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatDate(timestamp) {
  if (!timestamp) return "—";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString("en-US", {
    day: "2-digit", month: "short", year: "numeric"
  });
}

function showTodayDate() {
  const el = document.getElementById("todayDate");
  if (el) {
    el.textContent = new Date().toLocaleDateString("en-US", {
      weekday: "long", day: "numeric", month: "long", year: "numeric"
    });
  }
}

/* ── 2. Security & Status UI ───────────────────── */

function showBannedBanner() {
  // Check if banner already exists to prevent duplicates
  if (document.getElementById("bannedBanner")) return;

  const banner = document.createElement("div");
  banner.id = "bannedBanner";
  banner.className = "message error"; // Using your CSS classes
  banner.style.margin = "20px 32px 0";
  banner.innerHTML = `
    <i class="fa-solid fa-circle-exclamation"></i>
    <strong>Account Restricted:</strong> Deposits, Withdrawals, and Transfers are currently disabled.
  `;
  
  const main = document.querySelector("main");
  if (main) document.body.insertBefore(banner, main);

  // Disable action links
  const restrictedActions = ["actionDeposit", "actionWithdraw", "actionTransfer"];
  restrictedActions.forEach((id) => {
    const link = document.getElementById(id);
    if (link) {
      link.style.pointerEvents = "none";
      link.style.opacity = "0.4";
      link.removeAttribute("href");
      link.title = "Action disabled due to account restriction";
    }
  });
}

/* ── 3. Data Loading ──────────────────────────── */

async function loadUserDetails(uid) {
  try {
    const userDocRef = doc(db, "users", uid);
    const userSnap = await getDoc(userDocRef);

    if (!userSnap.exists()) {
      console.warn("User data not found in Firestore.");
      return;
    }

    const data = userSnap.data();

    // Update UI elements
    document.getElementById("navGreeting").textContent = 
      `Hello, ${data.fullName ? data.fullName.split(" ")[0] : "User"}`;
    
    document.getElementById("welcomeName").textContent = 
      `Welcome back, ${data.fullName || "User"}!`;

    document.getElementById("cardName").textContent    = data.fullName      || "—";
    document.getElementById("cardNumber").textContent  = data.accountNumber || "—";
    document.getElementById("cardType").textContent    = data.accountType   || "—";
    document.getElementById("cardBalance").textContent = formatCurrency(data.balance || 0);

    // FIX: Show Admin Panel if role is "admin" (case-insensitive)
    const userRole = data.role ? data.role.toLowerCase() : "user";
    if (userRole === "admin") {
      const adminCard = document.getElementById("adminCard");
      if (adminCard) {
        adminCard.style.display = "flex";
        // Ensure it's visible even if CSS has other rules
        adminCard.style.setProperty("display", "flex", "important");
      }
    }

    // Check for banned status
    if (data.status === "banned") {
      showBannedBanner();
    }

  } catch (err) {
    console.error("Error fetching user data:", err);
  }
}

async function loadRecentTransactions(uid) {
  const listEl = document.getElementById("transactionsList");
  if (!listEl) return;

  try {
    const txQuery = query(
      collection(db, "transactions"),
      where("userId", "==", uid),
      limit(5) // Increased limit slightly for better overview
    );
    
    const snapshot = await getDocs(txQuery);

    if (snapshot.empty) {
      listEl.innerHTML = '<div class="tx-empty">No recent activity found.</div>';
      return;
    }

    // Sort newest first
    let txList = [];
    snapshot.forEach((d) => txList.push(d.data()));
    txList.sort((a, b) => {
      const tA = a.timestamp ? a.timestamp.toMillis() : 0;
      const tB = b.timestamp ? b.timestamp.toMillis() : 0;
      return tB - tA;
    });

    let html = "";
    txList.forEach((tx) => {
      const isCredit = tx.type === "deposit" || tx.type === "transfer-in";
      const cssClass = isCredit ? "credit" : "debit";
      const icon     = isCredit ? "fa-arrow-down" : "fa-arrow-up";
      const sign     = isCredit ? "+" : "-";

      html += `
        <div class="tx-item">
          <div class="tx-icon ${cssClass}">
            <i class="fa-solid ${icon}"></i>
          </div>
          <div class="tx-info">
            <div class="tx-type" style="text-transform: capitalize;">${tx.type || "Transaction"}</div>
            <div class="tx-date">${formatDate(tx.timestamp)}</div>
          </div>
          <div class="tx-amount ${cssClass}">
            ${sign}${formatCurrency(tx.amount)}
          </div>
        </div>`;
    });

    listEl.innerHTML = html;

  } catch (err) {
    listEl.innerHTML = '<div class="tx-empty">Error loading transactions.</div>';
    console.error("Transaction Error:", err);
  }
}

/* ── 4. Core Auth Logic & Initialization ─────── */

// Handle Logout properly
const handleLogout = async () => {
  try {
    await signOut(auth);
    // Use replace to prevent user from clicking "back" into the dashboard
    window.location.replace("./HTML/SignIn.html");
  } catch (err) {
    console.error("Logout failed:", err);
    alert("An error occurred while logging out.");
  }
};

// Main Observer
onAuthStateChanged(auth, (user) => {
  if (!user) {
    // If not logged in, kick back to Sign In
    window.location.href = "./HTML/SignIn.html";
    return;
  }

  // User is logged in: Initialize page
  showTodayDate();
  loadUserDetails(user.uid);
  loadRecentTransactions(user.uid);

  // Attach logout listener once the element exists
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.onclick = handleLogout;
  }
});