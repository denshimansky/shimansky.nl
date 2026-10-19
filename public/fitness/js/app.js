import * as api from './api.js';
import { h, mount, icon, toast } from './ui.js';
import { todayIn } from './shared/dates.js';
import * as today from './views/today.js';
import * as workout from './views/workout.js';
import * as progress from './views/progress.js';
import * as tests from './views/tests.js';
import * as settings from './views/settings.js';

const VIEWS = { today, workout, progress, tests, settings };
const NAV = [
  ['today', 'Сегодня'],
  ['workout', 'Тренировка'],
  ['progress', 'Прогресс'],
  ['tests', 'Тесты'],
  ['settings', 'Настройки'],
];

export const app = {
  boot: null,
  today: null,
  async reloadBoot() {
    const { data } = await api.get('bootstrap');
    app.boot = data;
    app.today = todayIn(data.settings.timezone);
    return data;
  },
  go(hash) {
    if (location.hash === hash) render();
    else location.hash = hash;
  },
  rerender: () => render(),
};

const main = document.getElementById('main');
const nav = document.getElementById('nav');
const statusEl = document.getElementById('status');

function parseRoute() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const name = VIEWS[parts[0]] ? parts[0] : 'today';
  return { name, args: VIEWS[parts[0]] ? parts.slice(1) : [] };
}

let renderSeq = 0;
async function render() {
  const route = parseRoute();
  const seq = ++renderSeq;
  for (const a of nav.querySelectorAll('a')) a.classList.toggle('active', a.dataset.view === route.name);
  if (app.boot) app.today = todayIn(app.boot.settings.timezone);
  const container = h('div', { class: `view view-${route.name}` });
  try {
    await VIEWS[route.name].render(container, route.args, app);
    if (seq !== renderSeq) return;
    mount(main, container);
  } catch (e) {
    if (seq !== renderSeq) return;
    mount(main, h('div', { class: 'view' }, h('p', { class: 'error-box' }, e.message)));
  }
}

function renderStatus(st) {
  const items = [];
  if (st.authLost) items.push(h('a', { class: 'status-pill bad', href: api.loginUrl() }, 'Сессия истекла — войти'));
  else if (!st.online) items.push(h('span', { class: 'status-pill' }, st.pending ? `Нет сети · в очереди ${st.pending}` : 'Нет сети'));
  else if (st.pending) items.push(h('span', { class: 'status-pill' }, `Синхронизация · ${st.pending}`));
  mount(statusEl, items);
  statusEl.hidden = !items.length;
}

function buildNav() {
  mount(nav, NAV.map(([id, label]) => h('a', { href: `#/${id}`, 'data-view': id }, icon(id), h('span', null, label))));
}

// Из-за <base href> ссылка «#/progress» вела бы на …/fitness/#/progress — то есть на другую
// страницу с перезагрузкой. Перехватываем и меняем только хэш.
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey) return;
  e.preventDefault();
  location.hash = a.getAttribute('href');
});

async function start() {
  buildNav();
  api.onChange((st) => {
    renderStatus(st);
    if (st.errors?.length) toast(st.errors[0], 'bad');
  });
  renderStatus(api.status());
  // Данные «Сегодня» грузим параллельно с bootstrap: на 4G это экономит целый круг до сервера.
  if (parseRoute().name === 'today' && !parseRoute().args[0]) api.prefetch(`day/${todayIn('Europe/Amsterdam')}`);
  try {
    await api.ready();
    await app.reloadBoot();
  } catch (e) {
    if (api.status().authLost) return location.replace(api.loginUrl());
    mount(main, h('div', { class: 'view' }, h('p', { class: 'error-box' }, e.message)));
    return;
  }
  window.addEventListener('hashchange', render);
  await render();
  // После синхронизации очереди перечитываем данные, чтобы кэш был свежим.
  api.onChange((st) => {
    if (!st.synced) return;
    const view = VIEWS[parseRoute().name];
    if (view.onSynced) view.onSynced(parseRoute().args, app);
    else if (!document.querySelector('.sheet') && !document.activeElement?.matches('input, textarea, select')) render();
  });
  api.flush();
  if ('serviceWorker' in navigator) {
    // В локальной сборке sw лежит в корне сайта (/fitness-sw.js), иначе он не смог бы обслуживать адрес /fitness.
    const sw = document.querySelector('meta[name="fit-sw"]')?.content || new URL('sw.js', document.baseURI).href;
    navigator.serviceWorker.register(sw, { scope: api.APP_URL }).catch(() => {});
  }
}

start();
