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
import { Dependencies } from '../../pages/Dependencies';
import { makeDependency, makeFeature, makePI, makeTeam } from '../factories';
import { setupQueryMocks } from '../setupMocks';

const mockPI = makePI({ id: 'pi-1', name: 'PI 2026.1', status: 'active' });
const mockTeams = [
  makeTeam({ id: 'team-1', name: 'Alpha' }),
  makeTeam({ id: 'team-2', name: 'Beta' }),
];
const featureFrom = makeFeature({ id: 'feat-1', name: 'Auth Service', team_id: 'team-1' });
const featureTo = makeFeature({ id: 'feat-2', name: 'Payment Gateway', team_id: 'team-2' });
const baseDependency = makeDependency({
  id: 'dep-1',
  description: 'Auth must complete before payment',
  from_feature_id: 'feat-1',
  to_feature_id: 'feat-2',
});

function setupMocks({
  deps = [],
  features = [featureFrom, featureTo],
  teams = mockTeams,
  isPending = false,
}: {
  deps?: ReturnType<typeof makeDependency>[];
  features?: ReturnType<typeof makeFeature>[];
  teams?: ReturnType<typeof makeTeam>[];
  isPending?: boolean;
} = {}) {
  setupQueryMocks({ pi: mockPI, dependencies: deps, features, teams }, { isPending });
}

describe('Dependencies page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dependency with feature labels including team names', () => {
    setupMocks({ deps: [baseDependency] });
    render(<Dependencies />);
    expect(screen.getAllByText('Auth Service (Alpha)').length).toBeGreaterThanOrEqual(1);
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

  it('shows loading spinner while data is loading', () => {
    setupQueryMocks({ pi: mockPI, dependencies: [], features: [featureFrom, featureTo], teams: mockTeams }, { isLoading: true });
    render(<Dependencies />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('renders gracefully when dependencies data fails to load (isError)', () => {
    setupQueryMocks(
      ({ queryKey }) => {
        const key = queryKey[0] as string;
        if (key === 'pi') return mockPI;
        if (key === 'features') return [featureFrom, featureTo];
        if (key === 'teams') return mockTeams;
        return undefined; // dependencies returns undefined → defaults to []
      },
      { isError: true },
    );
    render(<Dependencies />);
    expect(screen.getByText(/\+ New Dependency/)).toBeInTheDocument();
  });

  it('shows error message in modal when dependency create mutation fails', async () => {
    setupMocks({ deps: [] });
    const onErrors: Array<(e: Error) => void> = [];
    vi.mocked(useMutation).mockImplementation((opts: any) => {
      if (opts?.onError) onErrors.push(opts.onError);
      return { mutate: vi.fn(), isPending: false } as any;
    });
    const user = userEvent.setup();
    render(<Dependencies />);
    await user.click(screen.getByRole('button', { name: '+ New Dependency' }));
    act(() => { onErrors[0]?.(new Error('Server error')); });
    expect(screen.getByText('Server error')).toBeInTheDocument();
  });
});
