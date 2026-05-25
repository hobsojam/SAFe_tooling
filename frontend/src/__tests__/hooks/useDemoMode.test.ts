import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDemoMode } from '../../hooks/useDemoMode';

function mockFetchWith(body: unknown) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    json: () => Promise.resolve(body),
  } as Response);
}

function mockFetchRejecting(error: unknown = new TypeError('fetch failed')) {
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(error);
}

describe('useDemoMode', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns false before the health check resolves', () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useDemoMode());

    expect(result.current).toBe(false);
  });

  it('returns true when the health check reports demo mode', async () => {
    mockFetchWith({ demo: true });

    const { result } = renderHook(() => useDemoMode());

    await waitFor(() => expect(result.current).toBe(true));
  });

  it('keeps false when the health check reports demo false', async () => {
    mockFetchWith({ demo: false });

    const { result } = renderHook(() => useDemoMode());

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledWith('/api/health'));
    expect(result.current).toBe(false);
  });

  it('keeps false when the health response omits demo', async () => {
    mockFetchWith({ status: 'ok' });

    const { result } = renderHook(() => useDemoMode());

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(result.current).toBe(false);
  });

  it('only treats boolean true as demo mode', async () => {
    mockFetchWith({ demo: 1 });

    const { result } = renderHook(() => useDemoMode());

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(result.current).toBe(false);
  });

  it('keeps false when the health check fails', async () => {
    mockFetchRejecting();

    const { result } = renderHook(() => useDemoMode());

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(result.current).toBe(false);
  });

  it('ignores health responses after unmount', async () => {
    let resolveJson: (value: unknown) => void = () => {};
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: () =>
        new Promise((resolve) => {
          resolveJson = resolve;
        }),
    } as Response);

    const { result, unmount } = renderHook(() => useDemoMode());

    unmount();
    resolveJson({ demo: true });
    await Promise.resolve();

    expect(result.current).toBe(false);
  });
});
