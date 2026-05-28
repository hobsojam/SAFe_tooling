import { describe, expect, it } from "vitest";
import { loadPctClass, predictabilityClass } from "../../pages/PIHealth";

describe("predictabilityClass", () => {
  it("returns teal for pct >= 80", () => {
    expect(predictabilityClass(80)).toBe("text-teal-700");
    expect(predictabilityClass(100)).toBe("text-teal-700");
    expect(predictabilityClass(95)).toBe("text-teal-700");
  });

  it("returns amber for 60 <= pct < 80", () => {
    expect(predictabilityClass(60)).toBe("text-amber-600");
    expect(predictabilityClass(79)).toBe("text-amber-600");
  });

  it("returns red for pct < 60", () => {
    expect(predictabilityClass(59)).toBe("text-red-600");
    expect(predictabilityClass(0)).toBe("text-red-600");
  });
});

describe("loadPctClass", () => {
  it("returns red for pct > 100", () => {
    expect(loadPctClass(101)).toBe("text-red-600");
    expect(loadPctClass(150)).toBe("text-red-600");
  });

  it("returns blue for 70 <= pct <= 100", () => {
    expect(loadPctClass(70)).toBe("text-blue-700");
    expect(loadPctClass(100)).toBe("text-blue-700");
    expect(loadPctClass(85)).toBe("text-blue-700");
  });

  it("returns amber for pct < 70", () => {
    expect(loadPctClass(69)).toBe("text-amber-600");
    expect(loadPctClass(0)).toBe("text-amber-600");
  });
});
