/**
 * Additional Risks page tests targeting the delete flow and update mutation,
 * which are the major untested paths in the existing component test file.
 *
 * Note: The Risks component renders BOTH a mobile card list (block md:hidden)
 * and a desktop table (hidden md:block). In jsdom there are no responsive
 * breakpoints, so both DOM subtrees are present. Use getAllByRole when a
 * button appears in both layouts and take the first result.
 */

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

import { Risks } from "../../pages/Risks";
import { makePI, makeRisk, makeTeam } from "../factories";

const mockPI = makePI({ id: "pi-1", name: "PI 2026.1", status: "active" });
const mockTeams = [makeTeam({ id: "team-1", name: "Alpha" })];
const baseRisk = makeRisk({ id: "risk-1", pi_id: "pi-1", description: "DB migration risk" });

type MutSetup = {
  mutate: ReturnType<typeof vi.fn>;
  isPending: boolean;
};

/** Wire all three hooks with sensible defaults; allow overriding per-mutation isPending. */
function setupMocks({
  risks = [baseRisk],
  create = { mutate: vi.fn(), isPending: false } as MutSetup,
  update = { mutate: vi.fn(), isPending: false } as MutSetup,
  del = { mutate: vi.fn(), isPending: false } as MutSetup,
} = {}) {
  vi.mocked(useQueryClient).mockReturnValue({ invalidateQueries: vi.fn() } as any);

  // useMutation is called three times in order: createMut, updateMut, deleteMut
  // We track calls with a counter so we can serve the right stub regardless of render count.
  let callIdx = 0;
  const stubs = [create, update, del];
  vi.mocked(useMutation).mockImplementation(() => {
    const stub = stubs[callIdx] ?? stubs[stubs.length - 1];
    callIdx++;
    return stub as any;
  });

  vi.mocked(useQuery).mockImplementation(({ queryKey }: Parameters<typeof useQuery>[0]) => {
    const key = (queryKey as string[])[0];
    if (key === "pi") return { data: mockPI, isLoading: false } as any;
    if (key === "risks") return { data: risks, isLoading: false } as any;
    if (key === "teams") return { data: mockTeams, isLoading: false } as any;
    return { data: undefined, isLoading: false } as any;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Delete flow
// ---------------------------------------------------------------------------

describe("Risks page — delete flow", () => {
  it("shows delete confirmation when the Delete button is clicked", async () => {
    setupMocks();
    const user = userEvent.setup();
    render(<Risks />);
    const deleteButtons = screen.getAllByRole("button", { name: "Delete" });
    await user.click(deleteButtons[0]);
    // Both mobile and desktop render confirmation rows — use getAllByRole
    const confirmButtons = screen.getAllByRole("button", { name: "Yes, delete" });
    expect(confirmButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('calls deleteMut.mutate when "Yes, delete" is confirmed', async () => {
    const deleteMutate = vi.fn();
    setupMocks({ del: { mutate: deleteMutate, isPending: false } });
    const user = userEvent.setup();
    render(<Risks />);
    const deleteButtons = screen.getAllByRole("button", { name: "Delete" });
    await user.click(deleteButtons[0]);
    const confirmButtons = screen.getAllByRole("button", { name: "Yes, delete" });
    await user.click(confirmButtons[0]);
    expect(deleteMutate).toHaveBeenCalled();
  });

  it("hides the delete confirmation when Cancel is clicked", async () => {
    setupMocks();
    const user = userEvent.setup();
    render(<Risks />);
    const deleteButtons = screen.getAllByRole("button", { name: "Delete" });
    await user.click(deleteButtons[0]);
    const cancelButtons = screen.getAllByRole("button", { name: "Cancel" });
    await user.click(cancelButtons[0]);
    expect(screen.queryByRole("button", { name: "Yes, delete" })).not.toBeInTheDocument();
  });

  it('shows "Deleting…" on the confirm button while delete mutation is pending', async () => {
    setupMocks({ del: { mutate: vi.fn(), isPending: true } });
    const user = userEvent.setup();
    render(<Risks />);
    const deleteButtons = screen.getAllByRole("button", { name: "Delete" });
    await user.click(deleteButtons[0]);
    // Both mobile and desktop confirmation rows show "Deleting…"
    const deletingButtons = screen.getAllByRole("button", { name: "Deleting…" });
    expect(deletingButtons.length).toBeGreaterThanOrEqual(1);
  });

  it("shows delete error message in the confirmation row after mutation error", async () => {
    let capturedOnError: ((e: Error) => void) | undefined;
    vi.mocked(useMutation)
      .mockImplementationOnce(() => ({ mutate: vi.fn(), isPending: false }) as any) // createMut
      .mockImplementationOnce(() => ({ mutate: vi.fn(), isPending: false }) as any) // updateMut
      .mockImplementationOnce((opts: any) => {
        capturedOnError = opts?.onError;
        return { mutate: vi.fn(), isPending: false } as any;
      }); // deleteMut

    vi.mocked(useQueryClient).mockReturnValue({ invalidateQueries: vi.fn() } as any);
    vi.mocked(useQuery).mockImplementation(({ queryKey }: any) => {
      const key = queryKey[0];
      if (key === "pi") return { data: mockPI, isLoading: false } as any;
      if (key === "risks") return { data: [baseRisk], isLoading: false } as any;
      if (key === "teams") return { data: mockTeams, isLoading: false } as any;
      return { data: undefined, isLoading: false } as any;
    });

    const user = userEvent.setup();
    render(<Risks />);
    const deleteButtons = screen.getAllByRole("button", { name: "Delete" });
    await user.click(deleteButtons[0]);

    act(() => {
      capturedOnError?.(new Error("Delete failed"));
    });

    const errorMessages = screen.getAllByText("Delete failed");
    expect(errorMessages.length).toBeGreaterThanOrEqual(1);
  });

  it('shows the truncated description (60 chars + "…") in the confirmation', async () => {
    const longRisk = makeRisk({
      id: "risk-long",
      pi_id: "pi-1",
      description: "A".repeat(70),
    });
    setupMocks({ risks: [longRisk] });
    const user = userEvent.setup();
    render(<Risks />);
    const deleteButtons = screen.getAllByRole("button", { name: "Delete" });
    await user.click(deleteButtons[0]);
    const truncated = screen.getAllByText(/A{60}…/);
    expect(truncated.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Update mutation
// ---------------------------------------------------------------------------

describe("Risks page — update mutation", () => {
  it("edit modal pre-fills form with the existing risk description", async () => {
    const risk = makeRisk({
      id: "risk-1",
      pi_id: "pi-1",
      description: "Service outage risk",
      roam_status: "owned",
      owner: "Alice",
      mitigation_notes: "Mitigating with redundancy",
      team_id: "team-1",
    });
    setupMocks({ risks: [risk] });
    const user = userEvent.setup();
    render(<Risks />);
    const editButtons = screen.getAllByRole("button", { name: "Edit" });
    await user.click(editButtons[0]);
    const textarea = screen.getByRole("textbox", { name: /Description/i }) as HTMLTextAreaElement;
    expect(textarea.value).toBe("Service outage risk");
  });

  it("edit modal pre-fills the owner field", async () => {
    const risk = makeRisk({
      id: "risk-1",
      pi_id: "pi-1",
      description: "Risk X",
      owner: "Alice",
      mitigation_notes: "",
    });
    setupMocks({ risks: [risk] });
    const user = userEvent.setup();
    render(<Risks />);
    const editButtons = screen.getAllByRole("button", { name: "Edit" });
    await user.click(editButtons[0]);
    const ownerInput = screen.getByRole("textbox", { name: /Owner/i }) as HTMLInputElement;
    expect(ownerInput.value).toBe("Alice");
  });

  it("shows error in update modal when update mutation calls onError", async () => {
    let capturedOnError: ((e: Error) => void) | undefined;
    vi.mocked(useMutation)
      .mockImplementationOnce(() => ({ mutate: vi.fn(), isPending: false }) as any) // createMut
      .mockImplementationOnce((opts: any) => {
        capturedOnError = opts?.onError;
        return { mutate: vi.fn(), isPending: false } as any;
      }) // updateMut
      .mockImplementationOnce(() => ({ mutate: vi.fn(), isPending: false }) as any); // deleteMut

    vi.mocked(useQueryClient).mockReturnValue({ invalidateQueries: vi.fn() } as any);
    vi.mocked(useQuery).mockImplementation(({ queryKey }: any) => {
      const key = queryKey[0];
      if (key === "pi") return { data: mockPI, isLoading: false } as any;
      if (key === "risks") return { data: [baseRisk], isLoading: false } as any;
      if (key === "teams") return { data: mockTeams, isLoading: false } as any;
      return { data: undefined, isLoading: false } as any;
    });

    const user = userEvent.setup();
    render(<Risks />);
    const editButtons = screen.getAllByRole("button", { name: "Edit" });
    await user.click(editButtons[0]);

    act(() => {
      capturedOnError?.(new Error("Update failed"));
    });

    expect(screen.getByText("Update failed")).toBeInTheDocument();
  });

  it("shows validation error when description is empty on submit", async () => {
    setupMocks({ risks: [] });
    const user = userEvent.setup();
    render(<Risks />);
    await user.click(screen.getByRole("button", { name: "+ New Risk" }));
    await user.click(screen.getByRole("button", { name: "Add Risk" }));
    expect(screen.getByText("Description is required.")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Risk count display
// ---------------------------------------------------------------------------

describe("Risks page — risk count display", () => {
  it('shows singular "risk" when there is exactly 1 roamed risk', () => {
    // Use a roamed risk so no "unroamed" link appends extra text to the same <p>
    const roamedRisk = makeRisk({ id: "r-r", pi_id: "pi-1", roam_status: "resolved" });
    setupMocks({ risks: [roamedRisk] });
    render(<Risks />);
    expect(screen.getByText(/^1 risk$/)).toBeInTheDocument();
  });

  it('shows plural "risks" when there are multiple roamed risks', () => {
    const r1 = makeRisk({ id: "risk-x1", pi_id: "pi-1", roam_status: "resolved" });
    const r2 = makeRisk({ id: "risk-x2", pi_id: "pi-1", roam_status: "resolved" });
    setupMocks({ risks: [r1, r2] });
    render(<Risks />);
    expect(screen.getByText(/^2 risks$/)).toBeInTheDocument();
  });

  it('shows "0 risks" when there are no risks (table is hidden, empty state shown)', () => {
    // When risks.length === 0, EmptyState is shown but the count <p> still renders
    setupMocks({ risks: [] });
    render(<Risks />);
    expect(screen.getByText(/^0 risks$/)).toBeInTheDocument();
  });

  it("does not show unroamed text when all risks have been ROAMed", () => {
    const roamedRisk = makeRisk({ id: "r-r2", pi_id: "pi-1", roam_status: "resolved" });
    setupMocks({ risks: [roamedRisk] });
    render(<Risks />);
    expect(screen.queryByText(/unroamed/)).not.toBeInTheDocument();
  });

  it("renders an unroamed count link when risks have unroamed status", () => {
    const unroamedRisk = makeRisk({ id: "r-u", pi_id: "pi-1", roam_status: "unroamed" });
    setupMocks({ risks: [unroamedRisk] });
    render(<Risks />);
    // The Link component renders its children as a fragment — the text "1 unroamed"
    // is in the DOM as part of the paragraph's textContent
    expect(screen.getByText(/1 unroamed/i)).toBeInTheDocument();
  });
});
