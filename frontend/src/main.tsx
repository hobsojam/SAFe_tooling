import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { BackendUnavailable } from './components/BackendUnavailable.tsx';
import './index.css';

function isBackendUnavailable(error: unknown): boolean {
  if (error instanceof TypeError) return true; // network / CORS / fetch failed
  if (error instanceof Error) return /^50[234]:/.test(error.message); // 502, 503, 504
  return false;
}

function Root() {
  const [backendDown, setBackendDown] = useState(false);

  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: (error) => {
            if (isBackendUnavailable(error)) setBackendDown(true);
          },
        }),
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
          },
        },
      }),
  );

  function handleRetry() {
    setBackendDown(false);
    void queryClient.resetQueries();
  }

  if (backendDown) return <BackendUnavailable onRetry={handleRetry} />;

  return (
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
