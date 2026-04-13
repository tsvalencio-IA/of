/**
 * JARVIS ERP V2 — auth.js
 * Autenticação híbrida: Master (Admin) + Equipe (Funcionário) + PIN
 *
 * FONTE ÚNICA DE VERDADE para todas as funções de autenticação.
 * NÃO duplicar nenhuma dessas funções em index.html ou qualquer outro arquivo.
 *
 * ATENÇÃO — Firestore Índice Composto obrigatório para login por PIN:
 *   Coleção: funcionarios
 *   Campos:  usuario (Ascending) + pin (Ascending)
 *   Criar em: Firebase Console → Firestore → Indexes → Add index
 *   Sem esse índice o login por PIN retorna erro silencioso.
 */

'use strict';

// ============================================================
// LOGIN MASTER (aba Master — admin da oficina)
// ============================================================
window.autenticar = async function() {
  const usr = document.getElementById('usr')?.value.trim() || '';
  const pwd = document.getElementById('pwd')?.value.trim() || '';
  const err = document.getElementById('loginErr');
  const btn = document.getElementById('btnLogin');

  if (!err || !btn) return;

  err.style.display = 'none';
  if (!usr || !pwd) {
    err.textContent = 'Preencha usuário e senha.';
    err.style.display = 'block';
    return;
  }

  btn.innerHTML = '<span class="spinner"></span> Autenticando...';
  btn.disabled = true;

  try {
    const db = window.initFirebase();

    // CAMADA 1: Admin da oficina (Master)
    const snapOf = await db.collection('oficinas').where('usuario', '==', usr).get();
    if (!snapOf.empty) {
      const doc = snapOf.docs[0];
      const d = doc.data();

      if (d.senha !== pwd) throw new Error('Senha incorreta.');
      if (d.status === 'Bloqueado') throw new Error('Licença bloqueada. Contate o suporte.');

      _salvarSessao(doc.id, d, 'admin', d.nomeFantasia || 'Gestor', null, d);
      window.location.href = 'jarvis.html';
      return;
    }

    // CAMADA 2: Funcionário via aba Master (fallback)
    const snapFn = await db.collection('funcionarios').where('usuario', '==', usr).get();
    if (!snapFn.empty) {
      const docF = snapFn.docs[0];
      const dF = docF.data();

      if (dF.senha !== pwd) throw new Error('Senha incorreta.');

      const mae = await db.collection('oficinas').doc(dF.tenantId).get();
      if (!mae.exists || mae.data().status === 'Bloqueado') throw new Error('Oficina bloqueada.');

      const maeData = mae.data();
      const role = dF.cargo === 'gerente' ? 'gerente'
                 : dF.cargo === 'atendente' ? 'atendente'
                 : 'equipe';

      _salvarSessao(dF.tenantId, maeData, role, dF.nome, docF.id, maeData, dF.comissao || 0);
      window.location.href = 'equipe.html';
      return;
    }

    throw new Error('Usuário não encontrado no sistema.');
  } catch (e) {
    err.textContent = e.message || 'Erro ao autenticar';
    err.style.display = 'block';
    btn.innerHTML = 'Entrar no Sistema';
    btn.disabled = false;
  }
};

// ============================================================
// LOGIN EQUIPE (aba Equipe — funcionário com usuário + senha)
// FIX: estava apenas como função inline no index.html.
//      Movido para cá como fonte única. Removido do index.html.
// ============================================================
window.autenticarEquipe = async function() {
  const usr = document.getElementById('usrEquipe')?.value.trim() || '';
  const pwd = document.getElementById('pwdEquipe')?.value.trim() || '';
  const err = document.getElementById('loginErrEquipe');
  const btn = document.getElementById('btnLoginEquipe');

  if (!err || !btn) return;

  err.style.display = 'none';
  if (!usr || !pwd) {
    err.textContent = 'Preencha usuário e senha.';
    err.style.display = 'block';
    return;
  }

  btn.innerHTML = '<span class="spinner"></span> Autenticando...';
  btn.disabled = true;

  try {
    const db = window.initFirebase();

    const snap = await db.collection('funcionarios').where('usuario', '==', usr).get();
    if (snap.empty) throw new Error('Usuário não encontrado.');

    const doc = snap.docs[0];
    const data = doc.data();

    if (data.senha !== pwd) throw new Error('Senha incorreta.');

    const mae = await db.collection('oficinas').doc(data.tenantId).get();
    if (!mae.exists || mae.data().status === 'Bloqueado') throw new Error('Oficina bloqueada. Contate o suporte.');

    const maeData = mae.data();
    // FIX: atendente agora tem role próprio, consistente com autenticar() e autenticarComPIN()
    const role = data.cargo === 'gerente' ? 'gerente'
               : data.cargo === 'atendente' ? 'atendente'
               : 'equipe';

    _salvarSessao(data.tenantId, maeData, role, data.nome, doc.id, maeData, data.comissao || 0);
    window.location.href = 'equipe.html';
  } catch (e) {
    err.textContent = e.message || 'Erro ao autenticar';
    err.style.display = 'block';
    btn.innerHTML = 'Entrar como Equipe';
    btn.disabled = false;
  }
};

// ============================================================
// LOGIN COM PIN (aba PIN — funcionário com usuário + PIN 4 dígitos)
// FIX: estava duplicado no index.html inline (sobrescrevia esta versão).
//      Duplicata removida do index.html. Esta é a fonte única.
//
// ATENÇÃO — requer índice composto no Firestore:
//   coleção: funcionarios | campos: usuario ASC + pin ASC
// ============================================================
window.autenticarComPIN = async function() {
  const usr = document.getElementById('usrPin')?.value.trim() || '';
  const pin = document.getElementById('pinInput')?.value.trim() || '';
  const err = document.getElementById('loginErrPin');
  const btn = document.getElementById('btnLoginPin');

  if (!err || !btn) return;

  err.style.display = 'none';
  if (!usr || !pin) {
    err.textContent = 'Preencha usuário e PIN.';
    err.style.display = 'block';
    return;
  }

  if (pin.length !== 4 || !/^\d+$/.test(pin)) {
    err.textContent = 'PIN deve conter 4 dígitos.';
    err.style.display = 'block';
    return;
  }

  btn.innerHTML = '<span class="spinner"></span> Autenticando...';
  btn.disabled = true;

  try {
    const db = window.initFirebase();

    // Esta query exige índice composto no Firestore (usuario + pin).
    // Se o índice não existir, o Firestore retorna erro com link para criá-lo no console.
    const snap = await db.collection('funcionarios')
      .where('usuario', '==', usr)
      .where('pin', '==', pin)
      .get();

    if (snap.empty) throw new Error('Usuário ou PIN incorreto.');

    const doc = snap.docs[0];
    const data = doc.data();

    const mae = await db.collection('oficinas').doc(data.tenantId).get();
    if (!mae.exists) throw new Error('Oficina não encontrada.');
    // FIX: verificação de bloqueio da oficina estava ausente nesta função
    if (mae.data().status === 'Bloqueado') throw new Error('Oficina bloqueada. Contate o suporte.');

    const maeData = mae.data();
    // FIX: atendente agora tem role próprio, consistente com autenticar() e autenticarEquipe()
    const role = data.cargo === 'gerente' ? 'gerente'
               : data.cargo === 'atendente' ? 'atendente'
               : 'equipe';

    _salvarSessao(data.tenantId, maeData, role, data.nome, doc.id, maeData, data.comissao || 0);
    window.location.href = 'equipe.html';
  } catch (e) {
    err.textContent = e.message || 'Erro ao autenticar';
    err.style.display = 'block';
    btn.innerHTML = 'Entrar com PIN';
    btn.disabled = false;
  }
};

// ============================================================
// SALVAR SESSÃO
// ============================================================
function _salvarSessao(tid, d, role, nome, fid, maeData, comissao = 0) {
  sessionStorage.setItem('j_tid', tid);
  sessionStorage.setItem('j_tnome', maeData.nomeFantasia || 'Oficina');
  sessionStorage.setItem('j_role', role);
  sessionStorage.setItem('j_nome', nome);
  if (fid) sessionStorage.setItem('j_fid', fid);
  sessionStorage.setItem('j_comissao', comissao);
  sessionStorage.setItem('j_gemini', maeData.apiKeys?.gemini || '');
  sessionStorage.setItem('j_nicho', maeData.nicho || 'carros');
  sessionStorage.setItem('j_cloud_name', maeData.apiKeys?.cloudName || 'dmuvm1o6m');
  sessionStorage.setItem('j_cloud_preset', maeData.apiKeys?.cloudPreset || 'evolution');

  const brand = {
    name: maeData.brandName || maeData.nomeFantasia,
    tagline: maeData.brandTagline || 'Gestão Automotiva',
    logoLetter: maeData.brandLetter || (maeData.nomeFantasia || 'J').charAt(0).toUpperCase(),
    color: maeData.brandColor || '#3B82F6',
    footer: maeData.brandFooter || `${maeData.nomeFantasia} · Powered by JARVIS ERP`
  };

  const r = parseInt((brand.color || '#3B82F6').slice(1, 3), 16);
  const g = parseInt((brand.color || '#3B82F6').slice(3, 5), 16);
  const b = parseInt((brand.color || '#3B82F6').slice(5, 7), 16);
  brand.colorDim  = `rgba(${r},${g},${b},.12)`;
  brand.colorGlow = `rgba(${r},${g},${b},.25)`;

  sessionStorage.setItem('j_brand', JSON.stringify(brand));
}

// ============================================================
// LOGOUT
// ============================================================
window.fazerLogout = function() {
  if (confirm('Deseja sair do sistema?')) {
    sessionStorage.clear();
    window.location.href = 'index.html';
  }
};

// ============================================================
// INICIALIZAÇÃO (index.html)
// Todos os listeners de teclado e comportamento de UI ficam aqui.
// FIX: listeners da aba Equipe estavam APENAS no inline do index.html — movidos para cá.
// NÃO duplicar nenhum listener no inline do index.html.
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  sessionStorage.clear();

  // --- ABA MASTER ---
  const usr = document.getElementById('usr');
  const pwd = document.getElementById('pwd');

  if (usr) usr.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('pwd')?.focus();
  });
  if (pwd) pwd.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') window.autenticar();
  });

  // --- ABA EQUIPE ---
  // FIX: estes listeners estavam apenas no inline do index.html — movidos para cá.
  const usrEquipe = document.getElementById('usrEquipe');
  const pwdEquipe = document.getElementById('pwdEquipe');

  if (usrEquipe) usrEquipe.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('pwdEquipe')?.focus();
  });
  if (pwdEquipe) pwdEquipe.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') window.autenticarEquipe();
  });

  // --- ABA PIN ---
  const usrPin   = document.getElementById('usrPin');
  const pinInput = document.getElementById('pinInput');

  if (usrPin) usrPin.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('pinInput')?.focus();
  });
  if (pinInput) {
    pinInput.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/[^\d]/g, '').slice(0, 4);
    });
    pinInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') window.autenticarComPIN();
    });
  }

  // --- BRAND ---
  try {
    const b = JSON.parse(sessionStorage.getItem('j_brand') || 'null');
    if (b) window.aplicarBrand(b);
  } catch (e) {
    // Silencioso
  }
});
