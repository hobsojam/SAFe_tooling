import { useEffect, useState } from 'react';

interface HealthResponse {
  demo?: boolean;
}

export function useDemoMode(): boolean {
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/health')
      .then((response) => response.json() as Promise<HealthResponse>)
      .then((data) => {
        if (!cancelled) setIsDemo(data.demo === true);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  return isDemo;
}
