/**
 * JARVIS ERP — clientes.js
 * Gestão de Clientes B2C, Veículos (Frota), Estoque, Fornecedores e Equipe (RH)
 * Bug 1 Resolvido: Salvamento garantido de Senhas/PINs para App de Cliente
 */
'use strict';

// ── CLIENTES B2C ───────────────────────────────────────────
window.renderClientes = function() {
  const tb = document.getElementById('tbClientes'); if (!tb) return;
  if (!J.clientes.length) { tb.innerHTML='<tr><td colspan="5" class="table-empty">Nenhum cliente cadastrado.</td></tr>'; return; }
  
  tb.innerHTML = J.clientes.map(c => {
    const veic = J.veiculos.filter(v => v.clienteId === c.id);
    const vPlacas = veic.map(v => `<span class="placa">${v.placa}</span>`).join(' ');
    const osCount = J.os.filter(o => o.clienteId === c.id).length;
    return `<tr>
      <td><div style="font-family:var(--fd);font-weight:700;font-size:.9rem">${c.nome}</div><div style="font-family:var(--fm);font-size:.65rem;color:var(--text-muted)">${c.doc||'Sem CPF'}</div></td>
      <td class="font-mono">${c.wpp||'—'}</td>
      <td>${vPlacas || '—'}</td>
      <td>${osCount}</td>
      <td>
        <button class="btn btn-brand btn-sm" onclick="prepCliente('edit','${c.id}');abrirModal('modalCliente')">Editar</button>
      </td>
    </tr>`;
  }).join('');
};

window.prepCliente = function(mode, id=null) {
  const campos = ['cliId','cliNome','cliWpp','cliDoc','cliEmail','cliCep','cliRua','cliNum','cliBairro','cliCidade','cliLogin','cliPin'];
  campos.forEach(f => window._sv && _sv(f,''));
  
  if (mode==='edit' && id) {
    const c = J.clientes.find(x => x.id === id); if (!c) return;
    campos.forEach(f => { const key=f.replace('cli','').toLowerCase(); _sv(f, c[key]||''); });
    _sv('cliNome', c.nome||''); _sv('cliWpp', c.wpp||''); _sv('cliDoc', c.doc||''); _sv('cliEmail', c.email||'');
    _sv('cliCep', c.cep||''); _sv('cliRua', c.rua||''); _sv('cliNum', c.num||''); _sv('cliBairro', c.bairro||''); _sv('cliCidade', c.cidade||'');
    _sv('cliLogin', c.login||''); _sv('cliPin', c.pin||''); _sv('cliId', c.id);
  } else {
    _sv('cliPin', Math.random().toString(36).slice(-6).toUpperCase());
  }
};

window.salvarCliente = async function() {
  const id=window._v?_v('cliId'):document.getElementById('cliId').value;
  const nome=_v('cliNome'); if(!nome){ window.toastWarn&&toastWarn('O Nome é obrigatório'); return; }

  // 🔴 CORREÇÃO (BUG 1): Impede salvamento de login "Vazio" garantindo o Fallback 
  let loginFinal = _v('cliLogin');
  if(!loginFinal) loginFinal = _v('cliEmail') || _v('cliDoc') || _v('cliWpp') || (nome.split(' ')[0] + Math.floor(Math.random()*999)).toLowerCase();
  
  let pinFinal = _v('cliPin');
  if(!pinFinal) pinFinal = Math.random().toString(36).slice(-6).toUpperCase();

  const payload = {
    tenantId: J.tid, nome,
    wpp: _v('cliWpp'), doc: _v('cliDoc'), email: _v('cliEmail'),
    cep: _v('cliCep'), rua: _v('cliRua'), num: _v('cliNum'), bairro: _v('cliBairro'), cidade: _v('cliCidade'),
    login: loginFinal.replace(/\s/g,''),
    pin: pinFinal,
    updatedAt: new Date().toISOString()
  };

  try {
    if(id){
      await J.db.collection('clientes').doc(id).update(payload);
      window.toastOk && toastOk('Cliente atualizado!');
      window.audit && audit('CLIENTES', `Editou cliente: ${nome}`);
    } else {
      payload.createdAt = new Date().toISOString();
      await J.db.collection('clientes').add(payload);
      window.toastOk && toastOk('Novo cliente cadastrado!');
      window.audit && audit('CLIENTES', `Cadastrou cliente: ${nome}`);
    }
    window.fecharModal && fecharModal('modalCliente');
  } catch(e){ window.toastErr && toastErr('Erro: '+e.message); }
};

window.buscarCEP = async function(cepStr) {
  const cep = cepStr.replace(/\D/g,''); if(cep.length!==8) return;
  try {
    const r=await fetch(`https://viacep.com.br/ws/${cep}/json/`); const d=await r.json();
    if(!d.erro){ window._sv&&_sv('cliRua',d.logradouro); _sv('cliBairro',d.bairro); _sv('cliCidade',d.localidade); document.getElementById('cliNum')?.focus(); }
  } catch(e){}
};


// ── VEÍCULOS ───────────────────────────────────────────────
window.renderVeiculos = function() {
  const tb = document.getElementById('tbVeiculos'); if (!tb) return;
  if (!J.veiculos.length) { tb.innerHTML='<tr><td colspan="6" class="table-empty">Nenhum veículo vinculado.</td></tr>'; return; }
  
  tb.innerHTML = J.veiculos.map(v => {
    const c = J.clientes.find(x => x.id === v.clienteId);
    return `<tr>
      <td><span class="placa">${v.placa||'MOTO/S-PL'}</span></td>
      <td><span class="badge badge-brand">${v.tipo||'carro'}</span></td>
      <td><div style="font-family:var(--fd);font-weight:700">${v.modelo||'—'}</div><div style="font-size:0.65rem;color:var(--text-muted)">${v.ano||''} • ${v.cor||''}</div></td>
      <td>${c?.nome||'—'}</td>
      <td class="font-mono">${v.km||'0'}</td>
      <td><button class="btn btn-outline btn-sm" onclick="prepVeiculo('edit','${v.id}');abrirModal('modalVeiculo')">Editar</button></td>
    </tr>`;
  }).join('');
};

window.prepVeiculo = function(mode, id=null) {
  const clSel = document.getElementById('veicCliente'); if(clSel) clSel.innerHTML = J.clientes.map(c=>`<option value="${c.id}">${c.nome}</option>`).join('');
  
  const campos = ['veicId','veicPlaca','veicModelo','veicAno','veicCor','veicKm'];
  campos.forEach(f => window._sv && _sv(f,'')); _sv('veicTipo','carro');
  
  if (mode==='edit' && id) {
    const v = J.veiculos.find(x => x.id === id); if (!v) return;
    _sv('veicId', v.id); _sv('veicPlaca', v.placa||''); _sv('veicTipo', v.tipo||'carro');
    _sv('veicModelo', v.modelo||''); _sv('veicAno', v.ano||''); _sv('veicCor', v.cor||'');
    _sv('veicKm', v.km||''); _sv('veicCliente', v.clienteId||'');
  }
};

window.salvarVeiculo = async function() {
  const id=_v('veicId'); const placa=_v('veicPlaca').toUpperCase(); const clienteId=_v('veicCliente');
  if(!clienteId){ window.toastWarn&&toastWarn('Selecione um dono legal'); return; }

  const payload = {
    tenantId: J.tid, clienteId, placa,
    tipo: _v('veicTipo'), modelo: _v('veicModelo'), ano: _v('veicAno'), cor: _v('veicCor'), km: _v('veicKm'),
    updatedAt: new Date().toISOString()
  };

  try {
    if(id) { await J.db.collection('veiculos').doc(id).update(payload); window.toastOk&&toastOk('Veículo atualizado!'); window.audit&&audit('VEÍCULOS',`Editou ${placa}`); }
    else   { payload.createdAt = new Date().toISOString(); await J.db.collection('veiculos').add(payload); window.toastOk&&toastOk('Veículo vinculado!'); window.audit&&audit('VEÍCULOS',`Vínculo criado ${placa}`); }
    window.fecharModal && fecharModal('modalVeiculo');
  } catch(e){ window.toastErr&&toastErr('Erro: '+e.message); }
};


// ── ESTOQUE E NF ───────────────────────────────────────────
window.renderEstoque = function() {
  const tb = document.getElementById('tbEstoque'); if (!tb) return;
  if (!J.estoque.length) { tb.innerHTML='<tr><td colspan="9" class="table-empty">Nenhum item cadastrado.</td></tr>'; return; }
  
  const vTotal = J.estoque.reduce((acc, x)=>acc + ((parseFloat(x.custo)||0) * (parseInt(x.qtd)||0)),0);
  tb.innerHTML = J.estoque.map(p => {
    const isCrit = (p.qtd||0) <= (p.min||0);
    const isZerado = (p.qtd||0) <= 0;
    const margem = p.venda > 0 ? (((p.venda - p.custo) / p.venda)*100).toFixed(1) : '0';
    return `<tr class="${isCrit?'stock-critical':''}">
      <td class="font-mono">${p.ref||p.id.slice(-5).toUpperCase()}</td>
      <td><div style="font-family:var(--fd);font-weight:700">${p.desc}</div><div style="font-size:0.6rem;color:var(--text-muted)">Un: ${p.unidade||'UN'} | Forn: ${p.fornecedor||'—'}</div></td>
      <td class="text-warn font-mono">${window.moeda?moeda(p.custo||0):p.custo}</td>
      <td class="text-success font-mono" style="font-weight:700">${window.moeda?moeda(p.venda||0):p.venda}</td>
      <td class="font-mono">${margem}%</td>
      <td class="font-mono" style="font-size:1rem;color:${isZerado?'var(--danger)':'var(--brand)'};font-weight:700">${p.qtd||0}</td>
      <td class="text-muted font-mono">${p.min||0}</td>
      <td>${isZerado?'<span class="badge badge-danger">Sem Estoque</span>':(isCrit?'<span class="badge badge-warn">Comprar</span>':'<span class="badge badge-success">Regular</span>')}</td>
      <td><button class="btn btn-outline btn-sm" onclick="prepPeca('edit','${p.id}');abrirModal('modalPeca')">Editar</button></td>
    </tr>`;
  }).join('');
};

window.prepPeca = function(mode, id=null) {
  const sel=document.getElementById('pecaForn'); if(sel) sel.innerHTML = '<option value="">Sem Fornecedor</option>'+J.fornecedores.map(f=>`<option value="${f.nome}">${f.nome}</option>`).join('');
  const cp=['pecaId','pecaRef','pecaDesc','pecaCusto','pecaVenda','pecaQtd','pecaMin']; cp.forEach(f=>window._sv&&_sv(f,'')); _sv('pecaUn','UN');
  
  if (mode==='edit' && id) {
    const p = J.estoque.find(x => x.id === id); if (!p) return;
    _sv('pecaId', p.id); _sv('pecaRef', p.ref||''); _sv('pecaDesc', p.desc||''); _sv('pecaUn', p.unidade||'UN');
    _sv('pecaCusto', p.custo||0); _sv('pecaVenda', p.venda||0); _sv('pecaQtd', p.qtd||0); _sv('pecaMin', p.min||0); _sv('pecaForn', p.fornecedor||'');
  }
};

window.salvarPeca = async function() {
  const id=_v('pecaId'); const desc=_v('pecaDesc'); if(!desc){ window.toastWarn&&toastWarn('Descrição obrigatória'); return; }
  const payload = {
    tenantId: J.tid, desc, ref: _v('pecaRef')||desc.slice(0,3).toUpperCase()+Math.floor(Math.random()*999),
    unidade: _v('pecaUn'), fornecedor: _v('pecaForn'),
    custo: parseFloat(_v('pecaCusto')||0), venda: parseFloat(_v('pecaVenda')||0),
    qtd: parseInt(_v('pecaQtd')||0), min: parseInt(_v('pecaMin')||0),
    updatedAt: new Date().toISOString()
  };
  try {
    if(id){ await J.db.collection('estoqueItems').doc(id).update(payload); window.toastOk&&toastOk('Peça atualizada'); window.audit&&audit('ESTOQUE',`Editou ${desc}`); }
    else  { payload.createdAt = new Date().toISOString(); await J.db.collection('estoqueItems').add(payload); window.toastOk&&toastOk('Peça catalogada'); }
    window.fecharModal&&fecharModal('modalPeca');
  } catch(e){ window.toastErr&&toastErr('Erro: '+e.message); }
};

// ... Funções NF da aba Estoque
window.prepNF = function() {
  _sv('nfChave',''); _sv('nfXml',''); _sh('nfItemsPreview','');
};
window.salvarNF = function() {
    window.toastInfo && toastInfo('Este protótipo foca na baixa inteligente manual/XML parse.');
    window.fecharModal && fecharModal('modalNF');
};


// ── FORNECEDORES ───────────────────────────────────────────
window.renderFornecedores = function() {
  const tb = document.getElementById('tbFornec'); if (!tb) return;
  if (!J.fornecedores.length) { tb.innerHTML='<tr><td colspan="3" class="table-empty">Nenhum fornecedor cadastrado.</td></tr>'; return; }
  tb.innerHTML = J.fornecedores.map(f => `<tr>
    <td><div style="font-family:var(--fd);font-weight:700">${f.nome}</div><div style="font-size:0.6rem;color:var(--text-muted)">CNPJ: ${f.cnpj||'—'} | ${f.tel||'—'}</div></td>
    <td><span class="badge badge-brand">${f.segmento||'Autopeças'}</span></td>
    <td><button class="btn btn-ghost btn-sm" onclick="prepFornec('edit','${f.id}');abrirModal('modalFornec')">Detalhes</button></td>
  </tr>`).join('');
};

window.prepFornec = function(mode, id=null) {
  const cp=['fornId','fornNome','fornCnpj','fornTel','fornSeg']; cp.forEach(f=>window._sv&&_sv(f,''));
  if (mode==='edit' && id) {
    const f=J.fornecedores.find(x=>x.id===id); if(!f)return;
    _sv('fornId',f.id); _sv('fornNome',f.nome||''); _sv('fornCnpj',f.cnpj||''); _sv('fornTel',f.tel||''); _sv('fornSeg',f.segmento||'');
  }
};

window.salvarFornec = async function() {
  const id=_v('fornId'); const nome=_v('fornNome'); if(!nome) return;
  const t={ tenantId:J.tid, nome, cnpj:_v('fornCnpj'), tel:_v('fornTel'), segmento:_v('fornSeg'), updatedAt:new Date().toISOString() };
  try {
    if(id){ await J.db.collection('fornecedores').doc(id).update(t); window.toastOk&&toastOk('Fornecedor salvo'); }
    else  { t.createdAt=new Date().toISOString(); await J.db.collection('fornecedores').add(t); window.toastOk&&toastOk('Fornecedor criado'); }
    window.fecharModal&&fecharModal('modalFornec');
  } catch(e){}
};


// ── EQUIPE (RH) / COMISSÕES / SALÁRIOS ──────────────────────
window.renderEquipe = function() {
  const tb = document.getElementById('tbEquipe'); if (!tb) return;
  if (!J.equipe.length) { tb.innerHTML='<tr><td colspan="5" class="table-empty">Nenhum funcionário na base.</td></tr>'; return; }
  
  tb.innerHTML = J.equipe.map(f => `<tr>
    <td><div style="font-family:var(--fd);font-weight:700">${f.nome}</div></td>
    <td><span class="badge badge-neutral">${f.cargo||'Mecânico'}</span></td>
    <td class="font-mono text-muted">${f.login||'—'}</td>
    <td class="font-mono">${f.comissaoServico||f.comissao||0}% M.O. <br> ${f.comissaoPeca||0}% Peças</td>
    <td><button class="btn btn-outline btn-sm" onclick="prepFunc('edit','${f.id}');abrirModal('modalFunc')">Editar</button></td>
  </tr>`).join('');
};

window.prepFunc = function(mode, id=null) {
  const cp=['funcId','funcNome','funcCargo','funcLogin','funcPin','funcComMao','funcComPec']; cp.forEach(f=>window._sv&&_sv(f,''));
  if (mode==='edit' && id) {
    const f=J.equipe.find(x=>x.id===id); if(!f)return;
    _sv('funcId',f.id); _sv('funcNome',f.nome||''); _sv('funcCargo',f.cargo||'mecanico'); _sv('funcLogin',f.login||'');
    _sv('funcPin',f.pin||''); _sv('funcComMao',f.comissaoServico||f.comissao||0); _sv('funcComPec',f.comissaoPeca||0);
  } else {
    _sv('funcPin',Math.floor(1000+Math.random()*9000));
  }
};

window.salvarFunc = async function() {
  const id=_v('funcId'); const nome=_v('funcNome'); if(!nome) return;
  const p={ tenantId:J.tid, nome, cargo:_v('funcCargo'), login:_v('funcLogin').toLowerCase().trim(), pin:_v('funcPin'), 
            comissaoServico:parseFloat(_v('funcComMao')||0), comissaoPeca:parseFloat(_v('funcComPec')||0), updatedAt:new Date().toISOString() };
  try {
    if(id){ await J.db.collection('equipe').doc(id).update(p); window.toastOk&&toastOk('Colaborador Salvo'); }
    else  { p.createdAt=new Date().toISOString(); await J.db.collection('equipe').add(p); window.toastOk&&toastOk('Admitido com Sucesso'); }
    window.fecharModal&&fecharModal('modalFunc');
  } catch(e){}
};

window.prepPgtoRH = function() {
  const sel = document.getElementById('rhFunc'); if(sel) sel.innerHTML = '<option value="">Selecionar Func...</option>'+J.equipe.map(f=>`<option value="${f.id}">${f.nome} (${f.cargo})</option>`).join('');
  _sv('rhValor',''); _sv('rhDesc',''); _sv('rhData',new Date().toISOString().split('T')[0]);
};

window.salvarPgtoRH = async function() {
  const fId=_v('rhFunc'); const valor=parseFloat(_v('rhValor')); const desc=_v('rhDesc')||'Vale/Pgto RH';
  if(!fId || isNaN(valor) || valor<=0){ window.toastWarn&&toastWarn('Informe funcionário e valor'); return; }
  try {
    await J.db.collection('financeiro').add({
      tenantId: J.tid, tipo:'Saída', status:'Pago', desc, valor, pgto:'Dinheiro/PIX', venc:_v('rhData'), createdAt:new Date().toISOString()
    });
    window.toastOk&&toastOk('Pagamento RH Lançado no Caixa');
    window.fecharModal&&fecharModal('modalPgtoRH');
  } catch(e){}
};
