/**
 * JARVIS ERP V2 — core.js
 * Estado global, listeners Firestore, utilitários
 * Namespace: window.J (INVIOLÁVEL)
 */

'use strict';

// ============================================================
// NAMESPACE GLOBAL — INVIOLÁVEL
// ============================================================
window.J = {
  // SESSÃO
  tid:         sessionStorage.getItem('j_tid')         || null,
  role:        sessionStorage.getItem('j_role')        || null,
  nome:        sessionStorage.getItem('j_nome')        || 'Usuário',
  tnome:       sessionStorage.getItem('j_tnome')       || 'Oficina',
  fid:         sessionStorage.getItem('j_fid')         || null,
  gemini:      sessionStorage.getItem('j_gemini')      || null,
  nicho:       sessionStorage.getItem('j_nicho')       || 'carros',
  cloudName:   sessionStorage.getItem('j_cloud_name')  || 'dmuvm1o6m',
  cloudPreset: sessionStorage.getItem('j_cloud_preset')|| 'evolution',
  brand:       JSON.parse(sessionStorage.getItem('j_brand') || 'null'),
  comissao:    parseFloat(sessionStorage.getItem('j_comissao') || '0'),

  // ESTADO IN-MEMORY
  os:              [],
  clientes:        [],
  veiculos:        [],
  estoque:         [],
  financeiro:      [],
  equipe:          [],
  fornecedores:    [],
  agendamentos:    [],
  mensagens:       [],
  chatEquipe:      [],
  auditoria:       [],
  conhecimentoIA:  [],
  chatAtivo:       null,

  // DB REFERENCE (preenchido em initCore)
  db: null
};

// ============================================================
// INICIALIZAÇÃO
// ============================================================
window.initCore = function() {
  // Firebase
  J.db = window.initFirebase();

  // Proteção de rota
  if (!J.tid) {
    window.location.replace('index.html');
    return;
  }

  // Aplicar brand do tenant
  if (J.brand) window.aplicarBrand(J.brand);

  // Popular UI base
  _populateBaseUI();

  // Start all listeners
  _escutarOS();
  _escutarClientes();
  _escutarVeiculos();
  _escutarEstoque();
  _escutarFinanceiro();
  _escutarEquipe();
  _escutarFornecedores();
  _escutarMensagens();
  _escutarAgendamentos();
  _escutarAuditoria();
  _escutarConhecimentoIA();
};

window.initCoreEquipe = function() {
  J.db = window.initFirebase();
  if (!J.tid || J.role === 'admin') {
    window.location.replace('index.html');
    return;
  }
  if (J.brand) window.aplicarBrand(J.brand);
  _escutarOS();
  _escutarClientes();
  _escutarVeiculos();
  _escutarEstoque();
  _escutarChatEquipe();
  _escutarComissoesEquipe();
};

function _populateBaseUI() {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('sbTenantNome', J.tnome);
  set('sbUserNome', J.nome);
  set('sbUserRole', (J.role || 'equipe').toUpperCase());
  set('topNomeTenant', J.tnome);

  const av = document.getElementById('sbAvatar');
  if (av) av.textContent = J.nome.charAt(0).toUpperCase();

  const nicho = { carros: '🚗 Carros', motos: '🏍️ Motos', bicicletas: '🚲 Bicicletas', multi: '🔧 Multi' };
  const tnEl = document.getElementById('tbNicho');
  if (tnEl) tnEl.textContent = nicho[J.nicho] || '🚗 Carros';
}

// ============================================================
// LISTENERS FIRESTORE
// ============================================================
function _escutarOS() {
  J.db.collection('ordens_servico')
    .where('tenantId', '==', J.tid)
    .onSnapshot(snap => {
      J.os = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (window.renderKanban)    renderKanban();
      if (window.renderDashboard) renderDashboard();
      if (window.calcComissoes)   calcComissoes();
    });
}

function _escutarClientes() {
  J.db.collection('clientes')
    .where('tenantId', '==', J.tid)
    .onSnapshot(snap => {
      J.clientes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (window.renderClientes) renderClientes();
      popularSelects();
    });
}

function _escutarVeiculos() {
  J.db.collection('veiculos')
    .where('tenantId', '==', J.tid)
    .onSnapshot(snap => {
      J.veiculos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (window.renderVeiculos) renderVeiculos();
      popularSelects();
    });
}

function _escutarEstoque() {
  J.db.collection('estoqueItems')
    .where('tenantId', '==', J.tid)
    .onSnapshot(snap => {
      J.estoque = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (window.renderEstoque)   renderEstoque();
      if (window.renderDashboard) renderDashboard();
    });
}

function _escutarFinanceiro() {
  J.db.collection('financeiro')
    .where('tenantId', '==', J.tid)
    .onSnapshot(snap => {
      J.financeiro = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (window.renderFinanceiro) renderFinanceiro();
      if (window.renderDashboard)  renderDashboard();
    });
}

function _escutarEquipe() {
  J.db.collection('funcionarios')
    .where('tenantId', '==', J.tid)
    .onSnapshot(snap => {
      J.equipe = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (window.renderEquipe)  renderEquipe();
      if (window.calcComissoes) calcComissoes();
      popularSelects();
    });
}

function _escutarFornecedores() {
  J.db.collection('fornecedores')
    .where('tenantId', '==', J.tid)
    .onSnapshot(snap => {
      J.fornecedores = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (window.renderFornecedores) renderFornecedores();
      popularSelects();
    });
}

function _escutarMensagens() {
  J.db.collection('mensagens')
    .where('tenantId', '==', J.tid)
    .onSnapshot(snap => {
      J.mensagens = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.ts || 0) - (b.ts || 0));
      if (window.renderChatLista) renderChatLista();
      if (J.chatAtivo && window.renderChatMsgs) renderChatMsgs(J.chatAtivo);
      const unread = J.mensagens.filter(m => m.sender === 'cliente' && !m.lidaAdmin).length;
      const badge = document.getElementById('chatBadge');
      if (badge) {
        badge.textContent = unread;
        badge.classList.toggle('show', unread > 0);
      }
    });
}

function _escutarAgendamentos() {
  J.db.collection('agendamentos')
    .where('tenantId', '==', J.tid)
    .onSnapshot(snap => {
      J.agendamentos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (window.renderAgenda) renderAgenda();
    });
}

function _escutarAuditoria() {
  J.db.collection('lixeira_auditoria')
    .where('tenantId', '==', J.tid)
    .onSnapshot(snap => {
      J.auditoria = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => b.ts > a.ts ? 1 : -1);
      if (window.renderAuditoria) renderAuditoria();
    });
}

function _escutarConhecimentoIA() {
  J.db.collection('conhecimento_ia')
    .where('tenantId', '==', J.tid)
    .onSnapshot(snap => {
      J.conhecimentoIA = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (window.renderConhecimentoIA) renderConhecimentoIA();
    });
}

function _escutarChatEquipe() {
  J.db.collection('chat_equipe')
    .where('tenantId', '==', J.tid)
    .onSnapshot(snap => {
      J.chatEquipe = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.ts || 0) - (b.ts || 0));
      if (window.renderChatEquipe) renderChatEquipe();
    });
}

function _escutarComissoesEquipe() {
  if (!J.fid) return;
  J.db.collection('financeiro')
    .where('tenantId', '==', J.tid)
    .where('isComissao', '==', true)
    .where('mecId', '==', J.fid)
    .onSnapshot(snap => {
      const fins = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (window.renderComissoes) renderComissoes(fins);
    });
}

// ============================================================
// POPULAR SELECTS (usado em vários módulos)
// ============================================================
window.popularSelects = function() {
  const cOpts = '<option value="">Selecione...</option>' +
    J.clientes.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');

  ['osCliente', 'agdCliente', 'veicDono'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = cOpts;
  });

  const mOpts = '<option value="">Não atribuído</option>' +
    J.equipe.map(f => `<option value="${f.id}">${f.nome} — ${JARVIS_CONST.CARGOS[f.cargo] || f.cargo}</option>`).join('');

  ['osMec', 'agdMec'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = mOpts;
  });

  const fOpts = '<option value="">Selecione...</option>' +
    J.fornecedores.map(f => `<option value="${f.id}">${f.nome}</option>`).join('');

  ['nfFornec'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = fOpts;
  });
};

window.filtrarVeiculosOS = function() {
  const cid  = _v('osCliente');
  const tipo = _v('osTipoVeiculo');
  let veics  = J.veiculos.filter(v => v.clienteId === cid);
  if (tipo) veics = veics.filter(v => v.tipo === tipo);
  const el = document.getElementById('osVeiculo');
  if (el) el.innerHTML = '<option value="">Selecione...</option>' +
    veics.map(v => `<option value="${v.id}">${v.modelo} (${v.placa})</option>`).join('');
};

window.filtrarVeicsAgenda = function() {
  const cid  = _v('agdCliente');
  const veics = J.veiculos.filter(v => v.clienteId === cid);
  const el = document.getElementById('agdVeiculo');
  if (el) el.innerHTML = '<option value="">Selecione...</option>' +
    veics.map(v => `<option value="${v.id}">${v.modelo} (${v.placa})</option>`).join('');
};

// ============================================================
// AUDITORIA
// ============================================================
window.audit = async function(modulo, acao) {
  try {
    await J.db.collection('lixeira_auditoria').add({
      tenantId: J.tid,
      modulo,
      acao,
      usuario: J.nome,
      ts: new Date().toISOString()
    });
  } catch (e) { /* silencioso */ }
};

// ============================================================
// UTILITÁRIOS GLOBAIS
// ============================================================

// Shorthand DOM
window._$  = id  => document.getElementById(id);
window._v  = id  => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
window._sv = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };
window._st = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt ?? ''; };
window._sh = (id, htm) => { const el = document.getElementById(id); if (el) el.innerHTML = htm ?? ''; };
window._chk = id => { const el = document.getElementById(id); return el ? el.checked : false; };
window._ck  = (id, v) => { const el = document.getElementById(id); if (el) el.checked = !!v; };

// Formatação
window.moeda = v =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(v) || 0);

window.dtBr = iso => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }); }
  catch { return iso; }
};

window.dtHrBr = iso => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }); }
  catch { return iso; }
};

window.dtISO = () => new Date().toISOString();

window.slugify = str =>
  str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-');

window.randId = (n = 6) => Math.random().toString(36).slice(-n).toUpperCase();

window.sair = function() {
  sessionStorage.clear();
  window.location.href = 'index.html';
};

// WhatsApp deep link
window.abrirWpp = function(numero, msg) {
  const n = (numero || '').replace(/\D/g, '');
  const url = `https://wa.me/55${n}?text=${encodeURIComponent(msg || '')}`;
  window.open(url, '_blank');
};

// Toast notifications
window.toastOk = function(msg) {
  _showToast(msg, 'success');
};

window.toastWarn = function(msg) {
  _showToast(msg, 'warning');
};

window.toastErr = function(msg) {
  _showToast(msg, 'error');
};

function _showToast(msg, type) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Modal helpers
window.openModal = function(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('show');
};

window.closeModal = function(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('show');
};

// Loading state
window.setLoading = function(id, loading, text) {
  const el = document.getElementById(id);
  if (!el) return;
  el.disabled = loading;
  if (loading) {
    el.dataset.originalText = el.textContent;
    el.innerHTML = '<span class="spinner"></span> Processando...';
  } else {
    el.textContent = text || el.dataset.originalText || 'Salvar';
  }
};
