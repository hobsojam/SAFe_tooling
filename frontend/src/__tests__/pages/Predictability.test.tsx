import { render, screen } from "@testing-library/react";
import { useQuery } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Predictability } from "../../pages/Predictability";
import { makePIObjective, makePI, makeTeam } from "../factories";

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
}));

vi.mock("react-router-dom", () => ({
  useParams: () => ({ piId: "pi-1" }),
}));

vi.mock("../../api", () => ({
  api: {
    getPI: vi.fn(),
    listObjectives: vi.fn(),
    listTeamsByArt: vi.fn(),
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
    actual_business_value: 7,
    is_stretch: false,
  }),
  makePIObjective({
    id: "obj-2",
    team_id: "team-1",
    pi_id: "pi-1",
    planned_business_value: 5,
    actual_business_value: null,
    is_stretch: false,
  }),
  makePIObjective({
    id: "obj-3",
    team_id: "team-2",
    pi_id: "pi-1",
    planned_business_value: 6,
    actual_business_value: 6,
    is_stretch: true,
  }),
];

function setupMocks(
  overrides: {
    isLoading?: boolean;
    objectives?: typeof mockObjectives;
    teams?: typeof mockTeams;
  } = {}
) {
  vi.mocked(useQuery).mockImplementation(({ queryKey }: Parameters<typeof useQuery>[0]) => {
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
    if (key === "teams")
      return { data: overrides.teams ?? mockTeams, isLoading: false } as unknown as ReturnType<
        typeof useQuery
      >;
    return { data: undefined, isLoading: false } as unknown as ReturnType<typeof useQuery>;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setupMocks();
});

describe("Predictability", () => {
  it("shows loading spinner while data is loading", () => {
    setupMocks({ isLoading: true });
    render(<Predictability />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("renders the page title with PI name", () => {
    render(<Predictability />);
    expect(screen.getByText(/ART Predictability/)).toBeInTheDocument();
    expect(screen.getByText(/PI 2026\.1/)).toBeInTheDocument();
  });

  it("shows empty state when no committed objectives exist", () => {
    setupMocks({ objectives: [] });
    render(<Predictability />);
    expect(screen.getByText(/No committed objectives/)).toBeInTheDocument();
  });

  it("renders team rows for each team", () => {
    render(<Predictability />);
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
  });

  it('shows "No committed objectives" for teams with only stretch objectives', () => {
    render(<Predictability />);
    expect(screen.getByText("No committed objectives")).toBeInTheDocument();
  });

  it("shows predictability percentage for teams with scored objectives", () => {
    // obj-1: planned=8, actual=7 (scored); obj-2: planned=5, actual=null
    // predictability = round(7 / 13 * 100) = 54%; appears in team row and ART Total footer
    render(<Predictability />);
    expect(screen.getAllByText("54%").length).toBeGreaterThan(0);
  });

  it('shows "Not yet scored" for objectives without actual BV', () => {
    setupMocks({
      objectives: [
        makePIObjective({
          team_id: "team-1",
          planned_business_value: 8,
          actual_business_value: null,
          is_stretch: false,
        }),
      ],
    });
    render(<Predictability />);
    expect(screen.getAllByText("Not yet scored").length).toBeGreaterThan(0);
  });

  it("renders the ART Total footer row", () => {
    render(<Predictability />);
    expect(screen.getByText("ART Total")).toBeInTheDocument();
  });

  it("excludes stretch objectives from ART totals", () => {
    render(<Predictability />);
    // obj-3 is stretch so should not count in the ART total committed count
    // Committed objectives: obj-1, obj-2 (obj-3 is stretch)
    const cells = screen.getAllByText("2");
    expect(cells.length).toBeGreaterThan(0);
  });

  it("renders gracefully when objectives data fails to load (isError)", () => {
    vi.mocked(useQuery).mockImplementation(({ queryKey }: Parameters<typeof useQuery>[0]) => {
      const key = (queryKey as string[])[0];
      if (key === "pi")
        return { data: mockPI, isLoading: false, isError: false } as unknown as ReturnType<
          typeof useQuery
        >;
      return { data: undefined, isLoading: false, isError: true } as unknown as ReturnType<
        typeof useQuery
      >;
    });
    render(<Predictability />);
    expect(screen.getByText(/No committed objectives/)).toBeInTheDocument();
  });
});
