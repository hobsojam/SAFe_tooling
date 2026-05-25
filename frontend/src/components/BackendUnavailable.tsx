import { useEffect, useState } from 'react';

interface Props {
  onRetry: () => void;
}

const AUTO_RETRY_SECONDS = 15;

export function BackendUnavailable({ onRetry }: Readonly<Props>) {
  const [countdown, setCountdown] = useState(AUTO_RETRY_SECONDS);

  useEffect(() => {
    if (countdown <= 0) {
      onRetry();
      return;
    }
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [countdown, onRetry]);

  function retryNow() {
    setCountdown(AUTO_RETRY_SECONDS);
    onRetry();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center max-w-md px-6">
        <h1 className="text-2xl font-semibold text-slate-800 mb-3">
          Backend is starting up…
        </h1>
        <p className="text-slate-500 mb-2">
          The server was sleeping and is waking up. This takes about 30 seconds
          on the free tier.
        </p>
        <p className="text-slate-400 text-sm mb-6">
          Retrying automatically in {countdown}s…
        </p>
        <button
          onClick={retryNow}
          className="px-4 py-2 bg-slate-800 text-white rounded-md hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
        >
          Retry now
        </button>
      </div>
    </div>
  );
}
