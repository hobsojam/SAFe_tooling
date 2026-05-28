import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Spinner } from "../../components/Spinner";

describe("Spinner", () => {
  it("renders a status element", () => {
    render(<Spinner />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it('has an accessible "Loading" label', () => {
    render(<Spinner />);
    expect(screen.getByLabelText("Loading")).toBeInTheDocument();
  });
});
