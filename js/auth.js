import { supabase } from "./supabase.js";

const form = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const errorDiv = document.getElementById("loginError");
const loginBtn = document.getElementById("loginBtn");

// Redireciona se já estiver logado
supabase.auth.getSession().then(async ({ data: { session } }) => {
  if (session) await redirectByRole(session.user.id);
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorDiv.classList.add("hidden");
  loginBtn.disabled = true;
  loginBtn.textContent = "Entrando...";

  const { data, error } = await supabase.auth.signInWithPassword({
    email: emailInput.value.trim(),
    password: passwordInput.value,
  });

  if (error) {
    errorDiv.textContent = friendlyError(error.message);
    errorDiv.classList.remove("hidden");
    loginBtn.disabled = false;
    loginBtn.textContent = "Entrar";
    return;
  }

  await redirectByRole(data.user.id);
});

async function redirectByRole(uid) {
  const { data } = await supabase
    .from("users")
    .select("role")
    .eq("id", uid)
    .single();

  if (!data) return;

  if (data.role === "admin") {
    window.location.href = "pages/admin.html";
  } else {
    window.location.href = "pages/aluno.html";
  }
}

function friendlyError(msg) {
  if (msg.includes("Invalid login")) return "E-mail ou senha incorretos.";
  if (msg.includes("Email not confirmed")) return "Confirme seu e-mail antes de entrar.";
  if (msg.includes("Network")) return "Sem conexão. Verifique sua internet.";
  return "Erro ao entrar. Tente novamente.";
}
