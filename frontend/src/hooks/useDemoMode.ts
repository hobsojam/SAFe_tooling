import { useEffect, useState } from 'react';

export function useDemoMode(): boolean {
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((data: { demo?: boolean }) => setIsDemo(data.demo ?? false))
      .catch(() => {});
  }, []);

  return isDemo;
}
