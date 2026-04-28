import { supabase } from "./supabase.js";

let currentUser = null;
let userData = null;

const DIAS_ORDER = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

// ===== INIT =====
supabase.auth.getSession().then(async ({ data: { session } }) => {
  if (!session) { window.location.href = "../index.html"; return; }

  currentUser = session.user;

  const { data } = await supabase.from("users").select("*").eq("id", currentUser.id).single();
  if (!data || data.role !== "aluno") { window.location.href = "../index.html"; return; }

  userData = data;
  document.getElementById("userNameDisplay").textContent = userData.nome || currentUser.email;
  renderHeaderAvatar();

  if (userData.bloqueado) {
    document.getElementById("blockedBanner").classList.remove("hidden");
  }

  await loadAulas();
  await loadMinhasAulas();
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await supabase.auth.signOut();
  window.location.href = "../index.html";
});

// ===== AVATAR =====
function renderHeaderAvatar() {
  const wrap = document.getElementById("headerAvatarWrap");
  const el = document.getElementById("headerAvatar");
  if (userData.foto_url) {
    el.outerHTML = `<img id="headerAvatar" src="${userData.foto_url}" class="avatar avatar-sm" title="Alterar foto" alt="Foto" />`;
  } else {
    el.textContent = (userData.nome || "?")[0].toUpperCase();
  }
  document.getElementById("headerAvatar").addEventListener("click", () => {
    document.getElementById("fotoInput").click();
  });
}

// ===== UPLOAD DE FOTO =====
document.getElementById("fotoInput").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file || !currentUser) return;

  showToast("Enviando foto...");

  const ext = file.name.split(".").pop();
  const path = `fotos/${currentUser.id}.${ext}`;

  const { error: upErr } = await supabase.storage.from("fotos").upload(path, file, { upsert: true });
  if (upErr) { showToast("Erro ao enviar foto."); return; }

  const { data: urlData } = supabase.storage.from("fotos").getPublicUrl(path);
  const url = urlData.publicUrl;

  await supabase.from("users").update({ foto_url: url }).eq("id", currentUser.id);
  userData.foto_url = url;
  renderHeaderAvatar();
  showToast("Foto atualizada!");
});

// ===== TOAST =====
function showToast(msg) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.classList.remove("hidden");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.add("hidden"), 3000);
}

// ===== CARREGAR AULAS =====
async function loadAulas() {
  const container = document.getElementById("aulasList");

  const { data: aulas } = await supabase.from("aulas").select("*").order("horario");
  const { data: minhasInscricoes } = await supabase
    .from("inscricoes").select("aula_id").eq("user_id", currentUser.id);
  const { data: todasInscricoes } = await supabase.from("inscricoes").select("aula_id");

  if (!aulas || aulas.length === 0) {
    container.innerHTML = '<p class="empty-text">Nenhuma aula disponível no momento.</p>';
    return;
  }

  const inscritoIds = new Set((minhasInscricoes || []).map((i) => i.aula_id));
  const countMap = {};
  (todasInscricoes || []).forEach((i) => {
    countMap[i.aula_id] = (countMap[i.aula_id] || 0) + 1;
  });

  const sorted = [...aulas].sort((a, b) => {
    const di = DIAS_ORDER.indexOf(a.dia) - DIAS_ORDER.indexOf(b.dia);
    if (di !== 0) return di;
    return a.horario.localeCompare(b.horario);
  });

  const porDia = {};
  sorted.forEach((aula) => {
    if (!porDia[aula.dia]) porDia[aula.dia] = [];
    porDia[aula.dia].push(aula);
  });

  container.innerHTML = "";
  DIAS_ORDER.filter((dia) => porDia[dia]).forEach((dia) => {
    const grupo = document.createElement("div");
    grupo.className = "aulas-grupo";
    grupo.innerHTML = `<div class="aulas-grupo-dia">${dia}-feira</div>`;

    const grid = document.createElement("div");
    grid.className = "aulas-grid-inner";

    porDia[dia].forEach((aula) => {
      const inscrito = inscritoIds.has(aula.id);
      const total = countMap[aula.id] || 0;
      const lotada = total >= aula.vagas;

      const card = document.createElement("div");
      card.className = `aula-card${inscrito ? " inscrito" : ""}${lotada && !inscrito ? " lotada" : ""}`;
      card.innerHTML = `
        <div class="aula-horario">${aula.horario}</div>
        ${aula.descricao ? `<div class="aula-desc">${aula.descricao}</div>` : ""}
        <div class="aula-vagas${lotada ? " lotada" : ""}">${total}/${aula.vagas} vagas</div>
        <div class="aula-actions">
          ${buildAulaBtn(inscrito, lotada, aula.id, userData.bloqueado)}
        </div>
      `;
      grid.appendChild(card);
    });

    grupo.appendChild(grid);
    container.appendChild(grupo);
  });

  container.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => handleInscricao(btn));
  });
}

function buildAulaBtn(inscrito, lotada, aulaId, bloqueado) {
  if (bloqueado) return `<button class="btn-secondary" disabled>Conta bloqueada</button>`;
  if (inscrito) return `<button class="btn-danger" data-action="cancelar" data-aula="${aulaId}">Cancelar inscrição</button>`;
  if (lotada) return `<button class="btn-secondary" disabled>Turma lotada</button>`;
  return `<button class="btn-success" data-action="inscrever" data-aula="${aulaId}">Inscrever-se</button>`;
}

async function handleInscricao(btn) {
  const action = btn.dataset.action;
  const aulaId = btn.dataset.aula;
  btn.disabled = true;

  if (action === "inscrever") {
    await supabase.from("inscricoes").insert({ user_id: currentUser.id, aula_id: aulaId });
  } else {
    await supabase.from("inscricoes")
      .delete()
      .eq("user_id", currentUser.id)
      .eq("aula_id", aulaId);
  }

  await loadAulas();
  await loadMinhasAulas();
}

// ===== MINHAS INSCRIÇÕES =====
async function loadMinhasAulas() {
  const container = document.getElementById("minhasAulas");

  const { data: inscricoes } = await supabase
    .from("inscricoes")
    .select("aula_id, aulas(*)")
    .eq("user_id", currentUser.id);

  if (!inscricoes || inscricoes.length === 0) {
    container.innerHTML = '<p class="empty-text">Você ainda não está inscrito em nenhuma aula.</p>';
    return;
  }

  const aulas = inscricoes
    .map((i) => i.aulas)
    .filter(Boolean)
    .sort((a, b) => {
      const di = DIAS_ORDER.indexOf(a.dia) - DIAS_ORDER.indexOf(b.dia);
      if (di !== 0) return di;
      return a.horario.localeCompare(b.horario);
    });

  container.innerHTML = "";
  aulas.forEach((aula) => {
    const item = document.createElement("div");
    item.className = "inscrito-item";
    item.innerHTML = `
      <div class="inscrito-info">
        <div class="inscrito-dia">${aula.dia}</div>
        <div class="inscrito-horario">${aula.horario}</div>
        ${aula.descricao ? `<div class="inscrito-desc">${aula.descricao}</div>` : ""}
      </div>
    `;
    container.appendChild(item);
  });
}
