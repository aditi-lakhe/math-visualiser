import { getBoundingBox, containsPoint } from "./region";
import { computeQuadrature } from "./quadrature";
import type { Region, SymmetryResult } from "./types";

export function analyzeSymmetry(
  fn: (scope: Record<string, number>) => number,
  region: Region
): SymmetryResult {
  const bbox = getBoundingBox(region);

  // 1. Region Symmetry Sampling (~2000 points)
  let regSymX = true;
  let regSymY = true;
  let regSymOrigin = true;

  const steps = 45;
  for (let i = 0; i <= steps; i++) {
    const x = bbox.xMin + (i / steps) * (bbox.xMax - bbox.xMin);
    for (let j = 0; j <= steps; j++) {
      const y = bbox.yMin + (j / steps) * (bbox.yMax - bbox.yMin);

      const inR = containsPoint(region, x, y);
      if (inR) {
        if (regSymX && !containsPoint(region, -x, y)) regSymX = false;
        if (regSymY && !containsPoint(region, x, -y)) regSymY = false;
        if (regSymOrigin && !containsPoint(region, -x, -y)) regSymOrigin = false;
      }
    }
  }

  // 2. Function Parity Sampling (~500 points in R)
  let isEvenX = true, isOddX = true;
  let isEvenY = true, isOddY = true;
  let isEvenOrigin = true, isOddOrigin = true;

  let testedPoints = 0;
  const seedStepX = (bbox.xMax - bbox.xMin) / 30;
  const seedStepY = (bbox.yMax - bbox.yMin) / 30;

  for (let i = 1; i < 30; i++) {
    const x = bbox.xMin + i * seedStepX;
    for (let j = 1; j < 30; j++) {
      const y = bbox.yMin + j * seedStepY;

      if (!containsPoint(region, x, y)) continue;
      testedPoints++;

      const fXY = fn({ x, y });
      if (!Number.isFinite(fXY)) continue;

      const tol = 1e-7 + 1e-6 * Math.abs(fXY);

      // Parity in X
      if (containsPoint(region, -x, y)) {
        const fNegXY = fn({ x: -x, y });
        if (Math.abs(fNegXY - fXY) > tol) isEvenX = false;
        if (Math.abs(fNegXY + fXY) > tol) isOddX = false;
      }

      // Parity in Y
      if (containsPoint(region, x, -y)) {
        const fXNegY = fn({ x, y: -y });
        if (Math.abs(fXNegY - fXY) > tol) isEvenY = false;
        if (Math.abs(fXNegY + fXY) > tol) isOddY = false;
      }

      // Parity in Origin
      if (containsPoint(region, -x, -y)) {
        const fNegXNegY = fn({ x: -x, y: -y });
        if (Math.abs(fNegXNegY - fXY) > tol) isEvenOrigin = false;
        if (Math.abs(fNegXNegY + fXY) > tol) isOddOrigin = false;
      }
    }
  }

  const fnParX = isEvenX ? "even" : isOddX ? "odd" : "neither";
  const fnParY = isEvenY ? "even" : isOddY ? "odd" : "neither";
  const fnParOrigin = isEvenOrigin ? "even" : isOddOrigin ? "odd" : "neither";

  let conclusion = "No special symmetry simplification detected.";
  let simplifiedVal: number | undefined = undefined;

  // Deduction rules
  if (regSymX && fnParX === "odd") {
    conclusion = "Region is symmetric in x and integrand is odd in x ⟹ Integral = 0.";
    simplifiedVal = 0;
  } else if (regSymY && fnParY === "odd") {
    conclusion = "Region is symmetric in y and integrand is odd in y ⟹ Integral = 0.";
    simplifiedVal = 0;
  } else if (regSymOrigin && fnParOrigin === "odd") {
    conclusion = "Region has origin symmetry and integrand is odd w.r.t origin ⟹ Integral = 0.";
    simplifiedVal = 0;
  } else if (regSymX && fnParX === "even") {
    conclusion = "Region is symmetric in x and integrand is even in x ⟹ Integral = 2 × ∫ (right half).";
  } else if (regSymY && fnParY === "even") {
    conclusion = "Region is symmetric in y and integrand is even in y ⟹ Integral = 2 × ∫ (upper half).";
  }

  // Cross-check with quadrature
  const quad = computeQuadrature(fn, region);
  let mismatch = false;
  if (simplifiedVal !== undefined && Math.abs(quad.value - simplifiedVal) > 1e-4) {
    mismatch = true;
    conclusion += " (Warning: Numerical quadrature mismatch; verify edge conditions).";
  }

  return {
    regionSymmetricX: regSymX,
    regionSymmetricY: regSymY,
    regionSymmetricOrigin: regSymOrigin,
    functionParityX: fnParX,
    functionParityY: fnParY,
    functionParityOrigin: fnParOrigin,
    conclusion: `${conclusion} [detected numerically, not proven]`,
    simplifiedIntegralValue: simplifiedVal,
    mismatchWithQuadrature: mismatch,
  };
}