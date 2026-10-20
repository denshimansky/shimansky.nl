// Воскресный чек-ин: талия → фото (каждые 4 недели) → итоги недели → копия данных → «пройден».

import * as api from '../api.js?v=d67a901a70f5';
import { h, mount, toast } from '../ui.js?v=d67a901a70f5';
import { addDays, fmtDateShort, fmtNum, fmtSigned, parseNum, weekNo, weekRange } from '../shared/dates.js?v=d67a901a70f5';
import { SIGNAL_LABELS } from '../shared/calc.js?v=d67a901a70f5';
import { calorieSource, nutritionWeek, beerLimit } from '../shared/nutrition.js?v=d67a901a70f5';
import { saveBackup } from '../backup.js?v=d67a901a70f5';

const PHOTO_EVERY = 4;

export async function render(container, args, app) {
  const { settings, phases } = app.boot;
  const week = weekNo(app.today, settings.week1_start);
  const range = week === 0 ? { from: addDays(settings.week1_start, -7), to: addDays(settings.week1_start, -1) } : weekRange(week, settings.week1_start);
  const [{ data: prog }, { data: nd }] = await Promise.all([
    api.get('progress'),
    api.get(`nutrition?from=${range.from}&to=${range.to}`),
  ]);
  const row = prog.rows.find((r) => r.week === week) || {};
  const phase = phases.find((p) => p.phase_no === row.phase_no) || null;
  const source = calorieSource(settings, (app.boot.nutrition?.imports || 0) > 0);
  const proteinTarget = (date) => {
    const r = nd.days.find((x) => x.date === date);
    return (source === 'macrofactor' && r?.protein_target_g) || phase?.protein_target_g || phases[0]?.protein_target_g || null;
  };
  // Сегодняшний день ещё не закончился — как и на «Питании», в средние не входит.
  const food = nutritionWeek(nd.days.filter((r) => r.date < app.today), range.from, range.to, proteinTarget);

  const step = (n, title, ...body) => h('section', { class: 'card checkin-step' }, h('span', { class: 'step-no' }, `Шаг ${n}`), h('h2', null, title), body);

  // 1. Талия
  const waist = h('input', { type: 'text', inputmode: 'decimal', class: 'inline-in', value: row.waist_cm ? fmtNum(row.waist_cm, 1) : '', 'aria-label': 'Талия, см' });
  const waistStep = step(1, 'Талия',
    h('p', { class: 'muted small' }, 'Утром, на выдохе, на уровне пупка.'),
    h('div', { class: 'inline-form' }, waist, h('span', { class: 'unit' }, 'см'),
      h('button', { class: 'btn small', onclick: async () => {
        const v = parseNum(waist.value);
        if (v === null || v < 40 || v > 250) return toast('Талия: число от 40 до 250', 'bad');
        await api.write('PUT', `weeks/${week}`, { waist_cm: v });
        toast('Талия сохранена');
        app.rerender();
      } }, 'Сохранить')));

  // 2. Фото — каждые 4 недели
  const photoDue = week > 0 && week % PHOTO_EVERY === 0;
  const photoStep = step(2, 'Фото',
    h('p', null, photoDue
      ? `Неделя ${week} — время фото: спереди, сбоку, сзади, тот же свет и место.`
      : `Фото — раз в 4 недели. Следующее — на неделе ${Math.max(PHOTO_EVERY, Math.ceil((week + 1) / PHOTO_EVERY) * PHOTO_EVERY)}.`));

  // 3. Итоги недели
  const v = (x, d, unit = '') => (x === null || x === undefined ? '—' : `${fmtNum(x, d)}${unit}`);
  const summary = step(3, `Неделя ${week} · ${fmtDateShort(range.from)}–${fmtDateShort(range.to)}`,
    h('dl', { class: 'kv' },
      h('dt', null, 'Средний вес'), h('dd', null, v(row.weight_kg, 2, ' кг'), row.weight_change !== null && row.weight_change !== undefined ? ` (${fmtSigned(row.weight_change, 2)})` : '',
        row.signal ? h('span', { class: `chip sig-${row.signal}` }, SIGNAL_LABELS[row.signal]) : null),
      h('dt', null, 'Талия'), h('dd', null, v(row.waist_cm, 1, ' см')),
      h('dt', null, 'Тренировки'), h('dd', null, `${row.done_sessions ?? 0} из ${row.planned_sessions ?? 0}`),
      h('dt', null, 'Подтягивания дома'), h('dd', null, row.pullup_reps ? `${row.pullup_reps} повт.` : '—'),
      h('dt', null, 'Пиво / чипсы'), h('dd', null, `${row.beer_chips_days ?? 0} из ${beerLimit(row.phase_no)}`),
      h('dt', null, 'Калории (MacroFactor)'), h('dd', null, food.days ? `${v(food.kcal, 0)}${food.kcal_target ? ` / цель ${v(food.kcal_target, 0)}` : ''}` : 'нет импорта за неделю'),
      h('dt', null, 'Белок'), h('dd', null, food.protein_days ? `${v(food.protein_g, 0, ' г')} · в норме ${food.protein_ok_days} из ${food.protein_days}` : '—'),
      food.balance_kg_week !== null ? [h('dt', null, 'Баланс по MacroFactor'), h('dd', null, `≈ ${fmtSigned(-food.balance_kg_week, 2)} кг/нед`)] : null),
    prog.recommendation ? h('p', { class: 'banner' }, h('strong', null, prog.recommendation.text), ' — ', prog.recommendation.reason) : null,
    !food.days ? h('a', { class: 'link-btn', href: '#/nutrition' }, 'Загрузить экспорт MacroFactor →') : null);

  // 4. Копия и завершение
  const finish = async () => {
    try {
      await api.call('PUT', `weeks/${week}`, { checkin_done: true });
      await app.reloadBoot();
      toast('Чек-ин пройден');
      app.go('#/today');
    } catch (e) {
      toast(e.message, 'bad');
    }
  };
  const done = !!row.checkin_at;
  const last = step(4, api.LOCAL ? 'Копия данных' : 'Готово',
    api.LOCAL ? h('p', { class: 'muted small' }, 'Данные только на телефоне — сохраните копию в «Файлы» → iCloud Drive.') : null,
    api.LOCAL ? h('button', { class: 'btn', onclick: async () => {
      try {
        if (await saveBackup(settings.timezone)) { await app.reloadBoot(); toast('Копия сохранена'); }
      } catch (e) {
        toast(e.message, 'bad');
      }
    } }, 'Сохранить копию') : null,
    done ? h('p', { class: 'good' }, '✓ Чек-ин этой недели пройден') : h('button', { class: 'btn primary wide', onclick: finish }, 'Чек-ин пройден'));

  mount(container,
    h('header', { class: 'page-head' }, h('a', { href: '#/today', class: 'muted' }, '← Сегодня'), h('h1', null, 'Воскресный чек-ин')),
    waistStep, photoStep, summary, last);
}
