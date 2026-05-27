/**
 * Focused tests for api/index.ts error-path helpers:
 *   extractErrorMessage, logAndThrow, onNetworkError
 *
 * These helpers are not exported; they are exercised indirectly through the
 * public api.* methods.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api/index";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function respondWith(status: number, statusText: string, body?: unknown) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    statusText,
    json:
      body !== undefined
        ? () => Promise.resolve(body)
        : () => Promise.reject(new Error("not JSON")),
  });
}

function respondOk(data: unknown = null) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve(data),
  });
}

let warnSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  mockFetch.mockReset();
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
  errorSpy.mockRestore();
});

// ---------------------------------------------------------------------------
// extractErrorMessage
// ---------------------------------------------------------------------------

describe("extractErrorMessage — detail as string", () => {
  it("returns the detail string verbatim", async () => {
    respondWith(404, "Not Found", { detail: "PI not found" });
    await expect(api.listPIs()).rejects.toThrow("PI not found");
  });

  it("returns a multi-word detail string without modification", async () => {
    respondWith(409, "Conflict", { detail: "PI is already active" });
    await expect(api.listPIs()).rejects.toThrow("PI is already active");
  });
});

describe("extractErrorMessage — detail as array of validation objects", () => {
  it('formats a single validation error as "field: msg"', async () => {
    respondWith(422, "Unprocessable Entity", {
      detail: [{ loc: ["body", "name"], msg: "Field required", type: "missing" }],
    });
    await expect(api.listPIs()).rejects.toThrow("name: Field required");
  });

  it('joins multiple validation errors with "; "', async () => {
    respondWith(422, "Unprocessable Entity", {
      detail: [
        { loc: ["body", "name"], msg: "Field required", type: "missing" },
        { loc: ["body", "job_size"], msg: "Must be <= 13", type: "less_than_equal" },
      ],
    });
    await expect(api.listPIs()).rejects.toThrow("name: Field required; job_size: Must be <= 13");
  });

  it('strips the "body" segment from the loc path', async () => {
    respondWith(422, "Unprocessable Entity", {
      detail: [{ loc: ["body", "start_date"], msg: "Invalid date", type: "value_error" }],
    });
    await expect(api.listPIs()).rejects.toThrow("start_date: Invalid date");
  });

  it('handles a nested loc path by joining remaining segments with "."', async () => {
    respondWith(422, "Unprocessable Entity", {
      detail: [{ loc: ["body", "address", "city"], msg: "Required", type: "missing" }],
    });
    await expect(api.listPIs()).rejects.toThrow("address.city: Required");
  });

  it("emits the msg alone when loc is absent", async () => {
    respondWith(422, "Unprocessable Entity", {
      detail: [{ msg: "Value error" }],
    });
    await expect(api.listPIs()).rejects.toThrow("Value error");
  });
});

describe("extractErrorMessage — non-JSON body", () => {
  it('returns "status: statusText" when the body is not valid JSON', async () => {
    respondWith(500, "Internal Server Error");
    await expect(api.listPIs()).rejects.toThrow("500: Internal Server Error");
  });

  it('returns "status: statusText" for a 502 with no parseable body', async () => {
    respondWith(502, "Bad Gateway");
    await expect(api.listPIs()).rejects.toThrow("502: Bad Gateway");
  });
});

// ---------------------------------------------------------------------------
// logAndThrow
// ---------------------------------------------------------------------------

describe("logAndThrow — 5xx responses", () => {
  it("calls logger.error (console.error) for a 500 response", async () => {
    respondWith(500, "Internal Server Error");
    await expect(api.listPIs()).rejects.toThrow();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("→ 500"), expect.any(String));
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("calls logger.error for a 503 response", async () => {
    respondWith(503, "Service Unavailable", { detail: "overloaded" });
    await expect(api.listPIs()).rejects.toThrow("overloaded");
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("→ 503"), expect.any(String));
  });

  it("throws the extracted error message", async () => {
    respondWith(500, "Internal Server Error", { detail: "DB connection failed" });
    await expect(api.listPIs()).rejects.toThrow("DB connection failed");
  });
});

describe("logAndThrow — 4xx responses", () => {
  it("calls logger.warn (console.warn) for a 404 response", async () => {
    respondWith(404, "Not Found", { detail: "not found" });
    await expect(api.listPIs()).rejects.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("→ 404"), expect.any(String));
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("calls logger.warn for a 422 response", async () => {
    respondWith(422, "Unprocessable Entity", { detail: "bad input" });
    await expect(api.listPIs()).rejects.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("→ 422"), expect.any(String));
  });

  it("includes method and path in the log message", async () => {
    respondWith(404, "Not Found", { detail: "nope" });
    await expect(api.deleteRisk("r1")).rejects.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("DELETE /api/risks/r1"),
      expect.any(String)
    );
  });
});

// ---------------------------------------------------------------------------
// onNetworkError
// ---------------------------------------------------------------------------

describe("onNetworkError", () => {
  it("re-throws the original TypeError on a GET network failure", async () => {
    const networkErr = new TypeError("Failed to fetch");
    mockFetch.mockRejectedValueOnce(networkErr);
    await expect(api.listPIs()).rejects.toThrow("Failed to fetch");
  });

  it("calls logger.error (console.error) on a POST network failure", async () => {
    mockFetch.mockRejectedValueOnce(new TypeError("Network error"));
    await expect(api.createRisk({ description: "R", pi_id: "pi1" })).rejects.toThrow();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("network error"),
      expect.any(TypeError)
    );
  });

  it("includes method and path in the network-error log message", async () => {
    mockFetch.mockRejectedValueOnce(new TypeError("fetch failed"));
    await expect(api.deleteRisk("r1")).rejects.toThrow();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("DELETE /api/risks/r1"),
      expect.any(TypeError)
    );
  });

  it("re-throws the exact error object, not a new one", async () => {
    const original = new TypeError("fetch failed");
    mockFetch.mockRejectedValueOnce(original);
    await expect(api.listPIs()).rejects.toBe(original);
  });
});

// ---------------------------------------------------------------------------
// End-to-end: GET + POST error propagation
// ---------------------------------------------------------------------------

describe("GET propagates non-ok response via logAndThrow", () => {
  it("throws for a 404 on any GET method", async () => {
    respondWith(404, "Not Found", { detail: "team not found" });
    await expect(api.listTeams()).rejects.toThrow("team not found");
  });

  it("returns parsed data for a 200 ok response", async () => {
    respondOk([{ id: "1", name: "Alpha", member_count: 5, art_id: "a", topology_type: null }]);
    const teams = await api.listTeams();
    expect(teams).toHaveLength(1);
    expect(teams[0].name).toBe("Alpha");
  });
});

describe("POST propagates non-ok response via logAndThrow", () => {
  it("throws for a 422 on createRisk", async () => {
    respondWith(422, "Unprocessable Entity", {
      detail: [{ loc: ["body", "description"], msg: "Field required", type: "missing" }],
    });
    await expect(api.createRisk({ description: "", pi_id: "pi1" })).rejects.toThrow(
      "description: Field required"
    );
  });
});
