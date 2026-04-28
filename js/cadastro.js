import { auth, db } from "./firebase.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const form = document.getElementById("cadastroForm");
const errorDiv = document.getElementById("cadastroError");
const btn = document.getElementById("cadastroBtn");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorDiv.classList.add("hidden");

  const nome = document.getElementById("nome").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const confirm = document.getElementById("confirmPassword").value;

  if (password !== confirm) {
    errorDiv.textContent = "As senhas não coincidem.";
    errorDiv.classList.remove("hidden");
    return;
  }

  btn.disabled = true;
  btn.textContent = "Criando conta...";

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);

    await setDoc(doc(db, "users", cred.user.uid), {
      nome,
      email,
      role: "aluno",
      bloqueado: false,
      criadoEm: new Date(),
    });

    window.location.href = "./aluno.html";
  } catch (err) {
    errorDiv.textContent = friendlyError(err.code);
    errorDiv.classList.remove("hidden");
    btn.disabled = false;
    btn.textContent = "Criar conta";
  }
});

function friendlyError(code) {
  const msgs = {
    "auth/email-already-in-use": "Este e-mail já está cadastrado.",
    "auth/invalid-email": "E-mail inválido.",
    "auth/weak-password": "Senha fraca. Use pelo menos 6 caracteres.",
    "auth/network-request-failed": "Sem conexão. Verifique sua internet.",
  };
  return msgs[code] || "Erro ao criar conta. Tente novamente.";
}
