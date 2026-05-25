export type PIStatus = 'planning' | 'active' | 'closed';
export type ImprovementActionStatus = 'open' | 'in_progress' | 'done';
export type FeatureStatus = 'funnel' | 'analyzing' | 'backlog' | 'implementing' | 'done';
export type ROAMStatus = 'unroamed' | 'owned' | 'accepted' | 'mitigated' | 'resolved';
export type DependencyStatus = 'identified' | 'acknowledged' | 'in_progress' | 'resolved';

export interface ART {
  id: string;
  name: string;
  team_ids: string[];
}

export interface ARTCreate {
  name: string;
}

export interface ARTUpdate {
  name?: string;
}

export interface PI {
  id: string;
  name: string;
  art_id: string;
  start_date: string;
  end_date: string;
  iteration_ids: string[];
  status: PIStatus;
}

export type TeamTopologyType = 'stream_aligned' | 'enabling' | 'complicated_subsystem' | 'platform';

export interface Team {
  id: string;
  name: string;
  member_count: number;
  art_id: string | null;
  topology_type: TeamTopologyType | null;
}

export interface Iteration {
  id: string;
  pi_id: string;
  number: number;
  name: string;
  start_date: string;
  end_date: string;
  is_ip: boolean;
}

export interface Feature {
  id: string;
  name: string;
  description: string;
  pi_id: string | null;
  team_id: string | null;
  iteration_id: string | null;
  status: FeatureStatus;
  acceptance_criteria: string;
  nfr: string;
  user_business_value: number;
  time_criticality: number;
  risk_reduction_opportunity_enablement: number;
  job_size: number;
  cost_of_delay: number;
  wsjf_score: number;
}

export type StoryStatus = 'not_started' | 'in_progress' | 'done' | 'accepted';

export interface Story {
  id: string;
  name: string;
  feature_id: string;
  team_id: string;
  iteration_id: string | null;
  points: number;
  status: StoryStatus;
}

export interface StoryCreate {
  name: string;
  feature_id: string;
  team_id: string;
  iteration_id?: string | null;
  points: number;
  status?: StoryStatus;
}

export interface StoryUpdate {
  name?: string;
  feature_id?: string;
  iteration_id?: string | null;
  points?: number;
  status?: StoryStatus;
}

export interface PIObjective {
  id: string;
  description: string;
  team_id: string;
  pi_id: string;
  planned_business_value: number;
  actual_business_value: number | null;
  is_stretch: boolean;
  feature_ids: string[];
  is_committed: boolean;
}

export interface PIObjectiveCreate {
  description: string;
  team_id: string;
  pi_id: string;
  planned_business_value: number;
  actual_business_value?: number | null;
  is_stretch?: boolean;
}

export interface PIObjectiveUpdate {
  description?: string;
  planned_business_value?: number;
  actual_business_value?: number | null;
  is_stretch?: boolean;
}

export interface CapacityPlan {
  id: string;
  team_id: string;
  iteration_id: string;
  pi_id: string;
  team_size: number;
  iteration_days: number;
  pto_days: number;
  overhead_pct: number;
  available_capacity: number;
}

export interface VelocityEntry {
  team_id: string;
  iteration_id: string;
  pi_id: string;
  completed_points: number;
  available_capacity: number | null;
}

export interface CapacityPlanCreate {
  team_id: string;
  iteration_id: string;
  pi_id: string;
  team_size: number;
  iteration_days?: number;
  pto_days?: number;
  overhead_pct?: number;
}

export interface CapacityPlanUpdate {
  team_size?: number;
  iteration_days?: number;
  pto_days?: number;
  overhead_pct?: number;
}

export interface CapacityPlanSeedResult {
  created: number;
  skipped: number;
}

export interface Risk {
  id: string;
  description: string;
  pi_id: string;
  team_id: string | null;
  feature_id: string | null;
  roam_status: ROAMStatus;
  owner: string | null;
  mitigation_notes: string;
  raised_date: string;
}

export interface Dependency {
  id: string;
  description: string;
  pi_id: string;
  from_feature_id: string;
  to_feature_id: string;
  status: DependencyStatus;
  owner: string | null;
  resolution_notes: string;
  raised_date: string;
  needed_by_date: string | null;
}

export interface ImprovementAction {
  id: string;
  pi_id: string;
  problem_statement: string;
  root_cause: string;
  action: string;
  owner: string;
  status: ImprovementActionStatus;
}

export interface ImprovementActionCreate {
  pi_id: string;
  problem_statement: string;
  root_cause?: string;
  action: string;
  owner?: string;
  status?: ImprovementActionStatus;
}

export interface ImprovementActionUpdate {
  problem_statement?: string;
  root_cause?: string;
  action?: string;
  owner?: string;
  status?: ImprovementActionStatus;
}

export interface PICreate {
  name: string;
  art_id: string;
  start_date: string;
  end_date: string;
}

export interface PIUpdate {
  name?: string;
  start_date?: string;
  end_date?: string;
}

export interface IterationCreate {
  pi_id: string;
  number: number;
  name?: string;
  start_date: string;
  end_date: string;
  is_ip?: boolean;
}

export interface TeamCreate {
  name: string;
  member_count: number;
  art_id: string;
  topology_type?: TeamTopologyType | null;
}

export interface TeamUpdate {
  name?: string;
  member_count?: number;
  art_id?: string | null;
  topology_type?: TeamTopologyType | null;
}

export interface RiskCreate {
  description: string;
  pi_id: string;
  team_id?: string | null;
  roam_status?: ROAMStatus;
  owner?: string | null;
  mitigation_notes?: string;
}

export interface RiskUpdate {
  description?: string;
  team_id?: string | null;
  roam_status?: ROAMStatus;
  owner?: string | null;
  mitigation_notes?: string;
}

export interface DependencyCreate {
  description: string;
  pi_id: string;
  from_feature_id: string;
  to_feature_id: string;
  needed_by_date?: string | null;
  owner?: string | null;
}

export interface DependencyUpdate {
  description?: string;
  status?: DependencyStatus;
  owner?: string | null;
  needed_by_date?: string | null;
  resolution_notes?: string;
}

export interface FeatureCreate {
  name: string;
  description?: string;
  pi_id?: string | null;
  team_id?: string | null;
  iteration_id?: string | null;
  status?: FeatureStatus;
  acceptance_criteria?: string;
  nfr?: string;
  user_business_value: number;
  time_criticality: number;
  risk_reduction_opportunity_enablement: number;
  job_size: number;
}

export interface FeatureUpdate {
  name?: string;
  description?: string;
  pi_id?: string | null;
  team_id?: string | null;
  iteration_id?: string | null;
  status?: FeatureStatus;
  acceptance_criteria?: string;
  nfr?: string;
  user_business_value?: number;
  time_criticality?: number;
  risk_reduction_opportunity_enablement?: number;
  job_size?: number;
}
