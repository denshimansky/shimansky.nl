// Линейный график по неделям 0…N на SVG: точки данных, пунктир цели, подписи осей.
// Несколько линий: series = [{ points, cls, label }] — первая главная (подпись последнего значения).

import { s } from './ui.js?v=d67a901a70f5';
import { fmtNum } from './shared/dates.js?v=d67a901a70f5';

export function weekChart({ points, series = null, goal = null, maxWeek = 32, digits = 1, unit = '', label }) {
  const W = 340;
  const H = 180;
  const pad = { l: 36, r: 10, t: 12, b: 24 };
  const lines = series || [{ points, cls: '' }];
  const has = (p) => p.y !== null && p.y !== undefined;
  const vals = lines[0].points.filter(has);
  const ys = lines.flatMap((l) => l.points.filter(has).map((p) => p.y));
  if (goal !== null && goal !== undefined) ys.push(goal);
  if (!ys.length) {
    return s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': `${label}: нет данных` },
      s('text', { x: W / 2, y: H / 2, 'text-anchor': 'middle', class: 'chart-empty' }, 'Пока нет данных'));
  }
  let lo = Math.min(...ys);
  let hi = Math.max(...ys);
  const span = Math.max(hi - lo, 1);
  lo -= span * 0.12;
  hi += span * 0.12;
  const x = (w) => pad.l + (w / maxWeek) * (W - pad.l - pad.r);
  const y = (v) => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b);

  const ticks = [lo + (hi - lo) * 0.1, (lo + hi) / 2, hi - (hi - lo) * 0.1];
  const grid = ticks.map((t) => [
    s('line', { x1: pad.l, x2: W - pad.r, y1: y(t), y2: y(t), class: 'chart-grid' }),
    s('text', { x: pad.l - 4, y: y(t) + 3, 'text-anchor': 'end', class: 'chart-tick' }, fmtNum(t, span < 5 ? 1 : 0)),
  ]);
  const xTicks = [0, 6, 14, 24, 32].filter((w) => w <= maxWeek).map((w) =>
    s('text', { x: x(w), y: H - 6, 'text-anchor': 'middle', class: 'chart-tick' }, String(w)));

  // Линия рвётся на неделях без данных.
  const draw = ({ points: pts, cls = '', label: name }) => {
    const segments = [];
    let cur = [];
    for (const p of pts) {
      if (!has(p)) { if (cur.length) segments.push(cur); cur = []; continue; }
      cur.push(`${x(p.week).toFixed(1)},${y(p.y).toFixed(1)}`);
    }
    if (cur.length) segments.push(cur);
    return [
      segments.map((seg) => s('polyline', { points: seg.join(' '), class: ['chart-line', cls].filter(Boolean).join(' ') })),
      pts.filter(has).map((p) => s('circle', { cx: x(p.week), cy: y(p.y), r: 2.6, class: ['chart-dot', cls].filter(Boolean).join(' ') },
        s('title', null, `${name ? `${name}, н` : 'Н'}еделя ${p.week}: ${fmtNum(p.y, digits)} ${unit}`))),
    ];
  };

  const last = vals[vals.length - 1];
  return s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': last ? `${label}: последнее значение ${fmtNum(last.y, digits)} ${unit} на неделе ${last.week}` : label },
    grid, xTicks,
    goal !== null && goal !== undefined ? [
      s('line', { x1: pad.l, x2: W - pad.r, y1: y(goal), y2: y(goal), class: 'chart-goal' }),
      s('text', { x: W - pad.r, y: y(goal) - 4, 'text-anchor': 'end', class: 'chart-goal-label' }, `цель ${fmtNum(goal, digits)}`),
    ] : null,
    [...lines].reverse().map(draw),
    last ? s('text', { x: x(last.week), y: y(last.y) - 7, 'text-anchor': 'middle', class: 'chart-last' }, fmtNum(last.y, digits)) : null);
}
