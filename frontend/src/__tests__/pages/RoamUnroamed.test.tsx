import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RoamUnroamed } from "../../pages/RoamUnroamed";
import { makePI, makeRisk, makeTeam } from "../factories";

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useQueryClient: vi.fn(),
}));

vi.mock("react-router-dom", () => ({
  useParams: () => ({ piId: "pi-1" }),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

vi.mock("../../api", () => ({
  api: {
    getPI: vi.fn(),
    listRisks: vi.fn(),
    listTeams: vi.fn(),
    updateRisk: vi.fn(),
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

const mockPI = makePI({ id: "pi-1", name: "PI 2026.1" });
const mockTeams = [makeTeam({ id: "team-1", name: "Alpha" })];
const unroamedRisks = [
  makeRisk({
    id: "risk-1",
    description: "API gateway dependency",
    roam_status: "unroamed",
    team_id: "team-1",
  }),
  makeRisk({
    id: "risk-2",
    description: "Third party vendor delay",
    roam_status: "unroamed",
    team_id: null,
  }),
];
const roamedRisk = makeRisk({
  id: "risk-3",
  description: "Already resolved",
  roam_status: "resolved",
});

function setupMocks(overrides: { isLoading?: boolean; risks?: typeof unroamedRisks } = {}) {
  vi.mocked(useQueryClient).mockReturnValue({ invalidateQueries: vi.fn() } as unknown as ReturnType<
    typeof useQueryClient
  >);
  vi.mocked(useMutation).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useMutation>);
  vi.mocked(useQuery).mockImplementation(({ queryKey }: Parameters<typeof useQuery>[0]) => {
    const key = (queryKey as string[])[0];
    if (overrides.isLoading && key === "risks") {
      return { data: undefined, isLoading: true } as unknown as ReturnType<typeof useQuery>;
    }
    if (key === "pi") return { data: mockPI } as unknown as ReturnType<typeof useQuery>;
    if (key === "risks")
      return { data: overrides.risks ?? unroamedRisks, isLoading: false } as unknown as ReturnType<
        typeof useQuery
      >;
    if (key === "teams") return { data: mockTeams } as unknown as ReturnType<typeof useQuery>;
    return { data: undefined, isLoading: false } as unknown as ReturnType<typeof useQuery>;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setupMocks();
});

describe("RoamUnroamed", () => {
  it("shows loading spinner while risks are loading", () => {
    setupMocks({ isLoading: true });
    render(<RoamUnroamed />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("renders the page heading with PI name", () => {
    render(<RoamUnroamed />);
    expect(screen.getByText(/ROAM Unroamed Risks/)).toBeInTheDocument();
    expect(screen.getByText(/PI 2026\.1/)).toBeInTheDocument();
  });

  it("shows count of unroamed risks in header", () => {
    render(<RoamUnroamed />);
    expect(screen.getByText("2 risks need attention")).toBeInTheDocument();
  });

  it("renders unroamed risk descriptions", () => {
    render(<RoamUnroamed />);
    expect(screen.getByText("API gateway dependency")).toBeInTheDocument();
    expect(screen.getByText("Third party vendor delay")).toBeInTheDocument();
  });

  it("does not render already-roamed risks", () => {
    setupMocks({ risks: [roamedRisk, ...unroamedRisks] });
    render(<RoamUnroamed />);
    expect(screen.queryByText("Already resolved")).not.toBeInTheDocument();
  });

  it("shows team name for risks with a team", () => {
    render(<RoamUnroamed />);
    expect(screen.getByText(/Alpha/)).toBeInTheDocument();
  });

  it("shows empty state when all risks are roamed", () => {
    setupMocks({ risks: [] });
    render(<RoamUnroamed />);
    expect(screen.getByText("All risks have been ROAMed.")).toBeInTheDocument();
  });

  it('shows singular "risk" when only one unroamed risk remains', () => {
    setupMocks({ risks: [unroamedRisks[0]] });
    render(<RoamUnroamed />);
    expect(screen.getByText("1 risk need attention")).toBeInTheDocument();
  });

  it("renders ROAM status select for each unroamed risk", () => {
    render(<RoamUnroamed />);
    const selects = screen.getAllByRole("combobox");
    expect(selects.length).toBe(2);
  });

  it('calls mutate when "ROAM this risk" is clicked', async () => {
    const mutate = vi.fn();
    vi.mocked(useMutation).mockReturnValue({ mutate, isPending: false } as unknown as ReturnType<
      typeof useMutation
    >);
    const user = userEvent.setup();
    render(<RoamUnroamed />);
    await user.click(screen.getAllByRole("button", { name: "ROAM this risk" })[0]);
    expect(mutate).toHaveBeenCalled();
  });

  it("renders a back link to the risk register", () => {
    render(<RoamUnroamed />);
    expect(screen.getByText("← Back to Risk Register")).toBeInTheDocument();
  });

  it("allows changing the ROAM status dropdown", async () => {
    const user = userEvent.setup();
    render(<RoamUnroamed />);
    const selects = screen.getAllByRole("combobox");
    await user.selectOptions(selects[0], "resolved");
    expect((selects[0] as HTMLSelectElement).value).toBe("resolved");
  });
});
