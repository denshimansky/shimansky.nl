// Мини-хелперы DOM: h() для элементов, s() для SVG, тосты, нижняя шторка ввода и листание.

import { spring, velocityTracker, project, rubberband, reducedMotion, HYSTERESIS } from './motion.js';

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

// Клик, который браузер пришлёт сразу после перетаскивания, — не нажатие.
function suppressClick(el) {
  const until = performance.now() + 350;
  const stop = (ev) => {
    el.removeEventListener('click', stop, true);
    if (performance.now() < until) { ev.stopPropagation(); ev.preventDefault(); }
  };
  el.addEventListener('click', stop, true);
  setTimeout(() => el.removeEventListener('click', stop, true), 400);
}

// Нижняя шторка с содержимым. Возвращает функцию закрытия.
// Шторка тянется пальцем 1:1 (за ручку и шапку, а если содержимое не прокручивается — за любое место),
// бросок вниз закрывает её с той же скоростью, вверх — мягкий резиновый край. Пружину можно перехватить на лету.
export function sheet(title, body, { onClose } = {}) {
  const backdrop = h('div', { class: 'sheet-backdrop' });
  const head = h('div', { class: 'sheet-head' },
    h('h2', null, title),
    h('button', { class: 'icon-btn', 'aria-label': 'Закрыть', onclick: () => close() }, '✕'));
  const panel = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div', { class: 'sheet-grabber', 'aria-hidden': 'true' }), head, body);

  const still = reducedMotion();
  let y = 0;
  let anim = null;
  let closing = false;
  let removed = false;
  const height = () => panel.offsetHeight || 1;
  const set = (v) => {
    y = v;
    panel.style.transform = `translate3d(0, ${v}px, 0)`;
    backdrop.style.opacity = String(Math.min(1, Math.max(0, 1 - v / height())));
  };
  const halt = () => {
    const cur = anim ? anim.stop() : { value: y, velocity: 0 };
    anim = null;
    return cur;
  };
  const animateTo = (target, { velocity, damping = 1, response = 0.35, done } = {}) => {
    const cur = halt();
    anim = spring({ from: cur.value, to: target, velocity: velocity ?? cur.velocity, damping, response, onUpdate: set, onDone: () => { anim = null; done?.(); } });
  };
  const finish = () => {
    if (removed) return;
    removed = true;
    backdrop.remove();
    panel.remove();
    document.removeEventListener('keydown', onKey);
    onClose?.();
  };
  const close = (velocity) => {
    if (closing || removed) return;
    closing = true;
    document.activeElement?.blur?.();
    if (still) { panel.classList.remove('open'); backdrop.classList.remove('open'); setTimeout(finish, 200); return; }
    animateTo(height(), { velocity, response: 0.3, done: finish });
    // Если кадры не идут (приложение свернули), шторка всё равно закроется.
    setTimeout(() => { if (closing && !removed) { halt(); finish(); } }, 900);
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  backdrop.addEventListener('click', () => close());
  document.addEventListener('keydown', onKey);

  // ——— Перетаскивание ———
  const tracker = velocityTracker();
  let drag = null;
  const scrollable = () => panel.scrollHeight > panel.clientHeight + 1;
  panel.addEventListener('pointerdown', (e) => {
    if (still || e.button > 0) return;
    const onHandle = head.contains(e.target) || e.target.classList.contains('sheet-grabber');
    if (!onHandle && (scrollable() || e.target.closest('input, textarea, select'))) return;
    drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, from: y, active: false };
    tracker.reset();
    tracker.add(e.clientY);
  });
  panel.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x0;
    const dy = e.clientY - drag.y0;
    if (!drag.active) {
      if (Math.abs(dx) > HYSTERESIS && Math.abs(dx) > Math.abs(dy)) { drag = null; return; }
      if (Math.abs(dy) < HYSTERESIS) return;
      drag.active = true;
      drag.from = halt().value;
      drag.y0 = e.clientY;
      if (closing) closing = false;
      try { panel.setPointerCapture(e.pointerId); } catch { /* указатель уже отпущен */ }
      panel.classList.add('dragging');
    }
    tracker.add(e.clientY);
    const next = drag.from + (e.clientY - drag.y0);
    set(next < 0 ? rubberband(next, height()) : next);
  });
  const release = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const wasActive = drag.active;
    drag = null;
    panel.classList.remove('dragging');
    if (!wasActive) return;
    suppressClick(panel);
    const v = tracker.velocity();
    const landing = y + project(v);
    if (landing > height() * 0.5 || v > 1200) close(v);
    else animateTo(0, { velocity: v, damping: Math.abs(v) > 300 ? 0.8 : 1, response: 0.3 });
  };
  panel.addEventListener('pointerup', release);
  panel.addEventListener('pointercancel', release);

  document.body.append(backdrop, panel);
  // Фокус — синхронно, внутри обработчика нажатия: иначе iOS не покажет клавиатуру.
  const first = panel.querySelector('input:not([type=checkbox]), textarea, select');
  if (first) { first.focus({ preventScroll: true }); if (first.select) first.select(); }
  if (still) {
    requestAnimationFrame(() => { panel.classList.add('open'); backdrop.classList.add('open'); });
  } else {
    set(height());
    animateTo(0, { response: 0.35 });
  }
  return () => close();
}

// Горизонтальное листание (дни на «Сегодня»): содержимое едет за пальцем, бросок решает, листать ли.
// Если листать некуда — резиновый край. Вертикальная прокрутка остаётся браузеру (touch-action: pan-y).
export function swipePager(el, { canPrev, canNext, onPrev, onNext }) {
  if (reducedMotion()) return;
  const tracker = velocityTracker();
  let drag = null;
  let anim = null;
  let x = 0;
  const width = () => el.offsetWidth || window.innerWidth;
  const set = (v) => { x = v; el.style.transform = v ? `translate3d(${v}px, 0, 0)` : ''; };
  const to = (target, velocity, done, damping = 1) => {
    anim?.stop();
    anim = spring({ from: x, to: target, velocity, damping, response: 0.3, onUpdate: set, onDone: () => { anim = null; done?.(); } });
  };
  el.style.touchAction = 'pan-y';
  el.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' || document.querySelector('.sheet')) return;
    drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, active: false };
    tracker.reset();
    tracker.add(e.clientX);
  });
  el.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x0;
    const dy = e.clientY - drag.y0;
    if (!drag.active) {
      if (Math.abs(dy) > HYSTERESIS && Math.abs(dy) > Math.abs(dx)) { drag = null; return; }
      if (Math.abs(dx) < HYSTERESIS) return;
      drag.active = true;
      drag.x0 = e.clientX;
      drag.from = anim ? anim.stop().value : x;
      anim = null;
      try { el.setPointerCapture(e.pointerId); } catch { /* указатель уже отпущен */ }
    }
    tracker.add(e.clientX);
    let next = drag.from + (e.clientX - drag.x0);
    if ((next < 0 && !canNext()) || (next > 0 && !canPrev())) next = rubberband(next, width());
    set(next);
  });
  const release = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const wasActive = drag.active;
    drag = null;
    if (!wasActive) return;
    suppressClick(el);
    const v = tracker.velocity();
    const landing = x + project(v, 0.99);
    const W = width();
    if (landing < -W * 0.35 && canNext()) to(-W, v, onNext);
    else if (landing > W * 0.35 && canPrev()) to(W, v, onPrev);
    else to(0, v, null, Math.abs(v) > 300 ? 0.8 : 1);
  };
  el.addEventListener('pointerup', release);
  el.addEventListener('pointercancel', (e) => { if (drag?.active) release(e); else drag = null; });
}

// Новый экран въезжает с той стороны, куда ушёл старый (dir: 1 — справа, −1 — слева).
export function enterFrom(el, dir) {
  if (!dir || reducedMotion()) return;
  const set = (v) => { el.style.transform = v ? `translate3d(${v}px, 0, 0)` : ''; el.style.opacity = String(1 - Math.min(1, Math.abs(v) / 160)); };
  set(dir * 72);
  spring({ from: dir * 72, to: 0, response: 0.32, onUpdate: set, onDone: () => { el.style.opacity = ''; } });
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
