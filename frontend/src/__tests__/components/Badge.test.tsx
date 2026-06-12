import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  Badge,
  DepBadge,
  FeatureStatusBadge,
  PIStatusBadge,
  ROAMBadge,
  StoryStatusBadge,
  TOPOLOGY_LABELS,
  TopologyBadge,
} from "../../components/Badge";

describe("Badge", () => {
  it("renders the label text", () => {
    render(<Badge label="hello" variant="green" />);
    expect(screen.getByText("hello")).toBeInTheDocument();
  });

  it("applies variant colour classes", () => {
    render(<Badge label="x" variant="red" />);
    expect(screen.getByText("x")).toHaveClass("bg-red-100", "text-red-800");
  });
});

describe("ROAMBadge", () => {
  it.each([
    ["unroamed", "unroamed", "bg-red-100"],
    ["owned", "owned", "bg-yellow-100"],
    ["accepted", "accepted", "bg-amber-100"],
    ["mitigated", "mitigated", "bg-cyan-100"],
    ["resolved", "resolved", "bg-green-100"],
  ])('status "%s" renders label "%s" with class "%s"', (status, label, cls) => {
    render(<ROAMBadge status={status} />);
    expect(screen.getByText(label)).toHaveClass(cls);
  });

  it("falls back to gray for an unknown status", () => {
    render(<ROAMBadge status="unknown" />);
    expect(screen.getByText("unknown")).toHaveClass("bg-gray-100");
  });
});

describe("DepBadge", () => {
  it.each([
    ["identified", "identified", "bg-red-100"],
    ["acknowledged", "acknowledged", "bg-yellow-100"],
    ["in_progress", "in progress", "bg-cyan-100"],
    ["resolved", "resolved", "bg-green-100"],
  ])('status "%s" renders label "%s" with class "%s"', (status, label, cls) => {
    render(<DepBadge status={status} />);
    expect(screen.getByText(label)).toHaveClass(cls);
  });

  it("falls back to gray for an unknown status", () => {
    render(<DepBadge status="unknown" />);
    expect(screen.getByText("unknown")).toHaveClass("bg-gray-100");
  });
});

describe("PIStatusBadge", () => {
  it.each([
    ["planning", "bg-blue-100"],
    ["active", "bg-green-100"],
    ["closed", "bg-gray-100"],
  ])('status "%s" renders with class "%s"', (status, cls) => {
    render(<PIStatusBadge status={status} />);
    expect(screen.getByText(status)).toHaveClass(cls);
  });

  it("falls back to gray for an unknown status", () => {
    render(<PIStatusBadge status="unknown" />);
    expect(screen.getByText("unknown")).toHaveClass("bg-gray-100");
  });
});

describe("FeatureStatusBadge", () => {
  it.each([
    ["funnel", "bg-purple-100"],
    ["analyzing", "bg-blue-100"],
    ["backlog", "bg-gray-100"],
    ["implementing", "bg-amber-100"],
    ["done", "bg-green-100"],
  ])('status "%s" renders with class "%s"', (status, cls) => {
    render(<FeatureStatusBadge status={status} />);
    expect(screen.getByText(status)).toHaveClass(cls);
  });

  it("falls back to gray for an unknown status", () => {
    render(<FeatureStatusBadge status="unknown" />);
    expect(screen.getByText("unknown")).toHaveClass("bg-gray-100");
  });
});

describe("StoryStatusBadge", () => {
  it.each([
    ["not_started", "not started", "bg-gray-100"],
    ["in_progress", "in progress", "bg-blue-100"],
    ["done", "done", "bg-cyan-100"],
    ["accepted", "accepted", "bg-green-100"],
  ])('status "%s" renders label "%s" with class "%s"', (status, label, cls) => {
    render(<StoryStatusBadge status={status} />);
    expect(screen.getByText(label)).toHaveClass(cls);
  });

  it("replaces underscores with spaces in the label", () => {
    render(<StoryStatusBadge status="not_started" />);
    expect(screen.getByText("not started")).toBeInTheDocument();
  });

  it("falls back to gray for an unknown status", () => {
    render(<StoryStatusBadge status="unknown" />);
    expect(screen.getByText("unknown")).toHaveClass("bg-gray-100");
  });
});

describe("TopologyBadge", () => {
  it("renders nothing when type is null", () => {
    const { container } = render(<TopologyBadge type={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it.each([
    ["stream_aligned", "bg-blue-100"],
    ["enabling", "bg-green-100"],
    ["complicated_subsystem", "bg-purple-100"],
    ["platform", "bg-amber-100"],
  ])('type "%s" renders with class "%s"', (type, cls) => {
    render(<TopologyBadge type={type} />);
    expect(screen.getByText(TOPOLOGY_LABELS[type])).toHaveClass(cls);
  });

  it("uses TOPOLOGY_LABELS display text instead of raw key", () => {
    render(<TopologyBadge type="stream_aligned" />);
    expect(screen.getByText("Stream-aligned")).toBeInTheDocument();
    expect(screen.queryByText("stream_aligned")).not.toBeInTheDocument();
  });

  it("falls back to gray and raw type for an unknown topology", () => {
    render(<TopologyBadge type="custom_type" />);
    expect(screen.getByText("custom_type")).toHaveClass("bg-gray-100");
  });
});
