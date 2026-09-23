import * as FileSystem from 'expo-file-system/legacy';
import { encodeWavMono16, floatToInt16 } from './wav';
import type { PracticeSegment } from '../types';

/** Keep recording a bit after playing ends. */
export const RECORD_STOP_HANGOVER_MS = 1200;
/** Include a little audio before trigger. */
const PRE_ROLL_MS = 450;
const MAX_CLIP_SEC = 20 * 60;

export class SessionAudioCapture {
  private sampleRate = 16000;
  private recording = false;
  private clip: Int16Array[] = [];
  private clipSamples = 0;
  private preRoll: Int16Array[] = [];
  private preRollSamples = 0;
  private finishedUris: string[] = [];
  private sessionId = '';
  private clipIndex = 0;
  private listening = false;

  reset(): void {
    this.recording = false;
    this.clip = [];
    this.clipSamples = 0;
    this.preRoll = [];
    this.preRollSamples = 0;
    this.finishedUris = [];
    this.sessionId = '';
    this.clipIndex = 0;
    this.listening = false;
  }

  beginSession(sessionId: string): void {
    this.reset();
    this.sessionId = sessionId;
    this.listening = true;
  }

  get isRecording(): boolean {
    return this.recording;
  }

  get finishedCount(): number {
    return this.finishedUris.length;
  }

  /** Always feed PCM; only keeps data while a clip is open (plus short pre-roll). */
  append(data: ArrayBuffer, sampleRate: number, channels: number): void {
    if (!this.listening) return;
    this.sampleRate = sampleRate || this.sampleRate;
    const samples = toMonoInt16(data, channels);

    if (this.recording) {
      if (this.clipSamples / this.sampleRate < MAX_CLIP_SEC) {
        this.clip.push(samples);
        this.clipSamples += samples.length;
      }
      return;
    }

    this.preRoll.push(samples);
    this.preRollSamples += samples.length;
    const maxPre = Math.floor((PRE_ROLL_MS / 1000) * this.sampleRate);
    while (this.preRollSamples > maxPre && this.preRoll.length > 0) {
      const first = this.preRoll.shift()!;
      this.preRollSamples -= first.length;
    }
  }

  /** Call when playing is detected. */
  startClip(): void {
    if (!this.listening || this.recording) return;
    this.recording = true;
    this.clip = this.preRoll.length > 0 ? [...this.preRoll] : [];
    this.clipSamples = this.preRollSamples;
    this.preRoll = [];
    this.preRollSamples = 0;
  }

  /** Call when playing has stopped (after hangover). Saves one wav clip. */
  async stopClip(): Promise<string | null> {
    if (!this.recording) return null;
    this.recording = false;
    const parts = this.clip;
    const total = this.clipSamples;
    this.clip = [];
    this.clipSamples = 0;
    this.preRoll = [];
    this.preRollSamples = 0;

    if (total < Math.floor(this.sampleRate * 0.08) || !this.sessionId) return null;

    const merged = concatInt16(parts, total);
    try {
      const uri = await writeClipWav(this.sessionId, ++this.clipIndex, merged, this.sampleRate);
      this.finishedUris.push(uri);
      return uri;
    } catch {
      return null;
    }
  }

  /** Flush open clip and attach finished files to segments in order (no timeline math). */
  async finalize(segments: PracticeSegment[]): Promise<PracticeSegment[]> {
    await this.stopClip();
    this.listening = false;
    const uris = [...this.finishedUris];
    this.finishedUris = [];
    return attachClipsInOrder(segments, uris);
  }

  /** Persist open clip to disk for crash recovery; keep session listening. */
  async checkpointClips(segments: PracticeSegment[]): Promise<PracticeSegment[]> {
    await this.stopClip();
    return attachClipsInOrder(segments, [...this.finishedUris]);
  }
}

export async function deleteSessionRecordings(sessionId: string, segments: PracticeSegment[]): Promise<void> {
  const dirs = new Set<string>();
  for (const seg of segments) {
    if (!seg.audioUri) continue;
    try {
      await FileSystem.deleteAsync(seg.audioUri, { idempotent: true });
      const slash = seg.audioUri.lastIndexOf('/');
      if (slash > 0) dirs.add(seg.audioUri.slice(0, slash));
    } catch {
      /* ignore */
    }
  }
  for (const dir of dirs) {
    try {
      await FileSystem.deleteAsync(dir, { idempotent: true });
    } catch {
      /* ignore */
    }
  }
  const safeId = sessionId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const baseDir = `${FileSystem.documentDirectory}recordings/${safeId}`;
  try {
    await FileSystem.deleteAsync(baseDir, { idempotent: true });
  } catch {
    /* ignore */
  }
}

function attachClipsInOrder(segments: PracticeSegment[], uris: string[]): PracticeSegment[] {
  if (segments.length === 0) return [];
  if (uris.length === 0) return segments.map((s) => ({ ...s }));

  return segments.map((seg, i) => {
    if (i < uris.length) return { ...seg, audioUri: uris[i] };
    // Extra clips beyond segments: put the last leftover on the last segment.
    if (i === segments.length - 1 && uris.length > segments.length) {
      return { ...seg, audioUri: uris[uris.length - 1] };
    }
    return { ...seg };
  });
}

function toMonoInt16(data: ArrayBuffer, channels: number): Int16Array {
  const src = new Float32Array(data);
  if (channels <= 1) return floatToInt16(src);
  const n = Math.floor(src.length / channels);
  const mono = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let c = 0; c < channels; c++) s += src[i * channels + c];
    mono[i] = s / channels;
  }
  return floatToInt16(mono);
}

function concatInt16(parts: Int16Array[], total: number): Int16Array {
  const out = new Int16Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

async function writeClipWav(
  sessionId: string,
  index: number,
  samples: Int16Array,
  sampleRate: number
): Promise<string> {
  const safeId = sessionId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const baseDir = `${FileSystem.documentDirectory}recordings/${safeId}`;
  await FileSystem.makeDirectoryAsync(baseDir, { intermediates: true });
  const uri = `${baseDir}/clip-${index}.wav`;
  const wav = encodeWavMono16(samples, sampleRate);
  await FileSystem.writeAsStringAsync(uri, bytesToBase64(wav), {
    encoding: FileSystem.EncodingType.Base64,
  });
  return uri;
}

function bytesToBase64(bytes: Uint8Array): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const triple = (a << 16) | (b << 8) | c;
    out += chars[(triple >> 18) & 63];
    out += chars[(triple >> 12) & 63];
    out += i + 1 < bytes.length ? chars[(triple >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? chars[triple & 63] : '=';
  }
  return out;
}
