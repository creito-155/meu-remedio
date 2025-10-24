const CACHE_VERSION = 'v1.1'; // Mude esta versão para forçar a atualização do cache
const CACHE_NAME = `app-medicamentos-cache-${CACHE_VERSION}`;

// Lista de ficheiros essenciais para o funcionamento offline
const urlsToCache = [
    './', // A página principal
    './index.html',
    './style.css',
    './app.js',
    './firebase-config.js',
    './manifest.json',
    // Ícones (se você criou uma pasta 'icons' como no manifest.json)
    // './icons/icon-192x192.png', 
    // './icons/icon-512x512.png', 
    // Dependências externas (CDNs)
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/normalize/8.0.1/normalize.min.css',
    'https://www.gstatic.com/firebasejs/9.6.10/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/9.6.10/firebase-auth-compat.js',
    'https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore-compat.js'
    // Adicione aqui outros recursos estáticos importantes (imagens, fontes, etc.)
];

// Evento de Instalação: Guarda os ficheiros na cache
self.addEventListener('install', event => {
    console.log('[Service Worker] Instalando...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[Service Worker] Cache aberto, adicionando ficheiros essenciais.');
                // Adiciona todos os URLs definidos. Se algum falhar, a instalação falha.
                return cache.addAll(urlsToCache);
            })
            .then(() => {
                console.log('[Service Worker] Ficheiros essenciais adicionados à cache.');
                // Força o novo Service Worker a ativar imediatamente
                return self.skipWaiting(); 
            })
            .catch(error => {
                console.error('[Service Worker] Falha ao adicionar ficheiros à cache durante a instalação:', error);
            })
    );
});

// Evento de Ativação: Limpa caches antigas
self.addEventListener('activate', event => {
    console.log('[Service Worker] Ativando...');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    // Se o nome da cache não for o atual, apaga-a
                    if (cacheName !== CACHE_NAME) {
                        console.log('[Service Worker] A limpar cache antiga:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('[Service Worker] Ativado e caches antigas limpas.');
            // Garante que o Service Worker controle a página imediatamente
            return self.clients.claim(); 
        })
    );
});

// Evento Fetch: Interceta pedidos e serve da cache primeiro
self.addEventListener('fetch', event => {
    // Não interceta pedidos POST ou outros que não sejam GET
    if (event.request.method !== 'GET') {
        return;
    }
    
    // Estratégia: Cache First, falling back to Network
    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                // Se encontrar na cache, retorna a resposta da cache
                if (cachedResponse) {
                    // console.log('[Service Worker] A servir da cache:', event.request.url);
                    return cachedResponse;
                }
                
                // Se não encontrar na cache, vai à rede
                // console.log('[Service Worker] A buscar na rede:', event.request.url);
                return fetch(event.request).then(
                    networkResponse => {
                        // Se a resposta da rede for válida, clona-a e guarda na cache
                        if (networkResponse && networkResponse.status === 200) {
                            const responseToCache = networkResponse.clone();
                            caches.open(CACHE_NAME)
                                .then(cache => {
                                    cache.put(event.request, responseToCache);
                                });
                        }
                        return networkResponse;
                    }
                ).catch(error => {
                    // Se falhar a rede (offline), pode retornar uma página offline genérica (opcional)
                    console.error('[Service Worker] Erro ao buscar na rede:', error);
                    // Aqui você poderia retornar uma resposta offline padrão, se quisesse
                    // return caches.match('./offline.html'); 
                });
            })
    );
});