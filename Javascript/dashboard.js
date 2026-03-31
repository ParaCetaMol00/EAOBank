// =============================================
// dashboard.js — Dashboard Page Logic
// Location: Javascript/dashboard.js
// =============================================

// NOTE: dashboard.html is at ROOT level.
// dashboard.js is inside Javascript/ folder.
// So the firebase path from dashboard.js is:
// ../firebase/signIn-signUp.js  (go up one level)
// But the auth redirect must point to:
// ./HTML/SignIn.html  (relative to root, since the browser URL is root)

import { auth, db } from "../firebase/signIn-signUp.js";
import { onAuthStateChanged, signOut }
  from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import {
  doc, getDoc, collection,
  query, where, limit, getDocs
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

// ── Balance Visibility Toggle ─────────────────
let balanceVisible = true;
let actualBalance  = 0;

function updateBalanceDisplay() {
  const balanceEl = document.getElementById("cardBalance");
  const eyeBtn    = document.getElementById("toggleBalanceBtn");
  const eyeIcon   = eyeBtn ? eyeBtn.querySelector("i") : null;

  if (balanceVisible) {
    balanceEl.textContent = formatCurrency(actualBalance);
    if (eyeIcon) { eyeIcon.classList.remove("fa-eye-slash"); eyeIcon.classList.add("fa-eye"); }
    if (eyeBtn)  eyeBtn.title = "Hide balance";
  } else {
    balanceEl.textContent = "••••••";
    if (eyeIcon) { eyeIcon.classList.remove("fa-eye"); eyeIcon.classList.add("fa-eye-slash"); }
    if (eyeBtn)  eyeBtn.title = "Show balance";
  }
}

const toggleBalanceBtn = document.getElementById("toggleBalanceBtn");
if (toggleBalanceBtn) {
  toggleBalanceBtn.addEventListener("click", () => {
    balanceVisible = !balanceVisible;
    updateBalanceDisplay();
  });
}

// ── Show banned banner ────────────────────────
function showBannedBanner() {
  if (document.getElementById("bannedBanner")) return;
  const banner = document.createElement("div");
  banner.id = "bannedBanner";
  banner.innerHTML = `
    <i class="fa-solid fa-circle-exclamation"></i>
    <strong>Account Restricted:</strong> Deposits, Withdrawals and Transfers are disabled.
    Please contact support.
  `;
  document.body.insertBefore(banner, document.querySelector("main"));

  ["actionDeposit", "actionWithdraw", "actionTransfer"].forEach((id) => {
    const link = document.getElementById(id);
    if (link) {
      link.style.pointerEvents = "none";
      link.style.opacity = "0.4";
      link.removeAttribute("href");
      link.title = "Account restricted";
    }
  });
}

// ── Load User Details ─────────────────────────
async function loadUserDetails(uid) {
  try {
    const userSnap = await getDoc(doc(db, "users", uid));
    if (!userSnap.exists()) { console.warn("No Firestore document found."); return; }

    const data = userSnap.data();

    document.getElementById("navGreeting").textContent =
      "Hello, " + (data.fullName ? data.fullName.split(" ")[0] : "User");

    document.getElementById("welcomeName").textContent =
      "Welcome back, " + (data.fullName || "User") + "!";

    document.getElementById("cardName").textContent   = data.fullName      || "—";
    document.getElementById("cardNumber").textContent = data.accountNumber || "—";
    document.getElementById("cardType").textContent   = data.accountType   || "—";

    actualBalance = data.balance || 0;
    updateBalanceDisplay();

    // Show Admin Panel button only if admin
    if (data.role === "admin") {
      const adminCard = document.getElementById("adminCard");
      if (adminCard) adminCard.style.display = "flex";
    }

    // Show banned banner if restricted
    if (data.status === "banned") showBannedBanner();

  } catch (err) {
    console.error("Error loading user details:", err);
  }
}

// ── Load Recent Transactions ──────────────────
async function loadRecentTransactions(uid) {
  const listEl = document.getElementById("transactionsList");
  if (!listEl) return;

  try {
    // Fetch ALL transactions for this user — no limit, no orderBy
    // We sort in JS and take the 3 newest ourselves
    const snapshot = await getDocs(query(
      collection(db, "transactions"),
      where("userId", "==", uid)
    ));

    if (snapshot.empty) {
      listEl.innerHTML = '<div class="tx-empty">No transactions yet.</div>';
      return;
    }

    // Collect all, sort newest first, take top 3
    let txList = [];
    snapshot.forEach((d) => txList.push(d.data()));
    txList.sort((a, b) => {
      const tA = a.timestamp ? a.timestamp.toMillis() : 0;
      const tB = b.timestamp ? b.timestamp.toMillis() : 0;
      return tB - tA;
    });
    txList = txList.slice(0, 3); // take only the 3 newest

    let html = "";
    txList.forEach((tx) => {
      const isCredit = tx.type === "deposit" || tx.type === "transfer-in";
      const isFailed = tx.status === "failed";
      const cssClass = isFailed ? "debit" : (isCredit ? "credit" : "debit");
      const icon     = isCredit ? "fa-arrow-down" : "fa-arrow-up";
      const sign     = isFailed ? "" : (isCredit ? "+" : "-");

      html += `
        <div class="tx-item">
          <div class="tx-icon ${cssClass}">
            <i class="fa-solid ${isFailed ? "fa-xmark" : icon}"></i>
          </div>
          <div class="tx-info">
            <div class="tx-type">${tx.type || "Transaction"}
              ${isFailed ? '<span class="tx-failed-tag">Failed</span>' : ""}
            </div>
            <div class="tx-date">${formatDate(tx.timestamp)}</div>
          </div>
          <div class="tx-amount ${cssClass}">
            ${sign}${formatCurrency(tx.amount || 0)}
          </div>
        </div>`;
    });

    listEl.innerHTML = html;

  } catch (err) {
    listEl.innerHTML = '<div class="tx-empty">Could not load transactions.</div>';
    console.error("Error loading transactions:", err);
  }};

// ── Logout ────────────────────────────────────
document.getElementById("logoutBtn").addEventListener("click", async () => {
  try {
    await signOut(auth);
    // dashboard.html is at root, SignIn.html is in HTML/
    window.location.replace("./HTML/SignIn.html");
  } catch (err) {
    console.error("Logout error:", err);
  }
});

// ── Auth Guard ────────────────────────────────
onAuthStateChanged(auth, (user) => {
  if (!user) {
    // dashboard.html is at root, SignIn.html is in HTML/
    window.location.href = "./HTML/SignIn.html";
    return;
  }
  showTodayDate();
  loadUserDetails(user.uid);
  loadRecentTransactions(user.uid);
});