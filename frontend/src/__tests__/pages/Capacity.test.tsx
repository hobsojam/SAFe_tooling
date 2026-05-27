import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Capacity } from "../../pages/Capacity";

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useQueryClient: vi.fn(),
}));

vi.mock("react-router-dom", () => ({
  useParams: () => ({ piId: "pi-1" }),
}));

vi.mock("../../api", () => ({
  api: {
    getPI: vi.fn(),
    listIterations: vi.fn(),
    listTeams: vi.fn(),
    listCapacityPlans: vi.fn(),
    listStories: vi.fn(),
    upsertCapacityPlan: vi.fn(),
    seedCapacityPlans: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../components/Toaster", () => ({
  useToast: () => vi.fn(),
}));

vi.mock("../../components/Spinner", () => ({
  Spinner: () => <div>Loading…</div>,
}));

vi.mock("../../components/EmptyState", () => ({
  EmptyState: ({ message }: { message: string }) => <div>{message}</div>,
}));

vi.mock("../../components/Modal", () => ({
  Modal: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div role="dialog">{children}</div> : null,
}));

const mockPi = { id: "pi-1", name: "PI 2026.1", status: "active" };
const mockIterations = [
  {
    id: "iter-1",
    number: 1,
    start_date: "2026-01-05",
    end_date: "2026-01-16",
    is_ip: false,
    pi_id: "pi-1",
  },
  {
    id: "iter-2",
    number: 2,
    start_date: "2026-01-19",
    end_date: "2026-01-30",
    is_ip: false,
    pi_id: "pi-1",
  },
];
const mockTeams = [
  { id: "team-1", name: "Alpha", art_id: "art-1", member_count: 6 },
  { id: "team-2", name: "Beta", art_id: "art-1", member_count: 5 },
];

const makePlan = (teamId: string, iterId: string, availableCapacity: number) => ({
  id: `plan-${teamId}-${iterId}`,
  team_id: teamId,
  iteration_id: iterId,
  pi_id: "pi-1",
  team_size: 6,
  iteration_days: 10,
  pto_days: 0,
  overhead_pct: 0.2,
  available_capacity: availableCapacity,
});

function setupQueries({
  plans = [],
  stories = [],
}: {
  plans?: ReturnType<typeof makePlan>[];
  stories?: { id: string; team_id: string; iteration_id: string; points: number }[];
} = {}) {
  (useQueryClient as ReturnType<typeof vi.fn>).mockReturnValue({ invalidateQueries: vi.fn() });
  (useMutation as ReturnType<typeof vi.fn>).mockReturnValue({ mutate: vi.fn(), isPending: false });
  (useQuery as ReturnType<typeof vi.fn>).mockImplementation(
    ({ queryKey }: { queryKey: string[] }) => {
      if (queryKey[0] === "pi") return { data: mockPi };
      if (queryKey[0] === "iterations") return { data: mockIterations };
      if (queryKey[0] === "teams") return { data: mockTeams };
      if (queryKey[0] === "capacity-plans") return { data: plans, isLoading: false };
      if (queryKey[0] === "stories") return { data: stories };
      return { data: undefined };
    }
  );
}

describe("Capacity color coding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the color legend", () => {
    setupQueries();
    render(<Capacity />);
    expect(screen.getByText(/Under-loaded/)).toBeInTheDocument();
    expect(screen.getByText(/Suitably planned/)).toBeInTheDocument();
    expect(screen.getByText(/Over capacity/)).toBeInTheDocument();
  });

  it("applies amber (yellow) classes when load is below 70%", () => {
    const plans = [makePlan("team-1", "iter-1", 50)];
    const stories = [{ id: "s1", team_id: "team-1", iteration_id: "iter-1", points: 10 }];
    setupQueries({ plans, stories });
    render(<Capacity />);
    // 10/50 = 20% load → yellow variant
    const buttons = screen.getAllByRole("button");
    const planButton = buttons.find(
      (b) => b.textContent?.includes("50") && b.textContent?.includes("days")
    );
    expect(planButton).toBeDefined();
    expect(planButton!.className).toContain("bg-amber-50");
    expect(planButton!.className).not.toContain("bg-blue");
    expect(planButton!.className).not.toContain("bg-red");
  });

  it("applies blue classes when load is 70–100%", () => {
    const plans = [makePlan("team-1", "iter-1", 50)];
    const stories = [{ id: "s1", team_id: "team-1", iteration_id: "iter-1", points: 40 }];
    setupQueries({ plans, stories });
    render(<Capacity />);
    // 40/50 = 80% load → blue variant
    const buttons = screen.getAllByRole("button");
    const planButton = buttons.find(
      (b) => b.textContent?.includes("50") && b.textContent?.includes("days")
    );
    expect(planButton).toBeDefined();
    expect(planButton!.className).toContain("bg-blue-50");
  });

  it("applies red classes when load exceeds 100%", () => {
    const plans = [makePlan("team-1", "iter-1", 50)];
    const stories = [{ id: "s1", team_id: "team-1", iteration_id: "iter-1", points: 60 }];
    setupQueries({ plans, stories });
    render(<Capacity />);
    // 60/50 = 120% load → red variant
    const buttons = screen.getAllByRole("button");
    const planButton = buttons.find(
      (b) => b.textContent?.includes("50") && b.textContent?.includes("days")
    );
    expect(planButton).toBeDefined();
    expect(planButton!.className).toContain("bg-red-50");
  });

  it("shows load percentage alongside committed points", () => {
    const plans = [makePlan("team-1", "iter-1", 50)];
    const stories = [{ id: "s1", team_id: "team-1", iteration_id: "iter-1", points: 40 }];
    setupQueries({ plans, stories });
    render(<Capacity />);
    // 40/50 = 80%
    expect(screen.getByText(/40 pts committed · 80% load/)).toBeInTheDocument();
  });

  it("shows only pts committed (no load %) when no plan is set", () => {
    const stories = [{ id: "s1", team_id: "team-1", iteration_id: "iter-1", points: 5 }];
    setupQueries({ stories });
    render(<Capacity />);
    expect(screen.getByText(/5 pts committed/)).toBeInTheDocument();
    expect(screen.queryByText(/%\s*load/)).toBeNull();
  });

  it("applies amber to a plan cell with no committed stories", () => {
    const plans = [makePlan("team-1", "iter-1", 48)];
    setupQueries({ plans });
    render(<Capacity />);
    // 0/48 = 0% load → yellow variant
    const buttons = screen.getAllByRole("button");
    const planButton = buttons.find(
      (b) => b.textContent?.includes("48") && b.textContent?.includes("days")
    );
    expect(planButton).toBeDefined();
    expect(planButton!.className).toContain("bg-amber-50");
  });

  it("shows loading spinner while capacity plans are loading", () => {
    (useQueryClient as ReturnType<typeof vi.fn>).mockReturnValue({ invalidateQueries: vi.fn() });
    (useMutation as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
    (useQuery as ReturnType<typeof vi.fn>).mockImplementation(
      ({ queryKey }: { queryKey: string[] }) => {
        if (queryKey[0] === "capacity-plans") return { data: undefined, isLoading: true };
        if (queryKey[0] === "pi") return { data: mockPi };
        if (queryKey[0] === "iterations") return { data: mockIterations };
        if (queryKey[0] === "teams") return { data: mockTeams };
        if (queryKey[0] === "stories") return { data: [] };
        return { data: undefined };
      }
    );
    render(<Capacity />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("renders gracefully when capacity-plans data fails to load (isError)", () => {
    (useQueryClient as ReturnType<typeof vi.fn>).mockReturnValue({ invalidateQueries: vi.fn() });
    (useMutation as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
    (useQuery as ReturnType<typeof vi.fn>).mockImplementation(
      ({ queryKey }: { queryKey: string[] }) => {
        if (queryKey[0] === "capacity-plans")
          return { data: undefined, isLoading: false, isError: true };
        if (queryKey[0] === "pi") return { data: mockPi };
        if (queryKey[0] === "iterations") return { data: mockIterations };
        if (queryKey[0] === "teams") return { data: mockTeams };
        if (queryKey[0] === "stories") return { data: [] };
        return { data: undefined };
      }
    );
    render(<Capacity />);
    // plans default to [] → capacity grid renders without crashing
    expect(screen.getByText(/Under-loaded/)).toBeInTheDocument();
  });

  it("shows error message in modal when capacity plan upsert fails", async () => {
    const plans = [makePlan("team-1", "iter-1", 48)];
    setupQueries({ plans });
    const onErrors: Array<(e: Error) => void> = [];
    (useMutation as ReturnType<typeof vi.fn>).mockImplementation((opts: any) => {
      if (opts?.onError) onErrors.push(opts.onError);
      return { mutate: vi.fn(), isPending: false };
    });
    const user = userEvent.setup();
    render(<Capacity />);
    const planButtons = screen.getAllByRole("button");
    const planButton = planButtons.find(
      (b) => b.textContent?.includes("48") && b.textContent?.includes("days")
    );
    await user.click(planButton!);
    act(() => {
      onErrors[0]?.(new Error("Save failed"));
    });
    expect(screen.getByText("Save failed")).toBeInTheDocument();
  });
});
