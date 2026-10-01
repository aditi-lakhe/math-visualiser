import { useEffect, useRef } from "react";

export function useAnimationFrame(
  cb: (dtSeconds: number) => void,
  running = true,
  maxDtSeconds = 0.1
): void {
  const cbRef = useRef(cb);

  useEffect(() => {
    cbRef.current = cb;
  });

  useEffect(() => {
    if (!running) return;

    let id = 0;
    let last = performance.now();

    const loop = (now: number) => {
      const dtRaw = (now - last) / 1000;
      const dtClamped = Math.min(Math.max(0, dtRaw), maxDtSeconds);
      last = now;

      cbRef.current(dtClamped);
      id = requestAnimationFrame(loop);
    };

    id = requestAnimationFrame(loop);

    return () => {
      if (id) cancelAnimationFrame(id);
    };
  }, [running, maxDtSeconds]);
}