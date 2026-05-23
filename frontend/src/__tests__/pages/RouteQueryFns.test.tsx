import { render, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const routeState = vi.hoisted(() => ({ piId: 'pi-1' }));

const apiMocks = vi.hoisted(() => ({
  getPI: vi.fn(),
  listARTs: vi.fn(),
  listTeamsByArt: vi.fn(),
  listIterations: vi.fn(),
  listFeatures: vi.fn(),
  listDependencies: vi.fn(),
  listCapacityPlans: vi.fn(),
  listVelocity: vi.fn(),
  listObjectives: vi.fn(),
  listRisks: vi.fn(),
  seedCapacityPlans: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useNavigate: () => vi.fn(),
  useParams: () => ({ piId: routeState.piId }),
}));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return { ...actual, useQuery: vi.fn(), useMutation: vi.fn(), useQueryClient: vi.fn() };
});

vi.mock('../../api', () => ({ api: apiMocks }));
vi.mock('../../components/Toaster', () => ({ useToast: () => vi.fn() }));
vi.mock('../../components/Spinner', () => ({ Spinner: () => <div>Loading</div> }));

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ARTSync } from '../../pages/ARTSync';
import { Backlog } from '../../pages/Backlog';
import { Board } from '../../pages/Board';
import { Capacity } from '../../pages/Capacity';
import { Dependencies } from '../../pages/Dependencies';
import { Objectives } from '../../pages/Objectives';
import { PIHealth } from '../../pages/PIHealth';
import { Risks } from '../../pages/Risks';
import { RoamUnroamed } from '../../pages/RoamUnroamed';
import { Setup } from '../../pages/Setup';
import { StoriesPage } from '../../pages/StoriesPage';
import { TeamSetup } from '../../pages/TeamSetup';
import {
  makeCapacityPlan,
  makeDependency,
  makeFeature,
  makeIteration,
  makePI,
  makePIObjective,
  makeRisk,
  makeTeam,
} from '../factories';

const pi = makePI({ id: 'pi-1', name: 'PI 2026.1' });
const iteration = makeIteration({ id: 'iter-1', pi_id: 'pi-1' });
const team = makeTeam({ id: 'team-1', name: 'Alpha' });
const feature = makeFeature({ id: 'feat-1', pi_id: 'pi-1', team_id: 'team-1' });
const dependency = makeDependency({ id: 'dep-1', pi_id: 'pi-1' });
const capacityPlan = makeCapacityPlan({ id: 'plan-1', pi_id: 'pi-1' });
const objective = makePIObjective({ id: 'obj-1', pi_id: 'pi-1' });
const risk = makeRisk({ id: 'risk-1', pi_id: 'pi-1' });

function queryData(queryKey: unknown[]) {
  const key = queryKey[0];
  if (key === 'pi') return pi;
  if (key === 'iterations') return [iteration];
  if (key === 'features') return [feature];
  if (key === 'dependencies') return [dependency];
  if (key === 'capacity-plans') return [capacityPlan];
  if (key === 'velocity') return [];
  if (key === 'objectives') return [objective];
  if (key === 'risks') return [risk];
  if (key === 'teams') return [team];
  return [];
}

function setupQueryExecution() {
  vi.mocked(useQueryClient).mockReturnValue({ invalidateQueries: vi.fn() } as any);
  vi.mocked(useMutation).mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
  vi.mocked(useQuery).mockImplementation((opts: any) => {
    const enabled = opts.enabled !== false;
    if (enabled) {
      void opts.queryFn?.();
    }
    return {
      data: enabled ? queryData(opts.queryKey) : undefined,
      isLoading: false,
      isError: false,
    } as any;
  });
}

describe('route-scoped page query functions', () => {
  beforeEach(() => {
    routeState.piId = 'pi-1';
    vi.clearAllMocks();
    setupQueryExecution();
    for (const mock of Object.values(apiMocks)) {
      mock.mockResolvedValue([]);
    }
    apiMocks.getPI.mockResolvedValue(pi);
    apiMocks.listARTs.mockResolvedValue([{ id: 'art-1', name: 'ART', team_ids: ['team-1'] }]);
    apiMocks.listTeamsByArt.mockResolvedValue([team]);
    apiMocks.seedCapacityPlans.mockResolvedValue([]);
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      disconnect() {}
    } as any;
    globalThis.requestAnimationFrame = vi.fn(() => 0) as any;
    globalThis.cancelAnimationFrame = vi.fn();
  });

  afterEach(() => {
    cleanup();
  });

  it.each([
    ['ARTSync', ARTSync],
    ['Backlog', Backlog],
    ['Board', Board],
    ['Capacity', Capacity],
    ['Dependencies', Dependencies],
    ['Objectives', Objectives],
    ['PIHealth', PIHealth],
    ['Risks', Risks],
    ['RoamUnroamed', RoamUnroamed],
    ['Setup', Setup],
    ['StoriesPage', StoriesPage],
    ['TeamSetup', TeamSetup],
  ])('passes the route PI id through %s query callbacks', (_name, Page) => {
    render(<Page />);
    expect(apiMocks.getPI).toHaveBeenCalledWith('pi-1');
  });

  it('does not execute query callbacks when the route has no PI id', () => {
    routeState.piId = '';
    render(<PIHealth />);
    expect(apiMocks.getPI).not.toHaveBeenCalled();
    expect(apiMocks.listObjectives).not.toHaveBeenCalled();
  });
});
