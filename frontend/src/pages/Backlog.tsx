import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Fragment, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import type {
  Feature,
  FeatureCreate,
  FeatureStatus,
  FeatureUpdate,
  Iteration,
  Story,
  StoryCreate,
  StoryStatus,
  StoryUpdate,
  Team,
} from '../types';
import { FeatureStatusBadge, StoryStatusBadge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { Modal } from '../components/Modal';
import { Pagination } from '../components/Pagination';
import { Spinner } from '../components/Spinner';
import { useToast } from '../components/Toaster';
import { usePagination } from '../hooks/usePagination';

const FEATURE_STATUS_OPTIONS: FeatureStatus[] = ['funnel', 'analyzing', 'backlog', 'implementing', 'done'];
const STORY_STATUS_OPTIONS: StoryStatus[] = ['not_started', 'in_progress', 'done', 'accepted'];

// ---------- Story panel ----------

interface StoryFormState {
  name: string;
  team_id: string;
  iteration_id: string;
  points: number;
  status: StoryStatus;
}

interface StoryEditState {
  name: string;
  iteration_id: string;
  points: number;
  status: StoryStatus;
}

function StoryPanel({
  feature,
  teams,
  nonIpIterations,
  piId,
}: Readonly<{
  feature: Feature;
  teams: Team[];
  nonIpIterations: Iteration[];
  piId: string;
}>) {
  const qc = useQueryClient();
  const toast = useToast();

  const { data: stories = [], isLoading } = useQuery({
    queryKey: ['stories', feature.id],
    queryFn: () => api.listStoriesByFeature(feature.id),
  });

  const defaultTeamId = feature.team_id ?? (teams[0]?.id ?? '');

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<StoryFormState>({
    name: '',
    team_id: defaultTeamId,
    iteration_id: '',
    points: 3,
    status: 'not_started',
  });
  const [addError, setAddError] = useState('');

  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<StoryEditState>({
    name: '',
    iteration_id: '',
    points: 1,
    status: 'not_started',
  });
  const [editError, setEditError] = useState('');

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['stories', feature.id] });
    qc.invalidateQueries({ queryKey: ['features', piId] });
  };

  const createMut = useMutation({
    mutationFn: (body: StoryCreate) => api.createStory(body),
    onSuccess: () => {
      invalidate();
      setAddOpen(false);
      setAddForm({ name: '', team_id: defaultTeamId, iteration_id: '', points: 3, status: 'not_started' });
      setAddError('');
      toast('Story added');
    },
    onError: (e: Error) => setAddError(e.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: StoryUpdate }) => api.updateStory(id, body),
    onSuccess: () => { invalidate(); setEditId(null); setEditError(''); toast('Story updated'); },
    onError: (e: Error) => setEditError(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteStory(id),
    onSuccess: () => { invalidate(); setDeleteId(null); setDeleteError(''); toast('Story deleted'); },
    onError: (e: Error) => setDeleteError(e.message),
  });

  const teamMap = Object.fromEntries(teams.map((t) => [t.id, t.name]));

  function startEdit(s: Story) {
    setEditId(s.id);
    setEditForm({ name: s.name, iteration_id: s.iteration_id ?? '', points: s.points, status: s.status });
    setEditError('');
    setDeleteId(null);
  }

  function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editForm.name.trim()) { setEditError('Name is required.'); return; }
    updateMut.mutate({
      id: editId!,
      body: { name: editForm.name, iteration_id: editForm.iteration_id || null, points: editForm.points, status: editForm.status },
    });
  }

  function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!addForm.name.trim()) { setAddError('Name is required.'); return; }
    if (!addForm.team_id) { setAddError('Team is required.'); return; }
    createMut.mutate({
      name: addForm.name,
      feature_id: feature.id,
      team_id: addForm.team_id,
      iteration_id: addForm.iteration_id || null,
      points: addForm.points,
      status: addForm.status,
    });
  }

  return (
    <tr>
      <td colSpan={9} className="bg-slate-50/60 px-6 pb-4 pt-0">
        <div className="rounded-md border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Stories {isLoading ? '…' : `(${stories.length})`}
            </span>
            {!addOpen && (
              <button
                onClick={() => setAddOpen(true)}
                className="text-xs text-slate-500 hover:text-slate-800 transition-colors"
              >
                + Add Story
              </button>
            )}
          </div>

          {stories.length > 0 && (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  {['Name', 'Team', 'Iteration', 'Pts', 'Status', ''].map((h) => (
                    <th key={h} className="px-3 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stories.map((story) => {
                  if (editId === story.id) {
                    return (
                      <tr key={story.id}>
                        <td colSpan={6} className="px-3 py-2">
                          <form onSubmit={submitEdit} className="flex flex-wrap items-center gap-2">
                            {editError && <span className="w-full text-xs text-red-600">{editError}</span>}
                            <input
                              type="text"
                              value={editForm.name}
                              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                              aria-label="Story name"
                              className="w-44 rounded border border-slate-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-slate-400"
                            />
                            <select
                              value={editForm.iteration_id}
                              onChange={(e) => setEditForm({ ...editForm, iteration_id: e.target.value })}
                              aria-label="Iteration"
                              className="rounded border border-slate-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-slate-400"
                            >
                              <option value="">No iteration</option>
                              {nonIpIterations.map((it) => (
                                <option key={it.id} value={it.id}>Iter {it.number}</option>
                              ))}
                            </select>
                            <input
                              type="number"
                              min={1}
                              value={editForm.points}
                              onChange={(e) => setEditForm({ ...editForm, points: Number(e.target.value) })}
                              aria-label="Points"
                              className="w-14 rounded border border-slate-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-slate-400"
                            />
                            <select
                              value={editForm.status}
                              onChange={(e) => setEditForm({ ...editForm, status: e.target.value as StoryStatus })}
                              aria-label="Status"
                              className="rounded border border-slate-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-slate-400"
                            >
                              {STORY_STATUS_OPTIONS.map((s) => (
                                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                              ))}
                            </select>
                            <button
                              type="submit"
                              disabled={updateMut.isPending}
                              className="rounded bg-slate-800 px-2 py-1 text-xs text-white hover:bg-slate-700 disabled:opacity-50 transition-colors"
                            >
                              {updateMut.isPending ? '…' : 'Save'}
                            </button>
                            <button
                              type="button"
                              onClick={() => { setEditId(null); setEditError(''); }}
                              className="text-xs text-slate-500 hover:text-slate-800 transition-colors"
                            >
                              Cancel
                            </button>
                          </form>
                        </td>
                      </tr>
                    );
                  }

                  if (deleteId === story.id) {
                    return (
                      <tr key={story.id} className="bg-red-50">
                        <td colSpan={6} className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            {deleteError && <span className="text-xs text-red-600">{deleteError}</span>}
                            <span className="text-xs text-slate-700">Delete <strong>{story.name}</strong>?</span>
                            <button
                              onClick={() => deleteMut.mutate(story.id)}
                              disabled={deleteMut.isPending}
                              className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                            >
                              {deleteMut.isPending ? '…' : 'Yes, delete'}
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
                    <tr key={story.id} className="hover:bg-slate-50/60">
                      <td className="px-3 py-2 text-slate-800">{story.name}</td>
                      <td className="px-3 py-2 text-xs text-slate-500">{teamMap[story.team_id] ?? '—'}</td>
                      <td className="px-3 py-2 text-xs text-slate-500">
                        {(() => {
                          if (!story.iteration_id) return '—';
                          const iter = nonIpIterations.find((i) => i.id === story.iteration_id);
                          return iter != null ? `Iter ${iter.number}` : '—';
                        })()}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-slate-700">{story.points}</td>
                      <td className="px-3 py-2"><StoryStatusBadge status={story.status} /></td>
                      <td className="px-3 py-2 whitespace-nowrap text-right">
                        <button
                          onClick={() => startEdit(story)}
                          className="mr-2 text-xs text-slate-500 hover:text-slate-800 underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => { setDeleteId(story.id); setDeleteError(''); setEditId(null); }}
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
          )}

          {addOpen && (
            <form onSubmit={submitAdd} className="border-t border-slate-100 px-4 py-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">New Story</p>
              {addError && <p className="mb-1 text-xs text-red-600">{addError}</p>}
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  placeholder="Name *"
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  aria-label="Story name"
                  className="w-44 rounded border border-slate-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-slate-400"
                />
                <select
                  value={addForm.team_id}
                  onChange={(e) => setAddForm({ ...addForm, team_id: e.target.value })}
                  aria-label="Team"
                  className="rounded border border-slate-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-slate-400"
                >
                  <option value="">Team *</option>
                  {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <select
                  value={addForm.iteration_id}
                  onChange={(e) => setAddForm({ ...addForm, iteration_id: e.target.value })}
                  aria-label="Iteration"
                  className="rounded border border-slate-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-slate-400"
                >
                  <option value="">Iteration</option>
                  {nonIpIterations.map((it) => (
                    <option key={it.id} value={it.id}>Iter {it.number}</option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  value={addForm.points}
                  onChange={(e) => setAddForm({ ...addForm, points: Number(e.target.value) })}
                  aria-label="Points"
                  className="w-14 rounded border border-slate-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-slate-400"
                />
                <button
                  type="submit"
                  disabled={createMut.isPending}
                  className="rounded bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50 transition-colors"
                >
                  {createMut.isPending ? 'Adding…' : 'Add'}
                </button>
                <button
                  type="button"
                  onClick={() => { setAddOpen(false); setAddError(''); }}
                  className="text-xs text-slate-500 hover:text-slate-800 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {stories.length === 0 && !addOpen && !isLoading && (
            <p className="px-4 py-3 text-xs text-slate-400">No stories yet.</p>
          )}
        </div>
      </td>
    </tr>
  );
}

// ---------- Feature form ----------

interface FeatureFormState {
  name: string;
  description: string;
  team_id: string | null;
  status: FeatureStatus;
  user_business_value: number;
  time_criticality: number;
  risk_reduction_opportunity_enablement: number;
  job_size: number;
}

const EMPTY_FORM: FeatureFormState = {
  name: '',
  description: '',
  team_id: null,
  status: 'backlog',
  user_business_value: 5,
  time_criticality: 5,
  risk_reduction_opportunity_enablement: 5,
  job_size: 5,
};

type NumKey = 'user_business_value' | 'time_criticality' | 'risk_reduction_opportunity_enablement' | 'job_size';

// ---------- Backlog page ----------

export function Backlog() {
  const { piId } = useParams<{ piId: string }>();
  const qc = useQueryClient();
  const toast = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Feature | null>(null);
  const [form, setForm] = useState<FeatureFormState>(EMPTY_FORM);
  const [error, setError] = useState('');
  const [expandedFeatureId, setExpandedFeatureId] = useState<string | null>(null);

  const { data: pi } = useQuery({
    queryKey: ['pi', piId],
    queryFn: () => api.getPI(piId!),
    enabled: !!piId,
  });

  const { data: features = [], isLoading } = useQuery({
    queryKey: ['features', piId],
    queryFn: () => api.listFeatures(piId!),
    enabled: !!piId,
  });

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: api.listTeams,
  });

  const { data: iterations = [] } = useQuery({
    queryKey: ['iterations', piId],
    queryFn: () => api.listIterations(piId!),
    enabled: !!piId,
  });

  const { data: allStories = [] } = useQuery({
    queryKey: ['stories'],
    queryFn: api.listStories,
  });

  const nonIpIterations = iterations.filter((it) => !it.is_ip).sort((a, b) => a.number - b.number);

  const storyCountByFeature = Object.fromEntries(
    features.map((f) => [f.id, allStories.filter((s) => s.feature_id === f.id).length])
  );

  const invalidate = () => qc.invalidateQueries({ queryKey: ['features', piId] });

  const createMut = useMutation({
    mutationFn: (body: FeatureCreate) => api.createFeature(body),
    onSuccess: () => { invalidate(); closeModal(); toast('Feature created'); },
    onError: (e: Error) => setError(e.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: FeatureUpdate }) => api.updateFeature(id, body),
    onSuccess: () => { invalidate(); closeModal(); toast('Feature updated'); },
    onError: (e: Error) => setError(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteFeature(id),
    onSuccess: () => { invalidate(); toast('Feature deleted'); },
    onError: (e: Error) => toast(e.message, 'error'),
  });

  const sorted = [...features].sort((a, b) => b.wsjf_score - a.wsjf_score);
  const { page, totalPages, pageItems: pageSorted, goTo } = usePagination(sorted, 25, piId);

  if (isLoading) return <Spinner />;

  const teamMap = Object.fromEntries(teams.map((t) => [t.id, t.name]));

  function openNew() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError('');
    setModalOpen(true);
  }

  function openEdit(f: Feature) {
    setEditing(f);
    setForm({
      name: f.name,
      description: f.description,
      team_id: f.team_id,
      status: f.status,
      user_business_value: f.user_business_value,
      time_criticality: f.time_criticality,
      risk_reduction_opportunity_enablement: f.risk_reduction_opportunity_enablement,
      job_size: f.job_size,
    });
    setError('');
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    setError('');
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError('Feature name is required.'); return; }
    if (editing) {
      updateMut.mutate({ id: editing.id, body: { ...form, team_id: form.team_id || null } });
    } else {
      createMut.mutate({ ...form, pi_id: piId!, team_id: form.team_id || null });
    }
  }

  function handleDelete(id: string) {
    if (!window.confirm('Delete this feature?')) return;
    deleteMut.mutate(id);
  }

  function toggleExpand(featureId: string) {
    setExpandedFeatureId((prev) => (prev === featureId ? null : featureId));
  }

  const isPending = createMut.isPending || updateMut.isPending;

  function numInput(label: string, key: NumKey, min: number, max: number) {
    const id = `feature-${key.replace(/_/g, '-')}`;
    return (
      <div>
        <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
          {label}
          <span aria-hidden="true" className="font-normal text-slate-400"> ({min}–{max})</span>
        </label>
        <input
          id={id}
          type="number"
          min={min}
          max={max}
          value={form[key]}
          onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
        />
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-y-2">
        <div>
          <h1 className="mb-1 text-xl font-semibold text-slate-800">
            Program Backlog — {pi?.name}
          </h1>
          <p className="text-sm text-slate-500">Features ranked by WSJF score (highest first)</p>
        </div>
        <button
          onClick={openNew}
          className="rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 transition-colors"
        >
          + New Feature
        </button>
      </div>

      {sorted.length === 0 ? (
        <EmptyState message="No features in this PI." />
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          {/* Mobile card list */}
          <div className="block md:hidden divide-y divide-slate-100">
            {pageSorted.map((f, i) => (
              <div key={f.id} className="px-4 py-4">
                <div className="mb-1 flex items-start justify-between gap-2">
                  <button
                    onClick={() => openEdit(f)}
                    className="text-left font-medium text-slate-800 hover:text-slate-600 leading-snug"
                  >
                    {f.name}
                  </button>
                  <span className="shrink-0 tabular-nums font-bold text-slate-800 text-sm">
                    {f.wsjf_score}
                  </span>
                </div>
                {f.description && (
                  <p className="mb-2 text-xs text-slate-400 line-clamp-1">{f.description}</p>
                )}
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <FeatureStatusBadge status={f.status} />
                  {f.team_id && (
                    <span className="text-xs text-slate-500">{teamMap[f.team_id] ?? f.team_id}</span>
                  )}
                </div>
                <div className="mb-3 flex gap-4 text-xs text-slate-500">
                  <span>#{(page - 1) * 25 + i + 1}</span>
                  <span>CoD: {f.cost_of_delay}</span>
                  <span>Size: {f.job_size}</span>
                  {storyCountByFeature[f.id] > 0 && (
                    <span>{storyCountByFeature[f.id]} stor{storyCountByFeature[f.id] === 1 ? 'y' : 'ies'}</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => openEdit(f)}
                    className="rounded-md bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-200 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(f.id)}
                    className="rounded-md bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-100 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  {['#', 'Feature', 'Status', 'Team', 'CoD', 'Size', 'WSJF', 'Stories', ''].map((h) => (
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
                {pageSorted.map((f, i) => (
                  <Fragment key={f.id}>
                    <tr className="hover:bg-slate-50/60">
                      <td className="px-4 py-2.5 text-slate-400 tabular-nums">{(page - 1) * 25 + i + 1}</td>
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => openEdit(f)}
                          className="font-medium text-slate-800 hover:text-slate-600 hover:underline text-left"
                        >
                          {f.name}
                        </button>
                        {f.description && (
                          <p className="mt-0.5 text-xs text-slate-400 line-clamp-1">
                            {f.description}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <FeatureStatusBadge status={f.status} />
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {f.team_id ? teamMap[f.team_id] ?? f.team_id : '—'}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-slate-700">{f.cost_of_delay}</td>
                      <td className="px-4 py-2.5 tabular-nums text-slate-700">{f.job_size}</td>
                      <td className="px-4 py-2.5">
                        <span className="font-semibold text-slate-800 tabular-nums">{f.wsjf_score}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => toggleExpand(f.id)}
                          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 transition-colors"
                          aria-expanded={expandedFeatureId === f.id}
                        >
                          <span>{expandedFeatureId === f.id ? '▼' : '▶'}</span>
                          <span>Stories{storyCountByFeature[f.id] > 0 ? ` (${storyCountByFeature[f.id]})` : ''}</span>
                        </button>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <button
                          onClick={() => openEdit(f)}
                          className="mr-3 text-xs text-slate-500 hover:text-slate-800 underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(f.id)}
                          className="text-xs text-red-400 hover:text-red-600 underline"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                    {expandedFeatureId === f.id && (
                      <StoryPanel
                        key={`stories-${f.id}`}
                        feature={f}
                        teams={teams}
                        nonIpIterations={nonIpIterations}
                        piId={piId!}
                      />
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={totalPages} onPageChange={goTo} />
        </div>
      )}

      <Modal
        open={modalOpen}
        title={editing ? 'Edit Feature' : 'New Feature'}
        onClose={closeModal}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-red-600">{error}</p>}

          <div>
            <label htmlFor="feature-name" className="mb-1 block text-sm font-medium text-slate-700">
              Name<span aria-hidden="true"> *</span>
            </label>
            <input
              id="feature-name"
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
          </div>

          <div>
            <label htmlFor="feature-description" className="mb-1 block text-sm font-medium text-slate-700">Description</label>
            <textarea
              id="feature-description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="feature-status" className="mb-1 block text-sm font-medium text-slate-700">Status</label>
              <select
                id="feature-status"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as FeatureStatus })}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
              >
                {FEATURE_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="feature-team" className="mb-1 block text-sm font-medium text-slate-700">Team</label>
              <select
                id="feature-team"
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
          </div>

          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            WSJF Inputs
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {numInput('User / Business Value', 'user_business_value', 1, 10)}
            {numInput('Time Criticality', 'time_criticality', 1, 10)}
            {numInput('Risk Reduction / OE', 'risk_reduction_opportunity_enablement', 1, 10)}
            {numInput('Job Size', 'job_size', 1, 13)}
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
                return 'Add Feature';
              })()}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
