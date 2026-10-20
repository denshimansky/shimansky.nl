// Экран «Прогресс»: рекомендация по калориям, графики веса и талии, таблица недель.

import * as api from '../api.js';
import { h, mount, sheet, toast } from '../ui.js';
import { weekChart } from '../chart.js';
import { fmtNum, fmtSigned, fmtDateShort, parseNum, weekdayShort } from '../shared/dates.js';
import { SIGNAL_LABELS, TOTAL_WEEKS } from '../shared/calc.js';
import * as tests from './tests.js';

export async function render(container, args, app) {
  const { data, stale } = await api.get('progress');
  const { rows, currentWeek, evalWeek, recommendation, goals } = data;
  // Изменения недель, которые ещё в очереди (без сети), показываем сразу.
  for (const op of api.pending()) {
    const m = op.path.match(/^weeks\/(\d+)$/);
    const r = m && rows.find((x) => x.week === Number(m[1]));
    if (r) Object.assign(r, op.body, op.body.is_deload !== undefined ? { is_deload: !!op.body.is_deload } : {});
  }
  const maxWeek = Math.max(TOTAL_WEEKS, ...rows.map((r) => r.week));
  const cur = rows.find((r) => r.week === currentWeek);
  const evalRow = rows.find((r) => r.week === evalWeek);

  const signalChip = (sig) => (sig ? h('span', { class: `chip sig-${sig}` }, SIGNAL_LABELS[sig]) : null);

  const saveWeek = async (week, patch) => {
    await api.write('PUT', `weeks/${week}`, patch);
    toast('Сохранено');
    app.rerender();
  };

  const waistInput = (week, value) => {
    const input = h('input', { type: 'text', inputmode: 'decimal', class: 'inline-in', value: value === null || value === undefined ? '' : fmtNum(value, 1), 'aria-label': `Талия, неделя ${week}` });
    const btn = h('button', { class: 'btn small', onclick: () => {
      const v = parseNum(input.value);
      if (input.value.trim() && (v === null || v < 40 || v > 250)) return toast('Талия: число от 40 до 250', 'bad');
      saveWeek(week, { waist_cm: v });
    } }, 'Сохранить');
    return h('div', { class: 'inline-form' }, input, h('span', { class: 'unit' }, 'см'), btn);
  };

  const recBox = recommendation
    ? h('section', { class: `card rec rec-${recommendation.kind}` },
      h('p', { class: 'muted' }, `По неделям ${recommendation.weeks.join(', ')}`),
      h('h2', null, recommendation.text),
      h('p', null, recommendation.reason))
    : null;

  const now = h('section', { class: 'card' },
    h('div', { class: 'row-between' },
      h('h2', null, `Неделя ${currentWeek}`),
      cur?.is_deload ? h('span', { class: 'chip warn' }, 'разгрузка') : null),
    h('dl', { class: 'kv' },
      h('dt', null, 'Средний вес'), h('dd', null, cur?.weight_kg !== null && cur?.weight_kg !== undefined ? `${fmtNum(cur.weight_kg, 2)} кг` : '—', cur ? h('span', { class: 'muted' }, ` · дней ${cur.days}`) : null),
      evalRow ? [h('dt', null, `Темп недели ${evalWeek}`), h('dd', null, evalRow.weight_change !== null ? `${fmtSigned(evalRow.weight_change, 2)} кг ` : '— ', signalChip(evalRow.signal))] : null,
      h('dt', null, 'Тренировки'), h('dd', null, cur ? `${cur.done_sessions} из ${cur.planned_sessions}` : '—'),
      h('dt', null, 'Подтягивания дома'), h('dd', null, cur?.pullup_reps ? `${cur.pullup_reps} повт. за ${cur.pullup_sets} подх.` : '—')),
    h('p', { class: 'label' }, 'Талия на этой неделе'),
    waistInput(currentWeek, cur?.waist_cm));

  const charts = h('section', { class: 'card' },
    h('h2', null, 'Средний вес по неделям'),
    weekChart({ points: rows.map((r) => ({ week: r.week, y: r.weight_kg })), goal: goals.weight_kg, maxWeek, unit: 'кг', label: 'Средний вес' }),
    h('h2', null, 'Талия'),
    weekChart({ points: rows.map((r) => ({ week: r.week, y: r.waist_cm })), goal: goals.waist_cm, maxWeek, unit: 'см', label: 'Талия' }));

  const openWeek = async (r) => {
    let days = [];
    try {
      days = (await api.get(`days?from=${r.from}&to=${r.to}`)).data.days;
    } catch (e) {
      toast(e.message, 'bad');
    }
    const planned = h('input', { type: 'text', inputmode: 'numeric', class: 'inline-in', value: r.planned_sessions ?? '', 'aria-label': 'План тренировок' });
    const deload = h('input', { type: 'checkbox', checked: r.is_deload });
    const close = sheet(`Неделя ${r.week}: ${fmtDateShort(r.from)} – ${fmtDateShort(r.to)}`, h('div', { class: 'sheet-body' },
      h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
        h('thead', null, h('tr', null, ['День', 'Вес', 'ккал', 'Белок', 'Шаги', 'Сон', 'П/Ч'].map((t) => h('th', null, t)))),
        h('tbody', null, days.length ? days.map((d) => h('tr', null,
          h('td', null, `${weekdayShort(d.date)} ${fmtDateShort(d.date)}`),
          h('td', null, fmtNum(d.weight_kg, 1)), h('td', null, fmtNum(d.kcal, 0)), h('td', null, fmtNum(d.protein_g, 0)),
          h('td', null, fmtNum(d.steps, 0)), h('td', null, fmtNum(d.sleep_h, 1)), h('td', null, d.beer_chips === 1 ? 'да' : d.beer_chips === 0 ? 'нет' : '—')))
          : h('tr', null, h('td', { colspan: 7, class: 'muted' }, 'Нет записей'))))),
      h('p', { class: 'label' }, 'Талия'),
      waistInput(r.week, r.waist_cm),
      h('div', { class: 'inline-form' }, h('span', null, 'План тренировок'), planned,
        h('label', { class: 'check' }, deload, ' разгрузка'),
        h('button', { class: 'btn small', onclick: () => {
          close();
          saveWeek(r.week, { planned_sessions: planned.value.trim() === '' ? null : parseNum(planned.value), is_deload: deload.checked });
        } }, 'Сохранить'))));
  };

  const shown = rows.filter((r) => r.week <= Math.max(currentWeek, 0) || r.days || r.waist_cm !== null);
  const table = h('section', { class: 'card' },
    h('h2', null, 'Недели'),
    h('div', { class: 'table-wrap' }, h('table', { class: 'table weeks' },
      h('thead', null, h('tr', null, ['Нед', 'Вес', 'Δ', 'Сигнал', 'ккал', 'Белок', 'Шаги', 'Сон', 'Талия', 'Трен.', 'Подт.'].map((t) => h('th', null, t)))),
      h('tbody', null, [...shown].reverse().map((r) => h('tr', { class: [r.week === currentWeek ? 'current' : '', r.is_deload ? 'deload' : ''], tabindex: 0, onclick: () => openWeek(r), onkeydown: (e) => { if (e.key === 'Enter') openWeek(r); } },
        h('td', null, r.week), h('td', null, fmtNum(r.weight_kg, 2)), h('td', null, fmtSigned(r.weight_change, 2)), h('td', null, signalChip(r.signal) || '—'),
        h('td', null, fmtNum(r.kcal, 0)), h('td', null, fmtNum(r.protein_g, 0)), h('td', null, fmtNum(r.steps, 0)), h('td', null, fmtNum(r.sleep_h, 1)),
        h('td', null, fmtNum(r.waist_cm, 1)), h('td', null, `${r.done_sessions}/${r.planned_sessions}`), h('td', null, r.pullup_reps || '—')))))),
    h('p', { class: 'muted small' }, 'Нажмите на неделю, чтобы увидеть её дни.'));

  const testsBox = h('section', { id: 'tests', class: 'tests-section' });
  await tests.render(testsBox, [], app, { embedded: true });

  mount(container,
    h('header', { class: 'page-head' }, h('h1', null, 'Прогресс'), stale ? h('span', { class: 'chip' }, 'офлайн') : null),
    recBox, now, charts, table, testsBox);
  if (args[0] === 'tests') requestAnimationFrame(() => testsBox.scrollIntoView({ block: 'start' }));
}
