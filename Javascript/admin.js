import { auth, db } from "../firebase/signIn-signUp.js";
import { onAuthStateChanged, signOut }
  from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import {
  doc, getDoc, getDocs, updateDoc,
  deleteDoc, collection
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


function closeAllDropdowns() {
  document.querySelectorAll(".dropdown-menu.open")
    .forEach(m => m.classList.remove("open"));
}
document.addEventListener("click", closeAllDropdowns);

window.toggleDropdown = (uid) => {
  event.stopPropagation();
  closeAllDropdowns();
  const menu = document.getElementById("menu-" + uid);
  if (menu) menu.classList.toggle("open");
};


async function checkAdminRole(uid) {
  try {
    const userSnap = await getDoc(doc(db, "users", uid));
    if (!userSnap.exists() || userSnap.data().role !== "admin") {
      alert("Access denied. Admins only.");
      window.location.href = "../dashboard.html";
      return false;
    }
    const firstName = userSnap.data().fullName
      ? userSnap.data().fullName.split(" ")[0] : "Admin";
    document.getElementById("navGreeting").textContent = firstName;
    return true;
  } catch (err) {
    window.location.href = "./SignIn.html";
    return false;
  }
}


async function loadUsers() {
  const tbody = document.getElementById("usersTableBody");
  try {
    const snapshot = await getDocs(collection(db, "users"));
    document.getElementById("totalUsers").textContent = snapshot.size;

    if (snapshot.empty) {
      tbody.innerHTML = '<tr><td colspan="9" class="tx-loading">No users found.</td></tr>';
      return;
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
            <span class="status-badge ${isBanned ? "banned" : "active"}">
              ${isBanned ? "Banned" : "Active"}
            </span>
            <span class="verify-badge ${isVerif ? "verified" : "unverified"}" style="margin-left:4px;">
              ${isVerif ? "✓ Verified" : "Unverified"}
            </span>
          </td>
          <td class="action-cell">
            <div class="dropdown-wrapper">
              <button class="btn-more" onclick="toggleDropdown('${uid}')">
                More <i class="fa-solid fa-chevron-down"></i>
              </button>
              <div class="dropdown-menu" id="menu-${uid}">
                <button class="drop-item activity-item"
                  onclick="viewActivity('${uid}', '${(u.fullName||'').replace(/'/g,"\\'")}')">
                  <i class="fa-solid fa-chart-line"></i> View Activity
                </button>
                <div class="drop-divider"></div>
                <button class="drop-item ${isBanned ? "unban-item" : "ban-item"}"
                  onclick="toggleBan('${uid}', ${isBanned})">
                  <i class="fa-solid ${isBanned ? "fa-lock-open" : "fa-ban"}"></i>
                  ${isBanned ? "Unban User" : "Ban User"}
                </button>
                <button class="drop-item ${isVerif ? "unverify-item" : "verify-item"}"
                  onclick="toggleVerify('${uid}', ${isVerif})">
                  <i class="fa-solid ${isVerif ? "fa-circle-xmark" : "fa-circle-check"}"></i>
                  ${isVerif ? "Unverify" : "Verify User"}
                </button>
                <button class="drop-item balance-item"
                  onclick="adjustBalance('${uid}', ${u.balance || 0})">
                  <i class="fa-solid fa-dollar-sign"></i> Adjust Balance
                </button>
                <div class="drop-divider"></div>
                <button class="drop-item delete-item"
                  onclick="deleteUser('${uid}', '${(u.fullName||'User').replace(/'/g,"\\'")}')">
                  <i class="fa-solid fa-trash"></i> Delete Record
                </button>
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


async function loadLoans() {
  const tbody = document.getElementById("loansTableBody");
  try {
    const snapshot = await getDocs(collection(db, "loans"));

    let pendingCount = 0;
    let loans = [];
    snapshot.forEach((d) => {
      const loan = { id: d.id, ...d.data() };
      loans.push(loan);
      if (loan.status === "pending") pendingCount++;
    });

    document.getElementById("totalPendingLoans").textContent = pendingCount;

    loans.sort((a, b) => {
      const tA = a.createdAt ? a.createdAt.toMillis() : 0;
      const tB = b.createdAt ? b.createdAt.toMillis() : 0;
      return tB - tA;
    });

    if (loans.length === 0) {
      tbody.innerHTML = '<tr><td colspan="10" class="tx-loading">No loan applications yet.</td></tr>';
      return;
    }

    let rows = "";
    loans.forEach((l) => {
      const isPending  = l.status === "pending";
      const isApproved = l.status === "approved";
      const isDeclined = l.status === "declined";

      rows += `
        <tr id="loan-row-${l.id}">
          <td>${l.fullName || "—"}</td>
          <td>${l.accountNumber || "—"}</td>
          <td>${formatCurrency(l.amount || 0)}</td>
          <td>${l.type || "—"}</td>
          <td>${l.duration || "—"} mo.</td>
          <td>${formatCurrency(l.income || 0)}/mo</td>
          <td class="purpose-cell" title="${l.purpose || ""}">${l.purpose || "—"}</td>
          <td>
            <span class="loan-status-badge status-${l.status || "pending"}">
              ${l.status || "pending"}
            </span>
            ${l.declineReason
              ? `<div class="fail-reason">${l.declineReason}</div>`
              : ""}
          </td>
          <td>${formatDate(l.createdAt)}</td>
          <td class="action-cell" style="white-space:nowrap;">
            ${isPending ? `
              <button class="action-btn approve-btn"
                onclick="approveLoan('${l.id}')">
                <i class="fa-solid fa-check"></i> Approve
              </button>
              <button class="action-btn decline-btn-sm"
                onclick="declineLoan('${l.id}')">
                <i class="fa-solid fa-xmark"></i> Decline
              </button>
            ` : `<span style="color:var(--muted);font-size:12px;">No actions</span>`}
          </td>
        </tr>`;
    });
    tbody.innerHTML = rows;

  } catch (err) {
    console.error("Error loading loans:", err);
    tbody.innerHTML = '<tr><td colspan="10" class="tx-loading">Failed to load loans.</td></tr>';
  }
}


async function loadCards() {
  const tbody = document.getElementById("cardsTableBody");
  try {
    const snapshot = await getDocs(collection(db, "cards"));

    let processingCount = 0;
    let cards = [];
    snapshot.forEach((d) => {
      const card = { id: d.id, ...d.data() };
      cards.push(card);
      if (card.status === "processing") processingCount++;
    });

    document.getElementById("totalPendingCards").textContent = processingCount;

    cards.sort((a, b) => {
      const tA = a.createdAt ? a.createdAt.toMillis() : 0;
      const tB = b.createdAt ? b.createdAt.toMillis() : 0;
      return tB - tA;
    });

    if (cards.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="tx-loading">No card requests yet.</td></tr>';
      return;
    }

    let rows = "";
    cards.forEach((c) => {
      const isProcessing = c.status === "processing";

      rows += `
        <tr id="card-row-${c.id}">
          <td>${c.fullName || "—"}</td>
          <td>${c.accountNumber || "—"}</td>
          <td>${c.cardType || "—"}</td>
          <td>${c.cardNetwork || "—"}</td>
          <td class="purpose-cell" title="${c.address || ""}">${c.address || "—"}</td>
          <td>
            <span class="loan-status-badge status-${c.status || "processing"}">
              ${c.status || "processing"}
            </span>
          </td>
          <td>${formatDate(c.createdAt)}</td>
          <td class="action-cell" style="white-space:nowrap;">
            ${isProcessing ? `
              <button class="action-btn approve-btn"
                onclick="approveCard('${c.id}')">
                <i class="fa-solid fa-check"></i> Approve
              </button>
              <button class="action-btn decline-btn-sm"
                onclick="declineCard('${c.id}')">
                <i class="fa-solid fa-xmark"></i> Decline
              </button>
            ` : `<span style="color:var(--muted);font-size:12px;">No actions</span>`}
          </td>
        </tr>`;
    });
    tbody.innerHTML = rows;

  } catch (err) {
    console.error("Error loading cards:", err);
    tbody.innerHTML = '<tr><td colspan="8" class="tx-loading">Failed to load card requests.</td></tr>';
  }
}


async function loadTransactions() {
  const tbody = document.getElementById("txTableBody");
  try {
    const snapshot = await getDocs(collection(db, "transactions"));
    let totalTx = 0, deposits = 0, withdrawals = 0, transfers = 0;
    let txList  = [];

    snapshot.forEach((docSnap) => {
      const tx = docSnap.data();
      txList.push(tx); totalTx++;
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
      tbody.innerHTML = '<tr><td colspan="8" class="tx-loading">No transactions found.</td></tr>';
      return;
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
            ${tx.status === "failed" && tx.failReason
              ? `<div class="fail-reason">${tx.failReason}</div>` : ""}
          </td>
          <td>${tx.description || "—"}</td>
          <td>${formatDate(tx.timestamp)}</td>
        </tr>`;
    });
    tbody.innerHTML = rows;

  } catch (err) {
    console.error("Error loading transactions:", err);
    tbody.innerHTML = '<tr><td colspan="8" class="tx-loading">Failed to load.</td></tr>';
  }
}



window.approveLoan = async (loanId) => {
  if (!confirm("Approve this loan application?")) return;

  try {
    
    const loanSnap = await getDoc(doc(db, "loans", loanId));
    if (!loanSnap.exists()) { alert("Loan not found."); return; }

    const loan = loanSnap.data();

    
    const userSnap = await getDoc(doc(db, "users", loan.userId));
    if (!userSnap.exists()) { alert("User not found."); return; }

    const currentBalance = userSnap.data().balance || 0;
    const newBalance     = currentBalance + loan.amount;

    
    await updateDoc(doc(db, "users", loan.userId), {
      balance: newBalance
    });

   
    const { collection, addDoc, serverTimestamp } = await import(
      "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js"
    );
    await addDoc(collection(db, "transactions"), {
      userId:        loan.userId,
      type:          "loan",
      amount:        loan.amount,
      accountNumber: loan.accountNumber || "",
      status:        "success",
      description:   `${loan.type} Loan approved — ${loan.duration} month(s)`,
      timestamp:     serverTimestamp()
    });

    
    await updateDoc(doc(db, "loans", loanId), { status: "approved" });

    alert("Loan approved. $" + loan.amount.toLocaleString("en-US") + " added to user's balance.");
    loadLoans();

  } catch (err) {
    console.error("Approve loan error:", err);
    alert("Failed: " + err.message);
  }
};

window.declineLoan = async (loanId) => {
  const reason = prompt("Enter decline reason (optional):");
  if (reason === null) return; // cancelled

  try {
    await updateDoc(doc(db, "loans", loanId), {
      status:        "declined",
      declineReason: reason || "Declined by admin."
    });
    alert("Loan declined.");
    loadLoans();
  } catch (err) { alert("Failed: " + err.message); }
};




window.approveCard = async (cardId) => {
  if (!confirm("Approve this card request?")) return;
  try {
    await updateDoc(doc(db, "cards", cardId), { status: "approved" });
    alert("Card request approved.");
    loadCards();
  } catch (err) { alert("Failed: " + err.message); }
};

window.declineCard = async (cardId) => {
  if (!confirm("Decline this card request?")) return;
  try {
    await updateDoc(doc(db, "cards", cardId), { status: "declined" });
    alert("Card request declined.");
    loadCards();
  } catch (err) { alert("Failed: " + err.message); }
};



window.viewActivity = (uid, name) => {
  closeAllDropdowns();
  window.location.href = `userActivity.html?uid=${uid}&name=${encodeURIComponent(name)}`;
};

window.toggleBan = async (uid, isBanned) => {
  closeAllDropdowns();
  if (!confirm(`${isBanned ? "Unban" : "Ban"} this user?`)) return;
  try {
    await updateDoc(doc(db, "users", uid), { status: isBanned ? "active" : "banned" });
    alert(`User ${isBanned ? "unbanned" : "banned"} successfully.`);
    loadUsers();
  } catch (err) { alert("Failed: " + err.message); }
};

window.toggleVerify = async (uid, isVerified) => {
  closeAllDropdowns();
  if (!confirm(`${isVerified ? "Unverify" : "Verify"} this user?`)) return;
  try {
    await updateDoc(doc(db, "users", uid), { verified: !isVerified });
    alert(`User ${isVerified ? "unverified" : "verified"} successfully.`);
    loadUsers();
  } catch (err) { alert("Failed: " + err.message); }
};

window.adjustBalance = async (uid, currentBalance) => {
  closeAllDropdowns();
  const input = prompt(`Current: ${formatCurrency(currentBalance)}\n\nEnter new balance:`);
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
  try { await signOut(auth); window.location.href = "../index.html"; }
  catch (err) { console.error("Logout error:", err); }
});


onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = "../index.html"; return; }
  const isAdmin = await checkAdminRole(user.uid);
  if (isAdmin) {
    loadUsers();
    loadTransactions();
    loadLoans();
    loadCards();
  }
});