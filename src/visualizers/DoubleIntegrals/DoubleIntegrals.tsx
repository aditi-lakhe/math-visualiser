import { useMemo, useState } from "react";
import CanvasContainer from "../../components/CanvasContainer";
import { drawAxes, drawGrid } from "../../utils/drawHelpers";
import { computeQuadrature } from "./engine/quadrature";
import { computeRiemannSum } from "./engine/riemann";
import { validateRegion } from "./engine/region";
import { parseExpression } from "./engine/parse";
import type { Region } from "./engine/types";
import "./DoubleIntegrals.css";

const initialRegion: Region = {
  type: "polar",
  thetaMin: "0",
  thetaMax: "2*pi",
  r1: "0",
  r2: "1",
};

function createRegion(type: Region["type"]): Region {
  if (type === "rectangle") return { type, xMin: "-1", xMax: "1", yMin: "-1", yMax: "1" };
  if (type === "typeI") return { type, xMin: "-1", xMax: "1", g1: "-sqrt(1-x^2)", g2: "sqrt(1-x^2)" };
  if (type === "typeII") return { type, yMin: "-1", yMax: "1", h1: "-sqrt(1-y^2)", h2: "sqrt(1-y^2)" };
  return initialRegion;
}

export function DoubleIntegrals(): React.ReactElement {
  const [expression, setExpression] = useState("1");
  const [region, setRegion] = useState<Region>(initialRegion);
  const [resolution, setResolution] = useState(24);

  const calculation = useMemo(() => {
    const parsed = parseExpression(expression);
    if (!parsed.ok) return { error: parsed.message };

    const validation = validateRegion(region);
    if (!validation.valid) return { error: validation.errors[0] };

    const riemann = computeRiemannSum(parsed.fn, region, resolution, resolution, "midpoint");
    if (riemann.error) return { error: riemann.error };

    return {
      riemann,
      quadrature: computeQuadrature(parsed.fn, region),
      warnings: validation.warnings,
    };
  }, [expression, region, resolution]);

  const draw = useMemo(() => {
    const riemann = calculation.riemann;
    if (!riemann) return undefined;
    const { cells } = riemann;

    return (ctx: CanvasRenderingContext2D, vp: Parameters<typeof drawGrid>[1]) => {
      drawGrid(ctx, vp);
      drawAxes(ctx, vp);
      ctx.save();
      ctx.fillStyle = "rgba(0, 229, 255, 0.18)";
      ctx.strokeStyle = "rgba(0, 229, 255, 0.55)";
      ctx.lineWidth = 0.6;

      for (let i = 0; i < cells.count; i++) {
        if (region.type === "polar") {
          const start = cells.thetaMin[i];
          const end = cells.thetaMax[i];
          const rMin = cells.rMin[i];
          const rMax = cells.rMax[i];
          const segments = 4;
          ctx.beginPath();
          for (let step = 0; step <= segments; step++) {
            const theta = start + ((end - start) * step) / segments;
            const [x, y] = vp.toScreen(rMax * Math.cos(theta), rMax * Math.sin(theta));
            if (step === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          for (let step = segments; step >= 0; step--) {
            const theta = start + ((end - start) * step) / segments;
            const [x, y] = vp.toScreen(rMin * Math.cos(theta), rMin * Math.sin(theta));
            ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        } else {
          const [x1, y1] = vp.toScreen(cells.xMin[i], cells.yMin[i]);
          const [x2, y2] = vp.toScreen(cells.xMax[i], cells.yMax[i]);
          ctx.fillRect(x1, y2, x2 - x1, y1 - y2);
          ctx.strokeRect(x1, y2, x2 - x1, y1 - y2);
        }
      }
      ctx.restore();
    };
  }, [calculation, region.type]);

  const updateField = (key: string, value: string) => {
    setRegion((current) => ({ ...current, [key]: value } as Region));
  };

  const fields = region.type === "rectangle"
    ? [["xMin", "x min"], ["xMax", "x max"], ["yMin", "y min"], ["yMax", "y max"]]
    : region.type === "typeI"
      ? [["xMin", "x min"], ["xMax", "x max"], ["g1", "y lower (x)"], ["g2", "y upper (x)"]]
      : region.type === "typeII"
        ? [["yMin", "y min"], ["yMax", "y max"], ["h1", "x lower (y)"], ["h2", "x upper (y)"]]
        : [["thetaMin", "θ min"], ["thetaMax", "θ max"], ["r1", "r min (θ)"], ["r2", "r max (θ)"]];

  return (
    <main className="double-integrals-page">
      <section className="integral-controls">
        <p className="eyebrow">NUMERICAL CALCULUS</p>
        <h1>Double Integrals</h1>
        <p className="intro">Explore an integrand over a bounded region. Drag to pan the plot and scroll to zoom.</p>

        <label className="field-label" htmlFor="integrand">Integrand f(x, y)</label>
        <input id="integrand" className="math-input" value={expression} onChange={(event) => setExpression(event.target.value)} />

        <label className="field-label" htmlFor="region-type">Region type</label>
        <select id="region-type" className="math-input" value={region.type} onChange={(event) => setRegion(createRegion(event.target.value as Region["type"]))}>
          <option value="polar">Polar</option>
          <option value="rectangle">Rectangle</option>
          <option value="typeI">Type I: y bounds</option>
          <option value="typeII">Type II: x bounds</option>
        </select>

        <div className="bound-grid">
          {fields.map(([key, label]) => (
            <label key={key} className="bound-field">
              <span>{label}</span>
              <input className="math-input" value={(region as unknown as Record<string, string>)[key]} onChange={(event) => updateField(key, event.target.value)} />
            </label>
          ))}
        </div>

        <label className="field-label" htmlFor="resolution">Riemann grid: {resolution} × {resolution}</label>
        <input id="resolution" className="resolution-slider" type="range" min="8" max="50" value={resolution} onChange={(event) => setResolution(Number(event.target.value))} />

        {"error" in calculation ? (
          <div className="result error">{calculation.error}</div>
        ) : (
          <div className="result">
            <span>Numerical integral</span>
            <strong>{calculation.quadrature.value.toFixed(8)}</strong>
            <small>Riemann estimate: {calculation.riemann.sum.toFixed(8)}</small>
            {calculation.quadrature.hasSingularity && <small className="warning">Possible singularity detected.</small>}
          </div>
        )}
      </section>

      <section className="integral-plot" aria-label="Region plot">
        <div className="plot-caption">{region.type === "polar" ? "Polar cells" : "Cartesian cells"}</div>
        <CanvasContainer draw={draw} mode="onDemand" />
      </section>
    </main>
  );
}

export default DoubleIntegrals;
