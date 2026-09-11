import type { PracticeSegment, PracticeSession } from '../types';

function dayKey(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function daySessionId(ts: number): string {
  return `day-${dayKey(ts)}`;
}

/** Cloud payload: never includes audio files / local URIs. */
export type CloudSession = Omit<PracticeSession, 'segments'> & {
  segments: Omit<PracticeSegment, 'audioUri'>[];
  updatedAt: number;
};

export function stripAudio(session: PracticeSession): CloudSession {
  return {
    ...session,
    segments: session.segments.map(({ startAt, endAt, durationMs }) => ({
      startAt,
      endAt,
      durationMs,
    })),
    updatedAt: session.updatedAt ?? session.endedAt ?? Date.now(),
  };
}

function segmentKey(s: Pick<PracticeSegment, 'startAt' | 'endAt'>): string {
  return `${s.startAt}-${s.endAt}`;
}

/** Union segments; keep local audioUri when times match. */
export function mergeSessionsPreservingAudio(
  local: PracticeSession | undefined,
  remote: CloudSession
): PracticeSession {
  const map = new Map<string, PracticeSegment>();

  for (const seg of remote.segments) {
    map.set(segmentKey(seg), { ...seg });
  }
  if (local) {
    for (const seg of local.segments) {
      const key = segmentKey(seg);
      const prev = map.get(key);
      if (prev) {
        map.set(key, { ...prev, audioUri: seg.audioUri ?? prev.audioUri });
      } else {
        map.set(key, { ...seg });
      }
    }
  }

  const segments = [...map.values()].sort((a, b) => a.startAt - b.startAt);
  const effectiveMs =
    segments.length > 0
      ? segments.reduce((sum, s) => sum + Math.max(0, s.durationMs), 0)
      : Math.max(local?.effectiveMs ?? 0, remote.effectiveMs);

  const startedAt = Math.min(local?.startedAt ?? remote.startedAt, remote.startedAt);
  const endedAt = Math.max(local?.endedAt ?? remote.endedAt, remote.endedAt);
  const boutCount = Math.max(local?.boutCount ?? 1, remote.boutCount ?? 1);
  const updatedAt = Math.max(local?.updatedAt ?? 0, remote.updatedAt ?? 0, Date.now());

  return {
    id: remote.id.startsWith('day-') ? remote.id : daySessionId(remote.startedAt),
    startedAt,
    endedAt,
    instrument: remote.instrument || local?.instrument || 'violin',
    instruments: remote.instruments ?? local?.instruments ?? ['violin'],
    effectiveMs,
    wallClockMs: Math.max(local?.wallClockMs ?? 0, remote.wallClockMs ?? 0),
    segments,
    boutCount,
    score: remote.score ?? local?.score,
    earnedYuan: remote.earnedYuan ?? local?.earnedYuan,
    baseYuan: remote.baseYuan ?? local?.baseYuan,
    streakDays: remote.streakDays ?? local?.streakDays,
    streakMultiplier: remote.streakMultiplier ?? local?.streakMultiplier,
    settled: Boolean(remote.settled || local?.settled),
    settledAt:
      Math.max(remote.settledAt ?? 0, local?.settledAt ?? 0) || undefined,
    updatedAt,
  };
}

export function mergeLocalAndCloud(
  local: PracticeSession[],
  remote: CloudSession[]
): PracticeSession[] {
  const byDay = new Map<string, PracticeSession>();

  for (const s of local) {
    byDay.set(dayKey(s.startedAt), { ...s, id: daySessionId(s.startedAt) });
  }

  for (const r of remote) {
    const key = dayKey(r.startedAt);
    const loc = byDay.get(key);
    byDay.set(key, mergeSessionsPreservingAudio(loc, r));
  }

  return [...byDay.values()].sort((a, b) => b.startedAt - a.startedAt);
}
