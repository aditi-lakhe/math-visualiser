import { describe, expect, it } from "vitest";
import { MAX_SCALE, MIN_SCALE, Viewport } from "../viewport";
import { niceStep } from "../drawHelpers";

describe("Viewport Unit Tests", () => {
  it("Round trip toMath(toScreen(x,y)) returns (x,y) within 1e-9", () => {
    const vp = new Viewport(1920, 1080, 65, -12.5, 42.1);
    const testPoints: [number, number][] = [
      [0, 0],
      [10.5, -3.2],
      [-100, 250],
      [Math.PI, Math.E],
    ];

    for (const [x, y] of testPoints) {
      const [sx, sy] = vp.toScreen(x, y);
      const [mx, my] = vp.toMath(sx, sy);
      expect(mx).toBeCloseTo(x, 9);
      expect(my).toBeCloseTo(y, 9);
    }
  });

  it("Center point maps to screen center and +y maps to smaller screen-y", () => {
    const vp = new Viewport(800, 600, 50, 10, 20);
    const [cxScreen, cyScreen] = vp.toScreen(10, 20);
    expect(cxScreen).toBe(400);
    expect(cyScreen).toBe(300);

    const [, yHigher] = vp.toScreen(10, 25);
    expect(yHigher).toBeLessThan(300);
  });

  it("zoomAt leaves the math point under the cursor unchanged", () => {
    const vp = new Viewport(1000, 800, 50, 5, -5);
    const cursor: [number, number] = [350, 220];
    const [origMx, origMy] = vp.toMath(cursor[0], cursor[1]);

    vp.zoomAt(cursor[0], cursor[1], 1.75);

    const [newMx, newMy] = vp.toMath(cursor[0], cursor[1]);
    expect(newMx).toBeCloseTo(origMx, 9);
    expect(newMy).toBeCloseTo(origMy, 9);
  });

  it("zoomAt respects MIN_SCALE and MAX_SCALE constraints", () => {
    const vp = new Viewport(800, 600, 50, 0, 0);

    vp.zoomAt(400, 300, 0.0000001);
    expect(vp.scale).toBe(50);

    vp.zoomAt(400, 300, 1000000);
    expect(vp.scale).toBe(50);

    vp.scale = MIN_SCALE;
    vp.zoomAt(400, 300, 0.5);
    expect(vp.scale).toBe(MIN_SCALE);

    vp.scale = MAX_SCALE;
    vp.zoomAt(400, 300, 2.0);
    expect(vp.scale).toBe(MAX_SCALE);
  });

  it("fitBounds places all 4 box corners inside screen with at least padding", () => {
    const padding = 40;
    const vp = new Viewport(800, 600);
    const xMin = -10, xMax = 20, yMin = -5, yMax = 15;

    vp.fitBounds(xMin, xMax, yMin, yMax, padding);

    const corners: [number, number][] = [
      [xMin, yMin],
      [xMax, yMin],
      [xMin, yMax],
      [xMax, yMax],
    ];

    for (const [x, y] of corners) {
      const [sx, sy] = vp.toScreen(x, y);
      expect(sx).toBeGreaterThanOrEqual(padding - 1e-9);
      expect(sx).toBeLessThanOrEqual(vp.width - padding + 1e-9);
      expect(sy).toBeGreaterThanOrEqual(padding - 1e-9);
      expect(sy).toBeLessThanOrEqual(vp.height - padding + 1e-9);
    }
  });

  it("Equal aspect: a unit square maps to a screen square", () => {
    const vp = new Viewport(1200, 900, 42.5, 3, -2);
    const [sX1, sY1] = vp.toScreen(0, 0);
    const [sX2, sY2] = vp.toScreen(1, 1);

    const widthPx = Math.abs(sX2 - sX1);
    const heightPx = Math.abs(sY2 - sY1);
    expect(widthPx).toBeCloseTo(heightPx, 9);
    expect(widthPx).toBeCloseTo(42.5, 9);
  });

  it("niceStep returns only values in {1, 2, 5} * 10^k", () => {
    const ranges = [0.00045, 0.03, 1.2, 85, 1200, 950000];

    for (const range of ranges) {
      const step = niceStep(range, 10);
      const log10 = Math.log10(step);
      const k = Math.floor(log10 + 1e-12);
      const normalized = Math.round(step / Math.pow(10, k));
      expect([1, 2, 5]).toContain(normalized);
    }
  });
});