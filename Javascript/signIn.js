import { auth, db } from "../firebase/signIn-signUp.js";
import { onAuthStateChanged, signInWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";


function showMessage(type, text) {
  const box = document.getElementById("message");
  box.className   = "message " + type;
  box.textContent = text;
}


function showForgotMessage(type, text) {
  const box = document.getElementById("forgotMessage");
  box.className   = "message " + type;
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


const loginSection  = document.getElementById("loginSection");
const forgotSection = document.getElementById("forgotSection");

document.getElementById("showForgotBtn").addEventListener("click", () => {
  loginSection.style.display  = "none";
  forgotSection.style.display = "block";
  document.getElementById("forgotMessage").className   = "message";
  document.getElementById("forgotMessage").textContent = "";
});

document.getElementById("backToLoginBtn").addEventListener("click", () => {
  forgotSection.style.display = "none";
  loginSection.style.display  = "block";
  document.getElementById("message").className   = "message";
  document.getElementById("message").textContent = "";
});


document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const email    = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const btn      = document.getElementById("loginBtn");

  if (!email || !password) {
    showMessage("error", "Please enter your email and password."); return;
  }

  btn.disabled    = true;
  btn.textContent = "Signing in…";

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);

    showMessage("success", "Login successful! Redirecting…");

    
    setTimeout(() => { window.location.href = "dashboard.html"; }, 1200);

  } catch (error) {
    btn.disabled    = false;
    btn.textContent = "Login";

    if (
      error.code === "auth/user-not-found"     ||
      error.code === "auth/wrong-password"     ||
      error.code === "auth/invalid-credential"
    ) {
      showMessage("error", "Incorrect email or password.");
    } else if (error.code === "auth/invalid-email") {
      showMessage("error", "Please enter a valid email address.");
    } else if (error.code === "auth/too-many-requests") {
      showMessage("error", "Too many attempts. Please try again later.");
    } else {
      showMessage("error", "Login failed: " + error.message);
    }
  }
});



document.getElementById("forgotForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("resetEmail").value.trim();
  const btn   = document.getElementById("resetBtn");

  if (!email) {
    showForgotMessage("error", "Please enter your email address."); return;
  }

  btn.disabled    = true;
  btn.textContent = "Sending…";

  try {
    await sendPasswordResetEmail(auth, email);

    showForgotMessage(
      "success",
      "Reset link sent! Check your inbox and spam folder."
    );

    document.getElementById("resetEmail").value = "";

  } catch (error) {
    console.error("Reset error:", error.code, error.message);

    if (
      error.code === "auth/user-not-found" ||
      error.code === "auth/invalid-email"
    ) {
      showForgotMessage("error", "No account found with this email address.");
    } else {
      showForgotMessage("error", "Failed to send: " + error.message);
    }
  } finally {
    btn.disabled    = false;
    btn.textContent = "Send Reset Link";
  }
});


onAuthStateChanged(auth, (user) => {
  if (user) { window.location.href = "dashboard.html"; }
});