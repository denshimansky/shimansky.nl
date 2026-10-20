// Экран «Тесты»: недели 0, 6, 14, 24, 32 и изменение от старта.

import * as api from '../api.js';
import { h, mount, sheet, toast } from '../ui.js';
import { fmtNum, fmtSigned, fmtDateShort, addDays, weekRange, parseNum, isIsoDate } from '../shared/dates.js';
import { TEST_WEEKS } from '../shared/calc.js';

const METRICS = [
  { key: 'weight_kg', label: 'Вес', unit: 'кг', digits: 1, better: -1 },
  { key: 'waist_cm', label: 'Талия', unit: 'см', digits: 1, better: -1 },
  { key: 'pullups', label: 'Подтягивания', unit: 'раз', digits: 0, better: 1 },
  { key: 'pushups', label: 'Отжимания', unit: 'раз', digits: 0, better: 1 },
  { key: 'plank_sec', label: 'Планка', unit: 'сек', digits: 0, better: 1 },
];

function plannedDate(week, settings) {
  return week === 0 ? addDays(settings.week1_start, -1) : weekRange(week, settings.week1_start).to;
}

// embedded — секция внутри «Прогресса» (заголовок h2 вместо шапки страницы).
export async function render(container, args, app, { embedded = false } = {}) {
  const { settings } = app.boot;
  const { data, stale } = await api.get('tests');
  const byWeek = new Map(data.tests.map((t) => [t.week_no, t]));
  for (const op of api.pending()) {
    const m = op.path.match(/^tests\/(\d+)$/);
    if (m) byWeek.set(Number(m[1]), { week_no: Number(m[1]), ...op.body });
  }
  const filled = TEST_WEEKS.filter((w) => byWeek.has(w));
  const start = byWeek.get(0);
  const latestWeek = filled.filter((w) => w > 0).pop();
  const latest = latestWeek !== undefined ? byWeek.get(latestWeek) : null;

  const edit = (week) => {
    const t = byWeek.get(week) || {};
    const field = (key, label, mode = 'decimal') => h('label', { class: 'field' }, h('span', null, label),
      h('input', { name: key, type: 'text', inputmode: mode, value: t[key] === null || t[key] === undefined ? '' : String(t[key]).replace('.', ',') }));
    const dateIn = h('input', { name: 'date', type: 'date', value: t.date || plannedDate(week, settings) });
    const photo = h('input', { type: 'checkbox', checked: !!t.photo_done });
    const note = h('textarea', { rows: 2, value: t.note || '' });
    const form = h('div', { class: 'sheet-body form' },
      h('label', { class: 'field' }, h('span', null, 'Дата'), dateIn),
      field('weight_kg', 'Вес, кг'), field('waist_cm', 'Талия, см'),
      field('pullups', 'Подтягивания', 'numeric'), field('pushups', 'Отжимания', 'numeric'), field('plank_sec', 'Планка, сек', 'numeric'),
      h('label', { class: 'check' }, photo, ' Фото сделано'),
      h('label', { class: 'field' }, h('span', null, 'Заметка'), note),
      h('div', { class: 'sheet-actions' }, h('button', { class: 'btn primary', onclick: async () => {
        const body = { date: isIsoDate(dateIn.value) ? dateIn.value : null, photo_done: photo.checked, note: note.value.trim() || null };
        for (const input of form.querySelectorAll('input[name]')) {
          if (input.name === 'date') continue;
          body[input.name] = input.value.trim() === '' ? null : parseNum(input.value);
          if (input.value.trim() !== '' && body[input.name] === null) return toast('Проверьте числа', 'bad');
        }
        close();
        await api.write('PUT', `tests/${week}`, body);
        app.rerender();
      } }, 'Сохранить')));
    const close = sheet(`Тест · неделя ${week}`, form);
  };

  const fmtMetric = (m, v) => (v === null || v === undefined ? '—' : m.key === 'plank_sec' && v >= 60 ? `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}` : fmtNum(v, m.digits));

  const cards = TEST_WEEKS.map((w) => {
    const t = byWeek.get(w);
    return h('button', { class: ['card', 'test-card', t ? '' : 'empty'], onclick: () => edit(w) },
      h('div', { class: 'row-between' },
        h('h3', null, `Неделя ${w}`),
        h('span', { class: 'muted' }, t?.date ? fmtDateShort(t.date) : `план: ${fmtDateShort(plannedDate(w, settings))}`)),
      t ? h('div', { class: 'test-values' }, METRICS.map((m) => h('span', null, h('small', { class: 'muted' }, m.label), fmtMetric(m, t[m.key]))),
        t.photo_done ? h('span', null, h('small', { class: 'muted' }, 'Фото'), '✓') : null)
        : h('p', { class: 'muted' }, 'Внести результаты'));
  });

  const delta = start && latest ? h('section', { class: 'card' },
    h('h2', null, `Изменение: неделя 0 → ${latestWeek}`),
    h('dl', { class: 'kv' }, METRICS.map((m) => {
      const a = start[m.key];
      const b = latest[m.key];
      const d = a !== null && a !== undefined && b !== null && b !== undefined ? b - a : null;
      const good = d === null || d === 0 ? '' : Math.sign(d) === m.better ? 'good' : 'warn';
      return [h('dt', null, m.label), h('dd', { class: good }, d === null ? '—' : `${fmtSigned(d, m.digits)} ${m.unit}`)];
    }))) : null;

  mount(container,
    embedded ? h('h2', { class: 'section-title' }, 'Тесты · недели 0, 6, 14, 24, 32')
      : h('header', { class: 'page-head' }, h('h1', null, 'Тесты'), stale ? h('span', { class: 'chip' }, 'офлайн') : null),
    delta, cards);
}
