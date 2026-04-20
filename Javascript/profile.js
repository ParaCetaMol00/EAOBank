import { auth, db } from "../firebase/signIn-signUp.js";
import { onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { doc, getDoc, updateDoc }
  from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

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
    day: "2-digit", month: "long", year: "numeric"
  });
}

function showMessage(type, text) {
  const box = document.getElementById("message");
  box.className = "message " + type;
  box.textContent = text;
  setTimeout(() => { box.className = "message"; box.textContent = ""; }, 5000);
}

let currentUid = null;



// ── Render Status Indicators ──────────────────
// Shows a dot on avatar + a badge beside the name
function renderStatus(data) {
  const dot = document.getElementById("statusDot");
  const statusBadge = document.getElementById("accountStatusBadge");
  const verifiedBadge = document.getElementById("verifiedBadge");

  const isBanned = data.status === "banned";
  const isVerified = data.verified === true;

  // ── Status dot on avatar ──
  if (isBanned) {
    dot.className = "status-dot dot-banned";
    dot.title = "Account Restricted";
  } else if (!isVerified) {
    dot.className = "status-dot dot-unverified";
    dot.title = "Verification Needed";
  } else {
    dot.className = "status-dot dot-active";
    dot.title = "Account Active";
  }



  // ── Status badge beside name ──
  if (isBanned) {
    statusBadge.textContent = "Restricted";
    statusBadge.className = "account-status-badge badge-banned";
  } else if (!isVerified) {
    statusBadge.textContent = "Needs Verification";
    statusBadge.className = "account-status-badge badge-unverified";
  } else {
    statusBadge.textContent = "Active";
    statusBadge.className = "account-status-badge badge-active";
  }



  // ── Verified checkmark badge ──
  if (verifiedBadge) {
    verifiedBadge.style.display = isVerified ? "inline-flex" : "none";
  }
}

// ── Load and Display User Profile ────────────
async function loadProfile(uid) {
  try {
    const userSnap = await getDoc(doc(db, "users", uid));
    if (!userSnap.exists()) { console.error("No profile found."); return; }

    const data = userSnap.data();

    // Navbar greeting
    const firstName = data.fullName ? data.fullName.split(" ")[0] : "User";
    document.getElementById("navGreeting").textContent = "Hello, " + firstName;

    // Avatar — first letter of name
    document.getElementById("profileAvatar").textContent =
      data.fullName ? data.fullName.charAt(0).toUpperCase() : "?";

    // Name and role
    document.getElementById("profileName").textContent = data.fullName || "—";
    document.getElementById("profileRole").textContent = data.role || "user";

    // Detail fields
    document.getElementById("detailName").textContent = data.fullName || "—";
    document.getElementById("detailEmail").textContent = data.email || "—";
    document.getElementById("detailPhone").textContent = data.phone || "—";
    document.getElementById("detailAccountType").textContent = data.accountType || "—";
    document.getElementById("detailAccountNumber").textContent = data.accountNumber || "—";
    document.getElementById("detailBalance").textContent = formatCurrency(data.balance || 0);
    document.getElementById("detailCreated").textContent = formatDate(data.createdAt);

    // Render status dot and badge
    renderStatus(data);

  } catch (err) {
    console.error("Error loading profile:", err);
  }
}

// ── Handle Phone Number Update ────────────────
document.getElementById("editPhoneForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const newPhone = document.getElementById("newPhone").value.trim();
  const btn = document.getElementById("editBtn");

  if (!newPhone || newPhone.length < 7 || !/^\d+$/.test(newPhone)) {
    showMessage("error", "Please enter a valid phone number (digits only)."); return;
  }
  if (!currentUid) {
    showMessage("error", "User not loaded. Please refresh."); return;
  }

  btn.disabled = true;
  btn.textContent = "Saving…";

  try {
    try {
      // Update phone AND set verified to true at the same time
      await updateDoc(doc(db, "users", currentUid), {
        phone: newPhone,
        verified: true
      });

      document.getElementById("detailPhone").textContent = newPhone;

      // Update the status indicators immediately without reloading
      document.getElementById("statusDot").className = "status-dot dot-active";
      document.getElementById("statusDot").title = "Account Active";
      document.getElementById("accountStatusBadge").textContent = "Active";
      document.getElementById("accountStatusBadge").className = "account-status-badge badge-active";
      document.getElementById("verifiedBadge").style.display = "inline-flex";

      showMessage("success", "Phone number updated. Your account is now verified!");
      document.getElementById("newPhone").value = "";

    } catch (err) {
      console.error("Phone update error:", err);
      showMessage("error", "Failed to update: " + err.message);
    }
  } finally {
    btn.disabled = false;
    btn.textContent = "Save";
  }
});

// ── Auth Guard ────────────────────────────────
onAuthStateChanged(auth, (user) => {
  if (!user) { window.location.href = "./SignIn.html"; return; }
  currentUid = user.uid;
  loadProfile(user.uid);
});