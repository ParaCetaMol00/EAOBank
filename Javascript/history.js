// =============================================
// history.js — Transaction History Page Logic
// Location: Javascript/history.js
// =============================================

import { auth, db } from "../firebase/signIn-signUp.js";
import { onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import {
  collection, query, where,
  getDocs, doc, getDoc
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

function isCredit(type) {
  return type === "deposit" || type === "transfer-in";
}

async function loadTransactions(uid) {
  const tbody = document.getElementById("txTableBody");
  try {
    const snapshot = await getDocs(query(
      collection(db, "transactions"),
      where("userId", "==", uid)
    ));

    if (snapshot.empty) {
      tbody.innerHTML = '<tr><td colspan="7" class="tx-loading">You have no transactions yet.</td></tr>';
      return;
    }

    let transactions = [];
    snapshot.forEach((docSnap) => transactions.push(docSnap.data()));
    transactions.sort((a, b) => {
      const tA = a.timestamp ? a.timestamp.toMillis() : 0;
      const tB = b.timestamp ? b.timestamp.toMillis() : 0;
      return tB - tA;
    });

    let rows = "";
    transactions.forEach((tx) => {
      const credit    = isCredit(tx.type);
      const isFailed  = tx.status === "failed";

      let accountInfo = tx.accountNumber || "—";
      if (tx.type === "transfer")    accountInfo = "To: "   + (tx.receiverAccount || "—");
      if (tx.type === "transfer-in") accountInfo = "From: " + (tx.senderAccount   || "—");

      // Show fail reason if available
      const reasonHtml = isFailed && tx.failReason
        ? `<div class="fail-reason"><i class="fa-solid fa-circle-info"></i> ${tx.failReason}</div>`
        : "";

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
    tbody.innerHTML = `<tr><td colspan="7" class="tx-loading">Failed to load: ${err.message}</td></tr>`;
  }
}

async function loadUserGreeting(uid) {
  try {
    const userSnap = await getDoc(doc(db, "users", uid));
    if (userSnap.exists()) {
      const firstName = userSnap.data().fullName ? userSnap.data().fullName.split(" ")[0] : "User";
      document.getElementById("navGreeting").textContent = "Hello, " + firstName;
    }
  } catch (err) { console.error("Error loading user:", err); }
}

onAuthStateChanged(auth, (user) => {
  if (!user) { window.location.href = "./SignIn.html"; return; }
  loadUserGreeting(user.uid);
  loadTransactions(user.uid);
});