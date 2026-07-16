const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function dateFromKey(dateKey: string) {
  const match = DATE_KEY_PATTERN.exec(dateKey);
  if (!match) throw new Error(`Invalid date key: ${dateKey}`);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
}

export function dateToKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(dateKey: string, amount: number) {
  const date = dateFromKey(dateKey);
  date.setDate(date.getDate() + amount);
  return dateToKey(date);
}

export function startOfWeek(dateKey: string) {
  const date = dateFromKey(dateKey);
  const mondayOffset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - mondayOffset);
  return dateToKey(date);
}

export function getWeekDateKeys(dateKey: string) {
  const monday = startOfWeek(dateKey);
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

export function formatMenuDate(dateKey: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(dateFromKey(dateKey));
}

export function formatPageDate(dateKey: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(dateFromKey(dateKey));
}

export function formatWeekRange(dateKey: string) {
  const dates = getWeekDateKeys(dateKey);
  const first = dateFromKey(dates[0]);
  const last = dateFromKey(dates[6]);
  const firstLabel = `${first.getMonth() + 1}月${first.getDate()}日`;
  const lastLabel = `${last.getMonth() + 1}月${last.getDate()}日`;
  return `${firstLabel}—${lastLabel}`;
}
