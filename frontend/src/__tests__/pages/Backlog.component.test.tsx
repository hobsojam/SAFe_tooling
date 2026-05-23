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
import { Backlog } from '../../pages/Backlog';
import { makeFeature, makeIteration, makePI, makeStory, makeTeam } from '../factories';
import { setupQueryMocks } from '../setupMocks';

const mockPI = makePI({ id: 'pi-1', name: 'PI 2026.1', status: 'active' });
const mockTeams = [makeTeam({ id: 'team-1', name: 'Alpha' })];
const mockIteration = makeIteration({ id: 'iter-1', pi_id: 'pi-1', number: 1, name: 'Iteration 1' });
const baseFeature = makeFeature({ id: 'feat-1', pi_id: 'pi-1' });
const baseStory = makeStory({ id: 'story-1', feature_id: 'feat-1', team_id: 'team-1' });

function setupPageMocks({
  features = [],
  teams = mockTeams,
  iterations = [mockIteration],
  allStories = [],
  featureStories = [],
  isPending = false,
}: {
  features?: ReturnType<typeof makeFeature>[];
  teams?: ReturnType<typeof makeTeam>[];
  iterations?: ReturnType<typeof makeIteration>[];
  allStories?: ReturnType<typeof makeStory>[];
  featureStories?: ReturnType<typeof makeStory>[];
  isPending?: boolean;
} = {}) {
  // 'stories' is called twice: ['stories'] for counts and ['stories', featureId] for StoryPanel.
  // Use the resolver overload to differentiate by queryKey length.
  setupQueryMocks(
    ({ queryKey }) => {
      const key = queryKey[0] as string;
      if (key === 'pi') return mockPI;
      if (key === 'features') return features;
      if (key === 'teams') return teams;
      if (key === 'iterations') return iterations;
      if (key === 'stories') return queryKey.length === 1 ? allStories : featureStories;
      return undefined;
    },
    { isPending },
  );
}

describe('Backlog page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty state when no features', () => {
    setupPageMocks({ features: [] });
    render(<Backlog />);
    expect(screen.getByText('No features in this PI.')).toBeInTheDocument();
  });

  it('renders "—" for feature with no team', () => {
    setupPageMocks({ features: [{ ...baseFeature, team_id: null }] });
    render(<Backlog />);
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it('renders team name when found in map', () => {
    setupPageMocks({ features: [{ ...baseFeature, team_id: 'team-1' }] });
    render(<Backlog />);
    expect(screen.getAllByText('Alpha').length).toBeGreaterThanOrEqual(1);
  });

  it('opens modal and shows "Add Feature" on submit button', async () => {
    setupPageMocks({ features: [] });
    const user = userEvent.setup();
    render(<Backlog />);
    await user.click(screen.getByRole('button', { name: '+ New Feature' }));
    expect(screen.getByRole('button', { name: 'Add Feature' })).toBeInTheDocument();
  });

  it('opens edit modal and shows "Save Changes" on submit button', async () => {
    setupPageMocks({ features: [baseFeature] });
    const user = userEvent.setup();
    render(<Backlog />);
    const editButtons = screen.getAllByRole('button', { name: 'Edit' });
    await user.click(editButtons[0]);
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument();
  });

  it('shows "Saving…" on submit button when mutation isPending', async () => {
    setupPageMocks({ features: [], isPending: true });
    const user = userEvent.setup();
    render(<Backlog />);
    await user.click(screen.getByRole('button', { name: '+ New Feature' }));
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeInTheDocument();
  });

  it('expands feature row to show StoryPanel with iteration label "Iter 1"', async () => {
    const storyWithIteration = { ...baseStory, iteration_id: 'iter-1' };
    setupPageMocks({ features: [baseFeature], featureStories: [storyWithIteration] });
    const user = userEvent.setup();
    render(<Backlog />);
    const storiesButton = screen.getByRole('button', { name: /stories/i, expanded: false });
    await user.click(storiesButton);
    expect(screen.getByText('Iter 1')).toBeInTheDocument();
  });

  it('calls delete mutation when user confirms deletion', async () => {
    vi.stubGlobal('confirm', () => true);
    const { mutate } = setupQueryMocks(
      ({ queryKey }) => {
        const key = queryKey[0] as string;
        if (key === 'pi') return mockPI;
        if (key === 'features') return [baseFeature];
        if (key === 'teams') return mockTeams;
        if (key === 'iterations') return [mockIteration];
        if (key === 'stories') return [];
        return undefined;
      },
    );
    const user = userEvent.setup();
    render(<Backlog />);
    const deleteButtons = screen.getAllByRole('button', { name: 'Delete' });
    await user.click(deleteButtons[0]);
    expect(mutate).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('shows loading spinner while data is loading', () => {
    setupQueryMocks(
      ({ queryKey }) => {
        const key = queryKey[0] as string;
        if (key === 'pi') return mockPI;
        if (key === 'features') return [];
        if (key === 'teams') return mockTeams;
        if (key === 'iterations') return [mockIteration];
        if (key === 'stories') return [];
        return undefined;
      },
      { isLoading: true },
    );
    render(<Backlog />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('renders gracefully when features data fails to load (isError)', () => {
    setupQueryMocks(
      ({ queryKey }) => {
        const key = queryKey[0] as string;
        if (key === 'pi') return mockPI;
        if (key === 'teams') return mockTeams;
        if (key === 'iterations') return [mockIteration];
        if (key === 'stories') return [];
        return undefined; // features returns undefined → defaults to []
      },
      { isError: true },
    );
    render(<Backlog />);
    expect(screen.getByText('No features in this PI.')).toBeInTheDocument();
  });

  it('shows error message in modal when feature create mutation fails', async () => {
    setupPageMocks({ features: [] });
    const onErrors: Array<(e: Error) => void> = [];
    vi.mocked(useMutation).mockImplementation((opts: any) => {
      if (opts?.onError) onErrors.push(opts.onError);
      return { mutate: vi.fn(), isPending: false } as any;
    });
    const user = userEvent.setup();
    render(<Backlog />);
    await user.click(screen.getByRole('button', { name: '+ New Feature' }));
    act(() => { onErrors[0]?.(new Error('Server error')); });
    expect(screen.getByText('Server error')).toBeInTheDocument();
  });

  it('does not call delete mutation when user cancels deletion', async () => {
    vi.stubGlobal('confirm', () => false);
    const { mutate } = setupQueryMocks(
      ({ queryKey }) => {
        const key = queryKey[0] as string;
        if (key === 'pi') return mockPI;
        if (key === 'features') return [baseFeature];
        if (key === 'teams') return mockTeams;
        if (key === 'iterations') return [mockIteration];
        if (key === 'stories') return [];
        return undefined;
      },
    );
    const user = userEvent.setup();
    render(<Backlog />);
    const deleteButtons = screen.getAllByRole('button', { name: 'Delete' });
    await user.click(deleteButtons[0]);
    expect(mutate).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('updates acceptance_criteria textarea in the add-feature form', async () => {
    setupPageMocks({ features: [] });
    const user = userEvent.setup();
    render(<Backlog />);
    await user.click(screen.getByRole('button', { name: '+ New Feature' }));
    const acField = screen.getByRole('textbox', { name: /acceptance criteria/i });
    await user.type(acField, 'Given X When Y Then Z');
    expect(acField).toHaveValue('Given X When Y Then Z');
  });

  it('updates nfr textarea in the add-feature form', async () => {
    setupPageMocks({ features: [] });
    const user = userEvent.setup();
    render(<Backlog />);
    await user.click(screen.getByRole('button', { name: '+ New Feature' }));
    const nfrField = screen.getByRole('textbox', { name: /non-functional requirements/i });
    await user.type(nfrField, 'Must handle 1000 RPS');
    expect(nfrField).toHaveValue('Must handle 1000 RPS');
  });

  it('pre-populates acceptance_criteria and nfr in the edit modal', async () => {
    const feature = makeFeature({
      id: 'feat-1',
      pi_id: 'pi-1',
      acceptance_criteria: 'Given X When Y Then Z',
      nfr: 'Handle 1000 RPS',
    });
    setupPageMocks({ features: [feature] });
    const user = userEvent.setup();
    render(<Backlog />);
    const editButtons = screen.getAllByRole('button', { name: 'Edit' });
    await user.click(editButtons[0]);
    expect(screen.getByRole('textbox', { name: /acceptance criteria/i })).toHaveValue('Given X When Y Then Z');
    expect(screen.getByRole('textbox', { name: /non-functional requirements/i })).toHaveValue('Handle 1000 RPS');
  });

  it('StoryPanel shows "—" for story with no iteration_id', async () => {
    const storyNoIteration = { ...baseStory, iteration_id: null };
    setupPageMocks({ features: [baseFeature], featureStories: [storyNoIteration] });
    const user = userEvent.setup();
    render(<Backlog />);
    const storiesButton = screen.getByRole('button', { name: /stories/i, expanded: false });
    await user.click(storiesButton);
    expect(screen.getByText('Login flow')).toBeInTheDocument();
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });
});
