import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api";
import type { PIObjective, PIObjectiveCreate, PIObjectiveUpdate } from "../types";
import { EmptyState } from "../components/EmptyState";
import { Modal } from "../components/Modal";
import { Pagination } from "../components/Pagination";
import { Spinner } from "../components/Spinner";
import { useToast } from "../components/Toaster";
import { usePagination } from "../hooks/usePagination";
import { buildPredictabilitySummary, predictabilityTextClass } from "../utils/predictability";

interface ObjectiveFormState {
  description: string;
  team_id: string;
  planned_business_value: number;
  actual_business_value: string;
  is_stretch: boolean;
}

const EMPTY_FORM: ObjectiveFormState = {
  description: "",
  team_id: "",
  planned_business_value: 5,
  actual_business_value: "",
  is_stretch: false,
};

export function predictabilityClass(pct: number): string {
  return predictabilityTextClass(pct);
}

export function objectiveTypeBadgeClass(isStretch: boolean): string {
  if (isStretch)
    return "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-800";
  return "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800";
}

export function Objectives() {
  const { piId = "" } = useParams<{ piId: string }>();
  const qc = useQueryClient();
  const toast = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PIObjective | null>(null);
  const [form, setForm] = useState<ObjectiveFormState>(EMPTY_FORM);
  const [error, setError] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [scoreObj, setScoreObj] = useState<PIObjective | null>(null);
  const [scoreValue, setScoreValue] = useState<string>("");
  const [scoreError, setScoreError] = useState("");

  const { data: pi } = useQuery({
    queryKey: ["pi", piId],
    queryFn: () => api.getPI(piId),
    enabled: !!piId,
  });

  const { data: objectives = [], isLoading } = useQuery({
    queryKey: ["objectives", piId],
    queryFn: () => api.listObjectives(piId),
    enabled: !!piId,
  });

  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: api.listTeams,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["objectives", piId] });

  const createMut = useMutation({
    mutationFn: (body: PIObjectiveCreate) => api.createObjective(body),
    onSuccess: () => {
      invalidate();
      closeModal();
      toast("Objective added");
    },
    onError: (e: Error) => setError(e.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: PIObjectiveUpdate }) =>
      api.updateObjective(id, body),
    onSuccess: () => {
      invalidate();
      closeModal();
      toast("Objective updated");
    },
    onError: (e: Error) => setError(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteObjective(id),
    onSuccess: () => {
      invalidate();
      setDeleteId(null);
      setDeleteError("");
      toast("Objective deleted");
    },
    onError: (e: Error) => setDeleteError(e.message),
  });

  const scoreMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: PIObjectiveUpdate }) =>
      api.updateObjective(id, body),
    onSuccess: () => {
      invalidate();
      setScoreObj(null);
      toast("Objective scored");
    },
    onError: (e: Error) => setScoreError(e.message),
  });

  const committed = objectives.filter((o) => !o.is_stretch);
  const stretch = objectives.filter((o) => o.is_stretch);
  const sorted = [...committed, ...stretch];
  const { page, totalPages, pageItems: pageSorted, goTo } = usePagination(sorted, 25, piId);

  const canScore = pi?.status === "active" || pi?.status === "closed";

  function openScore(o: PIObjective) {
    setScoreObj(o);
    setScoreValue(o.actual_business_value === null ? "" : String(o.actual_business_value));
    setScoreError("");
  }

  function handleScoreSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!scoreObj) return;
    scoreMut.mutate({
      id: scoreObj.id,
      body: { actual_business_value: scoreValue === "" ? null : Number(scoreValue) },
    });
  }

  if (isLoading) return <Spinner />;

  const teamMap = Object.fromEntries(teams.map((t) => [t.id, t.name]));

  const committedPredictability = buildPredictabilitySummary(committed);

  function openNew() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, team_id: teams[0]?.id ?? "" });
    setError("");
    setModalOpen(true);
  }

  function openEdit(o: PIObjective) {
    setEditing(o);
    setForm({
      description: o.description,
      team_id: o.team_id,
      planned_business_value: o.planned_business_value,
      actual_business_value:
        o.actual_business_value === null ? "" : String(o.actual_business_value),
      is_stretch: o.is_stretch,
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
    if (!form.team_id) {
      setError("Team is required.");
      return;
    }

    const actualBV = form.actual_business_value === "" ? null : Number(form.actual_business_value);

    if (editing) {
      updateMut.mutate({
        id: editing.id,
        body: {
          description: form.description,
          planned_business_value: form.planned_business_value,
          actual_business_value: actualBV,
          is_stretch: form.is_stretch,
        },
      });
    } else {
      createMut.mutate({
        description: form.description,
        team_id: form.team_id,
        pi_id: piId,
        planned_business_value: form.planned_business_value,
        actual_business_value: actualBV,
        is_stretch: form.is_stretch,
      });
    }
  }

  const isPending = createMut.isPending || updateMut.isPending;
  let submitLabel: string;
  if (isPending) submitLabel = "Saving…";
  else submitLabel = editing ? "Save Changes" : "Add Objective";

  return (
    <div className="p-3 sm:p-6">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-y-2">
        <div>
          <h1 className="mb-1 text-xl font-semibold text-slate-800">PI Objectives — {pi?.name}</h1>
          <p className="text-sm text-slate-500">
            Committed: {committed.length} · Stretch: {stretch.length}
          </p>
        </div>
        <button
          onClick={openNew}
          className="rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 transition-colors"
        >
          + New Objective
        </button>
      </div>

      {sorted.length === 0 ? (
        <EmptyState message="No PI objectives yet." />
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          {/* Mobile card list */}
          <div className="block md:hidden divide-y divide-slate-100">
            {pageSorted.map((obj) => {
              if (deleteId === obj.id) {
                return (
                  <div key={obj.id} className="bg-red-50 px-4 py-4">
                    {deleteError && <p className="mb-2 text-xs text-red-600">{deleteError}</p>}
                    <p className="mb-3 text-sm text-slate-700">
                      Delete{" "}
                      <strong>
                        {obj.description.slice(0, 50)}
                        {obj.description.length > 50 ? "…" : ""}
                      </strong>{"?"}
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => deleteMut.mutate(obj.id)}
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
                <div key={obj.id} className="px-4 py-4">
                  <button
                    onClick={() => openEdit(obj)}
                    className="mb-2 text-left font-medium text-slate-800 hover:text-slate-600"
                  >
                    {obj.description}
                  </button>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className={objectiveTypeBadgeClass(obj.is_stretch)}>
                      {obj.is_stretch ? "Stretch" : "Committed"}
                    </span>
                    <span className="text-xs text-slate-500">{teamMap[obj.team_id] ?? "—"}</span>
                  </div>
                  <div className="mb-3 flex gap-6 text-xs text-slate-500">
                    <span>
                      Planned BV:{" "}
                      <strong className="text-slate-700">{obj.planned_business_value}</strong>
                    </span>
                    <span>
                      Actual BV:{" "}
                      <strong className="text-slate-700">
                        {obj.actual_business_value ?? "—"}
                      </strong>
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {canScore && (
                      <button
                        onClick={() => openScore(obj)}
                        className="rounded-md bg-teal-50 px-4 py-2.5 text-sm font-medium text-teal-700 hover:bg-teal-100 transition-colors"
                      >
                        Score
                      </button>
                    )}
                    <button
                      onClick={() => openEdit(obj)}
                      className="rounded-md bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-200 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        setDeleteId(obj.id);
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
            {committed.length > 0 && (
              <div className="border-t-2 border-slate-200 bg-slate-50 px-4 py-3">
                <p className="mb-1 text-xs text-slate-500">
                  Committed totals · {committedPredictability.scoredCount} of{" "}
                  {committedPredictability.totalCount} scored
                </p>
                <div className="flex items-center gap-6 text-sm">
                  <span className="text-slate-600">
                    Planned:{" "}
                    <strong className="text-slate-800">{committedPredictability.plannedBV}</strong>
                  </span>
                  <span className="text-slate-600">
                    Actual:{" "}
                    <strong className="text-slate-800">
                      {committedPredictability.scoredCount > 0
                        ? committedPredictability.actualBV
                        : "—"}
                    </strong>
                  </span>
                  {committedPredictability.pct !== null && (
                    <span className={predictabilityClass(committedPredictability.pct)}>
                      {committedPredictability.pct}%
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  {["Description", "Team", "Type", "Planned BV", "Actual BV", ""].map((h) => (
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
                {pageSorted.map((obj) => {
                  if (deleteId === obj.id) {
                    return (
                      <tr key={obj.id} className="bg-red-50">
                        <td colSpan={6} className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {deleteError && (
                              <span className="text-xs text-red-600">{deleteError}</span>
                            )}
                            <span className="text-sm text-slate-700">
                              Delete{" "}
                              <strong>
                                {obj.description.slice(0, 50)}
                                {obj.description.length > 50 ? "…" : ""}
                              </strong>{"?"}
                            </span>
                            <button
                              onClick={() => deleteMut.mutate(obj.id)}
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
                    <tr key={obj.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-2.5 text-slate-800 max-w-xs">
                        <button
                          onClick={() => openEdit(obj)}
                          className="text-left hover:text-slate-600 hover:underline"
                        >
                          {obj.description}
                        </button>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">{teamMap[obj.team_id] ?? "—"}</td>
                      <td className="px-4 py-2.5">
                        <span className={objectiveTypeBadgeClass(obj.is_stretch)}>
                          {obj.is_stretch ? "Stretch" : "Committed"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-slate-700">
                        {obj.planned_business_value}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-slate-700">
                        {obj.actual_business_value ?? <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-right">
                        {canScore && (
                          <button
                            onClick={() => openScore(obj)}
                            className="mr-3 text-xs text-teal-600 hover:text-teal-800 underline"
                          >
                            Score
                          </button>
                        )}
                        <button
                          onClick={() => openEdit(obj)}
                          className="mr-3 text-xs text-slate-500 hover:text-slate-800 underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            setDeleteId(obj.id);
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
              {committed.length > 0 && (
                <tfoot className="border-t-2 border-slate-200 bg-slate-50">
                  <tr>
                    <td colSpan={3} className="px-4 py-2.5 text-xs text-slate-500">
                      Committed totals · {committedPredictability.scoredCount} of{" "}
                      {committedPredictability.totalCount} scored
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-sm font-semibold text-slate-700">
                      {committedPredictability.plannedBV}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-sm font-semibold text-slate-700">
                      {committedPredictability.scoredCount > 0
                        ? committedPredictability.actualBV
                        : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {committedPredictability.pct === null ? (
                        <span className="text-xs text-slate-400">Not yet scored</span>
                      ) : (
                        <span
                          className={`text-sm ${predictabilityClass(committedPredictability.pct)}`}
                        >
                          {committedPredictability.pct}%
                        </span>
                      )}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          <Pagination page={page} totalPages={totalPages} onPageChange={goTo} />
        </div>
      )}

      <Modal open={scoreObj !== null} title="Score Objective" onClose={() => setScoreObj(null)}>
        <form onSubmit={handleScoreSubmit} className="space-y-4">
          {scoreError && <p className="text-sm text-red-600">{scoreError}</p>}
          <div className="rounded-md bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
            {scoreObj?.description}
          </div>
          <div>
            <label
              htmlFor="score-actual-bv"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Actual BV (0–10)
            </label>
            <input
              id="score-actual-bv"
              type="number"
              min={0}
              max={10}
              value={scoreValue}
              onChange={(e) => setScoreValue(e.target.value)}
              placeholder="—"
              autoFocus
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setScoreObj(null)}
              className="rounded-md px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={scoreMut.isPending}
              className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 transition-colors"
            >
              {scoreMut.isPending ? "Saving…" : "Save Score"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={modalOpen}
        title={editing ? "Edit Objective" : "New Objective"}
        onClose={closeModal}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-red-600">{error}</p>}

          <div>
            <label htmlFor="obj-desc" className="mb-1 block text-sm font-medium text-slate-700">
              Description<span aria-hidden="true"> *</span>
            </label>
            <textarea
              id="obj-desc"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
          </div>

          {!editing && (
            <div>
              <label htmlFor="obj-team" className="mb-1 block text-sm font-medium text-slate-700">
                Team<span aria-hidden="true"> *</span>
              </label>
              <select
                id="obj-team"
                value={form.team_id}
                onChange={(e) => setForm({ ...form, team_id: e.target.value })}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
              >
                <option value="">Select team…</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="obj-planned-bv"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Planned BV (1–10)<span aria-hidden="true"> *</span>
              </label>
              <input
                id="obj-planned-bv"
                type="number"
                min={1}
                max={10}
                value={form.planned_business_value}
                onChange={(e) =>
                  setForm({ ...form, planned_business_value: Number(e.target.value) })
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
              />
            </div>
            <div>
              <label
                htmlFor="obj-actual-bv"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Actual BV{" "}
                <span className="font-normal text-slate-400">(blank if not yet scored)</span>
              </label>
              <input
                id="obj-actual-bv"
                type="number"
                min={0}
                max={10}
                value={form.actual_business_value}
                onChange={(e) => setForm({ ...form, actual_business_value: e.target.value })}
                placeholder="—"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_stretch}
              onChange={(e) => setForm({ ...form, is_stretch: e.target.checked })}
              className="rounded border-slate-300"
            />{" "}
            Stretch objective (not counted in ART predictability)
          </label>

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
              {submitLabel}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
