import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import type { Risk, RiskUpdate, ROAMStatus } from '../types';
import { EmptyState } from '../components/EmptyState';
import { Spinner } from '../components/Spinner';
import { useToast } from '../components/Toaster';

const ROAM_OPTIONS: ROAMStatus[] = ['owned', 'accepted', 'mitigated', 'resolved'];

interface RowState {
  roam_status: ROAMStatus;
  owner: string;
  mitigation_notes: string;
}

export function RoamUnroamed() {
  const { piId = '' } = useParams<{ piId: string }>();
  const qc = useQueryClient();
  const toast = useToast();

  const { data: pi } = useQuery({
    queryKey: ['pi', piId],
    queryFn: () => api.getPI(piId),
    enabled: !!piId,
  });

  const { data: risks = [], isLoading } = useQuery({
    queryKey: ['risks', piId],
    queryFn: () => api.listRisks(piId),
    enabled: !!piId,
  });

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: api.listTeams,
  });

  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: RiskUpdate }) => api.updateRisk(id, body),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['risks', piId] });
      setSaving((p) => ({ ...p, [id]: false }));
      setRows((p) => { const n = { ...p }; delete n[id]; return n; });
      setErrors((p) => { const n = { ...p }; delete n[id]; return n; });
      toast('Risk ROAMed');
    },
    onError: (e: Error, { id }) => {
      setSaving((p) => ({ ...p, [id]: false }));
      setErrors((p) => ({ ...p, [id]: e.message }));
    },
  });

  if (isLoading) return <Spinner />;

  const unroamed = risks.filter((r) => r.roam_status === 'unroamed');
  const teamMap = Object.fromEntries(teams.map((t) => [t.id, t.name]));

  function getRow(r: Risk): RowState {
    return rows[r.id] ?? {
      roam_status: 'owned',
      owner: r.owner ?? '',
      mitigation_notes: r.mitigation_notes,
    };
  }

  function setField(id: string, risk: Risk, key: keyof RowState, val: string) {
    setRows((p) => ({ ...p, [id]: { ...getRow(risk), [key]: val } }));
  }

  function save(r: Risk) {
    const row = getRow(r);
    setSaving((p) => ({ ...p, [r.id]: true }));
    updateMut.mutate({
      id: r.id,
      body: {
        roam_status: row.roam_status,
        owner: row.owner || null,
        mitigation_notes: row.mitigation_notes,
      },
    });
  }

  return (
    <div className="p-6">
      <div className="mb-5">
        <Link
          to={`/pi/${piId}/risks`}
          className="text-sm text-slate-500 hover:text-slate-700 underline"
        >
          ← Back to Risk Register
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-slate-800">
          ROAM Unroamed Risks — {pi?.name}
        </h1>
        <p className="text-sm text-slate-500">
          {unroamed.length} risk{unroamed.length === 1 ? '' : 's'} need attention
        </p>
      </div>

      {unroamed.length === 0 ? (
        <EmptyState message="All risks have been ROAMed." />
      ) : (
        <div className="space-y-3">
          {unroamed.map((r) => {
            const row = getRow(r);
            const pending = saving[r.id] ?? false;
            return (
              <div key={r.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <p className="mb-3 font-medium text-slate-800">{r.description}</p>
                {r.team_id && (
                  <p className="mb-2 text-xs text-slate-500">
                    Team: {teamMap[r.team_id] ?? r.team_id}
                  </p>
                )}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label htmlFor={`roam-status-${r.id}`} className="mb-1 block text-xs font-medium text-slate-600">
                      ROAM Status
                    </label>
                    <select
                      id={`roam-status-${r.id}`}
                      value={row.roam_status}
                      onChange={(e) => setField(r.id, r, 'roam_status', e.target.value)}
                      className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                    >
                      {ROAM_OPTIONS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor={`owner-${r.id}`} className="mb-1 block text-xs font-medium text-slate-600">Owner</label>
                    <input
                      id={`owner-${r.id}`}
                      type="text"
                      value={row.owner}
                      onChange={(e) => setField(r.id, r, 'owner', e.target.value)}
                      placeholder="Assign owner…"
                      className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                    />
                  </div>
                  <div>
                    <label htmlFor={`mitigation-notes-${r.id}`} className="mb-1 block text-xs font-medium text-slate-600">
                      Mitigation Notes
                    </label>
                    <input
                      id={`mitigation-notes-${r.id}`}
                      type="text"
                      value={row.mitigation_notes}
                      onChange={(e) => setField(r.id, r, 'mitigation_notes', e.target.value)}
                      placeholder="Notes…"
                      className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                    />
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  {errors[r.id] && (
                    <span className="text-xs text-red-600">{errors[r.id]}</span>
                  )}
                  <button
                    onClick={() => save(r)}
                    disabled={pending}
                    className="rounded-md bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50 transition-colors"
                  >
                    {pending ? 'Saving…' : 'ROAM this risk'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
