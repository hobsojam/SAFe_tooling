import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { PIStatusBadge } from "../components/Badge";
import { EmptyState } from "../components/EmptyState";
import { Spinner } from "../components/Spinner";

export function predictabilityClass(pct: number): string {
  if (pct >= 80) return "text-teal-700";
  if (pct >= 60) return "text-amber-600";
  return "text-red-600";
}

export function loadPctClass(pct: number): string {
  if (pct > 100) return "text-red-600";
  if (pct >= 70) return "text-blue-700";
  return "text-amber-600";
}

export function PIHealth() {
  const { piId = "" } = useParams<{ piId: string }>();

  const { data: pi } = useQuery({
    queryKey: ["pi", piId],
    queryFn: () => api.getPI(piId),
    enabled: !!piId,
  });

  const { data: teams = [] } = useQuery({
    queryKey: ["teams", pi?.art_id],
    queryFn: () => api.listTeamsByArt(pi!.art_id),
    enabled: !!pi?.art_id,
  });

  const { data: objectives = [], isLoading: loadingObj } = useQuery({
    queryKey: ["objectives", piId],
    queryFn: () => api.listObjectives(piId),
    enabled: !!piId,
  });

  const { data: capacityPlans = [] } = useQuery({
    queryKey: ["capacity-plans", piId],
    queryFn: () => api.listCapacityPlans(piId),
    enabled: !!piId,
  });

  const { data: stories = [] } = useQuery({
    queryKey: ["stories"],
    queryFn: api.listStories,
  });

  const { data: risks = [], isLoading: loadingRisks } = useQuery({
    queryKey: ["risks", piId],
    queryFn: () => api.listRisks(piId),
    enabled: !!piId,
  });

  const { data: dependencies = [], isLoading: loadingDeps } = useQuery({
    queryKey: ["dependencies", piId],
    queryFn: () => api.listDependencies(piId),
    enabled: !!piId,
  });

  const { data: iterations = [] } = useQuery({
    queryKey: ["iterations", piId],
    queryFn: () => api.listIterations(piId),
    enabled: !!piId,
  });

  if (loadingObj || loadingRisks || loadingDeps) return <Spinner />;

  const committed = objectives.filter((o) => !o.is_stretch);
  const stretch = objectives.filter((o) => o.is_stretch);

  const artPlannedBV = committed.reduce((s, o) => s + o.planned_business_value, 0);
  const artScoredObjs = committed.filter((o) => o.actual_business_value !== null);
  const artActualBV = artScoredObjs.reduce((s, o) => s + (o.actual_business_value ?? 0), 0);
  const artPredictability =
    artPlannedBV > 0 && artScoredObjs.length > 0
      ? Math.round((artActualBV / artPlannedBV) * 100)
      : null;

  const unresolvedRisks = risks.filter(
    (r) => r.roam_status !== "resolved" && r.roam_status !== "mitigated"
  );

  const openDeps = dependencies.filter((d) => d.status !== "resolved");

  const iterationIds = new Set(iterations.filter((it) => !it.is_ip).map((it) => it.id));
  const teamCapMap: Record<string, { available: number; committed: number }> = {};
  for (const plan of capacityPlans) {
    if (iterationIds.has(plan.iteration_id)) {
      const cur = teamCapMap[plan.team_id] ?? { available: 0, committed: 0 };
      teamCapMap[plan.team_id] = { ...cur, available: cur.available + plan.available_capacity };
    }
  }
  for (const story of stories) {
    if (story.iteration_id && iterationIds.has(story.iteration_id)) {
      const cur = teamCapMap[story.team_id] ?? { available: 0, committed: 0 };
      teamCapMap[story.team_id] = { ...cur, committed: cur.committed + story.points };
    }
  }

  const sortedTeams = [...teams].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold text-slate-800">PI Health — {pi?.name}</h1>
          {pi && <PIStatusBadge status={pi.status} />}
        </div>
        {pi && (
          <p className="text-sm text-slate-500">
            {pi.start_date} – {pi.end_date}
          </p>
        )}
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          to={`/pi/${piId}/objectives`}
          className="block rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:border-slate-300 hover:shadow"
        >
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Objectives
          </p>
          <p className="text-3xl font-bold text-slate-800">{committed.length}</p>
          <p className="text-sm text-slate-600">committed</p>
          {stretch.length > 0 && (
            <p className="mt-1 text-sm text-slate-400">+{stretch.length} stretch</p>
          )}
        </Link>

        <Link
          to={`/pi/${piId}/risks`}
          className="block rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:border-slate-300 hover:shadow"
        >
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Unresolved Risks
          </p>
          <p
            className={`text-3xl font-bold ${
              unresolvedRisks.length === 0 ? "text-teal-700" : "text-amber-600"
            }`}
          >
            {unresolvedRisks.length}
          </p>
          <p className="text-sm text-slate-600">of {risks.length} total</p>
        </Link>

        <Link
          to={`/pi/${piId}/dependencies`}
          className="block rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:border-slate-300 hover:shadow"
        >
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Open Dependencies
          </p>
          <p
            className={`text-3xl font-bold ${
              openDeps.length === 0 ? "text-teal-700" : "text-amber-600"
            }`}
          >
            {openDeps.length}
          </p>
          <p className="text-sm text-slate-600">of {dependencies.length} total</p>
        </Link>

        <Link
          to={`/pi/${piId}/predictability`}
          className="block rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:border-slate-300 hover:shadow"
        >
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Predictability
          </p>
          {artPredictability === null ? (
            <>
              <p className="text-3xl font-bold text-slate-400">—</p>
              <p className="text-sm text-slate-500">Not yet scored</p>
            </>
          ) : (
            <>
              <p className={`text-3xl font-bold ${predictabilityClass(artPredictability)}`}>
                {artPredictability}%
              </p>
              <p className="text-sm text-slate-600">ART · target 80–100%</p>
            </>
          )}
        </Link>
      </div>

      <div>
        <h2 className="mb-3 text-base font-semibold text-slate-700">Capacity Load by Team</h2>
        {sortedTeams.length === 0 ? (
          <EmptyState message="No teams found for this PI's ART." />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  {["Team", "Available (days)", "Committed (pts)", "Load %"].map((h) => (
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
                {sortedTeams.map((team) => {
                  const cap = teamCapMap[team.id];
                  const loadPct =
                    cap && cap.available > 0
                      ? Math.round((cap.committed / cap.available) * 100)
                      : null;
                  return (
                    <tr key={team.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-medium text-slate-800">{team.name}</td>
                      <td className="px-4 py-3 tabular-nums text-slate-600">
                        {cap?.available ? (
                          cap.available.toFixed(1)
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-slate-600">
                        {cap?.committed !== undefined && cap.committed > 0 ? (
                          cap.committed
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {loadPct === null ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          <span className={`font-semibold ${loadPctClass(loadPct)}`}>
                            {loadPct}%
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs text-slate-400">
          Load % = Committed story points ÷ Available capacity (person-days) × 100. Target: 70–100%.
          Capacity plans are set on the{" "}
          <Link to={`/pi/${piId}/capacity`} className="underline hover:text-slate-600">
            Capacity page
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
