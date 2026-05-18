import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

vi.mock('react-router-dom', () => ({
  useParams: () => ({ piId: 'pi-1' }),
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return { ...actual, useQuery: vi.fn(), useMutation: vi.fn(), useQueryClient: vi.fn() };
});

vi.mock('../../components/Toaster', () => ({ useToast: () => vi.fn() }));

import { Dependencies } from '../../pages/Dependencies';

type Dependency = {
  id: string;
  description: string;
  pi_id: string;
  from_feature_id: string;
  to_feature_id: string;
  status: string;
  owner: string | null;
  resolution_notes: string;
  raised_date: string;
  needed_by_date: string | null;
};

type Feature = {
  id: string;
  name: string;
  description: string;
  pi_id: string | null;
  team_id: string | null;
  iteration_id: string | null;
  status: string;
  user_business_value: number;
  time_criticality: number;
  risk_reduction_opportunity_enablement: number;
  job_size: number;
  cost_of_delay: number;
  wsjf_score: number;
};

type Team = {
  id: string;
  name: string;
  member_count: number;
  art_id: string | null;
  topology_type: string | null;
};

const mockPI = { id: 'pi-1', name: 'PI 2026.1', status: 'active' };

const mockTeams: Team[] = [
  { id: 'team-1', name: 'Alpha', member_count: 5, art_id: 'art-1', topology_type: null },
  { id: 'team-2', name: 'Beta', member_count: 4, art_id: 'art-1', topology_type: null },
];

const featureFrom: Feature = {
  id: 'feat-1',
  name: 'Auth Service',
  description: '',
  pi_id: 'pi-1',
  team_id: 'team-1',
  iteration_id: null,
  status: 'backlog',
  user_business_value: 5,
  time_criticality: 5,
  risk_reduction_opportunity_enablement: 5,
  job_size: 5,
  cost_of_delay: 15,
  wsjf_score: 3,
};

const featureTo: Feature = {
  id: 'feat-2',
  name: 'Payment Gateway',
  description: '',
  pi_id: 'pi-1',
  team_id: 'team-2',
  iteration_id: null,
  status: 'backlog',
  user_business_value: 8,
  time_criticality: 7,
  risk_reduction_opportunity_enablement: 3,
  job_size: 8,
  cost_of_delay: 18,
  wsjf_score: 2.25,
};

const baseDependency: Dependency = {
  id: 'dep-1',
  description: 'Auth must complete before payment',
  pi_id: 'pi-1',
  from_feature_id: 'feat-1',
  to_feature_id: 'feat-2',
  status: 'identified',
  owner: null,
  resolution_notes: '',
  raised_date: '2026-01-01',
  needed_by_date: null,
};

function setupMocks({
  deps = [] as Dependency[],
  features = [featureFrom, featureTo] as Feature[],
  teams = mockTeams,
  isPending = false,
}: {
  deps?: Dependency[];
  features?: Feature[];
  teams?: Team[];
  isPending?: boolean;
} = {}) {
  vi.mocked(useQueryClient).mockReturnValue({ invalidateQueries: vi.fn() } as any);
  vi.mocked(useMutation).mockReturnValue({ mutate: vi.fn(), isPending } as any);
  vi.mocked(useQuery).mockImplementation((opts: any) => {
    const key = opts.queryKey[0];
    if (key === 'pi') return { data: mockPI } as any;
    if (key === 'dependencies') return { data: deps, isLoading: false } as any;
    if (key === 'features') return { data: features } as any;
    if (key === 'teams') return { data: teams } as any;
    return { data: undefined, isLoading: false } as any;
  });
}

describe('Dependencies page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dependency with feature labels including team names', () => {
    setupMocks({ deps: [baseDependency] });
    render(<Dependencies />);
    // depFromLabel: featureLabel(featureFrom, teamMap) → "Auth Service (Alpha)"
    expect(screen.getAllByText('Auth Service (Alpha)').length).toBeGreaterThanOrEqual(1);
    // depToLabel: featureLabel(featureTo, teamMap) → "Payment Gateway (Beta)"
    expect(screen.getAllByText('Payment Gateway (Beta)').length).toBeGreaterThanOrEqual(1);
  });

  it('renders feature name only when feature has no team', () => {
    const noTeamFeatureFrom = { ...featureFrom, team_id: null };
    const noTeamFeatureTo = { ...featureTo, team_id: null };
    setupMocks({ deps: [baseDependency], features: [noTeamFeatureFrom, noTeamFeatureTo] });
    render(<Dependencies />);
    expect(screen.getAllByText('Auth Service').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Payment Gateway').length).toBeGreaterThanOrEqual(1);
  });

  it('opens modal and shows "Add Dependency" on submit button', async () => {
    setupMocks({ deps: [] });
    const user = userEvent.setup();
    render(<Dependencies />);
    await user.click(screen.getByRole('button', { name: '+ New Dependency' }));
    expect(screen.getByRole('button', { name: 'Add Dependency' })).toBeInTheDocument();
  });

  it('opens edit modal and shows "Save Changes" on submit button', async () => {
    setupMocks({ deps: [baseDependency] });
    const user = userEvent.setup();
    render(<Dependencies />);
    const editButtons = screen.getAllByRole('button', { name: 'Edit' });
    await user.click(editButtons[0]);
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument();
  });

  it('shows "Saving…" on submit button when mutation isPending', async () => {
    setupMocks({ deps: [], isPending: true });
    const user = userEvent.setup();
    render(<Dependencies />);
    await user.click(screen.getByRole('button', { name: '+ New Dependency' }));
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeInTheDocument();
  });
});
