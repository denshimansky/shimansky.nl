// Даты в трекере — строки 'YYYY-MM-DD' в местном времени пользователя.
// Арифметика идёт в «днях от эпохи» через UTC, поэтому переходы на летнее время её не ломают.

const DAY_MS = 86400000;

export function toDayNumber(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}

export function fromDayNumber(n) {
  return new Date(n * DAY_MS).toISOString().slice(0, 10);
}

export function addDays(iso, n) {
  return fromDayNumber(toDayNumber(iso) + n);
}

export function diffDays(a, b) {
  return toDayNumber(a) - toDayNumber(b);
}

export function isIsoDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return fromDayNumber(toDayNumber(s)) === s;
}

// Сегодняшняя дата в часовом поясе tz (по умолчанию Europe/Amsterdam).
export function todayIn(tz = 'Europe/Amsterdam', now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const get = (t) => parts.find((p) => p.type === t).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

// ISO-день недели: 1 = понедельник … 7 = воскресенье.
export function isoWeekday(iso) {
  const wd = new Date(toDayNumber(iso) * DAY_MS).getUTCDay();
  return wd === 0 ? 7 : wd;
}

// Расчёт 1: неделя 0 — всё, что раньше week1_start; дальше целые недели от старта, начиная с 1.
export function weekNo(iso, week1Start) {
  const d = diffDays(iso, week1Start);
  if (d < 0) return 0;
  return Math.floor(d / 7) + 1;
}

// Даты недели. Для недели 0 — семь дней перед стартом (для отображения;
// в расчётах неделя 0 включает все дни до старта).
export function weekRange(week, week1Start) {
  const from = addDays(week1Start, (week - 1) * 7);
  return { from, to: addDays(from, 6) };
}

const WEEKDAYS_SHORT = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
export const WEEKDAY_NAMES = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

export function weekdayShort(iso) {
  return WEEKDAYS_SHORT[isoWeekday(iso) - 1];
}

export function fmtDateLong(iso) {
  const [, m, d] = iso.split('-').map(Number);
  return `${WEEKDAY_NAMES[isoWeekday(iso) - 1]}, ${d} ${MONTHS_GEN[m - 1]}`;
}

export function fmtDateShort(iso) {
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS_SHORT[m - 1]}`;
}

// Числа — с десятичной запятой и узким пробелом в тысячах, как в ru-RU.
const nfCache = new Map();
export function fmtNum(x, digits = 1) {
  if (x === null || x === undefined || Number.isNaN(x)) return '—';
  const key = digits;
  if (!nfCache.has(key)) {
    nfCache.set(key, new Intl.NumberFormat('ru-RU', { maximumFractionDigits: digits, minimumFractionDigits: 0 }));
  }
  return nfCache.get(key).format(x);
}

export function fmtSigned(x, digits = 1) {
  if (x === null || x === undefined || Number.isNaN(x)) return '—';
  const s = fmtNum(Math.abs(x), digits);
  if (Math.abs(x) < Math.pow(10, -digits) / 2) return s;
  return (x > 0 ? '+' : '−') + s;
}

// Парсинг ввода пользователя: «92,4», «92.4», « 9 500 ».
export function parseNum(s) {
  if (typeof s === 'number') return Number.isFinite(s) ? s : null;
  if (s === null || s === undefined) return null;
  const t = String(s).replace(/[\s  ]/g, '').replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
