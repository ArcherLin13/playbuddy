import AsyncStorage from '@react-native-async-storage/async-storage';
import { deleteSessionRecordings } from '../audio/sessionCapture';
import { applyStreakToMoney, moneyFromDuration } from '../score/dayMoney';
import { scoreDay } from '../score/dayScore';
import { computeStreakDays, streakMultiplier } from '../score/streak';
import { DEFAULT_SETTINGS, type Instrument, type PracticeSession } from '../types';

const KEY = 'playbuddy.sessions.v1';
const MAX_DAYS = 365;

/** Local calendar day key, e.g. 2026-09-10 */
export function dayKey(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function daySessionId(ts: number): string {
  return `day-${dayKey(ts)}`;
}

/** 某一天已保存的有效练琴时长（与历史「按天」记录一致） */
export function dayEffectiveMs(
  sessions: Pick<PracticeSession, 'id' | 'startedAt' | 'effectiveMs'>[],
  ts: number = Date.now()
): number {
  const key = dayKey(ts);
  const id = daySessionId(ts);
  const day = sessions.find((s) => s.id === id || dayKey(s.startedAt) === key);
  return day?.effectiveMs ?? 0;
}

export async function loadSessions(): Promise<PracticeSession[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as PracticeSession[];
    if (!Array.isArray(parsed)) return [];
    const merged = mergeAllByDay(parsed);
    if (merged.length !== parsed.length || merged.some((s, i) => s.id !== parsed[i]?.id)) {
      await AsyncStorage.setItem(KEY, JSON.stringify(merged));
    }
    return merged;
  } catch {
    return [];
  }
}

export async function saveSession(
  session: PracticeSession,
  dailyTargetMinutes: number = DEFAULT_SETTINGS.dailyTargetMinutes,
  dailyMoneyCap: number = DEFAULT_SETTINGS.dailyMoneyCap,
  moneyMinMinutes: number = DEFAULT_SETTINGS.moneyMinMinutes
): Promise<PracticeSession[]> {
  const all = await loadSessions();
  const id = daySessionId(session.startedAt);
  const existing = all.find((s) => s.id === id || dayKey(s.startedAt) === dayKey(session.startedAt));
  const bout: PracticeSession = {
    ...session,
    id,
    boutCount: session.boutCount ?? 1,
  };

  const draft = existing ? mergeDaySessions(existing, bout) : bout;
  const others = all.filter((s) => s.id !== (existing?.id ?? id));
  const rewarded = attachRewards(
    draft,
    dailyTargetMinutes,
    dailyMoneyCap,
    moneyMinMinutes,
    [...others, draft]
  );
  const stamped = { ...rewarded, updatedAt: Date.now() };
  const next = [stamped, ...others].sort((a, b) => b.startedAt - a.startedAt).slice(0, MAX_DAYS);
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export async function replaceSessions(sessions: PracticeSession[]): Promise<PracticeSession[]> {
  const next = sessions
    .map((s) => ({
      ...s,
      id: s.id.startsWith('day-') ? s.id : daySessionId(s.startedAt),
      updatedAt: s.updatedAt ?? Date.now(),
    }))
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, MAX_DAYS);
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

/** Mark all unpaid days with earnings as settled (parent payout). */
export async function settlePendingSessions(): Promise<{
  sessions: PracticeSession[];
  settledCount: number;
  settledYuan: number;
}> {
  const all = await loadSessions();
  const now = Date.now();
  let settledCount = 0;
  let settledYuan = 0;
  const next = all.map((s) => {
    const yuan = s.earnedYuan ?? 0;
    if (s.settled || yuan <= 0) return s;
    settledCount += 1;
    settledYuan += yuan;
    return { ...s, settled: true, settledAt: now, updatedAt: now };
  });
  settledYuan = Math.round(settledYuan * 10) / 10;
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return { sessions: next, settledCount, settledYuan };
}

export async function deleteSession(id: string): Promise<PracticeSession[]> {
  const all = await loadSessions();
  const target = all.find((s) => s.id === id);
  if (target) {
    await deleteSessionRecordings(target.id, target.segments);
  }
  const next = all.filter((s) => s.id !== id);
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function mergeDaySessions(a: PracticeSession, b: PracticeSession): PracticeSession {
  const instruments = uniqueInstruments([
    ...(a.instruments ?? [a.instrument]),
    ...(b.instruments ?? [b.instrument]),
  ]);
  return {
    id: a.id.startsWith('day-') ? a.id : daySessionId(a.startedAt),
    startedAt: Math.min(a.startedAt, b.startedAt),
    endedAt: Math.max(a.endedAt, b.endedAt),
    instrument: instruments[0] ?? b.instrument,
    instruments,
    effectiveMs: a.effectiveMs + b.effectiveMs,
    wallClockMs: a.wallClockMs + b.wallClockMs,
    segments: [...a.segments, ...b.segments].sort((x, y) => x.startAt - y.startAt),
    boutCount: (a.boutCount ?? 1) + (b.boutCount ?? 1),
    settled: Boolean(a.settled || b.settled),
    settledAt: Math.max(a.settledAt ?? 0, b.settledAt ?? 0) || undefined,
  };
}

export function attachRewards(
  session: PracticeSession,
  dailyTargetMinutes: number = DEFAULT_SETTINGS.dailyTargetMinutes,
  dailyMoneyCap: number = DEFAULT_SETTINGS.dailyMoneyCap,
  moneyMinMinutes: number = DEFAULT_SETTINGS.moneyMinMinutes,
  allSessions: PracticeSession[] = [session]
): PracticeSession {
  const { total } = scoreDay(session, dailyTargetMinutes);
  const scored: PracticeSession = { ...session, score: total };
  const roster = allSessions.map((s) =>
    dayKey(s.startedAt) === dayKey(session.startedAt) ? scored : s
  );
  const streakDays = computeStreakDays(roster, session.startedAt, moneyMinMinutes, dayKey);
  const mult = streakMultiplier(streakDays);
  const baseYuan = moneyFromDuration(session.effectiveMs, dailyMoneyCap, moneyMinMinutes);
  const earnedYuan = applyStreakToMoney(baseYuan, mult, dailyMoneyCap);
  return {
    ...scored,
    baseYuan,
    streakDays,
    streakMultiplier: mult,
    earnedYuan,
  };
}

/** @deprecated use attachRewards */
export const attachScore = attachRewards;

/** Recompute cached scores/money when targets change. */
export async function rescoreAllSessions(
  dailyTargetMinutes: number,
  dailyMoneyCap: number = DEFAULT_SETTINGS.dailyMoneyCap,
  moneyMinMinutes: number = DEFAULT_SETTINGS.moneyMinMinutes
): Promise<PracticeSession[]> {
  const all = await loadSessions();
  const scored = all.map((s) => {
    const { total } = scoreDay(s, dailyTargetMinutes);
    return { ...s, score: total };
  });
  const next = scored.map((s) =>
    attachRewards(s, dailyTargetMinutes, dailyMoneyCap, moneyMinMinutes, scored)
  );
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

function mergeAllByDay(sessions: PracticeSession[]): PracticeSession[] {
  const map = new Map<string, PracticeSession>();
  for (const s of sessions) {
    const key = dayKey(s.startedAt);
    const id = daySessionId(s.startedAt);
    const normalized: PracticeSession = {
      ...s,
      id,
      boutCount: s.boutCount ?? 1,
      instruments: s.instruments ?? [s.instrument],
    };
    const prev = map.get(key);
    map.set(key, prev ? mergeDaySessions(prev, normalized) : normalized);
  }
  return [...map.values()].sort((a, b) => b.startedAt - a.startedAt);
}

function uniqueInstruments(list: Instrument[]): Instrument[] {
  const out: Instrument[] = [];
  for (const item of list) {
    if (!out.includes(item)) out.push(item);
  }
  return out;
}
