interface Props {
  onRetry: () => void;
}

export function BackendUnavailable({ onRetry }: Readonly<Props>) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center max-w-md px-6">
        <h1 className="text-2xl font-semibold text-slate-800 mb-3">
          Down for maintenance
        </h1>
        <p className="text-slate-500 mb-6">
          The server is temporarily unavailable. This may be a cold start — please
          wait a moment and try again.
        </p>
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
