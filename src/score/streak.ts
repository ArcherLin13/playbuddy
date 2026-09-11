import { meetsMoneyMinimum } from './dayMoney';
import type { PracticeSession } from '../types';
import { DEFAULT_SETTINGS } from '../types';

/**
 * 连击达标：当天有效时长达到起薪门槛（默认 30 分钟）。
 * 与零花钱门槛一致，避免「练几秒也进连击」。
 */
export function dayQualifiesForStreak(
  session: Pick<PracticeSession, 'effectiveMs'>,
  moneyMinMinutes: number = DEFAULT_SETTINGS.moneyMinMinutes
): boolean {
  return meetsMoneyMinimum(session.effectiveMs, moneyMinMinutes);
}

/**
 * 连续达标系数（在基础零花钱上乘）：
 * 1天 ×1.0 · 2–3天 ×1.1 · 4–6天 ×1.2 · 7–13天 ×1.3 · 14天+ ×1.5
 */
export function streakMultiplier(streakDays: number): number {
  const n = Math.max(0, Math.floor(streakDays));
  if (n >= 14) return 1.5;
  if (n >= 7) return 1.3;
  if (n >= 4) return 1.2;
  if (n >= 2) return 1.1;
  return 1;
}

export function formatStreakMultiplier(mult: number): string {
  if (mult <= 1) return '×1';
  return `×${mult.toFixed(1).replace(/\.0$/, '')}`;
}

/**
 * 从 anchor 当天往回数连续达标天数。
 * 若当天未达标，返回 0（今日不吃连击加成）。
 */
export function computeStreakDays(
  sessions: PracticeSession[],
  anchorStartedAt: number,
  moneyMinMinutes: number,
  dayKeyFn: (ts: number) => string
): number {
  const byDay = new Map<string, PracticeSession>();
  for (const s of sessions) {
    byDay.set(dayKeyFn(s.startedAt), s);
  }

  let streak = 0;
  let cursor = noonLocal(anchorStartedAt);
  for (;;) {
    const key = dayKeyFn(cursor);
    const day = byDay.get(key);
    if (!day || !dayQualifiesForStreak(day, moneyMinMinutes)) break;
    streak += 1;
    cursor = addCalendarDays(cursor, -1);
  }
  return streak;
}

function noonLocal(ts: number): number {
  const d = new Date(ts);
  d.setHours(12, 0, 0, 0);
  return d.getTime();
}

export function addCalendarDays(ts: number, delta: number): number {
  const d = new Date(ts);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + delta);
  return d.getTime();
}
