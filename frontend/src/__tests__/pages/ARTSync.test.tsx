import { render, screen } from "@testing-library/react";
import { useQuery } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ARTSync } from "../../pages/ARTSync";
import { makePI, makeTeam, makeIteration, makeStory } from "../factories";

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
}));

vi.mock("react-router-dom", () => ({
  useParams: () => ({ piId: "pi-1" }),
}));

vi.mock("../../api", () => ({
  api: {
    getPI: vi.fn(),
    listIterations: vi.fn(),
    listTeamsByArt: vi.fn(),
    listStories: vi.fn(),
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
const mockIterations = [
  makeIteration({ id: "iter-1", pi_id: "pi-1", number: 1, is_ip: false }),
  makeIteration({ id: "iter-2", pi_id: "pi-1", number: 2, is_ip: false }),
  makeIteration({ id: "iter-ip", pi_id: "pi-1", number: 5, is_ip: true }),
];
// team-1/iter-1: 1 done + 1 not_started => in_progress (1/2)
// team-1/iter-2: 1 accepted + 1 done => all_done (2/2)
// team-2/iter-1: 3 not_started => not_started (0/3)
// team-2/iter-2: no stories => empty
// iter-ip story should be excluded
const mockStories = [
  makeStory({ id: "s-1", team_id: "team-1", iteration_id: "iter-1", status: "done" }),
  makeStory({ id: "s-2", team_id: "team-1", iteration_id: "iter-1", status: "not_started" }),
  makeStory({ id: "s-3", team_id: "team-1", iteration_id: "iter-2", status: "accepted" }),
  makeStory({ id: "s-4", team_id: "team-1", iteration_id: "iter-2", status: "done" }),
  makeStory({ id: "s-5", team_id: "team-2", iteration_id: "iter-1", status: "not_started" }),
  makeStory({ id: "s-6", team_id: "team-2", iteration_id: "iter-1", status: "not_started" }),
  makeStory({ id: "s-7", team_id: "team-2", iteration_id: "iter-1", status: "not_started" }),
  makeStory({ id: "s-ip", team_id: "team-1", iteration_id: "iter-ip", status: "done" }),
];

function setupMocks(
  overrides: {
    isLoading?: boolean;
    iterations?: typeof mockIterations;
    teams?: typeof mockTeams;
    stories?: typeof mockStories;
  } = {}
) {
  vi.mocked(useQuery).mockImplementation(({ queryKey }: Parameters<typeof useQuery>[0]) => {
    if (overrides.isLoading) {
      return { data: undefined, isLoading: true } as unknown as ReturnType<typeof useQuery>;
    }
    const key = (queryKey as string[])[0];
    if (key === "pi")
      return { data: mockPI, isLoading: false } as unknown as ReturnType<typeof useQuery>;
    if (key === "iterations")
      return {
        data: overrides.iterations ?? mockIterations,
        isLoading: false,
      } as unknown as ReturnType<typeof useQuery>;
    if (key === "teams")
      return { data: overrides.teams ?? mockTeams, isLoading: false } as unknown as ReturnType<
        typeof useQuery
      >;
    if (key === "stories")
      return { data: overrides.stories ?? mockStories, isLoading: false } as unknown as ReturnType<
        typeof useQuery
      >;
    return { data: undefined, isLoading: false } as unknown as ReturnType<typeof useQuery>;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setupMocks();
});

describe("ARTSync", () => {
  it("shows loading spinner while data is loading", () => {
    setupMocks({ isLoading: true });
    render(<ARTSync />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("renders page title with PI name", () => {
    render(<ARTSync />);
    expect(screen.getByRole("heading", { name: /ART Sync — PI 2026\.1/ })).toBeInTheDocument();
  });

  it("renders iteration column headers excluding IP", () => {
    render(<ARTSync />);
    expect(screen.getByRole("columnheader", { name: "Iteration 1" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Iteration 2" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Iteration 5" })).not.toBeInTheDocument();
  });

  it("renders a row for each team", () => {
    render(<ARTSync />);
    expect(screen.getByRole("cell", { name: "Alpha" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Beta" })).toBeInTheDocument();
  });

  it("shows in-progress fraction (1/2) for partially done cell", () => {
    render(<ARTSync />);
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
  });

  it("shows all-done fraction (2/2) when all stories are done or accepted", () => {
    render(<ARTSync />);
    expect(screen.getByText("2 / 2")).toBeInTheDocument();
  });

  it("shows 0/N for committed-but-not-started cell", () => {
    render(<ARTSync />);
    expect(screen.getByText("0 / 3")).toBeInTheDocument();
  });

  it("shows dash for cells with no stories", () => {
    render(<ARTSync />);
    // team-2/iter-2 has no stories
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1);
  });

  it("counts accepted status as done", () => {
    render(<ARTSync />);
    // team-1/iter-2: 1 accepted + 1 done = 2 done / 2 total
    expect(screen.getByText("2 / 2")).toBeInTheDocument();
  });

  it("excludes IP iteration from grid and counts", () => {
    render(<ARTSync />);
    // iter-ip column should not exist; IP done story must not inflate other counts
    expect(screen.queryByRole("columnheader", { name: "Iteration 5" })).not.toBeInTheDocument();
    // team-1 total done across non-IP: 1 (iter-1) + 2 (iter-2) = 3, not 4
    expect(screen.queryByText("3 / 3")).not.toBeInTheDocument();
  });

  it("shows legend with all three status labels", () => {
    render(<ARTSync />);
    expect(screen.getByText("All done")).toBeInTheDocument();
    expect(screen.getByText("In progress")).toBeInTheDocument();
    expect(screen.getByText("Not started")).toBeInTheDocument();
  });

  it("shows empty state when no iterations", () => {
    setupMocks({ iterations: [] });
    render(<ARTSync />);
    expect(screen.getByText(/No iterations defined for this PI/)).toBeInTheDocument();
  });

  it("shows empty state when no teams", () => {
    setupMocks({ teams: [] });
    render(<ARTSync />);
    expect(screen.getByText(/No teams found/)).toBeInTheDocument();
  });

  it("shows empty state for IP-only iteration list", () => {
    setupMocks({
      iterations: [makeIteration({ id: "iter-ip", number: 5, is_ip: true })],
    });
    render(<ARTSync />);
    expect(screen.getByText(/No iterations defined for this PI/)).toBeInTheDocument();
  });

  it("handles stories with no iteration_id gracefully", () => {
    setupMocks({
      stories: [
        makeStory({ id: "s-unplanned", team_id: "team-1", iteration_id: null, status: "done" }),
      ],
    });
    render(<ARTSync />);
    // No crash, all cells show dash
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1);
  });
});
