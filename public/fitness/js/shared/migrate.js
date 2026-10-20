// Миграции данных — общие решения для сервера и локального режима:
// v2 — фазы, справочник и программы из «Плана формы к лету 2027»; v3 — целевой вес 77 кг, если не задан.
// Применяют их src/migrate.js (SQLite) и js/local/backend.js (state в IndexedDB).

import { DEFAULT_PHASES, LEGACY_PHASES, PHASE_FIELDS, DEFAULT_EXERCISES } from './seed.js';

export const DATA_VERSION = 3;
export const DEFAULT_GOAL_WEIGHT = 77;
export const PHASES_NOTICE = 'Цели фаз отличаются от плана — проверьте настройки';

const same = (a, b) => PHASE_FIELDS.every((k) => Number(a?.[k]) === Number(b?.[k]));

// Фазу перезаписываем, только если в ней старые значения по умолчанию (или её нет).
// Если пользователь менял цели и они не совпадают с планом — не трогаем и предупреждаем.
export function planPhases(current) {
  const updates = [];
  let notice = null;
  for (const def of DEFAULT_PHASES) {
    const cur = current.find((p) => p.phase_no === def.phase_no);
    const legacy = LEGACY_PHASES.find((p) => p.phase_no === def.phase_no);
    if (!cur || same(cur, legacy)) updates.push({ ...def, name: cur?.name || def.name });
    else if (!same(cur, def)) notice = PHASES_NOTICE;
  }
  return { updates, notice };
}

// Какие упражнения оставить: из нового справочника и те, на которые ссылаются записи подходов.
export function keepExercise(name, id, usedIds) {
  return usedIds.has(id) || DEFAULT_EXERCISES.some(([n]) => n === name);
}

// Старая тренировка, на которую ссылаются записи, остаётся под другим кодом.
export function retiredWorkout(w) {
  return { code: `${w.code}_V1`.slice(0, 40), name: `${w.name} (старая)` };
}
