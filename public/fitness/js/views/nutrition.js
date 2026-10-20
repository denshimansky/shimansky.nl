// Экран «Питание»: импорт экспорта MacroFactor, неделя, графики по неделям, пиво/чипсы, последние 14 дней.

import * as api from '../api.js';
import { h, mount, sheet, toast } from '../ui.js';
import { weekChart } from '../chart.js';
import { addDays, diffDays, fmtDateShort, fmtNum, fmtSigned, weekNo, weekRange, weekdayShort } from '../shared/dates.js';
import { dayContext, TOTAL_WEEKS } from '../shared/calc.js';
import { calorieSource, nutritionWeek, nutritionWeekly, beerEffect, beerWeek } from '../shared/nutrition.js';

const STALE_DAYS = 7;
let lastReport = null;

const fmtDateTime = (iso) => fmtDateShort(iso.slice(0, 10));

export async function render(container, args, app) {
  const { settings, phases } = app.boot;
  const status = app.boot.nutrition || { imports: 0, last_import_at: null, data_to: null };
  const source = calorieSource(settings, status.imports > 0);
  const week0 = addDays(settings.week1_start, -7);
  const from = [addDays(app.today, -13), week0].sort()[0];
  const [{ data: nd, stale }, { data: dd }] = await Promise.all([
    api.get(`nutrition?from=${from}&to=${app.today}`),
    api.get(`days?from=${from}&to=${app.today}`),
  ]);
  const nutritionAll = nd.days;
  const daily = dd.days;
  // Сегодняшний день ещё не закончился — в средние, графики и сравнения он не входит, только в таблицу.
  const nutrition = nutritionAll.filter((r) => r.date < app.today);
  const dailyBy = new Map(daily.map((d) => [d.date, d]));

  // ——— 1. Загрузка ———
  const fileIn = h('input', { type: 'file', accept: '.xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', hidden: true });
  const reportBox = h('div', null, lastReport ? importReport(lastReport) : null);
  const upload = async (file) => {
    mount(reportBox, h('p', { class: 'muted' }, 'Импортирую…'));
    try {
      const buf = await file.arrayBuffer();
      const res = await api.call('POST', `nutrition/import?name=${encodeURIComponent(file.name)}`, buf, { raw: true, contentType: file.type || 'application/octet-stream' });
      if (res.report?.needs_mapping) {
        mount(reportBox);
        return askMapping(res.report, async (mapping) => {
          await api.call('PUT', 'nutrition/mapping', { mapping });
          await upload(file);
        });
      }
      lastReport = res.report;
      await app.reloadBoot();
      app.rerender();
    } catch (e) {
      mount(reportBox, h('p', { class: 'error-text' }, e.message));
    }
  };
  fileIn.addEventListener('change', () => { if (fileIn.files[0]) upload(fileIn.files[0]); fileIn.value = ''; });
  const staleDays = status.data_to ? diffDays(app.today, status.data_to) : null;
  const uploadCard = h('section', { class: 'card' },
    h('button', { class: 'btn primary wide', onclick: () => fileIn.click() }, 'Загрузить экспорт MacroFactor'), fileIn,
    status.last_import_at
      ? h('p', { class: 'muted small' }, `Последний импорт: ${fmtDateTime(status.last_import_at)}, данные по ${fmtDateShort(status.data_to)}`)
      : h('p', { class: 'muted small' }, 'Импортов ещё не было.'),
    staleDays !== null && staleDays > STALE_DAYS ? h('p', { class: 'banner warn' }, `Данным ${staleDays} дн. — обнови экспорт.`) : null,
    h('p', { class: 'muted small' }, 'MacroFactor → More → Data Export → Quick Export → сохранить в Файлы.'),
    reportBox);

  // ——— 2. Эта неделя ———
  const curWeek = Math.max(0, weekNo(app.today, settings.week1_start));
  const range = curWeek === 0 ? { from: week0, to: addDays(settings.week1_start, -1) } : weekRange(curWeek, settings.week1_start);
  const planProtein = (date) => dayContext(date, settings, phases).targets.protein_g ?? phases[0]?.protein_target_g ?? null;
  const proteinTarget = (date) => {
    const r = nutrition.find((x) => x.date === date);
    return source === 'macrofactor' && r?.protein_target_g ? r.protein_target_g : planProtein(date);
  };
  const w = nutritionWeek(nutrition, range.from, range.to, proteinTarget);
  const kcalTarget = source === 'macrofactor' ? w.kcal_target : dayContext(app.today, settings, phases).targets.kcal ?? w.kcal_target;
  const tile = (label, value, sub, cls = '') => h('div', { class: ['card', 'metric', cls] },
    h('span', { class: 'metric-label' }, label), h('span', { class: 'metric-value' }, value), sub ? h('span', { class: 'muted' }, sub) : null);
  const weekCard = h('section', null,
    h('h2', { class: 'section-title' }, `Эта неделя · ${fmtDateShort(range.from)}–${fmtDateShort(range.to)}`),
    h('p', { class: 'muted small' }, 'Средние — по законченным дням, без сегодняшнего.'),
    w.days ? h('div', { class: 'cards' },
      tile('Калории, среднее', fmtNum(w.kcal, 0), kcalTarget ? `цель ${fmtNum(kcalTarget, 0)}${source === 'macrofactor' ? ' · MF' : ''}` : null),
      tile('Белок, среднее', w.protein_g === null ? '—' : `${fmtNum(w.protein_g, 0)} г`, w.protein_target_g ? `цель ${fmtNum(w.protein_target_g, 0)} г` : null),
      tile('Белок в норме', `${w.protein_ok_days} из ${w.protein_days}`, `дней ≥ цели − 10 г`, w.protein_days && w.protein_ok_days / w.protein_days >= 5 / 7 ? 'good' : ''),
      tile('Расход MacroFactor', w.expenditure === null ? '—' : fmtNum(w.expenditure, 0), 'ккал в день'),
      tile('Баланс', w.balance_kcal === null ? '—' : fmtSigned(-w.balance_kcal, 0),
        w.balance_kg_week === null ? 'ккал в день' : `ккал/день · ≈ ${fmtSigned(-w.balance_kg_week, 2)} кг/нед`))
      : h('p', { class: 'muted' }, 'За законченные дни этой недели данных из MacroFactor ещё нет.'));

  // ——— 3. Графики ———
  const series = nutritionWeekly(nutrition, daily, settings, TOTAL_WEEKS);
  const charts = h('section', { class: 'card' },
    h('h2', null, 'Калории по неделям'),
    weekChart({ series: [{ points: series.kcal, label: 'Съедено' }, { points: series.expenditure, cls: 'alt', label: 'Расход' }, { points: series.target, cls: 'target', label: 'Цель' }],
      maxWeek: TOTAL_WEEKS, digits: 0, unit: 'ккал', label: 'Средние калории по неделям' }),
    h('div', { class: 'legend' }, h('span', null, 'съедено'), h('span', { class: 'alt' }, 'расход'), h('span', { class: 'target' }, 'цель')),
    h('h2', null, 'Вес по неделям'),
    weekChart({ series: [{ points: series.trend_weight, label: 'Тренд MacroFactor' }, { points: series.diary_weight, cls: 'alt', label: 'Дневник' }],
      goal: settings.goal_weight_kg, maxWeek: TOTAL_WEEKS, unit: 'кг', label: 'Вес тренда и средний вес дневника' }),
    h('div', { class: 'legend' }, h('span', null, 'тренд MacroFactor'), h('span', { class: 'alt' }, 'средний из дневника')));

  // ——— 4. Пиво и чипсы ———
  const effect = beerEffect(nutrition, daily);
  const bw = beerWeek(daily, app.today, settings, phases);
  const beerCard = h('section', { class: 'card' },
    h('div', { class: 'row-between' }, h('h2', null, 'Пиво и чипсы'), h('span', { class: 'chip' }, `на неделе ${bw.count} из ${bw.limit}`)),
    effect.diff === null
      ? h('p', { class: 'muted' }, 'Пока мало данных: нужны дни с отметкой «Пиво / чипсы» и калориями из MacroFactor.')
      : h('p', null, `В вечера с пивом/чипсами — в среднем ${fmtSigned(effect.diff, 0)} ккал к другим дням`,
        h('span', { class: 'muted' }, ` (дней: ${effect.beer_days} и ${effect.other_days})`)));

  // ——— 5. Последние 14 дней ———
  const nBy = new Map(nutritionAll.map((r) => [r.date, r]));
  const last14 = Array.from({ length: 14 }, (_, i) => addDays(app.today, -i));
  const table = h('section', { class: 'card' },
    h('h2', null, 'Последние 14 дней'),
    h('div', { class: 'table-wrap' }, h('table', { class: 'table nutrition' },
      h('thead', null, h('tr', null, ['День', 'ккал', 'Б', 'Ж', 'У', 'Цель', 'Δ'].map((t) => h('th', null, t)))),
      h('tbody', null, last14.map((d) => {
        const r = nBy.get(d) || {};
        const beer = dailyBy.get(d)?.beer_chips === 1;
        const dev = r.kcal !== null && r.kcal !== undefined && r.kcal_target ? r.kcal - r.kcal_target : null;
        const open = () => app.go(d === app.today ? '#/today' : `#/today/${d}`);
        return h('tr', { class: beer ? 'beer' : '', tabindex: 0, onclick: open, onkeydown: (e) => { if (e.key === 'Enter') open(); } },
          h('td', null, `${weekdayShort(d)} ${fmtDateShort(d)}`, beer ? h('span', { class: 'chip warn tiny', title: 'Пиво / чипсы' }, 'П/Ч') : null),
          h('td', null, fmtNum(r.kcal, 0)), h('td', null, fmtNum(r.protein_g, 0)), h('td', null, fmtNum(r.fat_g, 0)), h('td', null, fmtNum(r.carbs_g, 0)),
          h('td', null, fmtNum(r.kcal_target, 0)), h('td', { class: dev === null ? '' : dev > 0 ? 'warn' : 'good' }, fmtSigned(dev, 0)));
      })))),
    h('p', { class: 'muted small' }, 'Нажмите на день, чтобы открыть его в «Сегодня».'));

  mount(container,
    h('header', { class: 'page-head' }, h('h1', null, 'Питание'), stale ? h('span', { class: 'chip' }, 'офлайн') : null),
    uploadCard, weekCard, charts, beerCard, table);
}

function importReport(r) {
  const d = r.diary;
  return h('div', { class: 'card inset' },
    h('h3', null, `Импорт: ${fmtDateShort(r.date_from)} – ${fmtDateShort(r.date_to)}`),
    h('ul', null,
      h('li', null, `Дней добавлено: ${r.added}, обновлено: ${r.updated}${r.unchanged ? `, без изменений: ${r.unchanged}` : ''}`),
      h('li', null, `В дневник: ккал ${d.kcal}, белок ${d.protein_g}, вес ${d.weight_kg}, шаги ${d.steps}`),
      r.weight_kept ? h('li', null, `Утренний вес, введённый вручную, не тронут: ${r.weight_kept} дн.`) : null),
    r.unknown_columns.length ? h('details', null,
      h('summary', { class: 'muted small' }, `Не используются колонок: ${r.unknown_columns.length}`),
      h('p', { class: 'muted small' }, r.unknown_columns.join(', '))) : null);
}

// Экран сопоставления: каждый заголовок файла → поле трекера или «не импортировать».
function askMapping(res, onSave) {
  const selects = res.headers.map((hd) => h('label', { class: 'field' }, h('span', null, hd),
    h('select', { 'data-h': hd },
      h('option', { value: '' }, '— не импортировать —'),
      Object.entries(res.fields).map(([k, label]) => h('option', { value: k, selected: res.mapping[hd] === k }, label)))));
  const err = h('p', { class: 'error-text' });
  const body = h('div', { class: 'sheet-body form' },
    h('p', { class: 'muted small' }, `Не нашёл колонки даты и калорий${res.sheet && res.sheet !== 'CSV' ? ` на листе «${res.sheet}»` : ''}. Укажите, что есть что — в следующий раз это применится само.`),
    selects, err,
    h('div', { class: 'sheet-actions' }, h('button', { class: 'btn primary', onclick: async () => {
      const mapping = {};
      for (const sel of body.querySelectorAll('select')) mapping[sel.dataset.h] = sel.value;
      const used = Object.values(mapping).filter(Boolean);
      if (!used.includes('date') || !used.includes('kcal')) { err.textContent = 'Нужны хотя бы дата и калории'; return; }
      if (new Set(used).size !== used.length) { err.textContent = 'Одно поле выбрано для двух колонок'; return; }
      close();
      try {
        await onSave(mapping);
      } catch (e) {
        toast(e.message, 'bad');
      }
    } }, 'Сохранить и импортировать')));
  const close = sheet('Сопоставление колонок', body);
}
