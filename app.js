// --- ALUNO 9 (PWA): Registo do Service Worker ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => {
                console.log('Service Worker registado com sucesso:', registration);
            })
            .catch(error => {
                console.log('Falha ao registar o Service Worker:', error);
            });
    });
}

document.addEventListener('DOMContentLoaded', () => {
    
    let medicamentosAtuais = [];

    // --- NAVEGAÇÃO ENTRE PÁGINAS ---
    function mudarPagina(paginaId) {
        const fabContainer = document.getElementById('fab-container');
        
        document.querySelectorAll('.page').forEach(page => {
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
            document.getElementById('form-titulo').innerText = 'Registar Medicamento';
            document.getElementById('form-medicamento').reset();
            document.getElementById('medicamento-id').value = '';
        }
    }
    
    document.querySelectorAll('[data-page]').forEach(button => {
        button.addEventListener('click', () => {
            const paginaId = button.getAttribute('data-page');
            mudarPagina(paginaId);
        });
    });
    // --- FIM DA NAVEGAÇÃO ---

    
    // --- ALUNO 3 & 5 (Formulário para Criar e Atualizar) ---
    const form = document.getElementById('form-medicamento');
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        
        const nome = document.getElementById('nome').value;
        const dose = document.getElementById('dose').value;
        const horario = document.getElementById('horario').value;
        const duracao = document.getElementById('duracao').value;
        const id = document.getElementById('medicamento-id').value;
        
        if (!nome || !dose || !horario || !duracao) {
            alert("Por favor, preencha todos os campos obrigatórios.");
            return;
        }

        const medicamento = {
            nome: nome,
            dose: dose,
            horario: horario,
            duracao: parseInt(duracao),
        };

        try {
            if (id) {
                await db.collection('medicamentos').doc(id).update(medicamento);
                alert("Medicamento atualizado com sucesso!");
            } else {
                medicamento.criadoEm = new Date();
                await db.collection('medicamentos').add(medicamento);
                alert("Medicamento salvo com sucesso!");
            }
            form.reset();
            mudarPagina('listar');
        } catch (error) {
            console.error("Erro ao salvar o documento: ", error);
            alert("Erro ao salvar. Tente novamente.");
        }
    });

    // --- ALUNO 5 & 6 (Listagem, Edição e Exclusão) ---
    const containerLista = document.getElementById('lista-medicamentos-container');
    containerLista.addEventListener('click', async (event) => {
        const target = event.target;
        const card = target.closest('.medicamento-card');
        if (!card) return;

        const id = card.getAttribute('data-id');

        if (target.closest('.btn-excluir')) {
            if (confirm("Tem a certeza que deseja excluir este medicamento?")) {
                try {
                    await db.collection('medicamentos').doc(id).delete();
                } catch (error) { console.error("Erro ao excluir:", error); }
            }
        }

        if (target.closest('.btn-editar')) {
            try {
                const doc = await db.collection('medicamentos').doc(id).get();
                if (doc.exists) {
                    const data = doc.data();
                    document.getElementById('medicamento-id').value = id;
                    document.getElementById('nome').value = data.nome;
                    document.getElementById('dose').value = data.dose;
                    document.getElementById('horario').value = data.horario;
                    document.getElementById('duracao').value = data.duracao;
                    document.getElementById('form-titulo').innerText = 'Editar Medicamento';
                    mudarPagina('cadastrar');
                }
            } catch (error) { console.error("Erro ao buscar para editar:", error); }
        }
    });

    function carregarMedicamentos() {
        db.collection('medicamentos').orderBy('criadoEm', 'desc').onSnapshot(snapshot => {
            medicamentosAtuais = [];
            containerLista.innerHTML = ''; 
            
            if (snapshot.empty) {
                containerLista.innerHTML = `<div class="medicamento-item-placeholder"><p>Nenhum medicamento registado ainda.</p></div>`;
                return;
            }

            snapshot.forEach(doc => {
                const medicamento = doc.data();
                const id = doc.id;
                
                let isInativo = false;
                if (medicamento.criadoEm && medicamento.duracao) {
                    const dataInicio = medicamento.criadoEm.toDate(); 
                    const dataFim = new Date(dataInicio);
                    dataFim.setDate(dataInicio.getDate() + medicamento.duracao);
                    
                    const hoje = new Date();
                    hoje.setHours(0, 0, 0, 0);

                    if (hoje > dataFim) {
                        isInativo = true;
                    }
                }
                
                medicamentosAtuais.push({ id, ...medicamento, isInativo });

                const card = document.createElement('div');
                card.className = 'medicamento-card';
                if (isInativo) {
                    card.classList.add('inativo');
                }

                card.setAttribute('data-id', id);
                card.innerHTML = `
                    <div class="card-info">
                        <h3>${medicamento.nome}</h3>
                        <p><strong>Dose:</strong> ${medicamento.dose}</p>
                        <p><strong>Horários:</strong> ${medicamento.horario}</p>
                        <p><strong>Duração:</strong> ${medicamento.duracao} dias ${isInativo ? "(Finalizado)" : ""}</p>
                    </div>
                    <div class="card-actions">
                        <button class="btn-icon btn-editar"><i class="fas fa-pencil-alt"></i></button>
                        <button class="btn-icon btn-excluir"><i class="fas fa-trash-alt"></i></button>
                    </div>
                `;
                containerLista.appendChild(card);
            });
        });
    }

    // --- ALUNO 4 (Alertas) ---
    const containerAlertas = document.getElementById('container-alertas');

    function exibirAlerta(medicamento, tipo) {
        const alerta = document.createElement('div');
        alerta.className = 'alerta';

        let titulo = '';
        let icone = '';
        let corpo = '';
        
        if (tipo === 'agora') {
            alerta.classList.add('alerta-agora');
            titulo = 'Hora de tomar!';
            icone = 'fa-bell';
            corpo = `<p>Dose: ${medicamento.dose}</p>`;
        } else {
            alerta.classList.add('alerta-pre');
            titulo = 'Prepare-se!';
            icone = 'fa-clock';
            corpo = `<p>Daqui a 5 minutos.</p>`;
        }

        alerta.innerHTML = `
            <div class="alerta-header">
                <strong><i class="fas ${icone}"></i> ${titulo}</strong>
                <button class="btn-fechar-alerta">&times;</button>
            </div>
            <div class="alerta-body">
                <p><strong>${medicamento.nome}</strong></p>
                ${corpo}
            </div>
        `;
        containerAlertas.appendChild(alerta);
        alerta.querySelector('.btn-fechar-alerta').addEventListener('click', () => {
            alerta.remove();
        });
        setTimeout(() => {
            if (alerta) alerta.remove();
        }, 30000);
    }

    function verificarAlertas() {
        const agora = new Date();
        const horaMinutoAtual = `${agora.getHours().toString().padStart(2, '0')}:${agora.getMinutes().toString().padStart(2, '0')}`;
        
        const agoraMais5Minutos = new Date(agora.getTime() + 5 * 60000);
        const horaMinutoMais5 = `${agoraMais5Minutos.getHours().toString().padStart(2, '0')}:${agoraMais5Minutos.getMinutes().toString().padStart(2, '0')}`;
        
        medicamentosAtuais.forEach(medicamento => {
            if (medicamento.isInativo) {
                return; 
            }

            const horariosSalvos = medicamento.horario.split(',').map(h => h.trim());
            
            if (horariosSalvos.includes(horaMinutoAtual)) {
                exibirAlerta(medicamento, 'agora');
            }
            
            if (horariosSalvos.includes(horaMinutoMais5)) {
                exibirAlerta(medicamento, 'pre_alerta');
            }
        });
    }
    
    // --- INICIALIZAÇÃO ---
    function iniciarVerificadorDeAlertasSincronizado() {
        const segundosAtuais = new Date().getSeconds();
        const segundosAteOProximoMinuto = 60 - segundosAtuais;
        
        setTimeout(() => {
            verificarAlertas();
            setInterval(verificarAlertas, 60000);
        }, segundosAteOProximoMinuto * 1000);
    }

    mudarPagina('listar');
    carregarMedicamentos();
    iniciarVerificadorDeAlertasSincronizado();
});

