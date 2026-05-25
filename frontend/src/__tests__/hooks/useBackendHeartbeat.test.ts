import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useBackendHeartbeat } from '../../hooks/useBackendHeartbeat';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useBackendHeartbeat', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 200 }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  describe('when VITE_API_DIRECT_URL is not set (empty string)', () => {
    // vi.stubEnv sets the value; an empty string is falsy and treated as "not set"
    // by the hook (if (!directUrl) return).
    beforeEach(() => {
      vi.stubEnv('VITE_API_DIRECT_URL', '');
    });

    it('does not call fetch on mount', () => {
      renderHook(() => useBackendHeartbeat());
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('does not call fetch after the interval elapses', () => {
      renderHook(() => useBackendHeartbeat());
      vi.advanceTimersByTime(60_000);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('when VITE_API_DIRECT_URL is set', () => {
    const DIRECT_URL = 'https://api.example.com';

    beforeEach(() => {
      vi.stubEnv('VITE_API_DIRECT_URL', DIRECT_URL);
    });

    it('calls fetch immediately on mount with the correct URL and no-cors mode', () => {
      renderHook(() => useBackendHeartbeat());
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith(`${DIRECT_URL}/health`, { mode: 'no-cors' });
    });

    it('calls fetch again after 30 seconds', () => {
      renderHook(() => useBackendHeartbeat());
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(30_000);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('calls fetch multiple times as the interval repeats', () => {
      renderHook(() => useBackendHeartbeat());
      vi.advanceTimersByTime(90_000); // 3 x 30s intervals
      // 1 immediate + 3 interval fires
      expect(fetchSpy).toHaveBeenCalledTimes(4);
    });

    it('calls clearInterval on unmount', () => {
      const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');
      const { unmount } = renderHook(() => useBackendHeartbeat());
      unmount();
      expect(clearIntervalSpy).toHaveBeenCalled();
    });

    it('does not call fetch after unmount even when the interval would fire', () => {
      const { unmount } = renderHook(() => useBackendHeartbeat());
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      unmount();
      vi.advanceTimersByTime(30_000);
      // Still only the initial call — interval was cleared on unmount
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });
});
