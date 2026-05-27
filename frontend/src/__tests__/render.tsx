import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderOptions, type RenderResult } from "@testing-library/react";
import { type ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "../components/Toaster";

interface ProviderOptions extends Omit<RenderOptions, "wrapper"> {
  initialRoute?: string;
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

/**
 * Renders `ui` inside QueryClientProvider + ToastProvider + MemoryRouter.
 *
 * Use for tests that exercise real providers instead of mocking the hooks.
 * For tests that vi.mock('@tanstack/react-query') or 'react-router-dom',
 * plain `render` from @testing-library/react is fine.
 */
export function renderWithProviders(
  ui: ReactElement,
  { initialRoute = "/", ...renderOptions }: ProviderOptions = {}
): RenderResult {
  const queryClient = makeQueryClient();

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter initialEntries={[initialRoute]}>{children}</MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}
