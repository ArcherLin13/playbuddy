import { extractFeatures, type FrameFeatures } from './features';

const FRAME = 2048;
const HOP = 1024;

export class AudioAnalyzer {
  private pending = new Float32Array(FRAME * 4);
  private pendingLen = 0;
  private prevMag: Float32Array | null = null;
  private sampleRate = 16000;

  reset(): void {
    this.pendingLen = 0;
    this.prevMag = null;
  }

  ingest(data: ArrayBuffer, sampleRate: number, channels: number): FrameFeatures | null {
    this.sampleRate = sampleRate || this.sampleRate;
    const src = new Float32Array(data);
    const mono = channels > 1 ? downmix(src, channels) : src;

    if (this.pendingLen + mono.length > this.pending.length) {
      const keep = Math.min(this.pendingLen, FRAME);
      this.pending.copyWithin(0, this.pendingLen - keep, this.pendingLen);
      this.pendingLen = keep;
    }

    this.pending.set(mono, this.pendingLen);
    this.pendingLen += mono.length;

    if (this.pendingLen < FRAME) return null;

    const frame = this.pending.slice(0, FRAME);
    const leftover = this.pendingLen - HOP;
    this.pending.copyWithin(0, HOP, this.pendingLen);
    this.pendingLen = leftover;

    const { features, mag } = extractFeatures(frame, this.sampleRate, this.prevMag);
    this.prevMag = mag;
    return features;
  }
}

function downmix(src: Float32Array, channels: number): Float32Array {
  const frames = Math.floor(src.length / channels);
  const out = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let s = 0;
    for (let c = 0; c < channels; c++) s += src[i * channels + c];
    out[i] = s / channels;
  }
  return out;
}
