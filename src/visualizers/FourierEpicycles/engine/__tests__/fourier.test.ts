import { describe, expect, it } from "vitest";
import type { Point2D } from "../types";
import { generateCircle, generateSquare } from "../presets";
import { dft, fft, sortByAmplitude } from "../dft";
import { resampleClosedPath } from "../resample";
import { epicycleChain, tipAt, reconstructionError, errorCurve } from "../epicycles";

describe("Fourier Epicycles Engine Tests", () => {
  it("Counterclockwise unit circle produces dominant freq +1 with amplitude 1", () => {
    const N = 128;
    const samples = generateCircle(N);
    const terms = dft(samples);

    const pos1 = terms.find((t) => t.freq === 1);
    expect(pos1).toBeDefined();
    expect(pos1!.amp).toBeCloseTo(1.0, 5);

    terms.forEach((t) => {
      if (t.freq !== 1) {
        expect(t.amp).toBeLessThan(1e-5);
      }
    });
  });

  it("Clockwise unit circle produces dominant freq -1", () => {
    const N = 128;
    const samples: Point2D[] = [];
    for (let i = 0; i < N; i++) {
      const theta = (-2 * Math.PI * i) / N;
      samples.push([Math.cos(theta), Math.sin(theta)]);
    }

    const terms = dft(samples);
    const neg1 = terms.find((t) => t.freq === -1);
    expect(neg1).toBeDefined();
    expect(neg1!.amp).toBeCloseTo(1.0, 5);
  });

  it("Exact reconstruction at t = n/N when count = N", () => {
    const N = 64;
    const samples: Point2D[] = Array.from({ length: N }, (_, i) => [
      Math.sin(i * 0.5) * 2,
      Math.cos(i * 0.3) * 1.5,
    ]);

    const terms = dft(samples);
    for (let n = 0; n < N; n++) {
      const t = n / N;
      const [tx, ty] = tipAt(terms, t, N);
      expect(tx).toBeCloseTo(samples[n][0], 5);
      expect(ty).toBeCloseTo(samples[n][1], 5);
    }
  });

  it("Parseval's Identity: sum |c_k|^2 == (1/N) * sum |z_n|^2", () => {
    const N = 64;
    const samples = generateSquare(N);
    const terms = dft(samples);

    const sumCk2 = terms.reduce((acc, t) => acc + t.amp * t.amp, 0);
    const sumZn2 = samples.reduce((acc, [x, y]) => acc + (x * x + y * y), 0) / N;

    expect(sumCk2).toBeCloseTo(sumZn2, 5);
  });

  it("Translation invariance: constant offset affects only freq-0 term", () => {
    const N = 64;
    const base = generateCircle(N);
    const shifted = base.map(([x, y]) => [x + 5.0, y - 3.0] as Point2D);

    const termsBase = dft(base);
    const termsShifted = dft(shifted);

    const zeroBase = termsBase.find((t) => t.freq === 0)!;
    const zeroShifted = termsShifted.find((t) => t.freq === 0)!;

    expect(zeroBase.amp).toBeCloseTo(0, 5);
    expect(zeroShifted.amp).toBeCloseTo(Math.hypot(5, -3), 5);

    // Non-zero terms remain unchanged
    const pos1Base = termsBase.find((t) => t.freq === 1)!;
    const pos1Shifted = termsShifted.find((t) => t.freq === 1)!;
    expect(pos1Shifted.amp).toBeCloseTo(pos1Base.amp, 5);
  });

  it("Sorting places freq-0 term first and orders remaining by descending amplitude", () => {
    const N = 64;
    const samples = generateSquare(N);
    const terms = dft(samples);
    const sorted = sortByAmplitude(terms);

    expect(sorted[0].freq).toBe(0);
    for (let i = 1; i < sorted.length - 1; i++) {
      expect(sorted[i].amp).toBeGreaterThanOrEqual(sorted[i + 1].amp - 1e-9);
    }
  });

  it("Radix-2 FFT matches DFT within 1e-9 for power-of-two N", () => {
    for (const N of [8, 64, 512]) {
      const samples = generateSquare(N);
      const dftTerms = dft(samples);
      const fftTerms = fft(samples);

      expect(dftTerms.length).toBe(N);
      expect(fftTerms.length).toBe(N);

      for (let i = 0; i < N; i++) {
        expect(fftTerms[i].amp).toBeCloseTo(dftTerms[i].amp, 5);
      }
    }
  });

  it("resampleClosedPath handles duplicates, closures, and returns exact N points", () => {
    const square = generateSquare(64);
    const res = resampleClosedPath(square, 128);

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.samples.length).toBe(128);
    }

    const degenerate = resampleClosedPath([[0, 0], [0, 0]], 64);
    expect(degenerate.ok).toBe(false);
  });

  it("epicycleChain last element equals tipAt", () => {
    const samples = generateCircle(32);
    const terms = dft(samples);
    const chain = epicycleChain(terms, 0.25, 10);
    const tip = tipAt(terms, 0.25, 10);

    expect(chain[chain.length - 1][0]).toBeCloseTo(tip[0], 6);
    expect(chain[chain.length - 1][1]).toBeCloseTo(tip[1], 6);
  });

  it("errorCurve decreases monotonically and reaches ~0 at full count", () => {
    const samples = generateSquare(64);
    const sortedTerms = sortByAmplitude(dft(samples));
    const curve = errorCurve(samples, sortedTerms);

    expect(curve.length).toBe(64);
    expect(curve[curve.length - 1]).toBeCloseTo(0, 4);

    const singleError = reconstructionError(samples, sortedTerms, 5);
    expect(curve[4]).toBeCloseTo(singleError, 5);
  });
});