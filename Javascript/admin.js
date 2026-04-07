// =============================================
// admin.js — Admin Page Logic
// Location: Javascript/admin.js
// =============================================

import { auth, db } from "../firebase/signIn-signUp.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { doc, getDoc, getDocs, updateDoc, deleteDoc, collection } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

function formatCurrency(amount) {
  return "$" + Number(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  });
}

function formatDate(timestamp) {
  if (!timestamp) return "—";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
}

// ── Close all open dropdowns ──────────────────
function closeAllDropdowns() {
  document.querySelectorAll(".dropdown-menu.open").forEach(m => m.classList.remove("open"));
}

document.addEventListener("click", closeAllDropdowns);

// ── Toggle a specific dropdown ────────────────
window.toggleDropdown = (uid) => {
  closeAllDropdowns();
  event.stopPropagation();
  const menu = document.getElementById("menu-" + uid);
  if (menu) menu.classList.toggle("open");
};

// ── Check Admin Role ──────────────────────────
async function checkAdminRole(uid) {
  try {
    const userSnap = await getDoc(doc(db, "users", uid));
    if (!userSnap.exists() || userSnap.data().role !== "admin") {
      alert("Access denied. Admins only.");
      window.location.href = "../dashboard.html"; return false;
    }
    const firstName = userSnap.data().fullName ? userSnap.data().fullName.split(" ")[0] : "Admin";
    document.getElementById("navGreeting").textContent = firstName;
    return true;
  } catch (err) {
    window.location.href = "./SignIn.html"; return false;
  }
}

// ── Load All Users ────────────────────────────
async function loadUsers() {
  const tbody = document.getElementById("usersTableBody");
  try {
    const snapshot = await getDocs(collection(db, "users"));
    document.getElementById("totalUsers").textContent = snapshot.size;

    if (snapshot.empty) {
      tbody.innerHTML = '<tr><td colspan="9" class="tx-loading">No users found.</td></tr>'; return;
    }

    let rows = "";
    snapshot.forEach((docSnap) => {
      const u        = docSnap.data();
      const uid      = docSnap.id;
      const isBanned = u.status   === "banned";
      const isVerif  = u.verified === true;

      rows += `
        <tr id="row-${uid}">
          <td>${u.fullName || "—"}</td>
          <td>${u.email || "—"}</td>
          <td>${u.phone || "—"}</td>
          <td>${u.accountNumber || "—"}</td>
          <td>${u.accountType || "—"}</td>
          <td>${formatCurrency(u.balance || 0)}</td>
          <td><span class="role-badge ${u.role || "user"}">${u.role || "user"}</span></td>
          <td>
            <span class="status-badge ${isBanned ? "banned" : "active"}">${isBanned ? "Banned" : "Active"}</span>
            ${!isVerif ? '<span class="verify-badge unverified" style="margin-left:4px;">Unverified</span>' : '<span class="verify-badge verified" style="margin-left:4px;">✓ Verified</span>'}
          </td>
          <td class="action-cell">
            <div class="dropdown-wrapper">
              <button class="btn-more" onclick="toggleDropdown('${uid}')">
                More <i class="fa-solid fa-chevron-down"></i>
              </button>
              <div class="dropdown-menu" id="menu-${uid}">
                <button class="drop-item activity-item" onclick="viewActivity('${uid}', '${(u.fullName||'').replace(/'/g,"\\'")}')">
                  <i class="fa-solid fa-chart-line"></i> View Activity
                </button>
                <div class="drop-divider"></div>
                
              </div>
            </div>
          </td>
        </tr>`;
    });
    tbody.innerHTML = rows;
  } catch (err) {
    console.error("Error loading users:", err);
    tbody.innerHTML = '<tr><td colspan="9" class="tx-loading">Failed to load users.</td></tr>';
  }
}




// ── Load All Transactions ─────────────────────
async function loadTransactions() {
  const tbody = document.getElementById("txTableBody");
  try {
    const snapshot = await getDocs(collection(db, "transactions"));
    let totalTx = 0, deposits = 0, withdrawals = 0, transfers = 0;
    let txList  = [];

    snapshot.forEach((docSnap) => {
      const tx = docSnap.data();
      txList.push(tx);
      totalTx++;
      // Count ALL transactions regardless of status
      if (tx.type === "deposit")                     deposits++;
      else if (tx.type === "withdraw")               withdrawals++;
      else if (tx.type === "transfer" ||
               tx.type === "transfer-in")            transfers++;
    });

    txList.sort((a, b) => {
      const tA = a.timestamp ? a.timestamp.toMillis() : 0;
      const tB = b.timestamp ? b.timestamp.toMillis() : 0;
      return tB - tA;
    });

    document.getElementById("totalTx").textContent          = totalTx;
    document.getElementById("totalDeposits").textContent    = deposits;
    document.getElementById("totalWithdrawals").textContent = withdrawals;
    document.getElementById("totalTransfers").textContent   = transfers;

    if (txList.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="tx-loading">No transactions found.</td></tr>'; return;
    }

    let rows = "";
    txList.forEach((tx) => {
      rows += `
        <tr>
          <td title="${tx.userId || ""}">${(tx.userId || "—").substring(0, 10)}…</td>
          <td><span class="type-badge ${tx.type || ""}">${tx.type || "—"}</span></td>
          <td>${formatCurrency(tx.amount || 0)}</td>
          <td>${tx.senderAccount   || "—"}</td>
          <td>${tx.receiverAccount || "—"}</td>
          <td>
            <span class="status-badge ${tx.status || "success"}">${tx.status || "—"}</span>
            ${tx.status === "failed" && tx.failReason ? `<div class="fail-reason">${tx.failReason}</div>` : ""}
          </td>
          <td>${tx.description || "—"}</td>
          <td>${formatDate(tx.timestamp)}</td>
        </tr>`;
    });
    tbody.innerHTML = rows;
  } catch (err) {
    console.error("Error loading transactions:", err);
    tbody.innerHTML = '<tr><td colspan="8" class="tx-loading">Failed to load transactions.</td></tr>';
  }
}




window.viewActivity = (uid, name) => {
  closeAllDropdowns();
  window.location.href = `userActivity.html?uid=${uid}&name=${encodeURIComponent(name)}`;
};

window.toggleBan = async (uid, isBanned) => {
  closeAllDropdowns();
  if (!confirm(`Are you sure you want to ${isBanned ? "unban" : "ban"} this user?`)) return;
  try {
    await updateDoc(doc(db, "users", uid), { status: isBanned ? "active" : "banned" });
    alert(`User ${isBanned ? "unbanned" : "banned"} successfully.`);
    loadUsers();
  } catch (err) { alert("Failed: " + err.message); }
};

window.toggleVerify = async (uid, isVerified) => {
  closeAllDropdowns();
  if (!confirm(`Are you sure you want to ${isVerified ? "unverify" : "verify"} this user?`)) return;
  try {
    await updateDoc(doc(db, "users", uid), { verified: !isVerified });
    alert(`User ${isVerified ? "unverified" : "verified"} successfully.`);
    loadUsers();
  } catch (err) { alert("Failed: " + err.message); }
};

window.adjustBalance = async (uid, currentBalance) => {
  closeAllDropdowns();
  const input = prompt(`Current balance: ${formatCurrency(currentBalance)}\n\nEnter new balance:`);
  if (input === null) return;
  const newBalance = parseFloat(input);
  if (isNaN(newBalance) || newBalance < 0) { alert("Enter a valid positive number."); return; }
  if (!confirm(`Set balance to ${formatCurrency(newBalance)}?`)) return;
  try {
    await updateDoc(doc(db, "users", uid), { balance: newBalance });
    alert("Balance updated."); loadUsers();
  } catch (err) { alert("Failed: " + err.message); }
};

window.deleteUser = async (uid, name) => {
  closeAllDropdowns();
  if (!confirm(`Delete ${name}'s record permanently?\n\nThis does NOT delete their login.`)) return;
  try {
    await deleteDoc(doc(db, "users", uid));
    const row = document.getElementById("row-" + uid);
    if (row) row.remove();
    alert(`${name}'s record deleted.`);
    const c = parseInt(document.getElementById("totalUsers").textContent) || 0;
    document.getElementById("totalUsers").textContent = Math.max(0, c - 1);
  } catch (err) { alert("Failed: " + err.message); }
};

document.getElementById("logoutBtn").addEventListener("click", async () => {
  try { await signOut(auth); window.location.href = "./SignIn.html"; }
  catch (err) { console.error("Logout error:", err); }
});

async function loadSupportMessages() {
  const tbody = document.getElementById("supportTableBody");

  try {
    const snapshot = await getDocs(collection(db, "support"));

    if (snapshot.empty) {
      tbody.innerHTML = `<tr><td colspan="8" class="tx-loading">No messages found.</td></tr>`;
      return;
    }

    let rows = [];

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const id = docSnap.id;

      rows.push({
        id,
        ...data
      });
    });

    // Sort newest first
    rows.sort((a, b) => {
      const tA = a.createdAt ? a.createdAt.toMillis() : 0;
      const tB = b.createdAt ? b.createdAt.toMillis() : 0;
      return tB - tA;
    });

    let html = "";

    rows.forEach((msg) => {
      html += `
        <tr>
          <td>${msg.fullName || "—"}</td>
          <td>${msg.email || "—"}</td>
          <td>${msg.accountNumber || "—"}</td>
          <td>${msg.issueType || "—"}</td>
          <td>${msg.message || "—"}</td>
          <td>
            <span class="status-badge ${msg.status}">
              ${msg.status}
            </span>
          </td>
          <td>${formatDate(msg.createdAt)}</td>
          <td>
            ${
              msg.status === "open"
                ? `<button onclick="markResolved('${msg.id}')" class="btn-action small-btn">
                     Resolve
                   </button>`
                : "—"
            }
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;

  } catch (err) {
    console.error("Error loading support messages:", err);
    tbody.innerHTML = `<tr><td colspan="8" class="tx-loading">Failed to load messages.</td></tr>`;
  }
};

window.markResolved = async (id) => {
  if (!confirm("Mark this message as resolved?")) return;

  try {
    await updateDoc(doc(db, "support", id), {
      status: "resolved"
    });

    alert("Marked as resolved.");
    loadSupportMessages();

  } catch (err) {
    alert("Failed: " + err.message);
  }
};



onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = "./SignIn.html"; return; }
  const isAdmin = await checkAdminRole(user.uid);
  if (isAdmin) { loadUsers(); loadTransactions();  loadSupportMessages(); }
});