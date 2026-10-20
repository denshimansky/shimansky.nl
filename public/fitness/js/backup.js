// Резервные копии локального режима: файл JSON со всеми данными.
// На телефоне — через меню «Поделиться» (можно сохранить в «Файлы» / iCloud Drive), иначе — обычной загрузкой.

import * as api from './api.js?v=d67a901a70f5';
import { todayIn } from './shared/dates.js?v=d67a901a70f5';

export function downloadText(filename, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// Возвращает true, если копия выгружена; false — если пользователь отменил.
export async function saveBackup(timezone) {
  const name = `fitness-backup-${todayIn(timezone || 'Europe/Amsterdam')}.json`;
  const json = api.local.backupJson();
  const file = new File([json], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] }) && /iPhone|iPad|Android/i.test(navigator.userAgent)) {
    try {
      await navigator.share({ files: [file], title: 'Резервная копия трекера формы' });
    } catch (e) {
      if (e.name === 'AbortError') return false;
      throw e;
    }
  } else {
    downloadText(name, json, 'application/json');
  }
  await api.local.markBackedUp();
  return true;
}

export const BACKUP_REMIND_DAYS = 7;

// Сколько дней назад была последняя копия; null — копий ещё не было.
export function daysSinceBackup(boot, today) {
  const last = boot.local?.last_backup_at;
  if (!last) return null;
  return Math.floor((Date.parse(today) - Date.parse(last.slice(0, 10))) / 86400000);
}

// Напоминать, если копии не было неделю (или ни разу, когда уже есть хотя бы 3 дня записей).
export function needsBackup(boot, today) {
  if (!boot.local) return false;
  const d = daysSinceBackup(boot, today);
  return d === null ? boot.local.days_logged >= 3 : d >= BACKUP_REMIND_DAYS;
}
