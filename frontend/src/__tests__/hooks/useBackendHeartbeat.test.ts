import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

async function importHook() {
  vi.resetModules();
  return import("../../hooks/useBackendHeartbeat");
}

describe("useBackendHeartbeat", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("does not ping when VITE_API_DIRECT_URL is unset", async () => {
    vi.stubEnv("VITE_API_DIRECT_URL", "");
    const { useBackendHeartbeat } = await importHook();

    renderHook(() => useBackendHeartbeat());
    vi.advanceTimersByTime(9 * 60 * 1000);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("pings the direct backend health endpoint immediately", async () => {
    vi.stubEnv("VITE_API_DIRECT_URL", "https://api.example.com/");
    const { useBackendHeartbeat } = await importHook();

    renderHook(() => useBackendHeartbeat());

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith("https://api.example.com/health", {
      mode: "no-cors",
    });
  });

  it("repeats the ping every nine minutes while mounted", async () => {
    vi.stubEnv("VITE_API_DIRECT_URL", "https://api.example.com");
    const { useBackendHeartbeat } = await importHook();

    renderHook(() => useBackendHeartbeat());
    vi.advanceTimersByTime(9 * 60 * 1000);
    vi.advanceTimersByTime(9 * 60 * 1000);

    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it("clears the interval on unmount", async () => {
    vi.stubEnv("VITE_API_DIRECT_URL", "https://api.example.com");
    const { useBackendHeartbeat } = await importHook();

    const { unmount } = renderHook(() => useBackendHeartbeat());
    unmount();
    vi.advanceTimersByTime(9 * 60 * 1000);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("ignores failed heartbeat requests", async () => {
    fetchSpy.mockRejectedValueOnce(new Error("offline"));
    vi.stubEnv("VITE_API_DIRECT_URL", "https://api.example.com");
    const { useBackendHeartbeat } = await importHook();

    expect(() => renderHook(() => useBackendHeartbeat())).not.toThrow();
    await Promise.resolve();

    expect(fetchSpy).toHaveBeenCalled();
  });
});
