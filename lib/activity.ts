const DAY = 24 * 60 * 60 * 1000;

export function activityAge(createdAt: number, now: number): string {
  const elapsed = Math.max(0, now - createdAt);
  const days = Math.floor(elapsed / DAY);
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export function activityLine(
  summary: string,
  createdAt: number,
  now: number,
): string {
  return `${summary} ${activityAge(createdAt, now)}`;
}
