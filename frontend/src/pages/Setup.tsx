import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { PIStatusBadge } from '../components/Badge';
import { Spinner } from '../components/Spinner';
import { useToast } from '../components/Toaster';
import type { IterationCreate, PIUpdate } from '../types';

export function Setup() {
  const { piId } = useParams<{ piId: string }>();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();

  const { data: pi, isLoading } = useQuery({
    queryKey: ['pi', piId],
    queryFn: () => api.getPI(piId),
    enabled: !!piId,
  });

  const { data: iterations = [] } = useQuery({
    queryKey: ['iterations', piId],
    queryFn: () => api.listIterations(piId),
    enabled: !!piId,
  });

  const [detailsForm, setDetailsForm] = useState<PIUpdate | null>(null);
  const [detailsError, setDetailsError] = useState('');

  const [iterForm, setIterForm] = useState<Omit<IterationCreate, 'pi_id'>>({
    number: 1,
    name: '',
    start_date: '',
    end_date: '',
    is_ip: false,
  });
  const [iterError, setIterError] = useState('');
  const [showIterForm, setShowIterForm] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [lifecycleError, setLifecycleError] = useState('');

  const updatePIMut = useMutation({
    mutationFn: (body: PIUpdate) => api.updatePI(piId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pi', piId] });
      qc.invalidateQueries({ queryKey: ['pis'] });
      setDetailsForm(null);
      setDetailsError('');
      toast('PI updated');
    },
    onError: (e: Error) => setDetailsError(e.message),
  });

  const activateMut = useMutation({
    mutationFn: () => api.activatePI(piId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pi', piId] });
      qc.invalidateQueries({ queryKey: ['pis'] });
      setLifecycleError('');
      toast('PI activated');
    },
    onError: (e: Error) => setLifecycleError(e.message),
  });

  const closeMut = useMutation({
    mutationFn: () => api.closePI(piId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pi', piId] });
      qc.invalidateQueries({ queryKey: ['pis'] });
      setLifecycleError('');
      toast('PI closed');
    },
    onError: (e: Error) => setLifecycleError(e.message),
  });

  const createIterMut = useMutation({
    mutationFn: (body: IterationCreate) => api.createIteration(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['iterations', piId] });
      qc.invalidateQueries({ queryKey: ['pi', piId] });
      setShowIterForm(false);
      setIterError('');
      setIterForm({ number: 1, name: '', start_date: '', end_date: '', is_ip: false });
      toast('Iteration added');
    },
    onError: (e: Error) => setIterError(e.message),
  });

  const deleteIterMut = useMutation({
    mutationFn: (iterId: string) => api.deleteIteration(iterId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['iterations', piId] });
      qc.invalidateQueries({ queryKey: ['pi', piId] });
      toast('Iteration deleted');
    },
    onError: (e: Error) => toast(e.message, 'error'),
  });

  const deletePIMut = useMutation({
    mutationFn: () => api.deletePI(piId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pis'] });
      navigate('/pi');
      toast('PI deleted');
    },
    onError: (e: Error) => setLifecycleError(e.message),
  });

  if (isLoading || !pi) return <Spinner />;

  const editing = detailsForm !== null;
  const form = detailsForm ?? { name: pi.name, start_date: pi.start_date, end_date: pi.end_date };

  function startEditing() {
    setDetailsForm({ name: pi!.name, start_date: pi!.start_date, end_date: pi!.end_date });
    setDetailsError('');
  }

  function submitDetails(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name?.trim()) { setDetailsError('Name is required.'); return; }
    updatePIMut.mutate(detailsForm!);
  }

  const sortedIters = [...iterations].sort((a, b) => a.number - b.number);
  const nextNumber = sortedIters.length > 0 ? sortedIters[sortedIters.length - 1].number + 1 : 1;

  function openIterForm() {
    setIterForm({ number: nextNumber, name: '', start_date: '', end_date: '', is_ip: false });
    setIterError('');
    setShowIterForm(true);
  }

  function submitIter(e: React.FormEvent) {
    e.preventDefault();
    if (!iterForm.start_date || !iterForm.end_date) { setIterError('Start and end dates are required.'); return; }
    createIterMut.mutate({ ...iterForm, pi_id: piId });
  }

  return (
    <div className="p-3 sm:p-6 max-w-2xl">
      <h1 className="mb-6 text-xl font-semibold text-slate-800">PI Setup</h1>

      {/* Details */}
      <section className="mb-8 rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-700">Details</h2>
          {!editing && (
            <button
              onClick={startEditing}
              className="text-xs text-slate-500 hover:text-slate-800 transition-colors"
            >
              Edit
            </button>
          )}
        </div>
        <div className="px-5 py-4">
          {editing ? (
            <form onSubmit={submitDetails} className="space-y-4">
              {detailsError && <p className="text-sm text-red-600">{detailsError}</p>}
              <div>
                <label htmlFor="pi-name" className="mb-1 block text-sm font-medium text-slate-700">Name</label>
                <input
                  id="pi-name"
                  type="text"
                  value={form.name ?? ''}
                  onChange={(e) => setDetailsForm({ ...detailsForm!, name: e.target.value })}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="pi-start" className="mb-1 block text-sm font-medium text-slate-700">Start Date</label>
                  <input
                    id="pi-start"
                    type="date"
                    value={form.start_date ?? ''}
                    onChange={(e) => setDetailsForm({ ...detailsForm!, start_date: e.target.value })}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                  />
                </div>
                <div>
                  <label htmlFor="pi-end" className="mb-1 block text-sm font-medium text-slate-700">End Date</label>
                  <input
                    id="pi-end"
                    type="date"
                    value={form.end_date ?? ''}
                    onChange={(e) => setDetailsForm({ ...detailsForm!, end_date: e.target.value })}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                  />
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => { setDetailsForm(null); setDetailsError(''); }}
                  className="rounded-md px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatePIMut.isPending}
                  className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 transition-colors"
                >
                  {updatePIMut.isPending ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          ) : (
            <dl className="space-y-2 text-sm">
              <div className="flex gap-4">
                <dt className="w-24 text-slate-500">Name</dt>
                <dd className="font-medium text-slate-800">{pi.name}</dd>
              </div>
              <div className="flex gap-4">
                <dt className="w-24 text-slate-500">Status</dt>
                <dd><PIStatusBadge status={pi.status} /></dd>
              </div>
              <div className="flex gap-4">
                <dt className="w-24 text-slate-500">Dates</dt>
                <dd className="text-slate-700">{pi.start_date} – {pi.end_date}</dd>
              </div>
            </dl>
          )}
        </div>
      </section>

      {/* Lifecycle */}
      <section className="mb-8 rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-700">Lifecycle</h2>
        </div>
        <div className="px-5 py-4">
          {lifecycleError && <p className="mb-3 text-sm text-red-600">{lifecycleError}</p>}
          <div className="flex gap-3">
            <button
              onClick={() => { setLifecycleError(''); activateMut.mutate(); }}
              disabled={pi.status !== 'planning' || activateMut.isPending}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-40 transition-colors"
            >
              Activate
            </button>
            <button
              onClick={() => { setLifecycleError(''); closeMut.mutate(); }}
              disabled={pi.status !== 'active' || closeMut.isPending}
              className="rounded-md bg-slate-600 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40 transition-colors"
            >
              Close
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            {pi.status === 'planning' && 'Activate when PI Planning is complete.'}
            {pi.status === 'active' && 'Close after the PI System Demo and Inspect & Adapt.'}
            {pi.status === 'closed' && 'This PI is closed and cannot be transitioned further.'}
          </p>
        </div>
      </section>

      {/* Iterations */}
      <section className="mb-8 rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-700">
            Iterations ({sortedIters.length})
          </h2>
          {!showIterForm && (
            <button
              onClick={openIterForm}
              className="text-xs text-slate-500 hover:text-slate-800 transition-colors"
            >
              + Add
            </button>
          )}
        </div>

        {sortedIters.length > 0 && (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                {['#', 'Name', 'Start', 'End', 'IP?', ''].map((h) => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedIters.map((it) => (
                <tr key={it.id}>
                  <td className="px-4 py-2 text-slate-700">{it.number}</td>
                  <td className="px-4 py-2 text-slate-700">{it.name || '—'}</td>
                  <td className="px-4 py-2 text-slate-500">{it.start_date}</td>
                  <td className="px-4 py-2 text-slate-500">{it.end_date}</td>
                  <td className="px-4 py-2 text-slate-500">{it.is_ip ? 'Yes' : 'No'}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => deleteIterMut.mutate(it.id)}
                      disabled={deleteIterMut.isPending}
                      className="text-xs text-red-500 hover:text-red-700 transition-colors"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {showIterForm && (
          <form onSubmit={submitIter} className="border-t border-slate-100 px-5 py-4 space-y-4">
            <h3 className="text-sm font-medium text-slate-700">New Iteration</h3>
            {iterError && <p className="text-sm text-red-600">{iterError}</p>}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="iter-number" className="mb-1 block text-xs font-medium text-slate-700">Number</label>
                <input
                  id="iter-number"
                  type="number"
                  min={1}
                  value={iterForm.number}
                  onChange={(e) => setIterForm({ ...iterForm, number: Number(e.target.value) })}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                />
              </div>
              <div>
                <label htmlFor="iter-name" className="mb-1 block text-xs font-medium text-slate-700">Name (optional)</label>
                <input
                  id="iter-name"
                  type="text"
                  value={iterForm.name}
                  onChange={(e) => setIterForm({ ...iterForm, name: e.target.value })}
                  placeholder="e.g. Innovation & Planning"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                />
              </div>
              <div>
                <label htmlFor="iter-start" className="mb-1 block text-xs font-medium text-slate-700">Start Date</label>
                <input
                  id="iter-start"
                  type="date"
                  value={iterForm.start_date}
                  onChange={(e) => setIterForm({ ...iterForm, start_date: e.target.value })}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                />
              </div>
              <div>
                <label htmlFor="iter-end" className="mb-1 block text-xs font-medium text-slate-700">End Date</label>
                <input
                  id="iter-end"
                  type="date"
                  value={iterForm.end_date}
                  onChange={(e) => setIterForm({ ...iterForm, end_date: e.target.value })}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={iterForm.is_ip}
                onChange={(e) => setIterForm({ ...iterForm, is_ip: e.target.checked })}
                className="rounded"
              />{' '}
              Innovation &amp; Planning (IP) iteration
            </label>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => { setShowIterForm(false); setIterError(''); }}
                className="rounded-md px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createIterMut.isPending}
                className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 transition-colors"
              >
                {createIterMut.isPending ? 'Adding…' : 'Add Iteration'}
              </button>
            </div>
          </form>
        )}

        {sortedIters.length === 0 && !showIterForm && (
          <p className="px-5 py-4 text-sm text-slate-400">No iterations yet. Add one to start planning.</p>
        )}
      </section>

      {/* Danger zone */}
      <section className="rounded-lg border border-red-200 bg-white shadow-sm">
        <div className="border-b border-red-200 px-5 py-3">
          <h2 className="text-sm font-semibold text-red-700">Danger Zone</h2>
        </div>
        <div className="px-5 py-4">
          {deleteConfirm ? (
            <div className="space-y-3">
              {lifecycleError && <p className="text-sm text-red-600">{lifecycleError}</p>}
              <p className="text-sm font-medium text-slate-700">
                Are you sure? This cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => { setDeleteConfirm(false); setLifecycleError(''); }}
                  className="rounded-md px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deletePIMut.mutate()}
                  disabled={deletePIMut.isPending}
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {deletePIMut.isPending ? 'Deleting…' : 'Yes, delete'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700">Delete this PI</p>
                <p className="text-xs text-slate-400">Permanently removes the PI and its iterations. Features, risks, and dependencies must be deleted first.</p>
              </div>
              <button
                onClick={() => setDeleteConfirm(true)}
                className="ml-4 rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
              >
                Delete PI
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
