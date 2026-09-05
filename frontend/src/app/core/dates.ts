export const DAY = 86_400_000;

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

/** 'YYYY-MM-DD' → epoch ms at local midnight, or null. */
export function dueMs(due: string | null): number | null {
  return due ? new Date(`${due}T00:00`).getTime() : null;
}

export function dueLabel(due: string | null): string {
  const ms = dueMs(due);
  if (ms === null) return '';
  const t = today0();
  if (ms === t) return 'Today';
  if (ms === t + DAY) return 'Tomorrow';
  if (ms === t - DAY) return 'Yesterday';
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
