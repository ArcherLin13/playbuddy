import type { ClassifyResult, Instrument, SoundKind } from '../types';
import type { FrameFeatures } from './features';

/** Sliding window length for “is this violin?” */
export const DECISION_WINDOW_MS = 5_000;
/** Need at least this much buffered audio before the first decision. */
const MIN_DECIDE_MS = 1_500;
/** New label must hold this long before UI/timer switches (avoids 1s flicker). */
const LABEL_HOLD_MS = 1_400;
/** Strong score margin may switch a bit sooner. */
const LABEL_HOLD_STRONG_MS = 700;

type FrameSample = {
  at: number;
  rms: number;
  harm: number;
  pitch: number;
  pitchHz: number;
  flatness: number;
  zcr: number;
  speechBand: number;
  centroid: number;
  highRatio: number;
  flux: number;
  audible: boolean;
};

/**
 * Majority vote smoother kept for meter-fallback path only.
 * Main detector uses a 5s sliding feature window.
 */
export class KindSmoother {
  private votes: { at: number; kind: SoundKind }[] = [];

  reset(): void {
    this.votes = [];
  }

  push(kind: SoundKind, now: number = Date.now()): SoundKind {
    this.votes.push({ at: now, kind });
    const cutoff = now - DECISION_WINDOW_MS;
    while (this.votes.length > 0 && this.votes[0].at < cutoff) this.votes.shift();
    if (this.votes.length === 0) return 'silence';
    const counts: Record<SoundKind, number> = { silence: 0, speech: 0, noise: 0, playing: 0 };
    for (const v of this.votes) counts[v.kind] += 1;
    if (counts.silence / this.votes.length >= 0.55) return 'silence';
    if (counts.playing >= counts.speech && counts.playing >= counts.noise) return 'playing';
    if (counts.speech > counts.playing) return 'speech';
    if (counts.noise > 0) return 'noise';
    return 'silence';
  }
}

/**
 * Violin detector with a 5-second sliding window.
 * Each frame only updates the buffer; the label is decided from the whole window’s features
 * (not a per-frame yes/no). A hold/hysteresis layer stops borderline scores from flickering
 * every second between speech and playing.
 */
export class SoundClassifier {
  private frames: FrameSample[] = [];
  private stableKind: SoundKind = 'silence';
  private candidateKind: SoundKind | null = null;
  private candidateSince = 0;

  reset(): void {
    this.frames = [];
    this.stableKind = 'silence';
    this.candidateKind = null;
    this.candidateSince = 0;
  }

  classify(
    frame: FrameFeatures,
    _instrument: Instrument,
    sensitivity: number,
    now: number = Date.now()
  ): ClassifyResult {
    void _instrument;

    const rmsThresh = rmsThreshold(sensitivity);
    const level = Math.max(0, Math.min(1, (dbFromRms(frame.rms) + 55) / 45));
    const audible = frame.rms >= rmsThresh;

    this.frames.push({
      at: now,
      rms: frame.rms,
      harm: frame.harmonicRatio,
      pitch: frame.pitchConf,
      pitchHz: frame.pitchHz,
      flatness: frame.flatness,
      zcr: frame.zcr,
      speechBand: frame.speechBandRatio,
      centroid: frame.centroid,
      highRatio: frame.highRatio,
      flux: frame.flux,
      audible,
    });

    const cutoff = now - DECISION_WINDOW_MS;
    while (this.frames.length > 0 && this.frames[0].at < cutoff) {
      this.frames.shift();
    }

    const span =
      this.frames.length >= 2
        ? this.frames[this.frames.length - 1].at - this.frames[0].at
        : 0;

    if (span < MIN_DECIDE_MS) {
      return {
        kind: 'silence',
        level,
        speechScore: 0,
        musicScore: 0,
        violinScore: 0,
        pianoScore: 0,
        pitchHz: frame.pitchHz,
      };
    }

    const decided = decideFromWindow(this.frames);
    const kind = this.stabilize(decided.kind, decided.speechScore, decided.violinScore, now);
    return {
      kind,
      level,
      speechScore: decided.speechScore,
      musicScore: decided.violinScore,
      violinScore: decided.violinScore,
      pianoScore: clamp01(decided.violinScore * 0.35),
      pitchHz: frame.pitchHz,
    };
  }

  /** Keep the last stable label until the new one holds long enough. */
  private stabilize(
    kind: SoundKind,
    speechScore: number,
    violinScore: number,
    now: number
  ): SoundKind {
    if (kind === this.stableKind) {
      this.candidateKind = null;
      return this.stableKind;
    }

    // Leaving silence should feel responsive; speech↔playing needs a hold.
    if (this.stableKind === 'silence' && kind !== 'silence') {
      this.stableKind = kind;
      this.candidateKind = null;
      return this.stableKind;
    }

    const margin = Math.abs(violinScore - speechScore);
    const holdMs =
      kind === 'silence' || margin >= 0.28 ? LABEL_HOLD_STRONG_MS : LABEL_HOLD_MS;

    if (this.candidateKind !== kind) {
      this.candidateKind = kind;
      this.candidateSince = now;
      return this.stableKind;
    }

    if (now - this.candidateSince >= holdMs) {
      this.stableKind = kind;
      this.candidateKind = null;
    }
    return this.stableKind;
  }
}

function decideFromWindow(frames: FrameSample[]): {
  kind: SoundKind;
  speechScore: number;
  violinScore: number;
} {
  if (frames.length < 4) {
    return { kind: 'silence', speechScore: 0, violinScore: 0 };
  }

  const audible = frames.filter((f) => f.audible);
  const audibleRatio = audible.length / frames.length;
  if (audibleRatio < 0.12) {
    return { kind: 'silence', speechScore: 0, violinScore: 0 };
  }

  const src = audible.length >= 4 ? audible : frames;
  const harm = mean(src.map((f) => f.harm));
  const pitch = mean(src.map((f) => f.pitch));
  const flatness = mean(src.map((f) => f.flatness));
  const zcr = mean(src.map((f) => f.zcr));
  const speechBand = mean(src.map((f) => f.speechBand));
  const centroid = mean(src.map((f) => f.centroid));
  const highRatio = mean(src.map((f) => f.highRatio));
  const flux = mean(src.map((f) => f.flux));
  const am = modulationIndex(src.map((f) => f.rms));
  const sustain = 1 - Math.min(1, flux * 2.4);

  const pitchHzes = src.map((f) => f.pitchHz).filter((h) => h > 0);
  const medianPitchHz = pitchHzes.length
    ? pitchHzes.slice().sort((a, b) => a - b)[Math.floor(pitchHzes.length / 2)]
    : 0;

  const inViolinPitch =
    medianPitchHz >= 170 && medianPitchHz <= 3800
      ? 1
      : medianPitchHz >= 140 && medianPitchHz <= 4200
        ? 0.7
        : medianPitchHz > 0
          ? 0.2
          : 0.1;

  const bright = centroid >= 1200 || medianPitchHz >= 900 || highRatio >= 0.08 ? 1 : 0;

  const speechScore = clamp01(
    0.5 * am +
      0.2 * speechBand * (am >= 0.38 && harm < 0.35 ? 1 : 0.12) +
      0.16 * Math.min(1, zcr / 0.12) * (1 - harm) +
      0.14 * (medianPitchHz >= 85 && medianPitchHz <= 420 && am >= 0.4 && harm < 0.38 ? 1 : 0) +
      0.16 * (harm < 0.28 && am >= 0.35 ? 1 - harm : 0) +
      0.08 * Math.min(1, flux * 2.5) * am -
      0.55 * harm * (1 - Math.min(1, am * 0.6)) -
      0.32 * sustain * (1 - am) -
      0.22 * pitch * (1 - Math.min(1, am * 0.7))
  );

  const amPenalty = Math.max(0, am - 0.22) * (harm >= 0.35 ? 0.28 : 0.55);
  const violinScore = clamp01(
    0.44 * harm +
      0.22 * pitch +
      0.2 * sustain +
      0.16 * inViolinPitch +
      0.1 * bright +
      0.1 * (1 - Math.min(1, flatness * 3.2)) -
      amPenalty -
      0.1 * Math.min(1, zcr / 0.13) * (1 - harm) -
      0.08 * speechScore
  );

  const noiseScore = clamp01(
    flatness * 1.25 + highRatio * (harm < 0.22 ? 0.35 : 0.08) - violinScore - speechScore * 0.35
  );

  const pitchOk = pitch >= 0.1 || (bright > 0 && harm >= 0.22 && flatness < 0.32);
  const tonal = flatness < 0.42 || harm >= 0.28;

  let kind: SoundKind = 'noise';
  if (flatness > 0.5 && harm < 0.22 && pitch < 0.2) {
    kind = 'noise';
  } else if (
    tonal &&
    violinScore >= 0.34 &&
    harm >= 0.22 &&
    pitchOk &&
    violinScore >= speechScore + 0.06
  ) {
    kind = 'playing';
  } else if (am >= 0.4 && speechScore >= 0.5 && speechScore >= violinScore + 0.16 && harm < 0.38) {
    kind = 'speech';
  } else if (tonal && violinScore >= 0.34 && violinScore >= speechScore + 0.04) {
    kind = 'playing';
  } else if (speechScore >= 0.52 && speechScore >= violinScore + 0.18 && am >= 0.36) {
    kind = 'speech';
  } else if (noiseScore >= 0.5 && violinScore < 0.3 && speechScore < 0.35) {
    kind = 'noise';
  } else if (tonal && violinScore >= 0.3 && violinScore >= speechScore) {
    kind = 'playing';
  } else if (speechScore > violinScore + 0.14 && am >= 0.34) {
    kind = 'speech';
  } else {
    // Ambiguous window: keep leaning on whichever score is higher, but require a gap.
    kind = violinScore >= speechScore + 0.02 ? 'playing' : speechScore >= 0.4 ? 'speech' : 'noise';
  }

  return { kind, speechScore, violinScore };
}

export function rmsThreshold(sensitivity: number): number {
  const s = Math.max(0.05, Math.min(0.95, sensitivity));
  const db = -28 - s * 22;
  return Math.pow(10, db / 20);
}

export function dbFromRms(rms: number): number {
  return 20 * Math.log10(Math.max(rms, 1e-8));
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function modulationIndex(rmsHist: number[]): number {
  if (rmsHist.length < 8) return 0;
  const avg = mean(rmsHist);
  if (avg < 1e-6) return 0;
  let prev = rmsHist[0];
  let crossings = 0;
  for (let i = 1; i < rmsHist.length; i++) {
    if ((prev - avg) * (rmsHist[i] - avg) < 0) crossings += 1;
    prev = rmsHist[i];
  }
  return clamp01((crossings / rmsHist.length) * 1.35);
}

/** Meter fallback: prefer playing unless envelope is clearly syllable-like. */
export function classifyMeterEnvelope(
  db: number,
  recentDb: number[],
  _instrument: Instrument,
  sensitivity: number
): ClassifyResult {
  void _instrument;
  const threshDb = -28 - Math.max(0.05, Math.min(0.95, sensitivity)) * 22;
  const level = Math.max(0, Math.min(1, (db + 55) / 45));
  if (!Number.isFinite(db) || db < threshDb) {
    return {
      kind: 'silence',
      level,
      speechScore: 0,
      musicScore: 0,
      violinScore: 0,
      pianoScore: 0,
      pitchHz: 0,
    };
  }

  const avg = mean(recentDb);
  let crossings = 0;
  let prev = recentDb[0] ?? db;
  for (const v of recentDb) {
    if ((prev - avg) * (v - avg) < 0) crossings += 1;
    prev = v;
  }
  const mod = clamp01((crossings / Math.max(8, recentDb.length)) * 1.5);
  const variance = mean(recentDb.map((v) => (v - avg) * (v - avg)));
  const speechScore = clamp01(mod * 0.75 + (variance > 45 ? 0.22 : 0));
  const violinScore = clamp01(0.68 + (1 - mod) * 0.22 - speechScore * 0.35);
  const kind =
    speechScore >= 0.55 && speechScore >= violinScore + 0.12 ? 'speech' : 'playing';
  return {
    kind,
    level,
    speechScore,
    musicScore: violinScore,
    violinScore,
    pianoScore: 0,
    pitchHz: 0,
  };
}
