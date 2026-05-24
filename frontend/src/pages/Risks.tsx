import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import type { Risk, RiskCreate, RiskUpdate, ROAMStatus } from '../types';
import { ROAMBadge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { Modal } from '../components/Modal';
import { Pagination } from '../components/Pagination';
import { Spinner } from '../components/Spinner';
import { useToast } from '../components/Toaster';
import { usePagination } from '../hooks/usePagination';

const ROAM_OPTIONS: ROAMStatus[] = ['unroamed', 'owned', 'accepted', 'mitigated', 'resolved'];

interface RiskFormState {
  description: string;
  team_id: string | null;
  roam_status: ROAMStatus;
  owner: string | null;
  mitigation_notes: string;
}

const EMPTY_FORM: RiskFormState = {
  description: '',
  team_id: null,
  roam_status: 'unroamed',
  owner: null,
  mitigation_notes: '',
};

export function Risks() {
  const { piId = '' } = useParams<{ piId: string }>();
  const qc = useQueryClient();
  const toast = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Risk | null>(null);
  const [form, setForm] = useState<RiskFormState>(EMPTY_FORM);
  const [error, setError] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');

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

  const invalidate = () => qc.invalidateQueries({ queryKey: ['risks', piId] });

  const createMut = useMutation({
    mutationFn: (body: RiskCreate) => api.createRisk(body),
    onSuccess: () => { invalidate(); closeModal(); toast('Risk added'); },
    onError: (e: Error) => setError(e.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: RiskUpdate }) => api.updateRisk(id, body),
    onSuccess: () => { invalidate(); closeModal(); toast('Risk updated'); },
    onError: (e: Error) => setError(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteRisk(id),
    onSuccess: () => { invalidate(); setDeleteId(null); setDeleteError(''); toast('Risk deleted'); },
    onError: (e: Error) => setDeleteError(e.message),
  });

  const { page, totalPages, pageItems: pageRisks, goTo } = usePagination(risks, 25, piId);

  if (isLoading) return <Spinner />;

  const teamMap = Object.fromEntries(teams.map((t) => [t.id, t.name]));
  const unroamed = risks.filter((r) => r.roam_status === 'unroamed').length;

  function openNew() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError('');
    setModalOpen(true);
  }

  function openEdit(r: Risk) {
    setEditing(r);
    setForm({
      description: r.description,
      team_id: r.team_id,
      roam_status: r.roam_status,
      owner: r.owner,
      mitigation_notes: r.mitigation_notes,
    });
    setError('');
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    setError('');
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form.description.trim()) { setError('Description is required.'); return; }
    if (editing) {
      updateMut.mutate({
        id: editing.id,
        body: { ...form, team_id: form.team_id || null, owner: form.owner || null },
      });
    } else {
      createMut.mutate({
        ...form,
        pi_id: piId,
        team_id: form.team_id || null,
        owner: form.owner || null,
      });
    }
  }

  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <div className="p-3 sm:p-6">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-y-2">
        <div>
          <h1 className="mb-1 text-xl font-semibold text-slate-800">
            Risk Register — {pi?.name}
          </h1>
          <p className="text-sm text-slate-500">
            {risks.length} risk{risks.length === 1 ? '' : 's'}
            {unroamed > 0 && (
              <Link
                to={`/pi/${piId}/risks/roam`}
                className="ml-2 font-medium text-red-600 hover:text-red-800 underline"
              >
                {unroamed} unroamed
              </Link>
            )}
          </p>
        </div>
        <button
          onClick={openNew}
          className="rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 transition-colors"
        >
          + New Risk
        </button>
      </div>

      {risks.length === 0 ? (
        <EmptyState message="No risks for this PI." />
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          {/* Mobile card list */}
          <div className="block md:hidden divide-y divide-slate-100">
            {pageRisks.map((r) => {
              if (deleteId === r.id) {
                return (
                  <div key={r.id} className="bg-red-50 px-4 py-4">
                    {deleteError && <p className="mb-2 text-xs text-red-600">{deleteError}</p>}
                    <p className="mb-3 text-sm text-slate-700">
                      Delete <strong>{r.description.slice(0, 60)}{r.description.length > 60 ? '…' : ''}</strong>?
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => deleteMut.mutate(r.id)}
                        disabled={deleteMut.isPending}
                        className="rounded-md bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                      >
                        {deleteMut.isPending ? 'Deleting…' : 'Yes, delete'}
                      </button>
                      <button
                        onClick={() => { setDeleteId(null); setDeleteError(''); }}
                        className="rounded-md bg-white px-4 py-2.5 text-sm text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                );
              }
              return (
                <div key={r.id} className="px-4 py-4">
                  <button
                    onClick={() => openEdit(r)}
                    className="mb-2 text-left font-medium text-slate-800 hover:text-slate-600"
                  >
                    {r.description}
                  </button>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <ROAMBadge status={r.roam_status} />
                    {r.team_id && (
                      <span className="text-xs text-slate-500">{teamMap[r.team_id] ?? r.team_id}</span>
                    )}
                  </div>
                  <div className="mb-3 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500">
                    {r.owner && <span>Owner: {r.owner}</span>}
                    <span>Raised: {r.raised_date}</span>
                    {r.mitigation_notes && (
                      <span className="w-full text-slate-400 line-clamp-2">{r.mitigation_notes}</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEdit(r)}
                      className="rounded-md bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-200 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => { setDeleteId(r.id); setDeleteError(''); }}
                      className="rounded-md bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-100 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  {['Description', 'Team', 'Status', 'Owner', 'Raised', 'Notes', ''].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageRisks.map((r) => {
                  if (deleteId === r.id) {
                    return (
                      <tr key={r.id} className="bg-red-50">
                        <td colSpan={7} className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {deleteError && <span className="text-xs text-red-600">{deleteError}</span>}
                            <span className="text-sm text-slate-700">
                              Delete <strong>{r.description.slice(0, 60)}{r.description.length > 60 ? '…' : ''}</strong>?
                            </span>
                            <button
                              onClick={() => deleteMut.mutate(r.id)}
                              disabled={deleteMut.isPending}
                              className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                            >
                              {deleteMut.isPending ? 'Deleting…' : 'Yes, delete'}
                            </button>
                            <button
                              onClick={() => { setDeleteId(null); setDeleteError(''); }}
                              className="text-xs text-slate-500 hover:text-slate-800 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => openEdit(r)}
                          className="font-medium text-slate-800 hover:text-slate-600 hover:underline text-left"
                        >
                          {r.description}
                        </button>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {r.team_id ? teamMap[r.team_id] ?? r.team_id : '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        <ROAMBadge status={r.roam_status} />
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">{r.owner ?? '—'}</td>
                      <td className="px-4 py-2.5 text-slate-500 tabular-nums">{r.raised_date}</td>
                      <td className="max-w-xs px-4 py-2.5 text-slate-500">
                        {r.mitigation_notes || '—'}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <button
                          onClick={() => openEdit(r)}
                          className="mr-3 text-xs text-slate-500 hover:text-slate-800 underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => { setDeleteId(r.id); setDeleteError(''); }}
                          className="text-xs text-red-400 hover:text-red-600 underline"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={totalPages} onPageChange={goTo} />
        </div>
      )}

      <Modal open={modalOpen} title={editing ? 'Edit Risk' : 'New Risk'} onClose={closeModal}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-red-600">{error}</p>}

          <div>
            <label htmlFor="risk-description" className="mb-1 block text-sm font-medium text-slate-700">
              Description<span aria-hidden="true"> *</span>
            </label>
            <textarea
              id="risk-description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
          </div>

          <div>
            <label htmlFor="risk-team" className="mb-1 block text-sm font-medium text-slate-700">Team</label>
            <select
              id="risk-team"
              value={form.team_id ?? ''}
              onChange={(e) => setForm({ ...form, team_id: e.target.value || null })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
            >
              <option value="">— none —</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="risk-roam-status" className="mb-1 block text-sm font-medium text-slate-700">ROAM Status</label>
            <select
              id="risk-roam-status"
              value={form.roam_status}
              onChange={(e) => setForm({ ...form, roam_status: e.target.value as ROAMStatus })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
            >
              {ROAM_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="risk-owner" className="mb-1 block text-sm font-medium text-slate-700">Owner</label>
            <input
              id="risk-owner"
              type="text"
              value={form.owner ?? ''}
              onChange={(e) => setForm({ ...form, owner: e.target.value || null })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
          </div>

          <div>
            <label htmlFor="risk-notes" className="mb-1 block text-sm font-medium text-slate-700">Mitigation Notes</label>
            <textarea
              id="risk-notes"
              value={form.mitigation_notes}
              onChange={(e) => setForm({ ...form, mitigation_notes: e.target.value })}
              rows={3}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
          </div>

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
              disabled={isPending}
              className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 transition-colors"
            >
              {(() => {
                if (isPending) return 'Saving…';
                if (editing) return 'Save Changes';
                return 'Add Risk';
              })()}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
