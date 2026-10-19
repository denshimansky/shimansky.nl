// Локальный режим: те же адреса и ответы, что у серверного API (src/api.js),
// но данные лежат в объекте state, который js/local/persist.js хранит в IndexedDB на устройстве.

import { todayIn, weekNo } from '../shared/dates.js';
import { weeklySummary, calorieRecommendation } from '../shared/calc.js';
import { HttpError, bad, DAILY_FIELDS, WAIST, num, intOrNull, text, requireDate, beerChips, workoutCode } from '../shared/validate.js';
import { DEFAULT_SETTINGS, DEFAULT_PHASES, DEFAULT_DELOAD_WEEKS, DEFAULT_EXERCISES, DEFAULT_WORKOUTS, DEFAULT_SCHEDULE } from '../shared/seed.js';
import { TABLE_COLUMNS, toCsv } from '../shared/csv.js';
import { importWorkbook } from '../shared/importer.js';

export const STATE_FORMAT = 'shimansky-fitness';

export function initialState(now = new Date().toISOString()) {
  const exercises = DEFAULT_EXERCISES.map(([name, increment_kg], i) => ({ id: i + 1, name, increment_kg }));
  const exId = (name) => exercises.find((e) => e.name === name).id;
  const workouts = [];
  const items = [];
  DEFAULT_WORKOUTS.forEach((w, wi) => {
    workouts.push({ id: wi + 1, code: w.code, name: w.name, phase_from: w.phase_from, phase_to: w.phase_to });
    w.items.forEach(([name, sets, rep_min, rep_max, rir_target, sub], i) => {
      items.push({ id: items.length + 1, workout_id: wi + 1, position: i + 1, exercise_id: exId(name), sets, rep_min, rep_max, rir_target, substitute_exercise_id: sub ? exId(sub) : null });
    });
  });
  const weekly = {};
  for (const w of DEFAULT_DELOAD_WEEKS) weekly[w] = { week_no: w, waist_cm: null, planned_sessions: null, is_deload: 1 };
  return {
    format: STATE_FORMAT,
    version: 1,
    settings: { id: 1, ...DEFAULT_SETTINGS },
    phases: DEFAULT_PHASES.map((p) => ({ ...p })),
    daily_log: {},
    weekly_log: weekly,
    exercises,
    workouts,
    workout_exercises: items,
    schedule: DEFAULT_SCHEDULE.map(([phase_no, weekday, code]) => ({ phase_no, weekday, workout_id: workouts.find((w) => w.code === code).id })),
    sessions: {},
    set_logs: {},
    tests: {},
    seq: { exercises: exercises.length, workouts: workouts.length, workout_exercises: items.length },
    meta: { created_at: now, last_backup_at: null },
  };
}

export function validateState(s) {
  if (!s || s.format !== STATE_FORMAT || typeof s.version !== 'number') throw bad('Это не резервная копия трекера формы');
  for (const k of ['settings', 'phases', 'daily_log', 'weekly_log', 'exercises', 'workouts', 'workout_exercises', 'schedule', 'sessions', 'set_logs', 'tests', 'seq']) {
    if (!(k in s)) throw bad(`В копии нет раздела ${k}`);
  }
  return s;
}

const setKey = (sid, ex, n) => `${sid}|${ex}|${n}`;
const byName = (a, b) => a.name.localeCompare(b.name, 'ru');

// backend.state можно заменить целиком (восстановление из копии); commit() сохраняет его.
export function createBackend(initial, { commit = async () => {}, now = () => new Date() } = {}) {
  const b = { state: initial };
  const S = () => b.state;
  const routes = [];
  const route = (method, pattern, handler) => {
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
    routes.push({ method, re, keys, handler, write: method !== 'GET' });
  };

  const today = () => todayIn(S().settings.timezone, now());
  const phasesSorted = () => [...S().phases].sort((a, c) => a.phase_no - c.phase_no);
  const deloads = () => new Set(Object.values(S().weekly_log).filter((w) => w.is_deload).map((w) => w.week_no));
  const exercise = (id) => S().exercises.find((e) => e.id === id) || null;

  function workoutsWithItems() {
    return [...S().workouts].sort((a, c) => a.phase_from - c.phase_from || (a.code < c.code ? -1 : a.code > c.code ? 1 : 0)).map((w) => ({
      ...w,
      items: S().workout_exercises.filter((i) => i.workout_id === w.id).sort((a, c) => a.position - c.position).map((i) => {
        const e = exercise(i.exercise_id);
        const se = i.substitute_exercise_id ? exercise(i.substitute_exercise_id) : null;
        return { ...i, exercise_name: e?.name ?? '?', increment_kg: e?.increment_kg ?? 2.5, substitute_name: se?.name ?? null, substitute_increment_kg: se?.increment_kg ?? null };
      }),
    }));
  }

  function summaryInputs() {
    const st = S();
    return {
      settings: st.settings,
      phases: phasesSorted(),
      daily: Object.values(st.daily_log),
      weekly: Object.values(st.weekly_log),
      sessions: Object.values(st.sessions).map((s) => ({ date: s.date, completed_at: s.completed_at })),
      schedule: st.schedule,
      tests: Object.values(st.tests),
    };
  }

  function sessionWithSets(id) {
    const s = S().sessions[id];
    if (!s) return null;
    const sets = Object.values(S().set_logs).filter((x) => x.session_id === id)
      .sort((a, c) => a.exercise_id - c.exercise_id || a.set_no - c.set_no)
      .map(({ exercise_id, set_no, weight_kg, reps, rir }) => ({ exercise_id, set_no, weight_kg, reps, rir }));
    return { ...s, sets };
  }

  function lastSetsFor(exerciseId, beforeDate, excludeId) {
    const groups = new Map();
    for (const x of Object.values(S().set_logs)) {
      if (x.exercise_id !== exerciseId || x.session_id === excludeId) continue;
      const s = S().sessions[x.session_id];
      if (!s || s.date > beforeDate) continue;
      if (!groups.has(s.id)) groups.set(s.id, { session_id: s.id, date: s.date, sets: [] });
      groups.get(s.id).sets.push({ set_no: x.set_no, weight_kg: x.weight_kg, reps: x.reps, rir: x.rir });
    }
    const sorted = [...groups.values()].sort((a, c) => (a.date === c.date ? (a.session_id < c.session_id ? 1 : -1) : a.date < c.date ? 1 : -1));
    for (const g of sorted) g.sets.sort((a, c) => a.set_no - c.set_no);
    const dl = deloads();
    return sorted.find((g) => !dl.has(weekNo(g.date, S().settings.week1_start))) || null;
  }

  function ensureWeek(week) {
    if (!S().weekly_log[week]) S().weekly_log[week] = { week_no: week, waist_cm: null, planned_sessions: null, is_deload: 0 };
    return S().weekly_log[week];
  }

  // ——— Хранилище для общего импорта xlsx ———
  const importStore = {
    settings: () => S().settings,
    phases: phasesSorted,
    schedule: () => S().schedule,
    workouts: () => S().workouts,
    exercises: () => S().exercises,
    summaryInputs,
    transaction(fn) {
      const backup = JSON.stringify(b.state);
      try {
        return fn();
      } catch (e) {
        b.state = JSON.parse(backup);
        throw e;
      }
    },
    mergeDay(rec) {
      const cur = S().daily_log[rec.date] || { date: rec.date, weight_kg: null, kcal: null, protein_g: null, steps: null, sleep_h: null, beer_chips: null, note: null };
      for (const k of ['weight_kg', 'kcal', 'protein_g', 'steps', 'sleep_h', 'beer_chips', 'note']) if (rec[k] !== null && rec[k] !== undefined) cur[k] = rec[k];
      cur.updated_at = rec.now;
      S().daily_log[rec.date] = cur;
    },
    mergeWeek(week, patch) { Object.assign(ensureWeek(week), patch); },
    createExercise(name, increment_kg) {
      const id = ++S().seq.exercises;
      S().exercises.push({ id, name, increment_kg });
      return id;
    },
    putImportSession(id, date, workout_id, completed_at) {
      const cur = S().sessions[id];
      S().sessions[id] = { id, date, workout_id, notes: cur?.notes ?? null, completed_at: cur?.completed_at ?? completed_at, source: cur?.source ?? 'import' };
    },
    clearSets(sid) {
      for (const [k, x] of Object.entries(S().set_logs)) if (x.session_id === sid) delete S().set_logs[k];
    },
    putSet(session_id, exercise_id, set_no, weight_kg, reps, rir) {
      S().set_logs[setKey(session_id, exercise_id, set_no)] = { session_id, exercise_id, set_no, weight_kg, reps, rir };
    },
    mergeTest(rec) {
      const cur = S().tests[rec.week_no] || { week_no: rec.week_no, date: null, weight_kg: null, waist_cm: null, pullups: null, pushups: null, plank_sec: null, photo_done: 0, note: null };
      for (const k of ['date', 'weight_kg', 'waist_cm', 'pullups', 'pushups', 'plank_sec', 'note']) if (rec[k] !== null && rec[k] !== undefined) cur[k] = rec[k];
      cur.photo_done = Math.max(cur.photo_done || 0, rec.photo_done || 0);
      S().tests[rec.week_no] = cur;
    },
  };

  route('GET', '/bootstrap', () => ({
    settings: S().settings,
    today: today(),
    phases: phasesSorted(),
    weekly: Object.values(S().weekly_log).sort((a, c) => a.week_no - c.week_no),
    exercises: [...S().exercises].sort(byName),
    workouts: workoutsWithItems(),
    schedule: [...S().schedule].sort((a, c) => a.phase_no - c.phase_no || a.weekday - c.weekday),
    passkeys: 0,
    mail: false,
    local: {
      last_backup_at: S().meta.last_backup_at,
      created_at: S().meta.created_at,
      days_logged: Object.keys(S().daily_log).length,
    },
  }));

  // ——— Дневник ———
  route('GET', '/day/:date', ({ params }) => {
    const date = requireDate(params.date);
    const prev = Object.values(S().daily_log).filter((d) => d.date < date && d.weight_kg !== null && d.weight_kg !== undefined)
      .sort((a, c) => (a.date < c.date ? 1 : -1))[0];
    return {
      log: S().daily_log[date] ? { ...S().daily_log[date] } : { date },
      prev_weight: prev ? { date: prev.date, weight_kg: prev.weight_kg } : null,
      week: weekNo(date, S().settings.week1_start),
      sessions: Object.values(S().sessions).filter((s) => s.date === date).map(({ id, workout_id, completed_at }) => ({ id, workout_id, completed_at })),
    };
  });

  route('PATCH', '/day/:date', ({ params, body }) => {
    const date = requireDate(params.date);
    if (date > today()) throw bad('Нельзя заполнять будущие дни');
    const row = { date, weight_kg: null, kcal: null, protein_g: null, steps: null, sleep_h: null, beer_chips: null, note: null, ...S().daily_log[date] };
    for (const [k, v] of Object.entries(body || {})) {
      if (DAILY_FIELDS[k]) row[k] = num(v, DAILY_FIELDS[k], k);
      else if (k === 'beer_chips') row[k] = beerChips(v);
      else if (k === 'note') row[k] = text(v, 1000);
      else throw bad(`Неизвестное поле ${k}`);
    }
    row.updated_at = now().toISOString();
    S().daily_log[date] = row;
    return { log: { ...row } };
  });

  route('GET', '/days', ({ query }) => {
    const from = requireDate(query.get('from'));
    const to = requireDate(query.get('to'));
    return { days: Object.values(S().daily_log).filter((d) => d.date >= from && d.date <= to).sort((a, c) => (a.date < c.date ? -1 : 1)) };
  });

  // ——— Тренировки ———
  route('GET', '/workout', ({ query }) => {
    const date = requireDate(query.get('date'));
    const workoutId = Number(query.get('workout_id'));
    const workout = workoutsWithItems().find((w) => w.id === workoutId);
    if (!workout) throw new HttpError(404, 'Тренировка не найдена');
    const count = (id) => Object.values(S().set_logs).filter((x) => x.session_id === id).length;
    const candidates = Object.values(S().sessions).filter((s) => s.date === date && s.workout_id === workoutId)
      .sort((a, c) => count(c.id) - count(a.id) || (a.id < c.id ? -1 : 1));
    const session = candidates.length ? sessionWithSets(candidates[0].id) : null;
    const history = {};
    for (const item of workout.items) {
      for (const exId of [item.exercise_id, item.substitute_exercise_id]) {
        if (exId && !(exId in history)) history[exId] = lastSetsFor(exId, date, session?.id);
      }
    }
    const week = weekNo(date, S().settings.week1_start);
    return { date, week, deload: deloads().has(week), workout, session, history };
  });

  route('PUT', '/sessions/:id', ({ params, body }) => {
    const id = String(params.id);
    if (!/^[\w-]{8,64}$/.test(id)) throw bad('Неверный id тренировки');
    const date = requireDate(body.date);
    const workoutId = body.workout_id === null || body.workout_id === undefined ? null : Number(body.workout_id);
    if (workoutId !== null && !S().workouts.some((w) => w.id === workoutId)) throw bad('Нет такой тренировки');
    const existing = S().sessions[id];
    const completedAt = body.completed === undefined
      ? existing?.completed_at ?? null
      : body.completed ? existing?.completed_at || body.completed_at || now().toISOString() : null;
    S().sessions[id] = {
      id, date, workout_id: workoutId,
      notes: body.notes === undefined ? existing?.notes ?? null : text(body.notes),
      completed_at: completedAt,
      source: existing?.source || 'app',
    };
    return { session: sessionWithSets(id) };
  });

  route('DELETE', '/sessions/:id', ({ params }) => {
    const id = String(params.id);
    delete S().sessions[id];
    importStore.clearSets(id);
    return { ok: true };
  });

  route('PUT', '/sessions/:id/sets/:exercise/:setNo', ({ params, body }) => {
    const id = String(params.id);
    if (!S().sessions[id]) throw new HttpError(404, 'Тренировка не найдена');
    const exerciseId = Number(params.exercise);
    if (!exercise(exerciseId)) throw bad('Нет такого упражнения');
    const setNo = intOrNull(params.setNo, 1, 20, 'set_no');
    importStore.putSet(id, exerciseId, setNo,
      num(body.weight_kg, [0, 500, false], 'weight_kg'), intOrNull(body.reps, 0, 200, 'reps'), intOrNull(body.rir, 0, 10, 'rir'));
    return { ok: true };
  });

  route('DELETE', '/sessions/:id/sets/:exercise/:setNo', ({ params }) => {
    delete S().set_logs[setKey(String(params.id), Number(params.exercise), Number(params.setNo))];
    return { ok: true };
  });

  // ——— Прогресс ———
  route('GET', '/progress', () => {
    const rows = weeklySummary(summaryInputs());
    const currentWeek = weekNo(today(), S().settings.week1_start);
    const evalWeek = currentWeek - 1;
    return {
      today: today(), currentWeek, evalWeek,
      goals: { weight_kg: S().settings.goal_weight_kg, waist_cm: S().settings.goal_waist_cm },
      rows,
      recommendation: evalWeek >= 2 ? calorieRecommendation(rows, evalWeek) : null,
    };
  });

  route('PUT', '/weeks/:week', ({ params, body }) => {
    const week = intOrNull(params.week, 0, 60, 'week');
    const w = ensureWeek(week);
    if ('waist_cm' in body) w.waist_cm = num(body.waist_cm, WAIST, 'waist_cm');
    if ('planned_sessions' in body) w.planned_sessions = intOrNull(body.planned_sessions, 0, 14, 'planned_sessions');
    if ('is_deload' in body) w.is_deload = body.is_deload ? 1 : 0;
    return { week: { ...w } };
  });

  // ——— Тесты ———
  route('GET', '/tests', () => ({ tests: Object.values(S().tests).sort((a, c) => a.week_no - c.week_no) }));

  route('PUT', '/tests/:week', ({ params, body }) => {
    const week = intOrNull(params.week, 0, 60, 'week');
    const rec = {
      week_no: week,
      date: body.date ? requireDate(body.date) : null,
      weight_kg: num(body.weight_kg, DAILY_FIELDS.weight_kg, 'weight_kg'),
      waist_cm: num(body.waist_cm, WAIST, 'waist_cm'),
      pullups: intOrNull(body.pullups, 0, 200, 'pullups'),
      pushups: intOrNull(body.pushups, 0, 500, 'pushups'),
      plank_sec: intOrNull(body.plank_sec, 0, 3600, 'plank_sec'),
      photo_done: body.photo_done ? 1 : 0,
      note: text(body.note, 1000),
    };
    S().tests[week] = rec;
    return { test: { ...rec } };
  });

  // ——— Настройки ———
  route('PUT', '/settings', ({ body }) => {
    const next = { ...S().settings };
    if ('week1_start' in body) next.week1_start = requireDate(body.week1_start);
    if ('timezone' in body) {
      try { todayIn(body.timezone); } catch { throw bad('Неизвестный часовой пояс'); }
      next.timezone = body.timezone;
    }
    if ('goal_weight_kg' in body) next.goal_weight_kg = num(body.goal_weight_kg, DAILY_FIELDS.weight_kg, 'goal_weight_kg');
    if ('goal_waist_cm' in body) next.goal_waist_cm = num(body.goal_waist_cm, WAIST, 'goal_waist_cm');
    S().settings = next;
    return { settings: next };
  });

  route('PUT', '/phases/:no', ({ params, body }) => {
    const no = intOrNull(params.no, 1, 20, 'phase_no');
    const rec = {
      phase_no: no,
      name: text(body.name, 80) || `Фаза ${no}`,
      week_from: intOrNull(body.week_from, 1, 60, 'week_from'),
      week_to: intOrNull(body.week_to, 1, 60, 'week_to'),
      kcal_target: intOrNull(body.kcal_target, 0, 10000, 'kcal_target'),
      protein_target_g: intOrNull(body.protein_target_g, 0, 600, 'protein_target_g'),
      steps_target: intOrNull(body.steps_target, 0, 150000, 'steps_target'),
      pace_limit_kg: num(body.pace_limit_kg, [0, 5, false], 'pace_limit_kg'),
    };
    if (rec.week_from === null || rec.week_to === null || rec.week_from > rec.week_to) throw bad('Неверные границы фазы');
    S().phases = [...S().phases.filter((p) => p.phase_no !== no), rec];
    return { phases: phasesSorted() };
  });

  route('PUT', '/schedule/:phase', ({ params, body }) => {
    const phase = intOrNull(params.phase, 1, 20, 'phase');
    const rows = [];
    for (const [wd, wid] of Object.entries(body.days || {})) {
      if (!wid) continue;
      rows.push({ phase_no: phase, weekday: intOrNull(wd, 1, 7, 'weekday'), workout_id: Number(wid) });
    }
    S().schedule = [...S().schedule.filter((s) => s.phase_no !== phase), ...rows];
    return { schedule: [...S().schedule].sort((a, c) => a.phase_no - c.phase_no || a.weekday - c.weekday) };
  });

  route('PUT', '/deloads', ({ body }) => {
    const weeks = (body.weeks || []).map((w) => intOrNull(w, 1, 60, 'week'));
    for (const w of Object.values(S().weekly_log)) w.is_deload = 0;
    for (const w of weeks) ensureWeek(w).is_deload = 1;
    return { weekly: Object.values(S().weekly_log).sort((a, c) => a.week_no - c.week_no) };
  });

  route('POST', '/exercises', ({ body }) => {
    const name = text(body.name, 120);
    if (!name) throw bad('Нужно название упражнения');
    if (S().exercises.some((e) => e.name === name)) throw bad('Такое упражнение уже есть');
    const id = importStore.createExercise(name, num(body.increment_kg ?? 2.5, [0, 50, false], 'increment_kg'));
    return { exercise: { ...exercise(id) } };
  });

  route('PUT', '/exercises/:id', ({ params, body }) => {
    const cur = exercise(Number(params.id));
    if (!cur) throw new HttpError(404, 'Нет такого упражнения');
    cur.name = text(body.name, 120) || cur.name;
    if (body.increment_kg !== undefined) cur.increment_kg = num(body.increment_kg, [0, 50, false], 'increment_kg');
    return { exercise: { ...cur } };
  });

  const saveWorkout = (id, body) => {
    const code = workoutCode(body.code);
    const name = text(body.name, 80);
    if (!code || !name) throw bad('Нужны код и название тренировки');
    if (S().workouts.some((w) => w.code === code && w.id !== id)) throw bad('Тренировка с таким кодом уже есть');
    const phaseFrom = intOrNull(body.phase_from ?? 1, 1, 20, 'phase_from');
    const phaseTo = intOrNull(body.phase_to ?? 4, 1, 20, 'phase_to');
    let items = null;
    if (Array.isArray(body.items)) {
      items = body.items.map((it, i) => {
        const repMin = intOrNull(it.rep_min, 1, 100, 'rep_min');
        const repMax = intOrNull(it.rep_max, 1, 100, 'rep_max');
        if (repMin === null || repMax === null || repMin > repMax) throw bad('Неверный диапазон повторов');
        if (!exercise(Number(it.exercise_id))) throw bad('Нет такого упражнения');
        return {
          position: i + 1, exercise_id: Number(it.exercise_id), sets: intOrNull(it.sets, 1, 10, 'sets'), rep_min: repMin, rep_max: repMax,
          rir_target: intOrNull(it.rir_target, 0, 5, 'rir_target'), substitute_exercise_id: it.substitute_exercise_id ? Number(it.substitute_exercise_id) : null,
        };
      });
    }
    let wid = id;
    if (wid) Object.assign(S().workouts.find((w) => w.id === wid), { code, name, phase_from: phaseFrom, phase_to: phaseTo });
    else {
      wid = ++S().seq.workouts;
      S().workouts.push({ id: wid, code, name, phase_from: phaseFrom, phase_to: phaseTo });
    }
    if (items) {
      S().workout_exercises = S().workout_exercises.filter((i) => i.workout_id !== wid);
      for (const it of items) S().workout_exercises.push({ id: ++S().seq.workout_exercises, workout_id: wid, ...it });
    }
    return wid;
  };

  route('POST', '/workouts', ({ body }) => {
    const id = saveWorkout(null, body);
    return { workout: workoutsWithItems().find((w) => w.id === id) };
  });

  route('PUT', '/workouts/:id', ({ params, body }) => {
    const id = Number(params.id);
    if (!S().workouts.some((w) => w.id === id)) throw new HttpError(404, 'Тренировка не найдена');
    saveWorkout(id, body);
    return { workout: workoutsWithItems().find((w) => w.id === id) };
  });

  route('DELETE', '/workouts/:id', ({ params }) => {
    const id = Number(params.id);
    S().workouts = S().workouts.filter((w) => w.id !== id);
    S().workout_exercises = S().workout_exercises.filter((i) => i.workout_id !== id);
    S().schedule = S().schedule.filter((s) => s.workout_id !== id);
    for (const s of Object.values(S().sessions)) if (s.workout_id === id) s.workout_id = null;
    return { ok: true };
  });

  route('POST', '/import', async ({ raw }) => {
    if (!raw || raw.byteLength < 100) throw bad('Пустой файл');
    try {
      return { report: await importWorkbook(importStore, raw) };
    } catch (e) {
      if (e instanceof HttpError) throw e;
      throw bad(`Не удалось прочитать xlsx: ${e.message}`);
    }
  });

  // Последовательно: запись не начнётся, пока не сохранилась предыдущая.
  let chain = Promise.resolve();

  b.handle = async (method, path, body, raw) => {
    const url = new URL(path.replace(/^\/?/, '/'), 'fit://local');
    for (const r of routes) {
      if (r.method !== method) continue;
      const m = url.pathname.match(r.re);
      if (!m) continue;
      const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
      if (!r.write) return structuredClone(await r.handler({ params, body: body || {}, query: url.searchParams }));
      const run = chain.then(async () => {
        const before = JSON.stringify(b.state);
        try {
          const result = await r.handler({ params, body: body || {}, raw, query: url.searchParams });
          await commit(b.state);
          return structuredClone(result);
        } catch (e) {
          b.state = JSON.parse(before);
          throw e;
        }
      });
      chain = run.catch(() => {});
      return run;
    }
    throw new HttpError(404, 'Не найдено');
  };

  b.exportCsv = (table) => {
    const cols = TABLE_COLUMNS[table];
    if (!cols) return null;
    const st = S();
    const rows = {
      settings: [st.settings],
      phases: phasesSorted(),
      daily_log: Object.values(st.daily_log).sort((a, c) => (a.date < c.date ? -1 : 1)),
      weekly_log: Object.values(st.weekly_log).sort((a, c) => a.week_no - c.week_no),
      exercises: [...st.exercises].sort((a, c) => a.id - c.id),
      workouts: [...st.workouts].sort((a, c) => a.id - c.id),
      workout_exercises: [...st.workout_exercises].sort((a, c) => a.workout_id - c.workout_id || a.position - c.position),
      schedule: [...st.schedule].sort((a, c) => a.phase_no - c.phase_no || a.weekday - c.weekday),
      sessions: Object.values(st.sessions).sort((a, c) => (a.date === c.date ? (a.id < c.id ? -1 : 1) : a.date < c.date ? -1 : 1)),
      set_logs: Object.values(st.set_logs).sort((a, c) => (a.session_id < c.session_id ? -1 : a.session_id > c.session_id ? 1 : a.exercise_id - c.exercise_id || a.set_no - c.set_no)),
      tests: Object.values(st.tests).sort((a, c) => a.week_no - c.week_no),
    }[table];
    return toCsv(cols, rows);
  };

  // Резервная копия — весь state; отметка о сохранении пишется только после успешной выгрузки.
  b.backupJson = () => JSON.stringify(b.state);
  b.markBackedUp = async () => {
    b.state.meta.last_backup_at = now().toISOString();
    await commit(b.state);
  };
  b.restore = async (json) => {
    const next = validateState(typeof json === 'string' ? JSON.parse(json) : json);
    chain = chain.then(async () => {
      b.state = next;
      await commit(b.state);
    });
    await chain;
  };

  return b;
}
