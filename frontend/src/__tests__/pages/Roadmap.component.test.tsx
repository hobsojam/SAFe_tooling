import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return { ...actual, useQuery: vi.fn(), useMutation: vi.fn(), useQueryClient: vi.fn() };
});

vi.mock('react-router-dom', () => ({
  Link: ({ children, to, className }: { children: React.ReactNode; to: string; className?: string }) => (
    <a href={to} className={className}>{children}</a>
  ),
}));

vi.mock('../../components/Spinner', () => ({ Spinner: () => <div>Loading…</div> }));
vi.mock('../../components/EmptyState', () => ({
  EmptyState: ({ message }: { message: string }) => <p>{message}</p>,
}));
vi.mock('../../components/Badge', () => ({
  FeatureStatusBadge: ({ status }: { status: string }) => <span data-testid="status-badge">{status}</span>,
}));

import { Roadmap } from '../../pages/Roadmap';
import { makeFeature, makePI, makeTeam } from '../factories';
import { setupQueryMocks } from '../setupMocks';

const pi1 = makePI({ id: 'pi-1', name: 'PI 2026.1', start_date: '2026-01-05', end_date: '2026-03-27' });
const pi2 = makePI({ id: 'pi-2', name: 'PI 2026.2', start_date: '2026-04-06', end_date: '2026-06-26' });
const team1 = makeTeam({ id: 'team-1', name: 'Alpha' });
const team2 = makeTeam({ id: 'team-2', name: 'Beta' });

function setupRoadmapMocks({
  pis = [pi1],
  features = [] as ReturnType<typeof makeFeature>[],
  teams = [team1],
  isLoading = false,
} = {}) {
  return setupQueryMocks(
    ({ queryKey }) => {
      const key = queryKey[0] as string;
      if (key === 'pis') return pis;
      if (key === 'features') return features;
      if (key === 'teams') return teams;
      return undefined;
    },
    { isLoading },
  );
}

describe('Roadmap page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading spinner while data is loading', () => {
    setupRoadmapMocks({ isLoading: true });
    render(<Roadmap />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('shows empty state when there are no PIs and no features', () => {
    setupRoadmapMocks({ pis: [], features: [], teams: [] });
    render(<Roadmap />);
    expect(screen.getByText(/No PIs or features found/)).toBeInTheDocument();
  });

  it('shows empty state when there are PIs but no features assigned to any team', () => {
    setupRoadmapMocks({ pis: [pi1], features: [], teams: [team1] });
    render(<Roadmap />);
    expect(screen.getByText(/No features found/)).toBeInTheDocument();
  });

  it('renders the page heading', () => {
    const feature = makeFeature({ pi_id: 'pi-1', team_id: 'team-1' });
    setupRoadmapMocks({ features: [feature] });
    render(<Roadmap />);
    expect(screen.getByRole('heading', { name: 'PI Roadmap' })).toBeInTheDocument();
  });

  it('renders subtitle with singular "Program Increment" for a single PI', () => {
    const feature = makeFeature({ pi_id: 'pi-1', team_id: 'team-1' });
    setupRoadmapMocks({ pis: [pi1], features: [feature] });
    render(<Roadmap />);
    expect(screen.getByText(/Feature timeline across 1 Program Increment$/)).toBeInTheDocument();
  });

  it('renders subtitle with plural "Program Increments" for multiple PIs', () => {
    const f1 = makeFeature({ pi_id: 'pi-1', team_id: 'team-1' });
    const f2 = makeFeature({ pi_id: 'pi-2', team_id: 'team-2' });
    setupRoadmapMocks({ pis: [pi1, pi2], features: [f1, f2], teams: [team1, team2] });
    render(<Roadmap />);
    expect(screen.getByText(/Feature timeline across 2 Program Increments$/)).toBeInTheDocument();
  });

  it('renders PI name in column header', () => {
    const feature = makeFeature({ pi_id: 'pi-1', team_id: 'team-1' });
    setupRoadmapMocks({ features: [feature] });
    render(<Roadmap />);
    expect(screen.getByText('PI 2026.1')).toBeInTheDocument();
  });

  it('renders PI date range in column header', () => {
    const feature = makeFeature({ pi_id: 'pi-1', team_id: 'team-1' });
    setupRoadmapMocks({ features: [feature] });
    render(<Roadmap />);
    expect(screen.getByText('2026-01-05 – 2026-03-27')).toBeInTheDocument();
  });

  it('sorts PIs chronologically by start_date', () => {
    const f1 = makeFeature({ pi_id: 'pi-1', team_id: 'team-1', name: 'Feature A' });
    const f2 = makeFeature({ pi_id: 'pi-2', team_id: 'team-2', name: 'Feature B' });
    // pass PIs in reverse order — they should appear sorted
    setupRoadmapMocks({ pis: [pi2, pi1], features: [f1, f2], teams: [team1, team2] });
    render(<Roadmap />);
    const headers = screen.getAllByRole('columnheader');
    const piHeaders = headers.filter((h) => h.textContent?.includes('PI 2026'));
    expect(piHeaders[0].textContent).toContain('PI 2026.1');
    expect(piHeaders[1].textContent).toContain('PI 2026.2');
  });

  it('renders team name in a row header', () => {
    const feature = makeFeature({ pi_id: 'pi-1', team_id: 'team-1' });
    setupRoadmapMocks({ features: [feature] });
    render(<Roadmap />);
    expect(screen.getByText('Alpha')).toBeInTheDocument();
  });

  it('renders feature name inside its cell', () => {
    const feature = makeFeature({ pi_id: 'pi-1', team_id: 'team-1', name: 'Auth Service' });
    setupRoadmapMocks({ features: [feature] });
    render(<Roadmap />);
    expect(screen.getByText('Auth Service')).toBeInTheDocument();
  });

  it('renders feature status badge', () => {
    const feature = makeFeature({ pi_id: 'pi-1', team_id: 'team-1', status: 'in_progress' });
    setupRoadmapMocks({ features: [feature] });
    render(<Roadmap />);
    expect(screen.getByTestId('status-badge')).toHaveTextContent('in_progress');
  });

  it('renders WSJF score on feature card', () => {
    const feature = makeFeature({ pi_id: 'pi-1', team_id: 'team-1', wsjf_score: 4.5 });
    setupRoadmapMocks({ features: [feature] });
    render(<Roadmap />);
    expect(screen.getByText('WSJF 4.5')).toBeInTheDocument();
  });

  it('feature name in a PI column is a link to that PI backlog', () => {
    const feature = makeFeature({ pi_id: 'pi-1', team_id: 'team-1', name: 'Auth Service' });
    setupRoadmapMocks({ features: [feature] });
    render(<Roadmap />);
    const link = screen.getByRole('link', { name: 'Auth Service' });
    expect(link).toHaveAttribute('href', '/pi/pi-1/backlog');
  });

  it('renders multiple features in the same cell', () => {
    const f1 = makeFeature({ pi_id: 'pi-1', team_id: 'team-1', name: 'Feature X' });
    const f2 = makeFeature({ pi_id: 'pi-1', team_id: 'team-1', name: 'Feature Y' });
    setupRoadmapMocks({ features: [f1, f2] });
    render(<Roadmap />);
    expect(screen.getByText('Feature X')).toBeInTheDocument();
    expect(screen.getByText('Feature Y')).toBeInTheDocument();
  });

  it('renders features from two different teams in separate rows', () => {
    const f1 = makeFeature({ pi_id: 'pi-1', team_id: 'team-1', name: 'Alpha Feature' });
    const f2 = makeFeature({ pi_id: 'pi-1', team_id: 'team-2', name: 'Beta Feature' });
    setupRoadmapMocks({ features: [f1, f2], teams: [team1, team2] });
    render(<Roadmap />);
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByText('Alpha Feature')).toBeInTheDocument();
    expect(screen.getByText('Beta Feature')).toBeInTheDocument();
  });

  it('does not show a team row for teams that have no features', () => {
    const feature = makeFeature({ pi_id: 'pi-1', team_id: 'team-1' });
    // team2 has no features
    setupRoadmapMocks({ features: [feature], teams: [team1, team2] });
    render(<Roadmap />);
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.queryByText('Beta')).not.toBeInTheDocument();
  });

  it('renders "Unscheduled" column header when features have no pi_id', () => {
    const feature = makeFeature({ pi_id: null as unknown as string, team_id: 'team-1', name: 'Unscheduled Feature' });
    setupRoadmapMocks({ features: [feature] });
    render(<Roadmap />);
    expect(screen.getByText('Unscheduled')).toBeInTheDocument();
  });

  it('does not render "Unscheduled" column when all features have a pi_id', () => {
    const feature = makeFeature({ pi_id: 'pi-1', team_id: 'team-1' });
    setupRoadmapMocks({ features: [feature] });
    render(<Roadmap />);
    expect(screen.queryByText('Unscheduled')).not.toBeInTheDocument();
  });

  it('feature name in Unscheduled column is plain text, not a link', () => {
    const feature = makeFeature({ pi_id: null as unknown as string, team_id: 'team-1', name: 'No PI Feature' });
    setupRoadmapMocks({ pis: [], features: [feature] });
    render(<Roadmap />);
    expect(screen.queryByRole('link', { name: 'No PI Feature' })).not.toBeInTheDocument();
    expect(screen.getByText('No PI Feature')).toBeInTheDocument();
  });

  it('renders "Unassigned" row label when features have no team_id', () => {
    const feature = makeFeature({ pi_id: 'pi-1', team_id: null as unknown as string });
    setupRoadmapMocks({ features: [feature], teams: [] });
    render(<Roadmap />);
    expect(screen.getByText('Unassigned')).toBeInTheDocument();
  });

  it('does not render "Unassigned" row when all features have a team_id', () => {
    const feature = makeFeature({ pi_id: 'pi-1', team_id: 'team-1' });
    setupRoadmapMocks({ features: [feature] });
    render(<Roadmap />);
    expect(screen.queryByText('Unassigned')).not.toBeInTheDocument();
  });

  it('renders the Team column header', () => {
    const feature = makeFeature({ pi_id: 'pi-1', team_id: 'team-1' });
    setupRoadmapMocks({ features: [feature] });
    render(<Roadmap />);
    expect(screen.getByRole('columnheader', { name: 'Team' })).toBeInTheDocument();
  });
});
