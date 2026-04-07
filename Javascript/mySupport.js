import { auth, db } from "../firebase/signIn-signUp.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";

import {
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

function formatDate(timestamp) {
  if (!timestamp) return "—";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

// 🔹 Load user's support tickets
async function loadMySupport(uid) {
  const tbody = document.getElementById("mySupportTableBody");

  try {
    const q = query(
      collection(db, "support"),
      where("userId", "==", uid)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" class="tx-loading">
            You have not submitted any complaints yet.
          </td>
        </tr>
      `;
      return;
    }

    let rows = [];

    snapshot.forEach(docSnap => {
      rows.push(docSnap.data());
    });

    // Sort newest first
    rows.sort((a, b) => {
      const tA = a.createdAt ? a.createdAt.toMillis() : 0;
      const tB = b.createdAt ? b.createdAt.toMillis() : 0;
      return tB - tA;
    });

    let html = "";

    rows.forEach(ticket => {
      html += `
        <tr>
          <td>${ticket.issueType || "—"}</td>
          <td>${ticket.message || "—"}</td>
          <td>
            <span class="status-badge ${ticket.status}">
              ${ticket.status}
            </span>
          </td>
          <td>${formatDate(ticket.createdAt)}</td>
        </tr>
      `;
    });

    tbody.innerHTML = html;

  } catch (err) {
    console.error("Error loading tickets:", err);
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="tx-loading">
          Failed to load your tickets.
        </td>
      </tr>
    `;
  }
}


document.getElementById("logoutBtn").addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "../index.html";
});



onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "./SignIn.html";
    return;
  }

  loadMySupport(user.uid);
});