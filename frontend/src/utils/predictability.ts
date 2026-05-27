import type { PIObjective } from "../types";

export interface PredictabilitySummary {
  plannedBV: number;
  actualBV: number;
  scoredCount: number;
  totalCount: number;
  pct: number | null;
}

export function buildPredictabilitySummary(objectives: PIObjective[]): PredictabilitySummary {
  const plannedBV = objectives.reduce(
    (sum, objective) => sum + objective.planned_business_value,
    0
  );
  const scoredObjectives = objectives.filter(
    (objective) => objective.actual_business_value !== null
  );
  const actualBV = scoredObjectives.reduce(
    (sum, objective) => sum + (objective.actual_business_value ?? 0),
    0
  );
  const pct =
    plannedBV > 0 && scoredObjectives.length > 0 ? Math.round((actualBV / plannedBV) * 100) : null;

  return {
    plannedBV,
    actualBV,
    scoredCount: scoredObjectives.length,
    totalCount: objectives.length,
    pct,
  };
}

export function predictabilityBadgeClass(pct: number): string {
  if (pct >= 80) return "bg-teal-100 text-teal-800";
  if (pct >= 60) return "bg-amber-100 text-amber-800";
  return "bg-red-100 text-red-800";
}

export function predictabilityTextClass(pct: number): string {
  if (pct >= 80) return "font-bold text-teal-700";
  if (pct >= 60) return "font-bold text-amber-600";
  return "font-bold text-red-600";
}
