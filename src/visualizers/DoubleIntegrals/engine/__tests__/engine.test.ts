import { describe, it, expect } from "vitest";
import { parseExpression } from "../parse";
import { validateRegion } from "../region";
import { computeRiemannSum } from "../riemann";
import { computeQuadrature } from "../quadrature";
import { analyzeSymmetry } from "../symmetry";
import type { Region } from "../types";

describe("Double Integral Engine - Phase 1 Test Suite", () => {
  it("1. Parser: safety enforcement & math validation", () => {
    const safe = parseExpression("x^2 + sin(y) + pi");
    expect(safe.ok).toBe(true);
    if (safe.ok) {
      expect(safe.fn({ x: 2, y: 0 })).toBeCloseTo(4 + Math.PI, 6);
    }

    const unsafeImport = parseExpression("import('fs')");
    expect(unsafeImport.ok).toBe(false);

    const unknownSymbol = parseExpression("z + x");
    expect(unknownSymbol.ok).toBe(false);
  });

  it("2. Region Validation: flags invalid bounds", () => {
    const invalidRegion: Region = {
      type: "rectangle",
      xMin: "2",
      xMax: "1", // lower > upper
      yMin: "0",
      yMax: "1",
    };
    const res = validateRegion(invalidRegion);
    expect(res.valid).toBe(false);
    expect(res.errors.length).toBeGreaterThan(0);
  });

  it("3. Midpoint Riemann Sum: 2nd-order O(h^2) convergence check", () => {
    const fn = (s: Record<string, number>) => s.x * s.y;
    const region: Region = { type: "rectangle", xMin: "0", xMax: "1", yMin: "0", yMax: "1" };
    const exact = 0.25;

    const r1 = computeRiemannSum(fn, region, 10, 10, "midpoint");
    const r2 = computeRiemannSum(fn, region, 20, 20, "midpoint");

    const err1 = Math.abs(r1.sum - exact);
    const err2 = Math.abs(r2.sum - exact);

    // Doubling n and m reduces error by roughly a factor of 4 (accept 3.5 to 4.5 or exact zero for bilinear)
    if (err1 > 1e-12) {
      const ratio = err1 / err2;
      expect(ratio).toBeGreaterThanOrEqual(3.5);
    } else {
      expect(err1).toBeCloseTo(0, 8);
    }
  });

  it("4. Polar factor of r regression test: f = 1 over unit disk = pi", () => {
    const fn = () => 1;
    const polarDisk: Region = {
      type: "polar",
      thetaMin: "0",
      thetaMax: "2*pi",
      r1: "0",
      r2: "1",
    };

    const riemann = computeRiemannSum(fn, polarDisk, 50, 50, "midpoint");
    expect(riemann.sum).toBeCloseTo(Math.PI, 2);

    const quad = computeQuadrature(fn, polarDisk);
    expect(quad.value).toBeCloseTo(Math.PI, 6);
  });

  it("5. Symmetry Detector: correctly identifies odd symmetry & integral zeroing", () => {
    const fn = (s: Record<string, number>) => s.x; // odd in x
    const disk: Region = {
      type: "polar",
      thetaMin: "0",
      thetaMax: "2*pi",
      r1: "0",
      r2: "1",
    };

    const sym = analyzeSymmetry(fn, disk);
    expect(sym.regionSymmetricX).toBe(true);
    expect(sym.functionParityX).toBe("odd");
    expect(sym.simplifiedIntegralValue).toBe(0);
  });

  it("6. Singularity handling: 1/(x^2 + y^2) over annulus vs origin", () => {
    const fn = (s: Record<string, number>) => 1 / (s.x * s.x + s.y * s.y);
    const annulus: Region = {
      type: "polar",
      thetaMin: "0",
      thetaMax: "2*pi",
      r1: "1",
      r2: "2",
    };

    // Exact = 2 * pi * ln(2) approx 4.35517218
    const quadAnnulus = computeQuadrature(fn, annulus);
    expect(quadAnnulus.value).toBeCloseTo(2 * Math.PI * Math.LN2, 4);

    const originDisk: Region = {
      type: "polar",
      thetaMin: "0",
      thetaMax: "2*pi",
      r1: "0",
      r2: "1",
    };
    const riemannOrigin = computeRiemannSum(fn, originDisk, 20, 20);
    expect(riemannOrigin.skipped).toBeGreaterThan(0); // origin sampled/skipped, no NaN returned
  });
});