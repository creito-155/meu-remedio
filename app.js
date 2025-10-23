// --- PONTO DE ENTRADA PRINCIPAL DA APLICAÇÃO ---
// Este evento espera que o HTML esteja pronto
document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Verifica se a configuração do Firebase foi carregada
    if (typeof firebaseConfig === 'undefined') {
        console.error("Configuração do Firebase não encontrada.");
        document.body.innerHTML = '<h1 style="color: red; text-align: center; margin-top: 2rem;">Erro Crítico: Ficheiro de configuração do Firebase (firebase-config.js) não encontrado.</h1>';
        return; // Para a execução
    }

    try {
        // 2. Inicializa o Firebase
        firebase.initializeApp(firebaseConfig);
        const auth = firebase.auth();
        const db = firebase.firestore();
        
        // 3. Se tudo correu bem, inicia a aplicação principal
        runApp(auth, db); 

    } catch (e) {
        console.error("Erro ao inicializar Firebase:", e);
        document.body.innerHTML = '<h1 style="color: red; text-align: center; margin-top: 2rem;">Erro Crítico: Não foi possível inicializar o Firebase. Verifique a consola.</h1>';
    }
});


// --- FUNÇÃO PRINCIPAL DA APLICAÇÃO ---
// Esta função só é chamada DEPOIS de o Firebase estar inicializado
function runApp(auth, db) {
    
    // --- REGISTO DO SERVICE WORKER (PARA PWA) ---
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            // Usa caminho relativo
            navigator.serviceWorker.register('./service-worker.js')
                .then(registration => {
                    console.log('Service Worker registrado com sucesso:', registration);
                })
                .catch(error => {
                    console.log('Falha no registro do Service Worker:', error);
                });
        });
    }

    // --- SELETORES DE ELEMENTOS ---
    const loadingSpinner = document.getElementById('loading-spinner');
    const pageAuth = document.getElementById('page-auth');
    const pageVerificacao = document.getElementById('page-verificacao');
    const pagePolitica = document.getElementById('page-politica'); // Nova página
    const appContent = document.getElementById('app-content');
    
    // Formulários de Autenticação
    const formLogin = document.getElementById('form-login');
    const formRegisto = document.getElementById('form-registo');
    const authError = document.getElementById('auth-error');
    const linkParaRegisto = document.getElementById('link-para-registo');
    const linkParaLogin = document.getElementById('link-para-login');
    const linkParaPolitica = document.getElementById('link-para-politica');
    const linkParaPoliticaLogin = document.getElementById('link-para-politica-login'); // Link na tela de login
    
    // Elementos da Página de Verificação
    const btnReenviarVerificacao = document.getElementById('btn-reenviar-verificacao');
    const btnVoltarLogin = document.getElementById('btn-voltar-login');

    // Elementos da Página de Política
    const btnVoltarAuth = document.getElementById('btn-voltar-auth');
    
    // Elementos Principais do App
    const listaMedicamentosContainer = document.getElementById('lista-medicamentos-container');
    const formMedicamento = document.getElementById('form-medicamento');
    const fabContainer = document.querySelector('.fab-container');
    const navButtons = document.querySelectorAll('.nav-button');
    const btnSair = document.getElementById('btn-sair');

    let unsubscribe = null;
    let currentUser = null;
    let alertInterval = null;

    // --- FUNÇÕES DE CONTROLO DE UI ---
    const showLoading = () => loadingSpinner.classList.remove('hidden');
    const hideLoading = () => loadingSpinner.classList.add('hidden');

    // Controla as páginas de nível superior (Auth, Verificação, Política, App)
    const showPage = (pageElement) => {
        pageAuth.classList.add('hidden');
        pageVerificacao.classList.add('hidden');
        pagePolitica.classList.add('hidden'); // Esconde a política
        appContent.classList.add('hidden');
        if (pageElement) {
            pageElement.classList.remove('hidden');
        }
    };
    
    // Controla as sub-páginas dentro do app (Listar, Cadastrar, Sobre)
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
    auth.onAuthStateChanged(async (user) => {
        currentUser = user;
        if (user) {
            await user.reload();
            if (user.emailVerified) {
                showPage(appContent);
                mudarPaginaApp('listar');
                carregarMedicamentos(user.uid);
                iniciarVerificacaoAlertas();
            } else {
                showPage(pageVerificacao);
            }
        } else {
            showPage(pageAuth);
            if (unsubscribe) unsubscribe();
            if(alertInterval){
                clearInterval(alertInterval);
                alertInterval = null;
            }
            listaMedicamentosContainer.innerHTML = '';
        }
        hideLoading();
    });

    // Navegação nos formulários de autenticação
    linkParaRegisto.addEventListener('click', (e) => { e.preventDefault(); formLogin.classList.add('hidden'); formRegisto.classList.remove('hidden'); authError.textContent = ''; });
    linkParaLogin.addEventListener('click', (e) => { e.preventDefault(); formRegisto.classList.add('hidden'); formLogin.classList.remove('hidden'); authError.textContent = ''; });

    // Navegação para a Política de Privacidade
    linkParaPolitica.addEventListener('click', (e) => { e.preventDefault(); showPage(pagePolitica); });
    linkParaPoliticaLogin.addEventListener('click', (e) => { e.preventDefault(); showPage(pagePolitica); });
    btnVoltarAuth.addEventListener('click', (e) => { e.preventDefault(); showPage(pageAuth); }); // Volta para a tela de autenticação

    // Submissão do formulário de registo
    formRegisto.addEventListener('submit', async (e) => {
        e.preventDefault(); showLoading(); authError.textContent = '';
        const email = document.getElementById('registo-email').value;
        const senha = document.getElementById('registo-senha').value;
        try {
            const userCredential = await auth.createUserWithEmailAndPassword(email, senha);
            await userCredential.user.sendEmailVerification();
            await auth.signOut(); showPage(pageVerificacao);
        } catch (error) {
            authError.textContent = error.code === 'auth/email-already-in-use' ? 'Este e-mail já está em uso.' : 'Erro ao criar conta.';
        } finally { hideLoading(); }
    });

    // Submissão do formulário de login
    formLogin.addEventListener('submit', async (e) => {
        e.preventDefault(); showLoading(); authError.textContent = '';
        const email = document.getElementById('login-email').value;
        const senha = document.getElementById('login-senha').value;
        try { await auth.signInWithEmailAndPassword(email, senha); }
        catch (error) { authError.textContent = 'E-mail ou senha inválidos.'; hideLoading(); }
    });

    // Lógica da Página de Verificação
    btnReenviarVerificacao.addEventListener('click', async () => {
        showLoading();
        try { if (currentUser) await currentUser.sendEmailVerification(); alert('E-mail reenviado!'); }
        catch (error) { alert('Erro ao reenviar.'); }
        finally { hideLoading(); }
    });
    btnVoltarLogin.addEventListener('click', () => { auth.signOut(); });
    btnSair.addEventListener('click', () => { auth.signOut(); });

    // --- LÓGICA PRINCIPAL DO APP (CRUD) ---
    navButtons.forEach(button => {
        const pageId = button.getAttribute('data-page');
        if (pageId) button.addEventListener('click', () => mudarPaginaApp(pageId));
    });
    document.getElementById('btn-ir-para-cadastro').addEventListener('click', () => { mudarPaginaApp('cadastrar'); });

    function carregarMedicamentos(uid) {
        if (unsubscribe) unsubscribe();
        const consulta = db.collection('medicamentos').where('uid', '==', uid);
        unsubscribe = consulta.onSnapshot(snapshot => {
            const medicamentos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderizarMedicamentos(medicamentos);
        }, error => { console.error("Erro ao carregar:", error); listaMedicamentosContainer.innerHTML = '<p class="erro">Erro ao carregar medicamentos.</p>'; });
    }

    function renderizarMedicamentos(medicamentos) {
        listaMedicamentosContainer.innerHTML = '';
        if (medicamentos.length === 0) {
            listaMedicamentosContainer.innerHTML = '<p class="medicamento-item-placeholder">Nenhum medicamento cadastrado.</p>'; return;
        }
        const agora = new Date();
        medicamentos.sort((a, b) => b.criadoEm.toDate() - a.criadoEm.toDate());
        medicamentos.forEach(med => {
            // Proteção contra dados antigos sem 'criadoEm'
            if (!med.criadoEm) {
                console.warn("Medicamento sem data de criação:", med.id);
                return; 
            }
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
                </div>`;
            listaMedicamentosContainer.appendChild(card);
        });
    }

    formMedicamento.addEventListener('submit', async (e) => {
        e.preventDefault(); showLoading();
        const id = document.getElementById('medicamento-id').value;
        const uid = auth.currentUser.uid; if (!uid) return;
        const dados = {
            uid: uid, nome: document.getElementById('nome').value,
            dose: document.getElementById('dose').value, horario: document.getElementById('horario').value,
            duracao: parseInt(document.getElementById('duracao').value),
        };
        try {
            if (id) { 
                // Para atualização, não sobrescrevemos a data de criação
                await db.collection('medicamentos').doc(id).update(dados); 
            }
            else { 
                dados.criadoEm = new Date(); 
                await db.collection('medicamentos').add(dados); 
            }
            mudarPaginaApp('listar');
        } catch (error) { console.error("Erro ao salvar:", error); alert("Erro ao salvar."); }
        finally { hideLoading(); }
    });

    listaMedicamentosContainer.addEventListener('click', async (e) => {
        const btnEditar = e.target.closest('.btn-editar');
        const btnExcluir = e.target.closest('.btn-excluir');
        if (btnEditar) {
            const id = btnEditar.dataset.id;
            const doc = await db.collection('medicamentos').doc(id).get();
            const data = doc.data();
            document.getElementById('medicamento-id').value = id; document.getElementById('nome').value = data.nome;
            document.getElementById('dose').value = data.dose; document.getElementById('horario').value = data.horario;
            document.getElementById('duracao').value = data.duracao;
            document.getElementById('form-titulo').innerText = 'Editar Medicamento'; mudarPaginaApp('cadastrar');
        }
        if (btnExcluir) {
            const id = btnExcluir.dataset.id;
            // Usar um pop-up customizado em vez de confirm()
            if (confirm('Tem certeza que deseja excluir este medicamento?')) {
                try { await db.collection('medicamentos').doc(id).delete(); }
                catch (error) { console.error("Erro ao excluir:", error); alert("Erro ao excluir."); }
            }
        }
    });

    // --- LÓGICA DE ALERTAS ---
    const containerAlertas = document.getElementById('container-alertas');

    function iniciarVerificacaoAlertas() {
        if(alertInterval) return; // Impede múltiplos intervalos
        const agora = new Date();
        const segundosParaProximoMinuto = 60 - agora.getSeconds();
        setTimeout(() => {
            verificarAlertas();
            alertInterval = setInterval(verificarAlertas, 60000);
        }, segundosParaProximoMinuto * 1000);
    }

    function verificarAlertas() {
        if (!auth.currentUser || !auth.currentUser.emailVerified) return;
        db.collection('medicamentos').where('uid', '==', auth.currentUser.uid).get().then(snapshot => {
            const agora = new Date();
            const horaAtual = agora.toTimeString().substring(0, 5);
            const agoraMais5 = new Date(agora.getTime() + 5 * 60000);
            const horaPreAlerta = agoraMais5.toTimeString().substring(0, 5);
            snapshot.docs.forEach(doc => {
                const med = { id: doc.id, ...doc.data() };
                if (!med.criadoEm) return; // Proteção contra dados antigos sem timestamp
                const dataCriacao = med.criadoEm.toDate();
                const dataFinal = new Date(dataCriacao);
                dataFinal.setDate(dataCriacao.getDate() + med.duracao);
                if (agora < dataFinal) {
                    const horarios = med.horario.split(',').map(h => h.trim());
                    if (horarios.includes(horaAtual)) mostrarAlerta(med, 'agora');
                    if (horarios.includes(horaPreAlerta)) mostrarAlerta(med, 'pre');
                }
            });
        });
    }

    function mostrarAlerta(medicamento, tipo) {
        // ID único para alertas 'agora', mas persistente para pré-alertas
        const idBase = `alerta-${medicamento.id}-${tipo}`;
        const alertaId = tipo === 'agora' ? `${idBase}-${Date.now()}` : idBase;
        
        if (tipo === 'pre' && document.getElementById(idBase)) return; // Não mostra pré-alerta duplicado

        const alerta = document.createElement('div');
        alerta.id = alertaId;
        alerta.className = `alerta alerta-${tipo}`;
        alerta.innerHTML = `
            <div class="alerta-header">
                <strong>${tipo === 'agora' ? '<i class="fas fa-bell"></i> Hora de tomar!' : '<i class="fas fa-clock"></i> Lembrete'}</strong>
                <button class="btn-fechar-alerta">&times;</button>
            </div>
            <div class="alerta-body">
                <p>${medicamento.nome}</p>
                <p><strong>Dose:</strong> ${medicamento.dose}</p>
                ${tipo !== 'agora' ? '<p>Faltam 5 minutos.</p>' : ''}
            </div>`;
        containerAlertas.appendChild(alerta);
        alerta.querySelector('.btn-fechar-alerta').addEventListener('click', () => alerta.remove());
        setTimeout(() => alerta.remove(), 20000);
    }
}

