export const MIN_SCALE = 0.001;
export const MAX_SCALE = 100000;

export class Viewport {
  public width: number;
  public height: number;
  public scale: number;
  public cx: number;
  public cy: number;

  constructor(
    width: number,
    height: number,
    scale = 50,
    cx = 0,
    cy = 0
  ) {
    this.width = width;
    this.height = height;
    this.scale = scale;
    this.cx = cx;
    this.cy = cy;
  }

  toScreen(x: number, y: number): [number, number] {
    return [
      this.width / 2 + (x - this.cx) * this.scale,
      this.height / 2 - (y - this.cy) * this.scale,
    ];
  }

  toMath(px: number, py: number): [number, number] {
    return [
      this.cx + (px - this.width / 2) / this.scale,
      this.cy - (py - this.height / 2) / this.scale,
    ];
  }

  zoomAt(px: number, py: number, factor: number): void {
    const targetScale = this.scale * factor;
    if (targetScale < MIN_SCALE || targetScale > MAX_SCALE) {
      return;
    }

    const [mx, my] = this.toMath(px, py);
    this.scale = targetScale;
    this.cx = mx - (px - this.width / 2) / this.scale;
    this.cy = my + (py - this.height / 2) / this.scale;
  }

  panBy(dxPx: number, dyPx: number): void {
    this.cx -= dxPx / this.scale;
    this.cy += dyPx / this.scale;
  }

  fitBounds(
    xMin: number,
    xMax: number,
    yMin: number,
    yMax: number,
    paddingPx = 32
  ): void {
    const availWidth = Math.max(1, this.width - 2 * paddingPx);
    const availHeight = Math.max(1, this.height - 2 * paddingPx);
    const mathWidth = Math.abs(xMax - xMin) || 1;
    const mathHeight = Math.abs(yMax - yMin) || 1;

    const scaleX = availWidth / mathWidth;
    const scaleY = availHeight / mathHeight;
    const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, Math.min(scaleX, scaleY)));

    this.scale = newScale;
    this.cx = (xMin + xMax) / 2;
    this.cy = (yMin + yMax) / 2;
  }

  visibleBounds(): { xMin: number; xMax: number; yMin: number; yMax: number } {
    const [xMin, yMax] = this.toMath(0, 0);
    const [xMax, yMin] = this.toMath(this.width, this.height);
    return { xMin, xMax, yMin, yMax };
  }

  clone(): Viewport {
    return new Viewport(this.width, this.height, this.scale, this.cx, this.cy);
  }

  set(partial: Partial<Viewport>): void {
    if (partial.width !== undefined) this.width = partial.width;
    if (partial.height !== undefined) this.height = partial.height;
    if (partial.scale !== undefined) this.scale = partial.scale;
    if (partial.cx !== undefined) this.cx = partial.cx;
    if (partial.cy !== undefined) this.cy = partial.cy;
  }
}