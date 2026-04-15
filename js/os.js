/**
 * JARVIS ERP — os.js (Repositório oficina1)
 * Motor de Ordens de Serviço, Kanban Chevron 7 Etapas, WhatsApp B2C, Laudos PDF
 * INCLUI: Separação de Comissões (Peça vs Mão de Obra) exigida na diretriz.
 */

'use strict';

// ============================================================
// 1. ESCUTA E RENDERIZAÇÃO DO KANBAN CHEVRON
// ============================================================
const KANBAN_STATUSES = ['Triagem', 'Orcamento', 'Orcamento_Enviado', 'Aprovado', 'Andamento', 'Pronto', 'Entregue'];
const STATUS_MAP_LEGACY = { 'Aguardando': 'Triagem', 'Concluido': 'Entregue' }; 

function escutarOS() {
  db.collection('ordens_servico').where('tenantId', '==', J.tid).onSnapshot(snap => {
    J.os = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderKanban(); 
    if(typeof renderDashboard === 'function') renderDashboard(); 
    if(typeof calcComissoes === 'function') calcComissoes();
  });
}

function renderKanban() {
  const busca = ($v('searchOS') || '').toLowerCase();
  const filtroNicho = $v('filtroNichoKanban');
  const cols = {}; const cnts = {};
  KANBAN_STATUSES.forEach(s => { cols[s] = []; cnts[s] = 0; });

  J.os.filter(o => o.status !== 'Cancelado').forEach(o => {
    const st = STATUS_MAP_LEGACY[o.status] || o.status; 
    const v = J.veiculos.find(x => x.id === o.veiculoId);
    const c = J.clientes.find(x => x.id === o.clienteId);
    
    if (busca && !v?.placa?.toLowerCase().includes(busca) && !c?.nome?.toLowerCase().includes(busca)) return;
    if (filtroNicho && v?.tipo !== filtroNicho) return;
    
    if (cols[st]) { cols[st].push({ os: o, v, c }); cnts[st]++; }
  });

  KANBAN_STATUSES.forEach(s => {
    const cntEl = $('cnt-' + s); if (cntEl) cntEl.innerText = cnts[s];
    const colEl = $('kb-' + s); if (!colEl) return;
    
    colEl.innerHTML = cols[s].sort((a, b) => new Date(b.os.updatedAt || 0) - new Date(a.os.updatedAt || 0)).map(({ os, v, c }) => {
      const tipoCls = v?.tipo || 'carro';
      const tipoLabel = { carro: '🚗 CARRO', moto: '🏍️ MOTO', bicicleta: '🚲 BICICLETA' }[tipoCls] || 'VEÍCULO';
      const cor = { Triagem: 'var(--muted)', Orcamento: 'var(--warn)', Orcamento_Enviado: 'var(--purple)', Aprovado: 'var(--cyan)', Andamento: '#FF8C00', Pronto: 'var(--success)', Entregue: 'var(--green2)' }[s];
      
      const idx = KANBAN_STATUSES.indexOf(s);
      const sPrev = idx > 0 ? KANBAN_STATUSES[idx - 1] : null;
      const sNext = idx < KANBAN_STATUSES.length - 1 ? KANBAN_STATUSES[idx + 1] : null;
      
      const btnPrev = sPrev ? `<button onclick="event.stopPropagation(); moverStatusOS('${os.id}', '${sPrev}')" title="Mover para ${sPrev}" style="background:transparent;border:none;color:var(--muted2);cursor:pointer;padding:4px;"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M15 18l-6-6 6-6"/></svg></button>` : '<div></div>';
      const btnNext = sNext ? `<button onclick="event.stopPropagation(); moverStatusOS('${os.id}', '${sNext}')" title="Mover para ${sNext}" style="background:transparent;border:none;color:var(--muted2);cursor:pointer;padding:4px;"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M9 18l6-6-6-6"/></svg></button>` : '<div></div>';

      return `<div class="k-card" style="border-left-color:${cor}" onclick="prepOS('edit','${os.id}');abrirModal('modalOS')">
        <div class="k-placa" style="color:${cor}">${v?.placa || 'S/PLACA'}</div>
        <div class="k-cliente">${c?.nome || 'Cliente não encontrado'}</div>
        <div class="k-desc">${os.desc || 'Sem descrição'}</div>
        <div class="k-footer">
          <span class="k-tipo ${tipoCls}">${tipoLabel}</span>
          <span style="font-family:var(--fm);font-size:0.75rem;color:var(--success);font-weight:700;">${moeda(os.total)}</span>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;border-top:1px solid rgba(255,255,255,0.05);padding-top:4px;">
          ${btnPrev}
          <span class="k-date">${dtBr(os.data)}</span>
          ${btnNext}
        </div>
      </div>`;
    }).join('');
  });
}

async function moverStatusOS(id, novoStatus) {
    await db.collection('ordens_servico').doc(id).update({ status: novoStatus, updatedAt: new Date().toISOString() });
    toast('✓ Movido para ' + novoStatus.replace('_', ' '));
    audit('KANBAN', `Moveu OS ${id.slice(-6)} para ${novoStatus}`);
    
    if (novoStatus === 'Orcamento_Enviado') {
        enviarWppB2C(id);
    }
}

// ============================================================
// 2. COMUNICAÇÃO B2C (WHATSAPP + PORTAL DO CLIENTE)
// ============================================================
function enviarWppB2C(id) {
    const os = J.os.find(x => x.id === id); if (!os) return;
    const c = J.clientes.find(x => x.id === os.clienteId);
    const v = J.veiculos.find(x => x.id === os.veiculoId);
    if (!c || !c.wpp) { toast('⚠ Cliente sem WhatsApp cadastrado', 'warn'); return; }
    
    const fone = c.wpp.replace(/\D/g, '');
    const link = window.location.origin + '/cliente.html';
    const pin = c.pin || Math.random().toString(36).slice(-6); 
    
    const msg = window.JARVIS_CONST.WPP_MSGS.orcamento(
        c.nome.split(' ')[0], v?.modelo || 'Veículo', J.tnome, 
        os.total.toFixed(2).replace('.', ','), link, pin
    );
    
    window.open(`https://wa.me/55${fone}?text=${encodeURIComponent(msg)}`, '_blank');
    toast('✓ Redirecionando WhatsApp B2C');
}

// ============================================================
// 3. FICHA TÉCNICA E PREPARAÇÃO DO MODAL
// ============================================================
let mediaOSAtual = []; 
let timelineOSAtual = [];

function prepOS(mode, id = null) {
  ['osId', 'osKm', 'osDiagnostico', 'osDescricao', 'chkObs'].forEach(f => { if ($(f)) $(f).value = ''; });
  ['chkPainel', 'chkPressao', 'chkCarroceria', 'chkDocumentos'].forEach(f => { if ($(f)) $(f).checked = false; });
  
  $('osStatus').value = 'Triagem'; 
  $('osTipoVeiculo').value = 'carro';
  $('osData').value = new Date().toISOString().split('T')[0];
  $('osTotalVal').innerText = '0,00'; 
  $('osTotalHidden').value = '0';
  $('containerServicosOS').innerHTML = ''; 
  $('containerPecasOS').innerHTML = '';
  $('osMediaGrid').innerHTML = ''; 
  $('osMediaArray').value = '[]';
  $('osTimeline').innerHTML = ''; 
  $('osTimelineData').value = '[]';
  $('osIdBadge').innerText = 'NOVA O.S.';
  $('btnGerarPDFOS').style.display = 'none'; 
  $('areaPgtoOS').style.display = 'none'; 
  $('btnEnviarWppOS').style.display = 'none';
  
  mediaOSAtual = []; 
  timelineOSAtual = [];
  if(typeof popularSelects === 'function') popularSelects();
  
  if (mode === 'add') { 
      adicionarServicoOS(); 
  }

  if (mode === 'edit' && id) {
    const os = J.os.find(x => x.id === id); if (!os) return;
    $('osId').value = os.id; 
    $('osIdBadge').innerText = 'OS #' + os.id.slice(-6).toUpperCase();
    $('osTipoVeiculo').value = os.tipoVeiculo || 'carro';
    $('osStatus').value = STATUS_MAP_LEGACY[os.status] || os.status || 'Triagem';
    $('osCliente').value = os.clienteId || '';
    
    if(typeof filtrarVeiculosOS === 'function') filtrarVeiculosOS(); 
    setTimeout(() => { $('osVeiculo').value = os.veiculoId || ''; }, 100);
    
    $('osMec').value = os.mecId || ''; 
    $('osData').value = os.data || ''; 
    $('osKm').value = os.km || '';
    $('osDescricao').value = os.desc || ''; 
    $('osDiagnostico').value = os.diagnostico || '';
    
    if (os.servicos && os.servicos.length > 0) {
        os.servicos.forEach(s => renderServicoOSRow(s));
    } else if (os.maoObra > 0) {
        renderServicoOSRow({ desc: 'Mão de Obra Geral', valor: os.maoObra });
    } else {
        adicionarServicoOS();
    }

    if (os.pecas) { os.pecas.forEach(p => renderPecaOSRow(p)); }

    $('chkComb').value = os.chkComb || 'N/A'; 
    $('chkPneuDia').value = os.chkPneuDia || ''; 
    $('chkPneuTra').value = os.chkPneuTra || ''; 
    $('chkObs').value = os.chkObs || '';
    
    if (os.chkPainel) $('chkPainel').checked = true; 
    if (os.chkPressao) $('chkPressao').checked = true;
    if (os.chkCarroceria) $('chkCarroceria').checked = true; 
    if (os.chkDocumentos) $('chkDocumentos').checked = true;
    
    mediaOSAtual = os.media || []; renderMediaOS();
    timelineOSAtual = os.timeline || []; renderTimelineOS();
    
    calcOS(); 
    verificarStatusOS();
    $('btnGerarPDFOS').style.display = 'block';
  }
}

// ============================================================
// 4. MÚLTIPLOS SERVIÇOS E PEÇAS
// ============================================================
function adicionarServicoOS() {
  const sel = document.createElement('div');
  sel.style.cssText = 'display:grid;grid-template-columns:1fr 100px 32px;gap:8px;align-items:center;margin-bottom:8px;';
  sel.innerHTML = `
    <input type="text" class="j-input serv-desc" placeholder="Ex: Alinhamento, Troca de Freio..." oninput="calcOS()">
    <input type="number" class="j-input serv-valor" value="0" step="0.01" placeholder="R$ 0,00" oninput="calcOS()">
    <button type="button" onclick="this.parentElement.remove();calcOS()" style="background:rgba(255,59,59,0.1);border:1px solid rgba(255,59,59,0.3);border-radius:2px;color:var(--danger);cursor:pointer;width:32px;height:32px;">✕</button>
  `;
  $('containerServicosOS').appendChild(sel);
}

function renderServicoOSRow(s) {
  const div = document.createElement('div');
  div.style.cssText = 'display:grid;grid-template-columns:1fr 100px 32px;gap:8px;align-items:center;margin-bottom:8px;';
  div.innerHTML = `
    <input type="text" class="j-input serv-desc" value="${s.desc || ''}" placeholder="Descrição do Serviço" oninput="calcOS()">
    <input type="number" class="j-input serv-valor" value="${s.valor || 0}" step="0.01" placeholder="R$ 0,00" oninput="calcOS()">
    <button type="button" onclick="this.parentElement.remove();calcOS()" style="background:rgba(255,59,59,0.1);border:1px solid rgba(255,59,59,0.3);border-radius:2px;color:var(--danger);cursor:pointer;width:32px;height:32px;">✕</button>
  `;
  $('containerServicosOS').appendChild(div);
}

function adicionarPecaOS() {
  const sel = document.createElement('div');
  sel.style.cssText = 'display:grid;grid-template-columns:1fr 80px 90px 90px 32px;gap:8px;align-items:center;';
  const opts = '<option value="">Selecionar peça...</option>' + J.estoque.filter(p => (p.qtd || 0) > 0).map(p => `<option value="${p.id}" data-venda="${p.venda || 0}" data-desc="${p.desc || ''}">[${p.qtd}un] ${p.desc} — ${moeda(p.venda)}</option>`).join('');
  sel.innerHTML = `
    <select class="j-select peca-sel" onchange="selecionarPecaOS(this)">${opts}</select>
    <input type="number" class="j-input peca-qtd" value="1" min="1" placeholder="Qtd" oninput="calcOS()">
    <input type="number" class="j-input peca-custo" value="0" step="0.01" placeholder="Custo" oninput="calcOS()">
    <input type="number" class="j-input peca-venda" value="0" step="0.01" placeholder="Venda" oninput="calcOS()">
    <button type="button" onclick="this.parentElement.remove();calcOS()" style="background:rgba(255,59,59,0.1);border:1px solid rgba(255,59,59,0.3);border-radius:2px;color:var(--danger);cursor:pointer;width:32px;height:32px;">✕</button>
  `;
  $('containerPecasOS').appendChild(sel); calcOS();
}

function renderPecaOSRow(p) {
  const div = document.createElement('div');
  div.style.cssText = 'display:grid;grid-template-columns:1fr 80px 90px 90px 32px;gap:8px;align-items:center;';
  const opts = '<option value="">' + p.desc + '</option>' + J.estoque.filter(x => (x.qtd || 0) > 0 || x.id === p.estoqueId).map(x => `<option value="${x.id}" data-venda="${x.venda || 0}" data-desc="${x.desc || ''}" ${x.id === p.estoqueId ? 'selected' : ''}>[${x.qtd}un] ${x.desc}</option>`).join('');
  div.innerHTML = `
    <select class="j-select peca-sel" onchange="selecionarPecaOS(this)">${opts}</select>
    <input type="number" class="j-input peca-qtd" value="${p.qtd || 1}" min="1" oninput="calcOS()">
    <input type="number" class="j-input peca-custo" value="${p.custo || 0}" step="0.01" oninput="calcOS()">
    <input type="number" class="j-input peca-venda" value="${p.venda || 0}" step="0.01" oninput="calcOS()">
    <button type="button" onclick="this.parentElement.remove();calcOS()" style="background:rgba(255,59,59,0.1);border:1px solid rgba(255,59,59,0.3);border-radius:2px;color:var(--danger);cursor:pointer;width:32px;height:32px;">✕</button>
  `;
  $('containerPecasOS').appendChild(div);
}

function selecionarPecaOS(sel) {
  const opt = sel.options[sel.selectedIndex];
  sel.parentElement.querySelector('.peca-venda').value = opt.dataset.venda || 0;
  calcOS();
}

function calcOS() {
  let total = 0;
  
  document.querySelectorAll('#containerServicosOS > div').forEach(row => {
    total += parseFloat(row.querySelector('.serv-valor')?.value || 0);
  });
  
  document.querySelectorAll('#containerPecasOS > div').forEach(row => {
    const qtd = parseFloat(row.querySelector('.peca-qtd')?.value || 0);
    const venda = parseFloat(row.querySelector('.peca-venda')?.value || 0);
    total += qtd * venda;
  });
  
  $('osTotalVal').innerText = total.toFixed(2).replace('.', ',');
  $('osTotalHidden').value = total;
}

function verificarStatusOS() {
  const s = $v('osStatus');
  $('areaPgtoOS').style.display = (s === 'Pronto' || s === 'Entregue') ? 'block' : 'none';
  $('btnEnviarWppOS').style.display = (s === 'Orcamento_Enviado' && $v('osId')) ? 'flex' : 'none';
}

function checkPgtoOS() {
  const f = $v('osPgtoForma');
  $('divParcelasOS').style.display = (f === 'Crédito Parcelado' || f === 'Boleto') ? 'block' : 'none';
}

// ============================================================
// 5. SALVAR O.S. E CÁLCULO DE COMISSÃO SEPARADA
// ============================================================
async function salvarOS() {
  const osId = $v('osId');
  if (!$v('osCliente') || !$v('osVeiculo')) { toast('⚠ Selecione cliente e veículo', 'warn'); return; }

  const servicos = []; 
  let totalMaoObra = 0;
  document.querySelectorAll('#containerServicosOS > div').forEach(row => {
    const desc = row.querySelector('.serv-desc')?.value || '';
    const valor = parseFloat(row.querySelector('.serv-valor')?.value || 0);
    if (desc || valor > 0) { servicos.push({ desc, valor }); totalMaoObra += valor; }
  });

  const pecas = [];
  let totalPecas = 0;
  document.querySelectorAll('#containerPecasOS > div').forEach(row => {
    const sel = row.querySelector('.peca-sel'); 
    const opt = sel?.options[sel.selectedIndex];
    const qtd = parseFloat(row.querySelector('.peca-qtd')?.value || 1);
    const venda = parseFloat(row.querySelector('.peca-venda')?.value || 0);
    const custo = parseFloat(row.querySelector('.peca-custo')?.value || 0);
    totalPecas += (qtd * venda);
    
    pecas.push({
      estoqueId: sel?.value, 
      desc: opt?.dataset.desc || opt?.text || '',
      qtd: qtd, custo: custo, venda: venda
    });
  });

  const tl = JSON.parse($('osTimelineData').value || '[]');
  tl.push({ dt: new Date().toISOString(), user: J.nome, acao: `${osId ? 'Editou' : 'Abriu'} O.S. — Status: ${$v('osStatus')}` });

  const payload = {
    tenantId: J.tid, 
    tipoVeiculo: $v('osTipoVeiculo'),
    clienteId: $v('osCliente'), 
    veiculoId: $v('osVeiculo'), 
    mecId: $v('osMec'),
    data: $v('osData'), 
    km: $v('osKm'), 
    desc: $v('osDescricao'), 
    diagnostico: $v('osDiagnostico'),
    status: $v('osStatus'), 
    maoObra: totalMaoObra, 
    servicos, 
    pecas,
    total: parseFloat($v('osTotalHidden') || 0),
    media: JSON.parse($('osMediaArray').value || '[]'),
    chkComb: $v('chkComb'), 
    chkPneuDia: $v('chkPneuDia'), 
    chkPneuTra: $v('chkPneuTra'),
    chkObs: $v('chkObs'), 
    chkPainel: $('chkPainel')?.checked,
    chkPressao: $('chkPressao')?.checked, 
    chkCarroceria: $('chkCarroceria')?.checked,
    chkDocumentos: $('chkDocumentos')?.checked,
    timeline: tl, 
    updatedAt: new Date().toISOString()
  };

  // Financeiro & Comissões (só quando Pronto ou Entregue)
  if (($v('osStatus') === 'Pronto' || $v('osStatus') === 'Entregue') && $v('osPgtoForma')) {
    const formasPagas = ['Dinheiro', 'PIX', 'Débito', 'Crédito à Vista'];
    payload.pgtoForma = $v('osPgtoForma'); 
    payload.pgtoData = $v('osPgtoData');
    
    const statusFin = formasPagas.includes(payload.pgtoForma) ? 'Pago' : 'Pendente';
    const parcelas = parseInt($v('osPgtoParcelas') || 1);
    const valorParc = payload.total / parcelas;
    const batch = db.batch();
    
    // Gera Títulos no Caixa
    for (let i = 0; i < parcelas; i++) {
      const d = new Date(payload.pgtoData || new Date()); 
      d.setMonth(d.getMonth() + i);
      batch.set(db.collection('financeiro').doc(), {
        tenantId: J.tid, tipo: 'Entrada', status: statusFin,
        desc: `O.S. ${J.veiculos.find(v => v.id === payload.veiculoId)?.placa || ''} — ${J.clientes.find(c => c.id === payload.clienteId)?.nome || ''} ${parcelas > 1 ? `(${i + 1}/${parcelas})` : ''}`,
        valor: valorParc, pgto: payload.pgtoForma, venc: d.toISOString().split('T')[0],
        createdAt: new Date().toISOString()
      });
    }
    
    // Baixa Estoque Real
    for (const p of pecas) {
      if (p.estoqueId) {
        const item = J.estoque.find(x => x.id === p.estoqueId);
        if (item) batch.update(db.collection('estoqueItems').doc(p.estoqueId), { qtd: Math.max(0, (item.qtd || 0) - p.qtd) });
      }
    }
    
    // ==============================================================
    // LÓGICA DE COMISSÃO EXIGIDA: Mão de Obra vs Peças
    // ==============================================================
    if (payload.mecId) {
      const mec = J.equipe.find(f => f.id === payload.mecId);
      if (mec) {
        // Busca porcentagens do funcionário (se não tiver, usa 0)
        const percServico = parseFloat(mec.comissaoServico || mec.comissao || 0);
        const percPeca = parseFloat(mec.comissaoPeca || 0);
        
        const valComServico = totalMaoObra * (percServico / 100);
        const valComPeca = totalPecas * (percPeca / 100);
        const valComTotal = valComServico + valComPeca;

        if (valComTotal > 0) {
          batch.set(db.collection('financeiro').doc(), {
            tenantId: J.tid, tipo: 'Saída', status: 'Pendente',
            desc: `Comissão (Serv: ${moeda(valComServico)} | Peça: ${moeda(valComPeca)}) — O.S. ${J.veiculos.find(v => v.id === payload.veiculoId)?.placa || ''}`,
            valor: valComTotal, pgto: 'A Combinar', venc: payload.pgtoData || new Date().toISOString().split('T')[0],
            createdAt: new Date().toISOString(), isComissao: true, mecId: payload.mecId
          });
        }
      }
    }
    
    await batch.commit();
  }

  if ($v('osProxRev') || $v('osProxKm')) {
    await db.collection('agendamentos').add({
      tenantId: J.tid, clienteId: payload.clienteId, veiculoId: payload.veiculoId,
      data: $v('osProxRev'), km: $v('osProxKm'), servico: 'Revisão Programada', status: 'Agendado',
      createdAt: new Date().toISOString()
    });
  }

  if (osId) {
    await db.collection('ordens_servico').doc(osId).update(payload);
    toast('✓ O.S. ATUALIZADA'); audit('OS', 'Editou O.S. ' + osId.slice(-6));
  } else {
    payload.createdAt = new Date().toISOString();
    const ref = await db.collection('ordens_servico').add(payload);
    toast('✓ O.S. CRIADA — ' + ref.id.slice(-6).toUpperCase());
    audit('OS', 'Criou nova O.S. para ' + J.clientes.find(c => c.id === payload.clienteId)?.nome);
  }
  
  if(typeof fecharModal === 'function') fecharModal('modalOS');
}

// ============================================================
// 6. UPLOADS (CLOUDINARY) E TIMELINE
// ============================================================
async function uploadOsMedia() {
  const f = $('osFileInput')?.files[0]; if (!f) return;
  const btn = $('btnUploadMedia'); btn.innerText = 'ENVIANDO...'; btn.disabled = true;
  try {
    const fd = new FormData(); fd.append('file', f); fd.append('upload_preset', J.cloudPreset);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${J.cloudName}/auto/upload`, { method: 'POST', body: fd });
    const data = await res.json();
    if (data.secure_url) {
      const media = JSON.parse($('osMediaArray').value || '[]');
      media.push({ url: data.secure_url, type: data.resource_type });
      $('osMediaArray').value = JSON.stringify(media); renderMediaOS(); toast('✓ UPLOAD CONCLUÍDO');
    }
  } catch (e) { toast('✕ ERRO UPLOAD', 'err'); }
  btn.innerText = 'UPLOAD'; btn.disabled = false;
}

function renderMediaOS() {
  const media = JSON.parse($('osMediaArray')?.value || '[]');
  $('osMediaGrid').innerHTML = media.map((m, i) => `
    <div class="media-item">
      ${m.type === 'video' ? `<video src="${m.url}" controls></video>` : `<img src="${m.url}" onclick="window.open('${m.url}')" style="cursor:zoom-in">`}
      <button class="media-del" onclick="removerMediaOS(${i})">✕</button>
    </div>`).join('');
}

function removerMediaOS(idx) {
  const media = JSON.parse($('osMediaArray').value || '[]');
  media.splice(idx, 1); $('osMediaArray').value = JSON.stringify(media); renderMediaOS();
}

function renderTimelineOS() {
  const tl = JSON.parse($('osTimelineData')?.value || '[]');
  $('osTimeline').innerHTML = [...tl].reverse().map(e => `<div class="tl-item"><div class="tl-date">${dtHrBr(e.dt)}</div><div class="tl-user">${e.user}</div><div class="tl-action">${e.acao}</div></div>`).join('');
}

// ============================================================
// 7. GERAÇÃO DE PDF (LAUDO)
// ============================================================
async function gerarPDFOS() {
  if (typeof window.jspdf === 'undefined') { toast('⚠ jsPDF não carregado', 'err'); return; }
  const { jsPDF } = window.jspdf; const doc = new jsPDF('p', 'mm', 'a4');
  const pw = doc.internal.pageSize.getWidth(); let y = 15;
  
  doc.setFillColor(6, 10, 20); doc.rect(0, 0, pw, 35, 'F');
  doc.setTextColor(0, 212, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(22);
  doc.text('J.A.R.V.I.S — LAUDO TÉCNICO', pw / 2, 18, { align: 'center' });
  doc.setFontSize(9); doc.setTextColor(200, 200, 200);
  doc.text(J.tnome + ' · ' + new Date().toLocaleDateString('pt-BR'), pw / 2, 27, { align: 'center' });
  y = 45;

  doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
  doc.text('DADOS DO VEÍCULO E CLIENTE', 15, y); doc.line(15, y + 2, pw - 15, y + 2); y += 10;
  
  const v = J.veiculos.find(x => x.id === $v('osVeiculo'));
  const c = J.clientes.find(x => x.id === $v('osCliente'));
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  doc.text(`Cliente: ${c?.nome || '-'}  |  WhatsApp: ${c?.wpp || '-'}`, 15, y); y += 7;
  doc.text(`Veículo: ${v?.modelo || '-'}  |  Placa: ${v?.placa || '-'}  |  KM: ${$v('osKm') || '-'}  |  Ano: ${v?.ano || '-'}`, 15, y); y += 12;
  
  doc.setFont('helvetica', 'bold'); doc.text('DEFEITO RECLAMADO / SERVIÇO', 15, y); doc.line(15, y + 2, pw - 15, y + 2); y += 10;
  doc.setFont('helvetica', 'normal');
  const descLines = doc.splitTextToSize($v('osDescricao') || '-', pw - 30);
  doc.text(descLines, 15, y); y += descLines.length * 6 + 10;
  
  const relRows = [];
  document.querySelectorAll('#containerServicosOS > div').forEach(row => {
    const desc = row.querySelector('.serv-desc')?.value || 'Serviço';
    const val = row.querySelector('.serv-valor')?.value || 0;
    if (desc || val > 0) relRows.push([desc, '1 (Srv)', 'R$ ' + parseFloat(val).toFixed(2), 'R$ ' + parseFloat(val).toFixed(2)]);
  });
  
  document.querySelectorAll('#containerPecasOS > div').forEach(row => {
    const sel = row.querySelector('.peca-sel'); const opt = sel?.options[sel?.selectedIndex];
    const qtd = row.querySelector('.peca-qtd')?.value || 0;
    const val = row.querySelector('.peca-venda')?.value || 0;
    relRows.push([opt?.dataset.desc || opt?.text || '-', qtd, 'R$ ' + parseFloat(val).toFixed(2), 'R$ ' + (parseFloat(qtd) * parseFloat(val)).toFixed(2)]);
  });
  
  if (relRows.length) {
    doc.setFont('helvetica', 'bold'); doc.text('ORÇAMENTO DETALHADO', 15, y); doc.line(15, y + 2, pw - 15, y + 2); y += 8;
    doc.autoTable({ startY: y, head: [['Descrição', 'Qtd', 'Valor Unit.', 'Subtotal']], body: relRows, theme: 'grid', headStyles: { fillColor: [6, 10, 20], textColor: [0, 212, 255] }, margin: { left: 15, right: 15 } });
    y = doc.lastAutoTable.finalY + 10;
  }
  
  doc.setFillColor(230, 250, 230); doc.rect(pw - 80, y, 65, 16, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(0, 100, 0);
  doc.text('TOTAL: R$ ' + $v('osTotalHidden'), pw - 15, y + 10, { align: 'right' });
  
  doc.save(`Laudo_${v?.placa || 'OS'}_${new Date().getTime()}.pdf`);
  toast('✓ PDF GERADO');
}
