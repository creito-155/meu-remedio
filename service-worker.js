// Define o nome do cache
const CACHE_NAME = 'app-medicamentos-cache-v1';
// Lista de arquivos para fazer cache inicial
const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js',
    '/manifest.json',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/webfonts/fa-solid-900.woff2'
];

// Evento de instalação: abre o cache e adiciona os arquivos principais
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Cache aberto');
                return cache.addAll(urlsToCache);
            })
    );
});

// Evento de fetch: intercepta as requisições
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Se encontrar no cache, retorna do cache
                if (response) {
                    return response;
                }
                // Se não, busca na rede
                return fetch(event.request);
            })
    );
});
