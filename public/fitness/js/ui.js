// Мини-хелперы DOM: h() для элементов, s() для SVG, тосты и нижняя шторка ввода.

export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  applyProps(el, props);
  append(el, children);
  return el;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
export function s(tag, props, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  applyProps(el, props, true);
  append(el, children);
  return el;
}

function applyProps(el, props, isSvg = false) {
  if (!props) return;
  for (const [k, v] of Object.entries(props)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.setAttribute('class', Array.isArray(v) ? v.filter(Boolean).join(' ') : v);
    else if (k === 'style') Object.assign(el.style, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value' && !isSvg) el.value = v;
    else if (k === 'checked' || k === 'selected' || k === 'disabled') el[k] = !!v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function mount(container, ...children) {
  container.replaceChildren();
  append(container, children);
}

let toastTimer = null;
export function toast(message, kind = '') {
  let el = document.getElementById('toast');
  if (!el) {
    el = h('div', { id: 'toast', role: 'status', 'aria-live': 'polite' });
    document.body.append(el);
  }
  el.className = `toast show ${kind}`;
  el.textContent = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

// Нижняя шторка с содержимым. Возвращает функцию закрытия.
export function sheet(title, body, { onClose } = {}) {
  const backdrop = h('div', { class: 'sheet-backdrop' });
  const panel = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div', { class: 'sheet-head' },
      h('h2', null, title),
      h('button', { class: 'icon-btn', 'aria-label': 'Закрыть', onclick: () => close() }, '✕')),
    body);
  const close = () => {
    backdrop.remove();
    panel.remove();
    document.removeEventListener('keydown', onKey);
    onClose?.();
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  backdrop.addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  document.body.append(backdrop, panel);
  // Фокус — синхронно, внутри обработчика нажатия: иначе iOS не покажет клавиатуру.
  const first = panel.querySelector('input:not([type=checkbox]), textarea, select');
  if (first) { first.focus({ preventScroll: true }); if (first.select) first.select(); }
  requestAnimationFrame(() => panel.classList.add('open'));
  return close;
}

export const icons = {
  today: 'M4 5h16v15H4zM4 9h16M8 3v4M16 3v4',
  workout: 'M3 10v4M6 7v10M18 7v10M21 10v4M6 12h12',
  progress: 'M4 19h16M6 16l4-5 3 3 5-7',
  tests: 'M9 4h6M10 4v5l-5 9a1.5 1.5 0 0 0 1.3 2h11.4a1.5 1.5 0 0 0 1.3-2l-5-9V4',
  nutrition: 'M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 21V3c-2.2 1.5-3 4-3 7 0 1.7 1.3 3 3 3',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12l2-1-1-3-2 .3-1.3-1.3.3-2-3-1-1 2h-2l-1-2-3 1 .3 2L6.3 7.3 4.3 7l-1 3 2 1v2l-2 1 1 3 2-.3 1.3 1.3-.3 2 3 1 1-2h2l1 2 3-1-.3-2 1.3-1.3 2 .3 1-3-2-1z',
};

export function icon(name) {
  return s('svg', { viewBox: '0 0 24 24', class: 'icon', 'aria-hidden': 'true' },
    s('path', { d: icons[name], fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
}
