const TAU = Math.PI * 2;

export function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

export function hannWindow(n: number): Float32Array {
  const w = new Float32Array(n);
  if (n === 1) {
    w[0] = 1;
    return w;
  }
  for (let i = 0; i < n; i++) {
    w[i] = 0.5 * (1 - Math.cos((TAU * i) / (n - 1)));
  }
  return w;
}

export function fftInPlace(re: Float32Array, im: Float32Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i];
      re[i] = re[j];
      re[j] = tr;
      const ti = im[i];
      im[i] = im[j];
      im[j] = ti;
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1;
    const ang = -TAU / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < half; k++) {
        const wr = Math.cos(ang * k);
        const wi = Math.sin(ang * k);
        const idx = i + k;
        const jdx = idx + half;
        const ur = re[idx];
        const ui = im[idx];
        const vr = re[jdx] * wr - im[jdx] * wi;
        const vi = re[jdx] * wi + im[jdx] * wr;
        re[idx] = ur + vr;
        im[idx] = ui + vi;
        re[jdx] = ur - vr;
        im[jdx] = ui - vi;
      }
    }
  }
}

export function magnitudeSpectrum(samples: Float32Array, window: Float32Array): Float32Array {
  const n = samples.length;
  const re = new Float32Array(n);
  const im = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    re[i] = samples[i] * window[i];
  }
  fftInPlace(re, im);
  const half = n >> 1;
  const mag = new Float32Array(half);
  for (let i = 0; i < half; i++) {
    mag[i] = Math.hypot(re[i], im[i]);
  }
  return mag;
}
