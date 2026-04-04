export { Cache } from "../../cache";

export function secondsUntilNextWednesday4am(): number {
  const now = new Date();
  const dayOfWeek = now.getUTCDay(); // 0=Sun, 3=Wed
  let daysUntil = (3 - dayOfWeek + 7) % 7;
  if (daysUntil === 0 && now.getUTCHours() >= 4) {
    daysUntil = 7;
  }
  const target = new Date(now);
  target.setUTCDate(target.getUTCDate() + daysUntil);
  target.setUTCHours(4, 0, 0, 0);
  return Math.max(60, Math.floor((target.getTime() - now.getTime()) / 1000));
}
