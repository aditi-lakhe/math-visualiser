export interface Complex {
  re: number;
  im: number;
}

export interface Epicycle {
  freq: number;
  amp: number;
  phase: number; // in radians [-pi, pi]
}

export type Point2D = [number, number];

export type ResampleResult =
  | { ok: true; samples: Point2D[] }
  | { ok: false; error: string };