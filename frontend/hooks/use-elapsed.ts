"use client";

import { useEffect, useRef, useState } from "react";

export function useElapsed(running: boolean) {
  const [elapsedMs, setElapsedMs] = useState(0);
  const startedAt = useRef<number>(0);

  useEffect(() => {
    if (!running) {
      startedAt.current = 0;
      return;
    }

    startedAt.current = performance.now();
    const reset = window.setTimeout(() => setElapsedMs(0), 0);
    const timer = window.setInterval(() => {
      if (startedAt.current > 0) {
        setElapsedMs(performance.now() - startedAt.current);
      }
    }, 100);

    return () => {
      window.clearTimeout(reset);
      window.clearInterval(timer);
      startedAt.current = 0;
    };
  }, [running]);

  return running ? elapsedMs : 0;
}
