import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { FeatureStatusBadge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { Spinner } from '../components/Spinner';
import type { Feature, PI, Team } from '../types';

export function Roadmap() {
  const { data: pis = [], isLoading: pisLoading } = useQuery({
    queryKey: ['pis'],
    queryFn: api.listPIs,
  });

  const { data: allFeatures = [], isLoading: featuresLoading } = useQuery({
    queryKey: ['features'],
    queryFn: api.listAllFeatures,
  });

  const { data: teams = [], isLoading: teamsLoading } = useQuery({
    queryKey: ['teams'],
    queryFn: api.listTeams,
  });

  if (pisLoading || featuresLoading || teamsLoading) return <Spinner />;

  const sortedPIs = [...pis].sort((a, b) => a.start_date.localeCompare(b.start_date));
  const hasUnscheduled = allFeatures.some((f) => !f.pi_id);

  if (sortedPIs.length === 0 && allFeatures.length === 0) {
    return (
      <div className="p-3 sm:p-6">
        <h1 className="mb-1 text-xl font-semibold text-slate-800">PI Roadmap</h1>
        <EmptyState message="No PIs or features found. Create a PI and add features to see the roadmap." />
      </div>
    );
  }

  const teamsWithFeatures = teams.filter((t) => allFeatures.some((f) => f.team_id === t.id));
  const hasUnassigned = allFeatures.some((f) => !f.team_id);

  const featureGrid: Record<string, Record<string, Feature[]>> = {};
  for (const feature of allFeatures) {
    const rowKey = feature.team_id ?? 'unassigned';
    const colKey = feature.pi_id ?? 'unscheduled';
    if (!featureGrid[rowKey]) featureGrid[rowKey] = {};
    if (!featureGrid[rowKey][colKey]) featureGrid[rowKey][colKey] = [];
    featureGrid[rowKey][colKey].push(feature);
  }

  const columns: Array<{ key: string; pi?: PI }> = [
    ...sortedPIs.map((pi) => ({ key: pi.id, pi })),
    ...(hasUnscheduled ? [{ key: 'unscheduled' as const }] : []),
  ];

  const rows: Array<{ key: string; team?: Team }> = [
    ...teamsWithFeatures.map((t) => ({ key: t.id, team: t })),
    ...(hasUnassigned ? [{ key: 'unassigned' as const }] : []),
  ];

  if (rows.length === 0) {
    return (
      <div className="p-3 sm:p-6">
        <h1 className="mb-1 text-xl font-semibold text-slate-800">PI Roadmap</h1>
        <p className="mb-5 text-sm text-slate-500">Cross-PI feature timeline</p>
        <EmptyState message="No features found. Add features to PIs to see the roadmap." />
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6">
      <h1 className="mb-1 text-xl font-semibold text-slate-800">PI Roadmap</h1>
      <p className="mb-5 text-sm text-slate-500">
        Feature timeline across {sortedPIs.length} Program Increment
        {sortedPIs.length === 1 ? '' : 's'}
      </p>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th
                scope="col"
                className="sticky left-0 z-10 bg-slate-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 min-w-[160px] border-r border-slate-200"
              >
                Team
              </th>
              {columns.map(({ key, pi }) => (
                <th
                  key={key}
                  scope="col"
                  className="px-4 py-3 text-left min-w-[200px] border-r border-slate-100 last:border-r-0"
                >
                  {pi ? (
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                        {pi.name}
                      </div>
                      <div className="mt-0.5 text-xs font-normal normal-case tracking-normal text-slate-400">
                        {pi.start_date} – {pi.end_date}
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Unscheduled
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(({ key: rowKey, team }) => (
              <tr key={rowKey} className="hover:bg-slate-50/50">
                <td className="sticky left-0 z-10 bg-white px-4 py-3 font-medium text-slate-700 border-r border-slate-200 align-top">
                  {team ? (
                    team.name
                  ) : (
                    <span className="italic text-slate-400">Unassigned</span>
                  )}
                </td>
                {columns.map(({ key: colKey, pi }) => {
                  const features = featureGrid[rowKey]?.[colKey] ?? [];
                  return (
                    <td
                      key={colKey}
                      className="px-3 py-2 align-top border-r border-slate-100 last:border-r-0"
                    >
                      {features.length === 0 ? (
                        <span className="text-slate-200" aria-hidden="true">
                          —
                        </span>
                      ) : (
                        <div className="space-y-1.5">
                          {features.map((f) => (
                            <div
                              key={f.id}
                              className="rounded border border-slate-200 bg-white px-2 py-1.5 shadow-sm"
                            >
                              {pi ? (
                                <Link
                                  to={`/pi/${pi.id}/backlog`}
                                  className="block text-xs font-medium text-slate-700 hover:text-slate-900 hover:underline leading-snug"
                                >
                                  {f.name}
                                </Link>
                              ) : (
                                <span className="block text-xs font-medium text-slate-700 leading-snug">
                                  {f.name}
                                </span>
                              )}
                              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                <FeatureStatusBadge status={f.status} />
                                <span className="text-xs text-slate-400">
                                  WSJF {f.wsjf_score.toFixed(1)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
