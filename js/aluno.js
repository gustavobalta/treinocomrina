import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc, getDoc, collection, getDocs,
  addDoc, deleteDoc, query, where, orderBy,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let currentUser = null;
let userData = null;

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = "../index.html"; return; }

  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists() || snap.data().role !== "aluno") {
    window.location.href = "../index.html"; return;
  }

  currentUser = user;
  userData = snap.data();

  document.getElementById("userNameDisplay").textContent = userData.nome || user.email;

  if (userData.bloqueado) {
    document.getElementById("blockedBanner").classList.remove("hidden");
  }

  await loadAulas();
  await loadMinhasAulas();
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "../index.html";
});

// Ordem dos dias para ordenação
const DIAS_ORDER = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

async function loadAulas() {
  const container = document.getElementById("aulasList");

  const aulasSnap = await getDocs(collection(db, "aulas"));
  const inscricoesSnap = await getDocs(
    query(collection(db, "inscricoes"), where("userId", "==", currentUser.uid))
  );

  const inscritoIds = new Set(inscricoesSnap.docs.map((d) => d.data().aulaId));

  const aulas = aulasSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => {
      const di = DIAS_ORDER.indexOf(a.dia) - DIAS_ORDER.indexOf(b.dia);
      if (di !== 0) return di;
      return a.horario.localeCompare(b.horario);
    });

  if (aulas.length === 0) {
    container.innerHTML = '<p class="empty-text">Nenhuma aula disponível no momento.</p>';
    return;
  }

  // Conta inscritos por aula
  const allInscricoes = await getDocs(collection(db, "inscricoes"));
  const countMap = {};
  allInscricoes.docs.forEach((d) => {
    const aid = d.data().aulaId;
    countMap[aid] = (countMap[aid] || 0) + 1;
  });

  container.innerHTML = "";
  aulas.forEach((aula) => {
    const inscrito = inscritoIds.has(aula.id);
    const total = countMap[aula.id] || 0;
    const lotada = total >= aula.vagas;

    const card = document.createElement("div");
    card.className = `aula-card${inscrito ? " inscrito" : ""}${lotada && !inscrito ? " lotada" : ""}`;
    card.innerHTML = `
      <div class="aula-dia">${aula.dia}</div>
      <div class="aula-horario">${aula.horario}</div>
      ${aula.descricao ? `<div class="aula-desc">${aula.descricao}</div>` : ""}
      <div class="aula-vagas${lotada ? " lotada" : ""}">${total}/${aula.vagas} vagas</div>
      <div class="aula-actions">
        ${buildAulaBtn(inscrito, lotada, aula.id, userData.bloqueado)}
      </div>
    `;
    container.appendChild(card);
  });

  // Eventos nos botões
  container.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => handleInscricao(btn));
  });
}

function buildAulaBtn(inscrito, lotada, aulaId, bloqueado) {
  if (bloqueado) {
    return `<button class="btn-secondary" disabled>Conta bloqueada</button>`;
  }
  if (inscrito) {
    return `<button class="btn-danger" data-action="cancelar" data-aula="${aulaId}">Cancelar inscrição</button>`;
  }
  if (lotada) {
    return `<button class="btn-secondary" disabled>Turma lotada</button>`;
  }
  return `<button class="btn-success" data-action="inscrever" data-aula="${aulaId}">Inscrever-se</button>`;
}

async function handleInscricao(btn) {
  const action = btn.dataset.action;
  const aulaId = btn.dataset.aula;
  btn.disabled = true;

  if (action === "inscrever") {
    await addDoc(collection(db, "inscricoes"), {
      userId: currentUser.uid,
      aulaId,
      criadoEm: new Date(),
    });
  } else {
    const q = query(
      collection(db, "inscricoes"),
      where("userId", "==", currentUser.uid),
      where("aulaId", "==", aulaId)
    );
    const snap = await getDocs(q);
    for (const d of snap.docs) await deleteDoc(d.ref);
  }

  await loadAulas();
  await loadMinhasAulas();
}

async function loadMinhasAulas() {
  const container = document.getElementById("minhasAulas");

  const inscricoesSnap = await getDocs(
    query(collection(db, "inscricoes"), where("userId", "==", currentUser.uid))
  );

  if (inscricoesSnap.empty) {
    container.innerHTML = '<p class="empty-text">Você ainda não está inscrito em nenhuma aula.</p>';
    return;
  }

  const aulaIds = inscricoesSnap.docs.map((d) => d.data().aulaId);

  const aulas = await Promise.all(
    aulaIds.map(async (id) => {
      const snap = await getDoc(doc(db, "aulas", id));
      return snap.exists() ? { id: snap.id, ...snap.data() } : null;
    })
  );

  const valid = aulas
    .filter(Boolean)
    .sort((a, b) => {
      const di = DIAS_ORDER.indexOf(a.dia) - DIAS_ORDER.indexOf(b.dia);
      if (di !== 0) return di;
      return a.horario.localeCompare(b.horario);
    });

  container.innerHTML = "";
  valid.forEach((aula) => {
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
