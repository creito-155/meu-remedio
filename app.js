// --- REGISTO DO SERVICE WORKER (PWA) ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
            .then(reg => console.log('Service Worker registrado com sucesso:', reg))
            .catch(err => console.error('Erro ao registrar Service Worker:', err));
    });
}

// Variáveis globais e de elementos
let currentUserId = null;
let unsubscribeFirestore = null;
const loadingSpinner = document.getElementById('loading-spinner');
const authPage = document.getElementById('page-auth');
const appContent = document.getElementById('app-content');

// --- CONTROLO PRINCIPAL DA APLICAÇÃO (BASEADO NA AUTENTICAÇÃO) ---
auth.onAuthStateChanged(user => {
    loadingSpinner.classList.add('hidden'); // Esconde o spinner assim que o estado é conhecido

    if (user) {
        // --- UTILIZADOR AUTENTICADO ---
        console.log("Utilizador autenticado:", user.uid);
        currentUserId = user.uid;
        
        authPage.classList.add('hidden');
        appContent.classList.remove('hidden');
        
        initializeAppLogic();

    } else {
        // --- UTILIZADOR NÃO AUTENTICADO ---
        console.log("Nenhum utilizador autenticado.");
        currentUserId = null;

        authPage.classList.remove('hidden');
        appContent.classList.add('hidden');
        
        if (unsubscribeFirestore) {
            unsubscribeFirestore();
            console.log("Subscrição do Firestore cancelada.");
        }
    }
});


// --- LÓGICA DE AUTENTICAÇÃO (LOGIN, REGISTO, SAIR) ---
const formLogin = document.getElementById('form-login');
const formRegisto = document.getElementById('form-registo');
const linkParaRegisto = document.getElementById('link-para-registo');
const linkParaLogin = document.getElementById('link-para-login');
const authError = document.getElementById('auth-error');

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

formLogin.addEventListener('submit', (e) => {
    e.preventDefault();
    loadingSpinner.classList.remove('hidden'); // Mostra o spinner
    const email = document.getElementById('login-email').value;
    const senha = document.getElementById('login-senha').value;
    
    auth.signInWithEmailAndPassword(email, senha)
        .catch(error => {
            console.error("Erro de login:", error.code);
            authError.textContent = "Email ou senha inválidos.";
            loadingSpinner.classList.add('hidden'); // Esconde em caso de erro
        });
});

formRegisto.addEventListener('submit', (e) => {
    e.preventDefault();
    loadingSpinner.classList.remove('hidden'); // Mostra o spinner
    const email = document.getElementById('registo-email').value;
    const senha = document.getElementById('registo-senha').value;

    auth.createUserWithEmailAndPassword(email, senha)
        .catch(error => {
            console.error("Erro de registo:", error.code);
            if (error.code === 'auth/weak-password') {
                authError.textContent = "A senha é muito fraca.";
            } else if (error.code === 'auth/email-already-in-use') {
                authError.textContent = "Este email já está em uso.";
            } else {
                authError.textContent = "Ocorreu um erro ao criar a conta.";
            }
            loadingSpinner.classList.add('hidden'); // Esconde em caso de erro
        });
});

document.getElementById('btn-sair').addEventListener('click', () => {
    auth.signOut();
});


// --- FUNÇÃO PARA INICIAR A LÓGICA DO APP APÓS LOGIN ---
function initializeAppLogic() {
    
    const navButtons = document.querySelectorAll('[data-page]');
    const fabContainer = document.querySelector('.fab-container');

    function mudarPagina(paginaId) {
        document.querySelectorAll('#app-container .page').forEach(page => {
            page.classList.remove('active');
        });
        
        const paginaAlvo = document.getElementById(`page-${paginaId}`);
        if (paginaAlvo) {
            paginaAlvo.classList.add('active');
        }

        if (paginaId === 'listar') {
            fabContainer.classList.remove('hidden');
        } else {
            fabContainer.classList.add('hidden');
        }

        if (paginaId === 'cadastrar') {
            document.getElementById('form-titulo').innerText = 'Cadastrar Medicamento';
            document.getElementById('form-medicamento').reset();
            document.getElementById('medicamento-id').value = '';
        }
    }

    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            const paginaId = button.getAttribute('data-page');
            mudarPagina(paginaId);
        });
    });

    const formMedicamento = document.getElementById('form-medicamento');

    formMedicamento.addEventListener('submit', async (event) => {
        event.preventDefault();
        
        const medicamento = {
            nome: document.getElementById('nome').value,
            dose: document.getElementById('dose').value,
            horario: document.getElementById('horario').value,
            duracao: parseInt(document.getElementById('duracao').value),
            criadoEm: new Date()
        };
        const medicamentoId = document.getElementById('medicamento-id').value;
        const collectionRef = db.collection('users').doc(currentUserId).collection('medicamentos');

        try {
            if (medicamentoId) {
                await collectionRef.doc(medicamentoId).update(medicamento);
                alert("Medicamento atualizado com sucesso!");
            } else {
                await collectionRef.add(medicamento);
                alert("Medicamento salvo com sucesso!");
            }
            formMedicamento.reset();
            mudarPagina('listar');
        } catch (error) {
            console.error("Erro ao salvar medicamento: ", error);
            alert("Erro ao salvar. Tente novamente.");
        }
    });

    const listaContainer = document.getElementById('lista-medicamentos-container');
    const collectionRef = db.collection('users').doc(currentUserId).collection('medicamentos');

    unsubscribeFirestore = collectionRef.onSnapshot(snapshot => {
        if (snapshot.empty) {
            listaContainer.innerHTML = '<p class="medicamento-item-placeholder">Nenhum medicamento cadastrado.</p>';
            return;
        }

        let html = '';
        snapshot.forEach(doc => {
            const med = doc.data();
            const id = doc.id;

            const criadoEm = med.criadoEm.toDate();
            const dataFinal = new Date(criadoEm);
            dataFinal.setDate(criadoEm.getDate() + med.duracao);
            const hoje = new Date();
            const inativo = hoje > dataFinal;

            html += `
                <div class="medicamento-card ${inativo ? 'inativo' : ''}" data-id="${id}">
                    <div class="card-info">
                        <h3>${med.nome}</h3>
                        <p><strong>Dose:</strong> ${med.dose}</p>
                        <p><strong>Horários:</strong> ${med.horario}</p>
                        <p><strong>Duração:</strong> ${med.duracao} dias</p>
                    </div>
                    <div class="card-actions">
                        <button class="btn-icon btn-editar"><i class="fas fa-pencil-alt"></i></button>
                        <button class="btn-icon btn-excluir"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            `;
        });
        listaContainer.innerHTML = html;
    }, error => {
        console.error("Erro ao carregar medicamentos:", error);
        listaContainer.innerHTML = '<p class="medicamento-item-placeholder">Erro ao carregar dados. Verifique sua conexão.</p>';
    });

    listaContainer.addEventListener('click', async (e) => {
        const card = e.target.closest('.medicamento-card');
        if (!card) return;
        const id = card.dataset.id;
        const collectionRef = db.collection('users').doc(currentUserId).collection('medicamentos');

        if (e.target.closest('.btn-excluir')) {
            if (confirm("Tem a certeza que deseja excluir este medicamento?")) {
                await collectionRef.doc(id).delete();
            }
        }

        if (e.target.closest('.btn-editar')) {
            const doc = await collectionRef.doc(id).get();
            const med = doc.data();
            
            document.getElementById('form-titulo').innerText = 'Editar Medicamento';
            document.getElementById('medicamento-id').value = id;
            document.getElementById('nome').value = med.nome;
            document.getElementById('dose').value = med.dose;
            document.getElementById('horario').value = med.horario;
            document.getElementById('duracao').value = med.duracao;
            mudarPagina('cadastrar');
        }
    });

    function mostrarAlerta(medicamento, tipo) {
        const container = document.getElementById('container-alertas');
        const div = document.createElement('div');
        div.classList.add('alerta');

        if (tipo === 'agora') {
            div.classList.add('alerta-agora');
            div.innerHTML = `
                <div class="alerta-header">
                    <strong><i class="fas fa-bell"></i> Hora de tomar!</strong>
                    <button class="btn-fechar-alerta">&times;</button>
                </div>
                <div class="alerta-body">
                    <p><strong>${medicamento.nome}</strong> - ${medicamento.dose}</p>
                </div>`;
        } else {
            div.classList.add('alerta-pre');
            div.innerHTML = `
                <div class="alerta-header">
                    <strong><i class="fas fa-clock"></i> Lembrete</strong>
                    <button class="btn-fechar-alerta">&times;</button>
                </div>
                <div class="alerta-body">
                    <p>Faltam 5 minutos para <strong>${medicamento.nome}</strong>.</p>
                </div>`;
        }
        
        container.appendChild(div);
        div.querySelector('.btn-fechar-alerta').addEventListener('click', () => div.remove());
        setTimeout(() => div.remove(), 10000);
    }

    function verificarAlertas() {
        const agora = new Date();
        const horaAtual = agora.toTimeString().substring(0, 5);
        const agoraMais5 = new Date(agora.getTime() + 5 * 60000);
        const horaMais5 = agoraMais5.toTimeString().substring(0, 5);

        console.log(`Verificando: Hora atual "${horaAtual}", Pré-alerta para "${horaMais5}"`);

        const collectionRef = db.collection('users').doc(currentUserId).collection('medicamentos');
        collectionRef.get().then(snapshot => {
            snapshot.forEach(doc => {
                const med = doc.data();
                const criadoEm = med.criadoEm.toDate();
                const dataFinal = new Date(criadoEm);
                dataFinal.setDate(criadoEm.getDate() + med.duracao);
                if (new Date() > dataFinal) return;
                
                const horarios = med.horario.split(',').map(h => h.trim());
                if (horarios.includes(horaAtual)) {
                    mostrarAlerta(med, 'agora');
                }
                if (horarios.includes(horaMais5)) {
                    mostrarAlerta(med, 'pre');
                }
            });
        });
    }

    function iniciarVerificadorDeAlertas() {
        const segundosParaProximoMinuto = 60 - new Date().getSeconds();
        console.log(`Sincronizando alertas... Próxima verificação em ${segundosParaProximoMinuto} segundos.`);
        setTimeout(() => {
            verificarAlertas();
            setInterval(verificarAlertas, 60000);
        }, segundosParaProximoMinuto * 1000);
    }

    mudarPagina('listar');
    iniciarVerificadorDeAlertas();
}

