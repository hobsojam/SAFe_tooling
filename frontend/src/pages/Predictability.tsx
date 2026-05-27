import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import type { PIObjective, Team } from "../types";
import { EmptyState } from "../components/EmptyState";
import { Spinner } from "../components/Spinner";
import { usePIObjectives } from "../hooks/usePIObjectives";
import { buildPredictabilitySummary, predictabilityBadgeClass } from "../utils/predictability";

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
  const summary = buildPredictabilitySummary(objs);
  return {
    team,
    objectives: objs,
    plannedBV: summary.plannedBV,
    actualBV: summary.actualBV,
    scored: summary.scoredCount,
    predictability: summary.pct,
  };
}

export function Predictability() {
  const { pi, objectives, isLoading: loadingObj } = usePIObjectives();

  const { data: teams = [], isLoading: loadingTeams } = useQuery({
    queryKey: ["teams", pi?.art_id],
    queryFn: () => api.listTeamsByArt(pi!.art_id),
    enabled: !!pi?.art_id,
  });

  if (loadingObj || loadingTeams) return <Spinner />;

  const committed = objectives.filter((o) => !o.is_stretch);

  const sortedTeams = [...teams].sort((a, b) => a.name.localeCompare(b.name));
  const rows = sortedTeams.map((t) => buildRow(t, committed));

  const artPredictability = buildPredictabilitySummary(committed);

  return (
    <div className="p-6">
      <div className="mb-5">
        <h1 className="mb-1 text-xl font-semibold text-slate-800">
          ART Predictability — {pi?.name}
        </h1>
        <p className="text-sm text-slate-500">Committed objectives only · SAFe target: 80–100%</p>
      </div>

      {committed.length === 0 ? (
        <EmptyState message="No committed objectives for this PI. Add objectives on the Objectives page." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                {["Team", "Objectives", "Planned BV", "Actual BV", "Scored", "Predictability"].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(
                ({ team, objectives: objs, plannedBV, actualBV, scored, predictability }) =>
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
                        {predictability === null ? (
                          <span className="text-xs text-slate-400">Not yet scored</span>
                        ) : (
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${predictabilityBadgeClass(predictability)}`}
                          >
                            {predictability}%
                          </span>
                        )}
                      </td>
                    </tr>
                  )
              )}
            </tbody>
            <tfoot className="border-t-2 border-slate-300 bg-slate-50">
              <tr>
                <td className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  ART Total
                </td>
                <td className="px-4 py-3 font-semibold text-slate-800">{committed.length}</td>
                <td className="px-4 py-3 tabular-nums font-semibold text-slate-800">
                  {artPredictability.plannedBV}
                </td>
                <td className="px-4 py-3 tabular-nums font-semibold text-slate-800">
                  {artPredictability.scoredCount > 0 ? (
                    artPredictability.actualBV
                  ) : (
                    <span className="font-normal text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 font-semibold text-slate-800">
                  {artPredictability.scoredCount} / {artPredictability.totalCount}
                </td>
                <td className="px-4 py-3">
                  {artPredictability.pct === null ? (
                    <span className="text-xs text-slate-400">Not yet scored</span>
                  ) : (
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-bold ${predictabilityBadgeClass(artPredictability.pct)}`}
                    >
                      {artPredictability.pct}%
                    </span>
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
