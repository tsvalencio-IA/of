/**
 * JARVIS ERP — core.js
 * Núcleo do Sistema: Inicialização, Listeners do Realtime/Firestore,
 * Controle de Autenticação de Sessão e Cache Local.
 * BUG DE COMPOUND INDEX CORRIGIDO (Filtros locais para contornar pre-conditions).
 */
'use strict';

window.J = window.J || {};
window.J.db = window.initFirebase(); // Garante o banco de dados via config.js

// Arrays globais de estado da aplicação (Fonte da Verdade Local)
J.clientes = []; J.veiculos = []; J.os = []; J.estoque = [];
J.fornecedores = []; J.equipe = []; J.financeiro = []; 
J.mensagens = []; J.chatEquipe = [];

let _loaders = 0;
function _checkLoader(required) {
  _loaders++;
  if (_loaders >= required) {
    const L = document.getElementById('page-loader');
    if (L) { L.classList.add('fade-out'); setTimeout(()=>L.remove(), 450); }
    _atualizarTodasAsTelas();
  }
}

function _atualizarTodasAsTelas() {
  if (window.renderDashboard) window.renderDashboard();
  if (window.renderKanban) window.renderKanban();
  if (window.renderClientes) window.renderClientes();
  if (window.renderVeiculos) window.renderVeiculos();
  if (window.renderEstoque) window.renderEstoque();
  if (window.renderFornecedores) window.renderFornecedores();
  if (window.renderFinanceiro) window.renderFinanceiro();
  if (window.renderEquipe) window.renderEquipe();
  if (window.renderChatLista) window.renderChatLista();
  if (window.renderChatEquipe) window.renderChatEquipe();
  if (window.atualizarPainelAtencao) window.atualizarPainelAtencao();
}

window.sair = function() {
  sessionStorage.clear();
  window.location.href = 'index.html';
};

window.audit = function(modulo, acao) {
  if(!J.tid) return;
  J.db.collection('auditoria').add({
    tenantId: J.tid, modulo: modulo.toUpperCase(),
    acao, user: J.nome, role: J.role, ts: new Date().toISOString()
  }).catch(()=>{}); // Fogo e esquecimento
};

window.notificarEquipe = function(msg) {
  // Broadcaster simplificado de avisos vitais da Oficina para equipe
  if(!J.tid || !msg) return;
  J.db.collection('chat_equipe').add({
    tenantId: J.tid, de: 'SISTEMA', para: 'TODOS',
    sender: 'admin', msg: `🔔 AVISO: ${msg}`,
    lidaAdmin: true, lidaEquipe: false, ts: Date.now()
  }).catch(()=>{}); 
};

// ── INICIALIZAÇÃO ADMIN / GESTOR (jarvis.html) ─────────────
window.initCore = async function() {
  const tid = sessionStorage.getItem('j_tid');
  const fid = sessionStorage.getItem('j_fid') || 'admin';
  const role = sessionStorage.getItem('j_role');
  
  if (!tid) return window.sair();

  J.tid = tid; J.fid = fid; J.role = role;
  J.nome = sessionStorage.getItem('j_nome');
  J.tnome = sessionStorage.getItem('j_tnome');

  const navUserNome = document.getElementById('sbUserNome'); if(navUserNome) navUserNome.textContent = J.nome;
  const navUserRole = document.getElementById('sbUserRole'); if(navUserRole) navUserRole.textContent = J.role.toUpperCase();
  const navAvatar = document.getElementById('sbAvatar'); if(navAvatar) navAvatar.textContent = J.nome.charAt(0).toUpperCase();
  const navTenant = document.getElementById('sbTenantNome'); if(navTenant) navTenant.textContent = J.tnome;

  try {
    // 0. Puxa Configs de Oficina (Cloudinary e Chaves)
    J.db.collection('oficinas').doc(tid).onSnapshot(s => {
      const d = s.data(); if(!d) return;
      J.cloudName = d.cloudName || 'ds7lwl4o1'; 
      J.cloudPreset = d.cloudPreset || 'ml_default';
      J.gemini = d.geminiKey || '';
      J.nicho = d.nicho || 'auto';
      const root = document.documentElement;
      if (d.brandColor) { root.style.setProperty('--brand', d.brandColor); root.style.setProperty('--brand-dim', 'rgba(59,130,246,.12)'); }
      document.querySelectorAll('.brand-name').forEach(el => el.textContent = d.brandName || d.nomeFantasia || 'JARVIS ERP');
      
      const badgeNicho = document.getElementById('tbNicho');
      if (badgeNicho) {
        if (J.nicho==='moto') badgeNicho.innerHTML = '🏍️ MOTOS E CILINDRADAS';
        else if (J.nicho==='bike') badgeNicho.innerHTML = '🚲 BIKES E E-BIKES';
        else badgeNicho.innerHTML = '🚗 CARROS E PICKUPS';
      }
      _checkLoader(9);
    });

    // 1. Clientes
    J.db.collection('clientes').where('tenantId','==',tid).onSnapshot(snap => {
      J.clientes = snap.docs.map(d=>({id:d.id, ...d.data()})).sort((a,b)=>a.nome.localeCompare(b.nome));
      if(window.renderClientes) window.renderClientes();
      if(window.renderChatLista) window.renderChatLista();
      if(window.atualizarPainelAtencao) window.atualizarPainelAtencao();
      _checkLoader(9);
    });

    // 2. Veiculos
    J.db.collection('veiculos').where('tenantId','==',tid).onSnapshot(snap => {
      J.veiculos = snap.docs.map(d=>({id:d.id, ...d.data()}));
      if(window.renderVeiculos) window.renderVeiculos();
      if(window.renderKanban) window.renderKanban();
      _checkLoader(9);
    });

    // 3. Ordem de Servico (O.S.)
    J.db.collection('ordens_servico').where('tenantId','==',tid).onSnapshot(snap => {
      J.os = snap.docs.map(d=>({id:d.id, ...d.data()}));
      if(window.renderKanban) window.renderKanban();
      if(window.renderDashboard) window.renderDashboard();
      _checkLoader(9);
    });

    // 4. Estoque
    J.db.collection('estoqueItems').where('tenantId','==',tid).onSnapshot(snap => {
      J.estoque = snap.docs.map(d=>({id:d.id, ...d.data()})).sort((a,b)=>a.desc.localeCompare(b.desc));
      if(window.renderEstoque) window.renderEstoque();
      if(window.renderDashboard) window.renderDashboard();
      _checkLoader(9);
    });

    // 5. Fornecedores
    J.db.collection('fornecedores').where('tenantId','==',tid).onSnapshot(snap => {
      J.fornecedores = snap.docs.map(d=>({id:d.id, ...d.data()}));
      if(window.renderFornecedores) window.renderFornecedores();
      _checkLoader(9);
    });

    // 6. Equipe (RH)
    J.db.collection('equipe').where('tenantId','==',tid).onSnapshot(snap => {
      J.equipe = snap.docs.map(d=>({id:d.id, ...d.data()}));
      if(window.renderEquipe) window.renderEquipe();
      if(window.renderChatLista) window.renderChatLista();
      _checkLoader(9);
    });

    // 7. Financeiro
    J.db.collection('financeiro').where('tenantId','==',tid).onSnapshot(snap => {
      J.financeiro = snap.docs.map(d=>({id:d.id, ...d.data()}));
      if(window.renderFinanceiro) window.renderFinanceiro(); 
      if(window.renderEquipe) window.renderEquipe(); // Box de comissões
      _checkLoader(9);
    });

    // 8. Mensagens Chat (CRM e Equipe)
    J.db.collection('mensagens').where('tenantId','==',tid).onSnapshot(snap => {
      J.mensagens = snap.docs.map(d=>({id:d.id, ...d.data()})).sort((a,b)=>(a.ts||0)-(b.ts||0));
      if(window.renderChatLista) window.renderChatLista();
      if(J.chatAtivo && !J.chatAtivo.startsWith('EQ_') && window.renderChatMsgs) window.renderChatMsgs(J.chatAtivo);
      
      const naoLidas = J.mensagens.filter(m=>m.sender==='cliente'&&!m.lidaAdmin).length;
      const bdg = document.getElementById('chatBadge'); if(bdg) { bdg.textContent=naoLidas; bdg.classList.toggle('show', naoLidas>0); }
      _checkLoader(9);
    });

    J.db.collection('chat_equipe').where('tenantId','==',tid).onSnapshot(snap => {
      J.chatEquipe = snap.docs.map(d=>({id:d.id, ...d.data()})).sort((a,b)=>(a.ts||0)-(b.ts||0));
      if(window.renderChatLista) window.renderChatLista();
      if(J.chatAtivo && J.chatAtivo.startsWith('EQ_') && window.renderChatMsgsEquipeAdmin) window.renderChatMsgsEquipeAdmin(J.chatAtivo.replace('EQ_', ''));
    });

  } catch(e) {
    console.error("Critical Admin Init Error:", e);
    window.toastErr && toastErr("Falha de conexão com a infraestrutura principal.");
  }
};


// ── INICIALIZAÇÃO EQUIPE / MECÂNICO (equipe.html) ──────────
window.initCoreEquipe = async function() {
  const tid = sessionStorage.getItem('j_tid');
  const fid = sessionStorage.getItem('j_fid'); 
  const role = sessionStorage.getItem('j_role');
  
  if (!tid || !fid) return window.sair();

  J.tid = tid; J.fid = fid; J.role = role || 'mecanico';
  J.nome = sessionStorage.getItem('j_nome');
  J.tnome = sessionStorage.getItem('j_tnome');

  try {
    // Configs globais
    J.db.collection('oficinas').doc(tid).onSnapshot(s => {
      const d = s.data(); if(d) {
        J.cloudName = d.cloudName || 'ds7lwl4o1'; J.cloudPreset = d.cloudPreset || 'ml_default';
        const root = document.documentElement; if(d.brandColor) { root.style.setProperty('--brand', d.brandColor); root.style.setProperty('--brand-dim', 'rgba(59,130,246,.12)'); }
        document.querySelectorAll('.brand-name').forEach(el => el.textContent = d.brandName || d.nomeFantasia || 'JARVIS');
      }
      _checkLoader(6);
    });

    // Ordem de Serviço (Apenas o que precisa do Kanban local)
    J.db.collection('ordens_servico').where('tenantId','==',tid).onSnapshot(snap => {
      J.os = snap.docs.map(d=>({id:d.id, ...d.data()}));
      if(window.renderKanban) window.renderKanban();
      _checkLoader(6);
    });

    // Veiculos 
    J.db.collection('veiculos').where('tenantId','==',tid).onSnapshot(snap => {
      J.veiculos = snap.docs.map(d=>({id:d.id, ...d.data()}));
      if(window.renderKanban) window.renderKanban();
      _checkLoader(6);
    });

    // Clientes
    J.db.collection('clientes').where('tenantId','==',tid).onSnapshot(snap => {
      J.clientes = snap.docs.map(d=>({id:d.id, ...d.data()}));
      if(window.renderKanban) window.renderKanban();
      _checkLoader(6);
    });

    // Chat Equipe 
    J.db.collection('chat_equipe').where('tenantId','==',tid).onSnapshot(snap => {
      J.chatEquipe = snap.docs.map(d=>({id:d.id, ...d.data()})).filter(m => m.de === fid || m.para === fid || m.para === 'TODOS').sort((a,b)=>(a.ts||0)-(b.ts||0));
      if(window.renderChatEquipe) window.renderChatEquipe();
      
      const naoLidas = J.chatEquipe.filter(m=>m.sender==='admin'&&!m.lidaEquipe&&m.para===fid).length;
      const bdg = document.getElementById('chatTabBadge'); if(bdg) { bdg.textContent=naoLidas; bdg.classList.toggle('show', naoLidas>0); }
      _checkLoader(6);
    });

    // Financeiro — Resolve o Bug 2 de Indice exigido [failed-precondition]
    // Baixamos TUDO deste Tenant, e cortamos o slice em RAM usando Filter Nativo evitando a restrição de Compound Indexes.
    J.db.collection('financeiro').where('tenantId','==',tid).onSnapshot(snap => {
      J.financeiro = snap.docs.map(d=>({id:d.id, ...d.data()}));
      const minhasComissoes = J.financeiro.filter(f => f.isComissao === true && (f.mecId === fid || f.vinculo === `E_${fid}`));
      if(window.renderComissoes) window.renderComissoes(minhasComissoes);
      _checkLoader(6);
    });

  } catch(e) {
    console.error("Critical Team Init Error:", e);
    window.sair();
  }
};
