/**
 * JARVIS ERP V2 — os.js
 * Ordens de Serviço: CRUD, Kanban, Comissões
 */

'use strict';

// ============================================================
// RENDERIZAR KANBAN
// ============================================================
window.renderKanban = function() {
  const container = document.getElementById('kanbanContainer');
  if (!container) return;

  const colunas = {};
  JARVIS_CONST.STATUS_OS.forEach(s => {
    colunas[s.key] = [];
  });

  J.os.forEach(o => {
    if (colunas[o.status]) colunas[o.status].push(o);
  });

  container.innerHTML = JARVIS_CONST.STATUS_OS.map(status => {
    const cards = colunas[status.key] || [];
    return `
      <div class="kanban-coluna" style="border-left:4px solid ${status.cor}">
        <div class="kanban-header" style="background-color:${status.cor}20;border-bottom:2px solid ${status.cor}">
          <span class="kanban-label">${status.label}</span>
          <span class="kanban-count">${cards.length}</span>
        </div>
        <div class="kanban-cards">
          ${cards.map(o => {
            const cliente = J.clientes.find(c => c.id === o.clienteId);
            const veiculo = J.veiculos.find(v => v.id === o.veiculoId);
            const mec = J.equipe.find(e => e.id === o.mecId);
            return `
              <div class="kanban-card" onclick="abrirOS('${o.id}')">
                <div class="card-header">
                  <div class="card-placa">${veiculo?.placa || '?'}</div>
                  <div class="card-status" style="background-color:${status.cor}20;color:${status.cor}">${status.label}</div>
                </div>
                <div class="card-body">
                  <div class="card-cliente">${cliente?.nome || 'Cliente?'}</div>
                  <div class="card-desc">${o.desc || 'Sem descrição'}</div>
                  ${mec ? `<div class="card-mec">🔧 ${mec.nome}</div>` : ''}
                </div>
                <div class="card-footer">
                  <div class="card-valor">${moeda(o.total || 0)}</div>
                  <div class="card-data">${dtBr(o.data)}</div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }).join('');
};

// ============================================================
// PREPARAR FORMULÁRIO OS
// ============================================================
window.prepOS = function(id = null) {
  _sv('osId', '');
  _sv('osCliente', '');
  _sv('osTipoVeiculo', '');
  _sv('osVeiculo', '');
  _sv('osMec', '');
  _sv('osDesc', '');
  _sv('osTotal', '0');
  _sv('osData', new Date().toISOString().split('T')[0]);
  _sv('osStatus', 'Aguardando');

  if (id) {
    const o = J.os.find(x => x.id === id);
    if (!o) return;
    _sv('osId', o.id);
    _sv('osCliente', o.clienteId || '');
    _sv('osVeiculo', o.veiculoId || '');
    _sv('osMec', o.mecId || '');
    _sv('osDesc', o.desc || '');
    _sv('osTotal', o.total || 0);
    _sv('osData', o.data || '');
    _sv('osStatus', o.status || 'Aguardando');
    filtrarVeiculosOS();
  }

  openModal('modalOS');
};

// ============================================================
// SALVAR OS
// ============================================================
window.salvarOS = async function() {
  const cid = _v('osCliente');
  const vid = _v('osVeiculo');
  const desc = _v('osDesc');
  const total = parseFloat(_v('osTotal') || 0);

  if (!cid || !vid || !desc || total <= 0) {
    toastWarn('Preencha todos os campos obrigatórios');
    return;
  }

  setLoading('btnSalvarOS', true);

  try {
    const p = {
      tenantId: J.tid,
      clienteId: cid,
      veiculoId: vid,
      mecId: _v('osMec') || null,
      desc,
      total,
      status: _v('osStatus') || 'Aguardando',
      data: _v('osData') || new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString()
    };

    const id = _v('osId');
    if (id) {
      await J.db.collection('ordens_servico').doc(id).update(p);
      toastOk('O.S. atualizada com sucesso!');
      audit('OS', `Atualizou O.S. #${id.slice(0, 8)}: ${desc} — ${moeda(total)}`);
    } else {
      p.createdAt = new Date().toISOString();
      const ref = await J.db.collection('ordens_servico').add(p);
      toastOk('O.S. criada com sucesso!');
      audit('OS', `Criou O.S. #${ref.id.slice(0, 8)}: ${desc} — ${moeda(total)}`);
    }

    closeModal('modalOS');
  } catch (e) {
    toastErr('Erro ao salvar O.S.: ' + e.message);
  } finally {
    setLoading('btnSalvarOS', false, 'Salvar O.S.');
  }
};

// ============================================================
// ABRIR OS (DETALHES)
// ============================================================
window.abrirOS = function(id) {
  const o = J.os.find(x => x.id === id);
  if (!o) return;

  const cliente = J.clientes.find(c => c.id === o.clienteId);
  const veiculo = J.veiculos.find(v => v.id === o.veiculoId);
  const mec = J.equipe.find(e => e.id === o.mecId);

  const status = JARVIS_CONST.STATUS_OS.find(s => s.key === o.status);

  const html = `
    <div class="os-details">
      <div class="os-header" style="border-left:4px solid ${status?.cor || '#ccc'}">
        <div class="os-title">Ordem de Serviço #${id.slice(0, 8)}</div>
        <div class="os-status" style="background-color:${status?.cor}20;color:${status?.cor}">${status?.label}</div>
      </div>

      <div class="os-grid">
        <div class="os-field">
          <label>Cliente</label>
          <div>${cliente?.nome || '?'}</div>
          <small>${cliente?.telefone || ''}</small>
        </div>
        <div class="os-field">
          <label>Veículo</label>
          <div>${veiculo?.modelo || '?'}</div>
          <small>Placa: ${veiculo?.placa || '?'}</small>
        </div>
        <div class="os-field">
          <label>Mecânico</label>
          <div>${mec?.nome || 'Não atribuído'}</div>
          <small>${mec ? JARVIS_CONST.CARGOS[mec.cargo] || mec.cargo : ''}</small>
        </div>
        <div class="os-field">
          <label>Valor Total</label>
          <div style="font-size:1.5rem;font-weight:700;color:var(--success)">${moeda(o.total)}</div>
        </div>
      </div>

      <div class="os-field">
        <label>Descrição do Serviço</label>
        <div style="background:#f5f5f5;padding:12px;border-radius:6px;line-height:1.6">${o.desc}</div>
      </div>

      <div class="os-field">
        <label>Datas</label>
        <div>Criada: ${dtHrBr(o.createdAt)}</div>
        <div>Atualizada: ${dtHrBr(o.updatedAt)}</div>
      </div>

      <div class="os-actions">
        <button class="btn btn-primary" onclick="prepOS('${id}');openModal('modalOS')">✏ Editar</button>
        <button class="btn btn-danger" onclick="deletarOS('${id}')">🗑 Deletar</button>
        <button class="btn btn-ghost" onclick="closeModal('osDetailsModal')">Fechar</button>
      </div>
    </div>
  `;

  _sh('osDetailsContent', html);
  openModal('osDetailsModal');
};

// ============================================================
// DELETAR OS
// ============================================================
window.deletarOS = async function(id) {
  if (!confirm('Tem certeza que deseja deletar esta O.S.?')) return;

  try {
    await J.db.collection('ordens_servico').doc(id).delete();
    toastOk('O.S. deletada com sucesso!');
    closeModal('osDetailsModal');
    audit('OS', `Deletou O.S. #${id.slice(0, 8)}`);
  } catch (e) {
    toastErr('Erro ao deletar O.S.: ' + e.message);
  }
};

// ============================================================
// MUDAR STATUS OS (Kanban drag-drop simulado)
// ============================================================
window.mudarStatusOS = async function(id, novoStatus) {
  try {
    await J.db.collection('ordens_servico').doc(id).update({
      status: novoStatus,
      updatedAt: new Date().toISOString()
    });
    toastOk(`Status alterado para ${novoStatus}`);
    audit('OS', `Alterou status O.S. #${id.slice(0, 8)} → ${novoStatus}`);
  } catch (e) {
    toastErr('Erro ao atualizar status: ' + e.message);
  }
};

// ============================================================
// RENDERIZAR TABELA OS (alternativa ao Kanban)
// ============================================================
window.renderTabelaOS = function() {
  const container = document.getElementById('tabelaOSContainer');
  if (!container) return;

  const filStatus = _v('filtroOSStatus') || '';
  let base = [...J.os];
  if (filStatus) base = base.filter(o => o.status === filStatus);
  base.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const html = base.map(o => {
    const cliente = J.clientes.find(c => c.id === o.clienteId);
    const veiculo = J.veiculos.find(v => v.id === o.veiculoId);
    const mec = J.equipe.find(e => e.id === o.mecId);
    const status = JARVIS_CONST.STATUS_OS.find(s => s.key === o.status);

    return `
      <tr>
        <td style="font-family:var(--ff-mono);font-size:0.78rem">${id.slice(0, 8)}</td>
        <td>${veiculo?.placa || '?'}</td>
        <td>${cliente?.nome || '?'}</td>
        <td>${o.desc || '—'}</td>
        <td>${mec?.nome || '—'}</td>
        <td><span style="background-color:${status?.cor}20;color:${status?.cor};padding:4px 8px;border-radius:4px">${status?.label}</span></td>
        <td style="font-weight:700;color:var(--success)">${moeda(o.total)}</td>
        <td>${dtBr(o.data)}</td>
        <td style="white-space:nowrap">
          <button class="btn btn-ghost btn-sm" onclick="prepOS('${o.id}');openModal('modalOS')" title="Editar">✏</button>
          <button class="btn btn-ghost btn-sm" onclick="abrirOS('${o.id}')" title="Detalhes">👁</button>
          <button class="btn btn-danger btn-sm" onclick="deletarOS('${o.id}')" title="Deletar">🗑</button>
        </td>
      </tr>
    `;
  }).join('');

  _sh('tabelaOSBody', html || '<tr><td colspan="9" style="text-align:center;padding:20px">Nenhuma O.S. encontrada</td></tr>');
};

// ============================================================
// DASHBOARD (resumo)
// ============================================================
window.renderDashboard = function() {
  const container = document.getElementById('dashboardContainer');
  if (!container) return;

  const osAbertas = J.os.filter(o => !['Concluido', 'Cancelado'].includes(o.status)).length;
  const osHoje = J.os.filter(o => {
    const hoje = new Date().toISOString().split('T')[0];
    return o.data === hoje;
  }).length;

  const faturamentoMes = J.os
    .filter(o => o.status === 'Concluido' && o.updatedAt)
    .reduce((acc, o) => {
      const d = new Date(o.updatedAt);
      const agora = new Date();
      return (d.getMonth() === agora.getMonth() && d.getFullYear() === agora.getFullYear())
        ? acc + (o.total || 0)
        : acc;
    }, 0);

  const pecasCriticas = J.estoque.filter(p => (p.qtd || 0) <= (p.min || 0)).length;

  const html = `
    <div class="dashboard-grid">
      <div class="dashboard-card">
        <div class="card-icon">📋</div>
        <div class="card-label">O.S. Abertas</div>
        <div class="card-value">${osAbertas}</div>
      </div>
      <div class="dashboard-card">
        <div class="card-icon">📅</div>
        <div class="card-label">O.S. Hoje</div>
        <div class="card-value">${osHoje}</div>
      </div>
      <div class="dashboard-card">
        <div class="card-icon">💰</div>
        <div class="card-label">Faturamento Mês</div>
        <div class="card-value">${moeda(faturamentoMes)}</div>
      </div>
      <div class="dashboard-card">
        <div class="card-icon">⚠️</div>
        <div class="card-label">Peças Críticas</div>
        <div class="card-value">${pecasCriticas}</div>
      </div>
    </div>
  `;

  _sh('dashboardContainer', html);
};
