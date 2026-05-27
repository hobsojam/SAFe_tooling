import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("react-router-dom", () => ({
  useParams: () => ({ piId: "pi-1" }),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return { ...actual, useQuery: vi.fn(), useMutation: vi.fn(), useQueryClient: vi.fn() };
});

vi.mock("../../components/Spinner", () => ({ Spinner: () => <div aria-label="Loading" /> }));
vi.mock("../../components/EmptyState", () => ({
  EmptyState: ({ message }: { message: string }) => <div>{message}</div>,
}));
vi.mock("../../components/Badge", () => ({
  PIStatusBadge: ({ status }: { status: string }) => <span>{status}</span>,
}));

import { PIHealth } from "../../pages/PIHealth";
import {
  makeCapacityPlan,
  makeDependency,
  makeIteration,
  makePI,
  makePIObjective,
  makeRisk,
  makeStory,
  makeTeam,
} from "../factories";
import { setupQueryMocks } from "../setupMocks";

const mockPI = makePI({ id: "pi-1", name: "PI 2026.1", art_id: "art-1", status: "active" });
const mockTeam = makeTeam({ id: "team-1", name: "Alpha", art_id: "art-1" });
const mockIteration = makeIteration({ id: "iter-1", pi_id: "pi-1", is_ip: false });

function setup({
  objectives = [],
  risks = [],
  dependencies = [],
  teams = [mockTeam],
  capacityPlans = [],
  stories = [],
  iterations = [mockIteration],
  isLoading = false,
}: {
  objectives?: ReturnType<typeof makePIObjective>[];
  risks?: ReturnType<typeof makeRisk>[];
  dependencies?: ReturnType<typeof makeDependency>[];
  teams?: ReturnType<typeof makeTeam>[];
  capacityPlans?: ReturnType<typeof makeCapacityPlan>[];
  stories?: ReturnType<typeof makeStory>[];
  iterations?: ReturnType<typeof makeIteration>[];
  isLoading?: boolean;
} = {}) {
  setupQueryMocks(
    ({ queryKey }) => {
      const key = queryKey[0] as string;
      if (key === "pi") return mockPI;
      if (key === "teams") return teams;
      if (key === "objectives") return objectives;
      if (key === "risks") return risks;
      if (key === "dependencies") return dependencies;
      if (key === "capacity-plans") return capacityPlans;
      if (key === "stories") return stories;
      if (key === "iterations") return iterations;
      return undefined;
    },
    { isLoading }
  );
}

describe("PIHealth page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows spinner while loading", () => {
    setup({ isLoading: true });
    render(<PIHealth />);
    expect(screen.getByLabelText("Loading")).toBeInTheDocument();
  });

  it("renders the heading with PI name", () => {
    setup();
    render(<PIHealth />);
    expect(screen.getByRole("heading", { name: /PI Health — PI 2026\.1/ })).toBeInTheDocument();
  });

  it("renders the PI status badge", () => {
    setup();
    render(<PIHealth />);
    expect(screen.getByText("active")).toBeInTheDocument();
  });

  it("shows committed objective count", () => {
    setup({
      objectives: [
        makePIObjective({ team_id: "team-1", is_stretch: false }),
        makePIObjective({ team_id: "team-1", is_stretch: false }),
        makePIObjective({ team_id: "team-1", is_stretch: true }),
      ],
    });
    render(<PIHealth />);
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("committed")).toBeInTheDocument();
    expect(screen.getByText("+1 stretch")).toBeInTheDocument();
  });

  it("does not show stretch line when there are no stretch objectives", () => {
    setup({ objectives: [makePIObjective({ is_stretch: false })] });
    render(<PIHealth />);
    expect(screen.queryByText(/stretch/)).not.toBeInTheDocument();
  });

  it("shows unresolved risk count excluding resolved and mitigated", () => {
    setup({
      risks: [
        makeRisk({ roam_status: "unroamed" }),
        makeRisk({ roam_status: "owned" }),
        makeRisk({ roam_status: "resolved" }),
        makeRisk({ roam_status: "mitigated" }),
      ],
    });
    render(<PIHealth />);
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("of 4 total")).toBeInTheDocument();
  });

  it("shows open dependency count excluding resolved", () => {
    setup({
      dependencies: [
        makeDependency({ status: "identified" }),
        makeDependency({ status: "in_progress" }),
        makeDependency({ status: "resolved" }),
      ],
    });
    render(<PIHealth />);
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("of 3 total")).toBeInTheDocument();
  });

  it('shows "—" and "Not yet scored" when no objectives are scored', () => {
    setup({ objectives: [makePIObjective({ actual_business_value: null, is_stretch: false })] });
    render(<PIHealth />);
    const predCard = document.querySelector('a[href$="/predictability"]')!;
    expect(predCard).toHaveTextContent("—");
    expect(predCard).toHaveTextContent("Not yet scored");
  });

  it("shows predictability % when objectives are scored", () => {
    setup({
      objectives: [
        makePIObjective({
          planned_business_value: 10,
          actual_business_value: 8,
          is_stretch: false,
        }),
      ],
    });
    render(<PIHealth />);
    // 8/10 = 80%
    expect(screen.getByText("80%")).toBeInTheDocument();
    expect(screen.getByText("ART · target 80–100%")).toBeInTheDocument();
  });

  it("applies teal class for predictability >= 80%", () => {
    setup({
      objectives: [
        makePIObjective({
          planned_business_value: 10,
          actual_business_value: 8,
          is_stretch: false,
        }),
      ],
    });
    render(<PIHealth />);
    const pct = screen.getByText("80%");
    expect(pct.className).toContain("text-teal-700");
  });

  it("applies amber class for predictability between 60 and 79%", () => {
    setup({
      objectives: [
        makePIObjective({
          planned_business_value: 10,
          actual_business_value: 7,
          is_stretch: false,
        }),
      ],
    });
    render(<PIHealth />);
    // 7/10 = 70%
    const pct = screen.getByText("70%");
    expect(pct.className).toContain("text-amber-600");
  });

  it("applies red class for predictability < 60%", () => {
    setup({
      objectives: [
        makePIObjective({
          planned_business_value: 10,
          actual_business_value: 5,
          is_stretch: false,
        }),
      ],
    });
    render(<PIHealth />);
    // 5/10 = 50%
    const pct = screen.getByText("50%");
    expect(pct.className).toContain("text-red-600");
  });

  it("shows team name in capacity table", () => {
    setup();
    render(<PIHealth />);
    expect(screen.getByRole("cell", { name: "Alpha" })).toBeInTheDocument();
  });

  it('shows "—" for capacity when no plan is set', () => {
    setup();
    render(<PIHealth />);
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it("shows available capacity when a plan exists for a non-IP iteration", () => {
    const plan = makeCapacityPlan({
      team_id: "team-1",
      iteration_id: "iter-1",
      available_capacity: 40,
    });
    setup({ capacityPlans: [plan] });
    render(<PIHealth />);
    expect(screen.getByText("40.0")).toBeInTheDocument();
  });

  it("shows committed story points and load % when stories exist", () => {
    const plan = makeCapacityPlan({
      team_id: "team-1",
      iteration_id: "iter-1",
      available_capacity: 40,
    });
    const story = makeStory({ team_id: "team-1", iteration_id: "iter-1", points: 20 });
    setup({ capacityPlans: [plan], stories: [story] });
    render(<PIHealth />);
    expect(screen.getByText("20")).toBeInTheDocument();
    // 20/40 = 50% → amber (under-loaded)
    const loadPctEl = screen.getByText("50%");
    expect(loadPctEl.className).toContain("text-amber-600");
  });

  it("excludes IP iteration from capacity aggregation", () => {
    const ipIteration = makeIteration({ id: "iter-ip", pi_id: "pi-1", is_ip: true });
    const plan = makeCapacityPlan({
      team_id: "team-1",
      iteration_id: "iter-ip",
      available_capacity: 40,
    });
    setup({ iterations: [ipIteration], capacityPlans: [plan] });
    render(<PIHealth />);
    // IP iteration excluded → available_capacity not summed → shows "—"
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it("shows empty state when no teams found", () => {
    setup({ teams: [] });
    render(<PIHealth />);
    expect(screen.getByText("No teams found for this PI's ART.")).toBeInTheDocument();
  });
});
