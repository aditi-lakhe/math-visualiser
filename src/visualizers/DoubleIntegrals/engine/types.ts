import type { MathNode } from "mathjs";

export type SampleRule = "left" | "midpoint" | "right";

export type ParseResult =
  | { ok: true; fn: (scope: Record<string, number>) => number; ast: MathNode }
  | { ok: false; message: string };

export type RectangleRegion = {
  type: "rectangle";
  xMin: string;
  xMax: string;
  yMin: string;
  yMax: string;
};

export type TypeIRegion = {
  type: "typeI";
  xMin: string;
  xMax: string;
  g1: string; // y_lower(x)
  g2: string; // y_upper(x)
};

export type TypeIIRegion = {
  type: "typeII";
  yMin: string;
  yMax: string;
  h1: string; // x_lower(y)
  h2: string; // x_upper(y)
};

export type PolarRegion = {
  type: "polar";
  thetaMin: string;
  thetaMax: string;
  r1: string; // r_lower(theta)
  r2: string; // r_upper(theta)
};

export type Region = RectangleRegion | TypeIRegion | TypeIIRegion | PolarRegion;

export interface RegionValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface BoundingBox {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export interface CellBuffers {
  count: number;
  // Cartesian/World Bounding Box for Drawing
  xMin: Float64Array;
  xMax: Float64Array;
  yMin: Float64Array;
  yMax: Float64Array;
  // Sample point in Cartesian coordinates
  xSample: Float64Array;
  ySample: Float64Array;
  // Polar specifics (or 0 for Cartesian)
  rMin: Float64Array;
  rMax: Float64Array;
  thetaMin: Float64Array;
  thetaMax: Float64Array;
  // Integral components
  fVal: Float64Array;
  area: Float64Array;
}

export interface RiemannResult {
  cells: CellBuffers;
  sum: number;
  skipped: number;
  skippedLocations: Array<{ x: number; y: number }>;
  error?: string;
}

export interface QuadratureResult {
  value: number;
  estimatedError: number;
  converged: boolean;
  evaluations: number;
  hasSingularity?: boolean;
}

export type SymmetryType = "odd_x" | "even_x" | "odd_y" | "even_y" | "odd_origin" | "even_origin" | "none";

export interface SymmetryResult {
  regionSymmetricX: boolean;
  regionSymmetricY: boolean;
  regionSymmetricOrigin: boolean;
  functionParityX: "even" | "odd" | "neither";
  functionParityY: "even" | "odd" | "neither";
  functionParityOrigin: "even" | "odd" | "neither";
  conclusion: string;
  simplifiedIntegralValue?: number;
  mismatchWithQuadrature?: boolean;
}

export interface CoordinateHint {
  recommendation: "polar" | "cartesian" | "either";
  reasons: string[];
}