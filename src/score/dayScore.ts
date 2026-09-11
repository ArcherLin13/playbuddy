import type { PracticeSession } from '../types';

export const DEFAULT_DAILY_TARGET_MINUTES = 40;

export type DayScoreResult = {
  /** 综合分 0–100 */
  total: number;
  /** 时长分 0–100 */
  durationScore: number;
  /** 专注系数 0.75–1 */
  focusFactor: number;
  /** 1–5 星 */
  stars: number;
  durationLabel: string;
  focusLabel: string;
  tip: string;
};

/**
 * 今日分 = 时长分 × 专注系数。
 * 时长按有效分钟相对目标（默认 40）非线性映射；专注看紧凑度与片段完整度。
 */
export function scoreDay(
  session: Pick<PracticeSession, 'effectiveMs' | 'wallClockMs' | 'segments' | 'boutCount'>,
  targetMinutes: number = DEFAULT_DAILY_TARGET_MINUTES
): DayScoreResult {
  const target = Math.max(5, targetMinutes);
  const effectiveMs = Math.max(0, session.effectiveMs);
  const wallClockMs = Math.max(0, session.wallClockMs);
  const segmentCount = Math.max(0, session.segments.length);
  const boutCount = Math.max(1, session.boutCount ?? 1);

  const durationScore = scoreDuration(effectiveMs, target);
  const focusFactor = scoreFocus(effectiveMs, wallClockMs, segmentCount, boutCount, target);
  const total = clamp(0, 100, Math.round(durationScore * focusFactor));
  const stars = starsFromScore(total);
  const durationLabel = labelDuration(durationScore);
  const focusLabel = labelFocus(focusFactor);
  const tip = buildTip(effectiveMs, target, durationScore, focusFactor, boutCount);

  return {
    total,
    durationScore: Math.round(durationScore),
    focusFactor: Math.round(focusFactor * 100) / 100,
    stars,
    durationLabel,
    focusLabel,
    tip,
  };
}

/** 有效分钟 → 时长分：目标处约 85，1.5 倍目标约 94，封顶 100 */
export function scoreDuration(effectiveMs: number, targetMinutes: number): number {
  const minutes = effectiveMs / 60_000;
  if (minutes <= 0) return 0;
  const ratio = minutes / targetMinutes;
  return clamp(0, 100, 100 * (1 - Math.exp(-1.9 * ratio)));
}

/**
 * 专注系数：有效/墙钟紧凑度 + 平均片段时长 + 轻度启动次数惩罚。
 * 结果落在约 0.75–1.0。
 */
export function scoreFocus(
  effectiveMs: number,
  wallClockMs: number,
  segmentCount: number,
  boutCount: number,
  targetMinutes: number
): number {
  if (effectiveMs <= 0) return 0.75;

  const compactness = wallClockMs > 0 ? effectiveMs / wallClockMs : 0;
  let factor = 0.78;
  if (compactness >= 0.65) factor = 1.0;
  else if (compactness >= 0.5) factor = 0.93;
  else if (compactness >= 0.35) factor = 0.85;
  else factor = 0.78;

  const avgSegMin = segmentCount > 0 ? effectiveMs / segmentCount / 60_000 : 0;
  if (avgSegMin >= 5) factor += 0.0;
  else if (avgSegMin >= 3) factor -= 0.02;
  else if (avgSegMin >= 1.5) factor -= 0.05;
  else factor -= 0.08;

  // 一天反复进出太多次，且总时长还没接近目标时轻扣
  const minutes = effectiveMs / 60_000;
  if (boutCount >= 6 && minutes < targetMinutes * 0.8) factor -= 0.04;
  else if (boutCount >= 4 && minutes < targetMinutes * 0.6) factor -= 0.02;

  return clamp(0.75, 1, factor);
}

export function starsFromScore(total: number): number {
  if (total >= 90) return 5;
  if (total >= 75) return 4;
  if (total >= 55) return 3;
  if (total >= 30) return 2;
  return 1;
}

export function formatStars(stars: number): string {
  const n = clamp(1, 5, Math.round(stars));
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

function labelDuration(durationScore: number): string {
  if (durationScore >= 85) return '时长很好';
  if (durationScore >= 65) return '时长不错';
  if (durationScore >= 40) return '时长一般';
  return '时长偏少';
}

function labelFocus(focusFactor: number): string {
  if (focusFactor >= 0.95) return '很专注';
  if (focusFactor >= 0.85) return '比较专注';
  return '有点爱中断';
}

function buildTip(
  effectiveMs: number,
  targetMinutes: number,
  durationScore: number,
  focusFactor: number,
  boutCount: number
): string {
  const minutes = Math.round(effectiveMs / 60_000);
  const remain = Math.max(0, Math.ceil(targetMinutes - minutes));

  if (effectiveMs <= 0) return '这次还没有记到有效琴声，再试一次吧。';
  if (focusFactor < 0.85 && remain > 0) {
    return `今天有效 ${minutes} 分钟。再紧凑练 ${remain} 分钟就更接近目标啦。`;
  }
  if (focusFactor < 0.85) {
    return `有效时长够了，下次尽量少跑出去，分数还会更高。`;
  }
  if (remain > 0) {
    return `很专注！距离今日 ${targetMinutes} 分钟目标还差大约 ${remain} 分钟。`;
  }
  if (boutCount > 1) {
    return `今天累计很棒，已经超过 ${targetMinutes} 分钟目标。`;
  }
  if (durationScore >= 85) return '又专注又够久，今天练得很漂亮！';
  return '继续保持这样的节奏。';
}

function clamp(min: number, max: number, value: number): number {
  return Math.max(min, Math.min(max, value));
}
