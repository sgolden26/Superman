import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Polls `fetcher` at `intervalMs` until the component unmounts. Cancels
 * in-flight requests when a new one fires or on unmount.
 */
export interface PollingState<T> {
  data: T | null;
  error: Error | null;
  isLoading: boolean;
  refresh: () => void;
}

export function usePolling<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  intervalMs: number,
): PollingState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const inflightRef = useRef<AbortController | null>(null);
  const timerRef = useRef<number | null>(null);
  const mountedRef = useRef<boolean>(true);

  const run = useCallback(async () => {
    inflightRef.current?.abort();
    const controller = new AbortController();
    inflightRef.current = controller;
    setIsLoading(true);
    try {
      const next = await fetcherRef.current(controller.signal);
      if (!mountedRef.current || controller.signal.aborted) return;
      setData(next);
      setError(null);
    } catch (err) {
      if (!mountedRef.current || controller.signal.aborted) return;
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      if (mountedRef.current && !controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void run();
    timerRef.current = window.setInterval(() => {
      void run();
    }, intervalMs);
    return () => {
      mountedRef.current = false;
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
      inflightRef.current?.abort();
    };
  }, [intervalMs, run]);

  return { data, error, isLoading, refresh: () => void run() };
}
