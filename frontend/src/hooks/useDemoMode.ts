import { useEffect, useState } from 'react';

interface HealthResponse {
  demo?: boolean;
}

/**
 * Returns `true` when the backend reports `{ demo: true }` from `GET /api/health`.
 * Defaults to `false` until the fetch resolves, and stays `false` on any error.
 */
export function useDemoMode(): boolean {
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/health')
      .then((res) => res.json() as Promise<HealthResponse>)
      .then((body) => {
        if (!cancelled) setDemo(body.demo === true);
      })
      .catch(() => {
        /* stay false */
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return demo;
}
