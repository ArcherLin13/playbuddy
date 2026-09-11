import type { PracticeSession } from '../types';
import { dayKey } from '../storage/history';
import { formatDate, formatDuration, pad2 } from '../format';

export type DayGroup = {
  id: string;
  key: string;
  label: string;
  startedAt: number;
  effectiveMs: number;
  boutCount: number;
  segmentCount: number;
  session: PracticeSession;
};

export type WeekGroup = {
  id: string;
  key: string;
  label: string;
  rangeLabel: string;
  startAt: number;
  endAt: number;
  effectiveMs: number;
  boutCount: number;
  segmentCount: number;
  dayCount: number;
  days: DayGroup[];
};

export type MonthGroup = {
  id: string;
  key: string;
  label: string;
  year: number;
  month: number;
  effectiveMs: number;
  boutCount: number;
  segmentCount: number;
  dayCount: number;
  weeks: WeekGroup[];
};

/** Monday 00:00:00 local of the week containing ts. */
export function startOfWeekMonday(ts: number): Date {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 Sun .. 6 Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

export function endOfWeekSunday(ts: number): Date {
  const start = startOfWeekMonday(ts);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

export function weekKey(ts: number): string {
  const start = startOfWeekMonday(ts);
  return dayKey(start.getTime());
}

export function monthKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

export function buildHistoryTree(sessions: PracticeSession[]): MonthGroup[] {
  const days: DayGroup[] = sessions
    .slice()
    .sort((a, b) => b.startedAt - a.startedAt)
    .map((session) => ({
      id: session.id,
      key: dayKey(session.startedAt),
      label: formatDate(session.startedAt),
      startedAt: session.startedAt,
      effectiveMs: session.effectiveMs,
      boutCount: session.boutCount ?? 1,
      segmentCount: session.segments.length,
      session,
    }));

  const weekMap = new Map<string, WeekGroup>();
  for (const day of days) {
    const wk = weekKey(day.startedAt);
    const start = startOfWeekMonday(day.startedAt);
    const end = endOfWeekSunday(day.startedAt);
    let week = weekMap.get(wk);
    if (!week) {
      week = {
        id: `week-${wk}`,
        key: wk,
        label: weekTitle(start),
        rangeLabel: `${start.getMonth() + 1}/${start.getDate()} – ${end.getMonth() + 1}/${end.getDate()}`,
        startAt: start.getTime(),
        endAt: end.getTime(),
        effectiveMs: 0,
        boutCount: 0,
        segmentCount: 0,
        dayCount: 0,
        days: [],
      };
      weekMap.set(wk, week);
    }
    week.days.push(day);
    week.effectiveMs += day.effectiveMs;
    week.boutCount += day.boutCount;
    week.segmentCount += day.segmentCount;
    week.dayCount += 1;
  }

  const monthMap = new Map<string, MonthGroup>();
  for (const week of weekMap.values()) {
    // Attribute week to the month of the week's Monday for stable grouping,
    // but also include days that spill — we place week under month of majority / Monday.
    const mk = monthKey(week.startAt);
    const d = new Date(week.startAt);
    let month = monthMap.get(mk);
    if (!month) {
      month = {
        id: `month-${mk}`,
        key: mk,
        label: `${d.getFullYear()}年${d.getMonth() + 1}月`,
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        effectiveMs: 0,
        boutCount: 0,
        segmentCount: 0,
        dayCount: 0,
        weeks: [],
      };
      monthMap.set(mk, month);
    }
    month.weeks.push(week);
    month.effectiveMs += week.effectiveMs;
    month.boutCount += week.boutCount;
    month.segmentCount += week.segmentCount;
    month.dayCount += week.dayCount;
  }

  // Sort weeks desc inside month, months desc
  const months = [...monthMap.values()].sort((a, b) => b.key.localeCompare(a.key));
  for (const m of months) {
    m.weeks.sort((a, b) => b.startAt - a.startAt);
    for (const w of m.weeks) {
      w.days.sort((a, b) => b.startedAt - a.startedAt);
    }
  }
  return months;
}

function weekTitle(start: Date): string {
  // ISO-like week number within year of the Thursday of this week
  const thursday = new Date(start);
  thursday.setDate(start.getDate() + 3);
  const yearStart = new Date(thursday.getFullYear(), 0, 1);
  const weekNo = Math.floor((thursday.getTime() - yearStart.getTime()) / 86400000 / 7) + 1;
  return `${thursday.getFullYear()}年第${weekNo}周`;
}

export function formatDurationChinese(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hh = Math.floor(total / 3600);
  const mm = Math.floor((total % 3600) / 60);
  const ss = total % 60;
  if (hh > 0) return `${hh}小时${mm}分${ss}秒`;
  if (mm > 0) return `${mm}分${ss}秒`;
  return `${ss}秒`;
}
