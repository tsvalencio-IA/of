/**
 * JARVIS ERP — dashboard.js
 * Painel Principal: KPIs Financeiros, Pátio, Estoque e Tabelas Resumo.
 */
'use strict';

window.renderDashboard = function() {
  // 1. Faturamento Mês (DRE: O.S. Prontas ou Entregues)
  const kFat = document.getElementById('kFat');
  if (kFat) {
    const mesAtual = new Date().toISOString().slice(0,7);
    let fat = 0;
    J.os.forEach(o => {
      const st = window.STATUS_LEGADO ? window.STATUS_LEGADO[o.status] || o.status : o.status;
      if ((st === 'Pronto' || st === 'Entregue') && (o.updatedAt||o.createdAt||o.data||'').startsWith(mesAtual)) {
        fat += parseFloat(o.total||0);
      }
    });
    kFat.innerText = window.moeda ? moeda(fat) : `R$ ${fat.toFixed(2)}`;
  }

  // 2. No Pátio Agora (Ativas na Oficina)
  const kPatio = document.getElementById('kPatio');
  if (kPatio) {
    let patio = 0;
    J.os.forEach(o => {
      const st = window.STATUS_LEGADO ? window.STATUS_LEGADO[o.status] || o.status : o.status;
      if (st !== 'Pronto' && st !== 'Entregue' && st !== 'Cancelado') patio++;
    });
    kPatio.innerText = patio;
  }

  // 3. Estoque Crítico
  let criticalItems = [];
  if (J.estoque) criticalItems = J.estoque.filter(x => (x.qtd||0) <= (x.min||0));
  const kStock = document.getElementById('kStock');
  if (kStock) kStock.innerText = criticalItems.length;

  // 4. Inadimplência / Títulos Vencidos
  const kVenc = document.getElementById('kVenc');
  if (kVenc && J.financeiro) {
    const hoje = new Date().toISOString().split('T')[0];
    const vencidos = J.financeiro.filter(f => f.tipo === 'Saída' && (f.status === 'Pendente' || f.status === 'Aguardando') && (f.venc||f.data) < hoje);
    kVenc.innerText = vencidos.length;
  }

  // ── Tabelas do Dashboard ──

  // Últimas 5 O.S. Recebidas
  const tbOs = document.getElementById('dashRecentOS');
  if (tbOs) {
    const recents = [...J.os].sort((a,b) => new Date(b.createdAt||b.data||0) - new Date(a.createdAt||a.data||0)).slice(0,5);
    if (!recents.length) {
      tbOs.innerHTML = '<tr><td colspan="4" class="table-empty">Nenhuma O.S. ativa no momento</td></tr>';
    } else {
      tbOs.innerHTML = recents.map(o => {
        const v = J.veiculos.find(x => x.id === o.veiculoId);
        const c = J.clientes.find(x => x.id === o.clienteId);
        const st = window.STATUS_LEGADO ? window.STATUS_LEGADO[o.status] || o.status : o.status;
        
        let badgeCls = 'badge-neutral';
        if(['Pronto','Entregue'].includes(st)) badgeCls = 'badge-success';
        if(['Andamento'].includes(st)) badgeCls = 'badge-warn';
        if(['Orcamento','Orcamento_Enviado'].includes(st)) badgeCls = 'badge-brand';
        
        return `<tr>
          <td class="font-mono">${o.placa||v?.placa||'S/PLACA'}</td>
          <td>${c?.nome?.split(' ')[0]||o.cliente||'—'}</td>
          <td><span class="badge ${badgeCls}">${st}</span></td>
          <td class="font-mono" style="font-weight:700">${window.moeda ? moeda(o.total||0) : o.total}</td>
        </tr>`;
      }).join('');
    }
  }

  // Alertas de Peças
  const tbAlert = document.getElementById('dashAlertStock');
  if (tbAlert) {
    if (!criticalItems.length) {
      tbAlert.innerHTML = '<tr><td colspan="4" class="table-empty" style="color:var(--success)">Estoque saudável</td></tr>';
    } else {
      tbAlert.innerHTML = criticalItems.slice(0,5).map(p => {
        const isZero = (p.qtd||0) <= 0;
        return `<tr>
          <td><div style="font-family:var(--fd);font-weight:700">${p.desc}</div></td>
          <td class="font-mono" style="color:${isZero?'var(--danger)':'var(--warn)'};font-weight:700">${p.qtd||0}</td>
          <td class="font-mono text-muted">${p.min||0}</td>
          <td>${isZero?'<span class="badge badge-danger">Zerado</span>':'<span class="badge badge-warn">Baixo</span>'}</td>
        </tr>`;
      }).join('');
    }
  }
};
