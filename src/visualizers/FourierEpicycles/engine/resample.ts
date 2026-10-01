import type { Point2D, ResampleResult } from "./types";

export function resampleClosedPath(points: Point2D[], N: number): ResampleResult {
  if (!points || points.length < 2) {
    return { ok: false, error: "Draw a longer closed shape (at least 3 distinct points needed)." };
  }

  // 1. Filter out consecutive duplicate points
  const cleaned: Point2D[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const dx = points[i][0] - cleaned[cleaned.length - 1][0];
    const dy = points[i][1] - cleaned[cleaned.length - 1][1];
    if (dx * dx + dy * dy > 1e-12) {
      cleaned.push(points[i]);
    }
  }

  // 2. Ensure closed path
  const last = cleaned[cleaned.length - 1];
  const first = cleaned[0];
  const dxClose = last[0] - first[0];
  const dyClose = last[1] - first[1];
  if (dxClose * dxClose + dyClose * dyClose > 1e-12) {
    cleaned.push([first[0], first[1]]);
  }

  if (cleaned.length < 4) { // 3 distinct points + 1 closure point
    return { ok: false, error: "Shape is too small or lacks distinct vertices." };
  }

  // 3. Compute arc lengths along segment polyline
  const segmentLengths: number[] = [];
  let totalLength = 0;
  for (let i = 0; i < cleaned.length - 1; i++) {
    const dx = cleaned[i + 1][0] - cleaned[i][0];
    const dy = cleaned[i + 1][1] - cleaned[i][1];
    const len = Math.hypot(dx, dy);
    segmentLengths.push(len);
    totalLength += len;
  }

  if (totalLength < 1e-9) {
    return { ok: false, error: "Shape total length is too small." };
  }

  // 4. Sample exactly N points evenly spaced by arc length
  const samples: Point2D[] = [];
  const step = totalLength / N;
  let currentSegIndex = 0;
  let currentSegDist = 0;

  for (let i = 0; i < N; i++) {
    const targetDist = i * step;

    while (
      currentSegIndex < segmentLengths.length - 1 &&
      currentSegDist + segmentLengths[currentSegIndex] < targetDist
    ) {
      currentSegDist += segmentLengths[currentSegIndex];
      currentSegIndex++;
    }

    const segLen = segmentLengths[currentSegIndex];
    const segProgress = segLen > 1e-12 ? (targetDist - currentSegDist) / segLen : 0;

    const pA = cleaned[currentSegIndex];
    const pB = cleaned[currentSegIndex + 1];

    const x = pA[0] + segProgress * (pB[0] - pA[0]);
    const y = pA[1] + segProgress * (pB[1] - pA[1]);
    samples.push([x, y]);
  }

  return { ok: true, samples };
}