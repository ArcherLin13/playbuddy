import { DEFAULT_SETTINGS } from '../types';

export const DEFAULT_DAILY_MONEY_CAP = DEFAULT_SETTINGS.dailyMoneyCap;
export const DEFAULT_MONEY_MIN_MINUTES = DEFAULT_SETTINGS.moneyMinMinutes;

/**
 * 基础零花钱：有效时长未达门槛 → ¥0；
 * 达标后按综合分线性折算（满分 → 基础封顶）。
 */
export function moneyFromScore(
  score: number,
  dailyCap: number = DEFAULT_DAILY_MONEY_CAP,
  effectiveMs: number = Number.POSITIVE_INFINITY,
  minMinutes: number = DEFAULT_MONEY_MIN_MINUTES
): number {
  if (!meetsMoneyMinimum(effectiveMs, minMinutes)) return 0;
  const s = Math.max(0, Math.min(100, score));
  const cap = Math.max(0, dailyCap);
  return Math.round((s / 100) * cap * 10) / 10;
}

export function meetsMoneyMinimum(
  effectiveMs: number,
  minMinutes: number = DEFAULT_MONEY_MIN_MINUTES
): boolean {
  const minMs = Math.max(0, minMinutes) * 60_000;
  return effectiveMs >= minMs;
}

/** 基础金额 × 连击系数，上限为 dailyCap × 1.5（14 天满加成） */
export function applyStreakToMoney(
  baseYuan: number,
  multiplier: number,
  dailyCap: number = DEFAULT_DAILY_MONEY_CAP
): number {
  if (baseYuan <= 0) return 0;
  const hardCap = Math.round(Math.max(0, dailyCap) * 1.5 * 10) / 10;
  const earned = Math.round(Math.max(0, baseYuan) * Math.max(1, multiplier) * 10) / 10;
  return Math.min(hardCap, earned);
}

export function formatYuan(amount: number): string {
  const n = Math.max(0, amount);
  return Number.isInteger(n) ? `¥${n}` : `¥${n.toFixed(1)}`;
}

export function sumEarnedYuan(sessions: { earnedYuan?: number }[]): number {
  return Math.round(sessions.reduce((sum, s) => sum + (s.earnedYuan ?? 0), 0) * 10) / 10;
}

/** 距起薪还差多少有效分钟（已达标则为 0） */
export function minutesUntilMoney(
  effectiveMs: number,
  minMinutes: number = DEFAULT_MONEY_MIN_MINUTES
): number {
  const have = Math.max(0, effectiveMs) / 60_000;
  return Math.max(0, Math.ceil(minMinutes - have));
}
