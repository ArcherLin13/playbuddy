export const COACH_IDLE_1_MS = 60_000;
export const COACH_IDLE_5_MS = 5 * 60_000;
export const COACH_STREAK_STEP_MS = 10 * 60_000;

export type CoachState = {
  hadPlaying: boolean;
  saidIdle1: boolean;
  saidIdle5: boolean;
  lastIdleMinuteSpoken: number;
  lastStreakMilestone: number;
};

export function createCoachState(): CoachState {
  return {
    hadPlaying: false,
    saidIdle1: false,
    saidIdle5: false,
    lastIdleMinuteSpoken: 0,
    lastStreakMilestone: 0,
  };
}

export function resetCoachIdle(state: CoachState): void {
  state.saidIdle1 = false;
  state.saidIdle5 = false;
  state.lastIdleMinuteSpoken = 0;
}

/**
 * Drive practice coach announcements from monitor tick.
 * Returns spoken text when it should trigger, else null.
 */
export function tickCoach(
  state: CoachState,
  opts: {
    enabled: boolean;
    playing: boolean;
    quietMs: number;
    continuousMs: number;
  }
): string | null {
  if (!opts.enabled) return null;

  if (opts.playing) {
    state.hadPlaying = true;
    resetCoachIdle(state);

    const milestone = Math.floor(opts.continuousMs / COACH_STREAK_STEP_MS);
    if (milestone < state.lastStreakMilestone) {
      state.lastStreakMilestone = milestone;
    }
    if (milestone >= 1 && milestone > state.lastStreakMilestone) {
      state.lastStreakMilestone = milestone;
      const minutes = milestone * 10;
      return `你真棒，你已经连续练琴${minutes}分钟啦！`;
    }
    return null;
  }

  // Idle coaching only after the user has played at least once this session.
  if (!state.hadPlaying) return null;

  if (opts.quietMs >= COACH_IDLE_1_MS && !state.saidIdle1) {
    state.saidIdle1 = true;
    state.lastIdleMinuteSpoken = 1;
    return '你已经1分钟没有练琴啦，这段演奏停止啦！';
  }

  if (opts.quietMs >= COACH_IDLE_5_MS && !state.saidIdle5) {
    state.saidIdle5 = true;
    state.lastIdleMinuteSpoken = 5;
    return '快来练琴啦，你已经停止5分钟啦。';
  }

  if (state.saidIdle5) {
    const idleMinutes = Math.floor(opts.quietMs / 60_000);
    if (idleMinutes > state.lastIdleMinuteSpoken) {
      state.lastIdleMinuteSpoken = idleMinutes;
      return `快来练琴啦，你已经停止${idleMinutes}分钟啦。`;
    }
  }

  return null;
}
