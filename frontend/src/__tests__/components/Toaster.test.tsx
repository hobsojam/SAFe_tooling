import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ToastProvider, useToast } from "../../components/Toaster";

// Helper component that exposes the toast function via a button
function ToastTrigger({
  message,
  variant,
}: Readonly<{
  message: string;
  variant?: "success" | "error" | "info";
}>) {
  const toast = useToast();
  return <button onClick={() => toast(message, variant)}>Trigger</button>;
}

function renderWithProvider(message: string, variant?: "success" | "error" | "info") {
  return render(
    <ToastProvider>
      <ToastTrigger message={message} variant={variant} />
    </ToastProvider>
  );
}

/** Returns the visible toast container div (not the sr-only live regions). */
function getToastContainer() {
  return document.querySelector<HTMLElement>(".fixed.bottom-4");
}

describe("Toaster", () => {
  it("shows a toast message after calling toast()", async () => {
    const user = userEvent.setup();
    renderWithProvider("hello");
    await user.click(screen.getByRole("button", { name: "Trigger" }));
    const container = getToastContainer();
    expect(container).not.toBeNull();
    expect(within(container!).getByText("hello")).toBeInTheDocument();
  });

  it("applies the red style class for the error variant", async () => {
    const user = userEvent.setup();
    renderWithProvider("something went wrong", "error");
    await user.click(screen.getByRole("button", { name: "Trigger" }));
    const container = getToastContainer();
    expect(container).not.toBeNull();
    const toastEl = within(container!).getByText("something went wrong").closest("div");
    expect(toastEl).toHaveClass("bg-red-50");
  });

  it("applies the green style class for the success variant", async () => {
    const user = userEvent.setup();
    renderWithProvider("saved!", "success");
    await user.click(screen.getByRole("button", { name: "Trigger" }));
    const container = getToastContainer();
    expect(container).not.toBeNull();
    const toastEl = within(container!).getByText("saved!").closest("div");
    expect(toastEl).toHaveClass("bg-green-50");
  });

  it("removes the toast when the dismiss button is clicked", async () => {
    const user = userEvent.setup();
    renderWithProvider("will disappear");
    await user.click(screen.getByRole("button", { name: "Trigger" }));
    const container = getToastContainer();
    expect(within(container!).getByText("will disappear")).toBeInTheDocument();
    await user.click(within(container!).getByRole("button", { name: /Dismiss: will disappear/i }));
    // After dismiss the toast container is gone entirely (toasts.length becomes 0)
    expect(document.querySelector(".fixed.bottom-4")).toBeNull();
  });

  it("puts the message into the polite live region for success", async () => {
    const user = userEvent.setup();
    renderWithProvider("success message", "success");
    await user.click(screen.getByRole("button", { name: "Trigger" }));
    // announce() sets textContent inside requestAnimationFrame; waitFor handles the flush
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("success message");
    });
  });

  it("puts the message into the assertive live region for error", async () => {
    const user = userEvent.setup();
    renderWithProvider("error message", "error");
    await user.click(screen.getByRole("button", { name: "Trigger" }));
    // role="alert" is the assertive live region used for error toasts.
    // requestAnimationFrame is used to update textContent; waitFor handles the
    // async flush that jsdom may not run synchronously for assertive regions.
    await waitFor(() => {
      const alertRegion = screen.getByRole("alert");
      expect(alertRegion).toHaveTextContent("error message");
    });
  });
});
