import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SoundClassifier } from './classifier';
import { extractFeatures } from './features';

function toneAt(freq: number, start: number, n = 2048, sr = 16000): Float32Array {
  const x = new Float32Array(n);
  const harmonics = [1, 0.55, 0.32, 0.18, 0.1];
  for (let i = 0; i < n; i++) {
    const t = (start + i) / sr;
    let s = 0;
    harmonics.forEach((amp, k) => {
      s += amp * Math.sin(2 * Math.PI * freq * (k + 1) * t);
    });
    x[i] = s * 0.22;
  }
  return x;
}

/** Harmonic tone with slow bow-like AM (should still count as violin). */
function bowedToneAt(freq: number, start: number, n = 2048, sr = 16000): Float32Array {
  const x = new Float32Array(n);
  const harmonics = [1, 0.55, 0.32, 0.18, 0.1];
  for (let i = 0; i < n; i++) {
    const t = (start + i) / sr;
    let s = 0;
    harmonics.forEach((amp, k) => {
      s += amp * Math.sin(2 * Math.PI * freq * (k + 1) * t);
    });
    const bow = 0.72 + 0.28 * Math.sin(2 * Math.PI * 2.2 * t);
    x[i] = s * 0.22 * bow;
  }
  return x;
}

/** Syllable AM + noise — talking / singing-like. */
function voiceAt(start: number, n = 2048, sr = 16000): Float32Array {
  const x = new Float32Array(n);
  let seed = (start * 1103515245 + 12345) >>> 0;
  for (let i = 0; i < n; i++) {
    const t = (start + i) / sr;
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const noise = (seed / 0xffffffff) * 2 - 1;
    const env = 0.12 + 0.88 * Math.max(0, Math.sin(2 * Math.PI * 4.5 * t));
    const f0 = 220 + 35 * Math.sin(2 * Math.PI * 5.5 * t); // vibrato-ish singing
    const voiced =
      Math.sin(2 * Math.PI * f0 * t) * 0.4 +
      Math.sin(2 * Math.PI * 2 * f0 * t) * 0.12 +
      Math.sin(2 * Math.PI * 900 * t) * 0.1;
    x[i] = env * (0.5 * voiced + 0.5 * noise) * 0.35;
  }
  return x;
}

function silence(n = 2048): Float32Array {
  return new Float32Array(n);
}

function noise(n = 2048): Float32Array {
  const x = new Float32Array(n);
  let s = 123456789;
  for (let i = 0; i < n; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    x[i] = (s / 0xffffffff) * 2 - 1;
  }
  return x;
}

describe('violin-only detector', () => {
  it('treats silence as silence', () => {
    const c = new SoundClassifier();
    const { features } = extractFeatures(silence(), 16000, null);
    const r = c.classify(features, 'violin', 0.45, 0);
    assert.equal(r.kind, 'silence');
  });

  it('accepts sustained violin-like tone as playing', () => {
    const c = new SoundClassifier();
    let last: Float32Array | null = null;
    let result = c.classify(extractFeatures(toneAt(440, 0), 16000, last).features, 'violin', 0.45, 0);
    for (let k = 1; k < 40; k++) {
      const { features, mag } = extractFeatures(toneAt(440, k * 1024), 16000, last);
      last = mag;
      result = c.classify(features, 'violin', 0.45, k * 80);
    }
    assert.ok(result.violinScore > result.speechScore);
    assert.equal(result.kind, 'playing');
  });

  it('accepts high-position violin tones (~2kHz) as playing', () => {
    const c = new SoundClassifier();
    let last: Float32Array | null = null;
    let result = c.classify(extractFeatures(toneAt(2093, 0), 16000, last).features, 'violin', 0.45, 0);
    for (let k = 1; k < 40; k++) {
      const { features, mag } = extractFeatures(toneAt(2093, k * 1024), 16000, last);
      last = mag;
      result = c.classify(features, 'violin', 0.45, k * 80);
    }
    assert.ok(result.violinScore >= result.speechScore, `violin=${result.violinScore} speech=${result.speechScore}`);
    assert.equal(result.kind, 'playing');
  });

  it('accepts very high violin tones (~3kHz) as playing', () => {
    const c = new SoundClassifier();
    let last: Float32Array | null = null;
    let result = c.classify(extractFeatures(toneAt(2794, 0), 16000, last).features, 'violin', 0.45, 0);
    for (let k = 1; k < 40; k++) {
      const { features, mag } = extractFeatures(toneAt(2794, k * 1024), 16000, last);
      last = mag;
      result = c.classify(features, 'violin', 0.45, k * 80);
    }
    assert.ok(result.violinScore >= result.speechScore, `violin=${result.violinScore} speech=${result.speechScore}`);
    assert.equal(result.kind, 'playing');
  });

  it('does not treat loud white noise as practice', () => {
    const c = new SoundClassifier();
    let result = c.classify(extractFeatures(noise(), 16000, null).features, 'violin', 0.45, 0);
    for (let i = 1; i < 20; i++) {
      result = c.classify(extractFeatures(noise(), 16000, null).features, 'violin', 0.45, i * 80);
    }
    assert.notEqual(result.kind, 'playing');
  });

  it('accepts bowed violin with mild amplitude dynamics as playing', () => {
    const c = new SoundClassifier();
    let last: Float32Array | null = null;
    let result = c.classify(extractFeatures(bowedToneAt(440, 0), 16000, last).features, 'violin', 0.45, 0);
    for (let k = 1; k < 40; k++) {
      const { features, mag } = extractFeatures(bowedToneAt(440, k * 1024), 16000, last);
      last = mag;
      result = c.classify(features, 'violin', 0.45, k * 80);
    }
    assert.ok(result.violinScore >= result.speechScore);
    assert.equal(result.kind, 'playing');
  });

  it('rejects singing/voice as speech, not playing', () => {
    const c = new SoundClassifier();
    let result = c.classify(extractFeatures(voiceAt(0), 16000, null).features, 'violin', 0.45, 0);
    for (let i = 1; i < 40; i++) {
      result = c.classify(extractFeatures(voiceAt(i * 1024), 16000, null).features, 'violin', 0.45, i * 80);
    }
    assert.notEqual(result.kind, 'playing');
    assert.ok(result.speechScore >= result.violinScore);
  });

  it('switches from violin to voice as the 5s sliding window fills with voice', () => {
    const c = new SoundClassifier();
    let last: Float32Array | null = null;
    let result = c.classify(extractFeatures(toneAt(440, 0), 16000, last).features, 'violin', 0.45, 0);
    // ~2s violin
    for (let k = 1; k < 25; k++) {
      const { features, mag } = extractFeatures(toneAt(440, k * 1024), 16000, last);
      last = mag;
      result = c.classify(features, 'violin', 0.45, k * 80);
    }
    assert.equal(result.kind, 'playing');
    // ~5.5s voice so the sliding window is mostly speech
    for (let i = 0; i < 70; i++) {
      result = c.classify(
        extractFeatures(voiceAt(i * 1024), 16000, null).features,
        'violin',
        0.45,
        2500 + i * 80
      );
    }
    assert.equal(result.kind, 'speech');
  });
});
