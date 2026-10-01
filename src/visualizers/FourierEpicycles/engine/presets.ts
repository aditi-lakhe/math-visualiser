import type { Point2D } from "./types";

export function generateCircle(N = 256): Point2D[] {
  const pts: Point2D[] = [];
  for (let i = 0; i < N; i++) {
    const theta = (2 * Math.PI * i) / N;
    pts.push([Math.cos(theta), Math.sin(theta)]);
  }
  return pts;
}

export function generateSquare(N = 256): Point2D[] {
  const pts: Point2D[] = [];
  const side = N / 4;
  for (let i = 0; i < N; i++) {
    const seg = Math.floor(i / side);
    const t = (i % side) / side;
    switch (seg) {
      case 0: pts.push([-0.8 + 1.6 * t, 0.8]); break;
      case 1: pts.push([0.8, 0.8 - 1.6 * t]); break;
      case 2: pts.push([0.8 - 1.6 * t, -0.8]); break;
      default: pts.push([-0.8, -0.8 + 1.6 * t]); break;
    }
  }
  return pts;
}

export function generateTriangle(N = 256): Point2D[] {
  const pts: Point2D[] = [];
  const p1: Point2D = [0, 0.9];
  const p2: Point2D = [0.8, -0.7];
  const p3: Point2D = [-0.8, -0.7];

  const side = N / 3;
  for (let i = 0; i < N; i++) {
    const seg = Math.floor(i / side);
    const t = (i % side) / side;
    if (seg === 0) pts.push([p1[0] + t * (p2[0] - p1[0]), p1[1] + t * (p2[1] - p1[1])]);
    else if (seg === 1) pts.push([p2[0] + t * (p3[0] - p2[0]), p2[1] + t * (p3[1] - p2[1])]);
    else pts.push([p3[0] + t * (p1[0] - p3[0]), p3[1] + t * (p1[1] - p3[1])]);
  }
  return pts;
}

export function generateStar(N = 256): Point2D[] {
  const pts: Point2D[] = [];
  const outerR = 0.9;
  const innerR = 0.35;
  const numPoints = 5;

  for (let i = 0; i < N; i++) {
    const frac = i / N;
    const angle = frac * 2 * Math.PI - Math.PI / 2;
    const step = frac * numPoints * 2;
    const r = Math.floor(step) % 2 === 0 
      ? outerR - (step % 1) * (outerR - innerR) 
      : innerR + (step % 1) * (outerR - innerR);
    pts.push([r * Math.cos(angle), r * Math.sin(angle)]);
  }
  return pts;
}

export function generateHeart(N = 256): Point2D[] {
  const pts: Point2D[] = [];
  for (let i = 0; i < N; i++) {
    const t = (2 * Math.PI * i) / N;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    pts.push([x / 18, y / 18]);
  }
  return pts;
}

export function generateFigureEight(N = 256): Point2D[] {
  const pts: Point2D[] = [];
  for (let i = 0; i < N; i++) {
    const t = (2 * Math.PI * i) / N;
    const x = 0.9 * Math.sin(t);
    const y = 0.9 * Math.sin(t) * Math.cos(t);
    pts.push([x, y]);
  }
  return pts;
}

export function generateTrefoil(N = 256): Point2D[] {
  const pts: Point2D[] = [];
  for (let i = 0; i < N; i++) {
    const t = (2 * Math.PI * i) / N;
    const x = 0.35 * (Math.sin(t) + 2 * Math.sin(2 * t));
    const y = 0.35 * (Math.cos(t) - 2 * Math.cos(2 * t));
    pts.push([x, y]);
  }
  return pts;
}

export const PRESETS: Record<string, (N?: number) => Point2D[]> = {
  Circle: generateCircle,
  Square: generateSquare,
  Triangle: generateTriangle,
  Star: generateStar,
  Heart: generateHeart,
  "Figure Eight": generateFigureEight,
  "Trefoil Knot": generateTrefoil,
};
export default PRESETS;