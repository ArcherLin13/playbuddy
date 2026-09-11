import { hannWindow, magnitudeSpectrum } from './fft';

export type FrameFeatures = {
  rms: number;
  peak: number;
  zcr: number;
  centroid: number;
  flatness: number;
  flux: number;
  pitchHz: number;
  pitchConf: number;
  harmonicRatio: number;
  speechBandRatio: number;
  highRatio: number;
};

const WINDOW_CACHE = new Map<number, Float32Array>();

function getWindow(n: number): Float32Array {
  let w = WINDOW_CACHE.get(n);
  if (!w) {
    w = hannWindow(n);
    WINDOW_CACHE.set(n, w);
  }
  return w;
}

function hzToBin(hz: number, sampleRate: number, n: number): number {
  return Math.round((hz * n) / sampleRate);
}

export function extractFeatures(
  samples: Float32Array,
  sampleRate: number,
  prevMag: Float32Array | null
): { features: FrameFeatures; mag: Float32Array } {
  const n = 1 << (31 - Math.clz32(samples.length));
  if (n !== samples.length) {
    samples = samples.subarray(0, n);
  }
  let sumSq = 0;
  let peak = 0;
  let zcr = 0;
  for (let i = 0; i < n; i++) {
    const x = samples[i];
    sumSq += x * x;
    const ax = Math.abs(x);
    if (ax > peak) peak = ax;
    if (i > 0 && samples[i - 1] * x < 0) zcr += 1;
  }
  const rms = Math.sqrt(sumSq / n);
  const zcrNorm = zcr / n;

  const mag = magnitudeSpectrum(samples, getWindow(n));
  const bins = mag.length;
  let specSum = 0;
  let specLog = 0;
  let weighted = 0;
  let used = 0;
  const eps = 1e-12;
  for (let i = 1; i < bins; i++) {
    const m = mag[i] + eps;
    specSum += m;
    specLog += Math.log(m);
    weighted += m * i;
    used += 1;
  }
  const centroidHz = specSum > 0 ? (weighted / specSum) * (sampleRate / n) : 0;
  const flatness = used > 0 ? Math.exp(specLog / used) / (specSum / used + eps) : 1;

  let flux = 0;
  if (prevMag && prevMag.length === mag.length) {
    for (let i = 1; i < bins; i++) {
      const d = mag[i] - prevMag[i];
      if (d > 0) flux += d;
    }
    flux /= specSum + eps;
  }

  const speechLo = hzToBin(250, sampleRate, n);
  const speechHi = hzToBin(3400, sampleRate, n);
  const highLo = hzToBin(5000, sampleRate, n);
  let speechE = 0;
  let highE = 0;
  for (let i = 1; i < bins; i++) {
    if (i >= speechLo && i <= speechHi) speechE += mag[i];
    if (i >= highLo) highE += mag[i];
  }
  const speechBandRatio = specSum > 0 ? speechE / specSum : 0;
  const highRatio = specSum > 0 ? highE / specSum : 0;

  const pitch = detectPitch(samples, sampleRate);
  const f0 = pitch.hz;
  let harmonicRatio = 0;
  if (f0 > 60 && pitch.confidence > 0.12) {
    let harm = 0;
    let total = 0;
    // High notes have fewer harmonics below Nyquist — still credit partials that fit.
    const maxHarm = f0 >= 1200 ? 4 : 6;
    for (let k = 1; k <= maxHarm; k++) {
      const bin = hzToBin(f0 * k, sampleRate, n);
      if (bin < 1 || bin >= bins - 1) continue;
      const local = mag[bin - 1] + mag[bin] + mag[bin + 1];
      harm += local;
    }
    const lo = Math.max(1, hzToBin(Math.max(80, f0 * 0.5), sampleRate, n));
    const hi = Math.min(bins - 1, hzToBin(Math.min(sampleRate / 2 - 50, f0 * (maxHarm + 0.5)), sampleRate, n));
    for (let i = lo; i <= hi; i++) total += mag[i];
    harmonicRatio = total > 0 ? Math.min(1, harm / total) : 0;
  }

  // Bright / high-position violin: strong tonal peak above speech band.
  // Require low flatness so noise / hiss is not mistaken for a high note.
  const brightPeak = spectralPeakHz(mag, sampleRate, n, 700, Math.min(4500, sampleRate / 2 - 100));
  if (
    pitch.confidence < 0.22 &&
    brightPeak.hz >= 800 &&
    brightPeak.conf >= 0.32 &&
    flatness < 0.28
  ) {
    if (brightPeak.hz > pitch.hz || pitch.confidence < 0.15) {
      pitch.hz = brightPeak.hz;
      pitch.confidence = Math.max(pitch.confidence, brightPeak.conf * 0.85);
      if (harmonicRatio < 0.2) {
        harmonicRatio = Math.max(harmonicRatio, clamp01(brightPeak.conf * 0.55));
      }
    }
  }

  return {
    features: {
      rms,
      peak,
      zcr: zcrNorm,
      centroid: centroidHz,
      flatness,
      flux,
      pitchHz: pitch.hz,
      pitchConf: pitch.confidence,
      harmonicRatio,
      speechBandRatio,
      highRatio,
    },
    mag,
  };
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/** Strongest spectral peak in [loHz, hiHz], with local prominence. */
function spectralPeakHz(
  mag: Float32Array,
  sampleRate: number,
  n: number,
  loHz: number,
  hiHz: number
): { hz: number; conf: number } {
  const lo = Math.max(2, hzToBin(loHz, sampleRate, n));
  const hi = Math.min(mag.length - 3, hzToBin(hiHz, sampleRate, n));
  let bestI = lo;
  let best = 0;
  let sum = 0;
  for (let i = lo; i <= hi; i++) {
    sum += mag[i];
    if (mag[i] > best) {
      best = mag[i];
      bestI = i;
    }
  }
  if (best <= 0 || sum <= 0) return { hz: 0, conf: 0 };
  const neighbor = (mag[bestI - 2] + mag[bestI - 1] + mag[bestI + 1] + mag[bestI + 2]) / 4;
  const prominence = best / (neighbor + 1e-12);
  if (prominence < 2.2) return { hz: 0, conf: 0 };
  const conf = Math.max(0, Math.min(1, (best * 10) / sum));
  return { hz: (bestI * sampleRate) / n, conf };
}

/**
 * Autocorrelation pitch. Ceiling ~3800Hz so high violin positions are covered
 * (old 1400Hz ceiling dropped E-string high notes).
 */
export function detectPitch(samples: Float32Array, sampleRate: number): { hz: number; confidence: number } {
  const n = samples.length;
  let energy = 0;
  for (let i = 0; i < n; i++) energy += samples[i] * samples[i];
  if (energy < 1e-10) return { hz: 0, confidence: 0 };

  const minLag = Math.max(2, Math.floor(sampleRate / 3800));
  const maxLag = Math.min(n - 2, Math.floor(sampleRate / 70));
  let bestLag = minLag;
  let bestCorr = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0;
    const limit = n - lag;
    // Dense sampling for short lags (high pitch); stride-2 for low pitch speed.
    const step = lag < 24 ? 1 : 2;
    for (let i = 0; i < limit; i += step) {
      corr += samples[i] * samples[i + lag];
    }
    if (step === 2) corr *= 2;
    if (corr > bestCorr) {
      bestCorr = corr;
      bestLag = lag;
    }
  }
  const confidence = Math.max(0, Math.min(1, (bestCorr * 2) / energy));
  return { hz: sampleRate / bestLag, confidence };
}
