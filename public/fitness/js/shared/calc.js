// Расчёты трекера (раздел «Расчёты» брифа). Чистые функции без доступа к БД:
// один и тот же код работает на сервере, в браузере и в тестах.

import { weekNo, weekRange, isoWeekday } from './dates.js?v=d67a901a70f5';

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
export function weeklySummary({ settings, phases, daily, weekly = [], sessions = [], schedule = [], tests = [], pullups = [], lastWeek }) {
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

  // Подтягивания дома: сумма повторов и подходов за неделю.
  const pull = new Map();
  for (const p of pullups) {
    const w = weekNo(p.date, settings.week1_start);
    const cur = pull.get(w) || { reps: 0, sets: 0 };
    pull.set(w, { reps: cur.reps + (p.reps_total || 0), sets: cur.sets + (p.sets || 0) });
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
      pullup_reps: pull.get(w)?.reps ?? 0,
      pullup_sets: pull.get(w)?.sets ?? 0,
      checkin_at: wl.checkin_at ?? null,
    });
  }
  return rows;
}

// Расчёт 7: рекомендация по калориям по неделе evalWeek (обычно последняя завершённая).
// source = 'macrofactor': цель ведёт MacroFactor — вместо «±150 ккал» так и пишем, сигнал темпа остаётся.
export function calorieRecommendation(rows, evalWeek, { source = 'plan' } = {}) {
  const rec = planRecommendation(rows, evalWeek);
  if (rec && source === 'macrofactor' && (rec.kind === 'more' || rec.kind === 'less')) {
    return { ...rec, kind: 'macrofactor', text: 'Цель ведёт MacroFactor' };
  }
  return rec;
}

function planRecommendation(rows, evalWeek) {
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

// Подходы на сегодня по правилам плана (база — из программы, position — место упражнения с 1):
// недели 1–2 — на 1 меньше (минимум 2); фаза 4 — базовые (позиции 1–2) не больше 3, остальные не больше 2;
// разгрузка — половина.
export function prescribedSets({ sets, position, week, phaseNo, deload = false }) {
  let n = sets;
  if (week >= 1 && week <= 2) n = Math.max(Math.min(2, sets), sets - 1);
  if (phaseNo === 4) n = Math.min(n, position <= 2 ? 3 : 2);
  if (deload) n = Math.max(1, Math.ceil(n / 2));
  return n;
}

// Фаза 3: после «Низ A» и «Низ B» — финишер 8–10 минут.
export const FINISHER = { codes: ['LOWER_A', 'LOWER_B'], phase: 3, minMin: 8, maxMin: 10 };
export function hasFinisher(workoutCode, phaseNo) {
  return phaseNo === FINISHER.phase && FINISHER.codes.includes(workoutCode);
}

// Фаза 4: плюс 3 кардио по 15–20 минут в неделю.
export function weeklyCardioTarget(phaseNo) {
  return phaseNo === 4 ? 3 : 0;
}

export const isAmrap = (repMin, repMax) => !repMin && !repMax;
const has = (v) => v !== null && v !== undefined;
const fmtKg = (x) => String(x).replace('.', ',');

// Расчёт 8 и 9: подсказка на тренировке по типу упражнения (kind).
// lastSets — подходы этого упражнения из последней тренировки вне разгрузочных недель.
// repMin/repMax — повторы, секунды или метры (по типу); 0–0 — «до запаса».
// Возвращает weight (кг) и repTargets[i] — цель для подхода i (повторы, секунды или метры).
export function progression({ kind = 'weight_reps', lastSets, sets, repMin, repMax, increment, deload = false }) {
  const amrap = isAmrap(repMin, repMax);
  const res = (kind2, weight, targets, text) => ({
    kind: kind2, weight, sets, repTarget: Array.isArray(targets) ? targets[0] ?? null : targets,
    repTargets: Array.from({ length: sets }, (_, i) => (Array.isArray(targets) ? targets[Math.min(i, targets.length - 1)] ?? null : targets)), text,
  });
  const all = lastSets || [];

  if (kind === 'cardio') {
    const done = all.filter((s) => has(s.duration_sec));
    const last = done.length ? Math.round(done.reduce((a, s) => a + Number(s.duration_sec), 0) / 60) : null;
    return res('none', null, repMax || null, last ? `В прошлый раз ${last} мин` : `Цель ${repMin}–${repMax} мин`);
  }

  if (kind === 'time_sec') {
    const done = all.filter((s) => has(s.duration_sec));
    if (!done.length) return res('none', null, repMin, `Начните с ${repMin} с`);
    const best = Math.max(...done.map((s) => Number(s.duration_sec)));
    if (deload) return res('deload', null, best, 'Разгрузка: половина подходов, то же время');
    return res('up', null, best + 5, `+5–10 с к прошлому разу (было ${best} с)`);
  }

  if (kind === 'reps') {
    const done = all.filter((s) => has(s.reps));
    if (!done.length) {
      return res('none', null, amrap ? null : repMin, amrap ? 'Прошлых данных нет — сколько получится, с запасом' : 'Прошлых данных нет — начните с нижней границы');
    }
    const reps = done.map((s) => Number(s.reps));
    if (deload) return res('deload', null, reps, 'Разгрузка: половина подходов, повторы как в прошлый раз');
    if (!amrap && reps.every((r) => r >= repMax)) return res('harder', null, repMax, `Все подходы по ${repMax} — усложните вариант`);
    return res('reps', null, reps.map((r) => (amrap ? r + 1 : Math.min(r + 1, repMax))), '+1 повтор в каждом подходе');
  }

  if (kind === 'distance_m') {
    const done = all.filter((s) => has(s.weight_kg) && has(s.distance_m));
    if (!done.length) return res('none', null, repMax, 'Прошлых данных нет — подберите вес');
    const working = Math.max(...done.map((s) => Number(s.weight_kg)));
    if (deload) return res('deload', Math.max(0, roundTo(working * 0.9, 0.5)), repMax, 'Разгрузка: половина подходов, вес −10%');
    if (done.every((s) => Number(s.distance_m) >= repMax) && increment > 0) {
      return res('up', working + increment, repMax, `Прибавить ${fmtKg(increment)} кг, та же дистанция`);
    }
    return res('same', working, repMax, `Тот же вес, цель ${repMax} м`);
  }

  const logged = all.filter((s) => has(s.weight_kg) && has(s.reps));
  if (!logged.length) return res('none', null, amrap ? null : repMin, 'Прошлых данных нет — подберите рабочий вес');
  const working = Math.max(...logged.map((s) => Number(s.weight_kg)));
  if (deload) {
    return res('deload', Math.max(0, roundTo(working * 0.9, 0.5)), repMin || null, 'Разгрузка: половина подходов, вес −10%');
  }
  const allHit = !amrap && logged.every((s) => Number(s.reps) >= repMax && has(s.rir) && Number(s.rir) >= 1);
  if (allHit && increment > 0) return res('up', working + increment, repMin, `Прибавить ${fmtKg(increment)} кг, цель ${repMin} повт.`);
  if (allHit) return res('reps', working, repMax + 1, 'Тот же вес, больше повторов');
  return res('same', working, amrap ? null : repMax, amrap ? 'Тот же вес, с запасом' : `Тот же вес, цель ${repMax} повт.`);
}

// Схема упражнения для подписи: «3 × 8–10», «3 × 30–45 с», «3 × 40 м», «8–10 мин», «2 × до запаса 2».
export function formatScheme({ kind = 'weight_reps', sets, repMin, repMax, rir }) {
  const range = repMin === repMax ? `${repMin}` : `${repMin}–${repMax}`;
  if (kind === 'cardio') return `${range} мин`;
  if (isAmrap(repMin, repMax)) return `${sets} × до запаса ${rir ?? 2}`;
  const unit = kind === 'time_sec' ? ' с' : kind === 'distance_m' ? ' м' : '';
  return `${sets} × ${range}${unit}${has(rir) && kind !== 'time_sec' && kind !== 'distance_m' ? ` · запас ${rir}` : ''}`;
}

// «60 кг × 8/8/7»; при разных весах — группами: «60 × 8/8 · 62,5 × 6».
// Для других типов: «45/40 с», «24 кг × 30/30 м», «18 мин», «8/7 повт.».
export function formatSets(sets, kind = 'weight_reps') {
  const fmt = (x) => (x === null || x === undefined ? '—' : String(Math.round(x * 100) / 100).replace('.', ','));
  const all = sets || [];
  if (kind === 'cardio') {
    const secs = all.filter((s) => has(s.duration_sec)).reduce((a, s) => a + Number(s.duration_sec), 0);
    return secs ? `${Math.round(secs / 60)} мин` : '';
  }
  if (kind === 'time_sec') {
    const xs = all.filter((s) => has(s.duration_sec));
    return xs.length ? `${xs.map((s) => s.duration_sec).join('/')} с` : '';
  }
  const valKey = kind === 'distance_m' ? 'distance_m' : 'reps';
  const unit = kind === 'distance_m' ? ' м' : '';
  const logged = all.filter((s) => has(s[valKey]));
  if (!logged.length) return '';
  const groups = [];
  for (const s of logged) {
    const last = groups[groups.length - 1];
    if (last && last.w === s.weight_kg) last.reps.push(fmt(s[valKey]));
    else groups.push({ w: s.weight_kg, reps: [fmt(s[valKey])] });
  }
  if (groups.length === 1) {
    const g = groups[0];
    return g.w === null || g.w === undefined || g.w === 0 ? `${g.reps.join('/')}${unit || ' повт.'}` : `${fmt(g.w)} кг × ${g.reps.join('/')}${unit}`;
  }
  return groups.map((g) => `${fmt(g.w)} × ${g.reps.join('/')}${unit}`).join(' · ');
}

// Последняя завершённая неделя относительно сегодняшней.
export function lastCompletedWeek(today, settings) {
  return weekNo(today, settings.week1_start) - 1;
}
