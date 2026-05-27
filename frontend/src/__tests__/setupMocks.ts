import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { vi } from "vitest";

type QueryData = Record<string, unknown>;
type QueryResolver = (opts: { queryKey: unknown[] }) => unknown;

interface MockOptions {
  isPending?: boolean;
  isError?: boolean;
  isLoading?: boolean;
}

/**
 * Configures the @tanstack/react-query mocks for a test.
 *
 * The vi.mock() declarations still belong in each test file — this helper
 * only sets the per-test implementations so you don't repeat the boilerplate.
 *
 * @param dataOrResolver
 *   Pass a plain object to map queryKey[0] → data:
 *     setupQueryMocks({ pi: mockPI, features: [] })
 *   Pass a function for cases where the same key is called with different
 *   queryKey lengths (e.g. ['stories'] vs ['stories', featureId]):
 *     setupQueryMocks(({ queryKey }) => {
 *       if (queryKey[0] === 'stories' && queryKey.length === 2) return featureStories;
 *       return dataMap[queryKey[0] as string];
 *     })
 *
 * @returns { mutate, invalidateQueries } — vi.fn() refs for assertion.
 */
export function setupQueryMocks(
  dataOrResolver: QueryData | QueryResolver,
  options: MockOptions = {}
): { mutate: ReturnType<typeof vi.fn>; invalidateQueries: ReturnType<typeof vi.fn> } {
  const mutate = vi.fn();
  const invalidateQueries = vi.fn();

  vi.mocked(useQueryClient).mockReturnValue({ invalidateQueries } as any);
  vi.mocked(useMutation).mockReturnValue({ mutate, isPending: options.isPending ?? false } as any);
  vi.mocked(useQuery).mockImplementation((opts: any) => {
    const queryKey = opts.queryKey as unknown[];
    const data =
      typeof dataOrResolver === "function"
        ? dataOrResolver({ queryKey })
        : dataOrResolver[queryKey[0] as string];
    return {
      data,
      isLoading: options.isLoading ?? false,
      isError: options.isError ?? false,
    } as any;
  });

  return { mutate, invalidateQueries };
}
