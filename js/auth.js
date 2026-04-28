import { auth, db } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const form = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const errorDiv = document.getElementById("loginError");
const loginBtn = document.getElementById("loginBtn");

// Redireciona se já estiver logado
onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  await redirectByRole(user.uid);
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorDiv.classList.add("hidden");
  loginBtn.disabled = true;
  loginBtn.textContent = "Entrando...";

  try {
    const cred = await signInWithEmailAndPassword(auth, emailInput.value.trim(), passwordInput.value);
    await redirectByRole(cred.user.uid);
  } catch (err) {
    errorDiv.textContent = friendlyError(err.code);
    errorDiv.classList.remove("hidden");
    loginBtn.disabled = false;
    loginBtn.textContent = "Entrar";
  }
});

async function redirectByRole(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return;
  const role = snap.data().role;
  if (role === "admin") {
    window.location.href = "pages/admin.html";
  } else {
    window.location.href = "pages/aluno.html";
  }
}

function friendlyError(code) {
  const msgs = {
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/user-not-found": "Usuário não encontrado.",
    "auth/wrong-password": "Senha incorreta.",
    "auth/too-many-requests": "Muitas tentativas. Tente novamente mais tarde.",
    "auth/network-request-failed": "Sem conexão. Verifique sua internet.",
  };
  return msgs[code] || "Erro ao entrar. Tente novamente.";
}
