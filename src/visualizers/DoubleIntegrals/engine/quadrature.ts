import { compileRegionBounds } from "./region";
import type { Region, QuadratureResult } from "./types";

// 20-point Gauss-Legendre quadrature nodes and weights on [-1, 1]
const GL_NODES_20 = [
  -0.9931285991850949, -0.9639719272779138, -0.9122344282513259, -0.8391169718222188,
  -0.7463319064601508, -0.6360536807265150, -0.5108670019508271, -0.3737060217740487,
  -0.2277858511416451, -0.0765265211334973,  0.0765265211334973,  0.2277858511416451,
   0.3737060217740487,  0.5108670019508271,  0.6360536807265150,  0.7463319064601508,
   0.8391169718222188,  0.9122344282513259,  0.9639719272779138,  0.9931285991850949,
];

const GL_WEIGHTS_20 = [
  0.0176140071391521, 0.0406014298003869, 0.0626720483341091,
  0.0832767415767047, 0.1019301198172404, 0.1181945319615184,
  0.1316886384491766, 0.1420961093183821, 0.1491729864726037,
  0.1527533871307259, 0.1527533871307259, 0.1491729864726037,
  0.1420961093183821, 0.1316886384491766, 0.1181945319615184,
  0.1019301198172404, 0.0832767415767047, 0.0626720483341091,
  0.0406014298003869, 0.0176140071391521,
];

export function computeQuadrature(
  fn: (scope: Record<string, number>) => number,
  region: Region,
  maxSubintervals = 16
): QuadratureResult {
  const cb = compileRegionBounds(region);
  if ("error" in cb) {
    return { value: NaN, estimatedError: Infinity, converged: false, evaluations: 0 };
  }

  let evaluations = 0;
  let hasNonFinite = false;

  const integrate1D = (
    f: (val: number) => number,
    a: number,
    b: number,
    subdivisions: number
  ): number => {
    if (Math.abs(b - a) < 1e-15) return 0;
    const h = (b - a) / subdivisions;
    let sum = 0;

    for (let sub = 0; sub < subdivisions; sub++) {
      const subA = a + sub * h;
      const subB = subA + h;
      const mid = (subA + subB) / 2;
      const halfW = (subB - subA) / 2;

      for (let k = 0; k < 20; k++) {
        const pt = mid + halfW * GL_NODES_20[k];
        evaluations++;
        const val = f(pt);
        if (!Number.isFinite(val)) {
          hasNonFinite = true;
          continue;
        }
        sum += GL_WEIGHTS_20[k] * val * halfW;
      }
    }
    return sum;
  };

  const computeLevel = (subs: number): number => {
    const v1Min = cb.b1Min();
    const v1Max = cb.b1Max();

    if (region.type === "rectangle" || region.type === "typeI") {
      return integrate1D((x) => {
        const yL = cb.b2Lower(x);
        const yU = cb.b2Upper(x);
        return integrate1D((y) => fn({ x, y }), yL, yU, subs);
      }, v1Min, v1Max, subs);
    } else if (region.type === "typeII") {
      return integrate1D((y) => {
        const xL = cb.b2Lower(y);
        const xU = cb.b2Upper(y);
        return integrate1D((x) => fn({ x, y }), xL, xU, subs);
      }, v1Min, v1Max, subs);
    } else {
      // Polar
      return integrate1D((theta) => {
        const rL = cb.b2Lower(theta);
        const rU = cb.b2Upper(theta);
        return integrate1D((r) => {
          const x = r * Math.cos(theta);
          const y = r * Math.sin(theta);
          // FACTOR OF r IN POLAR INTEGRAND
          return fn({ x, y, r, theta }) * r;
        }, rL, rU, subs);
      }, v1Min, v1Max, subs);
    }
  };

  let prevVal = computeLevel(1);
  let estErr = Infinity;

  for (let subs = 2; subs <= maxSubintervals; subs *= 2) {
    const currVal = computeLevel(subs);
    estErr = Math.abs(currVal - prevVal);
    const scale = Math.max(1, Math.abs(currVal));

    if (estErr / scale < 1e-10) {
      return {
        value: currVal,
        estimatedError: estErr,
        converged: !hasNonFinite,
        evaluations,
        hasSingularity: hasNonFinite,
      };
    }
    prevVal = currVal;
  }

  return {
    value: prevVal,
    estimatedError: estErr,
    converged: estErr < 1e-5 && !hasNonFinite,
    evaluations,
    hasSingularity: hasNonFinite,
  };
}
