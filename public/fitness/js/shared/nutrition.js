// Расчёты экрана «Питание» и цели калорий из MacroFactor. Чистые функции — для сервера, браузера и тестов.

import { weekNo, weekRange, addDays } from './dates.js?v=d67a901a70f5';
import { phaseForWeek, TOTAL_WEEKS } from './calc.js?v=d67a901a70f5';

export const KCAL_PER_KG = 7700;
export const PROTEIN_SLACK_G = 10;

const has = (v) => v !== null && v !== undefined;
const mean = (xs) => {
  const v = xs.filter(has).map(Number);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

// Откуда цель калорий: настройка или, если не задана, — MacroFactor при наличии импорта.
export function calorieSource(settings, hasImports) {
  if (settings?.calorie_source === 'plan' || settings?.calorie_source === 'macrofactor') return settings.calorie_source;
  return hasImports ? 'macrofactor' : 'plan';
}

// Цель дня из MacroFactor: последний импортированный день не позже date, где цель есть.
export function mfTargetFor(date, nutrition) {
  let best = null;
  for (const r of nutrition) {
    if (r.date > date || !has(r.kcal_target)) continue;
    if (!best || r.date > best.date) best = r;
  }
  return best ? { date: best.date, kcal: best.kcal_target, protein_g: best.protein_target_g ?? null } : null;
}

// Цели дня с учётом источника: калории и (если есть) белок из MacroFactor, шаги — всегда по фазе.
export function effectiveTargets(planTargets, source, mf) {
  if (source !== 'macrofactor' || !mf) return { ...planTargets, source: 'plan' };
  return { ...planTargets, kcal: mf.kcal ?? planTargets.kcal, protein_g: mf.protein_g ?? planTargets.protein_g, source: 'macrofactor' };
}

// Пиво/чипсы: лимит вечеров в неделю — 2, в фазе 4 — 1.
export function beerLimit(phaseNo) {
  return phaseNo === 4 ? 1 : 2;
}

// Сводка недели: средние ккал/цель/белок/расход, дни с белком не ниже цели − 10 г, баланс.
// proteinTarget(date) — цель белка дня (по фазе или из MacroFactor).
export function nutritionWeek(nutrition, from, to, proteinTarget) {
  const days = nutrition.filter((r) => r.date >= from && r.date <= to && (has(r.kcal) || has(r.expenditure_kcal)));
  const eaten = days.filter((r) => has(r.kcal));
  const kcal = mean(eaten.map((r) => r.kcal));
  const target = mean(eaten.map((r) => r.kcal_target));
  const expenditure = mean(days.map((r) => r.expenditure_kcal));
  const withProtein = eaten.filter((r) => has(r.protein_g));
  const proteinOk = withProtein.filter((r) => {
    const t = proteinTarget(r.date);
    return has(t) && r.protein_g >= t - PROTEIN_SLACK_G;
  }).length;
  // Баланс считаем только по дням, где есть и расход, и съеденное.
  const both = eaten.filter((r) => has(r.expenditure_kcal));
  const balance = both.length ? mean(both.map((r) => r.expenditure_kcal - r.kcal)) : null;
  return {
    days: eaten.length,
    kcal, kcal_target: target, expenditure,
    protein_g: mean(withProtein.map((r) => r.protein_g)),
    protein_target_g: mean(eaten.map((r) => proteinTarget(r.date))),
    protein_ok_days: proteinOk, protein_days: withProtein.length,
    balance_kcal: balance,
    balance_kg_week: balance === null ? null : (balance * 7) / KCAL_PER_KG,
  };
}

// Ряды графиков по неделям 0…N: ккал, расход, цель; вес тренда MacroFactor и средний вес дневника.
export function nutritionWeekly(nutrition, daily, settings, lastWeek = TOTAL_WEEKS) {
  const week0 = addDays(settings.week1_start, -7);
  const byWeek = (rows, pick) => {
    const m = new Map();
    for (const r of rows) {
      if (r.date < week0) continue;
      const w = weekNo(r.date, settings.week1_start);
      if (w < 0 || w > lastWeek) continue;
      if (!m.has(w)) m.set(w, []);
      m.get(w).push(pick(r));
    }
    return Array.from({ length: lastWeek + 1 }, (_, w) => ({ week: w, y: mean(m.get(w) || []) }));
  };
  return {
    kcal: byWeek(nutrition, (r) => r.kcal),
    expenditure: byWeek(nutrition, (r) => r.expenditure_kcal),
    target: byWeek(nutrition, (r) => r.kcal_target),
    trend_weight: byWeek(nutrition, (r) => r.trend_weight_kg),
    diary_weight: byWeek(daily, (r) => r.weight_kg),
  };
}

// На сколько ккал больше в дни с пивом/чипсами, чем в остальные (по дням, где известны и то и другое).
export function beerEffect(nutrition, daily) {
  const kcal = new Map(nutrition.filter((r) => has(r.kcal)).map((r) => [r.date, r.kcal]));
  const yes = [];
  const no = [];
  for (const d of daily) {
    if (!kcal.has(d.date) || !has(d.beer_chips)) continue;
    (d.beer_chips ? yes : no).push(kcal.get(d.date));
  }
  if (!yes.length || !no.length) return { diff: null, beer_days: yes.length, other_days: no.length };
  return { diff: mean(yes) - mean(no), beer_days: yes.length, other_days: no.length };
}

// Вечера с пивом/чипсами на неделе даты и лимит.
export function beerWeek(daily, date, settings, phases) {
  const week = weekNo(date, settings.week1_start);
  const { from, to } = weekRange(week, settings.week1_start);
  const count = daily.filter((d) => d.date >= from && d.date <= to && (d.beer_chips === 1 || d.beer_chips === true)).length;
  return { count, limit: beerLimit(phaseForWeek(week, phases)?.phase_no ?? null) };
}
