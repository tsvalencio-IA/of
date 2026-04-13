/**
 * ERP MASTER - MÓDULO DE CLIENTES (CRM)
 * Responsável por: Gestão de Clientes, Validações (CPF/CNPJ), ViaCEP e Geração de Credenciais.
 */

window.clientes = {
    // Variável para armazenar a lista de clientes em memória e evitar consultas repetidas
    listaMemoria: [],
    listenerAtivo: null,

    /**
     * Inicializa o módulo (Chamado automaticamente se o core estiver pronto)
     */
    init: function() {
        console.log("[CLIENTES] Módulo de CRM Iniciado.");
        // Aguarda meio segundo para garantir que o Core carregou o Tenant ID
        setTimeout(() => {
            if (window.core && window.core.session.tenantId) {
                this.escutarClientes();
            }
        }, 500);
    },

    /**
     * Listener em Tempo Real do Firebase
     * Mantém a tabela de clientes e o buscador da O.S. sempre atualizados.
     */
    escutarClientes: function() {
        const tenantId = window.core.session.tenantId;
        
        this.listenerAtivo = db.collection("tenants").doc(tenantId).collection("clientes")
            .orderBy("nome", "asc")
            .onSnapshot((snapshot) => {
                this.listaMemoria = [];
                let htmlTabela = "";
                let htmlDatalist = "";

                snapshot.forEach((doc) => {
                    const cli = doc.data();
                    cli.id = doc.id;
                    this.listaMemoria.push(cli);

                    // 1. Constrói as linhas da Tabela de CRM
                    htmlTabela += `
                        <tr>
                            <td class="fw-bold text-white">${cli.nome}</td>
                            <td class="text-warning">${cli.documento || '---'}</td>
                            <td>${cli.telefone}</td>
                            <td class="text-info"><i class="bi bi-person-badge"></i> ${cli.loginWeb || 'Não configurado'}</td>
                            <td class="text-end gestao-only">
                                <button class="btn btn-sm btn-outline-info me-1" onclick="clientes.editarCliente('${cli.id}')" title="Editar"><i class="bi bi-pencil"></i></button>
                                <button class="btn btn-sm btn-outline-success" onclick="clientes.enviarAcessoWhatsApp('${cli.telefone}', '${cli.loginWeb}', '${cli.senhaWeb}')" title="Enviar Senha"><i class="bi bi-whatsapp"></i></button>
                            </td>
                        </tr>
                    `;

                    // 2. Constrói as opções do Datalist (Para a busca na O.S.)
                    // Formato visível: "Nome - Telefone"
                    htmlDatalist += `<option value="${cli.nome} | ${cli.telefone}" data-id="${cli.id}"></option>`;
                });

                // Injeta no HTML se os elementos existirem
                const tbCorpo = document.getElementById("tb-clientes-corpo");
                if (tbCorpo) tbCorpo.innerHTML = htmlTabela || '<tr><td colspan="5" class="text-center text-white-50">Nenhum cliente registado.</td></tr>';

                const datalist = document.getElementById("lista-clientes-dl");
                if (datalist) datalist.innerHTML = htmlDatalist;

            }, (error) => {
                console.error("[CLIENTES] Erro ao carregar base de clientes:", error);
                if(window.ui) window.ui.mostrarToast("Erro", "Falha ao sincronizar clientes.", "danger");
            });
    },

    /**
     * Abre o modal limpo para um Novo Cliente
     */
    abrirModalCliente: function() {
        document.getElementById("form-cliente").reset();
        document.getElementById("cli-id").value = "";
        
        // Gera um PIN aleatório de 6 dígitos para o novo acesso web
        document.getElementById("cli-pass").value = Math.floor(100000 + Math.random() * 900000);
        
        const modal = new bootstrap.Modal(document.getElementById('modal-cliente'));
        modal.show();
    },

    /**
     * Atalho chamado por dentro do Modal de O.S.
     */
    abrirCadastroRapido: function() {
        // Esconde o modal de OS temporariamente (opcional, ou sobrepõe)
        this.abrirModalCliente();
    },

    /**
     * Preenche o modal com os dados para Edição
     */
    editarCliente: function(id) {
        const cli = this.listaMemoria.find(c => c.id === id);
        if (!cli) return;

        document.getElementById("cli-id").value = cli.id;
        document.getElementById("cli-nome").value = cli.nome;
        document.getElementById("cli-doc").value = cli.documento || "";
        document.getElementById("cli-tel").value = cli.telefone;
        document.getElementById("cli-email").value = cli.email || "";
        document.getElementById("cli-user").value = cli.loginWeb || "";
        document.getElementById("cli-pass").value = cli.senhaWeb || Math.floor(100000 + Math.random() * 900000);

        const modal = new bootstrap.Modal(document.getElementById('modal-cliente'));
        modal.show();
    },

    /**
     * Grava ou Atualiza o Cliente no Firebase
     */
    salvarCliente: async function() {
        const id = document.getElementById("cli-id").value;
        const nome = document.getElementById("cli-nome").value.trim();
        const telefone = document.getElementById("cli-tel").value.trim();
        const loginWeb = document.getElementById("cli-user").value.trim();

        // Validações Básicas
        if (!nome || !telefone || !loginWeb) {
            window.ui.mostrarToast("Atenção", "Nome, Telefone e Login Web são obrigatórios.", "warning");
            return;
        }

        const dadosCliente = {
            nome: nome,
            documento: document.getElementById("cli-doc").value.trim(),
            telefone: telefone,
            email: document.getElementById("cli-email").value.trim(),
            loginWeb: loginWeb,
            senhaWeb: document.getElementById("cli-pass").value,
            dataAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
        };

        const tenantId = window.core.session.tenantId;

        try {
            if (id) {
                // Atualizar Existente
                await db.collection("tenants").doc(tenantId).collection("clientes").doc(id).update(dadosCliente);
                window.ui.mostrarToast("Sucesso", "Cliente atualizado com sucesso!", "success");
            } else {
                // Criar Novo
                dadosCliente.dataCadastro = firebase.firestore.FieldValue.serverTimestamp();
                await db.collection("tenants").doc(tenantId).collection("clientes").add(dadosCliente);
                window.ui.mostrarToast("Sucesso", "Novo cliente registado!", "success");
            }

            // Fecha o Modal
            const modalEl = document.getElementById('modal-cliente');
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();

        } catch (error) {
            console.error("[CLIENTES] Erro ao salvar:", error);
            window.ui.mostrarToast("Erro", "Não foi possível guardar o cliente.", "danger");
        }
    },

    /**
     * Formata e valida o CPF ou CNPJ enquanto o utilizador digita ou sai do campo
     */
    validarDoc: function() {
        const input = document.getElementById("cli-doc");
        let valor = input.value.replace(/\D/g, ''); // Remove tudo que não for número

        if (valor.length === 11) {
            // Máscara CPF: 000.000.000-00
            input.value = valor.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
        } else if (valor.length === 14) {
            // Máscara CNPJ: 00.000.000/0000-00
            input.value = valor.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
        } else if (valor.length > 0) {
            window.ui.mostrarToast("Documento Inválido", "O CPF precisa ter 11 números ou o CNPJ 14 números.", "warning");
        }
    },

    /**
     * Busca de Endereço Automática via API ViaCEP (Estrutura pronta para a expansão do teu HTML)
     * Exemplo de uso: onblur="clientes.buscarCep(this.value)"
     */
    buscarCep: async function(cep) {
        const cepLimpo = cep.replace(/\D/g, '');
        if (cepLimpo.length !== 8) return;

        try {
            const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
            const data = await response.json();

            if (data.erro) {
                window.ui.mostrarToast("Atenção", "CEP não encontrado.", "warning");
                return;
            }

            // Se os campos existirem no teu HTML futuro, preenche-os automaticamente
            if(document.getElementById("cli-rua")) document.getElementById("cli-rua").value = data.logradouro;
            if(document.getElementById("cli-bairro")) document.getElementById("cli-bairro").value = data.bairro;
            if(document.getElementById("cli-cidade")) document.getElementById("cli-cidade").value = data.localidade;
            if(document.getElementById("cli-estado")) document.getElementById("cli-estado").value = data.uf;

            window.ui.mostrarToast("Fantástico", "Endereço preenchido automaticamente via satélite.", "info");

        } catch (error) {
            console.error("Erro no ViaCEP:", error);
        }
    },

    /**
     * Monta o link do WhatsApp com as credenciais para o cliente aceder ao Portal Web (B2C)
     */
    enviarAcessoWhatsApp: function(telefone, login, senha) {
        const telLimpo = telefone.replace(/\D/g, '');
        if (!telLimpo || telLimpo.length < 10) {
            window.ui.mostrarToast("Atenção", "Telefone inválido para WhatsApp.", "warning");
            return;
        }

        const empresa = window.core.session.empresaNome || "Nossa Oficina";
        const mensagem = `Olá! O seu acesso ao Portal do Cliente da *${empresa}* está pronto. 🚗🔧\n\nAcompanhe o seu veículo, veja orçamentos e fotos em tempo real:\n\n🌐 *Link:* https://seu-erp-master.com/portal\n👤 *Login:* ${login}\n🔑 *PIN/Senha:* ${senha}\n\nQualquer dúvida, estamos à disposição!`;

        const url = `https://wa.me/55${telLimpo}?text=${encodeURIComponent(mensagem)}`;
        window.open(url, '_blank');
    }
};

// Executa o init após a página carregar
document.addEventListener('DOMContentLoaded', () => {
    // Dá tempo ao core de montar a sessão
    setTimeout(() => {
        if (window.clientes && typeof window.clientes.init === 'function') {
            window.clientes.init();
        }
    }, 1000);
});
