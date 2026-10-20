// Движение: пружины, скорость жеста, проекция броска, резиновый край.
// Пружина задаётся как в UIKit — damping (1 = без перелёта) и response (секунды, «как быстро»), без длительности.
// Анимация всегда стартует с текущего значения и скорости, поэтому её можно перехватить пальцем в любой момент.

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const SUBSTEP = 1 / 240;
const REST_DELTA = 0.5;
const REST_SPEED = 5;

// Возвращает { stop() → { value, velocity } }. onUpdate(x) — каждый кадр, onDone() — когда пружина успокоилась.
export function spring({ from, to, velocity = 0, damping = 1, response = 0.35, onUpdate, onDone }) {
  const stiffness = (2 * Math.PI / response) ** 2;
  const friction = (4 * Math.PI * damping) / response;
  let x = from;
  let v = velocity;
  let raf = 0;
  let last = null;
  const frame = (t) => {
    const dt = last === null ? 1 / 60 : Math.min(0.064, (t - last) / 1000);
    last = t;
    const n = Math.max(1, Math.ceil(dt / SUBSTEP));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      v += (-stiffness * (x - to) - friction * v) * h;
      x += v * h;
    }
    if (Math.abs(x - to) < REST_DELTA && Math.abs(v) < REST_SPEED) {
      x = to;
      v = 0;
      onUpdate(x);
      raf = 0;
      onDone?.();
      return;
    }
    onUpdate(x);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return {
    stop() {
      cancelAnimationFrame(raf);
      raf = 0;
      return { value: x, velocity: v };
    },
  };
}

// Скорость по последним ~100 мс движения (px/с) — для передачи пружине и проекции.
export function velocityTracker() {
  const pts = [];
  return {
    add(pos, t = performance.now()) {
      pts.push({ pos, t });
      while (pts.length > 2 && t - pts[0].t > 100) pts.shift();
    },
    velocity() {
      if (pts.length < 2) return 0;
      const a = pts[0];
      const b = pts[pts.length - 1];
      const dt = (b.t - a.t) / 1000;
      return dt > 0 ? (b.pos - a.pos) / dt : 0;
    },
    reset() { pts.length = 0; },
  };
}

// Куда «долетит» бросок при замедлении как у прокрутки iOS (decelerationRate 0.998, 0.99 — короче).
export function project(velocity, decelerationRate = 0.998) {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

// Сопротивление за краем: чем дальше, тем меньше следует за пальцем.
export function rubberband(overshoot, dimension, constant = 0.55) {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

export const HYSTERESIS = 10;
