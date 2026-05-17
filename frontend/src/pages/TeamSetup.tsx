import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import { TOPOLOGY_LABELS, TopologyBadge } from '../components/Badge';
import { Spinner } from '../components/Spinner';
import { useToast } from '../components/Toaster';
import type { Team, TeamCreate, TeamTopologyType, TeamUpdate } from '../types';

interface EditState {
  teamId: string;
  name: string;
  member_count: number;
  topology_type: TeamTopologyType | null;
}

interface AddState {
  name: string;
  member_count: number;
  topology_type: TeamTopologyType | null;
}

const EMPTY_ADD: AddState = { name: '', member_count: 5, topology_type: null };

const TOPOLOGY_OPTIONS: { value: TeamTopologyType; label: string }[] = [
  { value: 'stream_aligned', label: TOPOLOGY_LABELS.stream_aligned },
  { value: 'enabling', label: TOPOLOGY_LABELS.enabling },
  { value: 'complicated_subsystem', label: TOPOLOGY_LABELS.complicated_subsystem },
  { value: 'platform', label: TOPOLOGY_LABELS.platform },
];

function TopologySelect({
  value,
  onChange,
  id,
}: Readonly<{
  value: TeamTopologyType | null;
  onChange: (v: TeamTopologyType | null) => void;
  id?: string;
}>) {
  return (
    <select
      id={id}
      value={value ?? ''}
      onChange={(e) => onChange((e.target.value as TeamTopologyType) || null)}
      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
    >
      <option value="">— None —</option>
      {TOPOLOGY_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function TeamSetup() {
  const { piId } = useParams<{ piId: string }>();
  const qc = useQueryClient();
  const toast = useToast();

  const { data: pi, isLoading: loadingPi } = useQuery({
    queryKey: ['pi', piId],
    queryFn: () => api.getPI(piId!),
    enabled: !!piId,
  });

  const { data: art } = useQuery({
    queryKey: ['art', pi?.art_id],
    queryFn: () => api.listARTs().then((arts) => arts.find((a) => a.id === pi!.art_id)),
    enabled: !!pi?.art_id,
  });

  const { data: teams = [], isLoading: loadingTeams } = useQuery({
    queryKey: ['teams', pi?.art_id],
    queryFn: () => api.listTeamsByArt(pi!.art_id),
    enabled: !!pi?.art_id,
  });

  const [edit, setEdit] = useState<EditState | null>(null);
  const [editError, setEditError] = useState('');

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<AddState>(EMPTY_ADD);
  const [addError, setAddError] = useState('');

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: TeamUpdate }) => api.updateTeam(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams', pi?.art_id] });
      setEdit(null);
      setEditError('');
      toast('Team updated');
    },
    onError: (e: Error) => setEditError(e.message),
  });

  const createMut = useMutation({
    mutationFn: (body: TeamCreate) => api.createTeam(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams', pi?.art_id] });
      setAddOpen(false);
      setAddForm(EMPTY_ADD);
      setAddError('');
      toast('Team created');
    },
    onError: (e: Error) => setAddError(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteTeam(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams', pi?.art_id] });
      setDeleteId(null);
      setDeleteError('');
      toast('Team deleted');
    },
    onError: (e: Error) => setDeleteError(e.message),
  });

  if (loadingPi || loadingTeams) return <Spinner />;

  function startEdit(team: Team) {
    setEdit({
      teamId: team.id,
      name: team.name,
      member_count: team.member_count,
      topology_type: team.topology_type,
    });
    setEditError('');
    setDeleteId(null);
  }

  function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!edit!.name.trim()) { setEditError('Name is required.'); return; }
    if (edit!.member_count < 1) { setEditError('Member count must be at least 1.'); return; }
    updateMut.mutate({
      id: edit!.teamId,
      body: { name: edit!.name, member_count: edit!.member_count, topology_type: edit!.topology_type },
    });
  }

  function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!addForm.name.trim()) { setAddError('Name is required.'); return; }
    if (addForm.member_count < 1) { setAddError('Member count must be at least 1.'); return; }
    createMut.mutate({
      name: addForm.name,
      member_count: addForm.member_count,
      art_id: pi!.art_id,
      topology_type: addForm.topology_type,
    });
  }

  const sortedTeams = [...teams].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="p-3 sm:p-6 max-w-2xl">
      <h1 className="mb-1 text-xl font-semibold text-slate-800">Team Setup</h1>
      {art && (
        <p className="mb-6 text-sm text-slate-500">{art.name}</p>
      )}

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-700">
            Teams ({sortedTeams.length})
          </h2>
          {!addOpen && (
            <button
              onClick={() => { setAddOpen(true); setAddForm(EMPTY_ADD); setAddError(''); }}
              className="text-xs text-slate-500 hover:text-slate-800 transition-colors"
            >
              + Add Team
            </button>
          )}
        </div>

        {sortedTeams.length > 0 && (
          <>
            {/* Mobile card list */}
            <div className="block md:hidden divide-y divide-slate-100">
              {sortedTeams.map((team) => {
                if (edit?.teamId === team.id) {
                  return (
                    <div key={team.id} className="px-4 py-4">
                      <form onSubmit={submitEdit} className="space-y-3">
                        {editError && <p className="text-xs text-red-600">{editError}</p>}
                        <div>
                          <label htmlFor={`edit-name-${team.id}`} className="mb-1 block text-xs font-medium text-slate-700">Name</label>
                          <input
                            id={`edit-name-${team.id}`}
                            type="text"
                            value={edit.name}
                            onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                          />
                        </div>
                        <div>
                          <label htmlFor={`edit-members-${team.id}`} className="mb-1 block text-xs font-medium text-slate-700">Members</label>
                          <input
                            id={`edit-members-${team.id}`}
                            type="number"
                            min={1}
                            value={edit.member_count}
                            onChange={(e) => setEdit({ ...edit, member_count: Number(e.target.value) })}
                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                          />
                        </div>
                        <div>
                          <label htmlFor={`edit-topology-${team.id}`} className="mb-1 block text-xs font-medium text-slate-700">Topology Type</label>
                          <select
                            id={`edit-topology-${team.id}`}
                            value={edit.topology_type ?? ''}
                            onChange={(e) =>
                              setEdit({ ...edit, topology_type: (e.target.value as TeamTopologyType) || null })
                            }
                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                          >
                            <option value="">— None —</option>
                            {TOPOLOGY_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            disabled={updateMut.isPending}
                            className="rounded-md bg-slate-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 transition-colors"
                          >
                            {updateMut.isPending ? 'Saving…' : 'Save'}
                          </button>
                          <button
                            type="button"
                            onClick={() => { setEdit(null); setEditError(''); }}
                            className="rounded-md bg-white px-4 py-2.5 text-sm text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    </div>
                  );
                }

                if (deleteId === team.id) {
                  return (
                    <div key={team.id} className="bg-red-50 px-4 py-4">
                      {deleteError && <p className="mb-2 text-xs text-red-600">{deleteError}</p>}
                      <p className="mb-3 text-sm text-slate-700">Delete <strong>{team.name}</strong>?</p>
                      <div className="flex gap-3">
                        <button
                          onClick={() => deleteMut.mutate(team.id)}
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
                  <div key={team.id} className="px-4 py-4">
                    <p className="mb-1 font-medium text-slate-800">{team.name}</p>
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span className="text-xs text-slate-500">{team.member_count} members</span>
                      <TopologyBadge type={team.topology_type} />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEdit(team)}
                        className="rounded-md bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-200 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => { setDeleteId(team.id); setDeleteError(''); setEdit(null); }}
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
                <thead className="border-b border-slate-100 bg-slate-50">
                  <tr>
                    {['Name', 'Members', 'Topology Type', ''].map((h) => (
                      <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedTeams.map((team) => {
                    if (edit?.teamId === team.id) {
                      return (
                        <tr key={team.id}>
                          <td colSpan={4} className="px-4 py-3">
                            <form onSubmit={submitEdit} className="flex flex-wrap items-center gap-3">
                              {editError && <span className="w-full text-xs text-red-600">{editError}</span>}
                              <input
                                type="text"
                                value={edit.name}
                                onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                                aria-label="Team name"
                                className="w-40 rounded-md border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                              />
                              <input
                                type="number"
                                min={1}
                                value={edit.member_count}
                                onChange={(e) => setEdit({ ...edit, member_count: Number(e.target.value) })}
                                aria-label="Member count"
                                className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                              />
                              <select
                                value={edit.topology_type ?? ''}
                                onChange={(e) =>
                                  setEdit({ ...edit, topology_type: (e.target.value as TeamTopologyType) || null })
                                }
                                aria-label="Topology type"
                                className="rounded-md border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                              >
                                <option value="">— None —</option>
                                {TOPOLOGY_OPTIONS.map((o) => (
                                  <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                              </select>
                              <button
                                type="submit"
                                disabled={updateMut.isPending}
                                className="rounded-md bg-slate-800 px-3 py-1 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50 transition-colors"
                              >
                                {updateMut.isPending ? 'Saving…' : 'Save'}
                              </button>
                              <button
                                type="button"
                                onClick={() => { setEdit(null); setEditError(''); }}
                                className="text-xs text-slate-500 hover:text-slate-800 transition-colors"
                              >
                                Cancel
                              </button>
                            </form>
                          </td>
                        </tr>
                      );
                    }

                    if (deleteId === team.id) {
                      return (
                        <tr key={team.id} className="bg-red-50">
                          <td colSpan={4} className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              {deleteError && <span className="text-xs text-red-600">{deleteError}</span>}
                              <span className="text-sm text-slate-700">Delete <strong>{team.name}</strong>?</span>
                              <button
                                onClick={() => deleteMut.mutate(team.id)}
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
                      <tr key={team.id}>
                        <td className="px-4 py-2.5 font-medium text-slate-800">{team.name}</td>
                        <td className="px-4 py-2.5 text-slate-500">{team.member_count}</td>
                        <td className="px-4 py-2.5">
                          <TopologyBadge type={team.topology_type} />
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            onClick={() => startEdit(team)}
                            className="mr-3 text-xs text-slate-500 hover:text-slate-800 transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => { setDeleteId(team.id); setDeleteError(''); setEdit(null); }}
                            className="text-xs text-red-500 hover:text-red-700 transition-colors"
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
          </>
        )}

        {addOpen && (
          <form onSubmit={submitAdd} className="border-t border-slate-100 px-5 py-4 space-y-4">
            <h3 className="text-sm font-medium text-slate-700">New Team</h3>
            {addError && <p className="text-sm text-red-600">{addError}</p>}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="team-name" className="mb-1 block text-xs font-medium text-slate-700">
                  Name
                </label>
                <input
                  id="team-name"
                  type="text"
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  placeholder="e.g. Gamma"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                />
              </div>
              <div>
                <label htmlFor="team-members" className="mb-1 block text-xs font-medium text-slate-700">
                  Members
                </label>
                <input
                  id="team-members"
                  type="number"
                  min={1}
                  value={addForm.member_count}
                  onChange={(e) => setAddForm({ ...addForm, member_count: Number(e.target.value) })}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                />
              </div>
              <div className="col-span-2">
                <label htmlFor="team-topology" className="mb-1 block text-xs font-medium text-slate-700">
                  Topology Type <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <TopologySelect
                  id="team-topology"
                  value={addForm.topology_type}
                  onChange={(v) => setAddForm({ ...addForm, topology_type: v })}
                />
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => { setAddOpen(false); setAddError(''); }}
                className="rounded-md px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createMut.isPending}
                className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 transition-colors"
              >
                {createMut.isPending ? 'Adding…' : 'Add Team'}
              </button>
            </div>
          </form>
        )}

        {sortedTeams.length === 0 && !addOpen && (
          <p className="px-5 py-4 text-sm text-slate-400">
            No teams in this ART yet. Add one to get started.
          </p>
        )}
      </div>
    </div>
  );
}
