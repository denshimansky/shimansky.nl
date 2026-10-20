// Экран «Сегодня»: ежедневный ввод за 30 секунд.

import * as api from '../api.js';
import { h, mount, sheet, toast } from '../ui.js';
import { addDays, fmtDateLong, fmtNum, fmtSigned, parseNum, diffDays, isIsoDate, isoWeekday } from '../shared/dates.js';
import { dayContext, scheduledWorkoutId, weeklyCardioTarget } from '../shared/calc.js';
import { calorieSource, effectiveTargets, beerLimit } from '../shared/nutrition.js';
import { needsBackup, daysSinceBackup, saveBackup } from '../backup.js';

const FIELDS = [
  { key: 'weight_kg', label: 'Вес', unit: 'кг', digits: 1, mode: 'decimal', min: 30, max: 300 },
  { key: 'kcal', label: 'Калории', unit: 'ккал', target: 'kcal', dir: 'max', digits: 0, mode: 'numeric', min: 0, max: 10000 },
  { key: 'protein_g', label: 'Белок', unit: 'г', target: 'protein_g', dir: 'min', digits: 0, mode: 'numeric', min: 0, max: 600 },
  { key: 'steps', label: 'Шаги', unit: '', target: 'steps', dir: 'min', digits: 0, mode: 'numeric', min: 0, max: 150000 },
  { key: 'sleep_h', label: 'Сон', unit: 'ч', digits: 1, mode: 'decimal', min: 0, max: 24 },
];

export async function render(container, args, app) {
  const { settings, phases, schedule, workouts, weekly } = app.boot;
  let date = isIsoDate(args[0]) ? args[0] : app.today;
  if (date > app.today) date = app.today;
  const ctx = dayContext(date, settings, phases);
  const deload = weekly.some((w) => w.week_no === ctx.week && w.is_deload);

  const { data, stale } = await api.get(`day/${date}`);
  // Цель калорий (и белка, если есть) — из MacroFactor, если так выбрано в «Настройках».
  ctx.targets = effectiveTargets(ctx.targets, calorieSource(settings, (app.boot.nutrition?.imports || 0) > 0), data.mf_target);
  const log = { ...data.log };
  for (const op of api.pending()) if (op.method === 'PATCH' && op.path === `day/${date}`) Object.assign(log, op.body);
  const savedBeer = data.log.beer_chips === 1 ? 1 : 0;
  const pull = { ...(data.pullups || { sets: 0, reps_total: 0 }) };
  for (const op of api.pending()) if (op.method === 'PUT' && op.path === `pullups/${date}`) Object.assign(pull, op.body);

  const go = (d) => app.go(d === app.today ? '#/today' : `#/today/${d}`);

  const header = h('header', { class: 'day-head' },
    h('button', { class: 'icon-btn', 'aria-label': 'Предыдущий день', onclick: () => go(addDays(date, -1)) }, '‹'),
    h('div', { class: 'day-title' },
      h('h1', null, date === app.today ? 'Сегодня' : fmtDateLong(date)),
      h('p', { class: 'muted' },
        date === app.today ? fmtDateLong(date) + ' · ' : '',
        ctx.week === 0 ? `Неделя 0 · подготовка, до старта ${diffDays(settings.week1_start, date)} дн.` : `Неделя ${ctx.week} · ${ctx.phase ? ctx.phase.name : 'вне плана'}`,
        deload ? h('span', { class: 'chip warn' }, 'разгрузка') : null,
        stale ? h('span', { class: 'chip' }, 'офлайн') : null)),
    h('button', { class: 'icon-btn', 'aria-label': 'Следующий день', disabled: date >= app.today, onclick: () => go(addDays(date, 1)) }, '›'));

  const grid = h('div', { class: 'cards' });
  const extra = h('div');

  const save = (patch) => {
    Object.assign(log, patch);
    api.write('PATCH', `day/${date}`, patch);
    draw();
  };

  function openInput(idx) {
    const f = FIELDS[idx];
    const target = f.target ? ctx.targets[f.target] : null;
    const input = h('input', {
      class: 'big-input', type: 'text', inputmode: f.mode, autocomplete: 'off', enterkeyhint: idx < FIELDS.length - 1 ? 'next' : 'done',
      value: log[f.key] === null || log[f.key] === undefined ? '' : fmtNum(log[f.key], f.digits).replace(/\s/g, ''),
      'aria-label': f.label,
    });
    const err = h('p', { class: 'error-text' });
    const commit = () => {
      const v = parseNum(input.value);
      if (input.value.trim() !== '' && (v === null || v < f.min || v > f.max)) {
        err.textContent = `Число от ${f.min} до ${fmtNum(f.max, 0)}`;
        return false;
      }
      if ((log[f.key] ?? null) !== v) save({ [f.key]: v });
      return true;
    };
    const next = () => {
      if (!commit()) return;
      close();
      if (idx < FIELDS.length - 1) openInput(idx + 1);
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); next(); } });
    const close = sheet(f.label, h('div', { class: 'sheet-body' },
      h('div', { class: 'input-row' }, input, h('span', { class: 'unit' }, f.unit)),
      target ? h('p', { class: 'muted' }, `Цель: ${f.dir === 'max' ? 'не больше' : 'не меньше'} ${fmtNum(target, 0)} ${f.unit}`) : null,
      err,
      h('div', { class: 'sheet-actions' },
        h('button', { class: 'btn ghost', onclick: () => { input.value = ''; } }, 'Очистить'),
        h('button', { class: 'btn', onclick: () => { if (commit()) close(); } }, 'Готово'),
        idx < FIELDS.length - 1 ? h('button', { class: 'btn primary', onclick: next }, 'Далее →') : null)));
  }

  function openNote() {
    const ta = h('textarea', { rows: 4, maxlength: 1000, value: log.note || '' });
    const close = sheet('Заметка', h('div', { class: 'sheet-body' }, ta,
      h('div', { class: 'sheet-actions' },
        h('button', { class: 'btn primary', onclick: () => { save({ note: ta.value.trim() || null }); close(); } }, 'Сохранить'))));
  }

  function card(f, idx) {
    const v = log[f.key];
    const target = f.target ? ctx.targets[f.target] : null;
    let sub = null;
    let bar = null;
    if (target) {
      const ratio = v ? v / target : 0;
      const state = v === null || v === undefined ? '' : f.dir === 'max' ? (v <= target ? 'good' : 'warn') : v >= target ? 'good' : '';
      sub = h('span', { class: 'muted' }, `цель ${fmtNum(target, 0)}${ctx.targets.source === 'macrofactor' && f.key !== 'steps' ? ' · MF' : ''}`);
      bar = h('div', { class: 'bar' }, h('div', { class: `bar-fill ${state}`, style: { width: `${Math.min(100, ratio * 100)}%` } }));
    } else if (f.key === 'weight_kg' && data.prev_weight) {
      const d = v !== null && v !== undefined ? v - data.prev_weight.weight_kg : null;
      sub = h('span', { class: 'muted' }, `было ${fmtNum(data.prev_weight.weight_kg, 1)}`, d === null ? '' : ` · ${fmtSigned(d, 1)}`);
    }
    return h('button', { class: ['card', 'metric', v === null || v === undefined ? 'empty' : ''], onclick: () => openInput(idx) },
      h('span', { class: 'metric-label' }, f.label),
      h('span', { class: 'metric-value' }, v === null || v === undefined ? '—' : fmtNum(v, f.digits), v !== null && v !== undefined && f.unit ? h('small', null, ' ' + f.unit) : null),
      sub, bar);
  }

  function beerCard() {
    const v = log.beer_chips;
    const pick = (val) => save({ beer_chips: v === val ? null : val });
    // Бюджет недели: 2 вечера, в фазе 4 — 1. Сверх лимита — спокойная подсказка, без красного.
    const count = (data.week_beer ?? 0) - savedBeer + (v === 1 ? 1 : 0);
    const limit = beerLimit(ctx.phase?.phase_no ?? null);
    return h('div', { class: 'card metric' },
      h('span', { class: 'metric-label' }, 'Пиво / чипсы'),
      h('div', { class: 'seg' },
        h('button', { class: ['seg-btn', v === 0 ? 'on good' : ''], 'aria-pressed': String(v === 0), onclick: () => pick(0) }, 'Нет'),
        h('button', { class: ['seg-btn', v === 1 ? 'on warn' : ''], 'aria-pressed': String(v === 1), onclick: () => pick(1) }, 'Было')),
      h('span', { class: 'muted' }, `вечеров на неделе: ${count} из ${limit}`),
      count > limit ? h('span', { class: 'muted small' }, 'Сверх лимита — не страшно, просто учтём в неделе.') : null);
  }

  // Подтягивания дома: «+1 подход» на 1–3 повтора, сумма за день.
  function pullupCard() {
    const add = (reps) => {
      pull.sets += 1;
      pull.reps_total += reps;
      api.write('PUT', `pullups/${date}`, { sets: pull.sets, reps_total: pull.reps_total });
      draw();
    };
    const open = () => {
      const close = sheet('Подход подтягиваний', h('div', { class: 'sheet-body' },
        h('p', { class: 'muted' }, 'Сколько повторов?'),
        h('div', { class: 'seg big' }, [1, 2, 3].map((n) => h('button', { class: 'seg-btn', onclick: () => { add(n); close(); } }, String(n)))),
        pull.sets ? h('button', { class: 'link-btn', onclick: () => {
          if (!confirm('Обнулить подтягивания за этот день?')) return;
          pull.sets = 0;
          pull.reps_total = 0;
          api.write('PUT', `pullups/${date}`, { sets: 0, reps_total: 0 });
          close();
          draw();
        } }, 'Обнулить день') : null));
    };
    return h('div', { class: ['card', 'metric', pull.sets ? '' : 'empty'] },
      h('span', { class: 'metric-label' }, 'Подтягивания дома'),
      h('span', { class: 'metric-value' }, pull.reps_total ? String(pull.reps_total) : '—', pull.reps_total ? h('small', null, ' повт.') : null),
      h('span', { class: 'muted' }, pull.sets ? `подходов: ${pull.sets}` : 'турник дома'),
      h('button', { class: 'btn small', onclick: open }, '+1 подход'));
  }

  function workoutBlock() {
    const wid = scheduledWorkoutId(date, settings, phases, schedule);
    const sessions = data.sessions || [];
    const items = [];
    const byId = (id) => workouts.find((w) => w.id === id);
    if (wid) {
      const done = sessions.find((s) => s.workout_id === wid && s.completed_at);
      items.push(h('a', { class: ['btn', 'primary', 'wide', done ? 'done' : ''], href: `#/workout/${date}/${wid}` },
        done ? `✓ ${byId(wid)?.name} — выполнена` : `Тренировка: ${byId(wid)?.name} →`));
    }
    for (const s of sessions) {
      if (s.workout_id === wid || !byId(s.workout_id)) continue;
      items.push(h('a', { class: 'btn wide', href: `#/workout/${date}/${s.workout_id}` }, `${s.completed_at ? '✓ ' : ''}${byId(s.workout_id).name}`));
    }
    // Фаза 4: цель недели — 3 кардио по 15–20 минут.
    const cardioTarget = weeklyCardioTarget(ctx.phase?.phase_no);
    const cardio = workouts.find((w) => w.code === 'CARDIO');
    if (cardioTarget && cardio) {
      const n = data.week_cardio ?? 0;
      items.push(h('a', { class: ['btn', 'wide', n >= cardioTarget ? 'done' : ''], href: `#/workout/${date}/${cardio.id}` },
        `Кардио на неделе: ${Math.min(n, cardioTarget)} из ${cardioTarget}${n >= cardioTarget ? ' ✓' : ' · 15–20 мин →'}`));
    }
    items.push(h('button', { class: 'link-btn', onclick: pickWorkout }, wid ? 'Другая тренировка' : 'Тренировка вне расписания'));
    return h('div', { class: 'workout-cta' }, items);
  }

  function pickWorkout() {
    const phaseNo = ctx.phase?.phase_no ?? 1;
    const list = [...workouts].sort((a, b) => {
      const fa = phaseNo >= a.phase_from && phaseNo <= a.phase_to ? 0 : 1;
      const fb = phaseNo >= b.phase_from && phaseNo <= b.phase_to ? 0 : 1;
      return fa - fb || a.name.localeCompare(b.name);
    });
    const close = sheet('Какая тренировка?', h('div', { class: 'sheet-body list' },
      list.map((w) => h('a', { class: 'list-item', href: `#/workout/${date}/${w.id}`, onclick: () => close() },
        w.name, h('span', { class: 'muted' }, phaseNo >= w.phase_from && phaseNo <= w.phase_to ? '' : ' · другая фаза')))));
  }

  function draw() {
    mount(grid, FIELDS.map(card), beerCard(), pullupCard());
    mount(extra,
      h('button', { class: 'note-row', onclick: openNote }, h('span', { class: 'muted' }, 'Заметка'), h('span', null, log.note || 'добавить')),
      workoutBlock());
  }
  draw();

  // Свайп влево-вправо листает дни.
  let x0 = null;
  let y0 = null;
  container.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  container.addEventListener('touchend', (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    const dy = e.changedTouches[0].clientY - y0;
    x0 = null;
    if (Math.abs(dx) > 70 && Math.abs(dy) < 50) {
      if (dx > 0) go(addDays(date, -1));
      else if (date < app.today) go(addDays(date, 1));
    }
  }, { passive: true });

  if (stale && !api.status().online) toast('Нет сети — ввод сохранится и уйдёт позже');
  // Локальный режим: данные только на телефоне — раз в неделю просим сохранить копию.
  let reminder = null;
  if (needsBackup(app.boot, app.today)) {
    const since = daysSinceBackup(app.boot, app.today);
    reminder = h('div', { class: 'banner warn row-between' },
      h('span', null, since === null ? 'Данные хранятся только на этом телефоне. Сохраните резервную копию.' : `Резервной копии ${since} дн. Сохраните свежую.`),
      h('button', { class: 'btn small', onclick: async () => {
        try {
          if (await saveBackup(settings.timezone)) { await app.reloadBoot(); toast('Копия сохранена'); app.rerender(); }
        } catch (e) {
          toast(e.message, 'bad');
        }
      } }, 'Сохранить'));
  }

  // Воскресенье: чек-ин недели, пока не пройден.
  const week = weekly.find((w) => w.week_no === ctx.week);
  const checkin = date === app.today && isoWeekday(date) === 7 && !week?.checkin_at
    ? h('a', { class: 'btn primary wide', href: '#/checkin' }, 'Воскресный чек-ин →') : null;

  mount(container, header, reminder, checkin, grid, extra);
}
