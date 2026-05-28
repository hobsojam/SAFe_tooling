import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { BackendUnavailable } from "./components/BackendUnavailable.tsx";
import { isBackendUnavailable } from "./utils/backendHealth.ts";
import "./index.css";

export function Root() {
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
      })
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

const container = document.getElementById("root");
if (container) {
  createRoot(container).render(
    <StrictMode>
      <Root />
    </StrictMode>
  );
}
