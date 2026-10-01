import { Viewport } from "./viewport";

export const THEME = {
  background: "#0a0a0f",
  grid: "rgba(255, 255, 255, 0.06)",
  gridMajor: "rgba(255, 255, 255, 0.12)",
  axes: "rgba(255, 255, 255, 0.35)",
  labels: "rgba(255, 255, 255, 0.6)",
  accent: "#00e5ff",
  fontStack: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
};

export function niceStep(rangeUnits: number, targetTicks: number): number {
  const rawStep = rangeUnits / Math.max(1, targetTicks);
  const mag = Math.floor(Math.log10(rawStep));
  const magPow = Math.pow(10, mag);
  const residual = rawStep / magPow;

  let niceResidual = 1;
  if (residual > 1.5 && residual <= 3.5) {
    niceResidual = 2;
  } else if (residual > 3.5 && residual <= 7.5) {
    niceResidual = 5;
  } else if (residual > 7.5) {
    niceResidual = 10;
  }

  return niceResidual * magPow;
}

function formatLabel(val: number): string {
  if (Math.abs(val) < 1e-12) return "0";
  const str = val.toPrecision(6);
  return parseFloat(str).toString();
}

export function drawGrid(ctx: CanvasRenderingContext2D, vp: Viewport): void {
  const { xMin, xMax, yMin, yMax } = vp.visibleBounds();
  const majorStep = niceStep(xMax - xMin, 10);
  const minorStep = majorStep / 5;

  ctx.save();
  ctx.lineWidth = 1;

  // Draw minor grid
  ctx.strokeStyle = THEME.grid;
  ctx.beginPath();
  const firstMinorX = Math.floor(xMin / minorStep) * minorStep;
  for (let x = firstMinorX; x <= xMax; x += minorStep) {
    const [sx] = vp.toScreen(x, 0);
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx, vp.height);
  }
  const firstMinorY = Math.floor(yMin / minorStep) * minorStep;
  for (let y = firstMinorY; y <= yMax; y += minorStep) {
    const [, sy] = vp.toScreen(0, y);
    ctx.moveTo(0, sy);
    ctx.lineTo(vp.width, sy);
  }
  ctx.stroke();

  // Draw major grid
  ctx.strokeStyle = THEME.gridMajor;
  ctx.beginPath();
  const firstMajorX = Math.floor(xMin / majorStep) * majorStep;
  for (let x = firstMajorX; x <= xMax; x += majorStep) {
    const [sx] = vp.toScreen(x, 0);
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx, vp.height);
  }
  const firstMajorY = Math.floor(yMin / majorStep) * majorStep;
  for (let y = firstMajorY; y <= yMax; y += majorStep) {
    const [, sy] = vp.toScreen(0, y);
    ctx.moveTo(0, sy);
    ctx.lineTo(vp.width, sy);
  }
  ctx.stroke();

  ctx.restore();
}

export function drawAxes(ctx: CanvasRenderingContext2D, vp: Viewport): void {
  const { xMin, xMax, yMin, yMax } = vp.visibleBounds();
  const step = niceStep(xMax - xMin, 10);

  const [originX, originY] = vp.toScreen(0, 0);
  const clampedAxisY = Math.max(20, Math.min(vp.height - 20, originY));
  const clampedAxisX = Math.max(30, Math.min(vp.width - 40, originX));

  ctx.save();
  ctx.strokeStyle = THEME.axes;
  ctx.fillStyle = THEME.labels;
  ctx.font = `11px ${THEME.fontStack}`;
  ctx.lineWidth = 1.5;

  // X Axis Line
  ctx.beginPath();
  ctx.moveTo(0, clampedAxisY);
  ctx.lineTo(vp.width, clampedAxisY);
  // Y Axis Line
  ctx.moveTo(clampedAxisX, 0);
  ctx.lineTo(clampedAxisX, vp.height);
  ctx.stroke();

  // X Axis Ticks and Labels
  ctx.textAlign = "center";
  ctx.textBaseline = clampedAxisY === originY && originY < vp.height - 30 ? "top" : "bottom";
  const labelOffsetY = clampedAxisY === originY && originY < vp.height - 30 ? 6 : -6;

  const firstX = Math.ceil(xMin / step) * step;
  for (let x = firstX; x <= xMax; x += step) {
    if (Math.abs(x) < step * 0.1) continue; // Skip origin
    const [sx] = vp.toScreen(x, 0);

    ctx.beginPath();
    ctx.moveTo(sx, clampedAxisY - 4);
    ctx.lineTo(sx, clampedAxisY + 4);
    ctx.stroke();

    ctx.fillText(formatLabel(x), sx, clampedAxisY + labelOffsetY);
  }

  // Y Axis Ticks and Labels
  ctx.textAlign = clampedAxisX === originX && originX > 40 ? "right" : "left";
  ctx.textBaseline = "middle";
  const labelOffsetX = clampedAxisX === originX && originX > 40 ? -6 : 6;

  const firstY = Math.ceil(yMin / step) * step;
  for (let y = firstY; y <= yMax; y += step) {
    if (Math.abs(y) < step * 0.1) continue; // Skip origin
    const [, sy] = vp.toScreen(0, y);

    ctx.beginPath();
    ctx.moveTo(clampedAxisX - 4, sy);
    ctx.lineTo(clampedAxisX + 4, sy);
    ctx.stroke();

    ctx.fillText(formatLabel(y), clampedAxisX + labelOffsetX, sy);
  }

  ctx.restore();
}

export function drawPoint(
  ctx: CanvasRenderingContext2D,
  vp: Viewport,
  x: number,
  y: number,
  radius = 4,
  color = THEME.accent
): void {
  const [sx, sy] = vp.toScreen(x, y);
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(sx, sy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawSegment(
  ctx: CanvasRenderingContext2D,
  vp: Viewport,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color = "rgba(255, 255, 255, 0.5)",
  width = 1
): void {
  const [sx1, sy1] = vp.toScreen(x1, y1);
  const [sx2, sy2] = vp.toScreen(x2, y2);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(sx1, sy1);
  ctx.lineTo(sx2, sy2);
  ctx.stroke();
  ctx.restore();
}

export function drawArrow(
  ctx: CanvasRenderingContext2D,
  vp: Viewport,
  from: [number, number],
  to: [number, number],
  headSize = 10,
  color = THEME.accent
): void {
  const [sx1, sy1] = vp.toScreen(from[0], from[1]);
  const [sx2, sy2] = vp.toScreen(to[0], to[1]);
  const angle = Math.atan2(sy2 - sy1, sx2 - sx1);

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.moveTo(sx1, sy1);
  ctx.lineTo(sx2, sy2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(sx2, sy2);
  ctx.lineTo(
    sx2 - headSize * Math.cos(angle - Math.PI / 6),
    sy2 - headSize * Math.sin(angle - Math.PI / 6)
  );
  ctx.lineTo(
    sx2 - headSize * Math.cos(angle + Math.PI / 6),
    sy2 - headSize * Math.sin(angle + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}