import type { Epicycle, Point2D, Complex } from "./types";

export function dft(samples: Point2D[]): Epicycle[] {
  const N = samples.length;
  const terms: Epicycle[] = [];

  for (let k = 0; k < N; k++) {
    let re = 0;
    let im = 0;

    for (let n = 0; n < N; n++) {
      const phi = (2 * Math.PI * k * n) / N;
      const x = samples[n][0];
      const y = samples[n][1];
      re += x * Math.cos(phi) + y * Math.sin(phi);
      im += y * Math.cos(phi) - x * Math.sin(phi);
    }

    re /= N;
    im /= N;

    const freq = k <= N / 2 ? k : k - N;
    const amp = Math.hypot(re, im);
    const phase = Math.atan2(im, re);

    terms.push({ freq, amp, phase });
  }

  return terms;
}

export function sortByAmplitude(terms: Epicycle[]): Epicycle[] {
  if (terms.length === 0) return [];

  const zeroFreqIndex = terms.findIndex((t) => t.freq === 0);
  let zeroTerm: Epicycle;
  let remaining: Epicycle[];

  if (zeroFreqIndex !== -1) {
    zeroTerm = terms[zeroFreqIndex];
    remaining = terms.filter((_, idx) => idx !== zeroFreqIndex);
  } else {
    zeroTerm = { freq: 0, amp: 0, phase: 0 };
    remaining = [...terms];
  }

  remaining.sort((a, b) => {
    if (Math.abs(b.amp - a.amp) > 1e-12) {
      return b.amp - a.amp;
    }
    const absFreqA = Math.abs(a.freq);
    const absFreqB = Math.abs(b.freq);
    if (absFreqA !== absFreqB) {
      return absFreqA - absFreqB;
    }
    return b.freq - a.freq; // positive frequency first
  });

  return [zeroTerm, ...remaining];
}

export function fft(samples: Point2D[]): Epicycle[] {
  const N = samples.length;
  if (N === 0 || (N & (N - 1)) !== 0) {
    return dft(samples);
  }

  const complexSamples: Complex[] = samples.map(([x, y]) => ({ re: x, im: y }));
  const fftResult = radix2FFT(complexSamples, false);

  const terms: Epicycle[] = new Array(N);
  for (let k = 0; k < N; k++) {
    const re = fftResult[k].re / N;
    const im = fftResult[k].im / N;
    const freq = k <= N / 2 ? k : k - N;
    const amp = Math.hypot(re, im);
    const phase = Math.atan2(im, re);
    terms[k] = { freq, amp, phase };
  }

  return terms;
}

function radix2FFT(buffer: Complex[], inverse: boolean): Complex[] {
  const n = buffer.length;
  if (n <= 1) return buffer;

  const even = new Array<Complex>(n / 2);
  const odd = new Array<Complex>(n / 2);
  for (let i = 0; i < n / 2; i++) {
    even[i] = buffer[2 * i];
    odd[i] = buffer[2 * i + 1];
  }

  const resEven = radix2FFT(even, inverse);
  const resOdd = radix2FFT(odd, inverse);

  const combined = new Array<Complex>(n);
  const sign = inverse ? 1 : -1;

  for (let k = 0; k < n / 2; k++) {
    const angle = (sign * 2 * Math.PI * k) / n;
    const exp: Complex = { re: Math.cos(angle), im: Math.sin(angle) };

    const oddRe = exp.re * resOdd[k].re - exp.im * resOdd[k].im;
    const oddIm = exp.re * resOdd[k].im + exp.im * resOdd[k].re;

    combined[k] = {
      re: resEven[k].re + oddRe,
      im: resEven[k].im + oddIm,
    };
    combined[k + n / 2] = {
      re: resEven[k].re - oddRe,
      im: resEven[k].im - oddIm,
    };
  }

  return combined;
}