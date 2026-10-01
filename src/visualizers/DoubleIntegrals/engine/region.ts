import { parseExpression } from "./parse";
import type { Region, RegionValidation, BoundingBox, PolarRegion } from "./types";

export interface CompiledBounds {
  b1Min: (varVal?: number) => number;
  b1Max: (varVal?: number) => number;
  b2Lower: (varVal: number) => number;
  b2Upper: (varVal: number) => number;
}

export function compileRegionBounds(region: Region): CompiledBounds | { error: string } {
  if (region.type === "rectangle") {
    const pXMin = parseExpression(region.xMin);
    const pXMax = parseExpression(region.xMax);
    const pYMin = parseExpression(region.yMin);
    const pYMax = parseExpression(region.yMax);
    if (!pXMin.ok) return { error: `xMin: ${pXMin.message}` };
    if (!pXMax.ok) return { error: `xMax: ${pXMax.message}` };
    if (!pYMin.ok) return { error: `yMin: ${pYMin.message}` };
    if (!pYMax.ok) return { error: `yMax: ${pYMax.message}` };

    return {
      b1Min: () => pXMin.fn({}),
      b1Max: () => pXMax.fn({}),
      b2Lower: () => pYMin.fn({}),
      b2Upper: () => pYMax.fn({}),
    };
  } else if (region.type === "typeI") {
    const pXMin = parseExpression(region.xMin);
    const pXMax = parseExpression(region.xMax);
    const pG1 = parseExpression(region.g1);
    const pG2 = parseExpression(region.g2);
    if (!pXMin.ok) return { error: `xMin: ${pXMin.message}` };
    if (!pXMax.ok) return { error: `xMax: ${pXMax.message}` };
    if (!pG1.ok) return { error: `g1(x): ${pG1.message}` };
    if (!pG2.ok) return { error: `g2(x): ${pG2.message}` };

    return {
      b1Min: () => pXMin.fn({}),
      b1Max: () => pXMax.fn({}),
      b2Lower: (x: number) => pG1.fn({ x }),
      b2Upper: (x: number) => pG2.fn({ x }),
    };
  } else if (region.type === "typeII") {
    const pYMin = parseExpression(region.yMin);
    const pYMax = parseExpression(region.yMax);
    const pH1 = parseExpression(region.h1);
    const pH2 = parseExpression(region.h2);
    if (!pYMin.ok) return { error: `yMin: ${pYMin.message}` };
    if (!pYMax.ok) return { error: `yMax: ${pYMax.message}` };
    if (!pH1.ok) return { error: `h1(y): ${pH1.message}` };
    if (!pH2.ok) return { error: `h2(y): ${pH2.message}` };

    return {
      b1Min: () => pYMin.fn({}),
      b1Max: () => pYMax.fn({}),
      b2Lower: (y: number) => pH1.fn({ y }),
      b2Upper: (y: number) => pH2.fn({ y }),
    };
  } else {
    const pTMin = parseExpression(region.thetaMin);
    const pTMax = parseExpression(region.thetaMax);
    const pR1 = parseExpression(region.r1);
    const pR2 = parseExpression(region.r2);
    if (!pTMin.ok) return { error: `thetaMin: ${pTMin.message}` };
    if (!pTMax.ok) return { error: `thetaMax: ${pTMax.message}` };
    if (!pR1.ok) return { error: `r1(theta): ${pR1.message}` };
    if (!pR2.ok) return { error: `r2(theta): ${pR2.message}` };

    return {
      b1Min: () => pTMin.fn({}),
      b1Max: () => pTMax.fn({}),
      b2Lower: (theta: number) => pR1.fn({ theta }),
      b2Upper: (theta: number) => pR2.fn({ theta }),
    };
  }
}

export function validateRegion(region: Region): RegionValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  const cb = compileRegionBounds(region);
  if ("error" in cb) {
    return { valid: false, errors: [cb.error], warnings: [] };
  }

  const v1Min = cb.b1Min();
  const v1Max = cb.b1Max();

  if (!Number.isFinite(v1Min) || !Number.isFinite(v1Max)) {
    errors.push("Primary boundary values are non-finite.");
    return { valid: false, errors, warnings };
  }

  if (v1Min > v1Max) {
    errors.push(`Lower outer bound (${v1Min.toFixed(3)}) exceeds upper bound (${v1Max.toFixed(3)}).`);
  }

  const samples = 50;
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const v1 = v1Min + t * (v1Max - v1Min);
    const lower = cb.b2Lower(v1);
    const upper = cb.b2Upper(v1);

    if (!Number.isFinite(lower) || !Number.isFinite(upper)) {
      warnings.push(`Non-finite boundary detected at variable value = ${v1.toFixed(3)}.`);
      continue;
    }

    if (region.type === "polar" && (lower < 0 || upper < 0)) {
      errors.push(`Polar radius r cannot be negative (r1=${lower.toFixed(3)}, r2=${upper.toFixed(3)} at theta=${v1.toFixed(3)}).`);
      break;
    }

    if (lower > upper) {
      errors.push(`Inner lower bound (${lower.toFixed(3)}) exceeds upper bound (${upper.toFixed(3)}) at outer position ${v1.toFixed(3)}.`);
      break;
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function containsPoint(region: Region, x: number, y: number, cb?: CompiledBounds): boolean {
  const compiled = cb || compileRegionBounds(region);
  if ("error" in compiled) return false;

  if (region.type === "rectangle" || region.type === "typeI") {
    const xMin = compiled.b1Min();
    const xMax = compiled.b1Max();
    if (x < xMin || x > xMax) return false;
    const yLower = compiled.b2Lower(x);
    const yUpper = compiled.b2Upper(x);
    return y >= yLower && y <= yUpper;
  } else if (region.type === "typeII") {
    const yMin = compiled.b1Min();
    const yMax = compiled.b1Max();
    if (y < yMin || y > yMax) return false;
    const xLower = compiled.b2Lower(y);
    const xUpper = compiled.b2Upper(y);
    return x >= xLower && x <= xUpper;
  } else {
    let r = Math.hypot(x, y);
    let theta = Math.atan2(y, x); // [-pi, pi]
    const tMin = compiled.b1Min();
    const tMax = compiled.b1Max();

    // Adjust theta to fit tMin..tMax range
    while (theta < tMin) theta += 2 * Math.PI;
    while (theta > tMax && theta - 2 * Math.PI >= tMin) theta -= 2 * Math.PI;

    if (theta < tMin || theta > tMax) return false;
    const rLower = compiled.b2Lower(theta);
    const rUpper = compiled.b2Upper(theta);
    return r >= rLower - 1e-9 && r <= rUpper + 1e-9;
  }
}

export function getBoundingBox(region: Region, cb?: CompiledBounds): BoundingBox {
  const compiled = cb || compileRegionBounds(region);
  if ("error" in compiled) {
    return { xMin: -1, xMax: 1, yMin: -1, yMax: 1 };
  }

  if (region.type === "rectangle" || region.type === "typeI") {
    const xMin = compiled.b1Min();
    const xMax = compiled.b1Max();
    let yMin = Infinity;
    let yMax = -Infinity;
    const steps = 100;
    for (let i = 0; i <= steps; i++) {
      const x = xMin + (i / steps) * (xMax - xMin);
      const yL = compiled.b2Lower(x);
      const yU = compiled.b2Upper(x);
      if (Number.isFinite(yL)) yMin = Math.min(yMin, yL);
      if (Number.isFinite(yU)) yMax = Math.max(yMax, yU);
    }
    return {
      xMin,
      xMax,
      yMin: Number.isFinite(yMin) ? yMin : -1,
      yMax: Number.isFinite(yMax) ? yMax : 1,
    };
  } else if (region.type === "typeII") {
    const yMin = compiled.b1Min();
    const yMax = compiled.b1Max();
    let xMin = Infinity;
    let xMax = -Infinity;
    const steps = 100;
    for (let j = 0; j <= steps; j++) {
      const y = yMin + (j / steps) * (yMax - yMin);
      const xL = compiled.b2Lower(y);
      const xU = compiled.b2Upper(y);
      if (Number.isFinite(xL)) xMin = Math.min(xMin, xL);
      if (Number.isFinite(xU)) xMax = Math.max(xMax, xU);
    }
    return {
      xMin: Number.isFinite(xMin) ? xMin : -1,
      xMax: Number.isFinite(xMax) ? xMax : 1,
      yMin,
      yMax,
    };
  } else {
    const tMin = compiled.b1Min();
    const tMax = compiled.b1Max();
    let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
    const steps = 200;
    for (let i = 0; i <= steps; i++) {
      const theta = tMin + (i / steps) * (tMax - tMin);
      const r1 = compiled.b2Lower(theta);
      const r2 = compiled.b2Upper(theta);
      for (const r of [r1, r2]) {
        if (Number.isFinite(r)) {
          const x = r * Math.cos(theta);
          const y = r * Math.sin(theta);
          xMin = Math.min(xMin, x);
          xMax = Math.max(xMax, x);
          yMin = Math.min(yMin, y);
          yMax = Math.max(yMax, y);
        }
      }
    }
    return {
      xMin: Number.isFinite(xMin) ? xMin : -1,
      xMax: Number.isFinite(xMax) ? xMax : 1,
      yMin: Number.isFinite(yMin) ? yMin : -1,
      yMax: Number.isFinite(yMax) ? yMax : 1,
    };
  }
}

export function toPolar(region: Region): PolarRegion | null {
  if (region.type === "polar") return region;
  if (region.type === "rectangle") {
    // Exact conversion possible if it is a central square/rectangle or handled exactly
    return null;
  }
  return null;
}

export function toCartesian(region: Region): Region | null {
  if (region.type !== "polar") return region;
  return null;
}