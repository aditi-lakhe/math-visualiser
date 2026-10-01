import React, { useState, useRef, useEffect, useCallback } from "react";
import { CanvasContainer } from "../../components/CanvasContainer";
import { Viewport } from "../../utils/viewport";
import { drawGrid, drawAxes } from "../../utils/drawHelpers";
import type { Point2D, Epicycle } from "./engine/types";
import { epicycleChain, errorCurve } from "./engine/epicycles"; // Removed unused `tipAt`
import { PRESETS } from "./engine/presets";
import { parseSvgPath } from "./ui/svgPath";
import "./FourierEpicycles.css";
import { dft, fft, sortByAmplitude } from "./engine/dft";
import { resampleClosedPath } from "./engine/resample";

export function FourierEpicycles(): React.ReactElement {
  // Config & state
  const [mode, setMode] = useState<"view" | "draw">("view");
  const [preset, setPreset] = useState<string>("Heart");
  const [resolutionN, setResolutionN] = useState<number>(256);
  const [circleCount, setCircleCount] = useState<number>(30);
  const [period, setPeriod] = useState<number>(10);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);

  // Toggles
  const [showCircles, setShowCircles] = useState<boolean>(true);
  const [showVectors, setShowVectors] = useState<boolean>(true);
  const [showOriginal, setShowOriginal] = useState<boolean>(true);
  const [showTrail, setShowTrail] = useState<boolean>(true);
  const [trailLengthPct, setTrailLengthPct] = useState<number>(100);

  // Status & Inputs
  const [svgInput, setSvgInput] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Non-React Mutable Animation State
  const samplesRef = useRef<Point2D[]>([]);
  const termsRef = useRef<Epicycle[]>([]);
  const errorsRef = useRef<number[]>([]);
  const timeRef = useRef<number>(0);

  // Drawing state
  const isDrawingRef = useRef<boolean>(false);
  const userStrokeRef = useRef<Point2D[]>([]);

  // Ring Buffer Trail
  const TRAIL_MAX = 2048;
  const trailBufferRef = useRef<Float64Array>(new Float64Array(TRAIL_MAX * 2));
  const trailHeadRef = useRef<number>(0);
  const trailSizeRef = useRef<number>(0);

  // Canvas context ref for chart rendering
  const chartCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Clear trail ring buffer
  const clearTrail = useCallback(() => {
    trailHeadRef.current = 0;
    trailSizeRef.current = 0;
  }, []);

  // Process sample points to compute DFT
  const processSamples = useCallback((rawSamples: Point2D[], N: number) => {
    const res = resampleClosedPath(rawSamples, N);
    if (!res.ok) {
      setErrorMessage(res.error);
      return;
    }
    setErrorMessage(null);

    const samples = res.samples;
    const computedTerms = N >= 512 && (N & (N - 1)) === 0 ? fft(samples) : dft(samples);
    const sortedTerms = sortByAmplitude(computedTerms);
    const errCurve = errorCurve(samples, sortedTerms);

    samplesRef.current = samples;
    termsRef.current = sortedTerms;
    errorsRef.current = errCurve;

    setCircleCount((prev) => Math.min(prev, sortedTerms.length));
    clearTrail();
    timeRef.current = 0;
  }, [clearTrail]);

  // Load Preset
  useEffect(() => {
    if (PRESETS[preset]) {
      const raw = PRESETS[preset](resolutionN);
      processSamples(raw, resolutionN);
    }
  }, [preset, resolutionN, processSamples]);

  // Reduced motion support
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setIsPlaying(false);
    }
  }, []);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === "Space") {
        e.preventDefault();
        setIsPlaying((p) => !p);
      } else if (e.key === "[") {
        setCircleCount((c) => Math.max(1, c - 1));
      } else if (e.key === "]") {
        setCircleCount((c) => Math.min(termsRef.current.length, c + 1));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Render Error Chart
  useEffect(() => {
    const canvas = chartCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const errs = errorsRef.current;
    if (errs.length === 0) return;

    const maxErr = errs[0] || 1;
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;

    ctx.beginPath();
    for (let i = 0; i < errs.length; i++) {
      const x = (i / (errs.length - 1)) * w;
      const y = h - (errs[i] / maxErr) * (h - 8) - 4;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Highlight current count
    const countIdx = Math.min(circleCount - 1, errs.length - 1);
    if (countIdx >= 0) {
      const cx = (countIdx / (errs.length - 1)) * w;
      const cy = h - (errs[countIdx] / maxErr) * (h - 8) - 4;

      ctx.fillStyle = "#00e5ff";
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [circleCount, circleCount]);

  // Animation Loop / Draw Callback
  const handleDrawCanvas = useCallback(
    (ctx: CanvasRenderingContext2D, vp: Viewport, dt: number) => {
      drawGrid(ctx, vp);
      drawAxes(ctx, vp);

      const terms = termsRef.current;
      const samples = samplesRef.current;

      // Render User Live Drawing
      if (mode === "draw" && userStrokeRef.current.length > 1) {
        ctx.strokeStyle = "#00e5ff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < userStrokeRef.current.length; i++) {
          const [sx, sy] = vp.toScreen(
            userStrokeRef.current[i][0],
            userStrokeRef.current[i][1]
          );
          if (i === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        }
        ctx.stroke();
        return;
      }

      if (terms.length === 0) return;

      // Advance Time
      if (isPlaying && mode === "view") {
        timeRef.current = (timeRef.current + dt * (1 / period)) % 1;
      }
      const t = timeRef.current;

      // Show faint original shape
      if (showOriginal && samples.length > 0) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < samples.length; i++) {
          const [sx, sy] = vp.toScreen(samples[i][0], samples[i][1]);
          if (i === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        }
        ctx.closePath();
        ctx.stroke();
      }

      // Compute Epicycle Chain
      const activeCount = Math.min(circleCount, terms.length);
      const chain = epicycleChain(terms, t, activeCount);

      // Render Epicycles
      for (let i = 0; i < activeCount; i++) {
        const center = chain[i];
        const nextPt = chain[i + 1];
        const amp = terms[i].amp;

        const [cx, cy] = vp.toScreen(center[0], center[1]);
        const [nx, ny] = vp.toScreen(nextPt[0], nextPt[1]);
        const radiusPx = amp * vp.scale;

        // Draw Circle
        if (showCircles && radiusPx >= 0.5) {
          ctx.strokeStyle = "rgba(179, 136, 255, 0.25)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(cx, cy, radiusPx, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Draw Vector Radius
        if (showVectors && radiusPx >= 1) {
          ctx.strokeStyle = "rgba(255, 96, 144, 0.6)";
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(nx, ny);
          ctx.stroke();
        }
      }

      // Add Tip to Trail Ring Buffer
      const tip = chain[chain.length - 1];
      if (mode === "view" && isPlaying) {
        const head = trailHeadRef.current;
        trailBufferRef.current[head * 2] = tip[0];
        trailBufferRef.current[head * 2 + 1] = tip[1];

        trailHeadRef.current = (head + 1) % TRAIL_MAX;
        if (trailSizeRef.current < TRAIL_MAX) {
          trailSizeRef.current++;
        }
      }

      // Render Trail
      if (showTrail && trailSizeRef.current > 1) {
        const size = trailSizeRef.current;
        const visibleMax = Math.floor(size * (trailLengthPct / 100));
        const head = trailHeadRef.current;

        ctx.lineWidth = 2.5;
        for (let i = 0; i < visibleMax - 1; i++) {
          const idx1 = (head - 1 - i + TRAIL_MAX) % TRAIL_MAX;
          const idx2 = (head - 2 - i + TRAIL_MAX) % TRAIL_MAX;

          const x1 = trailBufferRef.current[idx1 * 2];
          const y1 = trailBufferRef.current[idx1 * 2 + 1];
          const x2 = trailBufferRef.current[idx2 * 2];
          const y2 = trailBufferRef.current[idx2 * 2 + 1];

          const [sx1, sy1] = vp.toScreen(x1, y1);
          const [sx2, sy2] = vp.toScreen(x2, y2);

          const alpha = (1 - i / visibleMax) * 0.95;
          ctx.strokeStyle = `rgba(0, 229, 255, ${alpha.toFixed(2)})`;
          ctx.beginPath();
          ctx.moveTo(sx1, sy1);
          ctx.lineTo(sx2, sy2);
          ctx.stroke();
        }
      }

      // Draw active tip glow
      const [tipSx, tipSy] = vp.toScreen(tip[0], tip[1]);
      ctx.fillStyle = "#00e5ff";
      ctx.beginPath();
      ctx.arc(tipSx, tipSy, 4, 0, Math.PI * 2);
      ctx.fill();
    },
    [
      mode,
      isPlaying,
      period,
      circleCount,
      showOriginal,
      showCircles,
      showVectors,
      showTrail,
      trailLengthPct,
    ]
  );

  // Pointer Handlers for Draw Mode
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>, vp: Viewport) => {
    if (mode !== "draw") return;
    isDrawingRef.current = true;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const mathPt = vp.toMath(px, py);
    userStrokeRef.current = [mathPt];
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>, vp: Viewport) => {
    if (mode !== "draw" || !isDrawingRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const mathPt = vp.toMath(px, py);
    userStrokeRef.current.push(mathPt);
  };

  const handlePointerUp = () => {
    if (mode !== "draw" || !isDrawingRef.current) return;
    isDrawingRef.current = false;

    if (userStrokeRef.current.length > 2) {
      processSamples(userStrokeRef.current, resolutionN);
      setMode("view");
    }
    userStrokeRef.current = [];
  };

  // SVG Handler
  const handleApplySvg = () => {
    const res = parseSvgPath(svgInput, resolutionN);
    if (!res.ok) {
      setErrorMessage(res.error);
    } else {
      processSamples(res.samples, resolutionN);
    }
  };

  // JSON Export/Import
  const handleExportJSON = () => {
    const data = {
      N: resolutionN,
      samples: samplesRef.current,
      terms: termsRef.current,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fourier_epicycles_N${resolutionN}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target?.result as string);
        if (Array.isArray(parsed.samples) && parsed.samples.length > 0) {
          const N = parsed.N || parsed.samples.length;
          setResolutionN(N);
          processSamples(parsed.samples, N);
        }
      } catch {
        setErrorMessage("Invalid JSON data format.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fourier-container">
      <div className="main-canvas-wrapper">
        <CanvasContainer
          mode="continuous"
          interactive={mode === "view"}
          draw={handleDrawCanvas}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        />

        {errorMessage && <div className="error-toast">{errorMessage}</div>}
      </div>

      <div className="controls-sidebar">
        <h3>Fourier Epicycles</h3>

        <div className="mode-toggle">
          <button
            className={mode === "view" ? "active" : ""}
            onClick={() => setMode("view")}
          >
            View Mode
          </button>
          <button
            className={mode === "draw" ? "active" : ""}
            onClick={() => {
              setMode("draw");
              setErrorMessage(null);
            }}
          >
            Draw Mode
          </button>
        </div>

        <div className="control-group">
          <label>
            Circles: <strong>{circleCount}</strong> / {termsRef.current.length}
          </label>
          <input
            type="range"
            min={1}
            max={Math.max(1, termsRef.current.length)}
            value={circleCount}
            onChange={(e) => {
              setCircleCount(Number(e.target.value));
              clearTrail();
            }}
          />
        </div>

        <div className="control-group">
          <label>
            Period: <strong>{period}s</strong>
          </label>
          <input
            type="range"
            min={2}
            max={30}
            value={period}
            onChange={(e) => setPeriod(Number(e.target.value))}
          />
        </div>

        <div className="button-row">
          <button onClick={() => setIsPlaying((p) => !p)}>
            {isPlaying ? "Pause" : "Play"}
          </button>
          <button
            onClick={() => {
              timeRef.current = 0;
              clearTrail();
            }}
          >
            Restart
          </button>
          <button onClick={clearTrail}>Clear Trail</button>
        </div>

        <hr />

        <div className="control-group">
          <label>Preset Shape</label>
          <select value={preset} onChange={(e) => setPreset(e.target.value)}>
            {Object.keys(PRESETS).map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <div className="control-group">
          <label>Resolution (N)</label>
          <select
            value={resolutionN}
            onChange={(e) => setResolutionN(Number(e.target.value))}
          >
            <option value={64}>64</option>
            <option value={128}>128</option>
            <option value={256}>256</option>
            <option value={512}>512</option>
          </select>
        </div>

        <div className="toggle-grid">
          <label>
            <input
              type="checkbox"
              checked={showCircles}
              onChange={(e) => setShowCircles(e.target.checked)}
            />
            Circles
          </label>
          <label>
            <input
              type="checkbox"
              checked={showVectors}
              onChange={(e) => setShowVectors(e.target.checked)}
            />
            Vectors
          </label>
          <label>
            <input
              type="checkbox"
              checked={showOriginal}
              onChange={(e) => setShowOriginal(e.target.checked)}
            />
            Shape
          </label>
          <label>
            <input
              type="checkbox"
              checked={showTrail}
              onChange={(e) => setShowTrail(e.target.checked)}
            />
            Trail
          </label>
        </div>

        {showTrail && (
          <div className="control-group">
            <label>Trail Length: {trailLengthPct}%</label>
            <input
              type="range"
              min={10}
              max={100}
              value={trailLengthPct}
              onChange={(e) => setTrailLengthPct(Number(e.target.value))}
            />
          </div>
        )}

        <hr />

        <div className="control-group">
          <label>SVG Path String</label>
          <div className="input-with-button">
            <input
              type="text"
              placeholder="M 10 80 C 40 10..."
              value={svgInput}
              onChange={(e) => setSvgInput(e.target.value)}
            />
            <button onClick={handleApplySvg}>Apply</button>
          </div>
        </div>

        <div className="button-row">
          <button onClick={handleExportJSON}>Export JSON</button>
          <label className="file-input-button">
            Import JSON
            <input type="file" accept=".json" onChange={handleImportJSON} />
          </label>
        </div>

        <hr />

        <div className="chart-section">
          <label>RMS Error vs Circle Count</label>
          <canvas ref={chartCanvasRef} width={220} height={60} className="error-chart" />
        </div>

        <div className="table-section">
          <label>Top Terms (Frequency Spectrum)</label>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Freq</th>
                  <th>Amp</th>
                  <th>Phase (°)</th>
                </tr>
              </thead>
              <tbody>
                {termsRef.current.slice(0, 10).map((t, idx) => (
                  <tr key={idx}>
                    <td>{t.freq}</td>
                    <td>{t.amp.toFixed(4)}</td>
                    <td>{((t.phase * 180) / Math.PI).toFixed(1)}°</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FourierEpicycles;