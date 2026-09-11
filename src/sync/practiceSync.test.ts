import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mergeSessionsPreservingAudio, stripAudio } from './practiceSyncLogic';
import type { PracticeSession } from '../types';

const base: PracticeSession = {
  id: 'day-2026-09-10',
  startedAt: Date.parse('2026-09-10T08:00:00'),
  endedAt: Date.parse('2026-09-10T09:00:00'),
  instrument: 'violin',
  instruments: ['violin'],
  effectiveMs: 600_000,
  wallClockMs: 700_000,
  boutCount: 1,
  segments: [
    {
      startAt: Date.parse('2026-09-10T08:00:00'),
      endAt: Date.parse('2026-09-10T08:10:00'),
      durationMs: 600_000,
      audioUri: 'file:///local/a.wav',
    },
  ],
  updatedAt: 100,
};

describe('practiceSync', () => {
  it('strips audio before cloud upload', () => {
    const cloud = stripAudio(base);
    assert.equal(cloud.segments[0].audioUri, undefined);
    assert.equal(cloud.segments[0].durationMs, 600_000);
  });

  it('keeps local audio when merging matching segments', () => {
    const remote = stripAudio({
      ...base,
      updatedAt: 200,
      effectiveMs: 600_000,
    });
    const merged = mergeSessionsPreservingAudio(base, remote);
    assert.equal(merged.segments[0].audioUri, 'file:///local/a.wav');
  });

  it('unions segments from both devices', () => {
    const remote = stripAudio({
      ...base,
      segments: [
        {
          startAt: Date.parse('2026-09-10T10:00:00'),
          endAt: Date.parse('2026-09-10T10:15:00'),
          durationMs: 900_000,
        },
      ],
      effectiveMs: 900_000,
      updatedAt: 300,
    });
    const merged = mergeSessionsPreservingAudio(base, remote);
    assert.equal(merged.segments.length, 2);
    assert.equal(merged.effectiveMs, 1_500_000);
    assert.ok(merged.segments.some((s) => s.audioUri === 'file:///local/a.wav'));
  });
});
