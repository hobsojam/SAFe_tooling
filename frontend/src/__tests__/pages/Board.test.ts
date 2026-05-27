import { describe, expect, it } from "vitest";
import { buildBoard, buildDepLabel, crossTeamOnly } from "../../pages/Board";
import type { Dependency, Feature } from "../../types";

function makeFeature(overrides: Partial<Feature> = {}): Feature {
  return {
    id: "f1",
    name: "Feature 1",
    description: "",
    pi_id: "pi1",
    team_id: null,
    iteration_id: null,
    status: "backlog",
    acceptance_criteria: "",
    nfr: "",
    user_business_value: 5,
    time_criticality: 5,
    risk_reduction_opportunity_enablement: 5,
    job_size: 5,
    cost_of_delay: 15,
    wsjf_score: 3,
    ...overrides,
  };
}

describe("buildBoard", () => {
  it("returns empty grid for empty feature list", () => {
    expect(buildBoard([])).toEqual({});
  });

  it("skips features with no team_id", () => {
    const f = makeFeature({ id: "f1", team_id: null });
    expect(buildBoard([f])).toEqual({});
  });

  it("places feature with team and iteration into grid", () => {
    const f = makeFeature({ id: "f1", team_id: "t1", iteration_id: "i1" });
    const grid = buildBoard([f]);
    expect(grid["t1"]["i1"]).toHaveLength(1);
    expect(grid["t1"]["i1"][0].id).toBe("f1");
  });

  it('places feature with no iteration under "unplanned"', () => {
    const f = makeFeature({ id: "f1", team_id: "t1", iteration_id: null });
    const grid = buildBoard([f]);
    expect(grid["t1"]["unplanned"][0].id).toBe("f1");
  });

  it("groups multiple features under same team and iteration", () => {
    const f1 = makeFeature({ id: "f1", team_id: "t1", iteration_id: "i1" });
    const f2 = makeFeature({ id: "f2", team_id: "t1", iteration_id: "i1" });
    const grid = buildBoard([f1, f2]);
    expect(grid["t1"]["i1"]).toHaveLength(2);
  });

  it("separates features by team", () => {
    const f1 = makeFeature({ id: "f1", team_id: "t1", iteration_id: "i1" });
    const f2 = makeFeature({ id: "f2", team_id: "t2", iteration_id: "i1" });
    const grid = buildBoard([f1, f2]);
    expect(grid["t1"]["i1"]).toHaveLength(1);
    expect(grid["t2"]["i1"]).toHaveLength(1);
  });
});

function makeDep(overrides: Partial<Dependency> = {}): Dependency {
  return {
    id: "d1",
    description: "dep",
    pi_id: "pi1",
    from_feature_id: "f1",
    to_feature_id: "f2",
    status: "identified",
    owner: null,
    resolution_notes: "",
    raised_date: "2026-01-01",
    needed_by_date: null,
    ...overrides,
  };
}

describe("crossTeamOnly", () => {
  it("returns empty for no deps", () => {
    expect(crossTeamOnly([], [])).toEqual([]);
  });

  it("filters out same-team dependencies", () => {
    const f1 = makeFeature({ id: "f1", team_id: "t1" });
    const f2 = makeFeature({ id: "f2", team_id: "t1" });
    const dep = makeDep({ from_feature_id: "f1", to_feature_id: "f2" });
    expect(crossTeamOnly([dep], [f1, f2])).toHaveLength(0);
  });

  it("keeps cross-team dependencies", () => {
    const f1 = makeFeature({ id: "f1", team_id: "t1" });
    const f2 = makeFeature({ id: "f2", team_id: "t2" });
    const dep = makeDep({ from_feature_id: "f1", to_feature_id: "f2" });
    expect(crossTeamOnly([dep], [f1, f2])).toHaveLength(1);
  });

  it("excludes deps where a feature has no team", () => {
    const f1 = makeFeature({ id: "f1", team_id: null });
    const f2 = makeFeature({ id: "f2", team_id: "t2" });
    const dep = makeDep({ from_feature_id: "f1", to_feature_id: "f2" });
    expect(crossTeamOnly([dep], [f1, f2])).toHaveLength(0);
  });

  it("excludes deps where either feature is missing from the list", () => {
    const f1 = makeFeature({ id: "f1", team_id: "t1" });
    const dep = makeDep({ from_feature_id: "f1", to_feature_id: "f-missing" });
    expect(crossTeamOnly([dep], [f1])).toHaveLength(0);
  });
});

describe("buildDepLabel", () => {
  it("returns fallback when feature is undefined", () => {
    expect(buildDepLabel(undefined, {}, "feature-id")).toBe("feature-id");
  });

  it("returns feature name only when team_id is null", () => {
    const f = makeFeature({ id: "f1", name: "Auth Service", team_id: null });
    expect(buildDepLabel(f, {}, "fallback")).toBe("Auth Service");
  });

  it("returns name with team suffix when team is found in map", () => {
    const f = makeFeature({ id: "f1", name: "Auth Service", team_id: "t1" });
    expect(buildDepLabel(f, { t1: { name: "Alpha" } }, "fallback")).toBe("Auth Service (Alpha)");
  });

  it("returns name only when team_id is set but team not in map", () => {
    const f = makeFeature({ id: "f1", name: "Auth Service", team_id: "t1" });
    expect(buildDepLabel(f, {}, "fallback")).toBe("Auth Service");
  });
});
