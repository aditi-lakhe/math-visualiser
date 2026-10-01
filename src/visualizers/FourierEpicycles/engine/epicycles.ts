import type { Epicycle, Point2D } from "./types";

export function epicycleChain(
  terms: Epicycle[],
  t: number,
  count: number,
  outBuffer?: Point2D[]
): Point2D[] {
  const numTerms = Math.min(count, terms.length);
  const resultLength = numTerms + 1;

  const chain = outBuffer && outBuffer.length >= resultLength ? outBuffer : new Array<Point2D>(resultLength);

  let x = 0;
  let y = 0;
  chain[0] = [x, y];

  for (let i = 0; i < numTerms; i++) {
    const term = terms[i];
    const angle = 2 * Math.PI * term.freq * t + term.phase;
    x += term.amp * Math.cos(angle);
    y += term.amp * Math.sin(angle);
    chain[i + 1] = [x, y];
  }

  return chain;
}

export function tipAt(terms: Epicycle[], t: number, count: number): Point2D {
  const numTerms = Math.min(count, terms.length);
  let x = 0;
  let y = 0;

  for (let i = 0; i < numTerms; i++) {
    const term = terms[i];
    const angle = 2 * Math.PI * term.freq * t + term.phase;
    x += term.amp * Math.cos(angle);
    y += term.amp * Math.sin(angle);
  }

  return [x, y];
}

export function reconstructionError(
  samples: Point2D[],
  terms: Epicycle[],
  count: number
): number {
  const N = samples.length;
  if (N === 0) return 0;

  let sumSqErr = 0;
  for (let n = 0; n < N; n++) {
    const t = n / N;
    const [tx, ty] = tipAt(terms, t, count);
    const dx = samples[n][0] - tx;
    const dy = samples[n][1] - ty;
    sumSqErr += dx * dx + dy * dy;
  }

  return Math.sqrt(sumSqErr / N);
}

export function errorCurve(samples: Point2D[], terms: Epicycle[]): number[] {
  const N = samples.length;
  const numTerms = terms.length;
  if (N === 0 || numTerms === 0) return [];

  // Reconstructed points buffer for t = n/N
  const approxX = new Float64Array(N);
  const approxY = new Float64Array(N);

  const errors: number[] = new Array(numTerms);

  for (let c = 0; c < numTerms; c++) {
    const term = terms[c];
    let sumSq = 0;

    for (let n = 0; n < N; n++) {
      const t = n / N;
      const angle = 2 * Math.PI * term.freq * t + term.phase;
      approxX[n] += term.amp * Math.cos(angle);
      approxY[n] += term.amp * Math.sin(angle);

      const dx = samples[n][0] - approxX[n];
      const dy = samples[n][1] - approxY[n];
      sumSq += dx * dx + dy * dy;
    }

    errors[c] = Math.sqrt(sumSq / N);
  }

  return errors;
}