import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BackendUnavailable } from "../../components/BackendUnavailable";

describe("BackendUnavailable", () => {
  it("renders the starting-up heading", () => {
    render(<BackendUnavailable onRetry={() => {}} />);
    expect(screen.getByRole("heading", { name: /backend is starting up/i })).toBeInTheDocument();
  });

  it("renders explanatory description text", () => {
    render(<BackendUnavailable onRetry={() => {}} />);
    expect(screen.getByText(/waking up/i)).toBeInTheDocument();
  });

  it("renders exactly one interactive element — the retry button", () => {
    render(<BackendUnavailable onRetry={() => {}} />);
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("retry button is a real button element (keyboard accessible)", () => {
    render(<BackendUnavailable onRetry={() => {}} />);
    const btn = screen.getByRole("button", { name: /retry/i });
    expect(btn.tagName).toBe("BUTTON");
  });

  it("calls onRetry when the button is clicked", async () => {
    const onRetry = vi.fn();
    render(<BackendUnavailable onRetry={onRetry} />);
    await userEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("calls onRetry when Enter is pressed on the focused button", async () => {
    const onRetry = vi.fn();
    render(<BackendUnavailable onRetry={onRetry} />);
    screen.getByRole("button", { name: /retry/i }).focus();
    await userEvent.keyboard("{Enter}");
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("does not call onRetry on initial render", () => {
    const onRetry = vi.fn();
    render(<BackendUnavailable onRetry={onRetry} />);
    expect(onRetry).not.toHaveBeenCalled();
  });
});
