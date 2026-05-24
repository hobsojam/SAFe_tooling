import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../api';
import { Spinner } from '../components/Spinner';
import { useToast } from '../components/Toaster';
import type { ART, ARTCreate, ARTUpdate } from '../types';

interface EditState {
  artId: string;
  name: string;
}

export function ARTSetup() {
  const qc = useQueryClient();
  const toast = useToast();

  const { data: arts = [], isLoading } = useQuery({
    queryKey: ['arts'],
    queryFn: api.listARTs,
  });

  const [edit, setEdit] = useState<EditState | null>(null);
  const [editError, setEditError] = useState('');

  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState('');
  const [addError, setAddError] = useState('');

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: ARTUpdate }) => api.updateART(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['arts'] });
      setEdit(null);
      setEditError('');
      toast('ART updated');
    },
    onError: (e: Error) => setEditError(e.message),
  });

  const createMut = useMutation({
    mutationFn: (body: ARTCreate) => api.createART(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['arts'] });
      setAddOpen(false);
      setAddName('');
      setAddError('');
      toast('ART created');
    },
    onError: (e: Error) => setAddError(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteART(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['arts'] });
      setDeleteId(null);
      setDeleteError('');
      toast('ART deleted');
    },
    onError: (e: Error) => setDeleteError(e.message),
  });

  if (isLoading) return <Spinner />;

  function startEdit(art: ART) {
    setEdit({ artId: art.id, name: art.name });
    setEditError('');
    setDeleteId(null);
  }

  function submitEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!edit!.name.trim()) { setEditError('Name is required.'); return; }
    updateMut.mutate({ id: edit!.artId, body: { name: edit!.name } });
  }

  function submitAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!addName.trim()) { setAddError('Name is required.'); return; }
    createMut.mutate({ name: addName });
  }

  const sortedArts = [...arts].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="p-3 sm:p-6 max-w-2xl">
      <h1 className="mb-6 text-xl font-semibold text-slate-800">ART Setup</h1>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-700">
            Agile Release Trains ({sortedArts.length})
          </h2>
          {!addOpen && (
            <button
              onClick={() => { setAddOpen(true); setAddName(''); setAddError(''); }}
              className="text-xs text-slate-500 hover:text-slate-800 transition-colors"
            >
              + Add ART
            </button>
          )}
        </div>

        {sortedArts.length > 0 && (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                {['Name', 'Teams', ''].map((h) => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedArts.map((art) => {
                if (edit?.artId === art.id) {
                  return (
                    <tr key={art.id}>
                      <td colSpan={3} className="px-4 py-3">
                        <form onSubmit={submitEdit} className="flex items-center gap-3">
                          {editError && <span className="text-xs text-red-600">{editError}</span>}
                          <input
                            type="text"
                            value={edit.name}
                            onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                            aria-label="ART name"
                            className="w-56 rounded-md border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                          />
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

                if (deleteId === art.id) {
                  return (
                    <tr key={art.id} className="bg-red-50">
                      <td colSpan={3} className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {deleteError && <span className="text-xs text-red-600">{deleteError}</span>}
                          <span className="text-sm text-slate-700">Delete <strong>{art.name}</strong>?</span>
                          <button
                            onClick={() => deleteMut.mutate(art.id)}
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
                  <tr key={art.id}>
                    <td className="px-4 py-2.5 font-medium text-slate-800">{art.name}</td>
                    <td className="px-4 py-2.5 text-slate-500">{art.team_ids.length}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => startEdit(art)}
                        className="mr-3 text-xs text-slate-500 hover:text-slate-800 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => { setDeleteId(art.id); setDeleteError(''); setEdit(null); }}
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
        )}

        {addOpen && (
          <form onSubmit={submitAdd} className="border-t border-slate-100 px-5 py-4 space-y-4">
            <h3 className="text-sm font-medium text-slate-700">New ART</h3>
            {addError && <p className="text-sm text-red-600">{addError}</p>}
            <div>
              <label htmlFor="art-name" className="mb-1 block text-xs font-medium text-slate-700">
                Name
              </label>
              <input
                id="art-name"
                type="text"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="e.g. Platform ART"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
              />
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
                {createMut.isPending ? 'Adding…' : 'Add ART'}
              </button>
            </div>
          </form>
        )}

        {sortedArts.length === 0 && !addOpen && (
          <p className="px-5 py-4 text-sm text-slate-400">
            No ARTs yet. Add one to get started — you will need an ART before you can create a PI.
          </p>
        )}
      </div>
    </div>
  );
}
