import React, { useRef, useEffect, useCallback } from "react";
import { Viewport } from "../utils/viewport"; // Value import (removed 'type')

export interface CanvasContainerProps {
  draw?: (ctx: CanvasRenderingContext2D, vp: Viewport, dt: number) => void;
  mode?: "continuous" | "onDemand";
  interactive?: boolean;
  onPointerDown?: (e: React.PointerEvent<HTMLCanvasElement>, vp: Viewport) => void;
  onPointerMove?: (e: React.PointerEvent<HTMLCanvasElement>, vp: Viewport) => void;
  onPointerUp?: (e: React.PointerEvent<HTMLCanvasElement>, vp: Viewport) => void;
}

export function CanvasContainer({
  draw,
  mode = "continuous",
  interactive = true,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: CanvasContainerProps): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const vpRef = useRef<Viewport>(new Viewport(window.innerWidth, window.innerHeight));
  const isDraggingRef = useRef(false);
  const lastMousePosRef = useRef<[number, number]>([0, 0]);
  const animFrameIdRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());

  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.parentElement ? canvas.parentElement.clientWidth : window.innerWidth;
    const height = canvas.parentElement ? canvas.parentElement.clientHeight : window.innerHeight;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    vpRef.current.set({ width, height });
  }, []);

  useEffect(() => {
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [handleResize]);

  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const now = performance.now();
    const dt = (now - lastTimeRef.current) / 1000;
    lastTimeRef.current = now;

    ctx.save();
    ctx.scale(dpr, dpr);

    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, 0, vpRef.current.width, vpRef.current.height);

    if (draw) {
      draw(ctx, vpRef.current, dt);
    }

    ctx.restore();

    if (mode === "continuous") {
      animFrameIdRef.current = requestAnimationFrame(renderFrame);
    }
  }, [draw, mode]);

  useEffect(() => {
    lastTimeRef.current = performance.now();
    if (mode === "continuous") {
      animFrameIdRef.current = requestAnimationFrame(renderFrame);
    } else {
      renderFrame();
    }

    return () => {
      if (animFrameIdRef.current !== null) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [mode, renderFrame]);

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if (!interactive) return;
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    vpRef.current.zoomAt(px, py, zoomFactor);

    if (mode === "onDemand") renderFrame();
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (onPointerDown) {
      onPointerDown(e, vpRef.current);
    }
    if (interactive && e.button === 0) {
      isDraggingRef.current = true;
      lastMousePosRef.current = [e.clientX, e.clientY];
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (onPointerMove) {
      onPointerMove(e, vpRef.current);
    }
    if (interactive && isDraggingRef.current) {
      const dx = e.clientX - lastMousePosRef.current[0];
      const dy = e.clientY - lastMousePosRef.current[1];
      lastMousePosRef.current = [e.clientX, e.clientY];

      vpRef.current.panBy(dx, dy);
      if (mode === "onDemand") renderFrame();
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (onPointerUp) {
      onPointerUp(e, vpRef.current);
    }
    if (interactive) {
      isDraggingRef.current = false;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Ignored if capture wasn't held
      }
    }
  };

  return (
    <canvas
      ref={canvasRef}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{
        display: "block",
        width: "100%",
        height: "100%",
        touchAction: "none",
        cursor: interactive ? "grab" : "crosshair",
      }}
    />
  );
}

export default CanvasContainer;