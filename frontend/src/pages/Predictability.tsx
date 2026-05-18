import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import type { PIObjective, Team } from '../types';
import { EmptyState } from '../components/EmptyState';
import { Spinner } from '../components/Spinner';

function predictabilityClass(pct: number): string {
  if (pct >= 80) return 'bg-teal-100 text-teal-800';
  if (pct >= 60) return 'bg-amber-100 text-amber-800';
  return 'bg-red-100 text-red-800';
}

interface TeamRow {
  team: Team;
  objectives: PIObjective[];
  plannedBV: number;
  actualBV: number;
  scored: number;
  predictability: number | null;
}

function buildRow(team: Team, committed: PIObjective[]): TeamRow {
  const objs = committed.filter((o) => o.team_id === team.id);
  const plannedBV = objs.reduce((s, o) => s + o.planned_business_value, 0);
  const scoredObjs = objs.filter((o) => o.actual_business_value !== null);
  const actualBV = scoredObjs.reduce((s, o) => s + (o.actual_business_value ?? 0), 0);
  const predictability =
    plannedBV > 0 && scoredObjs.length > 0
      ? Math.round((actualBV / plannedBV) * 100)
      : null;
  return { team, objectives: objs, plannedBV, actualBV, scored: scoredObjs.length, predictability };
}

export function Predictability() {
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

  const { data: teams = [], isLoading: loadingTeams } = useQuery({
    queryKey: ['teams', pi?.art_id],
    queryFn: () => api.listTeamsByArt(pi!.art_id),
    enabled: !!pi?.art_id,
  });

  if (loadingObj || loadingTeams) return <Spinner />;

  const committed = objectives.filter((o) => !o.is_stretch);

  const sortedTeams = [...teams].sort((a, b) => a.name.localeCompare(b.name));
  const rows = sortedTeams.map((t) => buildRow(t, committed));

  const artPlannedBV = committed.reduce((s, o) => s + o.planned_business_value, 0);
  const artScoredObjs = committed.filter((o) => o.actual_business_value !== null);
  const artActualBV = artScoredObjs.reduce((s, o) => s + (o.actual_business_value ?? 0), 0);
  const artPredictability =
    artPlannedBV > 0 && artScoredObjs.length > 0
      ? Math.round((artActualBV / artPlannedBV) * 100)
      : null;

  return (
    <div className="p-6">
      <div className="mb-5">
        <h1 className="mb-1 text-xl font-semibold text-slate-800">
          ART Predictability — {pi?.name}
        </h1>
        <p className="text-sm text-slate-500">
          Committed objectives only · SAFe target: 80–100%
        </p>
      </div>

      {committed.length === 0 ? (
        <EmptyState message="No committed objectives for this PI. Add objectives on the Objectives page." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                {['Team', 'Objectives', 'Planned BV', 'Actual BV', 'Scored', 'Predictability'].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(({ team, objectives: objs, plannedBV, actualBV, scored, predictability }) =>
                objs.length === 0 ? (
                  <tr key={team.id} className="text-slate-400">
                    <td className="px-4 py-3 font-medium">{team.name}</td>
                    <td className="px-4 py-3">0</td>
                    <td className="px-4 py-3">—</td>
                    <td className="px-4 py-3">—</td>
                    <td className="px-4 py-3">—</td>
                    <td className="px-4 py-3 text-xs">No committed objectives</td>
                  </tr>
                ) : (
                  <tr key={team.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-medium text-slate-800">{team.name}</td>
                    <td className="px-4 py-3 text-slate-600">{objs.length}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-700">{plannedBV}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-700">
                      {scored > 0 ? actualBV : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {scored} / {objs.length}
                    </td>
                    <td className="px-4 py-3">
                      {predictability !== null ? (
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${predictabilityClass(predictability)}`}
                        >
                          {predictability}%
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">Not yet scored</span>
                      )}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
            <tfoot className="border-t-2 border-slate-300 bg-slate-50">
              <tr>
                <td className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  ART Total
                </td>
                <td className="px-4 py-3 font-semibold text-slate-800">{committed.length}</td>
                <td className="px-4 py-3 tabular-nums font-semibold text-slate-800">
                  {artPlannedBV}
                </td>
                <td className="px-4 py-3 tabular-nums font-semibold text-slate-800">
                  {artScoredObjs.length > 0 ? (
                    artActualBV
                  ) : (
                    <span className="font-normal text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 font-semibold text-slate-800">
                  {artScoredObjs.length} / {committed.length}
                </td>
                <td className="px-4 py-3">
                  {artPredictability !== null ? (
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-bold ${predictabilityClass(artPredictability)}`}
                    >
                      {artPredictability}%
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">Not yet scored</span>
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <p className="mt-4 text-xs text-slate-400">
        Predictability = Actual BV ÷ Planned BV × 100. Stretch objectives are excluded. Unscored
        objectives are not counted toward actual BV.
      </p>
    </div>
  );
}
