// Импорт «Трекер_формы_2027.xlsx»: листы «Дневник», «Недели», «Тренировки», «Тесты».
// Колонки ищутся по заголовкам, а не по позициям. Повторный импорт не создаёт дублей:
// дни — по дате, недели и тесты — по номеру недели, тренировки — по дате и коду тренировки.

// Модуль общий для сервера и браузера. Запись идёт через хранилище store
// (SQLite на сервере — src/importer.js, данные в браузере — js/local/store.js):
//   settings(), phases(), schedule(), workouts(), exercises(), summaryInputs(), transaction(fn),
//   mergeDay(rec), mergeWeek(week, patch), createExercise(name, increment) → id,
//   putImportSession(id, date, workoutId, completedAt), clearSets(sessionId),
//   putSet(sessionId, exerciseId, setNo, weight, reps, rir), mergeTest(rec).

import { readXlsx, excelSerialToIso } from './xlsx.js?v=d67a901a70f5';
import { weeklySummary, scheduledWorkoutId, SIGNAL_LABELS } from './calc.js?v=d67a901a70f5';
import { isIsoDate, parseNum } from './dates.js?v=d67a901a70f5';

const norm = (s) => String(s ?? '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();

// Правила: заголовок подходит, если совпал match и не совпал skip.
const DAILY_COLS = {
  date: { match: /^дата|^день$/ },
  weight_kg: { match: /^вес/, skip: /цел|ср|средн|измен/ },
  kcal: { match: /ккал|калори/, skip: /цел|план|норм|ср|средн/ },
  protein_g: { match: /белок|белк/, skip: /цел|план|норм|ср|средн/ },
  steps: { match: /шаг/, skip: /цел|план|норм|ср|средн/ },
  sleep_h: { match: /^сон|сна/, skip: /ср|средн|цел/ },
  beer_chips: { match: /пиво|чипс/ },
  note: { match: /замет|коммент|примеч/ },
};

const WEEKS_COLS = {
  week: { match: /^недел|^№|^нед(\.|\s|$)/ },
  waist_cm: { match: /тали/, skip: /измен|разниц|δ|цел/ },
  planned_sessions: { match: /план/, also: /трен|сесс/ },
  done_sessions: { match: /факт|сделан|выполн/, also: /трен|сесс/ },
  is_deload: { match: /разгруз/ },
  // Колонки ниже не импортируются — по ним идёт сверка расчётов с Excel.
  avg_weight: { match: /вес/, also: /ср|средн/, skip: /измен|цел/ },
  weight_change: { match: /измен|разниц|δ|темп кг/, skip: /тали/ },
  signal: { match: /сигнал|оценк|статус|^темп$/ },
  avg_kcal: { match: /ккал|калори/, skip: /цел|план|норм/ },
  avg_protein: { match: /белок|белк/, skip: /цел|план|норм/ },
  avg_steps: { match: /шаг/, skip: /цел|план|норм/ },
  avg_sleep: { match: /сон|сна/ },
};

const WORKOUT_COLS = {
  date: { match: /^дата|^день$/ },
  workout: { match: /^трениров|^програм|^тип|^сесси/ },
  exercise: { match: /упражн/ },
  set_no: { match: /^подход|^№ подх|^сет/, skip: /\d|повт|вес/ },
  weight_kg: { match: /^вес/, skip: /\d/ },
  reps: { match: /^повт|^раз(\s|$)|^reps/, skip: /\d/ },
  rir: { match: /^запас|^rir/, skip: /\d/ },
  note: { match: /замет|коммент|примеч/ },
};

const TESTS_COLS = {
  week: { match: /^недел|^нед(\.|\s|$)/ },
  date: { match: /^дата/ },
  weight_kg: { match: /^вес/ },
  waist_cm: { match: /тали/ },
  pullups: { match: /подтяг/ },
  pushups: { match: /отжим/ },
  plank_sec: { match: /планк/ },
  photo_done: { match: /фото/ },
  note: { match: /замет|коммент|примеч/ },
};

function mapColumns(header, rules) {
  const cols = {};
  header.forEach((h, i) => {
    const t = norm(typeof h === 'object' && h ? h.date : h);
    if (!t) return;
    for (const [key, r] of Object.entries(rules)) {
      if (cols[key] !== undefined) continue;
      if (r.match.test(t) && (!r.also || r.also.test(t)) && !(r.skip && r.skip.test(t))) {
        cols[key] = i;
        break;
      }
    }
  });
  return cols;
}

function findHeader(rows, rules, required) {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const cols = mapColumns(rows[i] || [], rules);
    if (required.every((k) => cols[k] !== undefined)) return { index: i, cols };
  }
  return null;
}

export function cellDate(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'object' && v.date) return v.date;
  if (typeof v === 'number' && v > 20000 && v < 80000) return excelSerialToIso(v);
  const s = String(v).trim();
  if (isIsoDate(s.slice(0, 10))) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (m) {
    const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    const iso = `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return isIsoDate(iso) ? iso : null;
  }
  return null;
}

export function cellNum(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'object') return v.serial ?? null;
  return parseNum(String(v).replace(/[^\d.,\-\s]/g, ''));
}

export function cellSeconds(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'object' && v.time !== undefined) return v.time;
  const s = String(v).trim();
  const m = s.match(/^(\d+):(\d{1,2})$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  const n = cellNum(v);
  return n === null ? null : Math.round(n);
}

export function cellBool(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'number') return v ? 1 : 0;
  const s = norm(v);
  if (/^(да|д|yes|y|true|истина|\+|✓|✔|v|x|х|было|1)$/.test(s)) return 1;
  if (/^(нет|н|no|n|false|ложь|-|—|0|не было)$/.test(s)) return 0;
  return null;
}

function cellText(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'object') return v.date ?? null;
  return String(v).trim() || null;
}

function cellWeek(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isInteger(v) ? v : null;
  const m = String(v).match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

function round(x, d) {
  if (x === null || x === undefined) return null;
  const k = Math.pow(10, d);
  return Math.round(x * k) / k;
}

function findSheet(sheets, re) {
  return sheets.find((s) => re.test(norm(s.name)));
}

function guessIncrement(name) {
  const n = norm(name);
  if (/гир/.test(n)) return 4;
  if (/гантел/.test(n)) return 2;
  if (/подтяг|отжим|планк|вис|брус/.test(n)) return 0;
  return 2.5;
}

export async function importWorkbook(store, buf) {
  const sheets = await readXlsx(buf);
  const report = { sheets: {}, warnings: [], created_exercises: [], verification: null };
  const settings = store.settings();
  let excelWeeks = null;

  store.transaction(() => {
    // «Дневник»
    const daily = findSheet(sheets, /дневник|^дни|ежеднев/);
    if (!daily) report.warnings.push('Не найден лист «Дневник»');
    else {
      const h = findHeader(daily.rows, DAILY_COLS, ['date']);
      if (!h) report.warnings.push('Лист «Дневник»: не найдена колонка «Дата»');
      else {
        const r = { rows: 0, skipped: 0, columns: Object.keys(h.cols).filter((k) => k !== 'date') };
        const now = new Date().toISOString();
        for (const row of daily.rows.slice(h.index + 1)) {
          const c = h.cols;
          const date = cellDate(row[c.date]);
          if (!date) { if (row.some((v) => v !== null && v !== undefined)) r.skipped++; continue; }
          const rec = {
            date,
            weight_kg: c.weight_kg !== undefined ? round(cellNum(row[c.weight_kg]), 2) : null,
            kcal: c.kcal !== undefined ? round(cellNum(row[c.kcal]), 0) : null,
            protein_g: c.protein_g !== undefined ? round(cellNum(row[c.protein_g]), 0) : null,
            steps: c.steps !== undefined ? round(cellNum(row[c.steps]), 0) : null,
            sleep_h: c.sleep_h !== undefined ? round(sleepHours(row[c.sleep_h]), 2) : null,
            beer_chips: c.beer_chips !== undefined ? cellBool(row[c.beer_chips]) : null,
            note: c.note !== undefined ? cellText(row[c.note]) : null,
            now,
          };
          const hasData = ['weight_kg', 'kcal', 'protein_g', 'steps', 'sleep_h', 'beer_chips', 'note'].some((k) => rec[k] !== null);
          if (!hasData) continue;
          store.mergeDay(rec);
          r.rows++;
        }
        report.sheets['Дневник'] = r;
      }
    }

    // «Недели»
    const weeks = findSheet(sheets, /недел/);
    if (!weeks) report.warnings.push('Не найден лист «Недели»');
    else {
      const h = findHeader(weeks.rows, WEEKS_COLS, ['week']);
      if (!h) report.warnings.push('Лист «Недели»: не найдена колонка с номером недели');
      else {
        const r = { rows: 0, columns: ['waist_cm', 'planned_sessions', 'is_deload'].filter((k) => h.cols[k] !== undefined) };
        excelWeeks = [];
        for (const row of weeks.rows.slice(h.index + 1)) {
          const c = h.cols;
          const week = cellWeek(row[c.week]);
          if (week === null || week < 0 || week > 60) continue;
          const pick = (k, f = cellNum) => (c[k] !== undefined ? f(row[c[k]]) : null);
          excelWeeks.push({
            week,
            avg_weight: pick('avg_weight'), weight_change: pick('weight_change'), signal: pick('signal', cellText),
            avg_kcal: pick('avg_kcal'), avg_protein: pick('avg_protein'), avg_steps: pick('avg_steps'), avg_sleep: pick('avg_sleep'),
            done_sessions: pick('done_sessions'),
          });
          const waist = pick('waist_cm');
          const planned = pick('planned_sessions');
          const deload = c.is_deload !== undefined ? cellBool(row[c.is_deload]) : null;
          if (waist === null && planned === null && deload === null) continue;
          const patch = {};
          if (waist !== null) patch.waist_cm = round(waist, 1);
          if (planned !== null) patch.planned_sessions = Math.round(planned);
          if (deload !== null) patch.is_deload = deload;
          store.mergeWeek(week, patch);
          r.rows++;
        }
        report.sheets['Недели'] = r;
      }
    }

    // «Тренировки»
    const workouts = findSheet(sheets, /трениров/);
    if (!workouts) report.warnings.push('Не найден лист «Тренировки»');
    else report.sheets['Тренировки'] = importWorkouts(store, workouts, settings, report);

    // «Тесты»
    const tests = findSheet(sheets, /тест/);
    if (!tests) report.warnings.push('Не найден лист «Тесты»');
    else report.sheets['Тесты'] = importTests(store, tests, report);
  });

  if (excelWeeks) report.verification = verifyWeeks(store.summaryInputs(), excelWeeks);
  return report;
}

function sleepHours(v) {
  if (v && typeof v === 'object' && v.time !== undefined) return v.time / 3600;
  const s = String(v ?? '').trim();
  const m = s.match(/^(\d+):(\d{2})$/);
  if (m) return Number(m[1]) + Number(m[2]) / 60;
  return cellNum(v);
}

function importWorkouts(store, sheet, settings, report) {
  const r = { sessions: 0, sets: 0, skipped: 0 };
  let h = findHeader(sheet.rows, WORKOUT_COLS, ['date', 'exercise']);
  if (!h) {
    report.warnings.push('Лист «Тренировки»: нужны колонки «Дата» и «Упражнение» — лист пропущен');
    return r;
  }
  const header = sheet.rows[h.index];
  // Широкий формат: «Вес 1», «Повт 1», «Запас 1», …
  const wide = new Map();
  header.forEach((cell, i) => {
    const t = norm(cell);
    const m = t.match(/(\d+)/);
    if (!m) return;
    const n = Number(m[1]);
    if (n < 1 || n > 10) return;
    const slot = wide.get(n) || {};
    if (/вес|кг/.test(t)) slot.weight = i;
    else if (/запас|rir/.test(t)) slot.rir = i;
    else if (/повт|подход|сет|раз/.test(t)) slot.reps = i;
    wide.set(n, slot);
  });

  const phases = store.phases();
  const schedule = store.schedule();
  const allWorkouts = store.workouts();
  const findWorkout = (text, date) => {
    const t = norm(text);
    if (t) {
      const w = allWorkouts.find((w) => norm(w.code) === t || norm(w.name) === t)
        || allWorkouts.find((w) => t.includes(norm(w.name)) || norm(w.name).includes(t));
      if (w) return w;
    }
    const id = scheduledWorkoutId(date, settings, phases, schedule);
    return id ? allWorkouts.find((w) => w.id === id) : null;
  };
  const exByName = new Map(store.exercises().map((e) => [norm(e.name), e.id]));
  const exerciseId = (name) => {
    const key = norm(name);
    if (exByName.has(key)) return exByName.get(key);
    const id = store.createExercise(String(name).trim(), guessIncrement(name));
    exByName.set(key, id);
    report.created_exercises.push(String(name).trim());
    return id;
  };

  const touched = new Set();
  const counters = new Map();

  let lastDate = null;
  let lastWorkoutText = null;
  for (const row of sheet.rows.slice(h.index + 1)) {
    const c = h.cols;
    const exName = cellText(row[c.exercise]);
    const rawDate = cellDate(row[c.date]);
    if (rawDate) { lastDate = rawDate; lastWorkoutText = null; }
    const wText = c.workout !== undefined ? cellText(row[c.workout]) : null;
    if (wText) lastWorkoutText = wText;
    if (!exName) continue;
    const date = rawDate || lastDate;
    if (!date) { r.skipped++; continue; }
    const workout = findWorkout(lastWorkoutText, date);
    const sessionId = `imp-${date}-${workout ? workout.code : 'x'}`;
    if (!touched.has(sessionId)) {
      store.putImportSession(sessionId, date, workout ? workout.id : null, `${date}T00:00:00Z`);
      store.clearSets(sessionId);
      touched.add(sessionId);
      r.sessions++;
    }
    const exId = exerciseId(exName);
    const sets = [];
    if (wide.size && c.reps === undefined) {
      for (const [n, slot] of [...wide.entries()].sort((a, b) => a[0] - b[0])) {
        const reps = slot.reps !== undefined ? cellNum(row[slot.reps]) : null;
        if (reps === null) continue;
        const weight = slot.weight !== undefined ? cellNum(row[slot.weight]) : c.weight_kg !== undefined ? cellNum(row[c.weight_kg]) : null;
        const rir = slot.rir !== undefined ? cellNum(row[slot.rir]) : c.rir !== undefined ? cellNum(row[c.rir]) : null;
        sets.push({ n, weight, reps, rir });
      }
    } else {
      const weight = c.weight_kg !== undefined ? cellNum(row[c.weight_kg]) : null;
      const rir = c.rir !== undefined ? cellNum(row[c.rir]) : null;
      const repsCell = c.reps !== undefined ? row[c.reps] : null;
      const key = `${sessionId}|${exId}`;
      if (typeof repsCell === 'string' && /[/,;x×]/.test(repsCell)) {
        // «8/8/7» — несколько подходов с одним весом.
        const list = repsCell.split(/[/,;x×]/).map((s) => cellNum(s)).filter((x) => x !== null);
        let n = counters.get(key) || 0;
        for (const reps of list) sets.push({ n: ++n, weight, reps, rir });
        counters.set(key, n);
      } else {
        const reps = cellNum(repsCell);
        if (reps === null && weight === null) continue;
        let n = c.set_no !== undefined ? cellNum(row[c.set_no]) : null;
        if (n === null) n = (counters.get(key) || 0) + 1;
        counters.set(key, Math.max(n, counters.get(key) || 0));
        sets.push({ n, weight, reps, rir });
      }
    }
    for (const s of sets) {
      store.putSet(sessionId, exId, Math.round(s.n), round(s.weight, 2), s.reps === null ? null : Math.round(s.reps), s.rir === null ? null : Math.round(s.rir));
      r.sets++;
    }
  }
  return r;
}

function importTests(store, sheet, report) {
  const r = { rows: 0 };
  const save = (rec) => {
    const hasData = ['date', 'weight_kg', 'waist_cm', 'pullups', 'pushups', 'plank_sec', 'note'].some((k) => rec[k] !== null && rec[k] !== undefined) || rec.photo_done;
    if (!hasData) return;
    store.mergeTest({ date: null, weight_kg: null, waist_cm: null, pullups: null, pushups: null, plank_sec: null, photo_done: 0, note: null, ...rec });
    r.rows++;
  };

  const h = findHeader(sheet.rows, TESTS_COLS, ['week']);
  const looksRowWise = h && ['weight_kg', 'waist_cm', 'pullups', 'pushups', 'plank_sec'].some((k) => h.cols[k] !== undefined);
  if (looksRowWise) {
    for (const row of sheet.rows.slice(h.index + 1)) {
      const c = h.cols;
      const week = cellWeek(row[c.week]);
      if (week === null) continue;
      const g = (k, f) => (c[k] !== undefined ? f(row[c[k]]) : null);
      save({
        week_no: week, date: g('date', cellDate), weight_kg: round(g('weight_kg', cellNum), 2), waist_cm: round(g('waist_cm', cellNum), 1),
        pullups: g('pullups', cellNum), pushups: g('pushups', cellNum), plank_sec: g('plank_sec', cellSeconds),
        photo_done: g('photo_done', cellBool) || 0, note: g('note', cellText),
      });
    }
    return r;
  }

  // Транспонированный вид: строки — показатели, колонки — недели 0/6/14/24/32.
  for (let i = 0; i < Math.min(sheet.rows.length, 15); i++) {
    const row = sheet.rows[i] || [];
    const weekCols = [];
    row.forEach((v, j) => {
      if (j === 0) return;
      const t = norm(typeof v === 'object' && v ? '' : v);
      if (/^(нед(еля)?\.?\s*)?\d{1,2}$/.test(t)) weekCols.push([j, cellWeek(v)]);
    });
    if (weekCols.length < 2) continue;
    const recs = new Map(weekCols.map(([, w]) => [w, { week_no: w }]));
    for (const mrow of sheet.rows.slice(i + 1)) {
      const label = norm(mrow[0]);
      const key = Object.entries(TESTS_COLS).find(([k, rule]) => k !== 'week' && rule.match.test(label))?.[0];
      if (!key) continue;
      const f = key === 'date' ? cellDate : key === 'plank_sec' ? cellSeconds : key === 'photo_done' ? cellBool : key === 'note' ? cellText : cellNum;
      for (const [j, w] of weekCols) recs.get(w)[key] = f(mrow[j]);
    }
    for (const rec of recs.values()) save({ ...rec, photo_done: rec.photo_done || 0 });
    return r;
  }
  report.warnings.push('Лист «Тесты»: не удалось распознать таблицу');
  return r;
}

// Сверка: пересчитываем недели нашим кодом и сравниваем с кэшированными значениями формул Excel.
export function verifyWeeks(inputs, excelWeeks) {
  const rows = weeklySummary(inputs);
  const checks = [
    ['avg_weight', 'weight_kg', 0.011],
    ['weight_change', 'weight_change', 0.011],
    ['avg_kcal', 'kcal', 0.51],
    ['avg_protein', 'protein_g', 0.51],
    ['avg_steps', 'steps', 0.51],
    ['avg_sleep', 'sleep_h', 0.011],
  ];
  const labelToKey = Object.fromEntries(Object.entries(SIGNAL_LABELS).map(([k, v]) => [norm(v), k]));
  const result = { compared: 0, mismatches: [] };
  for (const ex of excelWeeks) {
    const ours = rows.find((r) => r.week === ex.week);
    if (!ours) continue;
    for (const [exKey, ourKey, tol] of checks) {
      const e = ex[exKey];
      if (e === null || e === undefined) continue;
      result.compared++;
      const o = ours[ourKey];
      if (o === null || Math.abs(o - e) > tol) result.mismatches.push({ week: ex.week, field: ourKey, excel: e, ours: o === null ? null : round(o, 3) });
    }
    if (ex.signal) {
      const expected = labelToKey[norm(ex.signal)];
      if (expected) {
        result.compared++;
        if (expected !== ours.signal) result.mismatches.push({ week: ex.week, field: 'signal', excel: ex.signal, ours: ours.signal ? SIGNAL_LABELS[ours.signal] : null });
      }
    }
  }
  return result;
}
