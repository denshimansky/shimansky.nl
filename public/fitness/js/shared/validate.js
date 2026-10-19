// Проверка входных данных — общая для сервера и для локального режима в браузере.

import { isIsoDate, parseNum } from './dates.js';

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
