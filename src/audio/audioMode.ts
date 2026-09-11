import { setAudioModeAsync } from 'expo-audio';

let outputVolume = 1;

export function getOutputVolume(): number {
  return outputVolume;
}

export function setOutputVolume(value: number): void {
  outputVolume = Math.max(0, Math.min(1, value));
}

/** Mic session for practice — force loudspeaker, not earpiece. */
export async function enterRecordingAudioMode(): Promise<void> {
  await setAudioModeAsync({
    allowsRecording: true,
    playsInSilentMode: true,
    // Duck other audio so coach TTS can be heard over the mic session.
    interruptionMode: 'duckOthers',
    shouldRouteThroughEarpiece: false,
    shouldPlayInBackground: false,
  });
}

/**
 * Keep mic category (playAndRecord) but refresh speaker routing so TTS can play
 * during an active practice monitor session.
 */
export async function prepareCoachSpeechAudioMode(): Promise<void> {
  await setAudioModeAsync({
    allowsRecording: true,
    playsInSilentMode: true,
    interruptionMode: 'duckOthers',
    shouldRouteThroughEarpiece: false,
    shouldPlayInBackground: false,
  });
}

/** Normal media playback — hardware volume buttons control media volume. */
export async function enterPlaybackAudioMode(): Promise<void> {
  await setAudioModeAsync({
    allowsRecording: false,
    playsInSilentMode: true,
    interruptionMode: 'mixWithOthers',
    shouldRouteThroughEarpiece: false,
    shouldPlayInBackground: false,
  });
}
