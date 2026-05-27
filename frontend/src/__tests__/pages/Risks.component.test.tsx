import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("react-router-dom", () => ({
  useParams: () => ({ piId: "pi-1" }),
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return { ...actual, useQuery: vi.fn(), useMutation: vi.fn(), useQueryClient: vi.fn() };
});

vi.mock("../../components/Toaster", () => ({ useToast: () => vi.fn() }));

vi.mock("../../components/Spinner", () => ({ Spinner: () => <div>Loading…</div> }));

import { useMutation } from "@tanstack/react-query";
import { Risks } from "../../pages/Risks";
import { makePI, makeRisk, makeTeam } from "../factories";
import { setupQueryMocks } from "../setupMocks";

const mockPI = makePI({ id: "pi-1", name: "PI 2026.1", status: "active" });
const mockTeams = [makeTeam({ id: "team-1", name: "Alpha" })];
const baseRisk = makeRisk({ id: "risk-1", pi_id: "pi-1" });

describe("Risks page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty state when no risks", () => {
    setupQueryMocks({ pi: mockPI, risks: [], teams: mockTeams });
    render(<Risks />);
    expect(screen.getByText("No risks for this PI.")).toBeInTheDocument();
  });

  it('renders "—" for risk with null team_id', () => {
    setupQueryMocks({ pi: mockPI, risks: [{ ...baseRisk, team_id: null }], teams: mockTeams });
    render(<Risks />);
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it("renders team name when team found in map", () => {
    setupQueryMocks({ pi: mockPI, risks: [{ ...baseRisk, team_id: "team-1" }], teams: mockTeams });
    render(<Risks />);
    expect(screen.getAllByText("Alpha").length).toBeGreaterThanOrEqual(1);
  });

  it("renders raw team_id when team not in map", () => {
    setupQueryMocks({
      pi: mockPI,
      risks: [{ ...baseRisk, team_id: "unknown-team-id" }],
      teams: [],
    });
    render(<Risks />);
    expect(screen.getAllByText("unknown-team-id").length).toBeGreaterThanOrEqual(1);
  });

  it('opens modal and shows "Add Risk" on submit button', async () => {
    setupQueryMocks({ pi: mockPI, risks: [], teams: mockTeams });
    const user = userEvent.setup();
    render(<Risks />);
    await user.click(screen.getByRole("button", { name: "+ New Risk" }));
    expect(screen.getByRole("button", { name: "Add Risk" })).toBeInTheDocument();
  });

  it('opens edit modal and shows "Save Changes" on submit button', async () => {
    setupQueryMocks({ pi: mockPI, risks: [baseRisk], teams: mockTeams });
    const user = userEvent.setup();
    render(<Risks />);
    const editButtons = screen.getAllByRole("button", { name: "Edit" });
    await user.click(editButtons[0]);
    expect(screen.getByRole("button", { name: "Save Changes" })).toBeInTheDocument();
  });

  it('shows "Saving…" on submit button when mutation isPending', async () => {
    setupQueryMocks({ pi: mockPI, risks: [], teams: mockTeams }, { isPending: true });
    const user = userEvent.setup();
    render(<Risks />);
    await user.click(screen.getByRole("button", { name: "+ New Risk" }));
    expect(screen.getByRole("button", { name: "Saving…" })).toBeInTheDocument();
  });

  it("shows loading spinner while data is loading", () => {
    setupQueryMocks({ pi: mockPI, risks: [], teams: mockTeams }, { isLoading: true });
    render(<Risks />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("renders gracefully when risks data fails to load (isError)", () => {
    setupQueryMocks(
      ({ queryKey }) => {
        const key = queryKey[0] as string;
        if (key === "pi") return mockPI;
        if (key === "teams") return mockTeams;
        return undefined; // risks returns undefined → defaults to []
      },
      { isError: true }
    );
    render(<Risks />);
    expect(screen.getByText("No risks for this PI.")).toBeInTheDocument();
  });

  it("shows error message in modal when risk create mutation fails", async () => {
    setupQueryMocks({ pi: mockPI, risks: [], teams: mockTeams });
    const onErrors: Array<(e: Error) => void> = [];
    vi.mocked(useMutation).mockImplementation((opts: any) => {
      if (opts?.onError) onErrors.push(opts.onError);
      return { mutate: vi.fn(), isPending: false } as any;
    });
    const user = userEvent.setup();
    render(<Risks />);
    await user.click(screen.getByRole("button", { name: "+ New Risk" }));
    act(() => {
      onErrors[0]?.(new Error("Server error"));
    });
    expect(screen.getByText("Server error")).toBeInTheDocument();
  });
});
