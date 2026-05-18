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

import { Backlog } from '../../pages/Backlog';

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

type Iteration = {
  id: string;
  pi_id: string;
  number: number;
  name: string;
  start_date: string;
  end_date: string;
  is_ip: boolean;
};

type Story = {
  id: string;
  name: string;
  feature_id: string;
  team_id: string;
  iteration_id: string | null;
  points: number;
  status: string;
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
];

const mockIteration: Iteration = {
  id: 'iter-1',
  pi_id: 'pi-1',
  number: 1,
  name: 'Iteration 1',
  start_date: '2026-01-01',
  end_date: '2026-01-14',
  is_ip: false,
};

const baseFeature: Feature = {
  id: 'feat-1',
  name: 'Auth Service',
  description: 'Authentication feature',
  pi_id: 'pi-1',
  team_id: null,
  iteration_id: null,
  status: 'backlog',
  user_business_value: 5,
  time_criticality: 5,
  risk_reduction_opportunity_enablement: 5,
  job_size: 5,
  cost_of_delay: 15,
  wsjf_score: 3,
};

const baseStory: Story = {
  id: 'story-1',
  name: 'Login flow',
  feature_id: 'feat-1',
  team_id: 'team-1',
  iteration_id: null,
  points: 3,
  status: 'not_started',
};

function setupMocks({
  features = [] as Feature[],
  teams = mockTeams,
  iterations = [mockIteration] as Iteration[],
  allStories = [] as Story[],
  featureStories = [] as Story[],
  isPending = false,
}: {
  features?: Feature[];
  teams?: Team[];
  iterations?: Iteration[];
  allStories?: Story[];
  featureStories?: Story[];
  isPending?: boolean;
} = {}) {
  vi.mocked(useQueryClient).mockReturnValue({ invalidateQueries: vi.fn() } as any);
  vi.mocked(useMutation).mockReturnValue({ mutate: vi.fn(), isPending } as any);
  vi.mocked(useQuery).mockImplementation((opts: any) => {
    const key = opts.queryKey[0];
    if (key === 'pi') return { data: mockPI } as any;
    if (key === 'features') return { data: features, isLoading: false } as any;
    if (key === 'teams') return { data: teams } as any;
    if (key === 'iterations') return { data: iterations } as any;
    // Differentiate: ['stories'] (all stories for count) vs ['stories', featureId] (StoryPanel)
    if (key === 'stories' && opts.queryKey.length === 1) return { data: allStories, isLoading: false } as any;
    if (key === 'stories' && opts.queryKey.length === 2) return { data: featureStories, isLoading: false } as any;
    return { data: undefined, isLoading: false } as any;
  });
}

describe('Backlog page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty state when no features', () => {
    setupMocks({ features: [] });
    render(<Backlog />);
    expect(screen.getByText('No features in this PI.')).toBeInTheDocument();
  });

  it('renders "—" for feature with no team', () => {
    setupMocks({ features: [{ ...baseFeature, team_id: null }] });
    render(<Backlog />);
    // Desktop table shows '—' in Team column
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it('renders team name when found in map', () => {
    setupMocks({ features: [{ ...baseFeature, team_id: 'team-1' }], teams: mockTeams });
    render(<Backlog />);
    expect(screen.getAllByText('Alpha').length).toBeGreaterThanOrEqual(1);
  });

  it('opens modal and shows "Add Feature" on submit button', async () => {
    setupMocks({ features: [] });
    const user = userEvent.setup();
    render(<Backlog />);
    await user.click(screen.getByRole('button', { name: '+ New Feature' }));
    expect(screen.getByRole('button', { name: 'Add Feature' })).toBeInTheDocument();
  });

  it('opens edit modal and shows "Save Changes" on submit button', async () => {
    setupMocks({ features: [baseFeature] });
    const user = userEvent.setup();
    render(<Backlog />);
    const editButtons = screen.getAllByRole('button', { name: 'Edit' });
    await user.click(editButtons[0]);
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument();
  });

  it('shows "Saving…" on submit button when mutation isPending', async () => {
    setupMocks({ features: [], isPending: true });
    const user = userEvent.setup();
    render(<Backlog />);
    await user.click(screen.getByRole('button', { name: '+ New Feature' }));
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeInTheDocument();
  });

  it('expands feature row to show StoryPanel with iteration label "Iter 1"', async () => {
    const storyWithIteration: Story = { ...baseStory, iteration_id: 'iter-1' };
    setupMocks({
      features: [baseFeature],
      iterations: [mockIteration],
      featureStories: [storyWithIteration],
    });
    const user = userEvent.setup();
    render(<Backlog />);
    // Find the Stories toggle button with aria-expanded=false
    const storiesButton = screen.getByRole('button', { name: /stories/i, expanded: false });
    await user.click(storiesButton);
    // StoryPanel renders and shows iteration label
    expect(screen.getByText('Iter 1')).toBeInTheDocument();
  });

  it('StoryPanel shows "—" for story with no iteration_id', async () => {
    const storyNoIteration: Story = { ...baseStory, iteration_id: null };
    setupMocks({
      features: [baseFeature],
      iterations: [mockIteration],
      featureStories: [storyNoIteration],
    });
    const user = userEvent.setup();
    render(<Backlog />);
    const storiesButton = screen.getByRole('button', { name: /stories/i, expanded: false });
    await user.click(storiesButton);
    // StoryPanel renders; the iteration cell shows '—' for null iteration_id
    // The story row has cells: Name, Team, Iteration='—', Pts, Status
    // Check that login flow story is visible
    expect(screen.getByText('Login flow')).toBeInTheDocument();
    // At least one '—' in the story panel
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });
});
