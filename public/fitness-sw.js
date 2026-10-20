// Service worker: оболочка приложения работает без сети. Данные API кэширует сам клиент (js/api.js).
// VERSION, BASE и ASSETS подставляет сервер при отдаче файла.

const VERSION = "bf8d7cbb8f1d";
const BASE = "/fitness";
const ASSETS = ["app.css","icons/icon-180.png","icons/icon-192.png","icons/icon-512-maskable.png","icons/icon-512.png","icons/icon.svg","js/api.js","js/app.js","js/backup.js","js/chart.js","js/local/backend.js","js/local/persist.js","js/passkey.js","js/shared/calc.js","js/shared/csv.js","js/shared/dates.js","js/shared/importer.js","js/shared/macrofactor.js","js/shared/migrate.js","js/shared/nutrition.js","js/shared/seed.js","js/shared/validate.js","js/shared/xlsx.js","js/ui.js","js/views/checkin.js","js/views/nutrition.js","js/views/progress.js","js/views/settings.js","js/views/tests.js","js/views/today.js","js/views/workout.js","manifest.webmanifest"];
const CACHE = `fit-${VERSION}`;
const APP = BASE || '/';
const SHELL = 'shell';

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(ASSETS.map((a) => `${BASE}/${a}`));
    const shell = await fetch(APP, { credentials: 'same-origin', cache: 'no-store' });
    if (shell.ok && !shell.redirected) await cache.put(SHELL, shell);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname !== BASE && !url.pathname.startsWith(`${BASE}/`)) return;
  const rel = url.pathname.slice(BASE.length).replace(/^\//, '');
  if (rel.startsWith('api/') || rel.startsWith('auth/') || rel === 'login' || rel === 'sw.js') return;
  const isShell = rel === '' || rel === 'index.html';

  if (req.mode === 'navigate') {
    if (!isShell) return;
    // Страница: сохранённая оболочка сразу (в ней нет данных — API всё равно проверяет вход),
    // свежая версия подтягивается в фоне. Без сохранённой оболочки — сеть (там редирект на вход).
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const network = fetch(req).then((res) => {
        if (res.ok && !res.redirected) cache.put(SHELL, res.clone());
        return res;
      });
      const hit = await cache.match(SHELL);
      if (hit) {
        event.waitUntil(network.catch(() => {}));
        return hit;
      }
      try {
        return await network;
      } catch {
        return Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const hit = await caches.match(req, { ignoreSearch: true });
    if (hit) return hit;
    return fetch(req);
  })());
});
