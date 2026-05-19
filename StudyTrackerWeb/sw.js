const CACHE_NAME = 'studytracker-v3';
const urlsToCache = [
    './',
    './index.html',
    './css/styles.css',
    './css/heatmap.css',
    './js/nepali-cal.js',
    './js/db.js',
    './js/heatmap.js',
    './js/app.js',
    './manifest.json'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
    );
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(resp => resp || fetch(event.request))
    );
});
