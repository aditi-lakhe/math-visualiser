import { compileRegionBounds } from "./region";
import type { Region, SampleRule, RiemannResult, CellBuffers } from "./types";

function getSampleOffset(rule: SampleRule): number {
  if (rule === "left") return 0;
  if (rule === "right") return 1;
  return 0.5; // midpoint default
}

export function computeRiemannSum(
  fn: (scope: Record<string, number>) => number,
  region: Region,
  n: number,
  m: number,
  rule: SampleRule = "midpoint"
): RiemannResult {
  const totalCells = n * m;
  if (totalCells > 40000) {
    return {
      cells: createEmptyBuffers(0),
      sum: 0,
      skipped: 0,
      skippedLocations: [],
      error: `Cell count (${totalCells}) exceeds maximum limit of 40,000 cells.`,
    };
  }

  const compiled = compileRegionBounds(region);
  if ("error" in compiled) {
    return {
      cells: createEmptyBuffers(0),
      sum: 0,
      skipped: 0,
      skippedLocations: [],
      error: compiled.error,
    };
  }

  const buffers = createEmptyBuffers(totalCells);
  const offsetPrimary = getSampleOffset(rule);
  const offsetSecondary = getSampleOffset(rule);

  let totalSum = 0;
  let skippedCount = 0;
  const skippedLocations: Array<{ x: number; y: number }> = [];
  let bufferIdx = 0;

  const v1Min = compiled.b1Min();
  const v1Max = compiled.b1Max();
  const dV1 = (v1Max - v1Min) / n;

  if (region.type === "rectangle" || region.type === "typeI") {
    for (let i = 0; i < n; i++) {
      const xStart = v1Min + i * dV1;
      const xEnd = xStart + dV1;
      const xSample = xStart + offsetPrimary * dV1;

      const yLower = compiled.b2Lower(xSample);
      const yUpper = compiled.b2Upper(xSample);
      const dY = (yUpper - yLower) / m;

      for (let j = 0; j < m; j++) {
        const yStart = yLower + j * dY;
        const yEnd = yStart + dY;
        const ySample = yStart + offsetSecondary * dY;

        const cellArea = dV1 * dY;
        const fVal = fn({ x: xSample, y: ySample });

        if (!Number.isFinite(fVal)) {
          skippedCount++;
          if (skippedLocations.length < 50) {
            skippedLocations.push({ x: xSample, y: ySample });
          }
          continue;
        }

        buffers.xMin[bufferIdx] = xStart;
        buffers.xMax[bufferIdx] = xEnd;
        buffers.yMin[bufferIdx] = yStart;
        buffers.yMax[bufferIdx] = yEnd;
        buffers.xSample[bufferIdx] = xSample;
        buffers.ySample[bufferIdx] = ySample;
        buffers.fVal[bufferIdx] = fVal;
        buffers.area[bufferIdx] = cellArea;

        totalSum += fVal * cellArea;
        bufferIdx++;
      }
    }
  } else if (region.type === "typeII") {
    for (let j = 0; j < n; j++) {
      const yStart = v1Min + j * dV1;
      const yEnd = yStart + dV1;
      const ySample = yStart + offsetPrimary * dV1;

      const xLower = compiled.b2Lower(ySample);
      const xUpper = compiled.b2Upper(ySample);
      const dX = (xUpper - xLower) / m;

      for (let i = 0; i < m; i++) {
        const xStart = xLower + i * dX;
        const xEnd = xStart + dX;
        const xSample = xStart + offsetSecondary * dX;

        const cellArea = dX * dV1;
        const fVal = fn({ x: xSample, y: ySample });

        if (!Number.isFinite(fVal)) {
          skippedCount++;
          if (skippedLocations.length < 50) {
            skippedLocations.push({ x: xSample, y: ySample });
          }
          continue;
        }

        buffers.xMin[bufferIdx] = xStart;
        buffers.xMax[bufferIdx] = xEnd;
        buffers.yMin[bufferIdx] = yStart;
        buffers.yMax[bufferIdx] = yEnd;
        buffers.xSample[bufferIdx] = xSample;
        buffers.ySample[bufferIdx] = ySample;
        buffers.fVal[bufferIdx] = fVal;
        buffers.area[bufferIdx] = cellArea;

        totalSum += fVal * cellArea;
        bufferIdx++;
      }
    }
  } else {
    // Polar Region
    for (let i = 0; i < n; i++) {
      const tStart = v1Min + i * dV1;
      const tEnd = tStart + dV1;
      const tSample = tStart + offsetPrimary * dV1;

      const rLower = compiled.b2Lower(tSample);
      const rUpper = compiled.b2Upper(tSample);
      const dR = (rUpper - rLower) / m;
      

      // A midpoint grid does not normally land on r = 0. Probe a zero-radius
      // boundary explicitly so divergent polar integrands are reported rather
      // than silently appearing finite.
      if (Math.abs(rLower) < Number.EPSILON) {
        const originValue = fn({ x: 0, y: 0, r: 0, theta: tSample });
        if (!Number.isFinite(originValue)) {
          skippedCount++;
          if (skippedLocations.length < 50) skippedLocations.push({ x: 0, y: 0 });
        }
      }

      for (let j = 0; j < m; j++) {
        const rStart = rLower + j * dR;
        const rEnd = rStart + dR;
        const rSample = rStart + offsetSecondary * dR;

        // CRITICAL: Polar area element dA = r * dr * dtheta
        const cellArea = rSample * dR * dV1;

        const xSample = rSample * Math.cos(tSample);
        const ySample = rSample * Math.sin(tSample);

        const fVal = fn({ x: xSample, y: ySample, r: rSample, theta: tSample });

        if (!Number.isFinite(fVal)) {
          skippedCount++;
          if (skippedLocations.length < 50) {
            skippedLocations.push({ x: xSample, y: ySample });
          }
          continue;
        }

        buffers.rMin[bufferIdx] = rStart;
        buffers.rMax[bufferIdx] = rEnd;
        buffers.thetaMin[bufferIdx] = tStart;
        buffers.thetaMax[bufferIdx] = tEnd;
        buffers.xSample[bufferIdx] = xSample;
        buffers.ySample[bufferIdx] = ySample;
        buffers.fVal[bufferIdx] = fVal;
        buffers.area[bufferIdx] = cellArea;

        totalSum += fVal * cellArea;
        bufferIdx++;
      }
    }
  }

  buffers.count = bufferIdx;
  return {
    cells: buffers,
    sum: totalSum,
    skipped: skippedCount,
    skippedLocations,
  };
}

function createEmptyBuffers(capacity: number): CellBuffers {
  return {
    count: 0,
    xMin: new Float64Array(capacity),
    xMax: new Float64Array(capacity),
    yMin: new Float64Array(capacity),
    yMax: new Float64Array(capacity),
    xSample: new Float64Array(capacity),
    ySample: new Float64Array(capacity),
    rMin: new Float64Array(capacity),
    rMax: new Float64Array(capacity),
    thetaMin: new Float64Array(capacity),
    thetaMax: new Float64Array(capacity),
    fVal: new Float64Array(capacity),
    area: new Float64Array(capacity),
  };
}
