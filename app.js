// --- INICIALIZAÇÃO DO FIREBASE ---
// Estas variáveis serão acessíveis em todo o ficheiro
let auth, db;

// A verificação espera que o firebaseConfig do ficheiro firebase-config.js esteja disponível
if (typeof firebaseConfig !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();
} else {
    // Mostra uma mensagem de erro crítica se a configuração falhar
    document.addEventListener('DOMContentLoaded', () => {
        document.body.innerHTML = '<h1 style="text-align: center; margin-top: 50px; color: red;">Erro Crítico: Ficheiro de configuração do Firebase (firebase-config.js) não encontrado.</h1>';
    });
    console.error("Configuração do Firebase não encontrada.");
}


// --- REGISTO DO SERVICE WORKER (PARA PWA) ---
if ('serviceWorker' in navigator && typeof firebaseConfig !== 'undefined') { // Só regista se o firebase estiver ok
    window.addEventListener('load', () => {
        // Usa um caminho relativo para funcionar no GitHub Pages
        // CORREÇÃO: Removido o hífen de 'service-worker'
        navigator.serviceWorker.register('./service-worker.js')
            .then(registration => {
                console.log('Service Worker registrado com sucesso:', registration);
            })
            .catch(error => {
                console.log('Falha no registro do Service Worker:', error);
            });
    });
}

document.addEventListener('DOMContentLoaded', () => {
    // A verificação para auth e db é importante para não executar código se a inicialização falhou
    if (!auth || !db) {
        console.error("Firebase não inicializado. A aplicação não pode continuar.");
        return; // Interrompe a execução se o Firebase não estiver pronto
    }
    
    // --- SELETORES DE ELEMENTOS ---
    const loadingSpinner = document.getElementById('loading-spinner');
    const pageAuth = document.getElementById('page-auth');
    const pageVerificacao = document.getElementById('page-verificacao');
    const appContent = document.getElementById('app-content');
    
    // Formulários de Autenticação
    const formLogin = document.getElementById('form-login');
    const formRegisto = document.getElementById('form-registo');
    const authError = document.getElementById('auth-error');
    const linkParaRegisto = document.getElementById('link-para-registo');
    const linkParaLogin = document.getElementById('link-para-login');

    // Elementos da Página de Verificação
    const btnReenviarVerificacao = document.getElementById('btn-reenviar-verificacao');
    const btnVoltarLogin = document.getElementById('btn-voltar-login');

    // Elementos Principais do App
    const listaMedicamentosContainer = document.getElementById('lista-medicamentos-container');
    const formMedicamento = document.getElementById('form-medicamento');
    const fabContainer = document.querySelector('.fab-container');
    const navButtons = document.querySelectorAll('.nav-button');
    const btnSair = document.getElementById('btn-sair');

    let unsubscribe = null; // Para 'escutar' as alterações do Firestore
    let currentUser = null; // Para guardar o utilizador atual
    let alertInterval = null; // Para os alertas

    // --- FUNÇÕES DE CONTROLO DE UI ---
    const showLoading = () => loadingSpinner.classList.remove('hidden');
    const hideLoading = () => loadingSpinner.classList.add('hidden');

    const showPage = (pageElement) => {
        // Esconde todas as páginas principais
        pageAuth.classList.add('hidden');
        pageVerificacao.classList.add('hidden');
        appContent.classList.add('hidden');
        // Mostra a página desejada
        if (pageElement) {
            pageElement.classList.remove('hidden');
        }
    };
    
    // Função para trocar de "sub-página" dentro do app
    function mudarPaginaApp(paginaId) {
        document.querySelectorAll('#app-container .page').forEach(page => page.classList.remove('active'));
        const paginaAlvo = document.getElementById(`page-${paginaId}`);
        if (paginaAlvo) paginaAlvo.classList.add('active');
        fabContainer.classList.toggle('hidden', paginaId !== 'listar');
        if (paginaId === 'cadastrar') {
            document.getElementById('form-titulo').innerText = 'Cadastrar Medicamento';
            formMedicamento.reset();
            document.getElementById('medicamento-id').value = '';
        }
    }

    // --- LÓGICA DE AUTENTICAÇÃO ---

    // Observador do estado de autenticação
    auth.onAuthStateChanged(async (user) => {
        currentUser = user; // Atualiza o utilizador atual
        if (user) {
            await user.reload(); // Garante que o estado de verificação do e-mail está atualizado
            if (user.emailVerified) {
                showPage(appContent);
                mudarPaginaApp('listar');
                carregarMedicamentos(user.uid);
                iniciarVerificacaoAlertas(); // Inicia os alertas
            } else {
                showPage(pageVerificacao);
            }
        } else {
            showPage(pageAuth);
            if (unsubscribe) unsubscribe(); // Para de 'escutar' os dados do utilizador anterior
             if(alertInterval){ // Para os alertas
                clearInterval(alertInterval);
                alertInterval = null;
            }
            listaMedicamentosContainer.innerHTML = ''; // Limpa a lista
        }
        hideLoading();
    });

    // Trocar entre formulários de login e registo
    linkParaRegisto.addEventListener('click', (e) => {
        e.preventDefault();
        formLogin.classList.add('hidden');
        formRegisto.classList.remove('hidden');
        authError.textContent = '';
    });
    linkParaLogin.addEventListener('click', (e) => {
        e.preventDefault();
        formRegisto.classList.add('hidden');
        formLogin.classList.remove('hidden');
        authError.textContent = '';
    });

    // Submissão do formulário de registo
    formRegisto.addEventListener('submit', async (e) => {
        e.preventDefault();
        showLoading();
        authError.textContent = '';
        const email = document.getElementById('registo-email').value;
        const senha = document.getElementById('registo-senha').value;
        try {
            const userCredential = await auth.createUserWithEmailAndPassword(email, senha);
            await userCredential.user.sendEmailVerification();
            // Desloga o utilizador para forçá-lo a verificar o e-mail antes de entrar
            await auth.signOut();
            // Mostra a página de verificação
            showPage(pageVerificacao);
        } catch (error) {
            if (error.code === 'auth/email-already-in-use') {
                authError.textContent = 'Este e-mail já está em uso.';
            } else {
                authError.textContent = 'Erro ao criar conta. Tente novamente.';
            }
        } finally {
            hideLoading();
        }
    });

    // Submissão do formulário de login
    formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        showLoading();
        authError.textContent = '';
        const email = document.getElementById('login-email').value;
        const senha = document.getElementById('login-senha').value;
        try {
            await auth.signInWithEmailAndPassword(email, senha);
            // O onAuthStateChanged tratará de redirecionar o utilizador
        } catch (error) {
            authError.textContent = 'E-mail ou senha inválidos.';
            hideLoading(); // Esconde o loading apenas se houver erro
        }
    });

    // Lógica da Página de Verificação
    btnReenviarVerificacao.addEventListener('click', async () => {
        showLoading();
        try {
            if (currentUser) {
                await currentUser.sendEmailVerification();
                alert('E-mail de verificação reenviado!');
            }
        } catch (error) {
            alert('Erro ao reenviar e-mail. Tente novamente mais tarde.');
        } finally {
            hideLoading();
        }
    });
    btnVoltarLogin.addEventListener('click', () => {
        auth.signOut();
    });

    // Sair (Logout)
    btnSair.addEventListener('click', () => {
        auth.signOut();
    });

    // --- LÓGICA PRINCIPAL DO APP (CRUD) ---

    // Navegação interna do app
    navButtons.forEach(button => {
        const pageId = button.getAttribute('data-page');
        if (pageId) {
            button.addEventListener('click', () => mudarPaginaApp(pageId));
        }
    });
    // Adiciona evento ao botão FAB
    document.getElementById('btn-ir-para-cadastro').addEventListener('click', () => {
        mudarPaginaApp('cadastrar');
    });


    function carregarMedicamentos(uid) {
        if (unsubscribe) unsubscribe(); // Cancela a 'escuta' anterior
        
        const consulta = db.collection('medicamentos').where('uid', '==', uid);
        
        unsubscribe = consulta.onSnapshot(snapshot => {
            if (snapshot.empty) {
                listaMedicamentosContainer.innerHTML = '<p class="medicamento-item-placeholder">Nenhum medicamento cadastrado.</p>';
                return;
            }
            const medicamentos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderizarMedicamentos(medicamentos);
        }, error => {
            console.error("Erro ao carregar medicamentos:", error);
            listaMedicamentosContainer.innerHTML = '<p class="medicamento-item-placeholder erro">Não foi possível carregar os medicamentos.</p>';
        });
    }

    function renderizarMedicamentos(medicamentos) {
        listaMedicamentosContainer.innerHTML = '';
        const agora = new Date();
        
        // Ordena por data de criação, do mais recente para o mais antigo
        medicamentos.sort((a, b) => b.criadoEm.toDate() - a.criadoEm.toDate());

        medicamentos.forEach(med => {
            const dataCriacao = med.criadoEm.toDate();
            const dataFinal = new Date(dataCriacao);
            dataFinal.setDate(dataCriacao.getDate() + med.duracao);
            const isAtivo = agora < dataFinal;

            const card = document.createElement('div');
            card.className = `medicamento-card ${isAtivo ? '' : 'inativo'}`;
            card.innerHTML = `
                <div class="card-info">
                    <h3>${med.nome}</h3>
                    <p><strong>Dose:</strong> ${med.dose}</p>
                    <p><strong>Horários:</strong> ${med.horario}</p>
                    <p><strong>Duração:</strong> ${med.duracao} dia(s)</p>
                </div>
                <div class="card-actions">
                    <button class="btn-icon btn-editar" data-id="${med.id}"><i class="fas fa-edit"></i></button>
                    <button class="btn-icon btn-excluir" data-id="${med.id}"><i class="fas fa-trash-alt"></i></button>
                </div>
            `;
            listaMedicamentosContainer.appendChild(card);
        });
    }

    // Submissão do formulário de medicamentos
    formMedicamento.addEventListener('submit', async (e) => {
        e.preventDefault();
        showLoading();
        const id = document.getElementById('medicamento-id').value;
        const uid = auth.currentUser.uid;
        if (!uid) return;

        const dados = {
            uid: uid,
            nome: document.getElementById('nome').value,
            dose: document.getElementById('dose').value,
            horario: document.getElementById('horario').value,
            duracao: parseInt(document.getElementById('duracao').value),
        };

        try {
            if (id) { // Atualiza
                 await db.collection('medicamentos').doc(id).update(dados);
            } else { // Cria
                dados.criadoEm = new Date();
                await db.collection('medicamentos').add(dados);
            }
            mudarPaginaApp('listar');
        } catch (error) {
            console.error("Erro ao salvar medicamento:", error);
            alert("Não foi possível salvar o medicamento.");
        } finally {
            hideLoading();
        }
    });

    // Ações de editar e excluir na lista
    listaMedicamentosContainer.addEventListener('click', async (e) => {
        const btnEditar = e.target.closest('.btn-editar');
        const btnExcluir = e.target.closest('.btn-excluir');

        if (btnEditar) {
            const id = btnEditar.dataset.id;
            const doc = await db.collection('medicamentos').doc(id).get();
            const data = doc.data();
            
            document.getElementById('medicamento-id').value = id;
            document.getElementById('nome').value = data.nome;
            document.getElementById('dose').value = data.dose;
            document.getElementById('horario').value = data.horario;
            document.getElementById('duracao').value = data.duracao;
            document.getElementById('form-titulo').innerText = 'Editar Medicamento';
            mudarPaginaApp('cadastrar');
        }

        if (btnExcluir) {
            const id = btnExcluir.dataset.id;
            if (confirm('Tem certeza que deseja excluir este medicamento?')) {
                try {
                    await db.collection('medicamentos').doc(id).delete();
                } catch (error) {
                    console.error("Erro ao excluir medicamento:", error);
                    alert("Não foi possível excluir o medicamento.");
                }
            }
        }
    });

    // --- LÓGICA DE ALERTAS ---
    const containerAlertas = document.getElementById('container-alertas');
    
    function iniciarVerificacaoAlertas() {
        if(alertInterval) return;
        const agora = new Date();
        const segundosParaProximoMinuto = 60 - agora.getSeconds();
        
        setTimeout(() => {
            verificarAlertas();
            alertInterval = setInterval(verificarAlertas, 60000); // 60 segundos
        }, segundosParaProximoMinuto * 1000);
    }

    function verificarAlertas() {
        if (!auth.currentUser) return;
        
        db.collection('medicamentos').where('uid', '==', auth.currentUser.uid).get().then(snapshot => {
            const medicamentosAtivos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            const agora = new Date();
            const horaAtual = agora.toTimeString().substring(0, 5); // ex: "14:30"
            
            const agoraMais5 = new Date();
            agoraMais5.setMinutes(agora.getMinutes() + 5);
            const horaPreAlerta = agoraMais5.toTimeString().substring(0, 5);

            medicamentosAtivos.forEach(med => {
                const dataCriacao = med.criadoEm.toDate();
                const dataFinal = new Date(dataCriacao);
                dataFinal.setDate(dataCriacao.getDate() + med.duracao);

                // Só verifica se o tratamento estiver ativo
                if (new Date() < dataFinal) {
                    const horarios = med.horario.split(',').map(h => h.trim());
                    
                    if (horarios.includes(horaAtual)) {
                        mostrarAlerta(med, 'agora');
                    }
                    if (horarios.includes(horaPreAlerta)) {
                        mostrarAlerta(med, 'pre');
                    }
                }
            });
        });
    }

    function mostrarAlerta(medicamento, tipo) {
        const alertaId = `alerta-${medicamento.id}-${tipo}`;
        if (document.getElementById(alertaId)) return; // Impede alertas duplicados

        const alerta = document.createElement('div');
        alerta.id = alertaId;
        alerta.className = `alerta alerta-${tipo}`;
        
        alerta.innerHTML = `
            <div class="alerta-header">
                <strong>${tipo === 'agora' ? 'Hora de tomar!' : 'Lembrete'}</strong>
                <button class="btn-fechar-alerta">&times;</button>
            </div>
            <div class="alerta-body">
                <p>${medicamento.nome}</p>
                <p><strong>Dose:</strong> ${medicamento.dose}</p>
            </div>
        `;
        
        containerAlertas.appendChild(alerta);
        
        alerta.querySelector('.btn-fechar-alerta').addEventListener('click', () => alerta.remove());
        
        // Remove o alerta automaticamente após 20 segundos
        setTimeout(() => alerta.remove(), 20000);
    }
});