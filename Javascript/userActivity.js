// =============================================
// userActivity.js — User Activity Page Logic
// Location: Javascript/userActivity.js
// =============================================

import { auth, db } from "../firebase/signIn-signUp.js";
import { onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import {
  doc, getDoc, updateDoc, deleteDoc,
  collection, query, where, getDocs
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

function formatCurrency(amount) {
  return "$" + Number(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  });
}

function formatDate(timestamp) {
  if (!timestamp) return "—";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" })
    + " " + date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function isCredit(type) { return type === "deposit" || type === "transfer-in"; }

// ── Get uid from URL ──────────────────────────
const params = new URLSearchParams(window.location.search);
const uid    = params.get("uid");
if (!uid) window.location.href = "admin.html";

// Store user data for action buttons
let targetUserData = null;

// ── Load User Profile ─────────────────────────
async function loadUserProfile() {
  try {
    const userSnap = await getDoc(doc(db, "users", uid));
    if (!userSnap.exists()) { document.getElementById("userName").textContent = "User not found"; return; }

    const u = userSnap.data();
    targetUserData = u;

    document.getElementById("userAvatar").textContent        = u.fullName ? u.fullName.charAt(0).toUpperCase() : "?";
    document.getElementById("userName").textContent          = u.fullName      || "—";
    document.getElementById("userEmail").textContent         = u.email         || "—";
    document.getElementById("userAccountNumber").textContent = u.accountNumber || "—";
    document.getElementById("userAccountType").textContent   = u.accountType   || "—";
    document.getElementById("userBalance").textContent       = formatCurrency(u.balance || 0);
    document.title = `EAO Bank — ${u.fullName || "User"} Activity`;

    // Render action buttons based on current status
    renderActionButtons(u);

  } catch (err) { console.error("Error loading user profile:", err); }
}

// ── Render Action Buttons ─────────────────────
function renderActionButtons(u) {
  const isBanned = u.status   === "banned";
  const isVerif  = u.verified === true;

  document.getElementById("actionButtons").innerHTML = `
    <button class="ua-btn ${isBanned ? "unban-btn" : "ban-btn"}" onclick="toggleBan(${isBanned})">
      <i class="fa-solid ${isBanned ? "fa-lock-open" : "fa-ban"}"></i>
      ${isBanned ? "Unban User" : "Ban User"}
    </button>
    <button class="ua-btn ${isVerif ? "unverify-btn" : "verify-btn"}" onclick="toggleVerify(${isVerif})">
      <i class="fa-solid ${isVerif ? "fa-circle-xmark" : "fa-circle-check"}"></i>
      ${isVerif ? "Unverify" : "Verify User"}
    </button>
    <button class="ua-btn balance-btn" onclick="adjustBalance(${u.balance || 0})">
      <i class="fa-solid fa-dollar-sign"></i> Adjust Balance
    </button>
    <button class="ua-btn delete-btn" onclick="deleteUser()">
      <i class="fa-solid fa-trash"></i> Delete Record
    </button>
  `;
}

// ── Load User Transactions ────────────────────
async function loadUserTransactions() {
  const tbody = document.getElementById("activityTableBody");
  try {
    const snapshot = await getDocs(query(collection(db, "transactions"), where("userId", "==", uid)));

    if (snapshot.empty) {
      tbody.innerHTML = '<tr><td colspan="6" class="tx-loading">This user has no transactions yet.</td></tr>';
      ["statDeposits","statWithdrawals","statTransfers","statTotal"].forEach(id => {
        document.getElementById(id).textContent = 0;
      });
      return;
    }

    let txList = [];
    snapshot.forEach((docSnap) => txList.push(docSnap.data()));
    txList.sort((a, b) => {
      const tA = a.timestamp ? a.timestamp.toMillis() : 0;
      const tB = b.timestamp ? b.timestamp.toMillis() : 0;
      return tB - tA;
    });

    let deposits = 0, withdrawals = 0, transfers = 0;
    txList.forEach((tx) => {
      if (tx.type === "deposit")                     deposits++;
      else if (tx.type === "withdraw")               withdrawals++;
      else if (tx.type === "transfer" ||
               tx.type === "transfer-in")            transfers++;
    });

    document.getElementById("statDeposits").textContent    = deposits;
    document.getElementById("statWithdrawals").textContent = withdrawals;
    document.getElementById("statTransfers").textContent   = transfers;
    document.getElementById("statTotal").textContent       = txList.length;

    let rows = "";
    txList.forEach((tx) => {
      const credit   = isCredit(tx.type);
      const isFailed = tx.status === "failed";

      let accountInfo = tx.accountNumber || "—";
      if (tx.type === "transfer")    accountInfo = "To: "   + (tx.receiverAccount || "—");
      if (tx.type === "transfer-in") accountInfo = "From: " + (tx.senderAccount   || "—");

      const reasonHtml = isFailed && tx.failReason
        ? `<div class="fail-reason"><i class="fa-solid fa-circle-info"></i> ${tx.failReason}</div>` : "";

      rows += `
        <tr class="${isFailed ? "row-failed" : ""}">
          <td><span class="type-badge ${tx.type || ""}">${tx.type || "—"}</span></td>
          <td class="${isFailed ? "amount-failed" : (credit ? "amount-credit" : "amount-debit")}">
            ${isFailed ? "" : (credit ? "+" : "-")}${formatCurrency(tx.amount || 0)}
          </td>
          <td>${tx.description || "—"}${reasonHtml}</td>
          <td>${accountInfo}</td>
          <td><span class="status-badge ${tx.status || "success"}">${tx.status || "success"}</span></td>
          <td>${formatDate(tx.timestamp)}</td>
        </tr>`;
    });
    tbody.innerHTML = rows;
  } catch (err) {
    console.error("Error loading transactions:", err);
    tbody.innerHTML = `<tr><td colspan="6" class="tx-loading">Failed: ${err.message}</td></tr>`;
  }
}

// ── Action Functions ──────────────────────────

window.toggleBan = async (isBanned) => {
  if (!confirm(`Are you sure you want to ${isBanned ? "unban" : "ban"} this user?`)) return;
  try {
    await updateDoc(doc(db, "users", uid), { status: isBanned ? "active" : "banned" });
    alert(`User ${isBanned ? "unbanned" : "banned"} successfully.`);
    loadUserProfile();
  } catch (err) { alert("Failed: " + err.message); }
};

window.toggleVerify = async (isVerified) => {
  if (!confirm(`Are you sure you want to ${isVerified ? "unverify" : "verify"} this user?`)) return;
  try {
    await updateDoc(doc(db, "users", uid), { verified: !isVerified });
    alert(`User ${isVerified ? "unverified" : "verified"} successfully.`);
    loadUserProfile();
  } catch (err) { alert("Failed: " + err.message); }
};

window.adjustBalance = async (currentBalance) => {
  const input = prompt(`Current balance: ${formatCurrency(currentBalance)}\n\nEnter new balance:`);
  if (input === null) return;
  const newBalance = parseFloat(input);
  if (isNaN(newBalance) || newBalance < 0) { alert("Enter a valid positive number."); return; }
  if (!confirm(`Set balance to ${formatCurrency(newBalance)}?`)) return;
  try {
    await updateDoc(doc(db, "users", uid), { balance: newBalance });
    document.getElementById("userBalance").textContent = formatCurrency(newBalance);
    alert("Balance updated.");
    loadUserProfile();
  } catch (err) { alert("Failed: " + err.message); }
};

window.deleteUser = async () => {
  const name = targetUserData?.fullName || "this user";
  if (!confirm(`Delete ${name}'s record permanently?\n\nThis does NOT delete their login.`)) return;
  try {
    await deleteDoc(doc(db, "users", uid));
    alert(`${name}'s record deleted.`);
    window.location.href = "admin.html";
  } catch (err) { alert("Failed: " + err.message); }
};

// ── Auth Guard (admin only) ───────────────────
onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = "./SignIn.html"; return; }
  try {
    const adminSnap = await getDoc(doc(db, "users", user.uid));
    if (!adminSnap.exists() || adminSnap.data().role !== "admin") {
      alert("Access denied."); window.location.href = "../dashboard.html"; return;
    }
    const firstName = adminSnap.data().fullName ? adminSnap.data().fullName.split(" ")[0] : "Admin";
    document.getElementById("navGreeting").textContent = firstName;
  } catch (err) { window.location.href = "./SignIn.html"; return; }

  loadUserProfile();
  loadUserTransactions();
});