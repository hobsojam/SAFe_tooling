import { useEffect } from 'react';

// Render free tier spins down after 15 minutes of inactivity. Ping every 9
// minutes so the backend stays alive as long as a browser tab is open.
//
// We ping the backend's public URL directly (not via the nginx proxy) because
// Render only wakes a sleeping service when its public URL is hit — proxy
// requests routed through another Render service don't trigger the wake-up.
//
// Set VITE_API_DIRECT_URL=https://<backend>.onrender.com in the Render
// frontend env vars. Omit it in local dev (backend is always up locally).
//
// mode: 'no-cors' lets the browser send the request without needing CORS
// headers on the backend — we only care that the request reaches Render,
// not that we can read the response.
const DIRECT_URL = (import.meta.env.VITE_API_DIRECT_URL as string | undefined)?.replace(/\/$/, '');
const INTERVAL_MS = 9 * 60 * 1000;

export function useBackendHeartbeat(): void {
  useEffect(() => {
    if (!DIRECT_URL) return;
    const ping = () => void fetch(`${DIRECT_URL}/health`, { mode: 'no-cors' }).catch(() => {});
    ping();
    const id = setInterval(ping, INTERVAL_MS);
    return () => clearInterval(id);
  }, []);
}
