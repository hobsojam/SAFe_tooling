import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDemoMode } from '../../hooks/useDemoMode';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockFetchWith(body: unknown) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(body),
  } as Response);
}

function mockFetchRejecting(error: unknown = new TypeError('fetch failed')) {
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(error);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useDemoMode', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns false initially before the fetch resolves', () => {
    // Use a never-resolving promise so we can check the synchronous initial value
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useDemoMode());
    expect(result.current).toBe(false);
  });

  it('returns true when GET /api/health responds { demo: true }', async () => {
    mockFetchWith({ demo: true });
    const { result } = renderHook(() => useDemoMode());
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('returns false when GET /api/health responds { demo: false }', async () => {
    mockFetchWith({ demo: false });
    const { result } = renderHook(() => useDemoMode());
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(result.current).toBe(false);
  });

  it('returns false when GET /api/health responds without a demo field', async () => {
    mockFetchWith({ status: 'ok' });
    const { result } = renderHook(() => useDemoMode());
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(result.current).toBe(false);
  });

  it('returns false (default) when fetch throws a network error', async () => {
    mockFetchRejecting(new TypeError('Failed to fetch'));
    const { result } = renderHook(() => useDemoMode());
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(result.current).toBe(false);
  });

  it('returns false when fetch rejects with a generic error', async () => {
    mockFetchRejecting(new Error('some network issue'));
    const { result } = renderHook(() => useDemoMode());
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(result.current).toBe(false);
  });

  it('calls GET /api/health on mount', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ demo: false }),
    } as Response);
    renderHook(() => useDemoMode());
    await waitFor(() => expect(spy).toHaveBeenCalled());
    expect(spy).toHaveBeenCalledWith('/api/health');
  });

  it('only calls setDemo with true when demo field is strictly true (not truthy)', async () => {
    // demo: 1 is truthy but not === true — should remain false
    mockFetchWith({ demo: 1 });
    const { result } = renderHook(() => useDemoMode());
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(result.current).toBe(false);
  });
});
