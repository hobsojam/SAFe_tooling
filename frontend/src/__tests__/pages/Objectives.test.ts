import { describe, expect, it } from 'vitest';
import { objectiveTypeBadgeClass, predictabilityClass } from '../../pages/Objectives';

describe('predictabilityClass', () => {
  it('returns green for pct >= 80', () => {
    expect(predictabilityClass(80)).toBe('font-bold text-green-700');
    expect(predictabilityClass(100)).toBe('font-bold text-green-700');
    expect(predictabilityClass(95)).toBe('font-bold text-green-700');
  });

  it('returns amber for 60 <= pct < 80', () => {
    expect(predictabilityClass(60)).toBe('font-bold text-amber-600');
    expect(predictabilityClass(79)).toBe('font-bold text-amber-600');
    expect(predictabilityClass(70)).toBe('font-bold text-amber-600');
  });

  it('returns red for pct < 60', () => {
    expect(predictabilityClass(59)).toBe('font-bold text-red-600');
    expect(predictabilityClass(0)).toBe('font-bold text-red-600');
    expect(predictabilityClass(30)).toBe('font-bold text-red-600');
  });
});

describe('objectiveTypeBadgeClass', () => {
  it('returns stretch styling when isStretch is true', () => {
    const cls = objectiveTypeBadgeClass(true);
    expect(cls).toContain('bg-purple-100');
    expect(cls).toContain('text-purple-800');
  });

  it('returns committed styling when isStretch is false', () => {
    const cls = objectiveTypeBadgeClass(false);
    expect(cls).toContain('bg-blue-100');
    expect(cls).toContain('text-blue-800');
  });
});
