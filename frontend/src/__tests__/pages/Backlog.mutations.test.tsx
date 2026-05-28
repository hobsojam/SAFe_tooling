import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("react-router-dom", () => ({
  useParams: () => ({ piId: "pi-1" }),
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useQueryClient: vi.fn(),
}));

vi.mock("../../components/Toaster", () => ({ useToast: () => vi.fn() }));
vi.mock("../../components/Spinner", () => ({ Spinner: () => <div>Loading…</div> }));

import { Backlog } from "../../pages/Backlog";
import { makeFeature, makeIteration, makePI, makeStory, makeTeam } from "../factories";

const mockPI = makePI({ id: "pi-1", name: "PI 2026.1", status: "active" });
const mockTeams = [makeTeam({ id: "team-1", name: "Alpha" })];
const mockIteration = makeIteration({ id: "iter-1", pi_id: "pi-1", number: 1 });
const baseFeature = makeFeature({
  id: "feat-1",
  pi_id: "pi-1",
  wsjf_score: 3,
  cost_of_delay: 15,
  team_id: null,
});
const baseStory = makeStory({
  id: "story-1",
  feature_id: "feat-1",
  team_id: "team-1",
  name: "Login flow",
});

type MutOpts = { onSuccess?: () => void; onError?: (e: Error) => void };
type CapturedEntry = { opts: MutOpts; mutate: ReturnType<typeof vi.fn> };

// React re-renders on every state change (each keypress), so useMutation is called
// on every render and captured.length grows beyond 3. Never rely on captured[N] for
// assertions — instead use captured.some(...) to check any call matches, and fire
// callbacks on all captured entries for onSuccess/onError tests.
function captureMutations({
  features = [baseFeature],
  allStories = [],
  featureStories = [],
  teams = mockTeams,
  iterations = [mockIteration],
}: {
  features?: ReturnType<typeof makeFeature>[];
  allStories?: ReturnType<typeof makeStory>[];
  featureStories?: ReturnType<typeof makeStory>[];
  teams?: ReturnType<typeof makeTeam>[];
  iterations?: ReturnType<typeof makeIteration>[];
} = {}): CapturedEntry[] {
  const captured: CapturedEntry[] = [];
  vi.mocked(useQueryClient).mockReturnValue({ invalidateQueries: vi.fn() } as any);
  vi.mocked(useMutation).mockImplementation((opts: unknown) => {
    const mutate = vi.fn();
    captured.push({ opts: opts as MutOpts, mutate });
    return { mutate, isPending: false } as any;
  });
  vi.mocked(useQuery).mockImplementation(({ queryKey }: any) => {
    const key = (queryKey as unknown[])[0] as string;
    if (key === "pi") return { data: mockPI, isLoading: false } as any;
    if (key === "features") return { data: features, isLoading: false } as any;
    if (key === "teams") return { data: teams, isLoading: false } as any;
    if (key === "iterations") return { data: iterations, isLoading: false } as any;
    if (key === "stories")
      return {
        data: queryKey.length === 1 ? allStories : featureStories,
        isLoading: false,
      } as any;
    return { data: undefined, isLoading: false } as any;
  });
  return captured;
}

// Helper: was any captured mutation called with args matching predicate?
function anyMutateCalled(captured: CapturedEntry[], match: (arg: unknown) => boolean): boolean {
  return captured.some((c) => c.mutate.mock.calls.some(([arg]: unknown[]) => match(arg)));
}

// Helper: fire all captured onSuccess callbacks.
function fireAllOnSuccess(captured: CapturedEntry[]) {
  act(() => {
    for (const c of captured) c.opts.onSuccess?.();
  });
}

// Helper: fire all captured onError callbacks.
function fireAllOnError(captured: CapturedEntry[], err: Error) {
  act(() => {
    for (const c of captured) c.opts.onError?.(err);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Feature form validation
// ---------------------------------------------------------------------------

describe("Backlog — feature form validation", () => {
  it("shows error when feature name is empty on submit", async () => {
    captureMutations({ features: [] });
    const user = userEvent.setup();
    render(<Backlog />);
    await user.click(screen.getByRole("button", { name: "+ New Feature" }));
    await user.click(screen.getByRole("button", { name: "Add Feature" }));
    expect(screen.getByText("Feature name is required.")).toBeInTheDocument();
  });

  it("Cancel closes the New Feature modal", async () => {
    captureMutations({ features: [] });
    const user = userEvent.setup();
    render(<Backlog />);
    await user.click(screen.getByRole("button", { name: "+ New Feature" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("button", { name: "Add Feature" })).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Feature create mutation
// ---------------------------------------------------------------------------

describe("Backlog — feature create mutation", () => {
  it("calls createMut.mutate with name and pi_id when form is valid", async () => {
    const captured = captureMutations({ features: [] });
    const user = userEvent.setup();
    render(<Backlog />);
    await user.click(screen.getByRole("button", { name: "+ New Feature" }));
    await user.type(screen.getByLabelText(/^name/i), "Auth Service");
    await user.click(screen.getByRole("button", { name: "Add Feature" }));
    expect(
      anyMutateCalled(captured, (arg) => {
        const a = arg as { name?: string; pi_id?: string };
        return a?.name === "Auth Service" && a?.pi_id === "pi-1";
      })
    ).toBe(true);
  });

  it("onSuccess closes the modal", async () => {
    const captured = captureMutations({ features: [] });
    const user = userEvent.setup();
    render(<Backlog />);
    await user.click(screen.getByRole("button", { name: "+ New Feature" }));
    fireAllOnSuccess(captured);
    expect(screen.queryByRole("button", { name: "Add Feature" })).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Feature edit modal prepopulation
// ---------------------------------------------------------------------------

describe("Backlog — feature edit modal prepopulation", () => {
  it("pre-populates name", async () => {
    const feature = makeFeature({ id: "feat-1", pi_id: "pi-1", name: "My Feature" });
    captureMutations({ features: [feature] });
    const user = userEvent.setup();
    render(<Backlog />);
    await user.click(screen.getAllByRole("button", { name: "Edit" })[0]);
    expect(screen.getByLabelText(/^name/i)).toHaveValue("My Feature");
  });

  it("pre-populates description", async () => {
    const feature = makeFeature({ id: "feat-1", pi_id: "pi-1", description: "My description" });
    captureMutations({ features: [feature] });
    const user = userEvent.setup();
    render(<Backlog />);
    await user.click(screen.getAllByRole("button", { name: "Edit" })[0]);
    expect(screen.getByLabelText(/^description/i)).toHaveValue("My description");
  });

  it("pre-populates team select", async () => {
    const feature = makeFeature({ id: "feat-1", pi_id: "pi-1", team_id: "team-1" });
    captureMutations({ features: [feature] });
    const user = userEvent.setup();
    render(<Backlog />);
    await user.click(screen.getAllByRole("button", { name: "Edit" })[0]);
    expect(screen.getByLabelText("Team")).toHaveValue("team-1");
  });

  it("pre-populates status select", async () => {
    const feature = makeFeature({ id: "feat-1", pi_id: "pi-1", status: "implementing" });
    captureMutations({ features: [feature] });
    const user = userEvent.setup();
    render(<Backlog />);
    await user.click(screen.getAllByRole("button", { name: "Edit" })[0]);
    expect(screen.getByLabelText("Status")).toHaveValue("implementing");
  });
});

// ---------------------------------------------------------------------------
// Feature update mutation
// ---------------------------------------------------------------------------

describe("Backlog — feature update mutation", () => {
  it("calls updateMut.mutate with edited name and feature id", async () => {
    const captured = captureMutations({ features: [baseFeature] });
    const user = userEvent.setup();
    render(<Backlog />);
    await user.click(screen.getAllByRole("button", { name: "Edit" })[0]);
    const nameInput = screen.getByLabelText(/^name/i);
    await user.clear(nameInput);
    await user.type(nameInput, "Updated Feature");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));
    expect(
      anyMutateCalled(captured, (arg) => {
        const a = arg as { id?: string; body?: { name?: string } };
        return a?.id === "feat-1" && a?.body?.name === "Updated Feature";
      })
    ).toBe(true);
  });

  it("onSuccess closes the edit modal", async () => {
    const captured = captureMutations({ features: [baseFeature] });
    const user = userEvent.setup();
    render(<Backlog />);
    await user.click(screen.getAllByRole("button", { name: "Edit" })[0]);
    fireAllOnSuccess(captured);
    expect(screen.queryByRole("button", { name: "Save Changes" })).not.toBeInTheDocument();
  });

  it("onError shows error message inside the modal", async () => {
    const captured = captureMutations({ features: [baseFeature] });
    const user = userEvent.setup();
    render(<Backlog />);
    await user.click(screen.getAllByRole("button", { name: "Edit" })[0]);
    fireAllOnError(captured, new Error("Update failed"));
    expect(screen.getByText("Update failed")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Feature form onChange handlers
// ---------------------------------------------------------------------------

describe("Backlog — feature form onChange handlers", () => {
  it("description textarea updates", async () => {
    captureMutations({ features: [] });
    const user = userEvent.setup();
    render(<Backlog />);
    await user.click(screen.getByRole("button", { name: "+ New Feature" }));
    const desc = screen.getByLabelText(/^description/i);
    await user.type(desc, "Some description");
    expect(desc).toHaveValue("Some description");
  });

  it("status select updates", async () => {
    captureMutations({ features: [] });
    const user = userEvent.setup();
    render(<Backlog />);
    await user.click(screen.getByRole("button", { name: "+ New Feature" }));
    const statusSelect = screen.getByLabelText("Status");
    await user.selectOptions(statusSelect, "implementing");
    expect(statusSelect).toHaveValue("implementing");
  });

  it("team select to a team value updates", async () => {
    captureMutations({ features: [] });
    const user = userEvent.setup();
    render(<Backlog />);
    await user.click(screen.getByRole("button", { name: "+ New Feature" }));
    const teamSelect = screen.getByLabelText("Team");
    await user.selectOptions(teamSelect, "team-1");
    expect(teamSelect).toHaveValue("team-1");
  });

  it("team select back to empty clears selection", async () => {
    captureMutations({ features: [] });
    const user = userEvent.setup();
    render(<Backlog />);
    await user.click(screen.getByRole("button", { name: "+ New Feature" }));
    const teamSelect = screen.getByLabelText("Team");
    await user.selectOptions(teamSelect, "team-1");
    await user.selectOptions(teamSelect, "");
    expect(teamSelect).toHaveValue("");
  });

  it("User / Business Value input updates", async () => {
    captureMutations({ features: [] });
    const user = userEvent.setup();
    render(<Backlog />);
    await user.click(screen.getByRole("button", { name: "+ New Feature" }));
    const ubvInput = screen.getByLabelText(/user \/ business value/i);
    await user.clear(ubvInput);
    await user.type(ubvInput, "8");
    expect(ubvInput).toHaveValue(8);
  });

  it("Job Size input updates", async () => {
    captureMutations({ features: [] });
    const user = userEvent.setup();
    render(<Backlog />);
    await user.click(screen.getByRole("button", { name: "+ New Feature" }));
    const jobSizeInput = screen.getByLabelText(/job size/i);
    await user.clear(jobSizeInput);
    await user.type(jobSizeInput, "8");
    expect(jobSizeInput).toHaveValue(8);
  });
});

// ---------------------------------------------------------------------------
// Feature table display
// ---------------------------------------------------------------------------

describe("Backlog — feature table display", () => {
  it("renders features sorted by WSJF descending", () => {
    const highWsjf = makeFeature({
      id: "feat-high",
      pi_id: "pi-1",
      name: "High WSJF",
      wsjf_score: 9,
    });
    const lowWsjf = makeFeature({ id: "feat-low", pi_id: "pi-1", name: "Low WSJF", wsjf_score: 2 });
    // Feed them in reverse order to confirm the page sorts them
    captureMutations({ features: [lowWsjf, highWsjf] });
    render(<Backlog />);
    const nameButtons = screen.getAllByRole("button", { name: /high wsjf|low wsjf/i });
    expect(nameButtons[0]).toHaveTextContent("High WSJF");
    expect(nameButtons[1]).toHaveTextContent("Low WSJF");
  });

  it("shows story count in Stories button when allStories contain feature stories", () => {
    const s1 = makeStory({ feature_id: "feat-1" });
    const s2 = makeStory({ feature_id: "feat-1" });
    captureMutations({ features: [baseFeature], allStories: [s1, s2] });
    render(<Backlog />);
    expect(screen.getByRole("button", { name: /stories \(2\)/i })).toBeInTheDocument();
  });

  it("shows feature description below name in the table", () => {
    const feature = makeFeature({
      id: "feat-1",
      pi_id: "pi-1",
      name: "Auth",
      description: "Handles auth flows",
    });
    captureMutations({ features: [feature] });
    render(<Backlog />);
    // Description appears in both mobile and desktop sections
    expect(screen.getAllByText("Handles auth flows").length).toBeGreaterThanOrEqual(1);
  });

  it("renders Pagination when features exceed page size of 25", () => {
    const manyFeatures = Array.from({ length: 26 }, (_, i) =>
      makeFeature({ pi_id: "pi-1", name: `Feature ${i + 1}`, wsjf_score: i })
    );
    captureMutations({ features: manyFeatures });
    render(<Backlog />);
    expect(screen.getByText(/page 1 of 2/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// toggleExpand
// ---------------------------------------------------------------------------

describe("Backlog — toggleExpand", () => {
  it("collapses StoryPanel when Stories button is clicked a second time", async () => {
    captureMutations({ features: [baseFeature], featureStories: [baseStory] });
    const user = userEvent.setup();
    render(<Backlog />);
    const storiesBtn = screen.getByRole("button", { name: /stories/i });
    await user.click(storiesBtn);
    expect(screen.getByText("Login flow")).toBeInTheDocument();
    await user.click(storiesBtn);
    expect(screen.queryByText("Login flow")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// StoryPanel — add story
// ---------------------------------------------------------------------------

describe("Backlog — StoryPanel add story", () => {
  it('"Add Story" button opens the inline add form', async () => {
    captureMutations({ features: [baseFeature], featureStories: [] });
    const user = userEvent.setup();
    render(<Backlog />);
    await user.click(screen.getByRole("button", { name: /stories/i }));
    await user.click(screen.getByRole("button", { name: "+ Add Story" }));
    expect(screen.getByLabelText("Story name")).toBeInTheDocument();
  });

  it("Cancel hides the add story form", async () => {
    captureMutations({ features: [baseFeature], featureStories: [] });
    const user = userEvent.setup();
    render(<Backlog />);
    await user.click(screen.getByRole("button", { name: /stories/i }));
    await user.click(screen.getByRole("button", { name: "+ Add Story" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByLabelText("Story name")).not.toBeInTheDocument();
  });

  it("shows validation error when name is empty", async () => {
    captureMutations({ features: [baseFeature], featureStories: [] });
    const user = userEvent.setup();
    render(<Backlog />);
    await user.click(screen.getByRole("button", { name: /stories/i }));
    await user.click(screen.getByRole("button", { name: "+ Add Story" }));
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByText("Name is required.")).toBeInTheDocument();
  });

  it("shows validation error when team is cleared", async () => {
    captureMutations({ features: [baseFeature], featureStories: [] });
    const user = userEvent.setup();
    render(<Backlog />);
    await user.click(screen.getByRole("button", { name: /stories/i }));
    await user.click(screen.getByRole("button", { name: "+ Add Story" }));
    await user.selectOptions(screen.getByLabelText("Team"), "");
    await user.type(screen.getByLabelText("Story name"), "My story");
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByText("Team is required.")).toBeInTheDocument();
  });

  it("calls createStoryMut.mutate with name and feature_id", async () => {
    const captured = captureMutations({ features: [baseFeature], featureStories: [] });
    const user = userEvent.setup();
    render(<Backlog />);
    await user.click(screen.getByRole("button", { name: /stories/i }));
    await user.click(screen.getByRole("button", { name: "+ Add Story" }));
    await user.type(screen.getByLabelText("Story name"), "New Story");
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(
      anyMutateCalled(captured, (arg) => {
        const a = arg as { name?: string; feature_id?: string };
        return a?.name === "New Story" && a?.feature_id === "feat-1";
      })
    ).toBe(true);
  });

  it("story add onError shows error in the add form", async () => {
    const captured = captureMutations({ features: [baseFeature], featureStories: [] });
    const user = userEvent.setup();
    render(<Backlog />);
    await user.click(screen.getByRole("button", { name: /stories/i }));
    await user.click(screen.getByRole("button", { name: "+ Add Story" }));
    fireAllOnError(captured, new Error("Story save failed"));
    expect(screen.getByText("Story save failed")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// StoryPanel — edit story
// ---------------------------------------------------------------------------

describe("Backlog — StoryPanel edit story", () => {
  it("click Edit shows inline form pre-filled with story name", async () => {
    captureMutations({ features: [baseFeature], featureStories: [baseStory] });
    const user = userEvent.setup();
    render(<Backlog />);
    await user.click(screen.getByRole("button", { name: /stories/i }));
    // Last Edit in DOM order is the story's Edit (after mobile + desktop feature Edits)
    await user.click(screen.getAllByRole("button", { name: "Edit" }).at(-1)!);
    expect(screen.getByLabelText("Story name")).toHaveValue("Login flow");
  });

  it("shows validation error when story edit name is cleared", async () => {
    captureMutations({ features: [baseFeature], featureStories: [baseStory] });
    const user = userEvent.setup();
    render(<Backlog />);
    await user.click(screen.getByRole("button", { name: /stories/i }));
    await user.click(screen.getAllByRole("button", { name: "Edit" }).at(-1)!);
    await user.clear(screen.getByLabelText("Story name"));
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText("Name is required.")).toBeInTheDocument();
  });

  it("Cancel closes the inline edit form", async () => {
    captureMutations({ features: [baseFeature], featureStories: [baseStory] });
    const user = userEvent.setup();
    render(<Backlog />);
    await user.click(screen.getByRole("button", { name: /stories/i }));
    await user.click(screen.getAllByRole("button", { name: "Edit" }).at(-1)!);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByLabelText("Story name")).not.toBeInTheDocument();
  });

  it("calls updateStoryMut.mutate with story id and edited name", async () => {
    const captured = captureMutations({ features: [baseFeature], featureStories: [baseStory] });
    const user = userEvent.setup();
    render(<Backlog />);
    await user.click(screen.getByRole("button", { name: /stories/i }));
    await user.click(screen.getAllByRole("button", { name: "Edit" }).at(-1)!);
    await user.clear(screen.getByLabelText("Story name"));
    await user.type(screen.getByLabelText("Story name"), "Updated story");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(
      anyMutateCalled(captured, (arg) => {
        const a = arg as { id?: string; body?: { name?: string } };
        return a?.id === "story-1" && a?.body?.name === "Updated story";
      })
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// StoryPanel — delete story
// ---------------------------------------------------------------------------

describe("Backlog — StoryPanel delete story", () => {
  it("click Delete shows inline confirm row", async () => {
    captureMutations({ features: [baseFeature], featureStories: [baseStory] });
    const user = userEvent.setup();
    render(<Backlog />);
    await user.click(screen.getByRole("button", { name: /stories/i }));
    // Last Delete in DOM order belongs to the story
    await user.click(screen.getAllByRole("button", { name: "Delete" }).at(-1)!);
    expect(screen.getByRole("button", { name: "Yes, delete" })).toBeInTheDocument();
  });

  it("Cancel in delete confirm hides confirm row", async () => {
    captureMutations({ features: [baseFeature], featureStories: [baseStory] });
    const user = userEvent.setup();
    render(<Backlog />);
    await user.click(screen.getByRole("button", { name: /stories/i }));
    await user.click(screen.getAllByRole("button", { name: "Delete" }).at(-1)!);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("button", { name: "Yes, delete" })).not.toBeInTheDocument();
  });

  it('"Yes, delete" calls deleteStoryMut.mutate with story id', async () => {
    const captured = captureMutations({ features: [baseFeature], featureStories: [baseStory] });
    const user = userEvent.setup();
    render(<Backlog />);
    await user.click(screen.getByRole("button", { name: /stories/i }));
    await user.click(screen.getAllByRole("button", { name: "Delete" }).at(-1)!);
    await user.click(screen.getByRole("button", { name: "Yes, delete" }));
    expect(anyMutateCalled(captured, (arg) => arg === "story-1")).toBe(true);
  });
});
