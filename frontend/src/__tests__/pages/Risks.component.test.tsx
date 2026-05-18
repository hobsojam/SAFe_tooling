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

import { Risks } from '../../pages/Risks';

type Risk = {
  id: string;
  description: string;
  pi_id: string;
  team_id: string | null;
  feature_id: string | null;
  roam_status: string;
  owner: string | null;
  mitigation_notes: string;
  raised_date: string;
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

const baseRisk: Risk = {
  id: 'risk-1',
  description: 'Some risk description',
  pi_id: 'pi-1',
  team_id: null,
  feature_id: null,
  roam_status: 'unroamed',
  owner: null,
  mitigation_notes: '',
  raised_date: '2026-01-01',
};

function setupMocks({
  risks = [] as Risk[],
  teams = mockTeams,
  isPending = false,
}: {
  risks?: Risk[];
  teams?: Team[];
  isPending?: boolean;
} = {}) {
  vi.mocked(useQueryClient).mockReturnValue({ invalidateQueries: vi.fn() } as any);
  vi.mocked(useMutation).mockReturnValue({ mutate: vi.fn(), isPending } as any);
  vi.mocked(useQuery).mockImplementation((opts: any) => {
    const key = opts.queryKey[0];
    if (key === 'pi') return { data: mockPI } as any;
    if (key === 'risks') return { data: risks, isLoading: false } as any;
    if (key === 'teams') return { data: teams } as any;
    return { data: undefined, isLoading: false } as any;
  });
}

describe('Risks page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty state when no risks', () => {
    setupMocks({ risks: [] });
    render(<Risks />);
    expect(screen.getByText('No risks for this PI.')).toBeInTheDocument();
  });

  it('renders "—" for risk with null team_id', () => {
    setupMocks({ risks: [{ ...baseRisk, team_id: null }] });
    render(<Risks />);
    // The desktop table cell shows '—' for null team_id
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it('renders team name when team found in map', () => {
    setupMocks({ risks: [{ ...baseRisk, team_id: 'team-1' }], teams: mockTeams });
    render(<Risks />);
    expect(screen.getAllByText('Alpha').length).toBeGreaterThanOrEqual(1);
  });

  it('renders raw team_id when team not in map', () => {
    setupMocks({ risks: [{ ...baseRisk, team_id: 'unknown-team-id' }], teams: [] });
    render(<Risks />);
    expect(screen.getAllByText('unknown-team-id').length).toBeGreaterThanOrEqual(1);
  });

  it('opens modal and shows "Add Risk" on submit button', async () => {
    setupMocks({ risks: [] });
    const user = userEvent.setup();
    render(<Risks />);
    await user.click(screen.getByRole('button', { name: '+ New Risk' }));
    expect(screen.getByRole('button', { name: 'Add Risk' })).toBeInTheDocument();
  });

  it('opens edit modal and shows "Save Changes" on submit button', async () => {
    setupMocks({ risks: [baseRisk] });
    const user = userEvent.setup();
    render(<Risks />);
    // Click the first Edit button
    const editButtons = screen.getAllByRole('button', { name: 'Edit' });
    await user.click(editButtons[0]);
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument();
  });

  it('shows "Saving…" on submit button when mutation isPending', async () => {
    setupMocks({ risks: [], isPending: true });
    const user = userEvent.setup();
    render(<Risks />);
    await user.click(screen.getByRole('button', { name: '+ New Risk' }));
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeInTheDocument();
  });
});
