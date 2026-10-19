// Экспорт таблиц в CSV — одинаковые колонки на сервере и в локальном режиме.

export const TABLE_COLUMNS = {
  settings: ['id', 'week1_start', 'timezone', 'goal_weight_kg', 'goal_waist_cm'],
  phases: ['phase_no', 'name', 'week_from', 'week_to', 'kcal_target', 'protein_target_g', 'steps_target', 'pace_limit_kg'],
  daily_log: ['date', 'weight_kg', 'kcal', 'protein_g', 'steps', 'sleep_h', 'beer_chips', 'note', 'updated_at'],
  weekly_log: ['week_no', 'waist_cm', 'planned_sessions', 'is_deload'],
  exercises: ['id', 'name', 'increment_kg'],
  workouts: ['id', 'code', 'name', 'phase_from', 'phase_to'],
  workout_exercises: ['id', 'workout_id', 'position', 'exercise_id', 'sets', 'rep_min', 'rep_max', 'rir_target', 'substitute_exercise_id'],
  schedule: ['phase_no', 'weekday', 'workout_id'],
  sessions: ['id', 'date', 'workout_id', 'notes', 'completed_at', 'source'],
  set_logs: ['session_id', 'exercise_id', 'set_no', 'weight_kg', 'reps', 'rir'],
  tests: ['week_no', 'date', 'weight_kg', 'waist_cm', 'pullups', 'pushups', 'plank_sec', 'photo_done', 'note'],
};

function cell(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",;\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// BOM — чтобы Excel сразу открыл кириллицу в UTF-8.
export function toCsv(cols, rows) {
  const lines = [cols.join(',')];
  for (const r of rows) lines.push(cols.map((c) => cell(r[c])).join(','));
  return '﻿' + lines.join('\r\n') + '\r\n';
}
