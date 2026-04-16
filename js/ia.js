/**
 * JARVIS ERP — ia.js
 * Gemini RAG (multi-modelo), Chat CRM admin↔cliente, Chat equipe↔admin
 */
'use strict';

// ── GEMINI IA ──────────────────────────────────────────────
let _iaHistorico = [];

window.iaPerguntar = async function() {
  const inp = document.getElementById('iaInput');
  const msg = inp ? inp.value.trim() : '';
  if (!msg) return;
  if (inp) inp.value = '';

  _adicionarMsgIA('user', msg);
  _adicionarMsgIA('bot', '<span style="color:var(--text-muted)">⏳ Analisando dados da oficina...</span>', true);

  const key = J.gemini;
  if (!key) {
    _iaMsgsRemoveLast();
    _adicionarMsgIA('bot', '⚠️ Configure a chave API do Gemini no Superadmin.');
    return;
  }

  const ctx = _buildContext();
  const systemPrompt = `Você é o thIAguinho, assistente de IA da oficina "${J.tnome}", especializado em gestão automotiva.

DADOS DA OFICINA AGORA:
${ctx}

REGRAS ABSOLUTAS:
- Responda SEMPRE em português brasileiro
- Seja direto, técnico e útil
- JAMAIS invente dados — baseie-se APENAS nos dados fornecidos
- Ao mencionar valores, use R$ X.XXX,XX
- Placas de veículos: destaque em **negrito**
- Se não encontrar a informação no contexto, responda: "Não encontrei esse registro no sistema da oficina."`;

  _iaHistorico.push({ role: 'user', text: msg });

  const MODELOS = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];

  for (const modelo of MODELOS) {
    try {
      const contents = _iaHistorico.map(h => ({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: h.text }]
      }));

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents,
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: { temperature: 0.3, maxOutputTokens: 1200 }
          })
        }
      );

      if (res.status === 429) {
        _iaMsgsRemoveLast();
        _adicionarMsgIA('bot', '⚠️ Limite de uso da API atingido. Aguarde um momento.');
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        if (modelo === MODELOS[MODELOS.length-1]) throw new Error(data.error?.message||'Erro API');
        continue;
      }

      const resposta = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sem resposta.';
      _iaHistorico.push({ role: 'model', text: resposta });
      _iaMsgsRemoveLast();
      _adicionarMsgIA('bot', _formatarRespIA(resposta));
      window.audit && audit('IA', `Consulta: ${msg.slice(0,80)}`);
      return;
    } catch(e) {
      if (modelo === MODELOS[MODELOS.length-1]) {
        _iaMsgsRemoveLast();
        _adicionarMsgIA('bot', `⚠️ Erro: ${e.message}`);
      }
    }
  }
};

window.iaAnalisarDRE = async function() {
  window._sv && _sv('iaInput', 'Analise o financeiro atual da oficina. Receitas, despesas, saldo e sugestões práticas de melhoria.');
  window.ir && ir('ia', null);
  await iaPerguntar();
};

window.iaAnalisarEstoque = async function() {
  window._sv && _sv('iaInput', 'Analise o estoque atual. Quais itens estão críticos? O que comprar com prioridade?');
  window.ir && ir('ia', null);
  await iaPerguntar();
};

window.iaDiagnosticarPlaca = async function(placa) {
  window._sv && _sv('iaInput', `Mostre o histórico completo da placa ${placa}. Há serviços vencidos ou recorrentes?`);
  await iaPerguntar();
};

function _buildContext() {
  const agora = new Date();
  const mes = agora.getMonth(), ano = agora.getFullYear();

  const fatMes = J.os
    .filter(o => ['Pronto','Entregue'].includes(o.status) && o.updatedAt)
    .reduce((acc,o)=>{ const d=new Date(o.updatedAt); return (d.getMonth()===mes&&d.getFullYear()===ano)?acc+(o.total||0):acc; }, 0);

  const pecasCrit = J.estoque.filter(p=>(p.qtd||0)<=(p.min||0));
  const osAbertas = J.os.filter(o=>!['Entregue','Cancelado'].includes(o.status));

  const osDetalhes = J.os.slice(-15).map(o=>{
    const v=J.veiculos.find(x=>x.id===o.veiculoId);
    const c=J.clientes.find(x=>x.id===o.clienteId);
    return `• Placa: **${o.placa||v?.placa||'?'}** | Cliente: ${c?.nome||'?'} | Serviço: ${o.desc||'?'} | Status: ${o.status} | Valor: ${window.moeda?moeda(o.total||0):(o.total||0)}`;
  }).join('\n');

  let entradas=0, saidas=0;
  J.financeiro.filter(f=>f.status==='Pago').forEach(f=>{ if(f.tipo==='Entrada')entradas+=f.valor||0; else saidas+=f.valor||0; });

  return `
Oficina: ${J.tnome} | Nicho: ${J.nicho}
Mecânicos: ${J.equipe.map(f=>f.nome).join(', ')||'nenhum'}
Clientes: ${J.clientes.length} | Veículos: ${J.veiculos.length}
O.S. abertas: ${osAbertas.length}
Peças críticas: ${pecasCrit.map(p=>p.desc).join(', ')||'nenhuma'}
Faturamento mês: ${window.moeda?moeda(fatMes):fatMes}
Saldo caixa (pago): ${window.moeda?moeda(entradas-saidas):(entradas-saidas)}

ÚLTIMAS 15 O.S.:
${osDetalhes||'Nenhuma O.S.'}
  `.trim();
}

function _formatarRespIA(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')
    .replace(/\n- /g,'<br>• ')
    .replace(/\n/g,'<br>');
}

function _adicionarMsgIA(role, html, temp=false) {
  const container = document.getElementById('iaMsgs'); if (!container) return;
  const div = document.createElement('div');
  div.className = `ia-msg ${role}`;
  if (temp) div.dataset.temp = '1';
  if (role==='bot') div.innerHTML = `<strong style="color:var(--brand);font-family:var(--fd);font-size:0.9rem;display:block;margin-bottom:6px;">✦ thIAguinho</strong>${html}`;
  else div.innerHTML = html;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function _iaMsgsRemoveLast() {
  const container = document.getElementById('iaMsgs'); if (!container) return;
  const temp = container.querySelector('[data-temp="1"]');
  if (temp) temp.remove();
}

document.addEventListener('DOMContentLoaded', () => {
  const el = document.getElementById('iaInput');
  if (el) el.addEventListener('keydown', e => { if(e.key==='Enter') iaPerguntar(); });
});

// ── CHAT CRM (admin ↔ cliente) ─────────────────────────────
window.renderChatLista = function() {
  const container = document.getElementById('chatLista'); if(!container) return;
  if(!J.clientes.length){container.innerHTML='<div class="empty-state" style="padding:20px"><div class="empty-state-icon">💬</div><div class="empty-state-sub">Nenhum cliente</div></div>'; return;}
  
  // Listagem CRM CLientes
  let html = J.clientes.map(c=>{
    const msgs=J.mensagens.filter(m=>m.clienteId===c.id);
    const ultima=msgs[msgs.length-1];
    const naoLidas=msgs.filter(m=>m.sender==='cliente'&&!m.lidaAdmin).length;
    let labelMsg = ultima?.msg || 'Sem mensagens';
    if(ultima?.fileType === 'audio') labelMsg = '🎤 Áudio Recebido';
    else if(ultima?.fileUrl) labelMsg = '📎 Arquivo Recebido';

    return `<div class="chat-contact ${J.chatAtivo===c.id?'active':''}" onclick="abrirChatCRM('${c.id}','${c.nome}')">
      <div class="chat-contact-name">${c.nome} ${naoLidas>0?`<span class="chat-unread">${naoLidas}</span>`:''}</div>
      <div class="chat-contact-last">${labelMsg}</div>
    </div>`;
  }).join('');

  // 🔴 CORREÇÃO (BUG 3): Injetamos os colaboradores na lista de chats do Admin 
  // para que o Gestor possa interagir com a Equipe internamente.
  if(J.role === 'admin' || J.role === 'gestor') {
      const equipeChats = J.equipe.map(eq => {
          const msgsEq = J.chatEquipe.filter(m => (m.de === eq.id || m.para === eq.id));
          const msgRecente = msgsEq[msgsEq.length-1];
          const naoLidasEq = msgsEq.filter(m => m.sender === 'equipe' && !m.lidaAdmin).length;
          
          let lLbl = msgRecente?.msg || 'Sem mensagens';
          if(msgRecente?.fileType === 'audio') lLbl = '🎤 Áudio Recebido';
          else if(msgRecente?.fileUrl) lLbl = '📎 Arquivo Anexado';

          return `<div class="chat-contact ${J.chatAtivo=== 'EQ_'+eq.id ?'active':''}" onclick="abrirChatEquipeAdmin('${eq.id}','Eq: ${eq.nome}')" style="border-left: 2px solid var(--warn);">
            <div class="chat-contact-name" style="color:var(--warn)">[Eq] ${eq.nome} ${naoLidasEq>0?`<span class="chat-unread" style="background:var(--warn)">${naoLidasEq}</span>`:''}</div>
            <div class="chat-contact-last">${lLbl}</div>
          </div>`;
      }).join('');
      
      if(equipeChats) {
          html = `<div style="padding:8px 14px;background:var(--surf2);font-family:var(--fm);font-size:0.6rem;color:var(--warn);border-bottom:1px solid var(--border)">MENSAGENS INTERNAS (EQUIPE)</div>` + equipeChats + 
                 `<div style="padding:8px 14px;background:var(--surf2);font-family:var(--fm);font-size:0.6rem;color:var(--text-muted);border-bottom:1px solid var(--border)">CLIENTES B2C</div>` + html;
      }
  }

  container.innerHTML = html;
};

// Abre Chat de Cliente
window.abrirChatCRM = function(cid, nome) {
  J.chatAtivo = cid;
  const head=document.getElementById('chatHead'); if(head) head.textContent='ATENDIMENTO: '+(nome||'').toUpperCase();
  const foot=document.getElementById('chatFoot'); if(foot) foot.style.display='flex';
  
  if(document.getElementById('chatInput')) document.getElementById('chatInput').placeholder = "Digite sua resposta...";
  
  renderChatMsgs(cid);
  J.mensagens.filter(m=>m.clienteId===cid&&m.sender==='cliente'&&!m.lidaAdmin)
    .forEach(m=>J.db.collection('mensagens').doc(m.id).update({lidaAdmin:true}));
};

// Abre Chat da Equipe (Admin vendo mecânico)
window.abrirChatEquipeAdmin = function(eqId, nomeInfo) {
  J.chatAtivo = 'EQ_' + eqId;
  const head=document.getElementById('chatHead'); if(head) head.textContent='INTERNO: '+(nomeInfo||'').toUpperCase();
  const foot=document.getElementById('chatFoot'); if(foot) foot.style.display='flex';
  
  if(document.getElementById('chatInput')) document.getElementById('chatInput').placeholder = "Mensagem para membro da equipe...";

  renderChatMsgsEquipeAdmin(eqId);
  J.chatEquipe.filter(m=>(m.de === eqId || m.para === eqId) && m.sender==='equipe'&&!m.lidaAdmin)
    .forEach(m=>J.db.collection('chat_equipe').doc(m.id).update({lidaAdmin:true}));
};

// Renderiza Mensagens Clientes -> Admin
window.renderChatMsgs = function(cid) {
  const container=document.getElementById('chatMsgs'); if(!container) return;
  const msgs=J.mensagens.filter(m=>m.clienteId===cid);
  if(!msgs.length){container.innerHTML='<div class="empty-state"><div class="empty-state-icon">💬</div><div class="empty-state-sub">Sem mensagens ainda</div></div>';return;}
  container.innerHTML=msgs.map(m=>{
    const t=m.ts?new Date(m.ts).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'';
    const dir=m.sender==='admin'?'outgoing':'incoming';
    
    // 🔴 CORREÇÃO (BUG 3): Renderização real de Arquivos e Mídias no Chat (Web/Admin)
    let contentHtml = m.msg || '';
    if(m.fileUrl) {
       if(m.fileType === 'audio' || m.msg === '🎤 Áudio') {
           contentHtml += `<br><audio controls src="${m.fileUrl}" style="max-width:200px;margin-top:5px;height:35px;"></audio>`;
       } else if (m.fileType === 'video') {
           contentHtml += `<br><video controls src="${m.fileUrl}" style="max-width:200px;margin-top:5px;"></video>`;
       } else {
           contentHtml += `<br><a href="${m.fileUrl}" target="_blank" style="color:var(--brand);text-decoration:underline;font-size:0.8rem;display:inline-block;margin-top:5px">📎 Visualizar / Baixar Anexo</a>`;
       }
    }

    return `<div class="chat-msg ${dir}">${contentHtml}<div class="msg-time">${t}</div></div>`;
  }).join('');
  container.scrollTop=container.scrollHeight;
};

// Renderiza Mensagens Admin -> Equipe (Painel Gestor)
window.renderChatMsgsEquipeAdmin = function(eqId) {
  const container=document.getElementById('chatMsgs'); if(!container) return;
  const msgs=J.chatEquipe.filter(m=>(m.de === eqId || m.para === eqId));
  if(!msgs.length){container.innerHTML='<div class="empty-state"><div class="empty-state-icon">💬</div><div class="empty-state-sub">Sem mensagens internas ativas</div></div>';return;}
  
  container.innerHTML=msgs.map(m=>{
    const t=m.ts?new Date(m.ts).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'';
    const dir=m.sender==='admin'?'outgoing':'incoming';
    const nomeOrigin = m.sender === 'admin' ? J.nome : (J.equipe.find(e=>e.id===m.de)?.nome || 'Equipe');
    
    let contentHtml = m.msg || '';
    if(m.fileUrl) {
       if(m.fileType === 'audio' || m.msg === '🎤 Áudio') {
           contentHtml += `<br><audio controls src="${m.fileUrl}" style="max-width:200px;margin-top:5px;height:35px;"></audio>`;
       } else {
           contentHtml += `<br><a href="${m.fileUrl}" target="_blank" style="color:var(--brand);text-decoration:underline;font-size:0.8rem;display:inline-block;margin-top:5px">📎 Visualizar / Baixar Anexo</a>`;
       }
    }

    return `<div class="chat-msg ${dir}">
      <strong style="font-size:0.62rem;color:${dir==='outgoing'?'var(--brand)':'var(--warn)'};display:block;margin-bottom:3px">${nomeOrigin}</strong>
      ${contentHtml}
      <div class="msg-time">${t}</div>
    </div>`;
  }).join('');
  container.scrollTop=container.scrollHeight;
};

window.enviarChat = async function(txt) {
  const msg=txt||_v('chatInput'); if(!msg||!J.chatAtivo) return;
  
  // Verifica se é CRM Cliente (Normal) ou Internal Equipe (EQ_xxx)
  if(J.chatAtivo.startsWith('EQ_')) {
     const eqTarget = J.chatAtivo.replace('EQ_', '');
     await J.db.collection('chat_equipe').add({tenantId:J.tid,de:J.fid||'0',para:eqTarget,sender:'admin',msg,lidaEquipe:false,lidaAdmin:true,ts:Date.now()});
  } else {
     await J.db.collection('mensagens').add({tenantId:J.tid,clienteId:J.chatAtivo,sender:'admin',msg,lidaCliente:false,lidaAdmin:true,ts:Date.now()});
  }
  window._sv && _sv('chatInput','');
};

document.addEventListener('DOMContentLoaded', ()=>{
  const el=document.getElementById('chatInput');
  if(el) el.addEventListener('keydown',e=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();enviarChat();} });
});

// Enviar arquivo no chat (Admin)
window.enviarArquivoChat = async function(input) {
  const file=input.files[0]; if(!file||!J.chatAtivo) return;
  
  window.toastInfo && toastInfo('⏳ Enviando arquivo. Aguarde...');
  try {
    const fd=new FormData(); fd.append('file',file); fd.append('upload_preset',J.cloudPreset);
    const res=await fetch(`https://api.cloudinary.com/v1_1/${J.cloudName}/auto/upload`,{method:'POST',body:fd});
    const data=await res.json();

    if(data.secure_url){
      if(J.chatAtivo.startsWith('EQ_')) {
          const eqTarget = J.chatAtivo.replace('EQ_', '');
          await J.db.collection('chat_equipe').add({tenantId:J.tid,de:J.fid||'0',para:eqTarget,sender:'admin',msg:`📎 Arquivo: ${file.name}`,fileUrl:data.secure_url,fileType:data.resource_type,lidaEquipe:false,lidaAdmin:true,ts:Date.now()});
      } else {
          await J.db.collection('mensagens').add({tenantId:J.tid,clienteId:J.chatAtivo,sender:'admin',msg:`📎 Arquivo: ${file.name}`,fileUrl:data.secure_url,fileType:data.resource_type,lidaCliente:false,lidaAdmin:true,ts:Date.now()});
      }
      
      window.toastOk && toastOk('✓ Arquivo enviado');
    }
  } catch(e){ window.toastErr && toastErr('Erro ao enviar arquivo'); }
  finally { input.value = ''; }
};


// ── PTT (Push-to-Talk GRAVAÇÃO RESTRUTURADA) ─────────────────────────────────────
let _mediaRec=null, _audioChunks=[], _pttActive=false;

window.togglePTT = async function() {
  const btn=document.getElementById('btnPTT');

  // 🔴 CORREÇÃO (BUG 3): Botão de áudio agora suporta a promessa corretamente. Clicou, gravou, Clicou, Enviou.
  if (!_pttActive) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio:true});
      _mediaRec = new MediaRecorder(stream, { mimeType: 'audio/webm' }); 
      _audioChunks = [];
      
      _mediaRec.ondataavailable = e => { if(e.data.size > 0) _audioChunks.push(e.data); };
      
      _mediaRec.onstop = async () => {
        const blob = new Blob(_audioChunks,{type:'audio/webm'});
        if(blob.size < 500) return; // Evita msgs vazias em caso de falhas instantâneas 

        const fd = new FormData(); 
        fd.append('file',blob,'voicemail.webm'); 
        fd.append('upload_preset',J.cloudPreset);
        
        window.toastInfo && toastInfo('⏳ Processando Áudio...');
        try{
          const res = await fetch(`https://api.cloudinary.com/v1_1/${J.cloudName}/auto/upload`,{method:'POST',body:fd});
          const d = await res.json();
          if(d.secure_url && J.chatAtivo){
            if(J.chatAtivo.startsWith('EQ_')) {
                 const eqTarget = J.chatAtivo.replace('EQ_', '');
                 await J.db.collection('chat_equipe').add({tenantId:J.tid,de:J.fid||'0',para:eqTarget,sender:'admin',msg:'🎤 Áudio',fileUrl:d.secure_url,fileType:'audio',lidaEquipe:false,lidaAdmin:true,ts:Date.now()});
            } else {
                 await J.db.collection('mensagens').add({tenantId:J.tid,clienteId:J.chatAtivo,sender:'admin',msg:'🎤 Áudio',fileUrl:d.secure_url,fileType:'audio',lidaCliente:false,lidaAdmin:true,ts:Date.now()});
            }
            window.toastOk && toastOk('✓ Áudio enviado');
          }
        } catch(e){ window.toastErr && toastErr('Erro Cloudinary ao salvar gravação.'); }
        stream.getTracks().forEach(t=>t.stop());
        _mediaRec = null;
        _pttActive = false;
        if(btn){btn.style.background='';btn.style.borderColor='';}
      };
      
      _mediaRec.start(250); 
      _pttActive=true;
      if(btn){btn.style.background='var(--danger-dim)';btn.style.borderColor='var(--danger)';}
      window.toastInfo && toastInfo('🔴 Gravando... Clique novamente para enviar');
    } catch(e){ window.toastErr && toastErr('Microfone não disponível ou permissão negada.'); }
  } else {
    // Para gravação!
    if(_mediaRec && _mediaRec.state !== 'inactive') {
        _mediaRec.stop();
    }
  }
};

// ── CHAT EQUIPE ↔ ADMIN (Painel da Equipe) ────────────────────────────────────
window.renderChatEquipe = function() {
  const container=document.getElementById('chatMsgs'); if(!container) return;
  if(!J.chatEquipe.length){container.innerHTML='<div class="empty-state"><div class="empty-state-icon">💬</div><div class="empty-state-sub">Sem mensagens ainda</div></div>';return;}
  container.innerHTML=J.chatEquipe.map(m=>{
    const t=m.ts?new Date(m.ts).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'';
    const dir=m.sender==='equipe'?'outgoing':'incoming';
    const nome=m.sender==='equipe'?J.nome:'Admin';
    if(m.sender==='admin'&&!m.lidaEquipe&&m.para===J.fid){
      J.db.collection('chat_equipe').doc(m.id).update({lidaEquipe:true}).catch(()=>{});
    }

    let contentHtml = m.msg || '';
    if(m.fileUrl) {
       if(m.fileType === 'audio' || m.msg === '🎤 Áudio') {
           contentHtml += `<br><audio controls src="${m.fileUrl}" style="max-width:200px;margin-top:5px;height:35px;"></audio>`;
       } else {
           contentHtml += `<br><a href="${m.fileUrl}" target="_blank" style="color:var(--brand);text-decoration:underline;font-size:0.8rem;display:inline-block;margin-top:5px">📎 Visualizar / Baixar Anexo</a>`;
       }
    }


    return `<div class="chat-msg ${dir}">
      <strong style="font-size:0.62rem;color:${dir==='outgoing'?'var(--brand)':'var(--text-secondary)'};display:block;margin-bottom:3px">${nome}</strong>
      ${contentHtml}
      <div class="msg-time">${t}</div>
    </div>`;
  }).join('');
  container.scrollTop=container.scrollHeight;
};

window.enviarMsgEquipe = async function() {
  const msg=window._v?_v('chatInputEquipe'):document.getElementById('chatInputEquipe').value; 
  if(!msg) return;
  await J.db.collection('chat_equipe').add({tenantId:J.tid,de:J.fid,para:'admin',sender:'equipe',msg,lidaAdmin:false,lidaEquipe:true,ts:Date.now()});
  if(window._sv) _sv('chatInputEquipe','');
  else document.getElementById('chatInputEquipe').value = '';
};

document.addEventListener('DOMContentLoaded', ()=>{
  const el=document.getElementById('chatInputEquipe');
  if(el) el.addEventListener('keydown',e=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();enviarMsgEquipe();} });
});
