// card.js — Location: Javascript/card.js

import { auth, db } from "../firebase/signIn-signUp.js";
import { onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import {
  doc, getDoc, collection,
  addDoc, query, where,
  getDocs, serverTimestamp, orderBy
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

function showMessage(type, text) {
  const box = document.getElementById("message");
  box.className   = "message " + type;
  box.textContent = text;
  setTimeout(() => { box.className = "message"; box.textContent = ""; }, 5000);
}

function formatDate(timestamp) {
  if (!timestamp) return "—";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
}

let currentUser     = null;
let currentUserData = null;

// ── Load user data and auto-fill ─────────────
async function loadUserData(uid) {
  try {
    const userSnap = await getDoc(doc(db, "users", uid));
    if (!userSnap.exists()) return;

    currentUserData = userSnap.data();
    const firstName = currentUserData.fullName ? currentUserData.fullName.split(" ")[0] : "User";
    document.getElementById("navGreeting").textContent   = "Hello, " + firstName;
    document.getElementById("fullName").value            = currentUserData.fullName      || "";
    document.getElementById("accountNumber").value       = currentUserData.accountNumber || "";
  } catch (err) {
    console.error("Error loading user:", err);
  }
}

// ── Load previous card requests ───────────────
async function loadPreviousCards(uid) {
  const container = document.getElementById("prevCards");
  try {
    const snapshot = await getDocs(query(
      collection(db, "cards"),
      where("userId", "==", uid)
    ));

    if (snapshot.empty) {
      container.innerHTML = '<p class="prev-empty">No card requests yet.</p>';
      return;
    }

    let items = [];
    snapshot.forEach((d) => items.push(d.data()));
    items.sort((a, b) => {
      const tA = a.createdAt ? a.createdAt.toMillis() : 0;
      const tB = b.createdAt ? b.createdAt.toMillis() : 0;
      return tB - tA;
    });

    container.innerHTML = items.map((c) => `
      <div class="prev-card-item">
        <div class="prev-card-info">
          <span class="prev-card-type">${c.cardType} — ${c.cardNetwork}</span>
          <span class="prev-card-meta">Requested on ${formatDate(c.createdAt)}</span>
          <span class="prev-card-meta">Deliver to: ${c.address || "—"}</span>
        </div>
        <span class="prev-status status-${c.status || "processing"}">${c.status || "processing"}</span>
      </div>
    `).join("");

  } catch (err) {
    container.innerHTML = '<p class="prev-empty">Could not load requests.</p>';
    console.error("Error loading cards:", err);
  }
}

// ── Handle Form Submission ────────────────────
document.getElementById("cardForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const cardType    = document.getElementById("cardType").value;
  const cardNetwork = document.getElementById("cardNetwork").value;
  const address     = document.getElementById("address").value.trim();
  const btn         = document.getElementById("cardBtn");

  if (!cardType)              { showMessage("error", "Please select a card type."); return; }
  if (!cardNetwork)           { showMessage("error", "Please select a card network."); return; }
  if (!address || address.length < 10) {
    showMessage("error", "Please enter a full delivery address (at least 10 characters)."); return;
  }

  btn.disabled  = true;
  btn.innerHTML = "Submitting…";

  try {
    await addDoc(collection(db, "cards"), {
      userId:        currentUser.uid,
      fullName:      currentUserData.fullName      || "",
      accountNumber: currentUserData.accountNumber || "",
      cardType:      cardType,
      cardNetwork:   cardNetwork,
      address:       address,
      status:        "processing",
      createdAt:     serverTimestamp()
    });

    showMessage("success", "Your card request has been submitted. We will process it shortly.");
    document.getElementById("cardType").value    = "";
    document.getElementById("cardNetwork").value = "";
    document.getElementById("address").value     = "";

    // Refresh previous requests list
    loadPreviousCards(currentUser.uid);

  } catch (err) {
    console.error("Card request error:", err);
    showMessage("error", "Failed to submit request: " + err.message);
  } finally {
    btn.disabled  = false;
    btn.innerHTML = '<i class="fa-solid fa-credit-card"></i> Submit Card Request';
  }
});

// ── Auth Guard ────────────────────────────────
onAuthStateChanged(auth, (user) => {
  if (!user) { window.location.href = "./SignIn.html"; return; }
  currentUser = user;
  loadUserData(user.uid);
  loadPreviousCards(user.uid);
});