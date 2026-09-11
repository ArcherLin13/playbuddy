import * as Speech from 'expo-speech';
import {
  enterPlaybackAudioMode,
  enterRecordingAudioMode,
  getOutputVolume,
  prepareCoachSpeechAudioMode,
} from '../audio/audioMode';

let speakChain: Promise<void> = Promise.resolve();

export async function speakCoach(text: string, opts?: { keepRecording?: boolean }): Promise<void> {
  const keepRecording = opts?.keepRecording ?? true;
  speakChain = speakChain
    .catch(() => undefined)
    .then(() => speakCoachOnce(text, keepRecording));
  return speakChain;
}

async function speakCoachOnce(text: string, keepRecording: boolean): Promise<void> {
  try {
    await Speech.stop();
  } catch {
    /* ignore */
  }

  try {
    if (keepRecording) {
      // Stay in playAndRecord so the monitor stream keeps working, but route to speaker.
      await prepareCoachSpeechAudioMode();
    } else {
      await enterPlaybackAudioMode();
    }
  } catch {
    /* ignore */
  }

  await new Promise<void>((resolve) => {
    Speech.speak(text, {
      language: 'zh-CN',
      pitch: 1.0,
      rate: 0.95,
      volume: getOutputVolume(),
      onDone: () => resolve(),
      onStopped: () => resolve(),
      onError: () => resolve(),
    });
  });

  if (keepRecording) {
    try {
      await enterRecordingAudioMode();
    } catch {
      /* ignore */
    }
  }
}

export function stopCoachSpeech(): void {
  try {
    Speech.stop();
  } catch {
    /* ignore */
  }
}

const PREVIEW_LINES = [
  '你已经1分钟没有练琴啦，这段演奏停止啦！',
  '快来练琴啦，你已经停止5分钟啦。',
  '你真棒，你已经连续练琴10分钟啦！',
];

/** Speak the three coach lines in order for quick verification. */
export async function previewCoachLines(
  onLine?: (text: string) => void
): Promise<void> {
  try {
    await Speech.stop();
  } catch {
    /* ignore */
  }

  try {
    await enterPlaybackAudioMode();
  } catch {
    /* ignore */
  }

  await new Promise<void>((resolve) => {
    let i = 0;
    const speakNext = () => {
      if (i >= PREVIEW_LINES.length) {
        resolve();
        return;
      }
      const text = PREVIEW_LINES[i++];
      onLine?.(text);
      Speech.speak(text, {
        language: 'zh-CN',
        pitch: 1.0,
        rate: 0.95,
        volume: getOutputVolume(),
        onDone: speakNext,
        onStopped: () => resolve(),
        onError: () => resolve(),
      });
    };
    speakNext();
  });
}
