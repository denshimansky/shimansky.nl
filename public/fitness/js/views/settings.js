// «Настройки»: даты и цели, фазы, разгрузки, расписание, программы, импорт/экспорт, вход.

import * as api from '../api.js';
import { h, mount, toast } from '../ui.js';
import { WEEKDAY_NAMES, parseNum, fmtDateShort } from '../shared/dates.js';
import { createPasskey, supported as passkeySupported } from '../passkey.js';
import { saveBackup, downloadText, daysSinceBackup } from '../backup.js';
import { EXERCISE_KINDS } from '../shared/seed.js';
import { MERGE_LABELS, mergeRules } from '../shared/macrofactor.js';
import { calorieSource } from '../shared/nutrition.js';

const EXPORT_TABLES = ['daily_log', 'nutrition_daily', 'weekly_log', 'sessions', 'set_logs', 'tests', 'phases', 'schedule', 'workouts', 'workout_exercises', 'exercises', 'settings'];

const numStr = (v) => (v === null || v === undefined ? '' : String(v).replace('.', ','));

async function saveAndReload(app, method, path, body, msg = 'Сохранено') {
  try {
    await api.call(method, path, body);
    await app.reloadBoot();
    toast(msg);
    app.rerender();
  } catch (e) {
    toast(e.message, 'bad');
  }
}

export async function render(container, args, app) {
  if (args[0] === 'workout') return renderWorkoutEditor(container, args[1], app);
  const { settings, phases, workouts, schedule, weekly, exercises } = app.boot;

  // Даты и цели
  const start = h('input', { type: 'date', value: settings.week1_start });
  const tz = h('input', { type: 'text', value: settings.timezone, autocomplete: 'off' });
  const gw = h('input', { type: 'text', inputmode: 'decimal', value: numStr(settings.goal_weight_kg) });
  const gwaist = h('input', { type: 'text', inputmode: 'decimal', value: numStr(settings.goal_waist_cm) });
  const datesCard = h('section', { class: 'card form' },
    h('h2', null, 'Даты и цели'),
    h('label', { class: 'field' }, h('span', null, 'Начало недели 1'), start),
    h('label', { class: 'field' }, h('span', null, 'Часовой пояс'), tz),
    h('label', { class: 'field' }, h('span', null, 'Целевой вес, кг'), gw),
    h('p', { class: 'muted small' }, 'Ориентир — 76–78 кг. Целевую талию задайте после первого замера.'),
    h('label', { class: 'field' }, h('span', null, 'Целевая талия, см'), gwaist),
    h('button', { class: 'btn primary', onclick: () => saveAndReload(app, 'PUT', 'settings', {
      week1_start: start.value, timezone: tz.value.trim(),
      goal_weight_kg: gw.value.trim() ? parseNum(gw.value) : null, goal_waist_cm: gwaist.value.trim() ? parseNum(gwaist.value) : null,
    }) }, 'Сохранить'));

  // Фазы
  const phaseRows = phases.map((p) => {
    const f = (key, mode = 'numeric', cls = 'num') => h('input', { class: cls, type: 'text', inputmode: mode, 'data-k': key, value: numStr(p[key]), 'aria-label': `${key}, фаза ${p.phase_no}` });
    const row = h('tr', null,
      h('td', null, h('input', { class: 'name', type: 'text', 'data-k': 'name', value: p.name, 'aria-label': `Название фазы ${p.phase_no}` })),
      h('td', null, f('week_from')), h('td', null, f('week_to')), h('td', null, f('kcal_target')), h('td', null, f('protein_target_g')),
      h('td', null, f('steps_target')), h('td', null, f('pace_limit_kg', 'decimal')),
      h('td', null, h('button', { class: 'btn small', onclick: () => {
        const body = {};
        for (const i of row.querySelectorAll('input')) body[i.dataset.k] = i.dataset.k === 'name' ? i.value : parseNum(i.value);
        saveAndReload(app, 'PUT', `phases/${p.phase_no}`, body);
      } }, 'OK')));
    return row;
  });
  const phasesCard = h('section', { class: 'card' },
    h('h2', null, 'Фазы и цели дня'),
    h('div', { class: 'table-wrap' }, h('table', { class: 'table edit' },
      h('thead', null, h('tr', null, ['Название', 'С нед.', 'По нед.', 'ккал', 'Белок', 'Шаги', 'Темп, кг', ''].map((t) => h('th', null, t)))),
      h('tbody', null, phaseRows))),
    h('p', { class: 'muted small' }, 'Темп — порог сигнала «Быстро»: потеря больше этого значения за неделю.'));

  // Разгрузочные недели
  const deloadIn = h('input', { type: 'text', inputmode: 'text', value: weekly.filter((w) => w.is_deload).map((w) => w.week_no).join(', ') });
  const deloadCard = h('section', { class: 'card form' },
    h('h2', null, 'Разгрузочные недели'),
    h('div', { class: 'inline-form' }, deloadIn, h('button', { class: 'btn small', onclick: () => {
      const weeks = deloadIn.value.split(/[^\d]+/).filter(Boolean).map(Number);
      saveAndReload(app, 'PUT', 'deloads', { weeks });
    } }, 'Сохранить')));

  // Расписание
  const scheduleCard = h('section', { class: 'card' },
    h('h2', null, 'Расписание тренировок'),
    phases.map((p) => {
      const selects = WEEKDAY_NAMES.map((name, i) => {
        const cur = schedule.find((s) => s.phase_no === p.phase_no && s.weekday === i + 1);
        return h('label', { class: 'sched-day' }, h('span', null, ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'][i]),
          h('select', { 'data-wd': i + 1, 'aria-label': `${name}, ${p.name}` },
            h('option', { value: '' }, '—'),
            workouts.map((w) => h('option', { value: w.id, selected: cur?.workout_id === w.id }, w.name))));
      });
      const box = h('div', { class: 'sched' }, h('h3', null, p.name), h('div', { class: 'sched-grid' }, selects),
        h('button', { class: 'btn small', onclick: () => {
          const days = {};
          for (const sel of box.querySelectorAll('select')) days[sel.dataset.wd] = sel.value ? Number(sel.value) : null;
          saveAndReload(app, 'PUT', `schedule/${p.phase_no}`, { days });
        } }, 'Сохранить'));
      return box;
    }));

  // Программы
  const programsCard = h('section', { class: 'card' },
    h('h2', null, 'Программы'),
    h('div', { class: 'list' }, workouts.map((w) => h('a', { class: 'list-item', href: `#/settings/workout/${w.id}` },
      h('span', null, w.name, h('span', { class: 'muted' }, ` · ${w.code}`)),
      h('span', { class: 'muted' }, `фазы ${w.phase_from}–${w.phase_to} · ${w.items.length} упр.`)))),
    h('a', { class: 'btn small', href: '#/settings/workout/new' }, '+ Новая тренировка'),
    h('details', { class: 'exercises' },
      h('summary', null, `Упражнения и шаг прибавки (${exercises.length})`),
      exercises.map((e) => {
        const inc = h('input', { class: 'num', type: 'text', inputmode: 'decimal', value: numStr(e.increment_kg), 'aria-label': `Шаг, ${e.name}` });
        const kind = kindSelect(e.kind, `Тип, ${e.name}`);
        return h('div', { class: 'inline-form' }, h('span', { class: 'grow' }, e.name), kind, inc, h('span', { class: 'unit' }, 'кг'),
          h('button', { class: 'btn small', onclick: () => saveAndReload(app, 'PUT', `exercises/${e.id}`, { increment_kg: parseNum(inc.value), kind: kind.value }) }, 'OK'));
      }),
      newExerciseForm(app)));

  // Данные
  const fileIn = h('input', { type: 'file', accept: '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const report = h('div', { class: 'import-report' });
  const dataCard = h('section', { class: 'card' },
    h('h2', null, 'Импорт и экспорт'),
    h('p', { class: 'muted small' }, 'Импорт «Трекер_формы_2027.xlsx»: листы «Дневник», «Недели», «Тренировки», «Тесты». Повторный импорт обновляет записи, дублей не будет.'),
    h('div', { class: 'inline-form' }, fileIn, h('button', { class: 'btn small', onclick: async () => {
      const file = fileIn.files[0];
      if (!file) return toast('Выберите файл', 'bad');
      mount(report, h('p', { class: 'muted' }, 'Импортирую…'));
      try {
        const res = await api.call('POST', 'import', await file.arrayBuffer(), { raw: true, contentType: file.type || 'application/octet-stream' });
        await app.reloadBoot();
        mount(report, importReport(res.report));
      } catch (e) {
        mount(report, h('p', { class: 'error-text' }, e.message));
      }
    } }, 'Импортировать')),
    report,
    h('p', { class: 'label' }, 'Экспорт CSV'),
    h('div', { class: 'chips' }, EXPORT_TABLES.map((t) => (api.LOCAL
      ? h('button', { class: 'chip-btn', onclick: () => downloadText(`${t}.csv`, api.local.exportCsv(t), 'text/csv;charset=utf-8') }, t)
      : h('a', { class: 'chip-btn', href: api.apiUrl(`export/${t}.csv`), download: `${t}.csv` }, t)))),
    api.LOCAL ? null : [
      h('p', { class: 'label' }, 'Резервная копия'),
      h('a', { class: 'btn small', href: api.apiUrl('backup.sqlite'), download: '' }, 'Скачать базу (.sqlite)'),
      h('p', { class: 'muted small' }, 'Сервер и так делает копию каждый день; эта кнопка — для ручного архива.'),
    ]);

  mount(container,
    h('header', { class: 'page-head' }, h('h1', null, 'Настройки')),
    api.LOCAL ? localStorageCard(app) : null,
    datesCard, nutritionCard(app), phasesCard, deloadCard, scheduleCard, programsCard, dataCard,
    api.LOCAL ? null : authCard(app));
}

// Питание: откуда цель калорий и как данные MacroFactor попадают в дневник.
function nutritionCard(app) {
  const { settings } = app.boot;
  const imports = app.boot.nutrition?.imports || 0;
  const src = h('select', { 'aria-label': 'Цель калорий' },
    [['', `авто (сейчас: ${calorieSource({}, imports > 0) === 'macrofactor' ? 'из MacroFactor' : 'по плану'})`], ['plan', 'по плану'], ['macrofactor', 'из MacroFactor']]
      .map(([v, t]) => h('option', { value: v, selected: (settings.calorie_source || '') === v }, t)));
  const rules = mergeRules(settings);
  const labels = { kcal: 'Калории', protein_g: 'Белок', weight_kg: 'Вес', steps: 'Шаги' };
  const selects = Object.keys(labels).map((k) => h('label', { class: 'field' }, h('span', null, labels[k]),
    h('select', { 'data-k': k }, Object.entries(MERGE_LABELS).map(([v, t]) => h('option', { value: v, selected: rules[k] === v }, t)))));
  const box = h('section', { class: 'card form' },
    h('h2', null, 'Питание (MacroFactor)'),
    h('label', { class: 'field' }, h('span', null, 'Цель калорий'), src),
    h('p', { class: 'muted small' }, '«Из MacroFactor» — цель дня берётся из последнего импорта, а подсказка ±150 ккал на «Прогрессе» не спорит с ней.'),
    h('p', { class: 'label' }, 'Что переносить из MacroFactor в дневник'),
    selects,
    h('button', { class: 'btn primary', onclick: () => {
      const merge = {};
      for (const sel of box.querySelectorAll('select[data-k]')) merge[sel.dataset.k] = sel.value;
      saveAndReload(app, 'PUT', 'settings', { calorie_source: src.value || null, nutrition_merge: merge });
    } }, 'Сохранить'),
    h('button', { class: 'btn small ghost', onclick: () => saveAndReload(app, 'PUT', 'nutrition/mapping', { mapping: {}, replace: true }, 'Сопоставление колонок сброшено') }, 'Сбросить сопоставление колонок'));
  return box;
}

// Локальный режим: где лежат данные и как их не потерять.
function localStorageCard(app) {
  const { settings } = app.boot;
  const since = daysSinceBackup(app.boot, app.today);
  const restoreIn = h('input', { type: 'file', accept: '.json,application/json' });
  const snapsBox = h('div', { class: 'list' });
  const restore = async (json, label) => {
    if (!confirm(`Заменить все текущие данные копией ${label}? Текущие данные пропадут, если их нет в другой копии.`)) return;
    try {
      await api.local.restore(json);
      await app.reloadBoot();
      toast('Данные восстановлены');
      app.rerender();
    } catch (e) {
      toast(e instanceof SyntaxError ? 'Файл повреждён или это не копия трекера' : e.message, 'bad');
    }
  };
  api.local.snapshots().then((days) => mount(snapsBox, days.length
    ? days.map((d) => {
      const [day, version] = d.split('~');
      const label = version ? `Перед обновлением трекера, ${fmtDateShort(day)}` : `Состояние на утро ${fmtDateShort(day)}`;
      return h('div', { class: 'list-item' }, h('span', null, label),
        h('button', { class: 'btn small ghost', onclick: async () => restore(await api.local.snapshot(d), version ? `до обновления (${fmtDateShort(day)})` : `от ${fmtDateShort(day)}`) }, 'Вернуть'));
    })
    : h('p', { class: 'muted small' }, 'Снимков пока нет — они появляются с первой правки каждого дня.'))).catch(() => {});

  return h('section', { class: 'card' },
    h('h2', null, 'Данные на этом устройстве'),
    h('p', { class: 'muted small' },
      'Все записи хранятся только в этом браузере и никуда не отправляются. ',
      api.persisted === true ? 'Браузер обещал не удалять их сам.' : 'Установите трекер на экран «Домой», чтобы браузер не удалял данные при нехватке места.'),
    h('p', { class: since === null || since >= 7 ? 'warn' : 'good' },
      since === null ? 'Резервной копии ещё не было.' : since === 0 ? 'Резервная копия сохранена сегодня.' : `Последняя резервная копия — ${since} дн. назад.`),
    h('div', { class: 'inline-form' },
      h('button', { class: 'btn primary', onclick: async () => {
        try {
          if (await saveBackup(settings.timezone)) { await app.reloadBoot(); toast('Копия сохранена'); app.rerender(); }
        } catch (e) {
          toast(e.message, 'bad');
        }
      } }, 'Сохранить копию')),
    h('p', { class: 'muted small' }, 'Раз в неделю сохраняйте копию в «Файлы» → iCloud Drive. Из неё же можно перенести данные на другое устройство.'),
    h('p', { class: 'label' }, 'Восстановить из файла копии'),
    h('div', { class: 'inline-form' }, restoreIn, h('button', { class: 'btn small', onclick: async () => {
      const f = restoreIn.files[0];
      if (!f) return toast('Выберите файл копии', 'bad');
      restore(await f.text(), `из файла «${f.name}»`);
    } }, 'Восстановить')),
    h('p', { class: 'label' }, 'Автоматические снимки за последние дни'),
    snapsBox);
}

// Серверный режим: passkeys и выход.
function authCard() {
  const keysBox = h('div', { class: 'list' }, h('p', { class: 'muted' }, 'Загружаю…'));
  const loadKeys = async () => {
    try {
      const { passkeys } = await api.call('GET', 'passkeys');
      mount(keysBox, passkeys.length ? passkeys.map((k) => h('div', { class: 'list-item' },
        h('span', null, k.name, h('span', { class: 'muted' }, ` · добавлен ${fmtDateShort(k.created_at.slice(0, 10))}${k.last_used_at ? `, вход ${fmtDateShort(k.last_used_at.slice(0, 10))}` : ''}`)),
        h('button', { class: 'icon-btn small', 'aria-label': `Удалить ${k.name}`, onclick: async () => {
          if (!confirm(`Удалить passkey «${k.name}»?`)) return;
          await api.call('DELETE', `passkeys/${encodeURIComponent(k.id)}`).catch((e) => toast(e.message, 'bad'));
          loadKeys();
        } }, '✕'))) : h('p', { class: 'muted' }, 'Passkey пока нет — вход только по ссылке на почту.'));
    } catch (e) {
      mount(keysBox, h('p', { class: 'muted' }, e.message));
    }
  };
  loadKeys();
  return h('section', { class: 'card' },
    h('h2', null, 'Вход'),
    keysBox,
    passkeySupported() ? h('button', { class: 'btn', onclick: async () => {
      try {
        const options = await api.call('POST', 'passkeys/options', {});
        const cred = await createPasskey(options);
        await api.call('POST', 'passkeys', cred);
        toast('Passkey добавлен');
        loadKeys();
      } catch (e) {
        toast(e.name === 'NotAllowedError' ? 'Отменено' : e.message, 'bad');
      }
    } }, 'Добавить passkey на это устройство') : h('p', { class: 'muted' }, 'Этот браузер не поддерживает passkeys.'),
    h('button', { class: 'btn ghost', onclick: async () => {
      await api.call('POST', 'logout', {}).catch(() => {});
      api.clearCache();
      location.href = api.loginUrl();
    } }, 'Выйти'));
}

function kindSelect(value, label) {
  return h('select', { class: 'kind', 'aria-label': label },
    Object.entries(EXERCISE_KINDS).map(([k, t]) => h('option', { value: k, selected: k === (value || 'weight_reps') }, t)));
}

function newExerciseForm(app) {
  const name = h('input', { type: 'text', placeholder: 'Новое упражнение', 'aria-label': 'Название упражнения' });
  const kind = kindSelect('weight_reps', 'Тип упражнения');
  const inc = h('input', { class: 'num', type: 'text', inputmode: 'decimal', value: '2,5', 'aria-label': 'Шаг прибавки' });
  return h('div', { class: 'inline-form' }, name, kind, inc, h('span', { class: 'unit' }, 'кг'),
    h('button', { class: 'btn small', onclick: () => saveAndReload(app, 'POST', 'exercises', { name: name.value, kind: kind.value, increment_kg: parseNum(inc.value) }, 'Упражнение добавлено') }, 'Добавить'));
}

function importReport(r) {
  const labels = { rows: 'строк', skipped: 'пропущено', sessions: 'тренировок', sets: 'подходов' };
  const v = r.verification;
  return h('div', { class: 'card inset' },
    h('h3', null, 'Импорт завершён'),
    h('ul', null, Object.entries(r.sheets).map(([name, s]) => h('li', null, `${name}: `,
      Object.entries(s).filter(([k]) => labels[k]).map(([k, n]) => `${labels[k]} ${n}`).join(', ')))),
    r.created_exercises.length ? h('p', { class: 'muted' }, `Новые упражнения: ${r.created_exercises.join(', ')}`) : null,
    r.warnings.map((w) => h('p', { class: 'warn' }, w)),
    v ? h('p', { class: v.mismatches.length ? 'warn' : 'good' },
      v.mismatches.length
        ? `Сверка с листом «Недели»: ${v.mismatches.length} расхождений из ${v.compared}`
        : `Сверка с листом «Недели»: все ${v.compared} значений совпали`) : null,
    v && v.compared && v.mismatches.length > v.compared / 2
      ? h('p', { class: 'warn' }, 'Почти всё не совпало — похоже, «Начало недели 1» в настройках выше отличается от даты в Excel: номера недель считаются по-разному.')
      : null,
    v && v.mismatches.length ? h('ul', { class: 'small' }, v.mismatches.slice(0, 20).map((m) => h('li', null, `нед. ${m.week}, ${m.field}: Excel ${m.excel}, здесь ${m.ours}`))) : null);
}

async function renderWorkoutEditor(container, idArg, app) {
  const { workouts, exercises } = app.boot;
  const isNew = idArg === 'new';
  const w = isNew ? { code: '', name: '', phase_from: 1, phase_to: 4, items: [] } : workouts.find((x) => x.id === Number(idArg));
  if (!w) {
    mount(container, h('p', null, 'Тренировка не найдена'), h('a', { href: '#/settings' }, '← Настройки'));
    return;
  }
  const items = w.items.map((i) => ({ ...i }));
  const code = h('input', { type: 'text', value: w.code, placeholder: 'LOWER_A', autocapitalize: 'characters' });
  const name = h('input', { type: 'text', value: w.name, placeholder: 'Низ A' });
  const pf = h('input', { class: 'num', type: 'text', inputmode: 'numeric', value: w.phase_from });
  const pt = h('input', { class: 'num', type: 'text', inputmode: 'numeric', value: w.phase_to });
  const list = h('div');

  const exSelect = (value, onchange, allowEmpty) => h('select', { onchange: (e) => onchange(e.target.value ? Number(e.target.value) : null) },
    allowEmpty ? h('option', { value: '' }, 'без замены') : null,
    exercises.map((e) => h('option', { value: e.id, selected: e.id === value }, e.name)));

  const draw = () => mount(list, items.map((it, idx) => {
    const n = (key, label) => h('label', { class: 'mini' }, h('span', null, label),
      h('input', { class: 'num', type: 'text', inputmode: 'numeric', value: it[key] ?? '', oninput: (e) => { it[key] = parseNum(e.target.value); } }));
    return h('div', { class: 'card inset prog-item' },
      h('div', { class: 'row-between' }, h('strong', null, `${idx + 1}.`),
        h('div', null,
          h('button', { class: 'icon-btn small', 'aria-label': 'Выше', disabled: idx === 0, onclick: () => { [items[idx - 1], items[idx]] = [items[idx], items[idx - 1]]; draw(); } }, '↑'),
          h('button', { class: 'icon-btn small', 'aria-label': 'Ниже', disabled: idx === items.length - 1, onclick: () => { [items[idx + 1], items[idx]] = [items[idx], items[idx + 1]]; draw(); } }, '↓'),
          h('button', { class: 'icon-btn small', 'aria-label': 'Удалить', onclick: () => { items.splice(idx, 1); draw(); } }, '✕'))),
      exSelect(it.exercise_id, (v) => { it.exercise_id = v; }),
      h('div', { class: 'mini-row' }, n('sets', 'Подходы'), n('rep_min', 'Повт. от'), n('rep_max', 'до'), n('rir_target', 'Запас')),
      h('label', { class: 'mini' }, h('span', null, 'Замена'), exSelect(it.substitute_exercise_id, (v) => { it.substitute_exercise_id = v; draw(); }, true)),
      it.substitute_exercise_id ? h('div', { class: 'mini-row' }, n('sub_rep_min', 'Замена: от'), n('sub_rep_max', 'до')) : null);
  }));
  draw();

  mount(container,
    h('header', { class: 'page-head' }, h('a', { href: '#/settings', class: 'muted' }, '← Настройки'), h('h1', null, isNew ? 'Новая тренировка' : w.name)),
    h('section', { class: 'card form' },
      h('label', { class: 'field' }, h('span', null, 'Код'), code),
      h('label', { class: 'field' }, h('span', null, 'Название'), name),
      h('div', { class: 'inline-form' }, h('span', null, 'Фазы с'), pf, h('span', null, 'по'), pt)),
    h('p', { class: 'muted small' }, 'Повторы — по типу упражнения: повторы, секунды (время), метры (дистанция) или минуты (кардио). 0–0 — «до запаса». Повторы замены можно не заполнять.'),
    list,
    h('button', { class: 'btn', onclick: () => { items.push({ exercise_id: exercises[0]?.id, sets: 3, rep_min: 8, rep_max: 10, rir_target: 2, substitute_exercise_id: null }); draw(); } }, '+ Упражнение'),
    h('div', { class: 'sheet-actions' },
      !isNew ? h('button', { class: 'btn ghost', onclick: async () => {
        if (!confirm(`Удалить тренировку «${w.name}»? Записанные подходы останутся.`)) return;
        await saveAndReload(app, 'DELETE', `workouts/${w.id}`, undefined, 'Удалено');
        app.go('#/settings');
      } }, 'Удалить') : null,
      h('button', { class: 'btn primary', onclick: async () => {
        const body = { code: code.value, name: name.value, phase_from: parseNum(pf.value), phase_to: parseNum(pt.value), items };
        try {
          const res = await api.call(isNew ? 'POST' : 'PUT', isNew ? 'workouts' : `workouts/${w.id}`, body);
          await app.reloadBoot();
          toast('Программа сохранена');
          app.go(`#/settings/workout/${res.workout.id}`);
        } catch (e) {
          toast(e.message, 'bad');
        }
      } }, 'Сохранить')));
}
