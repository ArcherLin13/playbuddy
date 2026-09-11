import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatStars,
  scoreDay,
  scoreDuration,
  scoreFocus,
  starsFromScore,
} from './dayScore';

describe('dayScore', () => {
  it('maps 40 effective minutes near 85 duration points', () => {
    const d = scoreDuration(40 * 60_000, 40);
    assert.ok(d >= 82 && d <= 88, `got ${d}`);
  });

  it('gives low score for short fragmented practice', () => {
    const r = scoreDay(
      {
        effectiveMs: 8 * 60_000,
        wallClockMs: 40 * 60_000,
        segments: Array.from({ length: 8 }, (_, i) => ({
          startAt: i,
          endAt: i + 1,
          durationMs: 60_000,
        })),
        boutCount: 5,
      },
      40
    );
    assert.ok(r.total < 50, `got ${r.total}`);
    assert.equal(r.focusLabel, '有点爱中断');
  });

  it('rewards long compact practice', () => {
    const r = scoreDay(
      {
        effectiveMs: 42 * 60_000,
        wallClockMs: 48 * 60_000,
        segments: [
          { startAt: 0, endAt: 1, durationMs: 22 * 60_000 },
          { startAt: 2, endAt: 3, durationMs: 20 * 60_000 },
        ],
        boutCount: 1,
      },
      40
    );
    assert.ok(r.total >= 80, `got ${r.total}`);
    assert.ok(r.stars >= 4);
    assert.match(r.focusLabel, /专注/);
  });

  it('increases when more effective time is added same day', () => {
    const first = scoreDay(
      {
        effectiveMs: 15 * 60_000,
        wallClockMs: 18 * 60_000,
        segments: [{ startAt: 0, endAt: 1, durationMs: 15 * 60_000 }],
        boutCount: 1,
      },
      40
    );
    const merged = scoreDay(
      {
        effectiveMs: 35 * 60_000,
        wallClockMs: 42 * 60_000,
        segments: [
          { startAt: 0, endAt: 1, durationMs: 15 * 60_000 },
          { startAt: 2, endAt: 3, durationMs: 20 * 60_000 },
        ],
        boutCount: 2,
      },
      40
    );
    assert.ok(merged.total > first.total);
  });

  it('clamps focus factor', () => {
    const f = scoreFocus(60_000, 60_000 * 20, 10, 8, 40);
    assert.ok(f >= 0.75 && f <= 1);
  });

  it('maps stars and glyphs', () => {
    assert.equal(starsFromScore(92), 5);
    assert.equal(starsFromScore(40), 2);
    assert.equal(formatStars(4), '★★★★☆');
  });
});
