import type {
  ART,
  CapacityPlan,
  Dependency,
  Feature,
  ImprovementAction,
  Iteration,
  PI,
  PIObjective,
  Risk,
  Story,
  Team,
} from "../types";

let _counter = 0;
const uid = (prefix: string) => `${prefix}-${++_counter}`;

export const makeART = (overrides: Partial<ART> = {}): ART => ({
  id: uid("art"),
  name: "Platform ART",
  team_ids: [],
  ...overrides,
});

export const makePI = (overrides: Partial<PI> = {}): PI => ({
  id: uid("pi"),
  name: "PI 2026.1",
  art_id: "art-1",
  start_date: "2026-01-05",
  end_date: "2026-03-27",
  iteration_ids: [],
  status: "planning",
  ...overrides,
});

export const makeTeam = (overrides: Partial<Team> = {}): Team => ({
  id: uid("team"),
  name: "Alpha",
  member_count: 5,
  art_id: "art-1",
  topology_type: null,
  ...overrides,
});

export const makeIteration = (overrides: Partial<Iteration> = {}): Iteration => ({
  id: uid("iter"),
  pi_id: "pi-1",
  number: 1,
  name: "Iteration 1",
  start_date: "2026-01-05",
  end_date: "2026-01-16",
  is_ip: false,
  ...overrides,
});

export const makeFeature = (overrides: Partial<Feature> = {}): Feature => ({
  id: uid("feat"),
  name: "Auth Service",
  description: "",
  pi_id: "pi-1",
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
});

export const makeStory = (overrides: Partial<Story> = {}): Story => ({
  id: uid("story"),
  name: "Login flow",
  feature_id: "feat-1",
  team_id: "team-1",
  iteration_id: null,
  points: 3,
  status: "not_started",
  ...overrides,
});

export const makePIObjective = (overrides: Partial<PIObjective> = {}): PIObjective => ({
  id: uid("obj"),
  description: "Deliver feature X",
  team_id: "team-1",
  pi_id: "pi-1",
  planned_business_value: 8,
  actual_business_value: null,
  is_stretch: false,
  feature_ids: [],
  is_committed: true,
  ...overrides,
});

export const makeRisk = (overrides: Partial<Risk> = {}): Risk => ({
  id: uid("risk"),
  description: "Risk description",
  pi_id: "pi-1",
  team_id: null,
  feature_id: null,
  roam_status: "unroamed",
  owner: null,
  mitigation_notes: "",
  raised_date: "2026-01-01",
  ...overrides,
});

export const makeDependency = (overrides: Partial<Dependency> = {}): Dependency => ({
  id: uid("dep"),
  description: "Depends on API gateway",
  pi_id: "pi-1",
  from_feature_id: "feat-1",
  to_feature_id: "feat-2",
  status: "identified",
  owner: null,
  resolution_notes: "",
  raised_date: "2026-01-01",
  needed_by_date: null,
  ...overrides,
});

export const makeImprovementAction = (
  overrides: Partial<ImprovementAction> = {}
): ImprovementAction => ({
  id: uid("action"),
  pi_id: "pi-1",
  problem_statement: "Deploys take too long",
  root_cause: "",
  action: "Automate deployment pipeline",
  owner: "",
  status: "open",
  ...overrides,
});

export const makeCapacityPlan = (overrides: Partial<CapacityPlan> = {}): CapacityPlan => ({
  id: uid("plan"),
  team_id: "team-1",
  iteration_id: "iter-1",
  pi_id: "pi-1",
  team_size: 6,
  iteration_days: 10,
  pto_days: 0,
  overhead_pct: 0.2,
  available_capacity: 48,
  ...overrides,
});
