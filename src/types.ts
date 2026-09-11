export type Instrument = 'violin' | 'piano' | 'other';

export type SoundKind = 'silence' | 'speech' | 'noise' | 'playing';

export type PracticeSegment = {
  startAt: number;
  endAt: number;
  durationMs: number;
  audioUri?: string;
};

export type PracticeSession = {
  id: string;
  startedAt: number;
  endedAt: number;
  instrument: Instrument;
  /** All instruments practiced that day (when merged). */
  instruments?: Instrument[];
  effectiveMs: number;
  wallClockMs: number;
  segments: PracticeSegment[];
  /** How many start/stop practice bouts are merged into this day. */
  boutCount?: number;
  /** Cached day score 0–100 (recomputed on merge / settings change for display). */
  score?: number;
  /** Cached day allowance in yuan (after streak), recomputed with score. */
  earnedYuan?: number;
  /** Base yuan before streak multiplier. */
  baseYuan?: number;
  /** Consecutive qualifying days ending on this day. */
  streakDays?: number;
  /** Money multiplier from streak (1–1.5). */
  streakMultiplier?: number;
  /** Last local/cloud update time (ms) for sync. */
  updatedAt?: number;
};

export type AppSettings = {
  instrument: Instrument;
  sensitivity: number;
  /** Voice coach reminders while practicing. */
  coachEnabled: boolean;
  /** App output volume for coach TTS and clip playback (0–1). */
  outputVolume: number;
  /** Daily effective practice target in minutes (default 40). */
  dailyTargetMinutes: number;
  /** Max pocket money per day in yuan (default 10). */
  dailyMoneyCap: number;
  /** Minimum effective practice minutes before any money (default 30). */
  moneyMinMinutes: number;
  /** Minutes of effective practice for a full-screen water fill (default 60). */
  waterFullMinutes: number;
  /** Custom display name for the signed-in account (synced to cloud). */
  displayName: string;
};

export type ClassifyResult = {
  kind: SoundKind;
  level: number;
  speechScore: number;
  musicScore: number;
  violinScore: number;
  pianoScore: number;
  pitchHz: number;
};

export const INSTRUMENT_LABELS: Record<Instrument, string> = {
  violin: '小提琴',
  piano: '钢琴',
  other: '其他乐器',
};

export const DEFAULT_SETTINGS: AppSettings = {
  instrument: 'violin',
  sensitivity: 0.45,
  coachEnabled: true,
  outputVolume: 1,
  dailyTargetMinutes: 40,
  dailyMoneyCap: 10,
  moneyMinMinutes: 30,
  waterFullMinutes: 60,
  displayName: '',
};

export const SILENCE_GAP_MS = 60_000;
