import { SILENCE_GAP_MS, type PracticeSegment, type PracticeSession, type Instrument } from '../types';

export type EngineSnapshot = {
  effectiveMs: number;
  segmentCount: number;
  currentStart: number | null;
  lastPlayingAt: number | null;
  quietMs: number;
  startedAt: number;
  /** Effective sounding time inside the current open segment. */
  continuousMs: number;
  /**
   * Layer-2: this tick closed a segment because silence reached SILENCE_GAP_MS.
   * Recording should cut only when this is true (not on 5s classifier dips).
   */
  segmentClosed: boolean;
};

export class PracticeEngine {
  private active = false;
  private startedAt = 0;
  private lastTickAt = 0;
  private currentStart: number | null = null;
  private lastPlayingAt: number | null = null;
  private currentSoundingMs = 0;
  private totalSoundingMs = 0;
  private segments: PracticeSegment[] = [];
  private gapMs: number;

  constructor(gapMs: number = SILENCE_GAP_MS) {
    this.gapMs = gapMs;
  }

  start(now: number): void {
    this.active = true;
    this.startedAt = now;
    this.lastTickAt = now;
    this.currentStart = null;
    this.lastPlayingAt = null;
    this.currentSoundingMs = 0;
    this.totalSoundingMs = 0;
    this.segments = [];
  }

  tick(now: number, isPlaying: boolean): EngineSnapshot {
    if (!this.active) this.start(now);
    const rawDt = now - this.lastTickAt;
    const dt = Math.max(0, Math.min(rawDt, 250));
    this.lastTickAt = now;
    let segmentClosed = false;

    if (isPlaying) {
      if (this.currentStart == null) this.currentStart = now;
      this.lastPlayingAt = now;
      this.currentSoundingMs += dt;
      this.totalSoundingMs += dt;
    } else if (this.currentStart != null && this.lastPlayingAt != null) {
      if (now - this.lastPlayingAt >= this.gapMs) {
        this.closeCurrent(this.lastPlayingAt);
        segmentClosed = true;
      }
    }

    return this.snapshot(now, segmentClosed);
  }

  stop(now: number, instrument: Instrument): PracticeSession {
    this.tick(now, false);
    if (this.currentStart != null && this.lastPlayingAt != null) {
      this.closeCurrent(this.lastPlayingAt);
    }
    return {
      id: `${this.startedAt}-${now}`,
      startedAt: this.startedAt,
      endedAt: now,
      instrument,
      effectiveMs: this.totalSoundingMs,
      wallClockMs: now - this.startedAt,
      segments: [...this.segments],
    };
  }

  /**
   * Snapshot for crash recovery without ending the live session.
   * Includes the currently open segment (if any) as of `now`.
   */
  checkpoint(now: number, instrument: Instrument = 'violin'): PracticeSession {
    const segments = [...this.segments];
    if (this.currentStart != null && this.currentSoundingMs >= 250) {
      const endAt = this.lastPlayingAt != null ? Math.max(this.lastPlayingAt, now) : now;
      segments.push({
        startAt: this.currentStart,
        endAt,
        durationMs: this.currentSoundingMs,
      });
    }
    return {
      id: `${this.startedAt}-draft`,
      startedAt: this.startedAt,
      endedAt: now,
      instrument,
      effectiveMs: this.totalSoundingMs,
      wallClockMs: Math.max(0, now - this.startedAt),
      segments,
      boutCount: 1,
    };
  }

  snapshot(now: number = this.lastTickAt, segmentClosed = false): EngineSnapshot {
    const quietMs =
      this.lastPlayingAt == null
        ? now - this.startedAt
        : Math.max(0, now - this.lastPlayingAt);
    return {
      effectiveMs: this.totalSoundingMs,
      segmentCount: this.segments.length + (this.currentStart != null ? 1 : 0),
      currentStart: this.currentStart,
      lastPlayingAt: this.lastPlayingAt,
      quietMs,
      startedAt: this.startedAt,
      continuousMs: this.currentSoundingMs,
      segmentClosed,
    };
  }

  private closeCurrent(endAt: number): void {
    if (this.currentStart == null) return;
    if (this.currentSoundingMs >= 250) {
      this.segments.push({
        startAt: this.currentStart,
        endAt,
        durationMs: this.currentSoundingMs,
      });
    }
    this.currentStart = null;
    this.currentSoundingMs = 0;
  }
}
