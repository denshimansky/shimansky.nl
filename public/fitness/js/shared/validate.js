// Проверка входных данных — общая для сервера и для локального режима в браузере.

import { isIsoDate, parseNum } from './dates.js';
import { EXERCISE_KINDS } from './seed.js';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const bad = (msg) => new HttpError(400, msg);

// Поле → [мин, макс, целое?]
export const DAILY_FIELDS = {
  weight_kg: [30, 300, false],
  kcal: [0, 10000, true],
  protein_g: [0, 600, true],
  steps: [0, 150000, true],
  sleep_h: [0, 24, false],
};

export const WAIST = [40, 250, false];

export function num(v, [min, max, int], field) {
  if (v === null || v === '' || v === undefined) return null;
  const n = parseNum(v);
  if (n === null || n < min || n > max) throw bad(`${field}: ожидается число от ${min} до ${max}`);
  return int ? Math.round(n) : Math.round(n * 100) / 100;
}

export function intOrNull(v, min, max, field) {
  return num(v, [min, max, true], field);
}

export function text(v, max = 2000) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
}

export function requireDate(d) {
  if (!isIsoDate(d)) throw bad('Дата должна быть в формате ГГГГ-ММ-ДД');
  return d;
}

export function beerChips(v) {
  return v === null || v === '' || v === undefined ? null : v === true || v === 1 || v === '1' ? 1 : 0;
}

export function workoutCode(v) {
  return text(v, 40)?.toUpperCase().replace(/[^A-Z0-9_]/g, '_') || null;
}

export function exerciseKind(v) {
  const k = v === null || v === undefined || v === '' ? 'weight_reps' : String(v);
  if (!Object.hasOwn(EXERCISE_KINDS, k)) throw bad('Неизвестный тип упражнения');
  return k;
}

// Диапазон программы: повторы, секунды, метры или минуты; 0–0 — «до запаса».
export function repRange(min, max) {
  const a = intOrNull(min, 0, 3600, 'rep_min');
  const b = intOrNull(max, 0, 3600, 'rep_max');
  if (a === null || b === null || a > b || (a === 0 && b !== 0)) throw bad('Неверный диапазон повторов');
  return [a, b];
}

// Повторы для замены — необязательны: пусто — как у основного упражнения.
export function subRepRange(min, max) {
  if ((min === null || min === undefined || min === '') && (max === null || max === undefined || max === '')) return [null, null];
  return repRange(min, max);
}

export function calorieSourceValue(v) {
  if (v === null || v === undefined || v === '' || v === 'auto') return null;
  if (v !== 'plan' && v !== 'macrofactor') throw bad('Источник цели калорий: plan или macrofactor');
  return v;
}

// Правила переноса из MacroFactor в дневник → JSON-строка для настроек.
export function nutritionMergeValue(v) {
  if (v === null || v === undefined || v === '') return null;
  const out = {};
  for (const k of ['kcal', 'protein_g', 'weight_kg', 'steps']) {
    if (v[k] === undefined) continue;
    if (!['overwrite', 'fill', 'skip'].includes(v[k])) throw bad(`Правило для ${k}: overwrite, fill или skip`);
    out[k] = v[k];
  }
  return JSON.stringify(out);
}
