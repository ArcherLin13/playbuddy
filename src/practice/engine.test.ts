import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PracticeEngine } from './engine';

describe('PracticeEngine', () => {
  it('only counts time while playing', () => {
    const e = new PracticeEngine(60_000);
    let t = 1_000;
    e.start(t);
    t += 100;
    e.tick(t, true);
    t += 100;
    e.tick(t, true);
    t += 200;
    e.tick(t, false);
    t += 200;
    e.tick(t, false);
    const snap = e.snapshot(t);
    assert.equal(snap.effectiveMs, 200);
  });

  it('does not close a segment during a short pause', () => {
    const e = new PracticeEngine(60_000);
    let t = 1_000;
    e.start(t);
    t += 100;
    e.tick(t, true);
    t += 20_000;
    e.tick(t, false);
    const snap = e.snapshot(t);
    assert.equal(snap.segmentCount, 1);
    assert.ok(snap.currentStart != null);
  });

  it('closes a segment after 1 minute of silence and excludes that silence', () => {
    const e = new PracticeEngine(60_000);
    let t = 1_000;
    e.start(t);
    t += 100;
    e.tick(t, true);
    t += 100;
    e.tick(t, true);
    t += 100;
    e.tick(t, true);
    t += 100;
    e.tick(t, true);
    const sounding = e.snapshot(t).effectiveMs;
    t += 60_000;
    const closed = e.tick(t, false);
    assert.equal(closed.segmentClosed, true);
    assert.equal(closed.currentStart, null);
    const session = e.stop(t + 500, 'violin');
    assert.equal(session.segments.length, 1);
    assert.equal(session.segments[0].durationMs, sounding);
    assert.equal(session.effectiveMs, sounding);
    assert.ok(session.effectiveMs < 1000);
  });

  it('does not report segmentClosed during a short pause', () => {
    const e = new PracticeEngine(60_000);
    let t = 1_000;
    e.start(t);
    t += 100;
    e.tick(t, true);
    t += 20_000;
    const snap = e.tick(t, false);
    assert.equal(snap.segmentClosed, false);
    assert.ok(snap.currentStart != null);
  });

  it('starts a new segment after a long gap', () => {
    const e = new PracticeEngine(60_000);
    let t = 1_000;
    e.start(t);
    for (let i = 0; i < 5; i++) {
      t += 100;
      e.tick(t, true);
    }
    t += 60_000;
    e.tick(t, false);
    for (let i = 0; i < 5; i++) {
      t += 100;
      e.tick(t, true);
    }
    const session = e.stop(t + 50, 'piano');
    assert.equal(session.segments.length, 2);
    assert.equal(session.segments[0].durationMs, 500);
    assert.equal(session.segments[1].durationMs, 500);
  });
});
