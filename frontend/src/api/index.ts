import type {
  ART,
  ARTCreate,
  ARTUpdate,
  CapacityPlan,
  CapacityPlanCreate,
  Dependency,
  DependencyCreate,
  DependencyUpdate,
  Feature,
  FeatureCreate,
  FeatureUpdate,
  Iteration,
  IterationCreate,
  PI,
  PICreate,
  PIObjective,
  PIObjectiveCreate,
  PIObjectiveUpdate,
  PIUpdate,
  Risk,
  RiskCreate,
  RiskUpdate,
  Story,
  StoryCreate,
  StoryUpdate,
  Team,
  TeamCreate,
  TeamUpdate,
  VelocityEntry,
} from '../types';

const BASE = '/api';

async function extractErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { detail?: unknown };
    if (typeof body.detail === 'string') return body.detail;
    if (Array.isArray(body.detail)) {
      return (body.detail as { loc?: string[]; msg: string }[])
        .map((e) => {
          const field = e.loc?.filter((p) => p !== 'body').join('.') ?? '';
          return field ? `${field}: ${e.msg}` : e.msg;
        })
        .join('; ');
    }
  } catch {
    // body wasn't JSON — fall through to status text
  }
  return `${res.status}: ${res.statusText}`;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(await extractErrorMessage(res));
  return res.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await extractErrorMessage(res));
  return res.json();
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await extractErrorMessage(res));
  return res.json();
}

async function del(path: string): Promise<void> {
  const res = await fetch(`${BASE}${path}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await extractErrorMessage(res));
}

export const api = {
  listPIs: () => get<PI[]>('/pi'),
  getPI: (id: string) => get<PI>(`/pi/${id}`),
  createPI: (body: PICreate) => post<PI>('/pi', body),
  updatePI: (id: string, body: PIUpdate) => patch<PI>(`/pi/${id}`, body),
  activatePI: (id: string) => post<PI>(`/pi/${id}/activate`, {}),
  closePI: (id: string) => post<PI>(`/pi/${id}/close`, {}),
  deletePI: (id: string) => del(`/pi/${id}`),

  listARTs: () => get<ART[]>('/art'),
  createART: (body: ARTCreate) => post<ART>('/art', body),
  updateART: (id: string, body: ARTUpdate) => patch<ART>(`/art/${id}`, body),
  deleteART: (id: string) => del(`/art/${id}`),

  listTeams: () => get<Team[]>('/team'),
  listTeamsByArt: (artId: string) => get<Team[]>(`/team?art_id=${artId}`),
  createTeam: (body: TeamCreate) => post<Team>('/team', body),
  updateTeam: (id: string, body: TeamUpdate) => patch<Team>(`/team/${id}`, body),
  deleteTeam: (id: string) => del(`/team/${id}`),

  listIterations: (piId: string) => get<Iteration[]>(`/iterations?pi_id=${piId}`),
  createIteration: (body: IterationCreate) => post<Iteration>('/iterations', body),
  deleteIteration: (id: string) => del(`/iterations/${id}`),

  listFeatures: (piId: string) => get<Feature[]>(`/features?pi_id=${piId}`),
  listAllFeatures: () => get<Feature[]>('/features'),
  createFeature: (body: FeatureCreate) => post<Feature>('/features', body),
  updateFeature: (id: string, body: FeatureUpdate) => patch<Feature>(`/features/${id}`, body),
  deleteFeature: (id: string) => del(`/features/${id}`),

  listStories: () => get<Story[]>('/stories'),
  listStoriesByFeature: (featureId: string) => get<Story[]>(`/stories?feature_id=${featureId}`),
  createStory: (body: StoryCreate) => post<Story>('/stories', body),
  updateStory: (id: string, body: StoryUpdate) => patch<Story>(`/stories/${id}`, body),
  deleteStory: (id: string) => del(`/stories/${id}`),

  listObjectives: (piId: string) => get<PIObjective[]>(`/objectives?pi_id=${piId}`),
  createObjective: (body: PIObjectiveCreate) => post<PIObjective>('/objectives', body),
  updateObjective: (id: string, body: PIObjectiveUpdate) => patch<PIObjective>(`/objectives/${id}`, body),
  deleteObjective: (id: string) => del(`/objectives/${id}`),

  listCapacityPlans: (piId: string) => get<CapacityPlan[]>(`/capacity-plans?pi_id=${piId}`),
  upsertCapacityPlan: (body: CapacityPlanCreate) => post<CapacityPlan>('/capacity-plans', body),
  seedCapacityPlans: (piId: string) => post<CapacityPlan[]>('/capacity-plans/seed', { pi_id: piId }),
  listVelocity: (piId: string) => get<VelocityEntry[]>(`/capacity-plans/velocity?pi_id=${piId}`),

  listRisks: (piId: string) => get<Risk[]>(`/risks?pi_id=${piId}`),
  createRisk: (body: RiskCreate) => post<Risk>('/risks', body),
  updateRisk: (id: string, body: RiskUpdate) => patch<Risk>(`/risks/${id}`, body),
  deleteRisk: (id: string) => del(`/risks/${id}`),

  listDependencies: (piId: string) => get<Dependency[]>(`/dependencies?pi_id=${piId}`),
  createDependency: (body: DependencyCreate) => post<Dependency>('/dependencies', body),
  updateDependency: (id: string, body: DependencyUpdate) => patch<Dependency>(`/dependencies/${id}`, body),
  deleteDependency: (id: string) => del(`/dependencies/${id}`),
};
