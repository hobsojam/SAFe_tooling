import { useEffect } from 'react';

const INTERVAL_MS = 30_000;

/**
 * When `VITE_API_DIRECT_URL` is set, sends a periodic no-cors ping to
 * `${VITE_API_DIRECT_URL}/health` so the backend stays warm on platforms that
 * spin down idle instances (e.g. Render free tier).
 *
 * Does nothing when the env var is absent.
 */
export function useBackendHeartbeat(): void {
  useEffect(() => {
    const directUrl = import.meta.env.VITE_API_DIRECT_URL as string | undefined;
    if (!directUrl) return;

    const ping = () => {
      void fetch(`${directUrl}/health`, { mode: 'no-cors' });
    };

    ping();
    const id = setInterval(ping, INTERVAL_MS);
    return () => clearInterval(id);
  }, []);
}
