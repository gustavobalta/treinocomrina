import { supabase } from "./supabase.js";

const DIAS_ORDER = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

let currentUser = null;

// ===== INIT =====
supabase.auth.getSession().then(async ({ data: { session } }) => {
  if (!session) { window.location.href = "../index.html"; return; }

  currentUser = session.user;

  const { data } = await supabase.from("users").select("role").eq("id", currentUser.id).single();
  if (!data || data.role !== "admin") { window.location.href = "../index.html"; return; }

  await loadAdminAulas();
  await loadAlunos();
});

// ===== ABAS =====
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
  });
});

// ===== LOGOUT =====
document.getElementById("logoutBtn").addEventListener("click", async () => {
  await supabase.auth.signOut();
  window.location.href = "../index.html";
});

// ===== MODAL CADASTRO ALUNO =====
const cadastroAlunoModal = document.getElementById("cadastroAlunoModal");
document.getElementById("abrirCadastroAlunoBtn").addEventListener("click", () => cadastroAlunoModal.classList.remove("hidden"));
document.getElementById("cadastroAlunoClose").addEventListener("click", () => cadastroAlunoModal.classList.add("hidden"));
cadastroAlunoModal.addEventListener("click", (e) => { if (e.target === cadastroAlunoModal) cadastroAlunoModal.classList.add("hidden"); });

// ===== PREVIEW FOTO CADASTRO =====
document.getElementById("alunoFoto").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    document.getElementById("avatarInitial").classList.add("hidden");
    const img = document.getElementById("avatarPreviewImg");
    img.src = ev.target.result;
    img.classList.remove("hidden");
  };
  reader.readAsDataURL(file);
});

document.getElementById("alunoNome").addEventListener("input", (e) => {
  document.getElementById("avatarInitial").textContent = (e.target.value.trim()[0] || "?").toUpperCase();
});

// ===== CRIAR AULA =====
document.getElementById("novaAulaForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errorDiv = document.getElementById("aulaFormError");
  errorDiv.classList.add("hidden");

  const dia = document.getElementById("diaSemana").value;
  const horario = document.getElementById("horario").value;
  const vagas = parseInt(document.getElementById("vagas").value);
  const descricao = document.getElementById("descricao").value.trim();

  const { error } = await supabase.from("aulas").insert({ dia, horario, vagas, descricao });
  if (error) {
    errorDiv.textContent = "Erro ao criar aula.";
    errorDiv.classList.remove("hidden");
    return;
  }

  e.target.reset();
  await loadAdminAulas();
});

// ===== CARREGAR AULAS =====
async function loadAdminAulas() {
  const container = document.getElementById("adminAulasList");

  const { data: aulas } = await supabase.from("aulas").select("*");
  const { data: inscricoes } = await supabase.from("inscricoes").select("aula_id");

  const countMap = {};
  (inscricoes || []).forEach((i) => {
    countMap[i.aula_id] = (countMap[i.aula_id] || 0) + 1;
  });

  if (!aulas || aulas.length === 0) {
    container.innerHTML = '<p class="empty-text">Nenhuma aula cadastrada.</p>';
    return;
  }

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

    porDia[dia].forEach((aula) => {
      const total = countMap[aula.id] || 0;
      const item = document.createElement("div");
      item.className = "aula-admin-item";
      item.innerHTML = `
        <div class="aula-admin-info">
          <div class="aula-admin-horario">${aula.horario}</div>
          ${aula.descricao ? `<div class="aula-admin-desc">${aula.descricao}</div>` : ""}
          <div class="aula-admin-vagas">${total}/${aula.vagas} inscritos</div>
        </div>
        <div class="aula-admin-actions">
          <button class="btn-secondary" data-action="ver-inscritos" data-aula="${aula.id}" data-label="${aula.dia} ${aula.horario}">Ver inscritos</button>
          <button class="btn-secondary" data-action="editar-aula" data-aula="${aula.id}">Editar</button>
          <button class="btn-danger" data-action="excluir-aula" data-aula="${aula.id}">Excluir</button>
        </div>
      `;
      grupo.appendChild(item);
    });

    container.appendChild(grupo);
  });

  container.querySelectorAll("[data-action='ver-inscritos']").forEach((btn) => {
    btn.addEventListener("click", () => openInscritosModal(btn.dataset.aula, btn.dataset.label));
  });
  container.querySelectorAll("[data-action='editar-aula']").forEach((btn) => {
    btn.addEventListener("click", () => openEditAulaModal(btn.dataset.aula));
  });
  container.querySelectorAll("[data-action='excluir-aula']").forEach((btn) => {
    btn.addEventListener("click", () => excluirAula(btn.dataset.aula));
  });
}

async function excluirAula(aulaId) {
  if (!confirm("Excluir esta aula? Todas as inscrições serão removidas.")) return;
  await supabase.from("inscricoes").delete().eq("aula_id", aulaId);
  await supabase.from("aulas").delete().eq("id", aulaId);
  await loadAdminAulas();
}

// ===== MODAL EDITAR AULA =====
const editAulaModal = document.getElementById("editAulaModal");
document.getElementById("editAulaClose").addEventListener("click", () => editAulaModal.classList.add("hidden"));
editAulaModal.addEventListener("click", (e) => { if (e.target === editAulaModal) editAulaModal.classList.add("hidden"); });

async function openEditAulaModal(aulaId) {
  const { data: aula } = await supabase.from("aulas").select("*").eq("id", aulaId).single();
  if (!aula) return;

  document.getElementById("editAulaId").value = aulaId;
  document.getElementById("editDiaSemana").value = aula.dia;
  document.getElementById("editHorario").value = aula.horario;
  document.getElementById("editVagas").value = aula.vagas;
  document.getElementById("editDescricao").value = aula.descricao || "";
  document.getElementById("editAulaError").classList.add("hidden");
  editAulaModal.classList.remove("hidden");
}

document.getElementById("editAulaForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errorDiv = document.getElementById("editAulaError");
  errorDiv.classList.add("hidden");

  const aulaId = document.getElementById("editAulaId").value;
  const { error } = await supabase.from("aulas").update({
    dia: document.getElementById("editDiaSemana").value,
    horario: document.getElementById("editHorario").value,
    vagas: parseInt(document.getElementById("editVagas").value),
    descricao: document.getElementById("editDescricao").value.trim(),
  }).eq("id", aulaId);

  if (error) {
    errorDiv.textContent = "Erro ao salvar.";
    errorDiv.classList.remove("hidden");
    return;
  }

  editAulaModal.classList.add("hidden");
  await loadAdminAulas();
});

// ===== MODAL INSCRITOS =====
const inscritosModal = document.getElementById("inscritosModal");
document.getElementById("modalClose").addEventListener("click", () => inscritosModal.classList.add("hidden"));
inscritosModal.addEventListener("click", (e) => { if (e.target === inscritosModal) inscritosModal.classList.add("hidden"); });

async function openInscritosModal(aulaId, label) {
  document.getElementById("modalAulaTitulo").textContent = `Inscritos — ${label}`;
  const bodyDiv = document.getElementById("modalInscritosList");
  bodyDiv.innerHTML = '<p class="loading-text">Carregando...</p>';
  inscritosModal.classList.remove("hidden");

  const { data } = await supabase
    .from("inscricoes")
    .select("users(nome, foto_url)")
    .eq("aula_id", aulaId);

  if (!data || data.length === 0) {
    bodyDiv.innerHTML = '<p class="empty-text">Nenhum inscrito nesta aula.</p>';
    return;
  }

  bodyDiv.innerHTML = "";
  data.forEach(({ users: u }) => {
    if (!u) return;
    const item = document.createElement("div");
    item.className = "modal-aluno-item";
    item.innerHTML = `${avatarHtml(u, "avatar-sm")}<span>${u.nome || "—"}</span>`;
    bodyDiv.appendChild(item);
  });
}

// ===== CADASTRAR ALUNO =====
document.getElementById("novoAlunoForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errorDiv = document.getElementById("alunoFormError");
  const btn = document.getElementById("cadastrarAlunoBtn");
  errorDiv.classList.add("hidden");
  btn.disabled = true;
  btn.textContent = "Cadastrando...";

  const nome = document.getElementById("alunoNome").value.trim();
  const email = document.getElementById("alunoEmail").value.trim();
  const nascimento = document.getElementById("alunoNascimento").value;
  const cpf = document.getElementById("alunoCpf").value.trim();
  const rg = document.getElementById("alunoRg").value.trim();
  const telefone = document.getElementById("alunoTelefone").value.trim();
  const rua = document.getElementById("alunoRua").value.trim();
  const numero = document.getElementById("alunoNumero").value.trim();
  const bairro = document.getElementById("alunoBairro").value.trim();
  const cidade = document.getElementById("alunoCidade").value.trim();
  const estado = document.getElementById("alunoEstado").value.trim();
  const cep = document.getElementById("alunoCep").value.trim();
  const inicio = document.getElementById("alunoInicio").value;
  const obs = document.getElementById("alunoObs").value.trim();
  const fotoFile = document.getElementById("alunoFoto").files[0];

  try {
    // Salva dados pendentes no localStorage para usar após o aluno confirmar o email
    const dadosPendentes = {
      nome, nascimento, cpf, rg, telefone,
      rua, numero, bairro, cidade, estado, cep,
      inicio, obs, role: "aluno", bloqueado: false,
    };

    // Envia convite por email — o aluno clica no link e define a senha
    const { error: inviteErr } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: "https://gustavobalta.github.io/treinocomrina/pages/reset-password.html",
        data: dadosPendentes,
      },
    });

    if (inviteErr) throw inviteErr;

    // Salva perfil provisório no Firestore (sem UID ainda — será preenchido no primeiro login)
    // Usamos email como chave temporária na tabela pending_users
    await supabase.from("pending_users").upsert({
      email, nome, nascimento, cpf, rg, telefone,
      rua, numero, bairro, cidade, estado, cep,
      inicio, obs,
    });

    e.target.reset();
    document.getElementById("avatarInitial").textContent = "?";
    document.getElementById("avatarInitial").classList.remove("hidden");
    document.getElementById("avatarPreviewImg").classList.add("hidden");
    cadastroAlunoModal.classList.add("hidden");

    alert(`Convite enviado para ${email}! O aluno receberá um e-mail para definir a senha.`);
  } catch (err) {
    console.error(err);
    errorDiv.textContent = friendlyAlunoError(err.message);
    errorDiv.classList.remove("hidden");
  } finally {
    btn.disabled = false;
    btn.textContent = "Cadastrar e Enviar E-mail";
  }
});

function friendlyAlunoError(msg) {
  if (msg.includes("already registered")) return "Este e-mail já está cadastrado.";
  if (msg.includes("invalid")) return "E-mail inválido.";
  return `Erro ao cadastrar: ${msg}`;
}

// ===== CARREGAR ALUNOS =====
async function loadAlunos() {
  const container = document.getElementById("alunosList");

  const { data: alunos } = await supabase
    .from("users").select("*").eq("role", "aluno").order("nome");

  if (!alunos || alunos.length === 0) {
    container.innerHTML = '<p class="empty-text">Nenhum aluno cadastrado.</p>';
    return;
  }

  container.innerHTML = "";
  alunos.forEach((aluno) => {
    const bloqueado = aluno.bloqueado === true;
    const item = document.createElement("div");
    item.className = `aluno-item${bloqueado ? " bloqueado" : ""}`;
    item.innerHTML = `
      ${avatarHtml(aluno, "avatar-md")}
      <div class="aluno-info">
        <div class="aluno-nome">${aluno.nome || "Sem nome"}</div>
        <div class="aluno-email">${aluno.email || ""}</div>
        <span class="aluno-status-badge ${bloqueado ? "bloqueado" : "ativo"}">
          ${bloqueado ? "Bloqueado" : "Ativo"}
        </span>
      </div>
      <div class="aluno-actions">
        <button class="btn-secondary" data-action="ver-aluno" data-uid="${aluno.id}">Detalhes</button>
        <button class="btn-secondary" data-action="editar-aluno" data-uid="${aluno.id}">Editar</button>
        <button class="${bloqueado ? "btn-success" : "btn-danger"}" data-action="toggle-block"
          data-uid="${aluno.id}" data-bloqueado="${bloqueado}">
          ${bloqueado ? "Desbloquear" : "Bloquear"}
        </button>
      </div>
    `;
    container.appendChild(item);
  });

  container.querySelectorAll("[data-action='toggle-block']").forEach((btn) => btn.addEventListener("click", () => toggleBlock(btn)));
  container.querySelectorAll("[data-action='ver-aluno']").forEach((btn) => btn.addEventListener("click", () => openAlunoModal(btn.dataset.uid)));
  container.querySelectorAll("[data-action='editar-aluno']").forEach((btn) => btn.addEventListener("click", () => openEditAlunoModal(btn.dataset.uid)));
}

async function toggleBlock(btn) {
  const uid = btn.dataset.uid;
  const atual = btn.dataset.bloqueado === "true";
  await supabase.from("users").update({ bloqueado: !atual }).eq("id", uid);
  await loadAlunos();
}

// ===== MODAL DETALHES ALUNO =====
const alunoModal = document.getElementById("alunoModal");
document.getElementById("alunoModalClose").addEventListener("click", () => alunoModal.classList.add("hidden"));
alunoModal.addEventListener("click", (e) => { if (e.target === alunoModal) alunoModal.classList.add("hidden"); });

async function openAlunoModal(uid) {
  document.getElementById("alunoModalNome").textContent = "Detalhes do Aluno";
  const body = document.getElementById("alunoModalBody");
  body.innerHTML = '<p class="loading-text">Carregando...</p>';
  alunoModal.classList.remove("hidden");

  const { data: a } = await supabase.from("users").select("*").eq("id", uid).single();
  if (!a) { body.innerHTML = '<p class="empty-text">Aluno não encontrado.</p>'; return; }

  document.getElementById("alunoModalNome").textContent = a.nome || "Aluno";
  const endStr = [a.rua, a.numero, a.bairro, a.cidade, a.estado, a.cep].filter(Boolean).join(", ") || "—";

  body.innerHTML = `
    <div class="detail-avatar">${avatarHtml(a, "avatar-lg")}</div>
    <div class="detail-grid">
      <div class="detail-item"><span class="detail-label">Nome</span><span>${a.nome || "—"}</span></div>
      <div class="detail-item"><span class="detail-label">E-mail</span><span>${a.email || "—"}</span></div>
      <div class="detail-item"><span class="detail-label">Telefone</span><span>${a.telefone || "—"}</span></div>
      <div class="detail-item"><span class="detail-label">Nascimento</span><span>${formatDate(a.nascimento)}</span></div>
      <div class="detail-item"><span class="detail-label">CPF</span><span>${a.cpf || "—"}</span></div>
      <div class="detail-item"><span class="detail-label">RG</span><span>${a.rg || "—"}</span></div>
      <div class="detail-item detail-full"><span class="detail-label">Endereço</span><span>${endStr}</span></div>
      <div class="detail-item"><span class="detail-label">Início</span><span>${formatDate(a.inicio)}</span></div>
      <div class="detail-item"><span class="detail-label">Status</span><span>${a.bloqueado ? "Bloqueado" : "Ativo"}</span></div>
      ${a.obs ? `<div class="detail-item detail-full"><span class="detail-label">Observações</span><span>${a.obs}</span></div>` : ""}
    </div>
  `;
}

// ===== MODAL EDITAR ALUNO =====
const editAlunoModal = document.getElementById("editAlunoModal");
document.getElementById("editAlunoClose").addEventListener("click", () => editAlunoModal.classList.add("hidden"));
editAlunoModal.addEventListener("click", (e) => { if (e.target === editAlunoModal) editAlunoModal.classList.add("hidden"); });

document.getElementById("editAlunoFoto").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    document.getElementById("editAvatarInitial").classList.add("hidden");
    const img = document.getElementById("editAvatarPreviewImg");
    img.src = ev.target.result;
    img.classList.remove("hidden");
  };
  reader.readAsDataURL(file);
});

async function openEditAlunoModal(uid) {
  const { data: a } = await supabase.from("users").select("*").eq("id", uid).single();
  if (!a) return;

  document.getElementById("editAlunoUid").value = uid;
  document.getElementById("editNome").value = a.nome || "";
  document.getElementById("editEmail").value = a.email || "";
  document.getElementById("editNascimento").value = a.nascimento || "";
  document.getElementById("editCpf").value = a.cpf || "";
  document.getElementById("editRg").value = a.rg || "";
  document.getElementById("editTelefone").value = a.telefone || "";
  document.getElementById("editRua").value = a.rua || "";
  document.getElementById("editNumero").value = a.numero || "";
  document.getElementById("editBairro").value = a.bairro || "";
  document.getElementById("editCidade").value = a.cidade || "";
  document.getElementById("editEstado").value = a.estado || "";
  document.getElementById("editCep").value = a.cep || "";
  document.getElementById("editInicio").value = a.inicio || "";
  document.getElementById("editObs").value = a.obs || "";
  document.getElementById("editAlunoFoto").value = "";
  document.getElementById("editAlunoError").classList.add("hidden");
  document.getElementById("editAlunoSuccess").classList.add("hidden");

  if (a.foto_url) {
    document.getElementById("editAvatarInitial").classList.add("hidden");
    const img = document.getElementById("editAvatarPreviewImg");
    img.src = a.foto_url;
    img.classList.remove("hidden");
  } else {
    document.getElementById("editAvatarPreviewImg").classList.add("hidden");
    const ini = document.getElementById("editAvatarInitial");
    ini.textContent = (a.nome || "?")[0].toUpperCase();
    ini.classList.remove("hidden");
  }

  editAlunoModal.classList.remove("hidden");
}

document.getElementById("editAlunoForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errorDiv = document.getElementById("editAlunoError");
  const successDiv = document.getElementById("editAlunoSuccess");
  const btn = document.getElementById("editAlunoBtn");
  errorDiv.classList.add("hidden");
  successDiv.classList.add("hidden");
  btn.disabled = true;
  btn.textContent = "Salvando...";

  const uid = document.getElementById("editAlunoUid").value;
  const fotoFile = document.getElementById("editAlunoFoto").files[0];

  try {
    let foto_url;
    if (fotoFile) {
      btn.textContent = "Enviando foto...";
      const ext = fotoFile.name.split(".").pop();
      const path = `fotos/${uid}.${ext}`;
      await supabase.storage.from("fotos").upload(path, fotoFile, { upsert: true });
      const { data: urlData } = supabase.storage.from("fotos").getPublicUrl(path);
      foto_url = urlData.publicUrl;
    }

    const dados = {
      nome: document.getElementById("editNome").value.trim(),
      nascimento: document.getElementById("editNascimento").value,
      cpf: document.getElementById("editCpf").value.trim(),
      rg: document.getElementById("editRg").value.trim(),
      telefone: document.getElementById("editTelefone").value.trim(),
      rua: document.getElementById("editRua").value.trim(),
      numero: document.getElementById("editNumero").value.trim(),
      bairro: document.getElementById("editBairro").value.trim(),
      cidade: document.getElementById("editCidade").value.trim(),
      estado: document.getElementById("editEstado").value.trim(),
      cep: document.getElementById("editCep").value.trim(),
      inicio: document.getElementById("editInicio").value,
      obs: document.getElementById("editObs").value.trim(),
    };
    if (foto_url) dados.foto_url = foto_url;

    const { error } = await supabase.from("users").update(dados).eq("id", uid);
    if (error) throw error;

    successDiv.textContent = "Dados salvos com sucesso!";
    successDiv.classList.remove("hidden");
    await loadAlunos();
  } catch (err) {
    console.error(err);
    errorDiv.textContent = `Erro ao salvar: ${err.message}`;
    errorDiv.classList.remove("hidden");
  } finally {
    btn.disabled = false;
    btn.textContent = "Salvar alterações";
  }
});

// ===== HELPERS =====
function avatarHtml(user, sizeClass) {
  const foto = user.foto_url || user.fotoUrl;
  if (foto) return `<img src="${foto}" class="avatar ${sizeClass}" alt="${user.nome}" />`;
  const initial = (user.nome || "?")[0].toUpperCase();
  return `<div class="avatar avatar-initial ${sizeClass}">${initial}</div>`;
}

function formatDate(val) {
  if (!val) return "—";
  const [y, m, d] = val.split("-");
  return `${d}/${m}/${y}`;
}
