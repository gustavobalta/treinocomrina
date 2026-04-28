import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc, getDoc, setDoc, collection, getDocs, addDoc, deleteDoc,
  query, where, updateDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const DIAS_ORDER = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = "../index.html"; return; }

  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists() || snap.data().role !== "admin") {
    window.location.href = "../index.html"; return;
  }

  await loadAdminAulas();
  await loadAlunos();
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "../index.html";
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

  container.querySelectorAll("[data-action='excluir-aula']").forEach((btn) => {
    btn.addEventListener("click", () => excluirAula(btn.dataset.aula));
  });
}

async function excluirAula(aulaId) {
  if (!confirm("Excluir esta aula? Todas as inscrições serão removidas.")) return;

  await deleteDoc(doc(db, "aulas", aulaId));

  // Remove inscrições associadas
  const q = query(collection(db, "inscricoes"), where("aulaId", "==", aulaId));
  const snap = await getDocs(q);
  for (const d of snap.docs) await deleteDoc(d.ref);

  await loadAdminAulas();
}

// ===== MODAL INSCRITOS =====
const modal = document.getElementById("inscritosModal");
document.getElementById("modalClose").addEventListener("click", () => modal.classList.add("hidden"));
modal.addEventListener("click", (e) => { if (e.target === modal) modal.classList.add("hidden"); });

async function openInscritosModal(aulaId, label) {
  document.getElementById("modalAulaTitulo").textContent = `Inscritos — ${label}`;
  const bodyDiv = document.getElementById("modalInscritosList");
  bodyDiv.innerHTML = '<p class="loading-text">Carregando...</p>';
  modal.classList.remove("hidden");

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
      <span>${u.nome || "—"}</span>
      <span style="color: var(--white-muted); font-size:0.78rem">${u.email || ""}</span>
    `;
    bodyDiv.appendChild(item);
  });
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
      <div class="aluno-info">
        <div class="aluno-nome">${aluno.nome || "Sem nome"}</div>
        <div class="aluno-email">${aluno.email || ""}</div>
        <span class="aluno-status-badge ${bloqueado ? "bloqueado" : "ativo"}">
          ${bloqueado ? "Bloqueado" : "Ativo"}
        </span>
      </div>
      <div class="aluno-actions">
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
}

async function toggleBlock(btn) {
  const uid = btn.dataset.uid;
  const atual = btn.dataset.bloqueado === "true";
  const novoEstado = !atual;

  await updateDoc(doc(db, "users", uid), { bloqueado: novoEstado });
  await loadAlunos();
}
