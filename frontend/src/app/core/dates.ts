export const DAY = 86_400_000;

/** Anything carrying a due date, with an optional clock time on it. */
export interface Due {
  due: string | null;
  due_time: string | null;
}

/** Midnight today, local time, as epoch ms. */
export function today0(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function iso(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Midnight of the due date. Scopes and date buckets compare whole days, so they use
 * this and ignore any clock time.
 */
export function dueDayMs(due: string | null): number | null {
  return due ? new Date(`${due}T00:00`).getTime() : null;
}

/** The exact due moment, to the minute when one is set. Used for sorting and labels. */
export function dueMs(t: Due): number | null {
  return t.due ? new Date(`${t.due}T${(t.due_time ?? '00:00').slice(0, 5)}`).getTime() : null;
}

function timeLabel(due_time: string | null): string {
  if (!due_time) return '';
  const [h, m] = due_time.split(':');
  return ` ${new Date(2000, 0, 1, +h, +m).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })}`;
}

export function dueLabel(t: Due): string {
  const day = dueDayMs(t.due);
  if (day === null) return '';
  const now = today0();
  const date =
    day === now
      ? 'Today'
      : day === now + DAY
        ? 'Tomorrow'
        : day === now - DAY
          ? 'Yesterday'
          : new Date(day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return date + timeLabel(t.due_time);
}

/** Soonest due first, undated last, oldest first within a tie. */
export function byDueThenCreated(a: Due & { created_at: string }, b: Due & { created_at: string }): number {
  const am = dueMs(a) ?? Infinity;
  const bm = dueMs(b) ?? Infinity;
  return am === bm ? a.created_at.localeCompare(b.created_at) : am - bm;
}

/** Due today or already overdue — what the Today view and the progress bar count. */
export function dueToday(due: string | null, t = today0()): boolean {
  return (dueDayMs(due) ?? Infinity) <= t;
}
