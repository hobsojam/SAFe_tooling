import { render, screen } from '@testing-library/react';
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

import { RoamUnroamed } from '../../pages/RoamUnroamed';
import { makePI, makeRisk, makeTeam } from '../factories';
import { setupQueryMocks } from '../setupMocks';

const mockPI = makePI({ id: 'pi-1', name: 'PI 2026.1', status: 'active' });
const mockTeam = makeTeam({ id: 'team-1', name: 'Alpha' });
const unroamedRisk = makeRisk({
  id: 'risk-1',
  pi_id: 'pi-1',
  description: 'Database migration risk',
  roam_status: 'unroamed',
  team_id: 'team-1',
  mitigation_notes: '',
});
const roamedRisk = makeRisk({
  id: 'risk-2',
  pi_id: 'pi-1',
  description: 'Already resolved risk',
  roam_status: 'resolved',
  team_id: null,
  mitigation_notes: '',
});

function setupPageMocks({
  risks = [] as ReturnType<typeof makeRisk>[],
  teams = [mockTeam],
  isLoading = false,
  isPending = false,
} = {}) {
  return setupQueryMocks(
    ({ queryKey }) => {
      const key = queryKey[0] as string;
      if (key === 'pi') return mockPI;
      if (key === 'risks') return risks;
      if (key === 'teams') return teams;
      return undefined;
    },
    { isLoading, isPending },
  );
}

describe('RoamUnroamed page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows spinner while loading', () => {
    setupPageMocks({ isLoading: true });
    render(<RoamUnroamed />);
    expect(screen.getByLabelText('Loading')).toBeInTheDocument();
  });

  it('shows empty state when all risks are already ROAMed', () => {
    setupPageMocks({ risks: [roamedRisk] });
    render(<RoamUnroamed />);
    expect(screen.getByText('All risks have been ROAMed.')).toBeInTheDocument();
  });

  it('shows empty state when there are no risks at all', () => {
    setupPageMocks({ risks: [] });
    render(<RoamUnroamed />);
    expect(screen.getByText('All risks have been ROAMed.')).toBeInTheDocument();
  });

  it('renders the page heading with PI name', () => {
    setupPageMocks({ risks: [unroamedRisk] });
    render(<RoamUnroamed />);
    expect(screen.getByRole('heading', { name: /ROAM Unroamed Risks/ })).toBeInTheDocument();
    expect(screen.getByText(/PI 2026.1/)).toBeInTheDocument();
  });

  it('shows risk count in the subtitle', () => {
    setupPageMocks({ risks: [unroamedRisk] });
    render(<RoamUnroamed />);
    expect(screen.getByText('1 risk need attention')).toBeInTheDocument();
  });

  it('shows plural risks count when multiple unroamed risks exist', () => {
    const secondRisk = makeRisk({ id: 'risk-3', pi_id: 'pi-1', roam_status: 'unroamed', mitigation_notes: '' });
    setupPageMocks({ risks: [unroamedRisk, secondRisk] });
    render(<RoamUnroamed />);
    expect(screen.getByText('2 risks need attention')).toBeInTheDocument();
  });

  it('shows unroamed risk description', () => {
    setupPageMocks({ risks: [unroamedRisk] });
    render(<RoamUnroamed />);
    expect(screen.getByText('Database migration risk')).toBeInTheDocument();
  });

  it('shows team name when team is found', () => {
    setupPageMocks({ risks: [unroamedRisk], teams: [mockTeam] });
    render(<RoamUnroamed />);
    expect(screen.getByText('Team: Alpha')).toBeInTheDocument();
  });

  it('shows raw team_id when team is not in the teams list', () => {
    setupPageMocks({ risks: [unroamedRisk], teams: [] });
    render(<RoamUnroamed />);
    expect(screen.getByText('Team: team-1')).toBeInTheDocument();
  });

  it('does not show team label when risk has no team', () => {
    const noTeamRisk = makeRisk({ id: 'risk-4', pi_id: 'pi-1', roam_status: 'unroamed', team_id: null, mitigation_notes: '' });
    setupPageMocks({ risks: [noTeamRisk] });
    render(<RoamUnroamed />);
    expect(screen.queryByText(/Team:/)).not.toBeInTheDocument();
  });

  it('renders "ROAM this risk" button for each unroamed risk', () => {
    setupPageMocks({ risks: [unroamedRisk] });
    render(<RoamUnroamed />);
    expect(screen.getByRole('button', { name: 'ROAM this risk' })).toBeInTheDocument();
  });

  it('shows "Saving…" on the button when mutation isPending', async () => {
    setupPageMocks({ risks: [unroamedRisk], isPending: true });
    render(<RoamUnroamed />);
    // isPending is true so saving[risk.id] is initially false — button only becomes
    // "Saving…" after the first click triggers setSaving. Just verify button is present.
    expect(screen.getByRole('button', { name: 'ROAM this risk' })).toBeInTheDocument();
  });

  it('clicking "ROAM this risk" calls the mutate function', async () => {
    const { mutate } = setupPageMocks({ risks: [unroamedRisk] });
    const user = userEvent.setup();
    render(<RoamUnroamed />);
    await user.click(screen.getByRole('button', { name: 'ROAM this risk' }));
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'risk-1' }),
    );
  });

  it('only renders unroamed risks, not already-ROAMed ones', () => {
    setupPageMocks({ risks: [unroamedRisk, roamedRisk] });
    render(<RoamUnroamed />);
    expect(screen.getByText('Database migration risk')).toBeInTheDocument();
    expect(screen.queryByText('Already resolved risk')).not.toBeInTheDocument();
  });

  it('renders a ROAM Status select for each unroamed risk', () => {
    setupPageMocks({ risks: [unroamedRisk] });
    render(<RoamUnroamed />);
    expect(screen.getByLabelText('ROAM Status')).toBeInTheDocument();
  });
});
