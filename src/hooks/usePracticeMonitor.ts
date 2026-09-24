import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  useAudioRecorder,
  useAudioRecorderState,
  useAudioStream,
  type AudioStreamBuffer,
} from 'expo-audio';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { AudioAnalyzer } from '../audio/analyzer';
import { enterPlaybackAudioMode, enterRecordingAudioMode } from '../audio/audioMode';
import { classifyMeterEnvelope, KindSmoother, SoundClassifier } from '../audio/classifier';
import { SessionAudioCapture } from '../audio/sessionCapture';
import {
  createCoachState,
  tickCoach,
} from '../coach/practiceCoach';
import { speakCoach, stopCoachSpeech } from '../coach/speech';
import { PracticeEngine } from '../practice/engine';
import { saveDraft } from '../storage/draft';
import type { AppSettings, ClassifyResult, PracticeSession, SoundKind } from '../types';

export type MonitorSnapshot = {
  effectiveMs: number;
  segmentCount: number;
  currentStart: number | null;
  quietMs: number;
  startedAt: number;
  continuousMs: number;
  kind: SoundKind;
  level: number;
  usingFallback: boolean;
  coachLine: string | null;
};

const EMPTY: MonitorSnapshot = {
  effectiveMs: 0,
  segmentCount: 0,
  currentStart: null,
  quietMs: 0,
  startedAt: 0,
  continuousMs: 0,
  kind: 'silence',
  level: 0,
  usingFallback: false,
  coachLine: null,
};

const DRAFT_INTERVAL_MS = 5_000;
/** Skip tiny accidental drafts. */
const DRAFT_MIN_EFFECTIVE_MS = 1_500;

export function usePracticeMonitor(settings: AppSettings) {
  const engineRef = useRef(new PracticeEngine());
  const analyzerRef = useRef(new AudioAnalyzer());
  const classifierRef = useRef(new SoundClassifier());
  const meterSmoothRef = useRef(new KindSmoother());
  const captureRef = useRef(new SessionAudioCapture());
  const coachRef = useRef(createCoachState());
  const lastCoachLineRef = useRef<string | null>(null);
  const lastCoachAtRef = useRef(0);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const lastRef = useRef<ClassifyResult>({
    kind: 'silence',
    level: 0,
    speechScore: 0,
    musicScore: 0,
    violinScore: 0,
    pianoScore: 0,
    pitchHz: 0,
  });
  const lastAtRef = useRef(0);
  const lastPlayingAtRef = useRef(0);
  const stoppingClipRef = useRef(false);
  const runningRef = useRef(false);
  const fallbackRef = useRef(false);
  const coachSpeakingRef = useRef(false);
  const sessionIdRef = useRef('');
  const meterHistRef = useRef<number[]>([]);

  const [running, setRunning] = useState(false);
  const [snapshot, setSnapshot] = useState<MonitorSnapshot>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const draftBusyRef = useRef(false);

  const persistDraft = useCallback(async () => {
    if (!runningRef.current || draftBusyRef.current) return;
    draftBusyRef.current = true;
    try {
      const now = Date.now();
      const bout = engineRef.current.checkpoint(now, 'violin');
      if (bout.effectiveMs < DRAFT_MIN_EFFECTIVE_MS) return;

      // Only attach clips that already closed with a segment — never stopClip here.
      const segments = fallbackRef.current
        ? bout.segments
        : captureRef.current.peekFinishedClips(bout.segments);

      await saveDraft({
        ...bout,
        segments,
        sessionId: sessionIdRef.current || String(bout.startedAt),
        savedAt: now,
      });
    } catch {
      /* ignore draft failures */
    } finally {
      draftBusyRef.current = false;
    }
  }, []);

  const onBuffer = useCallback((buffer: AudioStreamBuffer) => {
    if (!runningRef.current || fallbackRef.current || coachSpeakingRef.current) return;
    captureRef.current.append(buffer.data, buffer.sampleRate, buffer.channels);
    const frame = analyzerRef.current.ingest(buffer.data, buffer.sampleRate, buffer.channels);
    if (!frame) return;
    const result = classifierRef.current.classify(
      frame,
      'violin',
      settingsRef.current.sensitivity,
      Date.now()
    );
    lastRef.current = result;
    lastAtRef.current = Date.now();
    if (result.kind === 'playing') lastPlayingAtRef.current = lastAtRef.current;
  }, []);

  const { stream } = useAudioStream({
    sampleRate: 16000,
    channels: 1,
    encoding: 'float32',
    onBuffer,
  });
  const streamRef = useRef(stream);
  streamRef.current = stream;

  /** Pause mic briefly so TTS can use the speaker during practice. */
  const announceCoach = useCallback(async (line: string) => {
    if (coachSpeakingRef.current || !runningRef.current) return;
    coachSpeakingRef.current = true;
    const useStream = !fallbackRef.current;
    try {
      if (useStream) {
        try {
          streamRef.current.stop();
        } catch {
          /* ignore */
        }
      }
      await speakCoach(line, { keepRecording: true });
    } finally {
      if (runningRef.current) {
        try {
          await enterRecordingAudioMode();
        } catch {
          /* ignore */
        }
        if (useStream) {
          try {
            await streamRef.current.start();
          } catch {
            /* ignore */
          }
        }
      }
      coachSpeakingRef.current = false;
    }
  }, []);

  const recorder = useAudioRecorder({
    ...RecordingPresets.LOW_QUALITY,
    isMeteringEnabled: true,
  });
  const recState = useAudioRecorderState(recorder, 80);

  useEffect(() => {
    if (!running || !fallbackRef.current || coachSpeakingRef.current) return;
    const db = recState.metering ?? -160;
    meterHistRef.current.push(db);
    if (meterHistRef.current.length > 24) meterHistRef.current.shift();
    const result = classifyMeterEnvelope(
      db,
      meterHistRef.current,
      'violin',
      settingsRef.current.sensitivity
    );
    const now = Date.now();
    const kind = meterSmoothRef.current.push(result.kind, now);
    lastRef.current = { ...result, kind };
    lastAtRef.current = now;
    if (kind === 'playing') lastPlayingAtRef.current = now;
  }, [recState.metering, running]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      if (coachSpeakingRef.current) return;
      const now = Date.now();
      const fresh = now - lastAtRef.current < 500;
      const kind = lastRef.current.kind;
      const level = lastRef.current.level;
      const speechScore = lastRef.current.speechScore;
      const violinScore = lastRef.current.violinScore;
      const clearSpeech =
        kind === 'speech' && speechScore >= violinScore + 0.2 && speechScore >= 0.5;
      // Hold through brief mislabels while violin-like sound continues (~2.2s).
      const hangover =
        !clearSpeech &&
        kind !== 'silence' &&
        level > 0.12 &&
        now - lastPlayingAtRef.current < 2_200;
      const playing = fresh && (kind === 'playing' || hangover);
      // UI follows timer: don't flash "说话" during short ambiguous dips.
      const displayKind = !fresh
        ? 'silence'
        : playing
          ? 'playing'
          : kind === 'speech' && clearSpeech
            ? 'speech'
            : kind;
      const snap = engineRef.current.tick(now, playing);

      // Two layers:
      // 1) `playing` from 5s classifier → effective time + UI only
      // 2) engine segment open/close (1 min full interrupt) → cut recording into one clip
      if (!fallbackRef.current) {
        if (snap.currentStart != null && !captureRef.current.isRecording) {
          captureRef.current.startClip();
        }
        if (snap.segmentClosed && captureRef.current.isRecording && !stoppingClipRef.current) {
          stoppingClipRef.current = true;
          void captureRef.current.stopClip().finally(() => {
            stoppingClipRef.current = false;
          });
        }
      }

      const coachLine = tickCoach(coachRef.current, {
        enabled: settingsRef.current.coachEnabled,
        playing,
        quietMs: snap.quietMs,
        continuousMs: snap.continuousMs,
      });
      if (coachLine) {
        lastCoachLineRef.current = coachLine;
        lastCoachAtRef.current = now;
        void announceCoach(coachLine);
      }
      const shownCoach =
        lastCoachLineRef.current && now - lastCoachAtRef.current < 10_000
          ? lastCoachLineRef.current
          : null;

      setSnapshot({
        effectiveMs: snap.effectiveMs,
        segmentCount: snap.segmentCount,
        currentStart: snap.currentStart,
        quietMs: snap.quietMs,
        startedAt: snap.startedAt,
        continuousMs: snap.continuousMs,
        kind: displayKind,
        level: fresh ? level : 0,
        usingFallback: fallbackRef.current,
        coachLine: shownCoach,
      });
    }, 100);
    return () => clearInterval(id);
  }, [running, announceCoach]);

  // Periodic + background checkpoint so kill/swipe-away does not lose time.
  useEffect(() => {
    if (!running) return;

    const onAppState = (next: AppStateStatus) => {
      if (next === 'background' || next === 'inactive') {
        void persistDraft();
      }
    };
    const sub = AppState.addEventListener('change', onAppState);
    const id = setInterval(() => {
      void persistDraft();
    }, DRAFT_INTERVAL_MS);

    return () => {
      sub.remove();
      clearInterval(id);
    };
  }, [running, persistDraft]);

  const start = useCallback(async () => {
    setError(null);
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) {
      setError('没有麦克风权限，无法检测练琴声音。');
      return false;
    }
    await enterRecordingAudioMode();

    const startedAt = Date.now();
    const sessionId = `${startedAt}`;
    sessionIdRef.current = sessionId;

    analyzerRef.current.reset();
    classifierRef.current.reset();
    meterSmoothRef.current.reset();
    captureRef.current.beginSession(sessionId);
    coachRef.current = createCoachState();
    lastCoachLineRef.current = null;
    lastCoachAtRef.current = 0;
    engineRef.current = new PracticeEngine();
    engineRef.current.start(startedAt);
    lastRef.current = {
      kind: 'silence',
      level: 0,
      speechScore: 0,
      musicScore: 0,
      violinScore: 0,
      pianoScore: 0,
      pitchHz: 0,
    };
    lastAtRef.current = startedAt;
    lastPlayingAtRef.current = 0;
    stoppingClipRef.current = false;
    meterHistRef.current = [];
    runningRef.current = true;
    fallbackRef.current = false;
    try {
      await activateKeepAwakeAsync();
    } catch {
      /* ignore */
    }
    setSnapshot({
      ...EMPTY,
      startedAt,
    });
    setRunning(true);

    try {
      await stream.start();
      return true;
    } catch {
      fallbackRef.current = true;
      captureRef.current.reset();
      try {
        await recorder.prepareToRecordAsync({
          ...RecordingPresets.LOW_QUALITY,
          isMeteringEnabled: true,
        });
        recorder.record();
        return true;
      } catch {
        runningRef.current = false;
        setRunning(false);
        try {
          deactivateKeepAwake();
        } catch {
          /* ignore */
        }
        setError('无法启动麦克风，请检查权限后重试。');
        return false;
      }
    }
  }, [recorder, stream]);

  const stop = useCallback(async (): Promise<PracticeSession | null> => {
    if (!runningRef.current) return null;
    runningRef.current = false;
    stopCoachSpeech();
    const session = engineRef.current.stop(Date.now(), 'violin');
    try {
      stream.stop();
    } catch {
      /* ignore */
    }
    try {
      if (recorder.isRecording) await recorder.stop();
    } catch {
      /* ignore */
    }
    const wasFallback = fallbackRef.current;
    fallbackRef.current = false;
    try {
      deactivateKeepAwake();
    } catch {
      /* ignore */
    }

    let segments = session.segments;
    if (!wasFallback) {
      try {
        await enterPlaybackAudioMode();
        segments = await captureRef.current.finalize(session.segments);
      } catch {
        segments = session.segments;
      }
    } else {
      captureRef.current.reset();
      try {
        await enterPlaybackAudioMode();
      } catch {
        /* ignore */
      }
    }

    const finished = { ...session, id: sessionIdRef.current || session.id, segments };
    // Keep a final draft until App.tsx persists + clearDraft (covers crash between stop and save).
    if (finished.effectiveMs >= DRAFT_MIN_EFFECTIVE_MS) {
      try {
        await saveDraft({
          ...finished,
          sessionId: sessionIdRef.current || String(finished.startedAt),
          savedAt: Date.now(),
        });
      } catch {
        /* ignore */
      }
    }

    setRunning(false);
    setSnapshot(EMPTY);
    return finished;
  }, [recorder, stream]);

  return { running, snapshot, error, start, stop, setError };
}
