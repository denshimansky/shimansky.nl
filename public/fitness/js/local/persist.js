// Хранение данных локального режима в IndexedDB на устройстве.
// 'state' — текущие данные; 'snap:ГГГГ-ММ-ДД' — состояние перед первой правкой дня (последние 14 дней):
// страховка от собственных ошибок, например неудачного импорта.

const DB_NAME = 'shimansky-fitness';
const STORE = 'kv';
const KEEP_SNAPSHOTS = 14;

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function op(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const result = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(result?.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('Запись в хранилище отменена'));
  });
}

export async function openPersist(todayFn) {
  const db = await open();
  let snapDay = null;
  return {
    async load() {
      return op(db, 'readonly', (s) => s.get('state'));
    },
    async save(state) {
      const day = todayFn();
      if (snapDay !== day) {
        const snapKey = `snap:${day}`;
        const exists = await op(db, 'readonly', (s) => s.getKey(snapKey));
        if (!exists) {
          const prev = await op(db, 'readonly', (s) => s.get('state'));
          if (prev) await op(db, 'readwrite', (s) => s.put(prev, snapKey));
          const keys = (await op(db, 'readonly', (s) => s.getAllKeys())).filter((k) => String(k).startsWith('snap:')).sort();
          for (const k of keys.slice(0, Math.max(0, keys.length - KEEP_SNAPSHOTS))) await op(db, 'readwrite', (s) => s.delete(k));
        }
        snapDay = day;
      }
      await op(db, 'readwrite', (s) => s.put(state, 'state'));
    },
    async snapshots() {
      return (await op(db, 'readonly', (s) => s.getAllKeys())).filter((k) => String(k).startsWith('snap:')).map((k) => k.slice(5)).sort().reverse();
    },
    async snapshot(day) {
      return op(db, 'readonly', (s) => s.get(`snap:${day}`));
    },
  };
}

// Просим браузер не удалять данные при нехватке места (для установленного на экран приложения обычно разрешает).
export async function requestPersistence() {
  try {
    if (!navigator.storage?.persist) return null;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}
