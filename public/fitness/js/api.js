// Клиент API. Два режима:
// • локальный (<meta name="fit-mode" content="local">): данные на устройстве, запросы обрабатывает
//   js/local/backend.js — сервер не нужен;
// • серверный: сеть, при ошибке — последний ответ из localStorage; запись сначала ложится в очередь
//   (outbox) и отправляется по порядку. Записи идемпотентны (PUT/PATCH по ключу), повтор безопасен.

import { todayIn } from './shared/dates.js?v=d67a901a70f5';

// База приложения из <base href> (…/fitness/): так пути верны и на /fitness, и на /fitness/.
const BASE = new URL(document.baseURI);
// Адрес самого приложения без слеша в конце — как его отдаёт Next.js.
export const APP_URL = BASE.pathname.replace(/\/$/, '') || '/';
export const LOCAL = document.querySelector('meta[name="fit-mode"]')?.content === 'local';
const OUTBOX_KEY = 'fit:outbox';
const CACHE_PREFIX = 'fit:cache:';
const listeners = new Set();

let online = navigator.onLine;
let authLost = false;
let flushing = null;

function store(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* квота или приватный режим */ }
}
function load(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}

export function status() {
  if (LOCAL) return { online: true, authLost: false, pending: 0 };
  return { online, authLost, pending: load(OUTBOX_KEY, []).length };
}

// ——— Локальный режим ———
let backend = null;
let persist = null;
export let persisted = null;

export async function ready() {
  if (!LOCAL || backend) return;
  const [{ createBackend, initialState, migrateState }, { openPersist, requestPersistence }] = await Promise.all([
    import('./local/backend.js?v=d67a901a70f5'), import('./local/persist.js?v=d67a901a70f5'),
  ]);
  let state = null;
  try {
    persist = await openPersist(() => todayIn(backend?.state.settings.timezone || 'Europe/Amsterdam'));
    state = await persist.load();
  } catch {
    throw new Error('Браузер не даёт хранить данные (приватный режим?). Откройте трекер в обычном окне.');
  }
  if (state) {
    // Перед обновлением данных до новой версии — отдельный снимок, его можно вернуть в «Настройках».
    const before = structuredClone(state);
    if (migrateState(state)) {
      await persist.saveSnapshot(`${todayIn(state.settings.timezone)}~v${state.version}`, before);
      await persist.save(state);
    }
  }
  backend = createBackend(state || initialState(), { commit: (st) => persist.save(st) });
  if (!state) await persist.save(backend.state);
  persisted = await requestPersistence();
}

const localError = (e) => new Error(e?.message || 'Ошибка');

export const local = {
  exportCsv: (table) => backend.exportCsv(table),
  backupJson: () => backend.backupJson(),
  markBackedUp: () => backend.markBackedUp(),
  restore: (json) => backend.restore(json),
  snapshots: () => persist.snapshots(),
  snapshot: (day) => persist.snapshot(day),
};

export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
const notify = (info = {}) => listeners.forEach((fn) => fn({ ...status(), ...info }));

async function request(method, path, body, { timeout = 8000, raw = false, contentType } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const headers = { 'x-fit': '1' };
    let payload;
    if (body !== undefined) {
      if (raw) { payload = body; headers['content-type'] = contentType || 'application/octet-stream'; }
      else { payload = JSON.stringify(body); headers['content-type'] = 'application/json'; }
    }
    const res = await fetch(new URL(path, BASE), { method, headers, body: payload, credentials: 'same-origin', signal: ctrl.signal, cache: 'no-store' });
    const data = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
    return { status: res.status, data };
  } finally {
    clearTimeout(timer);
  }
}

function setOnline(v) {
  if (online !== v) { online = v; notify(); }
}

function handleAuthLost() {
  if (!authLost) { authLost = true; notify(); }
}

// Запрос, запущенный заранее (параллельно с bootstrap), забирается первым get() с тем же путём.
const prefetched = new Map();
export function prefetch(path) {
  if (LOCAL) return;
  if (!prefetched.has(path)) prefetched.set(path, getFresh(path).catch(() => null));
}

export async function get(path) {
  if (LOCAL) {
    try { return { data: await backend.handle('GET', path), stale: false }; } catch (e) { throw localError(e); }
  }
  const early = prefetched.get(path);
  if (early) {
    prefetched.delete(path);
    const res = await early;
    if (res) return res;
  }
  return getFresh(path);
}

// GET с откатом на кэш. Возвращает { data, stale }.
async function getFresh(path) {
  try {
    const res = await request('GET', 'api/' + path, undefined, { timeout: 6000 });
    setOnline(true);
    if (res.status === 401) {
      handleAuthLost();
    } else if (res.status === 200) {
      store(CACHE_PREFIX + path, res.data);
      return { data: res.data, stale: false };
    } else {
      throw new Error(res.data?.error || `Ошибка ${res.status}`);
    }
  } catch (e) {
    if (e.name !== 'AbortError' && !(e instanceof TypeError)) throw e;
    setOnline(false);
  }
  const cached = load(CACHE_PREFIX + path, null);
  if (cached) return { data: cached, stale: true };
  throw new Error(authLost ? 'Нужно войти снова' : 'Нет сети, и эти данные ещё не загружались');
}

// Запись через очередь. Не ждёт сеть: UI обновляется сразу.
export function write(method, path, body) {
  if (LOCAL) {
    return backend.handle(method, path, body).then(
      () => ({ synced: 0, errors: [] }),
      (e) => { notify({ errors: [localError(e).message] }); return { synced: 0, errors: [e.message] }; },
    );
  }
  const ops = load(OUTBOX_KEY, []);
  ops.push({ id: Date.now() + '-' + Math.random().toString(36).slice(2, 8), method, path, body });
  store(OUTBOX_KEY, ops);
  notify();
  return flush();
}

export function pending() {
  if (LOCAL) return [];
  return load(OUTBOX_KEY, []);
}

export function flush() {
  if (LOCAL) return Promise.resolve({ synced: 0, errors: [] });
  if (flushing) return flushing;
  flushing = (async () => {
    let synced = 0;
    const errors = [];
    while (true) {
      const ops = load(OUTBOX_KEY, []);
      if (!ops.length) break;
      const op = ops[0];
      let res;
      try {
        res = await request(op.method, 'api/' + op.path, op.body);
        setOnline(true);
      } catch {
        setOnline(false);
        break;
      }
      if (res.status === 401) { handleAuthLost(); break; }
      if (res.status >= 500) break;
      if (res.status >= 400) errors.push(res.data?.error || `Ошибка ${res.status}`);
      else synced++;
      store(OUTBOX_KEY, load(OUTBOX_KEY, []).filter((o) => o.id !== op.id));
    }
    flushing = null;
    notify({ synced, errors });
    return { synced, errors };
  })();
  return flushing;
}

// Прямой вызов без очереди — для действий, которым нужен ответ сервера (импорт, passkeys).
export async function call(method, path, body, opts) {
  if (LOCAL) {
    try {
      return opts?.raw ? await backend.handle(method, path, undefined, new Uint8Array(body)) : await backend.handle(method, path, body);
    } catch (e) {
      throw localError(e);
    }
  }
  let res;
  try {
    res = await request(method, 'api/' + path, body, { timeout: 60000, ...opts });
  } catch {
    setOnline(false);
    throw new Error('Нет сети');
  }
  setOnline(true);
  if (res.status === 401) { handleAuthLost(); throw new Error('Нужно войти снова'); }
  if (res.status >= 400) throw new Error(res.data?.error || `Ошибка ${res.status}`);
  return res.data;
}

// При выходе стираем сохранённые ответы API: данные не должны оставаться на устройстве.
export function clearCache() {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith(CACHE_PREFIX)) localStorage.removeItem(k);
  } catch { /* нет хранилища */ }
}

export function apiUrl(path) {
  return new URL('api/' + path, BASE).href;
}

export function loginUrl() {
  return new URL('login', BASE).href;
}

if (!LOCAL) {
  window.addEventListener('online', () => { setOnline(true); flush(); });
  window.addEventListener('offline', () => setOnline(false));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') flush(); });
  setInterval(() => { if (load(OUTBOX_KEY, []).length) flush(); }, 30000);
}
