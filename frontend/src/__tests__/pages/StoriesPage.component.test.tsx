import { render, screen, act, within } from '@testing-library/react';
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

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { StoriesPage } from '../../pages/StoriesPage';
import { makeFeature, makeIteration, makePI, makeStory, makeTeam } from '../factories';
import { setupQueryMocks } from '../setupMocks';

const mockPI = makePI({ id: 'pi-1', name: 'PI 2026.1', status: 'active' });
const mockFeature = makeFeature({ id: 'feat-1', name: 'Auth Feature', team_id: 'team-1' });
const mockFeature2 = makeFeature({ id: 'feat-2', name: 'Search Feature', team_id: 'team-1' });
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

type MutOpts = { mutationFn?: unknown; onSuccess?: () => void; onError?: (e: Error) => void };

function setupMocksWithCapture(opts: {
  stories?: ReturnType<typeof makeStory>[];
  features?: ReturnType<typeof makeFeature>[];
  iterations?: ReturnType<typeof makeIteration>[];
  teams?: ReturnType<typeof makeTeam>[];
  isPending?: boolean;
} = {}) {
  const {
    stories = [],
    features = [mockFeature],
    iterations = [mockIteration],
    teams = mockTeams,
    isPending = false,
  } = opts;

  const captured: Array<{ mutate: ReturnType<typeof vi.fn>; opts: MutOpts }> = [];

  vi.mocked(useQueryClient).mockReturnValue({ invalidateQueries: vi.fn() } as unknown as ReturnType<typeof useQueryClient>);
  vi.mocked(useMutation).mockImplementation((mutOpts: unknown) => {
    const mutate = vi.fn();
    captured.push({ mutate, opts: mutOpts as MutOpts });
    return { mutate, isPending } as unknown as ReturnType<typeof useMutation>;
  });
  vi.mocked(useQuery).mockImplementation((queryOpts: unknown) => {
    const key = ((queryOpts as { queryKey: string[] }).queryKey)[0];
    const map: Record<string, unknown> = {
      pi: mockPI,
      features,
      stories,
      iterations,
      teams,
    };
    return { data: map[key], isLoading: false, isError: false } as unknown as ReturnType<typeof useQuery>;
  });

  return captured;
}

function setupMocks(opts: Parameters<typeof setupMocksWithCapture>[0] = {}) {
  setupQueryMocks(
    { pi: mockPI, features: opts.features ?? [mockFeature], stories: opts.stories ?? [], iterations: opts.iterations ?? [mockIteration], teams: opts.teams ?? mockTeams },
    { isPending: opts.isPending ?? false },
  );
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
        return undefined;
      },
      { isError: true },
    );
    render(<StoriesPage />);
    expect(screen.getByRole('button', { name: '+ New Story' })).toBeInTheDocument();
  });

  it('shows error message in modal when story create mutation fails', async () => {
    setupMocks({ stories: [] });
    const onErrors: Array<(e: Error) => void> = [];
    vi.mocked(useMutation).mockImplementation((opts: unknown) => {
      const o = opts as MutOpts;
      if (o?.onError) onErrors.push(o.onError);
      return { mutate: vi.fn(), isPending: false } as unknown as ReturnType<typeof useMutation>;
    });
    const user = userEvent.setup();
    render(<StoriesPage />);
    await user.click(screen.getByRole('button', { name: '+ New Story' }));
    act(() => { onErrors[0]?.(new Error('Server error')); });
    expect(screen.getByText('Server error')).toBeInTheDocument();
  });
});

describe('StoriesPage — empty states', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('shows "No features in this PI yet." when features is empty', () => {
    setupMocks({ stories: [], features: [] });
    render(<StoriesPage />);
    expect(screen.getByText('No features in this PI yet.')).toBeInTheDocument();
  });

  it('shows "No stories for this PI." when features exist but stories empty', () => {
    setupMocks({ stories: [], features: [mockFeature] });
    render(<StoriesPage />);
    expect(screen.getByText('No stories for this PI.')).toBeInTheDocument();
  });

  it('disables "+ New Story" button when no features', () => {
    setupMocks({ features: [] });
    render(<StoriesPage />);
    expect(screen.getByRole('button', { name: '+ New Story' })).toBeDisabled();
  });

  it('shows story count singular', () => {
    setupMocks({ stories: [baseStory] });
    render(<StoriesPage />);
    expect(screen.getByText('1 story')).toBeInTheDocument();
  });

  it('shows story count plural', () => {
    const s2 = makeStory({ id: 'story-2', name: 'Register', feature_id: 'feat-1', team_id: 'team-1' });
    setupMocks({ stories: [baseStory, s2] });
    render(<StoriesPage />);
    expect(screen.getByText('2 stories')).toBeInTheDocument();
  });
});

describe('StoriesPage — story table', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders feature name from featureMap', () => {
    setupMocks({ stories: [baseStory] });
    render(<StoriesPage />);
    expect(screen.getByText('Auth Feature')).toBeInTheDocument();
  });

  it('renders points from story', () => {
    const story = makeStory({ id: 'story-pts', name: 'Pointed', feature_id: 'feat-1', team_id: 'team-1', points: 8 });
    setupMocks({ stories: [story] });
    render(<StoriesPage />);
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('renders team name from teamMap', () => {
    setupMocks({ stories: [baseStory] });
    render(<StoriesPage />);
    expect(screen.getByText('Alpha')).toBeInTheDocument();
  });

  it('renders raw team_id when not in teamMap', () => {
    const story = makeStory({ id: 'story-x', name: 'No team', feature_id: 'feat-1', team_id: 'team-999' });
    setupMocks({ stories: [story] });
    render(<StoriesPage />);
    expect(screen.getByText('team-999')).toBeInTheDocument();
  });

  it('clicking story name opens edit modal', async () => {
    setupMocks({ stories: [baseStory] });
    const user = userEvent.setup();
    render(<StoriesPage />);
    await user.click(screen.getByRole('button', { name: 'Login flow' }));
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument();
  });
});

describe('StoriesPage — delete flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('shows delete confirmation row when Delete clicked', async () => {
    setupMocks({ stories: [baseStory] });
    const user = userEvent.setup();
    render(<StoriesPage />);
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByRole('button', { name: 'Yes, delete' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('hides confirmation row when Cancel clicked', async () => {
    setupMocks({ stories: [baseStory] });
    const user = userEvent.setup();
    render(<StoriesPage />);
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('button', { name: 'Yes, delete' })).not.toBeInTheDocument();
  });

  it('"Yes, delete" calls deleteMut.mutate with story id', async () => {
    const captured = setupMocksWithCapture({ stories: [baseStory] });
    const user = userEvent.setup();
    render(<StoriesPage />);
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: 'Yes, delete' }));
    const wasCalled = captured.some((c) =>
      c.mutate.mock.calls.some((call: unknown[]) => call[0] === 'story-1'),
    );
    expect(wasCalled).toBe(true);
  });

  it('shows error inside delete row when deleteMut onError fires', async () => {
    setupMocks({ stories: [baseStory] });
    const onErrors: Array<(e: Error) => void> = [];
    vi.mocked(useMutation).mockImplementation((opts: unknown) => {
      const o = opts as MutOpts;
      if (o?.onError) onErrors.push(o.onError);
      return { mutate: vi.fn(), isPending: false } as unknown as ReturnType<typeof useMutation>;
    });
    const user = userEvent.setup();
    render(<StoriesPage />);
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    act(() => { onErrors[onErrors.length - 1]?.(new Error('Delete failed')); });
    expect(screen.getByText('Delete failed')).toBeInTheDocument();
  });

  it('truncates long story name in delete confirmation at 60 chars', async () => {
    const longName = 'A'.repeat(70);
    const story = makeStory({ id: 'story-long', name: longName, feature_id: 'feat-1', team_id: 'team-1' });
    setupMocks({ stories: [story] });
    const user = userEvent.setup();
    render(<StoriesPage />);
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByText(/…/)).toBeInTheDocument();
  });

  it('deleteMut onSuccess hides confirmation row', async () => {
    setupMocks({ stories: [baseStory] });
    const onSuccesses: Array<() => void> = [];
    vi.mocked(useMutation).mockImplementation((opts: unknown) => {
      const o = opts as MutOpts;
      if (o?.onSuccess) onSuccesses.push(o.onSuccess);
      return { mutate: vi.fn(), isPending: false } as unknown as ReturnType<typeof useMutation>;
    });
    const user = userEvent.setup();
    render(<StoriesPage />);
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByRole('button', { name: 'Yes, delete' })).toBeInTheDocument();
    act(() => { onSuccesses[onSuccesses.length - 1]?.(); });
    expect(screen.queryByRole('button', { name: 'Yes, delete' })).not.toBeInTheDocument();
  });
});

describe('StoriesPage — modal form interactions', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('closeModal via Cancel button hides the modal', async () => {
    setupMocks({ stories: [] });
    const user = userEvent.setup();
    render(<StoriesPage />);
    await user.click(screen.getByRole('button', { name: '+ New Story' }));
    expect(screen.getByRole('button', { name: 'Add Story' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('button', { name: 'Add Story' })).not.toBeInTheDocument();
  });

  it('handleSubmit shows error when name is empty', async () => {
    setupMocks({ stories: [] });
    const user = userEvent.setup();
    render(<StoriesPage />);
    await user.click(screen.getByRole('button', { name: '+ New Story' }));
    const nameInput = screen.getByLabelText(/^Name/);
    await user.clear(nameInput);
    await user.click(screen.getByRole('button', { name: 'Add Story' }));
    expect(screen.getByText('Name is required.')).toBeInTheDocument();
  });

  it('handleSubmit shows error when feature_id is empty', async () => {
    setupMocks({ stories: [], features: [mockFeature] });
    const user = userEvent.setup();
    render(<StoriesPage />);
    await user.click(screen.getByRole('button', { name: '+ New Story' }));
    const nameInput = screen.getByLabelText(/^Name/);
    await user.type(nameInput, 'My Story');
    const featureSelect = screen.getByLabelText(/^Feature/);
    await user.selectOptions(featureSelect, '');
    await user.click(screen.getByRole('button', { name: 'Add Story' }));
    expect(screen.getByText('Feature is required.')).toBeInTheDocument();
  });

  it('handleSubmit shows error when team_id is empty on new story', async () => {
    setupMocks({ stories: [], features: [mockFeature] });
    const user = userEvent.setup();
    render(<StoriesPage />);
    await user.click(screen.getByRole('button', { name: '+ New Story' }));
    const nameInput = screen.getByLabelText(/^Name/);
    await user.type(nameInput, 'My Story');
    const teamSelect = screen.getByLabelText(/^Team/);
    await user.selectOptions(teamSelect, '');
    await user.click(screen.getByRole('button', { name: 'Add Story' }));
    expect(screen.getByText('Team is required.')).toBeInTheDocument();
  });

  it('handleSubmit calls createMut.mutate on valid new story', async () => {
    const captured = setupMocksWithCapture({ stories: [], features: [mockFeature] });
    const user = userEvent.setup();
    render(<StoriesPage />);
    await user.click(screen.getByRole('button', { name: '+ New Story' }));
    const nameInput = screen.getByLabelText(/^Name/);
    await user.type(nameInput, 'Brand New Story');
    await user.click(screen.getByRole('button', { name: 'Add Story' }));
    const wasCalled = captured.some((c) =>
      c.mutate.mock.calls.some(
        (call: unknown[]) => (call[0] as { name?: string })?.name === 'Brand New Story',
      ),
    );
    expect(wasCalled).toBe(true);
  });

  it('handleSubmit calls updateMut.mutate when editing', async () => {
    const captured = setupMocksWithCapture({ stories: [baseStory], features: [mockFeature] });
    const user = userEvent.setup();
    render(<StoriesPage />);
    await user.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
    const nameInput = screen.getByLabelText(/^Name/);
    await user.clear(nameInput);
    await user.type(nameInput, 'Updated Story');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));
    const wasCalled = captured.some((c) =>
      c.mutate.mock.calls.some((call: unknown[]) => {
        const arg = call[0] as { id?: string; body?: { name?: string } };
        return arg?.id === 'story-1' && arg?.body?.name === 'Updated Story';
      }),
    );
    expect(wasCalled).toBe(true);
  });

  it('createMut onSuccess closes modal', async () => {
    setupMocks({ stories: [] });
    const onSuccesses: Array<() => void> = [];
    vi.mocked(useMutation).mockImplementation((opts: unknown) => {
      const o = opts as MutOpts;
      if (o?.onSuccess) onSuccesses.push(o.onSuccess);
      return { mutate: vi.fn(), isPending: false } as unknown as ReturnType<typeof useMutation>;
    });
    const user = userEvent.setup();
    render(<StoriesPage />);
    await user.click(screen.getByRole('button', { name: '+ New Story' }));
    expect(screen.getByRole('button', { name: 'Add Story' })).toBeInTheDocument();
    act(() => { onSuccesses[0]?.(); });
    expect(screen.queryByRole('button', { name: 'Add Story' })).not.toBeInTheDocument();
  });

  it('updateMut onSuccess closes modal', async () => {
    setupMocks({ stories: [baseStory] });
    const onSuccesses: Array<() => void> = [];
    vi.mocked(useMutation).mockImplementation((opts: unknown) => {
      const o = opts as MutOpts;
      if (o?.onSuccess) onSuccesses.push(o.onSuccess);
      return { mutate: vi.fn(), isPending: false } as unknown as ReturnType<typeof useMutation>;
    });
    const user = userEvent.setup();
    render(<StoriesPage />);
    await user.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument();
    act(() => { onSuccesses[1]?.(); });
    expect(screen.queryByRole('button', { name: 'Save Changes' })).not.toBeInTheDocument();
  });

  it('updateMut onError shows error in modal', async () => {
    setupMocks({ stories: [baseStory] });
    const onErrors: Array<(e: Error) => void> = [];
    vi.mocked(useMutation).mockImplementation((opts: unknown) => {
      const o = opts as MutOpts;
      if (o?.onError) onErrors.push(o.onError);
      return { mutate: vi.fn(), isPending: false } as unknown as ReturnType<typeof useMutation>;
    });
    const user = userEvent.setup();
    render(<StoriesPage />);
    await user.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
    act(() => { onErrors[1]?.(new Error('Update failed')); });
    expect(screen.getByText('Update failed')).toBeInTheDocument();
  });

  it('name input onChange updates form', async () => {
    setupMocks({ stories: [] });
    const user = userEvent.setup();
    render(<StoriesPage />);
    await user.click(screen.getByRole('button', { name: '+ New Story' }));
    const nameInput = screen.getByLabelText(/^Name/);
    await user.type(nameInput, 'Hello World');
    expect(nameInput).toHaveValue('Hello World');
  });

  it('feature select onChange updates selected feature', async () => {
    setupMocks({ stories: [], features: [mockFeature, mockFeature2] });
    const user = userEvent.setup();
    render(<StoriesPage />);
    await user.click(screen.getByRole('button', { name: '+ New Story' }));
    const featureSelect = screen.getByLabelText(/^Feature/);
    await user.selectOptions(featureSelect, 'feat-2');
    expect(featureSelect).toHaveValue('feat-2');
  });

  it('iteration select onChange updates to unplanned', async () => {
    setupMocks({ stories: [] });
    const user = userEvent.setup();
    render(<StoriesPage />);
    await user.click(screen.getByRole('button', { name: '+ New Story' }));
    const iterSelect = screen.getByLabelText(/^Iteration/);
    await user.selectOptions(iterSelect, 'iter-1');
    expect(iterSelect).toHaveValue('iter-1');
    await user.selectOptions(iterSelect, '');
    expect(iterSelect).toHaveValue('');
  });

  it('status select onChange updates status', async () => {
    setupMocks({ stories: [] });
    const user = userEvent.setup();
    render(<StoriesPage />);
    await user.click(screen.getByRole('button', { name: '+ New Story' }));
    const statusSelect = screen.getByLabelText(/^Status/);
    await user.selectOptions(statusSelect, 'in_progress');
    expect(statusSelect).toHaveValue('in_progress');
  });

  it('team select hidden when editing a story', async () => {
    setupMocks({ stories: [baseStory] });
    const user = userEvent.setup();
    render(<StoriesPage />);
    await user.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
    expect(screen.queryByLabelText(/^Team/)).not.toBeInTheDocument();
  });

  it('openNew pre-selects first feature and first team', async () => {
    setupMocks({ stories: [], features: [mockFeature, mockFeature2] });
    const user = userEvent.setup();
    render(<StoriesPage />);
    await user.click(screen.getByRole('button', { name: '+ New Story' }));
    const featureSelect = screen.getByLabelText(/^Feature/);
    expect(featureSelect).toHaveValue('feat-1');
  });

  it('PI name shown in heading', () => {
    setupMocks({ stories: [] });
    render(<StoriesPage />);
    expect(screen.getByText(/PI 2026\.1/)).toBeInTheDocument();
  });

  it('table renders column headers', () => {
    setupMocks({ stories: [baseStory] });
    render(<StoriesPage />);
    const table = screen.getByRole('table');
    expect(within(table).getByText('Name')).toBeInTheDocument();
    expect(within(table).getByText('Feature')).toBeInTheDocument();
    expect(within(table).getByText('Team')).toBeInTheDocument();
    expect(within(table).getByText('Points')).toBeInTheDocument();
    expect(within(table).getByText('Status')).toBeInTheDocument();
  });
});
