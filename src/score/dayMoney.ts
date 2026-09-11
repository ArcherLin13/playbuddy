import { DEFAULT_SETTINGS } from '../types';

export const DEFAULT_DAILY_MONEY_CAP = DEFAULT_SETTINGS.dailyMoneyCap;
export const DEFAULT_MONEY_MIN_MINUTES = DEFAULT_SETTINGS.moneyMinMinutes;
export const MONEY_HOUR_YUAN = 10;
/** 防计时忘关：超过 8 小时按 8 小时算。奖励只看当天有效总时长。 */
export const MAX_MONEY_HOURS = 8;

export function meetsMoneyMinimum(
  effectiveMs: number,
  minMinutes: number = DEFAULT_MONEY_MIN_MINUTES
): boolean {
  const minMs = Math.max(0, minMinutes) * 60_000;
  return effectiveMs >= minMs;
}

/**
 * 当天有效总时长 → 钱，不看乐器、不看评分。
 * 60 分 ¥10 · 120 分 ¥30 · 180 分 ¥60 · 240 分 ¥100，公式 5 × 小时 × (小时+1)。
 */
export function moneyFromDuration(
  effectiveMs: number,
  dailyCap: number = DEFAULT_DAILY_MONEY_CAP,
  minMinutes: number = DEFAULT_MONEY_MIN_MINUTES
): number {
  if (minMinutes > 0 && !meetsMoneyMinimum(effectiveMs, minMinutes)) return 0;
  const hours = Math.min(Math.max(0, effectiveMs) / 3_600_000, MAX_MONEY_HOURS);
  const scale = Math.max(0, dailyCap) / MONEY_HOUR_YUAN;
  return Math.round(5 * hours * (hours + 1) * scale * 10) / 10;
}

/** 连击后硬顶：8 小时基础金额 × 1.5 */
export function hardMoneyCap(dailyCap: number = DEFAULT_DAILY_MONEY_CAP): number {
  const top = moneyFromDuration(MAX_MONEY_HOURS * 3_600_000, dailyCap, 0);
  return Math.round(top * 1.5 * 10) / 10;
}

/** @deprecated 金额已改为只看时长；score 参数忽略。 */
export function moneyFromScore(
  _score: number,
  dailyCap: number = DEFAULT_DAILY_MONEY_CAP,
  effectiveMs: number = Number.POSITIVE_INFINITY,
  minMinutes: number = DEFAULT_MONEY_MIN_MINUTES
): number {
  return moneyFromDuration(effectiveMs, dailyCap, minMinutes);
}

/** 基础金额 × 连击系数，上限为 8 小时金额的 1.5 倍 */
export function applyStreakToMoney(
  baseYuan: number,
  multiplier: number,
  dailyCap: number = DEFAULT_DAILY_MONEY_CAP
): number {
  if (baseYuan <= 0) return 0;
  const earned = Math.round(Math.max(0, baseYuan) * Math.max(1, multiplier) * 10) / 10;
  return Math.min(hardMoneyCap(dailyCap), earned);
}

export function formatYuan(amount: number): string {
  const n = Math.max(0, amount);
  return Number.isInteger(n) ? `¥${n}` : `¥${n.toFixed(1)}`;
}

export function sumEarnedYuan(sessions: { earnedYuan?: number }[]): number {
  return Math.round(sessions.reduce((sum, s) => sum + (s.earnedYuan ?? 0), 0) * 10) / 10;
}

/** Money not yet paid out by parent. */
export function sumPendingYuan(
  sessions: { earnedYuan?: number; settled?: boolean }[]
): number {
  return sumEarnedYuan(sessions.filter((s) => !s.settled));
}

/** Money already marked as paid. */
export function sumSettledYuan(
  sessions: { earnedYuan?: number; settled?: boolean }[]
): number {
  return sumEarnedYuan(sessions.filter((s) => s.settled));
}

/** 距起薪还差多少有效分钟（已达标则为 0） */
export function minutesUntilMoney(
  effectiveMs: number,
  minMinutes: number = DEFAULT_MONEY_MIN_MINUTES
): number {
  const have = Math.max(0, effectiveMs) / 60_000;
  return Math.max(0, Math.ceil(minMinutes - have));
}
