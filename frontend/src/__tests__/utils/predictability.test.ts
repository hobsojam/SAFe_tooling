import { describe, expect, it } from 'vitest';
import { makePIObjective } from '../factories';
import {
  buildPredictabilitySummary,
  predictabilityBadgeClass,
  predictabilityTextClass,
} from '../../utils/predictability';

describe('buildPredictabilitySummary', () => {
  it('sums planned and scored actual business value', () => {
    const summary = buildPredictabilitySummary([
      makePIObjective({ planned_business_value: 8, actual_business_value: 7 }),
      makePIObjective({ planned_business_value: 5, actual_business_value: null }),
    ]);

    expect(summary).toEqual({
      plannedBV: 13,
      actualBV: 7,
      scoredCount: 1,
      totalCount: 2,
      pct: 54,
    });
  });

  it('leaves pct empty when no objectives are scored', () => {
    const summary = buildPredictabilitySummary([
      makePIObjective({ planned_business_value: 8, actual_business_value: null }),
    ]);

    expect(summary.pct).toBeNull();
    expect(summary.scoredCount).toBe(0);
  });
});

describe('predictability classes', () => {
  it.each([
    [80, 'bg-teal-100 text-teal-800', 'font-bold text-teal-700'],
    [60, 'bg-amber-100 text-amber-800', 'font-bold text-amber-600'],
    [59, 'bg-red-100 text-red-800', 'font-bold text-red-600'],
  ])('maps %i to the expected badge and text classes', (pct, badgeClass, textClass) => {
    expect(predictabilityBadgeClass(pct)).toBe(badgeClass);
    expect(predictabilityTextClass(pct)).toBe(textClass);
  });
});
