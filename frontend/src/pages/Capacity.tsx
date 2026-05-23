import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import type { CapacityPlan, CapacityPlanCreate, VelocityEntry } from '../types';
import { EmptyState } from '../components/EmptyState';
import { Modal } from '../components/Modal';
import { Spinner } from '../components/Spinner';
import { useToast } from '../components/Toaster';

type CapacityVariant = 'unset' | 'yellow' | 'blue' | 'red';

function getCapacityVariant(availableCapacity: number, committedPoints: number): CapacityVariant {
  if (availableCapacity <= 0) return committedPoints > 0 ? 'red' : 'yellow';
  const loadPct = (committedPoints / availableCapacity) * 100;
  if (loadPct > 100) return 'red';
  if (loadPct >= 70) return 'blue';
  return 'yellow';
}

const variantStyles: Record<CapacityVariant, { button: string; primary: string; secondary: string; detail: string }> = {
  unset: {
    button: 'border border-dashed border-slate-300 text-slate-400 hover:border-slate-400 hover:text-slate-600',
    primary: '',
    secondary: '',
    detail: '',
  },
  yellow: {
    button: 'bg-amber-50 hover:bg-amber-100',
    primary: 'font-semibold text-amber-900',
    secondary: 'text-amber-700',
    detail: 'text-amber-600',
  },
  blue: {
    button: 'bg-blue-50 hover:bg-blue-100',
    primary: 'font-semibold text-blue-900',
    secondary: 'text-blue-700',
    detail: 'text-blue-500',
  },
  red: {
    button: 'bg-red-50 hover:bg-red-100',
    primary: 'font-semibold text-red-900',
    secondary: 'text-red-700',
    detail: 'text-red-500',
  },
};

interface CapacityFormState {
  team_size: number;
  iteration_days: number;
  pto_days: number;
  overhead_pct: number;
}

function countWeekdays(startDate: string, endDate: string): number {
  const end = new Date(endDate);
  let count = 0;
  const cur = new Date(startDate);
  while (cur <= end) {
    const d = cur.getDay();
    if (d !== 0 && d !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

export function Capacity() {
  const { piId = '' } = useParams<{ piId: string }>();
  const qc = useQueryClient();
  const toast = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ teamId: string; iterationId: string } | null>(null);
  const [form, setForm] = useState<CapacityFormState>({ team_size: 0, iteration_days: 0, pto_days: 0, overhead_pct: 20 });
  const [error, setError] = useState('');

  const { data: pi } = useQuery({
    queryKey: ['pi', piId],
    queryFn: () => api.getPI(piId),
    enabled: !!piId,
  });

  const { data: iterations = [] } = useQuery({
    queryKey: ['iterations', piId],
    queryFn: () => api.listIterations(piId),
    enabled: !!piId,
  });

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: api.listTeams,
  });

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['capacity-plans', piId],
    queryFn: () => api.listCapacityPlans(piId),
    enabled: !!piId,
  });

  const { data: stories = [] } = useQuery({
    queryKey: ['stories'],
    queryFn: api.listStories,
  });

  const { data: velocityEntries = [] } = useQuery<VelocityEntry[]>({
    queryKey: ['velocity', piId],
    queryFn: () => api.listVelocity(piId),
    enabled: !!piId,
  });

  const upsertMut = useMutation({
    mutationFn: (body: CapacityPlanCreate) => api.upsertCapacityPlan(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['capacity-plans', piId] });
      closeModal();
      toast('Capacity plan saved');
    },
    onError: (e: Error) => setError(e.message),
  });

  const nonIpIterations = [...iterations]
    .filter((it) => !it.is_ip)
    .sort((a, b) => a.number - b.number);

  const sortedTeams = [...teams].sort((a, b) => a.name.localeCompare(b.name));

  const planMap: Record<string, CapacityPlan> = {};
  plans.forEach((p) => { planMap[`${p.team_id}:${p.iteration_id}`] = p; });

  const iterIds = new Set(nonIpIterations.map((it) => it.id));
  const storyPts: Record<string, number> = {};
  for (const s of stories) {
    if (s.iteration_id && iterIds.has(s.iteration_id)) {
      const key = `${s.team_id}:${s.iteration_id}`;
      storyPts[key] = (storyPts[key] ?? 0) + s.points;
    }
  }

  const donePts: Record<string, number> = {};
  for (const v of velocityEntries) {
    if (iterIds.has(v.iteration_id) && v.completed_points > 0) {
      donePts[`${v.team_id}:${v.iteration_id}`] = v.completed_points;
    }
  }

  // Auto-seed missing cells once per PI — single request so TinyDB writes are sequential.
  const autoSeededRef = useRef<string | null>(null);
  useEffect(() => {
    if (isLoading || !piId || autoSeededRef.current === piId) return;
    autoSeededRef.current = piId;
    api.seedCapacityPlans(piId).then(() =>
      qc.invalidateQueries({ queryKey: ['capacity-plans', piId] })
    );
  }, [isLoading, piId, qc]);

  function openCell(teamId: string, iterationId: string) {
    const existing = planMap[`${teamId}:${iterationId}`];
    const team = sortedTeams.find((t) => t.id === teamId);
    const iter = nonIpIterations.find((it) => it.id === iterationId);
    setSelectedCell({ teamId, iterationId });
    setForm({
      team_size: existing?.team_size ?? team?.member_count ?? 6,
      iteration_days: existing?.iteration_days ?? (iter ? countWeekdays(iter.start_date, iter.end_date) : 10),
      pto_days: existing?.pto_days ?? 0,
      overhead_pct: existing ? Math.round(existing.overhead_pct * 100) : 20,
    });
    setError('');
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setSelectedCell(null);
    setError('');
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCell) return;
    upsertMut.mutate({
      team_id: selectedCell.teamId,
      iteration_id: selectedCell.iterationId,
      pi_id: piId,
      team_size: form.team_size,
      iteration_days: form.iteration_days,
      pto_days: form.pto_days,
      overhead_pct: form.overhead_pct / 100,
    });
  }

  if (isLoading) return <Spinner />;

  const selectedTeam = selectedCell ? sortedTeams.find((t) => t.id === selectedCell.teamId) : null;
  const selectedIter = selectedCell ? nonIpIterations.find((it) => it.id === selectedCell.iterationId) : null;

  const totalSet = plans.length;
  const totalCells = nonIpIterations.length * sortedTeams.length;

  return (
    <div className="p-3 sm:p-6">
      <div className="mb-5">
        <h1 className="mb-1 text-xl font-semibold text-slate-800">Capacity — {pi?.name}</h1>
        <p className="text-sm text-slate-500">
          Available person-days per team per iteration.{' '}
          {totalCells > 0 && `${totalSet} of ${totalCells} cells set. `}
          Click a cell to set or update.
        </p>
      </div>

      <div className="mb-3 flex flex-wrap gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-amber-100 border border-amber-200" aria-hidden="true" />
          <span>Under-loaded (&lt;70%)</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-blue-100 border border-blue-200" aria-hidden="true" />
          <span>Suitably planned (70–100%)</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-red-100 border border-red-200" aria-hidden="true" />
          <span>Over capacity (&gt;100%)</span>
        </span>
      </div>

      {nonIpIterations.length === 0 || sortedTeams.length === 0 ? (
        <EmptyState
          message={
            nonIpIterations.length === 0
              ? 'No iterations defined for this PI.'
              : 'No teams found. Add teams via Team Setup first.'
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Iteration
                </th>
                {sortedTeams.map((t) => (
                  <th key={t.id} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    {t.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {nonIpIterations.map((iter) => (
                <tr key={iter.id}>
                  <td className="px-4 py-3 font-medium text-slate-700">
                    Iteration {iter.number}
                    <div className="text-xs font-normal text-slate-400">
                      {iter.start_date} – {iter.end_date}
                    </div>
                  </td>
                  {sortedTeams.map((team) => {
                    const plan = planMap[`${team.id}:${iter.id}`];
                    const committed = storyPts[`${team.id}:${iter.id}`] ?? 0;
                    const done = donePts[`${team.id}:${iter.id}`] ?? 0;
                    const variant = plan ? getCapacityVariant(plan.available_capacity, committed) : 'unset';
                    const vs = variantStyles[variant];
                    const loadPct =
                      plan && plan.available_capacity > 0
                        ? Math.round((committed / plan.available_capacity) * 100)
                        : null;
                    return (
                      <td key={team.id} className="px-3 py-2">
                        <button
                          onClick={() => openCell(team.id, iter.id)}
                          className={`w-full rounded-md px-3 py-2 text-left text-xs transition-colors ${vs.button}`}
                        >
                          {plan ? (
                            <>
                              <span className={vs.primary}>{plan.available_capacity}</span>
                              <span className={vs.secondary}> days</span>
                              <div className={`text-xs ${vs.detail}`}>
                                {plan.team_size} ppl · {plan.pto_days}d PTO · {Math.round(plan.overhead_pct * 100)}% OH
                              </div>
                            </>
                          ) : (
                            <span>Not set</span>
                          )}
                          {committed > 0 && (
                            <div className={`mt-0.5 text-xs ${vs.secondary}`}>
                              {committed} pts committed
                              {loadPct !== null && ` · ${loadPct}% load`}
                            </div>
                          )}
                          {done > 0 && (
                            <div className="mt-0.5 text-xs text-teal-700">
                              {done} pts done
                            </div>
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={modalOpen}
        title={`Capacity: ${selectedTeam?.name ?? '…'} — Iteration ${selectedIter?.number ?? '…'}`}
        onClose={closeModal}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="cap-team-size" className="mb-1 block text-sm font-medium text-slate-700">
                Team Size
              </label>
              <input
                id="cap-team-size"
                type="number"
                min={1}
                value={form.team_size}
                onChange={(e) => setForm({ ...form, team_size: Number(e.target.value) })}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
              />
            </div>
            <div>
              <label htmlFor="cap-iter-days" className="mb-1 block text-sm font-medium text-slate-700">
                Iteration Days
              </label>
              <input
                id="cap-iter-days"
                type="number"
                min={1}
                value={form.iteration_days}
                onChange={(e) => setForm({ ...form, iteration_days: Number(e.target.value) })}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
              />
            </div>
            <div>
              <label htmlFor="cap-pto" className="mb-1 block text-sm font-medium text-slate-700">
                PTO Days (total across team)
              </label>
              <input
                id="cap-pto"
                type="number"
                min={0}
                step={0.5}
                value={form.pto_days}
                onChange={(e) => setForm({ ...form, pto_days: Number(e.target.value) })}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
              />
            </div>
            <div>
              <label htmlFor="cap-overhead" className="mb-1 block text-sm font-medium text-slate-700">
                Overhead %
              </label>
              <input
                id="cap-overhead"
                type="number"
                min={0}
                max={100}
                value={form.overhead_pct}
                onChange={(e) => setForm({ ...form, overhead_pct: Number(e.target.value) })}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
              />
            </div>
          </div>

          {form.team_size > 0 && form.iteration_days > 0 && (
            <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
              Available:{' '}
              <strong>
                {(
                  (form.team_size * form.iteration_days - form.pto_days) *
                  (1 - form.overhead_pct / 100)
                ).toFixed(2)}
              </strong>{' '}
              person-days
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={closeModal}
              className="rounded-md px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={upsertMut.isPending}
              className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 transition-colors"
            >
              {upsertMut.isPending ? 'Saving…' : 'Set Capacity'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
