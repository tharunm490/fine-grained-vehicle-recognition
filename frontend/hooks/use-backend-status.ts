"use client";

import { useCallback, useEffect, useState } from "react";
import { api, getErrorMessage } from "@/lib/api";
import type { HealthResponse } from "@/lib/types";

export type BackendConnection = "checking" | "online" | "offline";

export function useBackendStatus(pollMs = 30000) {
  const [connection, setConnection] = useState<BackendConnection>("checking");
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const check = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await api.health(signal);
      setHealth(response);
      setConnection("online");
      setError(null);
    } catch (requestError) {
      if (signal?.aborted) return;
      setConnection("offline");
      setError(getErrorMessage(requestError));
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    const run = async () => {
      await check(controller.signal);
      if (!cancelled) {
        timer = setTimeout(run, pollMs);
      }
    };

    void run();

    return () => {
      cancelled = true;
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [check, pollMs]);

  return { connection, health, error, refresh: check };
}
