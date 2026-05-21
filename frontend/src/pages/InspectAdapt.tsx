import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import type { PIObjective, Risk, Team, ROAMStatus } from '../types';
import { EmptyState } from '../components/EmptyState';
import { Spinner } from '../components/Spinner';

function predictabilityClass(pct: number): string {
  if (pct >= 80) return 'bg-teal-100 text-teal-800';
  if (pct >= 60) return 'bg-amber-100 text-amber-800';
  return 'bg-red-100 text-red-800';
}

const ROAM_ORDER: ROAMStatus[] = ['resolved', 'owned', 'accepted', 'mitigated', 'unroamed'];

const ROAM_LABELS: Record<ROAMStatus, string> = {
  resolved: 'Resolved',
  owned: 'Owned',
  accepted: 'Accepted',
  mitigated: 'Mitigated',
  unroamed: 'Unroamed',
};

const ROAM_CLASSES: Record<ROAMStatus, string> = {
  resolved: 'bg-teal-100 text-teal-800',
  owned: 'bg-blue-100 text-blue-800',
  accepted: 'bg-amber-100 text-amber-800',
  mitigated: 'bg-blue-100 text-blue-800',
  unroamed: 'bg-red-100 text-red-800',
};

function buildPredictability(committed: PIObjective[]) {
  const plannedBV = committed.reduce((s, o) => s + o.planned_business_value, 0);
  const scoredObjs = committed.filter((o) => o.actual_business_value !== null);
  const actualBV = scoredObjs.reduce((s, o) => s + (o.actual_business_value ?? 0), 0);
  const pct =
    plannedBV > 0 && scoredObjs.length > 0
      ? Math.round((actualBV / plannedBV) * 100)
      : null;
  return { plannedBV, actualBV, scoredCount: scoredObjs.length, totalCount: committed.length, pct };
}

function buildRoamCounts(risks: Risk[]): Record<ROAMStatus, number> {
  const counts = { resolved: 0, owned: 0, accepted: 0, mitigated: 0, unroamed: 0 };
  for (const r of risks) counts[r.roam_status]++;
  return counts;
}

function teamName(teams: Team[], teamId: string | null): string {
  if (!teamId) return '—';
  return teams.find((t) => t.id === teamId)?.name ?? '—';
}

export function InspectAdapt() {
  const { piId } = useParams<{ piId: string }>();

  const { data: pi } = useQuery({
    queryKey: ['pi', piId],
    queryFn: () => api.getPI(piId!),
    enabled: !!piId,
  });

  const { data: objectives = [], isLoading: loadingObj } = useQuery({
    queryKey: ['objectives', piId],
    queryFn: () => api.listObjectives(piId!),
    enabled: !!piId,
  });

  const { data: risks = [], isLoading: loadingRisks } = useQuery({
    queryKey: ['risks', piId],
    queryFn: () => api.listRisks(piId!),
    enabled: !!piId,
  });

  const { data: teams = [], isLoading: loadingTeams } = useQuery({
    queryKey: ['teams', pi?.art_id],
    queryFn: () => api.listTeamsByArt(pi!.art_id),
    enabled: !!pi?.art_id,
  });

  if (loadingObj || loadingRisks || loadingTeams) return <Spinner />;

  const committed = objectives.filter((o) => !o.is_stretch);
  const stretch = objectives.filter((o) => o.is_stretch);
  const pred = buildPredictability(committed);
  const roamCounts = buildRoamCounts(risks);

  const sortedObjectives = [...objectives].sort((a, b) => {
    if (a.is_stretch !== b.is_stretch) return a.is_stretch ? 1 : -1;
    return b.planned_business_value - a.planned_business_value;
  });

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="mb-1 text-xl font-semibold text-slate-800">
          Inspect &amp; Adapt — {pi?.name}
        </h1>
        <p className="text-sm text-slate-500">
          End-of-PI ceremony summary · Read-only
        </p>
      </div>

      {/* Predictability summary */}
      <section aria-labelledby="pred-heading">
        <h2 id="pred-heading" className="mb-3 text-base font-semibold text-slate-700">
          ART Predictability
        </h2>

        {committed.length === 0 ? (
          <EmptyState message="No committed objectives — add objectives on the Objectives page." />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Planned BV</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-slate-800">{pred.plannedBV}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Actual BV</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-slate-800">
                {pred.scoredCount > 0 ? pred.actualBV : <span className="text-slate-400">—</span>}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Objectives Scored</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-slate-800">
                {pred.scoredCount} / {pred.totalCount}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Predictability</p>
              <div className="mt-1">
                {pred.pct === null ? (
                  <span className="text-sm text-slate-400">Not yet scored</span>
                ) : (
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-lg font-bold ${predictabilityClass(pred.pct)}`}
                  >
                    {pred.pct}%
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {committed.length > 0 && stretch.length > 0 && (
          <p className="mt-2 text-xs text-slate-400">
            {stretch.length} stretch {stretch.length === 1 ? 'objective' : 'objectives'} excluded from predictability calculation.
          </p>
        )}
      </section>

      {/* PI Objectives */}
      <section aria-labelledby="obj-heading">
        <h2 id="obj-heading" className="mb-3 text-base font-semibold text-slate-700">
          PI Objectives
        </h2>

        {objectives.length === 0 ? (
          <EmptyState message="No objectives for this PI." />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  {['Objective', 'Team', 'Type', 'Planned BV', 'Actual BV'].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedObjectives.map((obj) => (
                  <tr key={obj.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 text-slate-800">{obj.description}</td>
                    <td className="px-4 py-3 text-slate-600">{teamName(teams, obj.team_id)}</td>
                    <td className="px-4 py-3">
                      {obj.is_stretch ? (
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                          Stretch
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-800">
                          Committed
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-700">
                      {obj.planned_business_value}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-700">
                      {obj.actual_business_value !== null ? (
                        obj.actual_business_value
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Risk ROAM breakdown */}
      <section aria-labelledby="roam-heading">
        <h2 id="roam-heading" className="mb-3 text-base font-semibold text-slate-700">
          Risk Disposition (ROAM)
        </h2>

        {risks.length === 0 ? (
          <EmptyState message="No risks recorded for this PI." />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              {ROAM_ORDER.map((status) => (
                <div
                  key={status}
                  className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ROAM_CLASSES[status]}`}
                  >
                    {ROAM_LABELS[status]}
                  </span>
                  <p className="mt-2 text-2xl font-bold tabular-nums text-slate-800">
                    {roamCounts[status]}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-400">
              {risks.length} total {risks.length === 1 ? 'risk' : 'risks'} ·{' '}
              {roamCounts.unroamed} unroamed
            </p>
          </>
        )}
      </section>
    </div>
  );
}
