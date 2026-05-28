import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api";
import { InspectAdapt } from "../../pages/InspectAdapt";
import { makeImprovementAction, makePI, makeTeam, makePIObjective, makeRisk } from "../factories";

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useQueryClient: vi.fn(),
}));

vi.mock("../../components/Toaster", () => ({ useToast: () => vi.fn() }));

vi.mock("../../components/Modal", () => ({
  Modal: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div role="dialog">{children}</div> : null,
}));

vi.mock("react-router-dom", () => ({
  useParams: () => ({ piId: "pi-1" }),
}));

vi.mock("../../api", () => ({
  api: {
    getPI: vi.fn(),
    listObjectives: vi.fn(),
    listRisks: vi.fn(),
    listTeamsByArt: vi.fn(),
    listImprovementActions: vi.fn(),
    createImprovementAction: vi.fn(),
    updateImprovementAction: vi.fn(),
    deleteImprovementAction: vi.fn(),
  },
}));

vi.mock("../../components/Spinner", () => ({
  Spinner: () => <div>Loading…</div>,
}));

vi.mock("../../components/EmptyState", () => ({
  EmptyState: ({ message }: { message: string }) => <div>{message}</div>,
}));

const mockPI = makePI({ id: "pi-1", name: "PI 2026.1", art_id: "art-1" });
const mockTeams = [
  makeTeam({ id: "team-1", name: "Alpha", art_id: "art-1" }),
  makeTeam({ id: "team-2", name: "Beta", art_id: "art-1" }),
];
const mockObjectives = [
  makePIObjective({
    id: "obj-1",
    team_id: "team-1",
    pi_id: "pi-1",
    planned_business_value: 8,
    actual_business_value: 8,
    is_stretch: false,
  }),
  makePIObjective({
    id: "obj-2",
    team_id: "team-2",
    pi_id: "pi-1",
    planned_business_value: 4,
    actual_business_value: null,
    is_stretch: false,
  }),
  makePIObjective({
    id: "obj-3",
    team_id: "team-1",
    pi_id: "pi-1",
    planned_business_value: 3,
    actual_business_value: null,
    is_stretch: true,
  }),
];
const mockRisks = [
  makeRisk({ id: "risk-1", pi_id: "pi-1", roam_status: "resolved" }),
  makeRisk({ id: "risk-2", pi_id: "pi-1", roam_status: "owned" }),
  makeRisk({ id: "risk-3", pi_id: "pi-1", roam_status: "unroamed" }),
];
const mockActions = [
  makeImprovementAction({
    id: "action-1",
    problem_statement: "Deploys take too long",
    root_cause: "Manual release checks",
    action: "Automate deployment pipeline",
    owner: "Platform",
    status: "in_progress",
  }),
  makeImprovementAction({
    id: "action-2",
    problem_statement: "No owner on demo prep",
    root_cause: "",
    action: "Assign demo coordinator",
    owner: "",
    status: "done",
  }),
];

function setupMocks(
  overrides: {
    isLoading?: boolean;
    objectives?: typeof mockObjectives;
    risks?: typeof mockRisks;
    teams?: typeof mockTeams;
    actions?: typeof mockActions;
  } = {}
) {
  vi.mocked(useQueryClient).mockReturnValue({ invalidateQueries: vi.fn() } as any);
  vi.mocked(useMutation).mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
  vi.mocked(useQuery).mockImplementation((opts: Parameters<typeof useQuery>[0]) => {
    const { queryKey, queryFn, enabled = true } = opts as any;
    if (enabled) void queryFn?.();
    if (overrides.isLoading) {
      return { data: undefined, isLoading: true } as unknown as ReturnType<typeof useQuery>;
    }
    const key = (queryKey as string[])[0];
    if (key === "pi")
      return { data: mockPI, isLoading: false } as unknown as ReturnType<typeof useQuery>;
    if (key === "objectives")
      return {
        data: overrides.objectives ?? mockObjectives,
        isLoading: false,
      } as unknown as ReturnType<typeof useQuery>;
    if (key === "risks")
      return { data: overrides.risks ?? mockRisks, isLoading: false } as unknown as ReturnType<
        typeof useQuery
      >;
    if (key === "teams")
      return { data: overrides.teams ?? mockTeams, isLoading: false } as unknown as ReturnType<
        typeof useQuery
      >;
    if (key === "improvement-actions")
      return { data: overrides.actions ?? [], isLoading: false } as unknown as ReturnType<
        typeof useQuery
      >;
    return { data: undefined, isLoading: false } as unknown as ReturnType<typeof useQuery>;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setupMocks();
});

describe("InspectAdapt", () => {
  it("shows loading spinner while data is loading", () => {
    setupMocks({ isLoading: true });
    render(<InspectAdapt />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("renders the page title with PI name", () => {
    render(<InspectAdapt />);
    expect(screen.getByText(/Inspect & Adapt/)).toBeInTheDocument();
    expect(screen.getByText(/PI 2026\.1/)).toBeInTheDocument();
  });

  it("shows all section headings", () => {
    render(<InspectAdapt />);
    expect(screen.getByText("ART Predictability")).toBeInTheDocument();
    expect(screen.getByText("PI Objectives")).toBeInTheDocument();
    expect(screen.getByText("Risk Disposition (ROAM)")).toBeInTheDocument();
    expect(screen.getByText("Problem-Solving Workshop")).toBeInTheDocument();
  });

  it("renders predictability stat cards with correct values", () => {
    render(<InspectAdapt />);
    // "Planned BV" and "Actual BV" appear in both the stat card and the objectives table header
    expect(screen.getAllByText("Planned BV").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Actual BV").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Objectives Scored")).toBeInTheDocument();
    expect(screen.getByText("Predictability")).toBeInTheDocument();
    // committed: obj-1 (planned=8, actual=8), obj-2 (planned=4, actual=null)
    // predictability = round(8/12*100) = 67%
    expect(screen.getByText("67%")).toBeInTheDocument();
  });

  it("shows empty state for predictability when no committed objectives", () => {
    setupMocks({ objectives: [mockObjectives[2]] }); // only stretch
    render(<InspectAdapt />);
    expect(screen.getByText(/No committed objectives/)).toBeInTheDocument();
  });

  it('shows "Not yet scored" when no objectives have actual BV', () => {
    setupMocks({
      objectives: [
        makePIObjective({
          planned_business_value: 5,
          actual_business_value: null,
          is_stretch: false,
        }),
      ],
    });
    render(<InspectAdapt />);
    expect(screen.getByText("Not yet scored")).toBeInTheDocument();
  });

  it("renders objectives table with team names", () => {
    render(<InspectAdapt />);
    // Alpha appears twice (two objectives from team-1), Beta once
    expect(screen.getAllByText("Alpha").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Beta")).toBeInTheDocument();
  });

  it("renders fallback team name when an objective has no team", () => {
    setupMocks({
      objectives: [makePIObjective({ id: "obj-no-team", team_id: null as any, pi_id: "pi-1" })],
    });
    render(<InspectAdapt />);
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1);
  });

  it("shows committed and stretch type badges", () => {
    render(<InspectAdapt />);
    expect(screen.getAllByText("Committed").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Stretch")).toBeInTheDocument();
  });

  it("shows empty state for objectives when none exist", () => {
    setupMocks({ objectives: [] });
    render(<InspectAdapt />);
    expect(screen.getByText("No objectives for this PI.")).toBeInTheDocument();
  });

  it("renders ROAM breakdown cards for each status", () => {
    render(<InspectAdapt />);
    expect(screen.getByText("resolved")).toBeInTheDocument();
    expect(screen.getByText("owned")).toBeInTheDocument();
    expect(screen.getByText("accepted")).toBeInTheDocument();
    expect(screen.getByText("mitigated")).toBeInTheDocument();
    expect(screen.getByText("unroamed")).toBeInTheDocument();
  });

  it("shows correct ROAM counts", () => {
    render(<InspectAdapt />);
    // 1 resolved, 1 owned, 1 unroamed, 0 accepted, 0 mitigated
    const allCells = screen.getAllByText("1");
    expect(allCells.length).toBeGreaterThanOrEqual(3);
  });

  it("shows empty state for risks when none exist", () => {
    setupMocks({ risks: [] });
    render(<InspectAdapt />);
    expect(screen.getByText("No risks recorded for this PI.")).toBeInTheDocument();
  });

  it("shows total risk count in footer note", () => {
    render(<InspectAdapt />);
    expect(screen.getByText(/3 total risks/)).toBeInTheDocument();
  });

  it("notes stretch objectives excluded from predictability", () => {
    render(<InspectAdapt />);
    expect(screen.getByText(/stretch objective.*excluded/i)).toBeInTheDocument();
  });

  it("shows empty state for improvement actions when none exist", () => {
    render(<InspectAdapt />);
    expect(screen.getByText("No improvement actions recorded for this PI.")).toBeInTheDocument();
  });

  it("renders improvement actions with status badges and blank fallbacks", () => {
    setupMocks({ actions: mockActions });
    render(<InspectAdapt />);
    expect(screen.getByText("Deploys take too long")).toBeInTheDocument();
    expect(screen.getByText("Manual release checks")).toBeInTheDocument();
    expect(screen.getByText("Automate deployment pipeline")).toBeInTheDocument();
    expect(screen.getByText("Platform")).toBeInTheDocument();
    expect(screen.getByText("In Progress")).toBeInTheDocument();
    expect(screen.getByText("Done")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2);
  });

  it("opens the new improvement action modal", async () => {
    const user = userEvent.setup();
    render(<InspectAdapt />);
    await user.click(screen.getByRole("button", { name: "+ New Action" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add Action" })).toBeInTheDocument();
  });

  it("validates required improvement action fields", async () => {
    const user = userEvent.setup();
    render(<InspectAdapt />);
    await user.click(screen.getByRole("button", { name: "+ New Action" }));
    await user.click(screen.getByRole("button", { name: "Add Action" }));
    expect(screen.getByText("Problem statement is required.")).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Problem Statement/), "Deployment delays");
    await user.click(screen.getByRole("button", { name: "Add Action" }));
    expect(screen.getByText("Action is required.")).toBeInTheDocument();
  });

  it("submits a new improvement action with the current PI id", async () => {
    const mutate = vi.fn();
    vi.mocked(useMutation).mockReturnValue({ mutate, isPending: false } as any);
    const user = userEvent.setup();
    render(<InspectAdapt />);
    await user.click(screen.getByRole("button", { name: "+ New Action" }));
    await user.type(screen.getByLabelText(/Problem Statement/), "Deployment delays");
    await user.type(screen.getByLabelText(/Root Cause/), "Manual approvals");
    await user.type(screen.getByLabelText(/^Action/), "Automate release gates");
    await user.type(screen.getByLabelText(/Owner/), "Platform");
    await user.selectOptions(screen.getByLabelText(/Status/), "in_progress");
    await user.click(screen.getByRole("button", { name: "Add Action" }));
    expect(mutate).toHaveBeenCalledWith({
      pi_id: "pi-1",
      problem_statement: "Deployment delays",
      root_cause: "Manual approvals",
      action: "Automate release gates",
      owner: "Platform",
      status: "in_progress",
    });
  });

  it("binds improvement action mutations to API methods", async () => {
    const mutationFns: Array<(value: any) => unknown> = [];
    vi.mocked(useMutation).mockImplementation((opts: any) => {
      if (opts?.mutationFn) mutationFns.push(opts.mutationFn);
      return { mutate: vi.fn(), isPending: false } as any;
    });
    vi.mocked(api.createImprovementAction).mockResolvedValue(mockActions[0]);
    vi.mocked(api.updateImprovementAction).mockResolvedValue(mockActions[0]);
    vi.mocked(api.deleteImprovementAction).mockResolvedValue(undefined);

    render(<InspectAdapt />);
    await mutationFns[0]?.({ ...mockActions[0], pi_id: "pi-1" });
    await mutationFns[1]?.({ id: "action-1", body: { status: "done" } });
    await mutationFns[2]?.("action-1");

    expect(api.createImprovementAction).toHaveBeenCalledWith({ ...mockActions[0], pi_id: "pi-1" });
    expect(api.updateImprovementAction).toHaveBeenCalledWith("action-1", { status: "done" });
    expect(api.deleteImprovementAction).toHaveBeenCalledWith("action-1");
  });

  it("opens edit modal with existing action values and submits an update", async () => {
    setupMocks({ actions: mockActions });
    const mutate = vi.fn();
    vi.mocked(useMutation).mockReturnValue({ mutate, isPending: false } as any);
    const user = userEvent.setup();
    render(<InspectAdapt />);
    await user.click(screen.getAllByRole("button", { name: "Edit" })[0]);
    expect(screen.getByRole("button", { name: "Save Changes" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Problem Statement/)).toHaveValue("Deploys take too long");
    await user.clear(screen.getByLabelText(/Owner/));
    await user.type(screen.getByLabelText(/Owner/), "RTE");
    await user.selectOptions(screen.getByLabelText(/Status/), "done");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));
    expect(mutate).toHaveBeenCalledWith({
      id: "action-1",
      body: {
        problem_statement: "Deploys take too long",
        root_cause: "Manual release checks",
        action: "Automate deployment pipeline",
        owner: "RTE",
        status: "done",
      },
    });
  });

  it("shows improvement action mutation errors in the modal", async () => {
    const onErrors: Array<(e: Error) => void> = [];
    vi.mocked(useMutation).mockImplementation((opts: any) => {
      if (opts?.onError) onErrors.push(opts.onError);
      return { mutate: vi.fn(), isPending: false } as any;
    });
    const user = userEvent.setup();
    render(<InspectAdapt />);
    await user.click(screen.getByRole("button", { name: "+ New Action" }));
    act(() => {
      onErrors[0]?.(new Error("Create failed"));
    });
    expect(screen.getByText("Create failed")).toBeInTheDocument();
  });

  it("closes action modal on mutation success", async () => {
    const onSuccesses: Array<() => void> = [];
    vi.mocked(useMutation).mockImplementation((opts: any) => {
      if (opts?.onSuccess) onSuccesses.push(opts.onSuccess);
      return { mutate: vi.fn(), isPending: false } as any;
    });
    const user = userEvent.setup();
    render(<InspectAdapt />);
    await user.click(screen.getByRole("button", { name: "+ New Action" }));
    act(() => {
      onSuccesses[0]?.();
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes action modal when update mutation succeeds", async () => {
    setupMocks({ actions: mockActions });
    const onSuccesses: Array<() => void> = [];
    vi.mocked(useMutation).mockImplementation((opts: any) => {
      if (opts?.onSuccess) onSuccesses.push(opts.onSuccess);
      return { mutate: vi.fn(), isPending: false } as any;
    });
    const user = userEvent.setup();
    render(<InspectAdapt />);
    await user.click(screen.getAllByRole("button", { name: "Edit" })[0]);
    act(() => {
      onSuccesses[1]?.();
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows pending label while saving an improvement action", async () => {
    vi.mocked(useMutation).mockReturnValue({ mutate: vi.fn(), isPending: true } as any);
    const user = userEvent.setup();
    render(<InspectAdapt />);
    await user.click(screen.getByRole("button", { name: "+ New Action" }));
    expect(screen.getByRole("button", { name: "Saving…" })).toBeInTheDocument();
  });

  it("shows and cancels delete confirmation for an improvement action", async () => {
    setupMocks({ actions: mockActions });
    const user = userEvent.setup();
    render(<InspectAdapt />);
    await user.click(screen.getAllByRole("button", { name: "Delete" })[0]);
    expect(screen.getByRole("button", { name: "Yes, delete" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("button", { name: "Yes, delete" })).not.toBeInTheDocument();
  });

  it("submits improvement action delete confirmation", async () => {
    setupMocks({ actions: mockActions });
    const mutate = vi.fn();
    vi.mocked(useMutation).mockReturnValue({ mutate, isPending: false } as any);
    const user = userEvent.setup();
    render(<InspectAdapt />);
    await user.click(screen.getAllByRole("button", { name: "Delete" })[0]);
    await user.click(screen.getByRole("button", { name: "Yes, delete" }));
    expect(mutate).toHaveBeenCalledWith("action-1");
  });

  it("shows delete errors for improvement actions", async () => {
    setupMocks({ actions: mockActions });
    const onErrors: Array<(e: Error) => void> = [];
    vi.mocked(useMutation).mockImplementation((opts: any) => {
      if (opts?.onError) onErrors.push(opts.onError);
      return { mutate: vi.fn(), isPending: false } as any;
    });
    const user = userEvent.setup();
    render(<InspectAdapt />);
    await user.click(screen.getAllByRole("button", { name: "Delete" })[0]);
    act(() => {
      onErrors[2]?.(new Error("Delete failed"));
    });
    expect(screen.getByText("Delete failed")).toBeInTheDocument();
  });

  it("clears delete confirmation when delete mutation succeeds", async () => {
    setupMocks({ actions: mockActions });
    const onSuccesses: Array<() => void> = [];
    vi.mocked(useMutation).mockImplementation((opts: any) => {
      if (opts?.onSuccess) onSuccesses.push(opts.onSuccess);
      return { mutate: vi.fn(), isPending: false } as any;
    });
    const user = userEvent.setup();
    render(<InspectAdapt />);
    await user.click(screen.getAllByRole("button", { name: "Delete" })[0]);
    act(() => {
      onSuccesses[2]?.();
    });
    expect(screen.queryByRole("button", { name: "Yes, delete" })).not.toBeInTheDocument();
  });
});
