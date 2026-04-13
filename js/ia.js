/**
 * ERP MASTER - MÓDULO DE INTELIGÊNCIA ARTIFICIAL (J.A.R.V.I.S / RAG)
 * Responsável por: Comunicação com Google Gemini, Injeção de Contexto da Oficina e Ditado por Voz.
 */

window.ia = {
    // ATENÇÃO: Num ambiente de produção real, esta chave deve vir do backend. 
    // Para a nossa arquitetura SaaS Front-end, vamos armazená-la no documento do Tenant.
    // Aqui usamos uma constante para facilitar a tua implementação inicial.
    GEMINI_API_KEY: "COLOQUE_AQUI_A_SUA_CHAVE_GEMINI", 
    
    chatHistory: [], // Mantém o histórico da conversa atual
    contextoOficina: "", // Guarda o resumo do pátio e manuais

    /**
     * Inicializa o Módulo de IA
     */
    init: function() {
        console.log("[I.A.] Módulo de Inteligência Artificial Iniciado.");
        setTimeout(() => {
            if (window.core && window.core.session.tenantId) {
                this.prepararMenteIA();
            }
        }, 2000); // Aguarda 2s para não sobrecarregar o arranque do sistema
    },

    /**
     * Constrói a "Mente" da IA: Recolhe os dados do Pátio e os Manuais do Firebase
     */
    prepararMenteIA: async function() {
        const tenantId = window.core.session.tenantId;
        let baseConhecimento = "";
        let resumoPatio = "";

        try {
            // 1. Vai buscar a Base de Conhecimento (Manuais, Dicas, PDFs lidos)
            const docsConhecimento = await db.collection("tenants").doc(tenantId).collection("conhecimento_ia").get();
            docsConhecimento.forEach(doc => {
                baseConhecimento += `\n[MANUAL: ${doc.data().titulo}] - ${doc.data().conteudo}`;
            });

            // 2. Vai buscar um resumo dos carros que estão no pátio atualmente
            const docsPatio = await db.collection("tenants").doc(tenantId).collection("ordens_servico")
                .where("status", "!=", "entregue").get();
            
            docsPatio.forEach(doc => {
                const os = doc.data();
                resumoPatio += `\n- Placa: ${os.placa} | Veículo: ${os.veiculo} | Status: ${os.status} | Queixa: ${os.queixa}`;
            });

            // Monta o Contexto Final que será enviado invisivelmente para a API
            this.contextoOficina = `
                --- BASE DE CONHECIMENTO TÉCNICO DA OFICINA ---
                ${baseConhecimento ? baseConhecimento : "Nenhum manual técnico injetado ainda."}

                --- VEÍCULOS ATUALMENTE NO PÁTIO ---
                ${resumoPatio ? resumoPatio : "O pátio está vazio neste momento."}
            `;

            console.log("[I.A.] Mente preparada com o contexto da oficina.");

            // Constrói a interface de Chat na secção correspondente
            this.renderizarInterfaceChat();

        } catch (error) {
            console.error("[I.A.] Erro ao preparar mente da IA:", error);
        }
    },

    /**
     * Constrói o HTML do Chat dentro da secção "sec-ia"
     */
    renderizarInterfaceChat: function() {
        const container = document.getElementById("sec-ia");
        if (!container) return;

        container.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-3">
                <div>
                    <h4 class="text-white fw-bold mb-0"><i class="bi bi-robot text-info"></i> Consultor J.A.R.V.I.S</h4>
                    <p class="text-white-50 small mb-0">Especialista Técnico Automotivo baseado no Google Gemini.</p>
                </div>
                <button class="btn btn-outline-warning btn-sm gestao-only" onclick="ia.abrirModalTreinamento()">
                    <i class="bi bi-database-add"></i> Ensinar Manuais (RAG)
                </button>
            </div>

            <div class="card bg-black border-secondary flex-grow-1 d-flex flex-column">
                <div class="card-body overflow-y-auto" id="ia-chat-box" style="height: 400px; scroll-behavior: smooth;">
                    <div class="d-flex mb-3">
                        <div class="bg-dark border border-info rounded-3 p-3 ms-auto w-75">
                            <strong class="text-info"><i class="bi bi-cpu"></i> J.A.R.V.I.S</strong>
                            <p class="mb-0 text-white mt-1">Olá, ${window.core.session.nome}! A minha base de dados está atualizada com os veículos do nosso pátio. Pode perguntar-me sobre binários de aperto, esquemas elétricos ou pedir conselhos de gestão da oficina. Em que posso ajudar?</p>
                        </div>
                    </div>
                </div>

                <div class="card-footer bg-darker border-secondary p-3">
                    <div class="input-group">
                        <button class="btn btn-danger" type="button" onclick="ia.ouvirMicrofone()" id="btn-ia-mic" title="Ditar Pergunta">
                            <i class="bi bi-mic-fill"></i>
                        </button>
                        <input type="text" class="form-control bg-black text-white border-secondary" id="ia-input-msg" placeholder="Escreva a sua dúvida técnica aqui..." onkeypress="if(event.key === 'Enter') ia.enviarMensagem()">
                        <button class="btn btn-info fw-bold" type="button" onclick="ia.enviarMensagem()" id="btn-ia-enviar">
                            <i class="bi bi-send-fill"></i> Enviar
                        </button>
                    </div>
                </div>
            </div>
            
            <div class="modal fade" id="modal-treinar-ia" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content bg-dark border-warning">
                        <div class="modal-header bg-black border-secondary">
                            <h5 class="modal-title text-warning fw-bold"><i class="bi bi-brain"></i> Injetar Conhecimento (RAG)</h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body p-4">
                            <p class="text-white-50 small">Cole aqui textos de manuais de reparação (ex: Tabela de binários da Correia Dentada do motor TSI). A IA vai ler e memorizar esta informação para usar nas próximas respostas da equipa.</p>
                            <input type="text" id="ia-titulo-manual" class="form-control bg-black text-white border-secondary mb-3" placeholder="Título. Ex: Ponto do Motor VW EA211">
                            <textarea id="ia-texto-manual" class="form-control bg-black text-white border-secondary" rows="8" placeholder="Cole o texto técnico do manual aqui..."></textarea>
                        </div>
                        <div class="modal-footer bg-black border-secondary">
                            <button type="button" class="btn btn-warning fw-bold text-dark w-100" onclick="ia.salvarConhecimento()"><i class="bi bi-save"></i> Guardar na Memória da Oficina</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Limpa o histórico de chat ao carregar a interface
        this.chatHistory = [];
        this.adicionarPromptMestreAoHistorico();
    },

    /**
     * O "Prompt Mestre" - Define a personalidade e as regras rigorosas da IA
     */
    adicionarPromptMestreAoHistorico: function() {
        const promptMestre = `
            És o J.A.R.V.I.S, a Autoridade Técnica Suprema deste ERP de Gestão de Oficinas Automóveis.
            
            A TUA IDENTIDADE (Protocolo Camaleão):
            1. [O ENGENHEIRO]: Dominas a física, química e eletrónica. Conheces torques, diagramas e esquemas elétricos.
            2. [O MESTRE DE OFICINA]: Tens 30 anos de experiência com "graxa na mão". Sabes que o scanner mente às vezes e dás dicas de ouro.
            3. [O GESTOR/DONO]: Focado em lucro. Detestas retorno em garantia. Recomendas sempre peças originais ou de primeira linha para evitar dor de cabeça.
            4. [O CONSULTOR]: Sabes explicar problemas complexos para um cliente leigo aprovar o orçamento.

            INSTRUÇÕES CRÍTICAS:
            - Nunca inventes informações que não saibas (Alucinação zero).
            - Baseia-te SEMPRE no contexto da oficina fornecido abaixo para responder sobre carros que estão na oficina.
            - Responde com formatação em HTML básico (uso de <b>, <br>, <ul>, <li>) para que a interface consiga ler de forma bonita. Nada de Markdown (***).

            AQUI ESTÁ O TEU CONTEXTO REAL NESTE MOMENTO (Lê com atenção):
            ${this.contextoOficina}
        `;

        // O Gemini exige formato de roles: "user" e "model"
        this.chatHistory.push({
            role: "user",
            parts: [{ text: promptMestre }]
        });
        
        // Simula que a IA aceitou as regras
        this.chatHistory.push({
            role: "model",
            parts: [{ text: "Entendido. Protocolo Camaleão ativo e Contexto RAG carregado. Aguardando comandos da equipa técnica." }]
        });
    },

    /**
     * Processa a mensagem do utilizador e envia para a API
     */
    enviarMensagem: async function() {
        const input = document.getElementById("ia-input-msg");
        const texto = input.value.trim();
        const btnEnviar = document.getElementById("btn-ia-enviar");

        if (!texto) return;

        // 1. Adiciona a pergunta do utilizador no ecrã
        this.desenharBalao(texto, 'user');
        input.value = "";
        
        // 2. Bloqueia os botões enquanto pensa
        input.disabled = true;
        btnEnviar.disabled = true;
        btnEnviar.innerHTML = '<i class="bi bi-arrow-repeat spin-icon"></i> Pensando...';

        // 3. Adiciona a pergunta ao histórico lógico
        this.chatHistory.push({
            role: "user",
            parts: [{ text: texto }]
        });

        // 4. Chama a API do Google Gemini
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${this.GEMINI_API_KEY}`;
            
            const resposta = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: this.chatHistory })
            });

            const dados = await resposta.json();

            if (dados.error) {
                throw new Error(dados.error.message);
            }

            const textoIA = dados.candidates[0].content.parts[0].text;
            
            // 5. Adiciona a resposta da IA ao histórico lógico
            this.chatHistory.push({
                role: "model",
                parts: [{ text: textoIA }]
            });

            // 6. Desenha a resposta no ecrã
            this.desenharBalao(textoIA, 'ia');

        } catch (error) {
            console.error("[I.A.] Erro na API Gemini:", error);
            this.desenharBalao("Desculpe, ocorreu uma falha de comunicação com o satélite (API). Verifique a chave do Gemini ou a ligação à internet.", 'erro');
        } finally {
            // 7. Restaura a interface
            input.disabled = false;
            btnEnviar.disabled = false;
            btnEnviar.innerHTML = '<i class="bi bi-send-fill"></i> Enviar';
            input.focus();
        }
    },

    /**
     * Desenha os balões de conversa no ecrã
     */
    desenharBalao: function(texto, quem) {
        const chatBox = document.getElementById("ia-chat-box");
        let htmlBalao = "";

        if (quem === 'user') {
            htmlBalao = `
                <div class="d-flex mb-3">
                    <div class="bg-primary bg-opacity-25 border border-primary rounded-3 p-3 w-75">
                        <strong class="text-primary"><i class="bi bi-person"></i> ${window.core.session.nome}</strong>
                        <p class="mb-0 text-white mt-1">${texto}</p>
                    </div>
                </div>
            `;
        } else if (quem === 'ia') {
            // Formata o texto Markdown (que o Gemini costuma enviar mesmo pedindo HTML) para HTML básico
            let textoFormatado = texto.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>') // Negrito
                                      .replace(/\*(.*?)\*/g, '<i>$1</i>')     // Itálico
                                      .replace(/\n/g, '<br>');                // Quebras de linha

            htmlBalao = `
                <div class="d-flex mb-3">
                    <div class="bg-dark border border-info rounded-3 p-3 ms-auto w-75 shadow">
                        <strong class="text-info"><i class="bi bi-cpu"></i> J.A.R.V.I.S</strong>
                        <p class="mb-0 text-light mt-2" style="line-height: 1.6;">${textoFormatado}</p>
                    </div>
                </div>
            `;
        } else {
            // Erro
            htmlBalao = `
                <div class="d-flex mb-3 text-center w-100 justify-content-center">
                    <span class="badge bg-danger p-2"><i class="bi bi-exclamation-triangle"></i> ${texto}</span>
                </div>
            `;
        }

        chatBox.insertAdjacentHTML('beforeend', htmlBalao);
        chatBox.scrollTop = chatBox.scrollHeight; // Faz scroll para o fundo automaticamente
    },

    /**
     * Reconhecimento de Voz Nativo para o Chat (Push-to-Talk)
     */
    ouvirMicrofone: function() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            window.ui.mostrarToast("Erro", "Reconhecimento de voz não suportado neste navegador.", "danger");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'pt-PT'; // Adaptado para Português de Portugal
        const btnMic = document.getElementById("btn-ia-mic");
        const input = document.getElementById("ia-input-msg");

        btnMic.classList.replace("btn-danger", "btn-warning");
        input.placeholder = "A ouvir a sua voz...";

        recognition.start();

        recognition.onresult = (event) => {
            const transcricao = event.results[0][0].transcript;
            input.value = transcricao;
        };

        recognition.onend = () => {
            btnMic.classList.replace("btn-warning", "btn-danger");
            input.placeholder = "Escreva a sua dúvida técnica aqui...";
            if (input.value) {
                this.enviarMensagem(); // Envia automaticamente após parar de falar
            }
        };

        recognition.onerror = (event) => {
            console.error("[I.A.] Erro no microfone:", event.error);
            btnMic.classList.replace("btn-warning", "btn-danger");
            window.ui.mostrarToast("Atenção", "Não consegui ouvir o seu áudio.", "warning");
        };
    },

    /**
     * ================= RAG: ALIMENTAR A BASE DE DADOS =================
     */
    abrirModalTreinamento: function() {
        const modal = new bootstrap.Modal(document.getElementById('modal-treinar-ia'));
        modal.show();
    },

    salvarConhecimento: async function() {
        const titulo = document.getElementById("ia-titulo-manual").value.trim();
        const texto = document.getElementById("ia-texto-manual").value.trim();
        const tenantId = window.core.session.tenantId;

        if (!titulo || !texto) {
            window.ui.mostrarToast("Atenção", "Título e Texto são obrigatórios para ensinar a IA.", "warning");
            return;
        }

        try {
            await db.collection("tenants").doc(tenantId).collection("conhecimento_ia").add({
                titulo: titulo,
                conteudo: texto,
                dataInjecao: firebase.firestore.FieldValue.serverTimestamp(),
                inseridoPor: window.core.session.nome
            });

            window.ui.mostrarToast("Sucesso", "Conhecimento injetado no Cérebro do J.A.R.V.I.S!", "success");
            
            // Recarrega a mente da IA para incluir o novo manual
            this.prepararMenteIA();

            const modalEl = document.getElementById('modal-treinar-ia');
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();

            document.getElementById("ia-titulo-manual").value = "";
            document.getElementById("ia-texto-manual").value = "";

        } catch (error) {
            console.error("[I.A.] Erro ao guardar conhecimento:", error);
            window.ui.mostrarToast("Erro", "Falha ao gravar na memória.", "danger");
        }
    }
};

// Auto-Init
document.addEventListener('DOMContentLoaded', () => {
    if (window.ia && typeof window.ia.init === 'function') {
        window.ia.init();
    }
});
