import type { Point2D, ResampleResult } from "../engine/types";
import { resampleClosedPath } from "../engine/resample";

export function parseSvgPath(d: string, N: number): ResampleResult {
  if (!d || !d.trim()) {
    return { ok: false, error: "SVG path string is empty." };
  }

  try {
    const pathEl = document.createElementNS("http://www.w3.org/2000/svg", "path");
    pathEl.setAttribute("d", d);

    const totalLength = pathEl.getTotalLength();
    if (!totalLength || isNaN(totalLength) || totalLength < 1e-6) {
      return { ok: false, error: "Invalid or zero-length SVG path." };
    }

    const rawPoints: Point2D[] = [];
    const sampleCount = Math.max(N * 2, 200);

    let xMin = Infinity, xMax = -Infinity;
    let yMin = Infinity, yMax = -Infinity;

    for (let i = 0; i < sampleCount; i++) {
      const dist = (i / sampleCount) * totalLength;
      const pt = pathEl.getPointAtLength(dist);
      // Flip Y because SVG Y is down, math Y is up
      const mathY = -pt.y;
      rawPoints.push([pt.x, mathY]);

      if (pt.x < xMin) xMin = pt.x;
      if (pt.x > xMax) xMax = pt.x;
      if (mathY < yMin) yMin = mathY;
      if (mathY > yMax) yMax = mathY;
    }

    // Normalize to [-1, 1] bounding box
    const cx = (xMin + xMax) / 2;
    const cy = (yMin + yMax) / 2;
    const width = xMax - xMin || 1;
    const height = yMax - yMin || 1;
    const scale = 1.8 / Math.max(width, height);

    const normalizedPoints: Point2D[] = rawPoints.map(([x, y]) => [
      (x - cx) * scale,
      (y - cy) * scale,
    ]);

    return resampleClosedPath(normalizedPoints, N);
  } catch (err) {
    return { ok: false, error: `Failed to parse SVG path: ${String(err)}` };
  }
}