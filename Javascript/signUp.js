import { auth,db } from "../firebase/signIn-signUp.js";

import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";


// ---- Helper: show a message in the message box ----
function showMessage(type, text) {
  const box = document.getElementById("message");
  box.className = "message " + type; // "success" or "error"
  box.textContent = text;
}

// ---- Helper: generate a random 10-digit account number ----
function generateAccountNumber() {
  // Produces a string like "3812047591"
  let num = "";
  for (let i = 0; i < 10; i++) {
    num += Math.floor(Math.random() * 10).toString();
  }
  return num;
}

// ---- Password visibility toggles ----
document.getElementById("togglePassword").addEventListener("click", function () {
  const input = document.getElementById("password");
  const icon  = this.querySelector("i");
  if (input.type === "password") {
    input.type = "text";
    icon.classList.replace("fa-eye", "fa-eye-slash");
  } else {
    input.type = "password";
    icon.classList.replace("fa-eye-slash", "fa-eye");
  }
});

document.getElementById("toggleConfirmPassword").addEventListener("click", function () {
  const input = document.getElementById("confirmPassword");
  const icon  = this.querySelector("i");
  if (input.type === "password") {
    input.type = "text";
    icon.classList.replace("fa-eye", "fa-eye-slash");
  } else {
    input.type = "password";
    icon.classList.replace("fa-eye-slash", "fa-eye");
  }
});

// ---- Signup form submission ----
document.getElementById("signupForm").addEventListener("submit", async function (e) {
  e.preventDefault(); // prevent page refresh

  // Grab field values
  const fullName       = document.getElementById("fullName").value.trim();
  const email          = document.getElementById("email").value.trim();
  const phone          = document.getElementById("phone").value.trim();
  const accountType    = document.getElementById("accountType").value;
  const password       = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirmPassword").value;
  const btn            = document.getElementById("signupBtn");

  // ---- Validation ----
  if (!fullName || !email || !phone || !accountType || !password || !confirmPassword) {
    showMessage("error", "Please fill in all fields.");
    return;
  }

  if (phone.length < 7 || !/^\d+$/.test(phone)) {
    showMessage("error", "Please enter a valid phone number (digits only).");
    return;
  }

  if (password.length < 6) {
    showMessage("error", "Password must be at least 6 characters.");
    return;
  }

  if (password !== confirmPassword) {
    showMessage("error", "Passwords do not match.");
    return;
  }

  // ---- Disable button while processing ----
  btn.disabled = true;
  btn.textContent = "Creating account…";

  try {
    // 1. Create user with Firebase Authentication
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // 2. Generate account number and set default balance
    const accountNumber = generateAccountNumber();

    // 3. Save user details to Firestore under "users" collection
    await setDoc(doc(db, "users", user.uid), {
      uid:           user.uid,
      fullName:      fullName,
      email:         email,
      phone:         phone,
      accountType:   accountType,
      accountNumber: accountNumber,
      balance:       0,
      createdAt:     serverTimestamp()
    });

    // 4. Show success message and redirect
    showMessage("success", "Account created successfully! Redirecting to login…");

    setTimeout(() => {
      window.location.href = "../HTML/SignIn.html";
    }, 1800);

  } catch (error) {
    // Map Firebase error codes to friendly messages
    btn.disabled = false;
    btn.textContent = "Create Account";

    if (error.code === "auth/email-already-in-use") {
      showMessage("error", "This email address is already registered.");
    } else if (error.code === "auth/invalid-email") {
      showMessage("error", "Please enter a valid email address.");
    } else if (error.code === "auth/weak-password") {
      showMessage("error", "Password is too weak. Use at least 6 characters.");
    } else {
      showMessage("error", "Signup failed: " + error.message);
    }
  }
});