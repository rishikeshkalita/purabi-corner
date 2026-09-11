/** Purabi Corner business day: 03:00 local time -> 02:59:59 next day. */
export const BUSINESS_DAY_RESET_HOUR = 3;

export function localDateKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function businessDayKey(date = new Date()): string {
  const shifted = new Date(date);
  if (shifted.getHours() < BUSINESS_DAY_RESET_HOUR) {
    shifted.setDate(shifted.getDate() - 1);
  }
  return localDateKey(shifted);
}

export function businessDayBounds(key: string) {
  const [year, month, day] = key.split('-').map(Number);
  const start = new Date(year, month - 1, day, BUSINESS_DAY_RESET_HOUR, 0, 0, 0);
  const end = new Date(year, month - 1, day + 1, BUSINESS_DAY_RESET_HOUR, 0, 0, 0);
  return { start, end };
}

export function isInBusinessDay(timestamp: string, key: string) {
  const time = new Date(timestamp).getTime();
  const { start, end } = businessDayBounds(key);
  return time >= start.getTime() && time < end.getTime();
}

export function formatBusinessDay(key: string) {
  const [year, month, day] = key.split('-').map(Number);
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(
    new Date(year, month - 1, day, 12),
  );
}
