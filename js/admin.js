import { auth, db, storage } from "./firebase.js";
import {
  onAuthStateChanged, signOut,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc, getDoc, setDoc, collection, getDocs, addDoc, deleteDoc,
  query, where, updateDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  ref, uploadBytes, getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const DIAS_ORDER = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

let adminEmail = "";
let adminPassword = "";

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = "../index.html"; return; }
  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists() || snap.data().role !== "admin") {
    window.location.href = "../index.html"; return;
  }
  adminEmail = user.email;
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
  adminPassword = "";
  await signOut(auth);
  window.location.href = "../index.html";
});

// ===== PREVIEW FOTO NO CADASTRO =====
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
  const initial = e.target.value.trim()[0] || "?";
  document.getElementById("avatarInitial").textContent = initial.toUpperCase();
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

  if (!dia || !horario || !vagas) {
    errorDiv.textContent = "Preencha todos os campos obrigatórios.";
    errorDiv.classList.remove("hidden");
    return;
  }

  await addDoc(collection(db, "aulas"), { dia, horario, vagas, descricao, criadoEm: new Date() });
  e.target.reset();
  await loadAdminAulas();
});

// ===== CARREGAR AULAS =====
async function loadAdminAulas() {
  const container = document.getElementById("adminAulasList");

  const snap = await getDocs(collection(db, "aulas"));
  const allInscricoes = await getDocs(collection(db, "inscricoes"));

  const countMap = {};
  allInscricoes.docs.forEach((d) => {
    const aid = d.data().aulaId;
    countMap[aid] = (countMap[aid] || 0) + 1;
  });

  const aulas = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => {
      const di = DIAS_ORDER.indexOf(a.dia) - DIAS_ORDER.indexOf(b.dia);
      if (di !== 0) return di;
      return a.horario.localeCompare(b.horario);
    });

  if (aulas.length === 0) {
    container.innerHTML = '<p class="empty-text">Nenhuma aula cadastrada.</p>';
    return;
  }

  container.innerHTML = "";
  aulas.forEach((aula) => {
    const total = countMap[aula.id] || 0;
    const item = document.createElement("div");
    item.className = "aula-admin-item";
    item.innerHTML = `
      <div class="aula-admin-info">
        <div class="aula-admin-dia">${aula.dia}</div>
        <div class="aula-admin-horario">${aula.horario}</div>
        ${aula.descricao ? `<div class="aula-admin-desc">${aula.descricao}</div>` : ""}
        <div class="aula-admin-vagas">${total}/${aula.vagas} inscritos</div>
      </div>
      <div class="aula-admin-actions">
        <button class="btn-secondary" data-action="ver-inscritos" data-aula="${aula.id}" data-label="${aula.dia} ${aula.horario}">
          Ver inscritos
        </button>
        <button class="btn-secondary" data-action="editar-aula" data-aula="${aula.id}">
          Editar
        </button>
        <button class="btn-danger" data-action="excluir-aula" data-aula="${aula.id}">
          Excluir
        </button>
      </div>
    `;
    container.appendChild(item);
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
  await deleteDoc(doc(db, "aulas", aulaId));
  const q = query(collection(db, "inscricoes"), where("aulaId", "==", aulaId));
  const snap = await getDocs(q);
  for (const d of snap.docs) await deleteDoc(d.ref);
  await loadAdminAulas();
}

// ===== MODAL EDITAR AULA =====
const editAulaModal = document.getElementById("editAulaModal");
document.getElementById("editAulaClose").addEventListener("click", () => editAulaModal.classList.add("hidden"));
editAulaModal.addEventListener("click", (e) => { if (e.target === editAulaModal) editAulaModal.classList.add("hidden"); });

async function openEditAulaModal(aulaId) {
  const snap = await getDoc(doc(db, "aulas", aulaId));
  if (!snap.exists()) return;
  const aula = snap.data();

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
  const dia = document.getElementById("editDiaSemana").value;
  const horario = document.getElementById("editHorario").value;
  const vagas = parseInt(document.getElementById("editVagas").value);
  const descricao = document.getElementById("editDescricao").value.trim();

  try {
    await updateDoc(doc(db, "aulas", aulaId), { dia, horario, vagas, descricao });
    editAulaModal.classList.add("hidden");
    await loadAdminAulas();
  } catch (err) {
    errorDiv.textContent = "Erro ao salvar. Tente novamente.";
    errorDiv.classList.remove("hidden");
  }
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

  const q = query(collection(db, "inscricoes"), where("aulaId", "==", aulaId));
  const snap = await getDocs(q);

  if (snap.empty) {
    bodyDiv.innerHTML = '<p class="empty-text">Nenhum inscrito nesta aula.</p>';
    return;
  }

  const users = await Promise.all(
    snap.docs.map(async (d) => {
      const uSnap = await getDoc(doc(db, "users", d.data().userId));
      return uSnap.exists() ? uSnap.data() : null;
    })
  );

  bodyDiv.innerHTML = "";
  users.filter(Boolean).forEach((u) => {
    const item = document.createElement("div");
    item.className = "modal-aluno-item";
    item.innerHTML = `
      ${avatarHtml(u, "avatar-sm")}
      <span>${u.nome || "—"}</span>
    `;
    bodyDiv.appendChild(item);
  });
}

// ===== CADASTRAR NOVO ALUNO =====
document.getElementById("novoAlunoForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errorDiv = document.getElementById("alunoFormError");
  const successDiv = document.getElementById("alunoFormSuccess");
  const btn = document.getElementById("cadastrarAlunoBtn");
  errorDiv.classList.add("hidden");
  successDiv.classList.add("hidden");

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

  btn.disabled = true;
  btn.textContent = "Cadastrando...";

  try {
    if (!adminPassword) {
      adminPassword = prompt("Confirme sua senha de administrador para continuar:");
      if (!adminPassword) {
        btn.disabled = false;
        btn.textContent = "Cadastrar e Enviar E-mail";
        return;
      }
    }

    const senhaTemp = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-10);
    const cred = await createUserWithEmailAndPassword(auth, email, senhaTemp);
    const alunoUid = cred.user.uid;

    // Upload da foto se fornecida
    let fotoUrl = "";
    if (fotoFile) {
      btn.textContent = "Enviando foto...";
      const storageRef = ref(storage, `fotos/${alunoUid}`);
      await uploadBytes(storageRef, fotoFile);
      fotoUrl = await getDownloadURL(storageRef);
    }

    await setDoc(doc(db, "users", alunoUid), {
      nome, email, nascimento, cpf, rg, telefone, fotoUrl,
      endereco: { rua, numero, bairro, cidade, estado, cep },
      inicio, obs,
      role: "aluno",
      bloqueado: false,
      criadoEm: new Date(),
    });

    btn.textContent = "Enviando e-mail...";
    await sendPasswordResetEmail(auth, email);
    await signInWithEmailAndPassword(auth, adminEmail, adminPassword);

    e.target.reset();
    document.getElementById("avatarInitial").textContent = "?";
    document.getElementById("avatarInitial").classList.remove("hidden");
    document.getElementById("avatarPreviewImg").classList.add("hidden");

    successDiv.textContent = `Aluno "${nome}" cadastrado! E-mail de acesso enviado para ${email}.`;
    successDiv.classList.remove("hidden");
    await loadAlunos();
  } catch (err) {
    if (err.code === "auth/wrong-password") adminPassword = "";
    errorDiv.textContent = friendlyAlunoError(err.code);
    errorDiv.classList.remove("hidden");
  } finally {
    btn.disabled = false;
    btn.textContent = "Cadastrar e Enviar E-mail";
  }
});

function friendlyAlunoError(code) {
  const msgs = {
    "auth/email-already-in-use": "Este e-mail já está cadastrado.",
    "auth/invalid-email": "E-mail inválido.",
    "auth/weak-password": "Erro interno de senha temporária.",
    "auth/wrong-password": "Senha do administrador incorreta. Tente novamente.",
    "auth/network-request-failed": "Sem conexão. Verifique sua internet.",
  };
  return msgs[code] || "Erro ao cadastrar aluno. Tente novamente.";
}

// ===== CARREGAR ALUNOS =====
async function loadAlunos() {
  const container = document.getElementById("alunosList");

  const q = query(collection(db, "users"), where("role", "==", "aluno"));
  const snap = await getDocs(q);

  if (snap.empty) {
    container.innerHTML = '<p class="empty-text">Nenhum aluno cadastrado.</p>';
    return;
  }

  const alunos = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));

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
        <button class="btn-secondary" data-action="ver-aluno" data-uid="${aluno.id}">
          Detalhes
        </button>
        <button class="btn-secondary" data-action="editar-aluno" data-uid="${aluno.id}">
          Editar
        </button>
        <button
          class="${bloqueado ? "btn-success" : "btn-danger"}"
          data-action="toggle-block"
          data-uid="${aluno.id}"
          data-bloqueado="${bloqueado}"
        >
          ${bloqueado ? "Desbloquear" : "Bloquear"}
        </button>
      </div>
    `;
    container.appendChild(item);
  });

  container.querySelectorAll("[data-action='toggle-block']").forEach((btn) => {
    btn.addEventListener("click", () => toggleBlock(btn));
  });
  container.querySelectorAll("[data-action='ver-aluno']").forEach((btn) => {
    btn.addEventListener("click", () => openAlunoModal(btn.dataset.uid));
  });
  container.querySelectorAll("[data-action='editar-aluno']").forEach((btn) => {
    btn.addEventListener("click", () => openEditAlunoModal(btn.dataset.uid));
  });
}

async function toggleBlock(btn) {
  const uid = btn.dataset.uid;
  const atual = btn.dataset.bloqueado === "true";
  await updateDoc(doc(db, "users", uid), { bloqueado: !atual });
  await loadAlunos();
}

// ===== MODAL DETALHES DO ALUNO =====
const alunoModal = document.getElementById("alunoModal");
document.getElementById("alunoModalClose").addEventListener("click", () => alunoModal.classList.add("hidden"));
alunoModal.addEventListener("click", (e) => { if (e.target === alunoModal) alunoModal.classList.add("hidden"); });

async function openAlunoModal(uid) {
  document.getElementById("alunoModalNome").textContent = "Detalhes do Aluno";
  const body = document.getElementById("alunoModalBody");
  body.innerHTML = '<p class="loading-text">Carregando...</p>';
  alunoModal.classList.remove("hidden");

  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) { body.innerHTML = '<p class="empty-text">Aluno não encontrado.</p>'; return; }

  const a = snap.data();
  document.getElementById("alunoModalNome").textContent = a.nome || "Aluno";

  const end = a.endereco || {};
  const endStr = [end.rua, end.numero, end.bairro, end.cidade, end.estado, end.cep]
    .filter(Boolean).join(", ") || "—";

  body.innerHTML = `
    <div class="detail-avatar">${avatarHtml(a, "avatar-lg")}</div>
    <div class="detail-grid">
      <div class="detail-item"><span class="detail-label">Nome</span><span>${a.nome || "—"}</span></div>
      <div class="detail-item"><span class="detail-label">E-mail</span><span>${a.email || "—"}</span></div>
      <div class="detail-item"><span class="detail-label">Telefone</span><span>${a.telefone || "—"}</span></div>
      <div class="detail-item"><span class="detail-label">Data de nascimento</span><span>${formatDate(a.nascimento)}</span></div>
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
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return;
  const a = snap.data();
  const end = a.endereco || {};

  document.getElementById("editAlunoUid").value = uid;
  document.getElementById("editNome").value = a.nome || "";
  document.getElementById("editEmail").value = a.email || "";
  document.getElementById("editNascimento").value = a.nascimento || "";
  document.getElementById("editCpf").value = a.cpf || "";
  document.getElementById("editRg").value = a.rg || "";
  document.getElementById("editTelefone").value = a.telefone || "";
  document.getElementById("editRua").value = end.rua || "";
  document.getElementById("editNumero").value = end.numero || "";
  document.getElementById("editBairro").value = end.bairro || "";
  document.getElementById("editCidade").value = end.cidade || "";
  document.getElementById("editEstado").value = end.estado || "";
  document.getElementById("editCep").value = end.cep || "";
  document.getElementById("editInicio").value = a.inicio || "";
  document.getElementById("editObs").value = a.obs || "";
  document.getElementById("editAlunoFoto").value = "";
  document.getElementById("editAlunoError").classList.add("hidden");
  document.getElementById("editAlunoSuccess").classList.add("hidden");

  // Avatar preview
  if (a.fotoUrl) {
    document.getElementById("editAvatarInitial").classList.add("hidden");
    const img = document.getElementById("editAvatarPreviewImg");
    img.src = a.fotoUrl;
    img.classList.remove("hidden");
  } else {
    document.getElementById("editAvatarPreviewImg").classList.add("hidden");
    const initial = document.getElementById("editAvatarInitial");
    initial.textContent = (a.nome || "?")[0].toUpperCase();
    initial.classList.remove("hidden");
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
    let fotoUrl;
    if (fotoFile) {
      btn.textContent = "Enviando foto...";
      const storageRef = ref(storage, `fotos/${uid}`);
      await uploadBytes(storageRef, fotoFile);
      fotoUrl = await getDownloadURL(storageRef);
    }

    const dados = {
      nome: document.getElementById("editNome").value.trim(),
      nascimento: document.getElementById("editNascimento").value,
      cpf: document.getElementById("editCpf").value.trim(),
      rg: document.getElementById("editRg").value.trim(),
      telefone: document.getElementById("editTelefone").value.trim(),
      endereco: {
        rua: document.getElementById("editRua").value.trim(),
        numero: document.getElementById("editNumero").value.trim(),
        bairro: document.getElementById("editBairro").value.trim(),
        cidade: document.getElementById("editCidade").value.trim(),
        estado: document.getElementById("editEstado").value.trim(),
        cep: document.getElementById("editCep").value.trim(),
      },
      inicio: document.getElementById("editInicio").value,
      obs: document.getElementById("editObs").value.trim(),
    };

    if (fotoUrl) dados.fotoUrl = fotoUrl;

    await updateDoc(doc(db, "users", uid), dados);

    successDiv.textContent = "Dados salvos com sucesso!";
    successDiv.classList.remove("hidden");
    await loadAlunos();
  } catch (err) {
    errorDiv.textContent = "Erro ao salvar. Tente novamente.";
    errorDiv.classList.remove("hidden");
  } finally {
    btn.disabled = false;
    btn.textContent = "Salvar alterações";
  }
});

// ===== HELPERS =====
function avatarHtml(user, sizeClass) {
  if (user.fotoUrl) {
    return `<img src="${user.fotoUrl}" class="avatar ${sizeClass}" alt="${user.nome}" />`;
  }
  const initial = (user.nome || "?")[0].toUpperCase();
  return `<div class="avatar avatar-initial ${sizeClass}">${initial}</div>`;
}

function formatDate(val) {
  if (!val) return "—";
  const [y, m, d] = val.split("-");
  return `${d}/${m}/${y}`;
}
