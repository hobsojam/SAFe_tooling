import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('react-router-dom', () => ({
  useParams: () => ({ piId: 'pi-1' }),
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return { ...actual, useQuery: vi.fn(), useMutation: vi.fn(), useQueryClient: vi.fn() };
});

vi.mock('../../components/Toaster', () => ({ useToast: () => vi.fn() }));

vi.mock('../../components/Spinner', () => ({ Spinner: () => <div>Loading…</div> }));

import { useMutation } from '@tanstack/react-query';
import { StoriesPage } from '../../pages/StoriesPage';
import { makeFeature, makeIteration, makePI, makeStory, makeTeam } from '../factories';
import { setupQueryMocks } from '../setupMocks';

const mockPI = makePI({ id: 'pi-1', name: 'PI 2026.1', status: 'active' });
const mockFeature = makeFeature({ id: 'feat-1', name: 'Auth Feature', team_id: 'team-1' });
const mockTeams = [makeTeam({ id: 'team-1', name: 'Alpha' })];
const mockIteration = makeIteration({
  id: 'iter-1',
  pi_id: 'pi-1',
  number: 1,
  name: 'Iteration 1',
  start_date: '2026-01-01',
  end_date: '2026-01-14',
});
const baseStory = makeStory({ id: 'story-1', name: 'Login flow', feature_id: 'feat-1', team_id: 'team-1', iteration_id: null });

function setupMocks({
  stories = [],
  features = [mockFeature],
  iterations = [mockIteration],
  teams = mockTeams,
  isPending = false,
}: {
  stories?: ReturnType<typeof makeStory>[];
  features?: ReturnType<typeof makeFeature>[];
  iterations?: ReturnType<typeof makeIteration>[];
  teams?: ReturnType<typeof makeTeam>[];
  isPending?: boolean;
} = {}) {
  setupQueryMocks({ pi: mockPI, features, stories, iterations, teams }, { isPending });
}

describe('StoriesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders "—" for story with no iteration_id', () => {
    setupMocks({ stories: [{ ...baseStory, iteration_id: null }] });
    render(<StoriesPage />);
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it('renders iteration name when iteration_id is in map', () => {
    setupMocks({
      stories: [{ ...baseStory, iteration_id: 'iter-1' }],
      iterations: [mockIteration],
    });
    render(<StoriesPage />);
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

  it('shows loading spinner while data is loading', () => {
    setupQueryMocks({ pi: mockPI, features: [mockFeature], stories: [], iterations: [mockIteration], teams: mockTeams }, { isLoading: true });
    render(<StoriesPage />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('renders gracefully when stories data fails to load (isError)', () => {
    setupQueryMocks(
      ({ queryKey }) => {
        const key = queryKey[0] as string;
        if (key === 'pi') return mockPI;
        if (key === 'teams') return mockTeams;
        if (key === 'iterations') return [mockIteration];
        if (key === 'features') return [mockFeature];
        return undefined; // stories returns undefined → defaults to []
      },
      { isError: true },
    );
    render(<StoriesPage />);
    expect(screen.getByRole('button', { name: '+ New Story' })).toBeInTheDocument();
  });

  it('shows error message in modal when story create mutation fails', async () => {
    setupMocks({ stories: [] });
    const onErrors: Array<(e: Error) => void> = [];
    vi.mocked(useMutation).mockImplementation((opts: any) => {
      if (opts?.onError) onErrors.push(opts.onError);
      return { mutate: vi.fn(), isPending: false } as any;
    });
    const user = userEvent.setup();
    render(<StoriesPage />);
    await user.click(screen.getByRole('button', { name: '+ New Story' }));
    act(() => { onErrors[0]?.(new Error('Server error')); });
    expect(screen.getByText('Server error')).toBeInTheDocument();
  });
});
