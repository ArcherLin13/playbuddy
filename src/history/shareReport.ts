import {
  formatDurationChinese,
  type DayGroup,
  type MonthGroup,
  type WeekGroup,
} from './aggregate';
import type { ShareCardData } from './ShareCard';
import { sharePracticeCard } from './ShareCardHost';
import {
  DEFAULT_DAILY_TARGET_MINUTES,
  formatStars,
  scoreDay,
} from '../score/dayScore';
import { formatDate } from '../format';

export function buildDayShareCard(
  day: DayGroup,
  dailyTargetMinutes: number = DEFAULT_DAILY_TARGET_MINUTES,
  _dailyMoneyCap?: number,
  _moneyMinMinutes?: number,
  displayName = ''
): ShareCardData {
  const score = scoreDay(day.session, dailyTargetMinutes);
  const name = displayName.trim();
  return {
    kind: 'day',
    durationLabel: formatDurationChinese(day.effectiveMs),
    dateLabel: day.label || formatDate(day.startedAt),
    nameLabel: name || undefined,
    score: score.total,
    starsLabel: formatStars(score.stars),
    durationTag: score.durationLabel,
    focusTag:
      day.session.streakDays && day.session.streakDays > 1
        ? `${score.focusLabel} · ${day.session.streakDays}连`
        : score.focusLabel,
  };
}

export function buildWeekShareCard(week: WeekGroup, displayName = ''): ShareCardData {
  return buildPeriodCard(week.label, week.rangeLabel, week.dayCount, week.effectiveMs, displayName);
}

export function buildMonthShareCard(month: MonthGroup, displayName = ''): ShareCardData {
  return buildPeriodCard(month.label, undefined, month.dayCount, month.effectiveMs, displayName);
}

function buildPeriodCard(
  periodLabel: string,
  rangeLabel: string | undefined,
  dayCount: number,
  effectiveMs: number,
  displayName = ''
): ShareCardData {
  const days = Math.max(1, dayCount);
  const name = displayName.trim();
  return {
    kind: 'period',
    periodLabel,
    rangeLabel,
    nameLabel: name || undefined,
    dayCount,
    totalHours: formatAsHours(effectiveMs),
    avgHours: formatAsHours(effectiveMs / days),
  };
}

function formatAsHours(ms: number): string {
  const hours = Math.max(0, ms) / 3_600_000;
  const rounded = Math.round(hours * 10) / 10;
  if (Number.isInteger(rounded)) return `${rounded}小时`;
  return `${rounded.toFixed(1)}小时`;
}

export async function shareDayReport(
  day: DayGroup,
  dailyTargetMinutes: number = DEFAULT_DAILY_TARGET_MINUTES,
  dailyMoneyCap?: number,
  moneyMinMinutes?: number,
  displayName = ''
): Promise<void> {
  await sharePracticeCard(
    buildDayShareCard(day, dailyTargetMinutes, dailyMoneyCap, moneyMinMinutes, displayName)
  );
}

export async function shareWeekReport(week: WeekGroup, displayName = ''): Promise<void> {
  await sharePracticeCard(buildWeekShareCard(week, displayName));
}

export async function shareMonthReport(month: MonthGroup, displayName = ''): Promise<void> {
  await sharePracticeCard(buildMonthShareCard(month, displayName));
}
