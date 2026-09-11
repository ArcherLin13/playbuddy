import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  computeStreakDays,
  dayQualifiesForStreak,
  streakMultiplier,
} from './streak';
import type { PracticeSession } from '../types';

function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}-${`${d.getDate()}`.padStart(2, '0')}`;
}

function sess(daysAgo: number, effectiveMin: number): PracticeSession {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  const ms = effectiveMin * 60_000;
  return {
    id: `day-${dayKey(d.getTime())}`,
    startedAt: d.getTime(),
    endedAt: d.getTime() + ms,
    instrument: 'other',
    effectiveMs: ms,
    wallClockMs: ms,
    segments: [{ startAt: d.getTime(), endAt: d.getTime() + ms, durationMs: ms }],
    boutCount: 1,
  };
}

describe('streak', () => {
  it('maps streak length to multiplier', () => {
    assert.equal(streakMultiplier(1), 1);
    assert.equal(streakMultiplier(2), 1.1);
    assert.equal(streakMultiplier(5), 1.2);
    assert.equal(streakMultiplier(7), 1.3);
    assert.equal(streakMultiplier(20), 1.5);
  });

  it('requires money minimum minutes', () => {
    assert.equal(dayQualifiesForStreak(sess(0, 30), 30), true);
    assert.equal(dayQualifiesForStreak(sess(0, 29), 30), false);
    assert.equal(dayQualifiesForStreak(sess(0, 0.1), 30), false);
  });

  it('counts consecutive days ending today', () => {
    const sessions = [sess(0, 30), sess(1, 35), sess(2, 40), sess(4, 40)];
    const streak = computeStreakDays(sessions, sessions[0].startedAt, 30, dayKey);
    assert.equal(streak, 3);
  });

  it('breaks when today does not qualify', () => {
    const sessions = [sess(0, 10), sess(1, 40), sess(2, 40)];
    const streak = computeStreakDays(sessions, sessions[0].startedAt, 30, dayKey);
    assert.equal(streak, 0);
  });
});
