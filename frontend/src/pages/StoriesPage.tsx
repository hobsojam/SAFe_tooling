import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api";
import type { Story, StoryCreate, StoryStatus, StoryUpdate } from "../types";
import { StoryStatusBadge } from "../components/Badge";
import { EmptyState } from "../components/EmptyState";
import { Modal } from "../components/Modal";
import { Pagination } from "../components/Pagination";
import { Spinner } from "../components/Spinner";
import { useToast } from "../components/Toaster";
import { usePagination } from "../hooks/usePagination";

const STATUS_OPTIONS: StoryStatus[] = ["not_started", "in_progress", "done", "accepted"];

interface StoryFormState {
  name: string;
  feature_id: string;
  team_id: string;
  iteration_id: string | null;
  points: number;
  status: StoryStatus;
}

const EMPTY_FORM: StoryFormState = {
  name: "",
  feature_id: "",
  team_id: "",
  iteration_id: null,
  points: 0,
  status: "not_started",
};

export function StoriesPage() {
  const { piId = "" } = useParams<{ piId: string }>();
  const qc = useQueryClient();
  const toast = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Story | null>(null);
  const [form, setForm] = useState<StoryFormState>(EMPTY_FORM);
  const [error, setError] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");

  const { data: pi } = useQuery({
    queryKey: ["pi", piId],
    queryFn: () => api.getPI(piId),
    enabled: !!piId,
  });

  const { data: features = [], isLoading: featuresLoading } = useQuery({
    queryKey: ["features", piId],
    queryFn: () => api.listFeatures(piId),
    enabled: !!piId,
  });

  const { data: allStories = [], isLoading: storiesLoading } = useQuery({
    queryKey: ["stories"],
    queryFn: api.listStories,
  });

  const { data: iterations = [] } = useQuery({
    queryKey: ["iterations", piId],
    queryFn: () => api.listIterations(piId),
    enabled: !!piId,
  });

  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: api.listTeams,
  });

  const featureIds = new Set(features.map((f) => f.id));
  const stories = allStories.filter((s) => featureIds.has(s.feature_id));
  const { page, totalPages, pageItems: pageStories, goTo } = usePagination(stories, 25, piId);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["stories"] });

  const createMut = useMutation({
    mutationFn: (body: StoryCreate) => api.createStory(body),
    onSuccess: () => {
      invalidate();
      closeModal();
      toast("Story added");
    },
    onError: (e: Error) => setError(e.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: StoryUpdate }) => api.updateStory(id, body),
    onSuccess: () => {
      invalidate();
      closeModal();
      toast("Story updated");
    },
    onError: (e: Error) => setError(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteStory(id),
    onSuccess: () => {
      invalidate();
      setDeleteId(null);
      setDeleteError("");
      toast("Story deleted");
    },
    onError: (e: Error) => setDeleteError(e.message),
  });

  if (featuresLoading || storiesLoading) return <Spinner />;

  const featureMap = Object.fromEntries(features.map((f) => [f.id, f.name]));
  const iterationMap = Object.fromEntries(iterations.map((i) => [i.id, i.name]));
  const teamMap = Object.fromEntries(teams.map((t) => [t.id, t.name]));

  function openNew() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, feature_id: features[0]?.id ?? "", team_id: teams[0]?.id ?? "" });
    setError("");
    setModalOpen(true);
  }

  function openEdit(s: Story) {
    setEditing(s);
    setForm({
      name: s.name,
      feature_id: s.feature_id,
      team_id: s.team_id,
      iteration_id: s.iteration_id,
      points: s.points,
      status: s.status,
    });
    setError("");
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    setError("");
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }
    if (!form.feature_id) {
      setError("Feature is required.");
      return;
    }
    if (!form.team_id) {
      setError("Team is required.");
      return;
    }
    if (form.points < 0) {
      setError("Points must be 0 or more.");
      return;
    }
    if (editing) {
      updateMut.mutate({
        id: editing.id,
        body: {
          name: form.name,
          feature_id: form.feature_id,
          iteration_id: form.iteration_id,
          points: form.points,
          status: form.status,
        },
      });
    } else {
      createMut.mutate({
        name: form.name,
        feature_id: form.feature_id,
        team_id: form.team_id,
        iteration_id: form.iteration_id,
        points: form.points,
        status: form.status,
      });
    }
  }

  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <div className="p-6">
      <div className="mb-5 flex items-baseline justify-between">
        <div>
          <h1 className="mb-1 text-xl font-semibold text-slate-800">Stories — {pi?.name}</h1>
          <p className="text-sm text-slate-500">
            {stories.length} stor{stories.length === 1 ? "y" : "ies"}
          </p>
        </div>
        <button
          onClick={openNew}
          disabled={features.length === 0}
          title={features.length === 0 ? "Add a feature first" : undefined}
          className="rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 transition-colors"
        >
          + New Story
        </button>
      </div>

      {stories.length === 0 ? (
        <EmptyState
          message={
            features.length === 0 ? "No features in this PI yet." : "No stories for this PI."
          }
        />
      ) : (
        <div className="overflow-x-auto overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                {["Name", "Feature", "Team", "Iteration", "Points", "Status", ""].map((h) => (
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
              {pageStories.map((s) => {
                if (deleteId === s.id) {
                  return (
                    <tr key={s.id} className="bg-red-50">
                      <td colSpan={7} className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {deleteError && (
                            <span className="text-xs text-red-600">{deleteError}</span>
                          )}
                          <span className="text-sm text-slate-700">
                            Delete{" "}
                            <strong>
                              {s.name.slice(0, 60)}
                              {s.name.length > 60 ? "…" : ""}
                            </strong>{" "}
                            ?
                          </span>
                          <button
                            onClick={() => deleteMut.mutate(s.id)}
                            disabled={deleteMut.isPending}
                            className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                          >
                            {deleteMut.isPending ? "Deleting…" : "Yes, delete"}
                          </button>
                          <button
                            onClick={() => {
                              setDeleteId(null);
                              setDeleteError("");
                            }}
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
                  <tr key={s.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => openEdit(s)}
                        className="font-medium text-slate-800 hover:text-slate-600 hover:underline text-left"
                      >
                        {s.name}
                      </button>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {featureMap[s.feature_id] ?? s.feature_id}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {teamMap[s.team_id] ?? s.team_id}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">
                      {s.iteration_id ? (iterationMap[s.iteration_id] ?? s.iteration_id) : "—"}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-slate-500">{s.points}</td>
                    <td className="px-4 py-2.5">
                      <StoryStatusBadge status={s.status} />
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <button
                        onClick={() => openEdit(s)}
                        className="mr-3 text-xs text-slate-500 hover:text-slate-800 underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          setDeleteId(s.id);
                          setDeleteError("");
                        }}
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
          <Pagination page={page} totalPages={totalPages} onPageChange={goTo} />
        </div>
      )}

      <Modal open={modalOpen} title={editing ? "Edit Story" : "New Story"} onClose={closeModal}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-red-600">{error}</p>}

          <div>
            <label htmlFor="story-name" className="mb-1 block text-sm font-medium text-slate-700">
              Name<span aria-hidden="true"> *</span>
            </label>
            <input
              id="story-name"
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
          </div>

          <div>
            <label
              htmlFor="story-feature"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Feature<span aria-hidden="true"> *</span>
            </label>
            <select
              id="story-feature"
              value={form.feature_id}
              onChange={(e) => setForm({ ...form, feature_id: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
            >
              <option value="">— select feature —</option>
              {features.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          {!editing && (
            <div>
              <label htmlFor="story-team" className="mb-1 block text-sm font-medium text-slate-700">
                Team<span aria-hidden="true"> *</span>
              </label>
              <select
                id="story-team"
                value={form.team_id}
                onChange={(e) => setForm({ ...form, team_id: e.target.value })}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
              >
                <option value="">— select team —</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label
              htmlFor="story-iteration"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Iteration
            </label>
            <select
              id="story-iteration"
              value={form.iteration_id ?? ""}
              onChange={(e) => setForm({ ...form, iteration_id: e.target.value || null })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
            >
              <option value="">— unplanned —</option>
              {iterations.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="story-points" className="mb-1 block text-sm font-medium text-slate-700">
              Points
            </label>
            <input
              id="story-points"
              type="number"
              min={0}
              value={form.points}
              onChange={(e) => setForm({ ...form, points: Number(e.target.value) })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
          </div>

          <div>
            <label htmlFor="story-status" className="mb-1 block text-sm font-medium text-slate-700">
              Status
            </label>
            <select
              id="story-status"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as StoryStatus })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </select>
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
                if (isPending) return "Saving…";
                if (editing) return "Save Changes";
                return "Add Story";
              })()}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
