import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useState } from "react";
import { api } from "../api";
import type {
  ImprovementAction,
  ImprovementActionCreate,
  ImprovementActionStatus,
  ImprovementActionUpdate,
  Risk,
  ROAMStatus,
  Team,
} from "../types";
import { ROAMBadge } from "../components/Badge";
import { EmptyState } from "../components/EmptyState";
import { Modal } from "../components/Modal";
import { Spinner } from "../components/Spinner";
import { useToast } from "../components/Toaster";
import { usePIObjectives } from "../hooks/usePIObjectives";
import { buildPredictabilitySummary, predictabilityBadgeClass } from "../utils/predictability";

const ROAM_ORDER: ROAMStatus[] = ["resolved", "owned", "accepted", "mitigated", "unroamed"];
const SUMMARY_CARD_CLASS = "rounded-lg border border-slate-200 bg-white p-4 shadow-sm";
const STAT_LABEL_CLASS = "text-xs font-medium uppercase tracking-wide text-slate-500";
const STAT_VALUE_CLASS = "mt-1 text-2xl font-bold tabular-nums text-slate-800";
const TABLE_HEADER_CLASS =
  "px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600";
const OBJECTIVE_HEADERS = ["Objective", "Team", "Type", "Planned BV", "Actual BV"];

const ACTION_STATUS_LABELS: Record<ImprovementActionStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  done: "Done",
};

const ACTION_STATUS_BADGE: Record<ImprovementActionStatus, string> = {
  open: "bg-blue-100 text-blue-800",
  in_progress: "bg-amber-100 text-amber-800",
  done: "bg-teal-100 text-teal-800",
};

const EMPTY_ACTION_FORM = {
  problem_statement: "",
  root_cause: "",
  action: "",
  owner: "",
  status: "open" as ImprovementActionStatus,
};

function buildRoamCounts(risks: Risk[]): Record<ROAMStatus, number> {
  const counts = { resolved: 0, owned: 0, accepted: 0, mitigated: 0, unroamed: 0 };
  for (const r of risks) counts[r.roam_status]++;
  return counts;
}

function teamName(teams: Team[], teamId: string | null): string {
  if (!teamId) return "—";
  return teams.find((t) => t.id === teamId)?.name ?? "—";
}

function Section({
  title,
  headingId,
  children,
}: Readonly<{ title: string; headingId: string; children: ReactNode }>) {
  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="mb-3 text-base font-semibold text-slate-700">
        {title}
      </h2>
      {children}
    </section>
  );
}

function StatCard({ label, children }: Readonly<{ label: ReactNode; children: ReactNode }>) {
  return (
    <div className={SUMMARY_CARD_CLASS}>
      {typeof label === "string" ? <p className={STAT_LABEL_CLASS}>{label}</p> : label}
      <div className={STAT_VALUE_CLASS}>{children}</div>
    </div>
  );
}

function ObjectiveTypeBadge({ isStretch }: Readonly<{ isStretch: boolean }>) {
  const styles = isStretch ? "bg-amber-100 text-amber-800" : "bg-teal-100 text-teal-800";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles}`}
    >
      {isStretch ? "Stretch" : "Committed"}
    </span>
  );
}

export function InspectAdapt() {
  const { piId, pi, objectives, isLoading: loadingObj } = usePIObjectives();
  const qc = useQueryClient();
  const toast = useToast();

  const { data: risks = [], isLoading: loadingRisks } = useQuery({
    queryKey: ["risks", piId],
    queryFn: () => api.listRisks(piId!),
    enabled: !!piId,
  });

  const { data: teams = [], isLoading: loadingTeams } = useQuery({
    queryKey: ["teams", pi?.art_id],
    queryFn: () => api.listTeamsByArt(pi!.art_id),
    enabled: !!pi?.art_id,
  });

  const { data: actions = [], isLoading: loadingActions } = useQuery({
    queryKey: ["improvement-actions", piId],
    queryFn: () => api.listImprovementActions(piId!),
    enabled: !!piId,
  });

  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [editingAction, setEditingAction] = useState<ImprovementAction | null>(null);
  const [actionForm, setActionForm] = useState(EMPTY_ACTION_FORM);
  const [actionError, setActionError] = useState("");
  const [deleteActionId, setDeleteActionId] = useState<string | null>(null);
  const [deleteActionError, setDeleteActionError] = useState("");

  const invalidateActions = () => qc.invalidateQueries({ queryKey: ["improvement-actions", piId] });

  const createActionMut = useMutation({
    mutationFn: (body: ImprovementActionCreate) => api.createImprovementAction(body),
    onSuccess: () => {
      invalidateActions();
      closeActionModal();
      toast("Action added");
    },
    onError: (e: Error) => setActionError(e.message),
  });

  const updateActionMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: ImprovementActionUpdate }) =>
      api.updateImprovementAction(id, body),
    onSuccess: () => {
      invalidateActions();
      closeActionModal();
      toast("Action updated");
    },
    onError: (e: Error) => setActionError(e.message),
  });

  const deleteActionMut = useMutation({
    mutationFn: (id: string) => api.deleteImprovementAction(id),
    onSuccess: () => {
      invalidateActions();
      setDeleteActionId(null);
      setDeleteActionError("");
      toast("Action deleted");
    },
    onError: (e: Error) => setDeleteActionError(e.message),
  });

  function openNewAction() {
    setEditingAction(null);
    setActionForm(EMPTY_ACTION_FORM);
    setActionError("");
    setActionModalOpen(true);
  }

  function openEditAction(a: ImprovementAction) {
    setEditingAction(a);
    setActionForm({
      problem_statement: a.problem_statement,
      root_cause: a.root_cause,
      action: a.action,
      owner: a.owner,
      status: a.status,
    });
    setActionError("");
    setActionModalOpen(true);
  }

  function closeActionModal() {
    setActionModalOpen(false);
    setEditingAction(null);
    setActionError("");
  }

  function handleActionSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!actionForm.problem_statement.trim()) {
      setActionError("Problem statement is required.");
      return;
    }
    if (!actionForm.action.trim()) {
      setActionError("Action is required.");
      return;
    }
    if (editingAction) {
      updateActionMut.mutate({ id: editingAction.id, body: actionForm });
    } else {
      createActionMut.mutate({ ...actionForm, pi_id: piId! });
    }
  }

  if (loadingObj || loadingRisks || loadingTeams || loadingActions) return <Spinner />;

  const committed = objectives.filter((o) => !o.is_stretch);
  const stretch = objectives.filter((o) => o.is_stretch);
  const pred = buildPredictabilitySummary(committed);
  const roamCounts = buildRoamCounts(risks);

  const sortedObjectives = [...objectives].sort((a, b) => {
    if (a.is_stretch === b.is_stretch) return b.planned_business_value - a.planned_business_value;
    return a.is_stretch ? 1 : -1;
  });

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="mb-1 text-xl font-semibold text-slate-800">
          Inspect &amp; Adapt — {pi?.name}
        </h1>
        <p className="text-sm text-slate-500">End-of-PI ceremony summary · Read-only</p>
      </div>

      <Section title="ART Predictability" headingId="pred-heading">
        {committed.length === 0 ? (
          <EmptyState message="No committed objectives — add objectives on the Objectives page." />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Planned BV">{pred.plannedBV}</StatCard>
            <StatCard label="Actual BV">
              {pred.scoredCount > 0 ? pred.actualBV : <span className="text-slate-400">—</span>}
            </StatCard>
            <StatCard label="Objectives Scored">
              {pred.scoredCount} / {pred.totalCount}
            </StatCard>
            <div className={SUMMARY_CARD_CLASS}>
              <p className={STAT_LABEL_CLASS}>Predictability</p>
              <div className="mt-1">
                {pred.pct === null ? (
                  <span className="text-sm text-slate-400">Not yet scored</span>
                ) : (
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-lg font-bold ${predictabilityBadgeClass(pred.pct)}`}
                  >
                    {pred.pct}%
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {committed.length > 0 && stretch.length > 0 && (
          <p className="mt-2 text-xs text-slate-400">
            {stretch.length} stretch {stretch.length === 1 ? "objective" : "objectives"} excluded
            from predictability calculation.
          </p>
        )}
      </Section>

      <Section title="PI Objectives" headingId="obj-heading">
        {objectives.length === 0 ? (
          <EmptyState message="No objectives for this PI." />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  {OBJECTIVE_HEADERS.map((h) => (
                    <th key={h} className={TABLE_HEADER_CLASS}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedObjectives.map((obj) => (
                  <tr key={obj.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 text-slate-800">{obj.description}</td>
                    <td className="px-4 py-3 text-slate-600">{teamName(teams, obj.team_id)}</td>
                    <td className="px-4 py-3">
                      <ObjectiveTypeBadge isStretch={obj.is_stretch} />
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-700">
                      {obj.planned_business_value}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-700">
                      {obj.actual_business_value ?? <span className="text-slate-400">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Risk Disposition (ROAM)" headingId="roam-heading">
        {risks.length === 0 ? (
          <EmptyState message="No risks recorded for this PI." />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              {ROAM_ORDER.map((status) => (
                <StatCard key={status} label={<ROAMBadge status={status} />}>
                  {roamCounts[status]}
                </StatCard>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-400">
              {risks.length} total {risks.length === 1 ? "risk" : "risks"} · {roamCounts.unroamed}{" "}
              unroamed
            </p>
          </>
        )}
      </Section>

      <Section title="Problem-Solving Workshop" headingId="workshop-heading">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm text-slate-500">Improvement actions from the I&amp;A workshop</p>
          <button
            onClick={openNewAction}
            className="rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 transition-colors"
          >
            + New Action
          </button>
        </div>
        {actions.length === 0 ? (
          <EmptyState message="No improvement actions recorded for this PI." />
        ) : (
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  {["Problem Statement", "Root Cause", "Action", "Owner", "Status", ""].map((h) => (
                    <th key={h} className={TABLE_HEADER_CLASS}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {actions.map((a) => {
                  if (deleteActionId === a.id) {
                    return (
                      <tr key={a.id} className="bg-red-50">
                        <td colSpan={6} className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {deleteActionError && (
                              <span className="text-xs text-red-600">{deleteActionError}</span>
                            )}
                            <span className="text-sm text-slate-700">
                              Delete{" "}
                              <strong>
                                {a.problem_statement.slice(0, 50)}
                                {a.problem_statement.length > 50 ? "…" : ""}
                              </strong>
                              {"?"}
                            </span>
                            <button
                              onClick={() => deleteActionMut.mutate(a.id)}
                              disabled={deleteActionMut.isPending}
                              className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                            >
                              {deleteActionMut.isPending ? "Deleting…" : "Yes, delete"}
                            </button>
                            <button
                              onClick={() => {
                                setDeleteActionId(null);
                                setDeleteActionError("");
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
                    <tr key={a.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-2.5 text-slate-800 max-w-xs">
                        <button
                          onClick={() => openEditAction(a)}
                          className="text-left hover:text-slate-600 hover:underline"
                        >
                          {a.problem_statement}
                        </button>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600 max-w-xs">
                        {a.root_cause || <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-slate-700 max-w-xs">{a.action}</td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {a.owner || <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ACTION_STATUS_BADGE[a.status]}`}
                        >
                          {ACTION_STATUS_LABELS[a.status]}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-right">
                        <button
                          onClick={() => openEditAction(a)}
                          className="mr-3 text-xs text-slate-500 hover:text-slate-800 underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            setDeleteActionId(a.id);
                            setDeleteActionError("");
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
        )}
      </Section>

      <Modal
        open={actionModalOpen}
        title={editingAction ? "Edit Improvement Action" : "New Improvement Action"}
        onClose={closeActionModal}
      >
        <form onSubmit={handleActionSubmit} className="space-y-4">
          {actionError && <p className="text-sm text-red-600">{actionError}</p>}

          <div>
            <label
              htmlFor="action-problem"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Problem Statement<span aria-hidden="true"> *</span>
            </label>
            <textarea
              id="action-problem"
              value={actionForm.problem_statement}
              onChange={(e) => setActionForm({ ...actionForm, problem_statement: e.target.value })}
              rows={2}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
          </div>

          <div>
            <label
              htmlFor="action-root-cause"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Root Cause
            </label>
            <textarea
              id="action-root-cause"
              value={actionForm.root_cause}
              onChange={(e) => setActionForm({ ...actionForm, root_cause: e.target.value })}
              rows={2}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
          </div>

          <div>
            <label
              htmlFor="action-action"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Action<span aria-hidden="true"> *</span>
            </label>
            <textarea
              id="action-action"
              value={actionForm.action}
              onChange={(e) => setActionForm({ ...actionForm, action: e.target.value })}
              rows={2}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="action-owner"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Owner
              </label>
              <input
                id="action-owner"
                type="text"
                value={actionForm.owner}
                onChange={(e) => setActionForm({ ...actionForm, owner: e.target.value })}
                placeholder="Name or team"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
              />
            </div>
            <div>
              <label
                htmlFor="action-status"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Status
              </label>
              <select
                id="action-status"
                value={actionForm.status}
                onChange={(e) =>
                  setActionForm({
                    ...actionForm,
                    status: e.target.value as ImprovementActionStatus,
                  })
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
              >
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={closeActionModal}
              className="rounded-md px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createActionMut.isPending || updateActionMut.isPending}
              className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 transition-colors"
            >
              {createActionMut.isPending || updateActionMut.isPending
                ? "Saving…"
                : editingAction
                  ? "Save Changes"
                  : "Add Action"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
