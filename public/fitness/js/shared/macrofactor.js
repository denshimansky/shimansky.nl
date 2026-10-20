// Импорт экспорта MacroFactor (More → Data Management → Data Export).
// Quick Export — xlsx с листами «Quick Export» (по дням) и «Food Log» (по продуктам); бывает и csv.
// Колонки ищутся по заголовкам: регистр и единицы в скобках не важны («Calories (kcal)» = «calories»).
// Общий для сервера и браузера. Запись — через store (src/nutrition.js и js/local/backend.js):
//   transaction(fn), nutritionGet(date), nutritionPut(row), dayGet(date), dayPut(date, patch, now),
//   mapping(), addImport(rec), settings().

import { readXlsx, excelSerialToIso } from './xlsx.js?v=d67a901a70f5';
import { isIsoDate, parseNum } from './dates.js?v=d67a901a70f5';

// Поле трекера → подпись (для экрана сопоставления) и синонимы заголовка (без единиц, в нижнем регистре).
export const NUTRITION_FIELDS = {
  date: ['Дата', ['date', 'day', 'дата']],
  kcal: ['Калории', ['calories', 'energy', 'kcal', 'calorie intake', 'калории']],
  protein_g: ['Белок, г', ['protein', 'белок']],
  fat_g: ['Жиры, г', ['fat', 'total fat', 'жиры']],
  carbs_g: ['Углеводы, г', ['carbs', 'carbohydrates', 'total carbs', 'углеводы']],
  fiber_g: ['Клетчатка, г', ['fiber', 'fibre', 'клетчатка']],
  kcal_target: ['Цель ккал', ['target calories', 'calorie target', 'calories target', 'target energy']],
  protein_target_g: ['Цель белка, г', ['target protein', 'protein target']],
  fat_target_g: ['Цель жиров, г', ['target fat', 'fat target']],
  carbs_target_g: ['Цель углеводов, г', ['target carbs', 'carbs target', 'carbohydrates target', 'target carbohydrates']],
  expenditure_kcal: ['Расход (MacroFactor)', ['expenditure', 'tdee', 'energy expenditure']],
  trend_weight_kg: ['Вес тренда', ['trend weight', 'weight trend']],
  scale_weight_kg: ['Вес на весах', ['weight', 'scale weight', 'body weight', 'bodyweight']],
  steps: ['Шаги', ['steps', 'step count']],
};

export const NUTRITION_COLUMNS = ['date', 'kcal', 'protein_g', 'fat_g', 'carbs_g', 'fiber_g', 'kcal_target', 'protein_target_g',
  'fat_target_g', 'carbs_target_g', 'expenditure_kcal', 'trend_weight_kg', 'scale_weight_kg', 'steps', 'source', 'import_id'];
const VALUE_FIELDS = NUTRITION_COLUMNS.filter((c) => !['date', 'source', 'import_id'].includes(c));
const INT_FIELDS = new Set(['kcal', 'kcal_target', 'expenditure_kcal', 'steps']);

// Как дневник получает данные из MacroFactor: overwrite — всегда (если в файле есть значение), fill — только в пустое, skip — никогда.
export const DEFAULT_MERGE = { kcal: 'overwrite', protein_g: 'overwrite', weight_kg: 'fill', steps: 'fill' };
const MERGE_SOURCE = { kcal: 'kcal', protein_g: 'protein_g', weight_kg: 'scale_weight_kg', steps: 'steps' };
export const MERGE_LABELS = { overwrite: 'перезаписывать', fill: 'только если пусто', skip: 'не трогать' };

const LB = 0.45359237;
const KJ = 4.184;

export function splitHeader(h) {
  const s = String(h ?? '').trim();
  const unit = (s.match(/\(([^)]*)\)\s*$/)?.[1] || '').toLowerCase().trim();
  const name = s.replace(/\([^)]*\)\s*$/, '').toLowerCase().replace(/[_\s]+/g, ' ').trim();
  return { name, unit };
}

// Автоматическое сопоставление: { 'заголовок': 'поле' }. Сохранённое (saved) важнее.
export function guessMapping(headers, saved = {}) {
  const out = {};
  const taken = new Set();
  for (const h of headers) {
    if (h === null || h === undefined) continue;
    const f = saved[h];
    if (f && NUTRITION_FIELDS[f] && !taken.has(f)) { out[h] = f; taken.add(f); }
  }
  for (const h of headers) {
    if (h === null || h === undefined || out[h] || saved[h] === '') continue;
    const { name } = splitHeader(h);
    for (const [field, [, syn]] of Object.entries(NUTRITION_FIELDS)) {
      if (!taken.has(field) && syn.includes(name)) { out[h] = field; taken.add(field); break; }
    }
  }
  return out;
}

const hasRequired = (mapping) => Object.values(mapping).includes('date') && Object.values(mapping).includes('kcal');

// ——— CSV ———
export function parseCsv(text) {
  const src = String(text).replace(/^﻿/, '');
  const firstLine = src.split(/\r?\n/, 1)[0];
  const delim = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"' && cell === '') quoted = true;
    else if (c === delim) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => String(x).trim() !== ''))
    .map((r) => r.map((x) => { const t = String(x).trim(); return t === '' ? null : t; }));
}

// ——— Даты ———
// order: 'dmy' | 'mdy' — для «01/02/2026»; выбирается по всей колонке (число > 12 выдаёт порядок).
export function detectDateOrder(values) {
  let dmy = false;
  let mdy = false;
  for (const v of values) {
    const m = typeof v === 'string' && v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
    if (!m) continue;
    if (Number(m[1]) > 12) dmy = true;
    if (Number(m[2]) > 12) mdy = true;
  }
  return mdy && !dmy ? 'mdy' : 'dmy';
}

export function cellDateIso(v, order = 'dmy') {
  if (v === null || v === undefined) return null;
  if (typeof v === 'object' && v.date) return v.date;
  if (typeof v === 'number') return v > 20000 && v < 80000 ? excelSerialToIso(v) : null;
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) {
    const iso = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    return isIsoDate(iso) ? iso : null;
  }
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (m) {
    const [d, mo] = order === 'mdy' ? [m[2], m[1]] : [m[1], m[2]];
    const iso = `${m[3]}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
    return isIsoDate(iso) ? iso : null;
  }
  if (/^\d{5}(\.\d+)?$/.test(s)) return cellDateIso(Number(s));
  return null;
}

function cellNumber(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'object') return null;
  return parseNum(String(v).replace(/[\s ]/g, ''));
}

// Значение в единицах трекера: фунты → кг, кДж → ккал.
function convert(field, unit, n) {
  if (n === null) return null;
  let x = n;
  if ((field === 'trend_weight_kg' || field === 'scale_weight_kg') && /^lbs?$/.test(unit)) x = n * LB;
  if ((field === 'kcal' || field === 'kcal_target' || field === 'expenditure_kcal') && unit === 'kj') x = n / KJ;
  return INT_FIELDS.has(field) ? Math.round(x) : Math.round(x * 100) / 100;
}

// ——— Таблицы файла ———
async function tablesOf(raw) {
  const bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    return (await readXlsx(bytes)).map((s) => ({ name: s.name, rows: s.rows }));
  }
  return [{ name: 'CSV', rows: parseCsv(new TextDecoder('utf-8').decode(bytes)) }];
}

// Строка заголовков — первая строка, где есть хотя бы 2 текстовые ячейки (в первых 10 строках).
function headerRow(rows) {
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    if ((rows[i] || []).filter((x) => typeof x === 'string').length >= 2) return i;
  }
  return -1;
}

// Выбор листа: есть дата и калории; больше распознанных колонок; даты не повторяются (не «Food Log»).
export async function readNutritionFile(raw, savedMapping = {}) {
  const tables = await tablesOf(raw);
  let best = null;
  for (const t of tables) {
    const hi = headerRow(t.rows);
    if (hi < 0) continue;
    const headers = (t.rows[hi] || []).map((x) => (x === null || x === undefined ? null : String(x).trim()));
    const mapping = guessMapping(headers, savedMapping);
    const body = t.rows.slice(hi + 1);
    const dateCol = headers.findIndex((h) => h && mapping[h] === 'date');
    const dates = dateCol >= 0 ? body.map((r) => r[dateCol]).filter((x) => x !== null && x !== undefined) : [];
    const unique = new Set(dates.map((d) => (typeof d === 'object' ? d.date : String(d)))).size === dates.length;
    const score = (hasRequired(mapping) ? 1000 : 0) + (unique ? 100 : 0) + Object.keys(mapping).length;
    if (!best || score > best.score) best = { sheet: t.name, headers, mapping, body, score };
  }
  if (!best) throw new Error('В файле не найдено таблицы с заголовками');
  return best;
}

// Строки nutrition_daily из таблицы по сопоставлению. Пустые строки (без единого значения) пропускаются.
export function nutritionRows({ headers, mapping, body }) {
  const col = {};
  headers.forEach((h, i) => { if (h && mapping[h]) col[mapping[h]] = { i, unit: splitHeader(h).unit }; });
  const order = detectDateOrder(body.map((r) => r[col.date.i]));
  const byDate = new Map();
  for (const r of body) {
    const date = cellDateIso(r[col.date.i], order);
    if (!date) continue;
    const row = { date };
    let any = false;
    for (const f of VALUE_FIELDS) {
      const c = col[f];
      row[f] = c ? convert(f, c.unit, cellNumber(r[c.i])) : null;
      if (row[f] !== null) any = true;
    }
    if (any) byDate.set(date, row);
  }
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

// Импорт: разбор → upsert nutrition_daily по дате → перенос в дневник по правилам merge → запись об импорте.
// Если нет колонок даты и калорий — ничего не пишет и возвращает needs_mapping со списком заголовков.
export async function importNutrition(store, raw, { fileName = null, now = new Date().toISOString(), merge = DEFAULT_MERGE } = {}) {
  const table = await readNutritionFile(raw, store.mapping() || {});
  if (!hasRequired(table.mapping)) {
    return {
      needs_mapping: true, sheet: table.sheet, headers: table.headers.filter(Boolean), mapping: table.mapping,
      fields: Object.fromEntries(Object.entries(NUTRITION_FIELDS).map(([k, [label]]) => [k, label])),
    };
  }
  const rows = nutritionRows(table);
  if (!rows.length) throw new Error('В файле нет строк с датами');
  const rules = { ...DEFAULT_MERGE, ...merge };
  const importId = `mf-${now.replace(/\D/g, '').slice(0, 14)}`;
  const report = {
    sheet: table.sheet, date_from: rows[0].date, date_to: rows[rows.length - 1].date, rows: rows.length,
    added: 0, updated: 0, unchanged: 0, diary: { kcal: 0, protein_g: 0, weight_kg: 0, steps: 0 }, weight_kept: 0,
    unknown_columns: table.headers.filter((h) => h && !table.mapping[h]),
    mapped: table.mapping,
  };
  store.transaction(() => {
    for (const row of rows) {
      const cur = store.nutritionGet(row.date);
      const next = { ...row, source: 'macrofactor', import_id: importId };
      if (!cur) report.added++;
      else if (VALUE_FIELDS.some((f) => (cur[f] ?? null) !== (row[f] ?? null))) report.updated++;
      else report.unchanged++;
      store.nutritionPut(cur && !VALUE_FIELDS.some((f) => (cur[f] ?? null) !== (row[f] ?? null)) ? { ...next, import_id: cur.import_id } : next);

      const day = store.dayGet(row.date) || {};
      const patch = {};
      for (const [field, rule] of Object.entries(rules)) {
        const v = row[MERGE_SOURCE[field]];
        if (v === null || v === undefined || rule === 'skip') continue;
        const has = day[field] !== null && day[field] !== undefined;
        if (rule === 'overwrite' || !has) {
          if (day[field] !== v) { patch[field] = field === 'protein_g' ? Math.round(v) : v; report.diary[field]++; }
        } else if (field === 'weight_kg' && day[field] !== v) report.weight_kept++;
      }
      if (Object.keys(patch).length) store.dayPut(row.date, patch, now);
    }
    store.addImport({
      id: importId, file_name: fileName, imported_at: now, date_from: report.date_from, date_to: report.date_to,
      rows: rows.length, mapping: JSON.stringify(table.mapping), report: JSON.stringify(report),
    });
  });
  return report;
}

// Проверка сопоставления от пользователя: { заголовок: поле | '' }.
export function cleanMapping(m) {
  const out = {};
  for (const [h, f] of Object.entries(m || {})) {
    const key = String(h).slice(0, 200);
    if (f === '' || f === null) out[key] = '';
    else if (NUTRITION_FIELDS[f]) out[key] = f;
  }
  return out;
}

// Правила переноса в дневник из настроек (JSON-строка) поверх значений по умолчанию.
export function mergeRules(settings) {
  let saved = {};
  try { saved = settings?.nutrition_merge ? JSON.parse(settings.nutrition_merge) : {}; } catch { saved = {}; }
  const out = { ...DEFAULT_MERGE };
  for (const k of Object.keys(DEFAULT_MERGE)) if (MERGE_LABELS[saved[k]]) out[k] = saved[k];
  return out;
}

// Журнал импортов для ответа API: report — объект, mapping не нужен.
export function importsView(list) {
  return [...list].sort((a, b) => (a.imported_at < b.imported_at ? 1 : -1)).map((r) => {
    let report = null;
    try { report = r.report ? JSON.parse(r.report) : null; } catch { report = null; }
    return { id: r.id, file_name: r.file_name, imported_at: r.imported_at, date_from: r.date_from, date_to: r.date_to, rows: r.rows, report };
  });
}
