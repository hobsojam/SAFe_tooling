import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import type { Risk, Team, ROAMStatus } from '../types';
import { ROAMBadge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { Spinner } from '../components/Spinner';
import { buildPredictabilitySummary, predictabilityBadgeClass } from '../utils/predictability';

const ROAM_ORDER: ROAMStatus[] = ['resolved', 'owned', 'accepted', 'mitigated', 'unroamed'];
const SUMMARY_CARD_CLASS = 'rounded-lg border border-slate-200 bg-white p-4 shadow-sm';
const STAT_LABEL_CLASS = 'text-xs font-medium uppercase tracking-wide text-slate-500';
const STAT_VALUE_CLASS = 'mt-1 text-2xl font-bold tabular-nums text-slate-800';
const ROAM_COUNT_CLASS = 'mt-2 text-2xl font-bold tabular-nums text-slate-800';
const TABLE_HEADER_CLASS = 'px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600';
const OBJECTIVE_HEADERS = ['Objective', 'Team', 'Type', 'Planned BV', 'Actual BV'];

function buildRoamCounts(risks: Risk[]): Record<ROAMStatus, number> {
  const counts = { resolved: 0, owned: 0, accepted: 0, mitigated: 0, unroamed: 0 };
  for (const r of risks) counts[r.roam_status]++;
  return counts;
}

function teamName(teams: Team[], teamId: string | null): string {
  if (!teamId) return '—';
  return teams.find((t) => t.id === teamId)?.name ?? '—';
}

function Section({
  title,
  headingId,
  children,
}: Readonly<{ title: string; headingId: string; children: ReactNode }>) {
  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="mb-3 text-base font-semibold text-slate-700">
        {title}
      </h2>
      {children}
    </section>
  );
}

function StatCard({ label, children }: Readonly<{ label: string; children: ReactNode }>) {
  return (
    <div className={SUMMARY_CARD_CLASS}>
      <p className={STAT_LABEL_CLASS}>{label}</p>
      <div className={STAT_VALUE_CLASS}>{children}</div>
    </div>
  );
}

function ObjectiveTypeBadge({ isStretch }: Readonly<{ isStretch: boolean }>) {
  const styles = isStretch
    ? 'bg-amber-100 text-amber-800'
    : 'bg-teal-100 text-teal-800';

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles}`}>
      {isStretch ? 'Stretch' : 'Committed'}
    </span>
  );
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
  const pred = buildPredictabilitySummary(committed);
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

      <Section title="ART Predictability" headingId="pred-heading">
        {committed.length === 0 ? (
          <EmptyState message="No committed objectives — add objectives on the Objectives page." />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Planned BV">{pred.plannedBV}</StatCard>
            <StatCard label="Actual BV">
              {pred.scoredCount > 0 ? pred.actualBV : <span className="text-slate-400">—</span>}
            </StatCard>
            <StatCard label="Objectives Scored">
              {pred.scoredCount} / {pred.totalCount}
            </StatCard>
            <div className={SUMMARY_CARD_CLASS}>
              <p className={STAT_LABEL_CLASS}>Predictability</p>
              <div className="mt-1">
                {pred.pct === null ? (
                  <span className="text-sm text-slate-400">Not yet scored</span>
                ) : (
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-lg font-bold ${predictabilityBadgeClass(pred.pct)}`}
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
      </Section>

      <Section title="PI Objectives" headingId="obj-heading">
        {objectives.length === 0 ? (
          <EmptyState message="No objectives for this PI." />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  {OBJECTIVE_HEADERS.map((h) => (
                    <th key={h} className={TABLE_HEADER_CLASS}>
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
                      <ObjectiveTypeBadge isStretch={obj.is_stretch} />
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
      </Section>

      <Section title="Risk Disposition (ROAM)" headingId="roam-heading">
        {risks.length === 0 ? (
          <EmptyState message="No risks recorded for this PI." />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              {ROAM_ORDER.map((status) => (
                <div key={status} className={SUMMARY_CARD_CLASS}>
                  <ROAMBadge status={status} />
                  <p className={ROAM_COUNT_CLASS}>{roamCounts[status]}</p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-400">
              {risks.length} total {risks.length === 1 ? 'risk' : 'risks'} ·{' '}
              {roamCounts.unroamed} unroamed
            </p>
          </>
        )}
      </Section>
    </div>
  );
}
