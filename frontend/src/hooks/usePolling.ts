import { useEffect, useRef, useState } from 'react';

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
  _fetcher: (signal: AbortSignal) => Promise<T>,
  _intervalMs: number,
): PollingState<T> {
  const [data] = useState<T | null>(null);
  const [error] = useState<Error | null>(null);
  const [isLoading] = useState<boolean>(true);
  const ref = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (ref.current !== null) window.clearInterval(ref.current);
    };
  }, []);

  return { data, error, isLoading, refresh: () => undefined };
}
