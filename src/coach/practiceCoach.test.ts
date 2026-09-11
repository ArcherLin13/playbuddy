import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createCoachState, tickCoach } from './practiceCoach';

describe('practiceCoach', () => {
  it('does not nag before any playing', () => {
    const s = createCoachState();
    const line = tickCoach(s, {
      enabled: true,
      playing: false,
      quietMs: 120_000,
      continuousMs: 0,
    });
    assert.equal(line, null);
  });

  it('announces after 1 minute idle once played', () => {
    const s = createCoachState();
    tickCoach(s, { enabled: true, playing: true, quietMs: 0, continuousMs: 1000 });
    const line = tickCoach(s, {
      enabled: true,
      playing: false,
      quietMs: 60_000,
      continuousMs: 0,
    });
    assert.ok(line?.includes('1分钟'));
  });

  it('encourages every 10 continuous minutes', () => {
    const s = createCoachState();
    const line = tickCoach(s, {
      enabled: true,
      playing: true,
      quietMs: 0,
      continuousMs: 10 * 60_000,
    });
    assert.ok(line?.includes('10分钟'));
    const again = tickCoach(s, {
      enabled: true,
      playing: true,
      quietMs: 0,
      continuousMs: 10 * 60_000 + 1000,
    });
    assert.equal(again, null);
  });

  it('respects disabled switch', () => {
    const s = createCoachState();
    tickCoach(s, { enabled: true, playing: true, quietMs: 0, continuousMs: 1000 });
    const line = tickCoach(s, {
      enabled: false,
      playing: false,
      quietMs: 60_000,
      continuousMs: 0,
    });
    assert.equal(line, null);
  });
});
