
import { auth } from "../firebase/signIn-signUp.js";
import {
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";


function showMessage(type, text) {
  const box = document.getElementById("message");
  box.className = "message " + type; 
  box.textContent = text;
}


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

document.getElementById("loginForm").addEventListener("submit", async function (e) {
  e.preventDefault();

  const email    = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const btn      = document.getElementById("loginBtn");

  // ---- Basic validation ----
  if (!email || !password) {
    showMessage("error", "Please enter your email and password.");
    return;
  }

  // ---- Disable button while processing ----
  btn.disabled = true;
  btn.textContent = "Signing in…";

  try {
    // Sign in with Firebase Authentication
    await signInWithEmailAndPassword(auth, email, password);

    // Show success and redirect to dashboard
    showMessage("success", "Login successful! Redirecting…");

    setTimeout(() => {
      window.location.href = "../dashboard.html";
    }, 1200);

  } catch (error) {
    // Reset button
    btn.disabled = false;
    btn.textContent = "Login";

    // Map Firebase error codes to friendly messages
    if (
      error.code === "auth/user-not-found" || error.code === "auth/wrong-password" || error.code === "auth/invalid-credential"
    ) {
      showMessage("error", "Incorrect email or password. Please try again.");
    } else if (error.code === "auth/invalid-email") {
      showMessage("error", "Please enter a valid email address.");
    } else if (error.code === "auth/too-many-requests") {
      showMessage("error", "Too many failed attempts. Please try again later.");
    } else {
      showMessage("error", "Login failed: " + error.message);
    }
  }
});