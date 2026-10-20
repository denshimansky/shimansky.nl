// Экран «Тренировка»: упражнения дня, прошлые веса, подсказка прибавки, запись подходов, таймер отдыха.

import * as api from '../api.js?v=d67a901a70f5';
import { h, mount, toast } from '../ui.js?v=d67a901a70f5';
import { fmtDateLong, fmtDateShort, fmtNum, parseNum, isIsoDate } from '../shared/dates.js?v=d67a901a70f5';
import { dayContext, scheduledWorkoutId, progression, formatSets, formatScheme, prescribedSets, hasFinisher, FINISHER } from '../shared/calc.js?v=d67a901a70f5';

const RIR_OPTIONS = [0, 1, 2, 3, 4];

function workoutPath(date, wid) {
  return `workout?date=${date}&workout_id=${wid}`;
}

function resolveRoute(args, app) {
  const { settings, phases, schedule } = app.boot;
  const date = isIsoDate(args[0]) ? args[0] : app.today;
  const wid = args[1] ? Number(args[1]) : scheduledWorkoutId(date, settings, phases, schedule);
  return { date, wid };
}

export async function onSynced(args, app) {
  const { date, wid } = resolveRoute(args, app);
  if (wid) api.get(workoutPath(date, wid)).catch(() => {});
}

// Применяем к данным сервера операции, которые ещё лежат в очереди (запись без сети).
function applyPending(data, date, wid) {
  let session = data.session ? { ...data.session, sets: [...data.session.sets] } : null;
  for (const op of api.pending()) {
    const m = op.path.match(/^sessions\/([^/]+)(?:\/sets\/(\d+)\/(\d+))?$/);
    if (!m) continue;
    const [, id, ex, n] = m;
    if (!ex) {
      if (op.method === 'PUT' && !session && op.body.date === date && Number(op.body.workout_id) === wid) {
        session = { id, notes: null, completed_at: null, sets: [] };
      }
      if (session && id === session.id) {
        if (op.method === 'DELETE') session = null;
        else {
          if (op.body.notes !== undefined) session.notes = op.body.notes;
          if (op.body.completed !== undefined) session.completed_at = op.body.completed ? session.completed_at || 'pending' : null;
        }
      }
    } else if (session && id === session.id) {
      session.sets = session.sets.filter((s) => !(s.exercise_id === Number(ex) && s.set_no === Number(n)));
      if (op.method === 'PUT') session.sets.push({ exercise_id: Number(ex), set_no: Number(n), ...op.body });
    }
  }
  return session;
}

// ——— Таймер отдыха (один на приложение, переживает перерисовки и перезагрузку) ———
const TIMER_KEY = 'fit:rest-until';
let timerInterval = null;
let audioCtx = null;

function beep() {
  try {
    if (!audioCtx) return;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.25, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);
    o.connect(g).connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + 0.6);
  } catch { /* звук необязателен */ }
}

function timerEl() {
  let el = document.getElementById('rest-timer');
  if (!el) {
    el = h('div', { id: 'rest-timer', class: 'rest-timer', hidden: true });
    document.body.append(el);
  }
  return el;
}

export function startRest(seconds) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    audioCtx.resume?.();
  } catch { /* нет Web Audio */ }
  try { localStorage.setItem(TIMER_KEY, String(Date.now() + seconds * 1000)); } catch { /* нет хранилища */ }
  runTimer();
}

function stopRest() {
  try { localStorage.removeItem(TIMER_KEY); } catch { /* нет хранилища */ }
  clearInterval(timerInterval);
  timerInterval = null;
  timerEl().hidden = true;
}

function runTimer() {
  const el = timerEl();
  clearInterval(timerInterval);
  const label = h('span', { class: 'rest-time' });
  mount(el,
    h('span', { class: 'muted' }, 'Отдых'), label,
    h('button', { class: 'chip-btn', onclick: () => startRest(90) }, '90'),
    h('button', { class: 'chip-btn', onclick: () => startRest(180) }, '180'),
    h('button', { class: 'chip-btn', 'aria-label': 'Остановить таймер', onclick: stopRest }, '✕'));
  el.hidden = false;
  el.classList.remove('finished');
  const tick = () => {
    let until = 0;
    try { until = Number(localStorage.getItem(TIMER_KEY) || 0); } catch { /* нет хранилища */ }
    const left = Math.round((until - Date.now()) / 1000);
    if (!until) return stopRest();
    if (left <= 0) {
      label.textContent = 'пора!';
      if (!el.classList.contains('finished')) {
        el.classList.add('finished');
        beep();
        navigator.vibrate?.([200, 100, 200]);
        setTimeout(() => { if (el.classList.contains('finished')) stopRest(); }, 8000);
      }
      return;
    }
    label.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  };
  tick();
  timerInterval = setInterval(tick, 250);
}

try { if (Number(localStorage.getItem(TIMER_KEY) || 0) > Date.now()) runTimer(); } catch { /* нет хранилища */ }

// ——— Экран ———
export async function render(container, args, app) {
  const { settings, phases, workouts, exercises } = app.boot;
  const { date, wid } = resolveRoute(args, app);
  const ctx = dayContext(date, settings, phases);

  if (!wid) {
    mount(container,
      h('header', { class: 'page-head' }, h('h1', null, 'Тренировка'), h('p', { class: 'muted' }, fmtDateLong(date))),
      h('p', null, 'По расписанию сегодня отдых. Можно выбрать тренировку:'),
      h('div', { class: 'list' }, workouts.map((w) => h('a', { class: 'list-item', href: `#/workout/${date}/${w.id}` }, w.name))));
    return;
  }

  const { data, stale } = await api.get(workoutPath(date, wid));
  const workout = data.workout;
  let session = applyPending(data, date, wid);
  const exById = new Map(exercises.map((e) => [e.id, e]));
  const sets = new Map();
  for (const s of session?.sets || []) sets.set(`${s.exercise_id}:${s.set_no}`, s);
  const drafts = new Map();
  const useSub = new Map(workout.items.map((it) => {
    const hasMain = [...sets.values()].some((s) => s.exercise_id === it.exercise_id);
    const hasSub = it.substitute_exercise_id && [...sets.values()].some((s) => s.exercise_id === it.substitute_exercise_id);
    return [it.id, !hasMain && !!hasSub];
  }));
  const extraRows = new Map();
  let justSaved = null;

  const ensureSession = () => {
    if (!session) {
      session = { id: crypto.randomUUID(), notes: null, completed_at: null, sets: [] };
      api.write('PUT', `sessions/${session.id}`, { date, workout_id: wid });
    }
    return session.id;
  };

  const phaseNo = ctx.phase?.phase_no ?? null;

  // Поля подхода по типу упражнения: [ключ записи, подпись, клавиатура, множитель ввода → запись].
  const FIELDS = {
    weight_reps: [['weight_kg', 'кг', 'decimal'], ['reps', 'повт', 'numeric']],
    reps: [['reps', 'повт', 'numeric']],
    time_sec: [['duration_sec', 'сек', 'numeric']],
    distance_m: [['weight_kg', 'кг', 'decimal'], ['distance_m', 'м', 'numeric']],
    cardio: [['duration_sec', 'мин', 'decimal', 60]],
  };
  const withRir = (kind) => kind === 'weight_reps' || kind === 'reps';

  function slotView(item) {
    const sub = useSub.get(item.id);
    const exId = sub ? item.substitute_exercise_id : item.exercise_id;
    const ex = exById.get(exId) || { name: '?', increment_kg: 2.5, kind: 'weight_reps' };
    const kind = ex.kind || 'weight_reps';
    const repMin = sub && item.sub_rep_min !== null && item.sub_rep_min !== undefined ? item.sub_rep_min : item.rep_min;
    const repMax = sub && item.sub_rep_max !== null && item.sub_rep_max !== undefined ? item.sub_rep_max : item.rep_max;
    const hist = data.history[exId];
    const planned = prescribedSets({ sets: item.sets, position: item.position, week: data.week, phaseNo, deload: data.deload });
    const prog = progression({ kind, lastSets: hist?.sets, sets: planned, repMin, repMax, increment: ex.increment_kg, deload: data.deload });
    const loggedNos = [...sets.values()].filter((s) => s.exercise_id === exId).map((s) => s.set_no);
    const rows = Math.max(planned, ...loggedNos, 0) + (extraRows.get(item.id) || 0);
    const fields = FIELDS[kind] || FIELDS.weight_reps;
    const box = h('section', { class: 'card slot' });

    const placeholder = (key, n) => {
      if (key === 'weight_kg') return prog.weight !== null && ex.increment_kg > 0 ? fmtNum(prog.weight, 2) : 'кг';
      const t = prog.repTargets[n - 1];
      if (key === 'duration_sec' && kind === 'cardio') return t ? String(t) : 'мин';
      return t !== null && t !== undefined ? String(t) : key === 'reps' ? 'повт' : '';
    };
    const shown = (key, saved) => {
      const v = saved?.[key];
      if (v === null || v === undefined) return '';
      if (key === 'duration_sec' && kind === 'cardio') return fmtNum(v / 60, 1).replace(/\s/g, '');
      return fmtNum(v, 2).replace(/\s/g, '');
    };

    const setRow = (n) => {
      const key = `${exId}:${n}`;
      const saved = sets.get(key);
      const draft = drafts.get(key) || {};
      const inputs = fields.map(([f, label, mode]) => h('input', {
        type: 'text', inputmode: mode, class: 'set-in', 'aria-label': `${label}, подход ${n}`,
        placeholder: placeholder(f, n),
        value: draft[f] ?? shown(f, saved),
        oninput: (e) => drafts.set(key, { ...drafts.get(key), [f]: e.target.value }),
      }));
      const rirSel = withRir(kind) ? h('select', {
        class: 'set-rir', 'aria-label': `Запас, подход ${n}`,
        onchange: (e) => drafts.set(key, { ...drafts.get(key), rir: e.target.value }),
      }, RIR_OPTIONS.map((v) => h('option', {
        value: v,
        selected: String(draft.rir ?? saved?.rir ?? item.rir_target ?? 2) === String(v),
      }, v === 4 ? '4+' : String(v)))) : null;
      const commit = () => {
        const body = { weight_kg: null, reps: null, rir: rirSel ? Number(rirSel.value) : null, duration_sec: null, distance_m: null };
        for (const [i, [f, label, , mult]] of fields.entries()) {
          const typed = parseNum(inputs[i].value);
          const fallback = f === 'weight_kg' ? (ex.increment_kg > 0 ? prog.weight : null) : prog.repTargets[n - 1];
          let v = typed ?? fallback;
          if (f === 'weight_kg' && v === null && ex.increment_kg > 0) { toast('Введите вес', 'bad'); inputs[i].focus(); return; }
          if (f !== 'weight_kg' && (v === null || v < 0)) { toast(`Введите: ${label}`, 'bad'); inputs[i].focus(); return; }
          if (v !== null && mult) v *= mult;
          body[f] = v === null ? null : f === 'weight_kg' || f === 'distance_m' ? v : Math.round(v);
        }
        const sid = ensureSession();
        api.write('PUT', `sessions/${sid}/sets/${exId}/${n}`, body);
        sets.set(key, { exercise_id: exId, set_no: n, ...body });
        drafts.delete(key);
        justSaved = key;
        if (kind !== 'cardio') startRest(kind === 'weight_reps' && repMax && repMax <= 6 ? 180 : kind === 'time_sec' ? 60 : 90);
        redraw();
        justSaved = null;
      };
      const remove = () => {
        if (!session) return;
        api.write('DELETE', `sessions/${session.id}/sets/${exId}/${n}`);
        sets.delete(key);
        drafts.delete(key);
        redraw();
      };
      return h('div', { class: ['set-row', saved ? 'saved' : ''] },
        h('span', { class: 'set-no' }, n),
        inputs[0],
        h('span', { class: 'x' }, inputs[1] ? '×' : ''),
        inputs[1] || h('span'),
        rirSel || h('span'),
        h('button', { class: ['check-btn', saved ? 'on' : '', key === justSaved ? 'just' : ''], 'aria-label': saved ? `Пересохранить подход ${n}` : `Записать подход ${n}`, onclick: commit }, '✓'),
        saved ? h('button', { class: 'icon-btn small', 'aria-label': `Удалить подход ${n}`, onclick: remove }, '✕') : h('span', { class: 'icon-btn small placeholder' }));
    };

    function redraw() {
      const box2 = slotView(item);
      box.replaceWith(box2);
    }

    mount(box,
      h('div', { class: 'slot-head' },
        h('h3', null, ex.name),
        h('span', { class: 'muted' }, formatScheme({ kind, sets: planned, repMin, repMax, rir: item.rir_target }))),
      item.substitute_exercise_id ? h('label', { class: 'sub-toggle' },
        h('input', { type: 'checkbox', checked: sub, onchange: (e) => { useSub.set(item.id, e.target.checked); redraw(); } }),
        sub ? ` Замена вместо: ${item.exercise_name}` : ` Замена: ${item.substitute_name}`) : null,
      h('p', { class: 'history' }, hist ? `В прошлый раз (${fmtDateShort(hist.date)}): ${formatSets(hist.sets, kind)}` : 'В прошлый раз: нет записей'),
      prog.kind !== 'none' || kind === 'cardio' ? h('p', { class: ['hint', prog.kind === 'up' ? 'up' : prog.kind === 'deload' ? 'deload' : ''] },
        ex.increment_kg > 0 && prog.weight !== null ? h('strong', null, `${fmtNum(prog.weight, 2)} кг`) : null,
        ex.increment_kg > 0 && prog.weight !== null ? ' · ' : '',
        prog.text) : null,
      h('div', { class: 'set-head' }, h('span'), h('span', null, fields[0][1]), h('span'), h('span', null, fields[1]?.[1] || ''),
        h('span', null, withRir(kind) ? 'запас' : ''), h('span'), h('span')),
      Array.from({ length: rows }, (_, i) => setRow(i + 1)),
      kind === 'cardio' ? null : h('button', { class: 'link-btn', onclick: () => { extraRows.set(item.id, (extraRows.get(item.id) || 0) + 1); redraw(); } }, '+ подход'));
    return box;
  }

  // Фаза 3: после «Низ A/B» — финишер 8–10 минут, один из вариантов кардио. Пишется подходом кардио-упражнения.
  function finisherView() {
    const variants = exercises.filter((e) => e.kind === 'cardio');
    const box = h('section', { class: 'card slot finisher' });
    const draw = () => {
      const done = [...sets.values()].find((s) => variants.some((v) => v.id === s.exercise_id) && s.duration_sec > 0);
      if (done) {
        mount(box, h('div', { class: 'slot-head' }, h('h3', null, `Финишер ${FINISHER.minMin}–${FINISHER.maxMin} мин`)),
          h('div', { class: 'row-between' },
            h('span', { class: 'good' }, `✓ ${exById.get(done.exercise_id)?.name} · ${fmtNum(done.duration_sec / 60, 0)} мин`),
            h('button', { class: 'icon-btn small', 'aria-label': 'Удалить финишер', onclick: () => {
              api.write('DELETE', `sessions/${session.id}/sets/${done.exercise_id}/${done.set_no}`);
              sets.delete(`${done.exercise_id}:${done.set_no}`);
              draw();
            } }, '✕')));
        return;
      }
      const pick = h('select', { 'aria-label': 'Вариант финишера' }, variants.map((v) => h('option', { value: v.id }, v.name)));
      const mins = h('input', { type: 'text', inputmode: 'numeric', class: 'set-in', placeholder: String(FINISHER.maxMin), 'aria-label': 'Минуты' });
      mount(box, h('div', { class: 'slot-head' }, h('h3', null, `Финишер ${FINISHER.minMin}–${FINISHER.maxMin} мин`), h('span', { class: 'muted' }, 'фаза 3')),
        pick,
        h('div', { class: 'inline-form' }, mins, h('span', { class: 'unit' }, 'мин'),
          h('button', { class: 'btn small primary', onclick: () => {
            const m = parseNum(mins.value) ?? FINISHER.maxMin;
            if (m <= 0 || m > 120) { toast('Введите минуты', 'bad'); return; }
            const exId = Number(pick.value);
            const body = { weight_kg: null, reps: null, rir: null, duration_sec: Math.round(m * 60), distance_m: null };
            api.write('PUT', `sessions/${ensureSession()}/sets/${exId}/1`, body);
            sets.set(`${exId}:1`, { exercise_id: exId, set_no: 1, ...body });
            draw();
          } }, 'Сделано')));
    };
    draw();
    return variants.length ? box : null;
  }

  const notes = h('textarea', {
    rows: 2, placeholder: 'Заметки к тренировке', value: session?.notes || '',
    onchange: (e) => {
      const sid = ensureSession();
      session.notes = e.target.value.trim() || null;
      api.write('PUT', `sessions/${sid}`, { date, workout_id: wid, notes: session.notes });
    },
  });

  const finishBtn = () => (session?.completed_at
    ? h('button', { class: 'btn wide', onclick: () => { session.completed_at = null; api.write('PUT', `sessions/${session.id}`, { date, workout_id: wid, completed: false }); app.rerender(); } }, '✓ Завершена · возобновить')
    : h('button', { class: 'btn primary wide', onclick: () => {
      const sid = ensureSession();
      session.completed_at = new Date().toISOString();
      api.write('PUT', `sessions/${sid}`, { date, workout_id: wid, completed: true });
      stopRest();
      toast('Тренировка записана');
      app.go(date === app.today ? '#/today' : `#/today/${date}`);
    } }, 'Завершить тренировку'));

  const switcher = h('select', {
    class: 'workout-switch', 'aria-label': 'Выбрать тренировку',
    onchange: (e) => app.go(`#/workout/${date}/${e.target.value}`),
  }, workouts.map((w) => h('option', { value: w.id, selected: w.id === wid }, w.name)));

  mount(container,
    h('header', { class: 'page-head' },
      h('div', { class: 'row-between' }, h('h1', null, workout.name), switcher),
      h('p', { class: 'muted' }, `${fmtDateLong(date)} · неделя ${ctx.week}`, stale ? h('span', { class: 'chip' }, 'офлайн') : null)),
    data.deload ? h('p', { class: 'banner warn' }, 'Разгрузочная неделя: половина подходов, вес −10% от последнего рабочего.') : null,
    !data.deload && data.week >= 1 && data.week <= 2 ? h('p', { class: 'banner' }, 'Недели 1–2: на один подход меньше, чем в программе.') : null,
    workout.items.length && workout.items.every((it) => exById.get(it.exercise_id)?.kind === 'cardio')
      ? h('p', { class: 'muted' }, 'Выберите один вариант и запишите минуты.') : null,
    workout.items.length ? workout.items.map(slotView) : h('p', { class: 'muted' }, 'В программе нет упражнений — добавьте их в «Настройках».'),
    hasFinisher(workout.code, phaseNo) ? finisherView() : null,
    notes,
    finishBtn());
}
