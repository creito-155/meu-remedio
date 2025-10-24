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
    const pagePolitica = document.getElementById('page-politica'); 
    const appContent = document.getElementById('app-content');
    const formLogin = document.getElementById('form-login');
    const formRegisto = document.getElementById('form-registo');
    const authError = document.getElementById('auth-error');
    const linkParaRegisto = document.getElementById('link-para-registo');
    const linkParaLogin = document.getElementById('link-para-login');
    const linkParaPolitica = document.getElementById('link-para-politica');
    const linkParaPoliticaLogin = document.getElementById('link-para-politica-login'); 
    const btnReenviarVerificacao = document.getElementById('btn-reenviar-verificacao');
    const btnVoltarLogin = document.getElementById('btn-voltar-login');
    const btnVoltarAuth = document.getElementById('btn-voltar-auth');
    const listaMedicamentosContainer = document.getElementById('lista-medicamentos-container');
    const formMedicamento = document.getElementById('form-medicamento');
    const fabContainer = document.querySelector('.fab-container');
    const navButtons = document.querySelectorAll('.nav-button');
    const btnSair = document.getElementById('btn-sair');
    
    // Seletores para redimensionamento de imagem
    const fotoUploader = document.getElementById('foto-uploader');
    const fotoResizerCanvas = document.getElementById('foto-resizer');

    let unsubscribe = null;
    let currentUser = null;
    let alertInterval = null;

    // --- FUNÇÕES DE CONTROLO DE UI ---
    const showLoading = () => loadingSpinner.classList.remove('hidden');
    const hideLoading = () => loadingSpinner.classList.add('hidden');

    const showPage = (pageElement) => {
        pageAuth.classList.add('hidden');
        pageVerificacao.classList.add('hidden');
        pagePolitica.classList.add('hidden'); 
        appContent.classList.add('hidden');
        if (pageElement) {
            pageElement.classList.remove('hidden');
        }
    };
    
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
                
                // --- PEDIDO DE PERMISSÃO PARA NOTIFICAÇÕES ---
                if ('Notification' in window) {
                    Notification.requestPermission().then(permission => {
                        if (permission === 'granted') {
                            console.log('Permissão para notificações concedida.');
                        } else {
                            console.warn('Permissão para notificações negada.');
                        }
                    });
                }
                // --- FIM DO PEDIDO DE PERMISSÃO ---

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

    linkParaRegisto.addEventListener('click', (e) => { e.preventDefault(); formLogin.classList.add('hidden'); formRegisto.classList.remove('hidden'); authError.textContent = ''; });
    linkParaLogin.addEventListener('click', (e) => { e.preventDefault(); formRegisto.classList.add('hidden'); formLogin.classList.remove('hidden'); authError.textContent = ''; });
    linkParaPolitica.addEventListener('click', (e) => { e.preventDefault(); showPage(pagePolitica); });
    linkParaPoliticaLogin.addEventListener('click', (e) => { e.preventDefault(); showPage(pagePolitica); });
    btnVoltarAuth.addEventListener('click', (e) => { e.preventDefault(); showPage(pageAuth); }); 
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
    formLogin.addEventListener('submit', async (e) => {
        e.preventDefault(); showLoading(); authError.textContent = '';
        const email = document.getElementById('login-email').value;
        const senha = document.getElementById('login-senha').value;
        try { await auth.signInWithEmailAndPassword(email, senha); }
        catch (error) { authError.textContent = 'E-mail ou senha inválidos.'; hideLoading(); }
    });
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
        medicamentos.sort((a, b) => {
            // Proteção contra dados antigos sem 'criadoEm' na ordenação
            const dateA = a.criadoEm ? a.criadoEm.toDate() : new Date(0);
            const dateB = b.criadoEm ? b.criadoEm.toDate() : new Date(0);
            return dateB - dateA;
        });
        medicamentos.forEach(med => {
            if (!med.criadoEm) { console.warn("Medicamento sem data de criação:", med.id); return; }
            const dataCriacao = med.criadoEm.toDate();
            const dataFinal = new Date(dataCriacao);
            dataFinal.setDate(dataCriacao.getDate() + med.duracao);
            const isAtivo = agora < dataFinal;
            
            const fotoHTML = med.fotoBase64 ? `<img src="${med.fotoBase64}" alt="${med.nome}" class="card-foto">` : ''; 

            const card = document.createElement('div');
            card.className = `medicamento-card ${isAtivo ? '' : 'inativo'}`;
            card.innerHTML = `
                ${fotoHTML} 
                <div class="card-content">
                    <div class="card-info">
                        <h3>${med.nome}</h3>
                        <p><strong>Dose:</strong> ${med.dose}</p>
                        <p><strong>Horários:</strong> ${med.horario}</p>
                        <p><strong>Duração:</strong> ${med.duracao} dia(s)</p>
                    </div>
                    <div class="card-actions">
                        <button class="btn-icon btn-foto" data-id="${med.id}" title="Adicionar/Mudar Foto">
                            <i class="fas fa-camera"></i>
                        </button>
                        <button class="btn-icon btn-editar" data-id="${med.id}" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon btn-excluir" data-id="${med.id}" title="Excluir">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </div>
            `;
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
        const btnFoto = e.target.closest('.btn-foto'); 

        if (btnEditar) {
            const id = btnEditar.dataset.id;
            const doc = await db.collection('medicamentos').doc(id).get();
            if (!doc.exists) {
                alert("Medicamento não encontrado.");
                return;
            }
            const data = doc.data();
            document.getElementById('medicamento-id').value = id; 
            document.getElementById('nome').value = data.nome || ''; // Proteção contra campos inexistentes
            document.getElementById('dose').value = data.dose || ''; 
            document.getElementById('horario').value = data.horario || '';
            document.getElementById('duracao').value = data.duracao || '';
            document.getElementById('form-titulo').innerText = 'Editar Medicamento'; 
            mudarPaginaApp('cadastrar');
        }
        if (btnExcluir) {
            const id = btnExcluir.dataset.id;
            // Usar um pop-up customizado em vez de confirm() seria melhor
            if (confirm('Tem certeza que deseja excluir este medicamento?')) {
                try { 
                    await db.collection('medicamentos').doc(id).delete(); 
                }
                catch (error) { console.error("Erro ao excluir:", error); alert("Erro ao excluir."); }
            }
        }
        if (btnFoto) {
            const id = btnFoto.dataset.id;
            fotoUploader.setAttribute('data-id-medicamento', id);
            fotoUploader.click(); // Abre o seletor de ficheiros/câmera
        }
    });

    // --- LÓGICA DE REDIMENSIONAMENTO E UPLOAD DA FOTO (BASE64) ---
    fotoUploader.addEventListener('change', (e) => {
        const file = e.target.files[0];
        const id = e.target.getAttribute('data-id-medicamento');
        if (!file || !id || !auth.currentUser) return;

        // Limita o tamanho do ficheiro ANTES de processar (ex: 5MB)
        const MAX_FILE_SIZE = 5 * 1024 * 1024; 
        if (file.size > MAX_FILE_SIZE) {
            alert("O ficheiro da foto é muito grande (máximo 5MB).");
            e.target.value = null; // Limpa o input
            return;
        }

        showLoading();
        
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const ctx = fotoResizerCanvas.getContext('2d');
                const MAX_WIDTH = 300; // Largura máxima do thumbnail
                const QUALITY = 0.7; // Qualidade JPEG (0 a 1)
                let width = img.width;
                let height = img.height;
                
                // Calcula novas dimensões mantendo a proporção
                if (width > MAX_WIDTH) {
                    height = (height * MAX_WIDTH) / width;
                    width = MAX_WIDTH;
                }
                
                fotoResizerCanvas.width = width;
                fotoResizerCanvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);
                
                // Converte para Base64 JPEG
                const dataUrl = fotoResizerCanvas.toDataURL('image/jpeg', QUALITY); 
                
                // Verifica o tamanho final do Base64 (aproximadamente, o limite do Firestore é 1MB)
                // 1MB = 1,048,576 bytes. Base64 aumenta o tamanho em ~33%.
                // Vamos ser conservadores e limitar a ~700KB.
                if (dataUrl.length > 1000000 * 0.7) { 
                     alert("A foto é muito grande, mesmo após a compressão. Tente uma foto mais simples ou com menos detalhes.");
                     hideLoading();
                     return;
                }
                
                // Salva o Base64 no Firestore
                db.collection('medicamentos').doc(id).update({
                    fotoBase64: dataUrl 
                }).then(() => {
                    hideLoading();
                    console.log("Thumbnail salvo com sucesso.");
                }).catch(err => {
                    console.error("Erro ao salvar thumbnail:", err);
                    alert("Não foi possível salvar a foto. O tamanho pode ser muito grande.");
                    hideLoading();
                });
            }
            img.onerror = () => {
                 alert("Não foi possível carregar a imagem selecionada. O ficheiro pode estar corrompido ou num formato inválido.");
                 hideLoading();
            }
            img.src = event.target.result; 
        }
        reader.onerror = () => {
            alert("Não foi possível ler o ficheiro selecionado.");
            hideLoading();
        }
        reader.readAsDataURL(file); // Lê o ficheiro como Data URL (Base64)
        
        // Limpa o input para permitir selecionar o mesmo ficheiro novamente se necessário
        e.target.value = null; 
    });


    // --- LÓGICA DE ALERTAS (COM NOTIFICAÇÃO DO SISTEMA) ---
    const containerAlertas = document.getElementById('container-alertas');

    function iniciarVerificacaoAlertas() {
        if(alertInterval) return; // Impede múltiplos intervalos
        const agora = new Date();
        const segundosParaProximoMinuto = 60 - agora.getSeconds();
        // Espera até o início do próximo minuto para começar a verificar
        setTimeout(() => {
            verificarAlertas(); // Verifica imediatamente ao sincronizar
            alertInterval = setInterval(verificarAlertas, 60000); // Verifica a cada 60 segundos
        }, segundosParaProximoMinuto * 1000);
    }

    function verificarAlertas() {
        if (!auth.currentUser || !auth.currentUser.emailVerified) return; // Só verifica se logado e verificado
        
        db.collection('medicamentos').where('uid', '==', auth.currentUser.uid).get().then(snapshot => {
            const agora = new Date();
            const horaAtual = agora.toTimeString().substring(0, 5); // ex: "14:30"
            const agoraMais5 = new Date(agora.getTime() + 5 * 60000); // Adiciona 5 minutos
            const horaPreAlerta = agoraMais5.toTimeString().substring(0, 5);

            snapshot.docs.forEach(doc => {
                const med = { id: doc.id, ...doc.data() };
                if (!med.criadoEm) return; // Proteção contra dados antigos sem timestamp
                
                const dataCriacao = med.criadoEm.toDate();
                const dataFinal = new Date(dataCriacao);
                dataFinal.setDate(dataCriacao.getDate() + med.duracao);
                
                // Só verifica se o tratamento estiver ativo
                if (agora < dataFinal) {
                    const horarios = med.horario.split(',').map(h => h.trim()); // Divide e limpa espaços
                    
                    if (horarios.includes(horaAtual)) {
                        mostrarAlerta(med, 'agora');
                    }
                    if (horarios.includes(horaPreAlerta)) {
                        mostrarAlerta(med, 'pre');
                    }
                }
            });
        }).catch(error => {
            console.error("Erro ao buscar medicamentos para alertas:", error);
        });
    }

    function mostrarAlerta(medicamento, tipo) {
        // ID único para alertas 'agora', mas persistente para pré-alertas
        const idBase = `alerta-${medicamento.id}-${tipo}`;
        // Para alertas 'agora', adiciona timestamp para permitir múltiplos no mesmo minuto se necessário
        const alertaId = tipo === 'agora' ? `${idBase}-${Date.now()}` : idBase; 
        
        // Impede pré-alertas duplicados
        if (tipo === 'pre' && document.getElementById(idBase)) return; 

        // 1. Alerta Visual (Dentro do App)
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
        // Remove automaticamente após 20 segundos
        setTimeout(() => alerta.remove(), 20000);

        // 2. Notificação do Sistema (Som e Vibração)
        const titulo = (tipo === 'agora') ? 'Hora de tomar!' : 'Lembrete (5 min)';
        const corpo = `${medicamento.nome} - Dose: ${medicamento.dose}`;
        
        const options = {
            body: corpo,
            icon: 'img/logo.png', // Usa o logótipo como ícone da notificação
            vibrate: [500, 100, 500], // 500ms vibra, 100ms pausa, 500ms vibra
            tag: idBase // Agrupa notificações (pré-alerta é substituído pelo alerta 'agora')
        };

        // Verifica se tem permissão e se o Service Worker está pronto
        if ('Notification' in window && Notification.permission === 'granted' && 'serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(registration => {
                // Pede ao Service Worker para mostrar a notificação (mais robusto)
                registration.showNotification(titulo, options);
            }).catch(err => {
                 console.error("Falha ao usar SW para notificação, usando fallback:", err);
                 try { new Notification(titulo, options); } catch(e) { console.error("Falha ao criar notificação fallback:", e); }
            });
        } else if ('Notification' in window && Notification.permission === 'granted') {
             // Fallback se o SW não estiver disponível (ex: modo de desenvolvimento)
             try { new Notification(titulo, options); } catch(e) { console.error("Falha ao criar notificação fallback:", e); }
        }
    }
}

