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

import { StoriesPage } from '../../pages/StoriesPage';

type Story = {
  id: string;
  name: string;
  feature_id: string;
  team_id: string;
  iteration_id: string | null;
  points: number;
  status: string;
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

type Iteration = {
  id: string;
  pi_id: string;
  number: number;
  name: string;
  start_date: string;
  end_date: string;
  is_ip: boolean;
};

type Team = {
  id: string;
  name: string;
  member_count: number;
  art_id: string | null;
  topology_type: string | null;
};

const mockPI = { id: 'pi-1', name: 'PI 2026.1', status: 'active' };

const mockFeature: Feature = {
  id: 'feat-1',
  name: 'Auth Feature',
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
  stories = [] as Story[],
  features = [mockFeature] as Feature[],
  iterations = [mockIteration] as Iteration[],
  teams = mockTeams,
  isPending = false,
}: {
  stories?: Story[];
  features?: Feature[];
  iterations?: Iteration[];
  teams?: Team[];
  isPending?: boolean;
} = {}) {
  vi.mocked(useQueryClient).mockReturnValue({ invalidateQueries: vi.fn() } as any);
  vi.mocked(useMutation).mockReturnValue({ mutate: vi.fn(), isPending } as any);
  vi.mocked(useQuery).mockImplementation((opts: any) => {
    const key = opts.queryKey[0];
    if (key === 'pi') return { data: mockPI } as any;
    if (key === 'features') return { data: features, isLoading: false } as any;
    if (key === 'stories') return { data: stories, isLoading: false } as any;
    if (key === 'iterations') return { data: iterations } as any;
    if (key === 'teams') return { data: teams } as any;
    return { data: undefined, isLoading: false } as any;
  });
}

describe('StoriesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders "—" for story with no iteration_id', () => {
    setupMocks({ stories: [{ ...baseStory, iteration_id: null }] });
    render(<StoriesPage />);
    // The iteration column shows '—' for null iteration_id
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it('renders iteration name when iteration_id is in map', () => {
    setupMocks({
      stories: [{ ...baseStory, iteration_id: 'iter-1' }],
      iterations: [mockIteration],
    });
    render(<StoriesPage />);
    // iterationMap uses i.name — 'Iteration 1' appears in the table cell
    // (also appears in the select dropdown option, so use getAllByText)
    expect(screen.getAllByText('Iteration 1').length).toBeGreaterThanOrEqual(1);
  });

  it('renders raw iteration_id when not in map', () => {
    setupMocks({
      stories: [{ ...baseStory, iteration_id: 'unknown-iter-id' }],
      iterations: [],
    });
    render(<StoriesPage />);
    expect(screen.getByText('unknown-iter-id')).toBeInTheDocument();
  });

  it('opens modal and shows "Add Story" on submit button', async () => {
    setupMocks({ stories: [] });
    const user = userEvent.setup();
    render(<StoriesPage />);
    await user.click(screen.getByRole('button', { name: '+ New Story' }));
    expect(screen.getByRole('button', { name: 'Add Story' })).toBeInTheDocument();
  });

  it('opens edit modal and shows "Save Changes" on submit button', async () => {
    setupMocks({ stories: [baseStory] });
    const user = userEvent.setup();
    render(<StoriesPage />);
    const editButtons = screen.getAllByRole('button', { name: 'Edit' });
    await user.click(editButtons[0]);
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument();
  });

  it('shows "Saving…" on submit button when mutation isPending', async () => {
    setupMocks({ stories: [], isPending: true });
    const user = userEvent.setup();
    render(<StoriesPage />);
    await user.click(screen.getByRole('button', { name: '+ New Story' }));
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeInTheDocument();
  });
});
