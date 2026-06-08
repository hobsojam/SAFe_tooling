import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api";
import type {
  Dependency,
  DependencyCreate,
  DependencyStatus,
  DependencyUpdate,
  Feature,
} from "../types";
import { DepBadge } from "../components/Badge";
import { EmptyState } from "../components/EmptyState";
import { Modal } from "../components/Modal";
import { Pagination } from "../components/Pagination";
import { Spinner } from "../components/Spinner";
import { useToast } from "../components/Toaster";
import { usePagination } from "../hooks/usePagination";

const STATUS_OPTIONS: DependencyStatus[] = [
  "identified",
  "acknowledged",
  "in_progress",
  "resolved",
];

interface DepFormState {
  description: string;
  from_feature_id: string;
  to_feature_id: string;
  status: DependencyStatus;
  owner: string | null;
  needed_by_date: string | null;
  resolution_notes: string;
}

const EMPTY_FORM: DepFormState = {
  description: "",
  from_feature_id: "",
  to_feature_id: "",
  status: "identified",
  owner: null,
  needed_by_date: null,
  resolution_notes: "",
};

export function featureLabel(feature: Feature, teamMap: Record<string, string>): string {
  if (!feature.team_id) return feature.name;
  const team = teamMap[feature.team_id] ?? "";
  return team ? `${feature.name} (${team})` : feature.name;
}

export function Dependencies() {
  const { piId = "" } = useParams<{ piId: string }>();
  const qc = useQueryClient();
  const toast = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Dependency | null>(null);
  const [form, setForm] = useState<DepFormState>(EMPTY_FORM);
  const [error, setError] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");

  const { data: pi } = useQuery({
    queryKey: ["pi", piId],
    queryFn: () => api.getPI(piId),
    enabled: !!piId,
  });

  const { data: deps = [], isLoading } = useQuery({
    queryKey: ["dependencies", piId],
    queryFn: () => api.listDependencies(piId),
    enabled: !!piId,
  });

  const { data: features = [] } = useQuery({
    queryKey: ["features", piId],
    queryFn: () => api.listFeatures(piId),
    enabled: !!piId,
  });

  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: api.listTeams,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["dependencies", piId] });

  const createMut = useMutation({
    mutationFn: (body: DependencyCreate) => api.createDependency(body),
    onSuccess: () => {
      invalidate();
      closeModal();
      toast("Dependency added");
    },
    onError: (e: Error) => setError(e.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: DependencyUpdate }) =>
      api.updateDependency(id, body),
    onSuccess: () => {
      invalidate();
      closeModal();
      toast("Dependency updated");
    },
    onError: (e: Error) => setError(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteDependency(id),
    onSuccess: () => {
      invalidate();
      setDeleteId(null);
      setDeleteError("");
      toast("Dependency deleted");
    },
    onError: (e: Error) => setDeleteError(e.message),
  });

  const { page, totalPages, pageItems: pageDeps, goTo } = usePagination(deps, 25, piId);

  if (isLoading) return <Spinner />;

  const teamMap = Object.fromEntries(teams.map((t) => [t.id, t.name]));
  const featureMap = Object.fromEntries(features.map((f) => [f.id, f]));
  const unresolved = deps.filter((d) => d.status !== "resolved").length;

  function openNew() {
    setEditing(null);
    setForm({
      ...EMPTY_FORM,
      from_feature_id: features[0]?.id ?? "",
      to_feature_id: features[1]?.id ?? features[0]?.id ?? "",
    });
    setError("");
    setModalOpen(true);
  }

  function openEdit(d: Dependency) {
    setEditing(d);
    setForm({
      description: d.description,
      from_feature_id: d.from_feature_id,
      to_feature_id: d.to_feature_id,
      status: d.status,
      owner: d.owner,
      needed_by_date: d.needed_by_date,
      resolution_notes: d.resolution_notes,
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
    if (!form.description.trim()) {
      setError("Description is required.");
      return;
    }
    if (!form.from_feature_id || !form.to_feature_id) {
      setError("From and To features are required.");
      return;
    }
    if (editing) {
      updateMut.mutate({
        id: editing.id,
        body: {
          description: form.description,
          status: form.status,
          owner: form.owner || null,
          needed_by_date: form.needed_by_date || null,
          ...(form.resolution_notes !== "" && { resolution_notes: form.resolution_notes }),
        },
      });
    } else {
      createMut.mutate({
        description: form.description,
        pi_id: piId,
        from_feature_id: form.from_feature_id,
        to_feature_id: form.to_feature_id,
        owner: form.owner || null,
        needed_by_date: form.needed_by_date || null,
      });
    }
  }

  const isPending = createMut.isPending || updateMut.isPending;

  function depFromLabel(d: Dependency): string {
    const f = featureMap[d.from_feature_id];
    return f ? featureLabel(f, teamMap) : d.from_feature_id;
  }

  function depToLabel(d: Dependency): string {
    const f = featureMap[d.to_feature_id];
    return f ? featureLabel(f, teamMap) : d.to_feature_id;
  }

  return (
    <div className="p-3 sm:p-6">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-y-2">
        <div>
          <h1 className="mb-1 text-xl font-semibold text-slate-800">Dependencies — {pi?.name}</h1>
          <p className="text-sm text-slate-500">
            {deps.length} dependenc{deps.length === 1 ? "y" : "ies"}
            {unresolved > 0 && (
              <span className="ml-2 font-medium text-red-600">{unresolved} unresolved</span>
            )}
          </p>
        </div>
        <button
          onClick={openNew}
          className="rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 transition-colors"
        >
          + New Dependency
        </button>
      </div>

      {deps.length === 0 ? (
        <EmptyState message="No dependencies for this PI." />
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          {/* Mobile card list */}
          <div className="block md:hidden divide-y divide-slate-100">
            {pageDeps.map((d) => {
              if (deleteId === d.id) {
                return (
                  <div key={d.id} className="bg-red-50 px-4 py-4">
                    {deleteError && <p className="mb-2 text-xs text-red-600">{deleteError}</p>}
                    <p className="mb-3 text-sm text-slate-700">
                      Delete{" "}
                      <strong>
                        {d.description.slice(0, 60)}
                        {d.description.length > 60 ? "…" : ""}
                      </strong>{"?"}
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => deleteMut.mutate(d.id)}
                        disabled={deleteMut.isPending}
                        className="rounded-md bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                      >
                        {deleteMut.isPending ? "Deleting…" : "Yes, delete"}
                      </button>
                      <button
                        onClick={() => {
                          setDeleteId(null);
                          setDeleteError("");
                        }}
                        className="rounded-md bg-white px-4 py-2.5 text-sm text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                );
              }
              return (
                <div key={d.id} className="px-4 py-4">
                  <button
                    onClick={() => openEdit(d)}
                    className="mb-1 text-left font-medium text-slate-800 hover:text-slate-600"
                  >
                    {d.description}
                  </button>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <DepBadge status={d.status} />
                  </div>
                  <div className="mb-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-500">
                    <div>
                      <span className="font-medium text-slate-600">From: </span>
                      {depFromLabel(d)}
                    </div>
                    <div>
                      <span className="font-medium text-slate-600">To: </span>
                      {depToLabel(d)}
                    </div>
                    {d.owner && (
                      <div>
                        <span className="font-medium text-slate-600">Owner: </span>
                        {d.owner}
                      </div>
                    )}
                    {d.needed_by_date && (
                      <div>
                        <span className="font-medium text-slate-600">Needed by: </span>
                        {d.needed_by_date}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEdit(d)}
                      className="rounded-md bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-200 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        setDeleteId(d.id);
                        setDeleteError("");
                      }}
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
                  {["From", "To", "Description", "Status", "Owner", "Needed By", ""].map((h) => (
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
                {pageDeps.map((d) => {
                  if (deleteId === d.id) {
                    return (
                      <tr key={d.id} className="bg-red-50">
                        <td colSpan={7} className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {deleteError && (
                              <span className="text-xs text-red-600">{deleteError}</span>
                            )}
                            <span className="text-sm text-slate-700">
                              Delete{" "}
                              <strong>
                                {d.description.slice(0, 60)}
                                {d.description.length > 60 ? "…" : ""}
                              </strong>{"?"}
                            </span>
                            <button
                              onClick={() => deleteMut.mutate(d.id)}
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
                    <tr key={d.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-2.5 font-medium text-slate-700">{depFromLabel(d)}</td>
                      <td className="px-4 py-2.5 font-medium text-slate-700">{depToLabel(d)}</td>
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => openEdit(d)}
                          className="text-slate-600 hover:text-slate-800 hover:underline text-left"
                        >
                          {d.description}
                        </button>
                      </td>
                      <td className="px-4 py-2.5">
                        <DepBadge status={d.status} />
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">{d.owner ?? "—"}</td>
                      <td className="px-4 py-2.5 text-slate-500 tabular-nums">
                        {d.needed_by_date ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <button
                          onClick={() => openEdit(d)}
                          className="mr-3 text-xs text-slate-500 hover:text-slate-800 underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            setDeleteId(d.id);
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
          </div>
          <Pagination page={page} totalPages={totalPages} onPageChange={goTo} />
        </div>
      )}

      <Modal
        open={modalOpen}
        title={editing ? "Edit Dependency" : "New Dependency"}
        onClose={closeModal}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-red-600">{error}</p>}

          <div>
            <label
              htmlFor="dep-description"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Description<span aria-hidden="true"> *</span>
            </label>
            <textarea
              id="dep-description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="dep-from" className="mb-1 block text-sm font-medium text-slate-700">
                From Feature<span aria-hidden="true"> *</span>
              </label>
              <select
                id="dep-from"
                value={form.from_feature_id}
                onChange={(e) => setForm({ ...form, from_feature_id: e.target.value })}
                disabled={!!editing}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 disabled:bg-slate-50 disabled:text-slate-400"
              >
                <option value="">Select…</option>
                {features.map((f) => (
                  <option key={f.id} value={f.id}>
                    {featureLabel(f, teamMap)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="dep-to" className="mb-1 block text-sm font-medium text-slate-700">
                To Feature<span aria-hidden="true"> *</span>
              </label>
              <select
                id="dep-to"
                value={form.to_feature_id}
                onChange={(e) => setForm({ ...form, to_feature_id: e.target.value })}
                disabled={!!editing}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 disabled:bg-slate-50 disabled:text-slate-400"
              >
                <option value="">Select…</option>
                {features.map((f) => (
                  <option key={f.id} value={f.id}>
                    {featureLabel(f, teamMap)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="dep-status" className="mb-1 block text-sm font-medium text-slate-700">
              Status
            </label>
            <select
              id="dep-status"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as DependencyStatus })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="dep-owner" className="mb-1 block text-sm font-medium text-slate-700">
                Owner
              </label>
              <input
                id="dep-owner"
                type="text"
                value={form.owner ?? ""}
                onChange={(e) => setForm({ ...form, owner: e.target.value || null })}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
              />
            </div>
            <div>
              <label
                htmlFor="dep-needed-by"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Needed By
              </label>
              <input
                id="dep-needed-by"
                type="date"
                value={form.needed_by_date ?? ""}
                onChange={(e) => setForm({ ...form, needed_by_date: e.target.value || null })}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
              />
            </div>
          </div>

          {editing && (
            <div>
              <label
                htmlFor="dep-resolution"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Resolution Notes
              </label>
              <textarea
                id="dep-resolution"
                value={form.resolution_notes}
                onChange={(e) => setForm({ ...form, resolution_notes: e.target.value })}
                rows={2}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
              />
            </div>
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
              disabled={isPending}
              className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 transition-colors"
            >
              {(() => {
                if (isPending) return "Saving…";
                if (editing) return "Save Changes";
                return "Add Dependency";
              })()}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
