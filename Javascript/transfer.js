// =============================================
// transfer.js — Transfer Page Logic
// Location: Javascript/transfer.js
// =============================================

import { auth, db } from "../firebase/signIn-signUp.js";

import { onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";

import {
  doc, getDoc, collection,
  addDoc, serverTimestamp, query,
  where, getDocs, writeBatch
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
  }, 6000);
}

// ── Stored user info ──────────────────────────
let currentUser     = null;
let currentUserData = null;
let recipientDocId   = null;
let recipientDocData = null;

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
      showMessage("error", "Your account is restricted. You cannot make transfers.");
      document.getElementById("transferBtn").disabled = true;
    }

  } catch (err) {
    console.error("Error loading user data:", err);
    showMessage("error", "Failed to load account details.");
  }
}

// ── Live Recipient Lookup ─────────────────────
let lookupTimeout = null;

document.getElementById("recipientAccount").addEventListener("input", () => {
  const accountNumber = document.getElementById("recipientAccount").value.trim();
  const nameEl        = document.getElementById("recipientName");

  recipientDocId   = null;
  recipientDocData = null;
  nameEl.textContent = "";

  if (accountNumber.length !== 10) return;

  clearTimeout(lookupTimeout);

  nameEl.style.color = "#6B7280";
  nameEl.textContent = "Searching…";

  lookupTimeout = setTimeout(async () => {
    if (currentUserData && accountNumber === currentUserData.accountNumber) {
      nameEl.style.color = "#C0392B";
      nameEl.textContent = "⚠ You cannot transfer to your own account.";
      return;
    }

    try {
      const q        = query(collection(db, "users"), where("accountNumber", "==", accountNumber));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        nameEl.style.color = "#C0392B";
        nameEl.textContent = "✗ Account not found.";
      } else {
        recipientDocId   = snapshot.docs[0].id;
        recipientDocData = snapshot.docs[0].data();
        nameEl.style.color = "#1A8A4A";
        nameEl.textContent = "✓ " + recipientDocData.fullName;
      }
    } catch (err) {
      console.error("Recipient lookup error:", err);
      nameEl.style.color = "#C0392B";
      nameEl.textContent = "Error looking up account.";
    }
  }, 500);
});

// ── Handle Transfer Submission ────────────────
document.getElementById("transferForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  // Block banned users
  if (currentUserData && currentUserData.status === "banned") {
    showMessage("error", "Your account is restricted. Contact support.");
    return;
  }

  const recipientAccountInput = document.getElementById("recipientAccount");
  const amountInput           = document.getElementById("amount");
  const descriptionInput      = document.getElementById("description");
  const btn                   = document.getElementById("transferBtn");

  const recipientAccount = recipientAccountInput.value.trim();
  const amount           = parseFloat(amountInput.value);
  const description      = descriptionInput.value.trim() || "Transfer";

  if (!recipientAccount || recipientAccount.length !== 10) {
    showMessage("error", "Please enter a valid 10-digit recipient account number.");
    return;
  }

  if (!amount || isNaN(amount) || amount <= 0) {
    showMessage("error", "Please enter a valid amount greater than $0.");
    return;
  }

  if (!currentUserData) {
    showMessage("error", "Account data not ready. Please wait.");
    return;
  }

  if (recipientAccount === currentUserData.accountNumber) {
    showMessage("error", "You cannot transfer funds to your own account.");
    return;
  }

  if (!recipientDocId || !recipientDocData) {
    showMessage("error", "Recipient not confirmed. Please enter a valid account number.");
    return;
  }

  const senderBalance = currentUserData.balance || 0;
  if (amount > senderBalance) {
    showMessage("error", "Insufficient balance. Available: " + formatCurrency(senderBalance));
    return;
  }

  btn.disabled  = true;
  btn.innerHTML = "Processing…";

  try {
    const newSenderBalance    = senderBalance - amount;
    const newRecipientBalance = (recipientDocData.balance || 0) + amount;

    // Batch update both balances atomically
    const batch = writeBatch(db);
    batch.update(doc(db, "users", currentUser.uid), { balance: newSenderBalance });
    batch.update(doc(db, "users", recipientDocId),  { balance: newRecipientBalance });
    await batch.commit();

    // Save sender transaction
    await addDoc(collection(db, "transactions"), {
      userId:          currentUser.uid,
      type:            "transfer",
      amount:          amount,
      senderAccount:   currentUserData.accountNumber || "",
      receiverAccount: recipientAccount,
      accountNumber:   currentUserData.accountNumber || "",
      status:          "success",
      description:     description,
      timestamp:       serverTimestamp()
    });

    // Save recipient transaction
    await addDoc(collection(db, "transactions"), {
      userId:          recipientDocId,
      type:            "transfer-in",
      amount:          amount,
      senderAccount:   currentUserData.accountNumber || "",
      receiverAccount: recipientAccount,
      accountNumber:   recipientAccount,
      status:          "success",
      description:     "Transfer received from " + (currentUserData.fullName || ""),
      timestamp:       serverTimestamp()
    });

    currentUserData.balance = newSenderBalance;
    document.getElementById("currentBalance").textContent = formatCurrency(newSenderBalance);

    showMessage("success",
      formatCurrency(amount) + " transferred to " + recipientDocData.fullName + " successfully!"
    );

    recipientAccountInput.value = "";
    amountInput.value           = "";
    descriptionInput.value      = "";
    document.getElementById("recipientName").textContent = "";
    recipientDocId   = null;
    recipientDocData = null;

  } catch (err) {
    console.error("Transfer error:", err.code, err.message);
    showMessage("error", "Transfer failed: " + err.message);

  } finally {
    btn.disabled  = false;
    btn.innerHTML = '<i class="fa-solid fa-arrow-right-arrow-left"></i> Transfer Funds';
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