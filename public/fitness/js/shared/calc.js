// Расчёты трекера (раздел «Расчёты» брифа). Чистые функции без доступа к БД:
// один и тот же код работает на сервере, в браузере и в тестах.

import { weekNo, weekRange, isoWeekday } from './dates.js';

export const TOTAL_WEEKS = 32;
export const TEST_WEEKS = [0, 6, 14, 24, 32];
const EPS = 1e-9;

// Расчёт 2: фаза по таблице phases; неделя 0 — подготовка без целей.
export function phaseForWeek(week, phases) {
  if (week < 1) return null;
  return phases.find((p) => week >= p.week_from && week <= p.week_to) || null;
}

// Расчёт 3: цели дня берутся из фазы текущей недели.
export function dayContext(date, settings, phases) {
  const week = weekNo(date, settings.week1_start);
  const phase = phaseForWeek(week, phases);
  return {
    week,
    phase,
    targets: phase
      ? { kcal: phase.kcal_target, protein_g: phase.protein_target_g, steps: phase.steps_target }
      : { kcal: null, protein_g: null, steps: null },
  };
}

export function scheduledWorkoutId(date, settings, phases, schedule) {
  const { phase } = dayContext(date, settings, phases);
  if (!phase) return null;
  const wd = isoWeekday(date);
  const row = schedule.find((s) => s.phase_no === phase.phase_no && s.weekday === wd);
  return row ? row.workout_id : null;
}

function mean(values) {
  const xs = values.filter((v) => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v)));
  if (!xs.length) return null;
  return xs.reduce((a, b) => a + Number(b), 0) / xs.length;
}

const AVG_FIELDS = ['weight_kg', 'kcal', 'protein_g', 'steps', 'sleep_h'];

// Расчёт 4: средние по заполненным дням недели; пустые дни не считаются нулями.
export function weeklyAverages(daily, settings) {
  const byWeek = new Map();
  for (const d of daily) {
    const w = weekNo(d.date, settings.week1_start);
    if (!byWeek.has(w)) byWeek.set(w, []);
    byWeek.get(w).push(d);
  }
  const out = new Map();
  for (const [w, days] of byWeek) {
    const row = { days: days.length };
    for (const f of AVG_FIELDS) row[f] = mean(days.map((d) => d[f]));
    row.beer_chips_days = days.filter((d) => d.beer_chips === 1 || d.beer_chips === true).length;
    out.set(w, row);
  }
  return out;
}

// Расчёт 6: «Быстро» / «Стоит» / «В норме».
export const SIGNAL_LABELS = { fast: 'Быстро', stall: 'Стоит', ok: 'В норме' };

export function paceSignal(change, paceLimit) {
  if (change === null || change === undefined || paceLimit === null || paceLimit === undefined) return null;
  if (change < -paceLimit - EPS) return 'fast';
  if (change > -0.1 + EPS) return 'stall';
  return 'ok';
}

export function plannedSessionsDefault(week, phases, schedule) {
  const phase = phaseForWeek(week, phases);
  if (!phase) return 0;
  return schedule.filter((s) => s.phase_no === phase.phase_no && s.workout_id).length;
}

// Сводка по неделям 0…N: как лист «Недели» Excel-трекера.
export function weeklySummary({ settings, phases, daily, weekly = [], sessions = [], schedule = [], tests = [], lastWeek }) {
  const avgs = weeklyAverages(daily, settings);
  const weeklyMap = new Map(weekly.map((w) => [w.week_no, w]));
  const testsMap = new Map(tests.map((t) => [t.week_no, t]));
  const maxPhaseWeek = phases.reduce((m, p) => Math.max(m, p.week_to), 0);
  const maxDataWeek = Math.max(0, ...avgs.keys());
  const n = Math.max(lastWeek ?? TOTAL_WEEKS, maxPhaseWeek, maxDataWeek);

  const done = new Map();
  for (const s of sessions) {
    if (!s.completed_at) continue;
    const w = weekNo(s.date, settings.week1_start);
    done.set(w, (done.get(w) || 0) + 1);
  }

  const rows = [];
  for (let w = 0; w <= n; w++) {
    const a = avgs.get(w) || { days: 0, beer_chips_days: 0 };
    const wl = weeklyMap.get(w) || {};
    const phase = phaseForWeek(w, phases);
    const prev = rows[w - 1];
    const weight = a.weight_kg ?? null;
    // Расчёт 5: изменение = средний вес недели − средний вес прошлой; пусто, если одной нет.
    const change = prev && prev.weight_kg !== null && weight !== null ? weight - prev.weight_kg : null;
    const waist = wl.waist_cm ?? testsMap.get(w)?.waist_cm ?? null;
    const range = weekRange(w, settings.week1_start);
    rows.push({
      week: w,
      from: range.from,
      to: range.to,
      phase_no: phase ? phase.phase_no : null,
      days: a.days,
      weight_kg: weight,
      kcal: a.kcal ?? null,
      protein_g: a.protein_g ?? null,
      steps: a.steps ?? null,
      sleep_h: a.sleep_h ?? null,
      beer_chips_days: a.beer_chips_days,
      weight_change: change,
      signal: phase ? paceSignal(change, phase.pace_limit_kg) : null,
      waist_cm: waist,
      is_deload: !!wl.is_deload,
      // Расчёт 10: факт тренировок — число завершённых sessions, сравнивается с планом.
      planned_sessions: wl.planned_sessions ?? plannedSessionsDefault(w, phases, schedule),
      done_sessions: done.get(w) || 0,
    });
  }
  return rows;
}

// Расчёт 7: рекомендация по калориям по неделе evalWeek (обычно последняя завершённая).
export function calorieRecommendation(rows, evalWeek) {
  const at = (w) => rows.find((r) => r.week === w);
  const cur = at(evalWeek);
  if (!cur) return null;
  const s = (w) => at(w)?.signal ?? null;

  if (s(evalWeek) === 'fast' && s(evalWeek - 1) === 'fast') {
    return { kind: 'more', weeks: [evalWeek - 1, evalWeek], text: '+150 ккал', reason: 'Вес уходит быстрее нормы 2 недели подряд.' };
  }
  if (s(evalWeek) === 'stall' && s(evalWeek - 1) === 'stall' && s(evalWeek - 2) === 'stall') {
    const start = at(evalWeek - 3)?.waist_cm ?? null;
    const end = cur.waist_cm ?? null;
    const waistChange = start !== null && end !== null ? end - start : null;
    const weeks = [evalWeek - 2, evalWeek - 1, evalWeek];
    if (waistChange !== null && waistChange <= -0.5 + EPS) {
      return { kind: 'recomp', weeks, waistChange, text: 'Рекомпозиция идёт, ничего не менять', reason: 'Вес стоит 3 недели, но талия уменьшилась на 0,5 см и больше.' };
    }
    if (waistChange === null || waistChange >= -EPS) {
      return {
        kind: 'less', weeks, waistChange,
        text: '−150 ккал или +2 000 шагов',
        reason: waistChange === null
          ? 'Вес стоит 3 недели подряд; талия за эти недели не введена.'
          : 'Вес стоит 3 недели подряд, и талия не уменьшилась.',
      };
    }
  }
  return null;
}

function roundTo(x, step) {
  return Math.round(x / step) * step;
}

// Расчёт 8 и 9: подсказка веса на тренировке.
// lastSets — подходы этого упражнения из последней тренировки вне разгрузочных недель.
export function progression({ lastSets, sets, repMin, repMax, increment, deload = false }) {
  const logged = (lastSets || []).filter((s) => s.weight_kg !== null && s.weight_kg !== undefined && s.reps !== null && s.reps !== undefined);
  if (!logged.length) return { kind: 'none', weight: null, sets, repTarget: repMin, text: 'Прошлых данных нет — подберите рабочий вес' };
  const working = Math.max(...logged.map((s) => Number(s.weight_kg)));
  if (deload) {
    const w = Math.max(0, roundTo(working * 0.9, 0.5));
    const half = Math.max(1, Math.ceil(sets / 2));
    return { kind: 'deload', weight: w, sets: half, repTarget: repMin, text: `Разгрузка: ${half} × ${repMin}–${repMax}, вес −10%` };
  }
  const allHit = logged.every((s) => Number(s.reps) >= repMax && s.rir !== null && s.rir !== undefined && Number(s.rir) >= 1);
  if (allHit && increment > 0) {
    return { kind: 'up', weight: working + increment, sets, repTarget: repMin, text: `Прибавить ${String(increment).replace('.', ',')} кг, цель ${repMin} повт.` };
  }
  if (allHit) {
    return { kind: 'reps', weight: working, sets, repTarget: repMax + 1, text: 'Тот же вес, больше повторов' };
  }
  return { kind: 'same', weight: working, sets, repTarget: repMax, text: `Тот же вес, цель ${repMax} повт.` };
}

// «60 кг × 8/8/7»; при разных весах — группами: «60 × 8/8 · 62,5 × 6».
export function formatSets(sets) {
  const logged = (sets || []).filter((s) => s.reps !== null && s.reps !== undefined);
  if (!logged.length) return '';
  const fmt = (x) => (x === null || x === undefined ? '—' : String(Math.round(x * 100) / 100).replace('.', ','));
  const groups = [];
  for (const s of logged) {
    const last = groups[groups.length - 1];
    if (last && last.w === s.weight_kg) last.reps.push(s.reps);
    else groups.push({ w: s.weight_kg, reps: [s.reps] });
  }
  if (groups.length === 1) {
    const g = groups[0];
    return g.w === null || g.w === undefined || g.w === 0 ? `${g.reps.join('/')} повт.` : `${fmt(g.w)} кг × ${g.reps.join('/')}`;
  }
  return groups.map((g) => `${fmt(g.w)} × ${g.reps.join('/')}`).join(' · ');
}

// Последняя завершённая неделя относительно сегодняшней.
export function lastCompletedWeek(today, settings) {
  return weekNo(today, settings.week1_start) - 1;
}
