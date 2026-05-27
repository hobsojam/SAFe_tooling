import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return { ...actual, useQuery: vi.fn(), useMutation: vi.fn(), useQueryClient: vi.fn() };
});

vi.mock("../../components/Toaster", () => ({ useToast: () => vi.fn() }));

import { ARTSetup } from "../../pages/ARTSetup";
import { makeART } from "../factories";
import { setupQueryMocks } from "../setupMocks";

const mockART = makeART({ id: "art-1", name: "Platform ART", team_ids: ["team-1", "team-2"] });

function setupPageMocks({
  arts = [],
  isPending = false,
  isLoading = false,
}: {
  arts?: ReturnType<typeof makeART>[];
  isPending?: boolean;
  isLoading?: boolean;
} = {}) {
  setupQueryMocks({ arts }, { isPending, isLoading });
}

describe("ARTSetup page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows spinner while loading", () => {
    setupPageMocks({ isLoading: true });
    render(<ARTSetup />);
    expect(screen.getByLabelText("Loading")).toBeInTheDocument();
  });

  it('renders "ART Setup" heading when data is loaded', () => {
    setupPageMocks();
    render(<ARTSetup />);
    expect(screen.getByRole("heading", { name: "ART Setup" })).toBeInTheDocument();
  });

  it("shows empty state when no ARTs exist", () => {
    setupPageMocks({ arts: [] });
    render(<ARTSetup />);
    expect(screen.getByText(/No ARTs yet. Add one to get started/)).toBeInTheDocument();
  });

  it("shows ART name and team count in the table", () => {
    setupPageMocks({ arts: [mockART] });
    render(<ARTSetup />);
    expect(screen.getByText("Platform ART")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it('clicking "+ Add ART" reveals the new ART form', async () => {
    setupPageMocks();
    const user = userEvent.setup();
    render(<ARTSetup />);
    await user.click(screen.getByRole("button", { name: "+ Add ART" }));
    expect(screen.getByText("New ART")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add ART" })).toBeInTheDocument();
  });

  it("shows validation error when ART name is empty on submit", async () => {
    setupPageMocks();
    const user = userEvent.setup();
    render(<ARTSetup />);
    await user.click(screen.getByRole("button", { name: "+ Add ART" }));
    await user.click(screen.getByRole("button", { name: "Add ART" }));
    expect(screen.getByText("Name is required.")).toBeInTheDocument();
  });

  it("Cancel in add form hides the form", async () => {
    setupPageMocks();
    const user = userEvent.setup();
    render(<ARTSetup />);
    await user.click(screen.getByRole("button", { name: "+ Add ART" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText("New ART")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Add ART" })).toBeInTheDocument();
  });

  it('shows "Adding…" on submit button when mutation isPending', async () => {
    setupPageMocks({ isPending: true });
    const user = userEvent.setup();
    render(<ARTSetup />);
    await user.click(screen.getByRole("button", { name: "+ Add ART" }));
    expect(screen.getByRole("button", { name: "Adding…" })).toBeInTheDocument();
  });

  it("clicking Edit opens inline edit form for that ART", async () => {
    setupPageMocks({ arts: [mockART] });
    const user = userEvent.setup();
    render(<ARTSetup />);
    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByRole("textbox", { name: "ART name" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("shows validation error when ART name is cleared in edit form", async () => {
    setupPageMocks({ arts: [mockART] });
    const user = userEvent.setup();
    render(<ARTSetup />);
    await user.click(screen.getByRole("button", { name: "Edit" }));
    const nameInput = screen.getByRole("textbox", { name: "ART name" });
    await user.clear(nameInput);
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText("Name is required.")).toBeInTheDocument();
  });

  it("clicking Delete shows the confirmation row", async () => {
    setupPageMocks({ arts: [mockART] });
    const user = userEvent.setup();
    render(<ARTSetup />);
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByText(/Delete/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Yes, delete" })).toBeInTheDocument();
  });

  it("Cancel in delete confirm restores the normal row", async () => {
    setupPageMocks({ arts: [mockART] });
    const user = userEvent.setup();
    render(<ARTSetup />);
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("displays ART count in the section heading", () => {
    setupPageMocks({ arts: [mockART] });
    render(<ARTSetup />);
    expect(screen.getByText("Agile Release Trains (1)")).toBeInTheDocument();
  });
});
