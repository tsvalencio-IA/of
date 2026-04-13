/**
 * JARVIS ERP - NÚCLEO DO SISTEMA (CORE)
 * Responsável por: Inicialização, Autenticação Híbrida e Estado Global (window.J).
 */

// 1. Inicialização do Estado Global
window.J = {
    user: null,         // Dados do usuário logado
    oficina: null,      // Dados da oficina (Tenant)
    clientes: [],       // Array global de clientes
    os: [],             // Array global de Ordens de Serviço
    veiculos: [],       // Array global de veículos
    estoque: [],        // Array global de itens de estoque
    listeners: [],      // Armazena funções de desinscrição do Firebase
    config: {
        isMaster: false // Define se o login é o Master do SaaS
    }
};

// 2. Motor de Autenticação e Verificação de Sessão
const core = {
    /**
     * Inicializa o sistema assim que o DOM está pronto
     */
    init: function() {
        console.log("[CORE] Iniciando motor JARVIS...");
        this.verificarSessao();
    },

    /**
     * Lógica de Verificação de Login (Padrão ts-oficinas)
     * Diferencia Master (Auth) de Equipe (Banco de Dados/PIN)
     */
    verificarSessao: function() {
        // Verifica se há um login de Equipe salvo no LocalStorage primeiro
        const equipeLogada = localStorage.getItem('jarvis_equipe_login');
        
        if (equipeLogada) {
            const dados = JSON.parse(equipeLogada);
            this.autenticarEquipe(dados.login, dados.pin);
        } else {
            // Se não houver equipe, verifica se há um Master logado via Firebase Auth
            firebase.auth().onAuthStateChanged((user) => {
                if (user) {
                    window.J.config.isMaster = true;
                    this.carregarDadosMaster(user.uid);
                } else {
                    console.warn("[CORE] Nenhuma sessão encontrada. Redirecionando...");
                    window.location.href = "index.html";
                }
            });
        }
    },

    /**
     * Autenticação de Equipe (Busca direta no Banco de Dados)
     */
    autenticarEquipe: function(login, pin) {
        db.collectionGroup("funcionarios")
            .where("login", "==", login)
            .where("pin", "==", pin)
            .get()
            .then((querySnapshot) => {
                if (!querySnapshot.empty) {
                    const doc = querySnapshot.docs[0];
                    window.J.user = doc.data();
                    window.J.user.id = doc.id;
                    
                    // A partir do funcionário, achamos a Oficina (Parent)
                    const oficinaRef = doc.ref.parent.parent;
                    oficinaRef.get().then((ofDoc) => {
                        window.J.oficina = ofDoc.data();
                        window.J.oficina.id = ofDoc.id;
                        this.prepararAmbiente();
                    });
                } else {
                    localStorage.removeItem('jarvis_equipe_login');
                    window.location.href = "index.html";
                }
            })
            .catch((error) => {
                console.error("[CORE] Erro ao autenticar equipe:", error);
                window.location.href = "index.html";
            });
    },

    /**
     * Carrega dados para o usuário Master (Dono do SaaS)
     */
    carregarDadosMaster: function(uid) {
        db.collection("oficinas").doc(uid).get().then((doc) => {
            if (doc.exists) {
                window.J.oficina = doc.data();
                window.J.oficina.id = doc.id;
                window.J.user = { nome: "Administrador Master", role: "master" };
                this.prepararAmbiente();
            } else {
                window.location.href = "index.html";
            }
        });
    },

    /**
     * Prepara a interface e inicia as escutas (onSnapshot)
     */
    prepararAmbiente: function() {
        console.log(`[CORE] Ambiente pronto: ${window.J.oficina.nomeFantasia}`);
        
        // Atualiza elementos visuais básicos
        document.getElementById('lbl-empresa-nome').textContent = window.J.oficina.nomeFantasia;
        document.getElementById('lbl-usuario-nome').textContent = window.J.user.nome;

        // Aplica permissões de interface baseadas no cargo
        this.aplicarPermissoes(window.J.user.role);

        // Inicia sincronização em tempo real das coleções
        this.iniciarEscutas();
        
        // Inicializa a UI
        if (window.ui && typeof ui.init === 'function') {
            ui.init();
        }
    },

    /**
     * Gerencia o que cada cargo pode ver (RBAC)
     */
    aplicarPermissoes: function(role) {
        const gestaoElements = document.querySelectorAll('.gestao-only');
        const adminElements = document.querySelectorAll('.admin-only');

        if (role === 'mecanico') {
            gestaoElements.forEach(el => el.classList.add('d-none'));
            adminElements.forEach(el => el.classList.add('d-none'));
        } else if (role === 'gerente') {
            adminElements.forEach(el => el.classList.add('d-none'));
        }
    },

    /**
     * Escutas em Tempo Real (A alma do sistema)
     */
    iniciarEscutas: function() {
        const ofId = window.J.oficina.id;

        // Escuta Ordens de Serviço
        const unsubOS = db.collection("oficinas").doc(ofId).collection("ordens_servico")
            .onSnapshot((snapshot) => {
                window.J.os = [];
                snapshot.forEach(doc => {
                    let data = doc.data();
                    data.id = doc.id;
                    window.J.os.push(data);
                });
                // Notifica o módulo de OS para redesenhar o Kanban
                if (window.os && typeof os.renderizarKanban === 'function') {
                    os.renderizarKanban();
                }
            });

        // Escuta Clientes
        const unsubClientes = db.collection("oficinas").doc(ofId).collection("clientes")
            .onSnapshot((snapshot) => {
                window.J.clientes = [];
                snapshot.forEach(doc => {
                    let data = doc.data();
                    data.id = doc.id;
                    window.J.clientes.push(data);
                });
            });

        window.J.listeners.push(unsubOS, unsubClientes);
    },

    /**
     * Logout Seguro
     */
    sair: function() {
        localStorage.removeItem('jarvis_equipe_login');
        firebase.auth().signOut().then(() => {
            window.location.href = "index.html";
        });
    }
};

// Acionamento automático do Core
core.init();
