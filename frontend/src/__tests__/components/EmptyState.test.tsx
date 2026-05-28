import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "../../components/EmptyState";

describe("EmptyState", () => {
  it("renders the message", () => {
    render(<EmptyState message="No items found" />);
    expect(screen.getByText("No items found")).toBeInTheDocument();
  });

  it('has role="status" for assistive technology', () => {
    render(<EmptyState message="Nothing here" />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("message is contained within the status element", () => {
    render(<EmptyState message="Empty" />);
    expect(screen.getByRole("status")).toHaveTextContent("Empty");
  });
});
