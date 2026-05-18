import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamSetup } from '../../pages/TeamSetup';

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useQueryClient: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ piId: 'pi-1' }),
}));

vi.mock('../../api', () => ({
  api: {
    getPI: vi.fn(),
    listARTs: vi.fn(),
    listTeamsByArt: vi.fn(),
    createTeam: vi.fn(),
    updateTeam: vi.fn(),
    deleteTeam: vi.fn(),
  },
}));

vi.mock('../../components/Toaster', () => ({
  useToast: () => vi.fn(),
}));

vi.mock('../../components/Spinner', () => ({
  Spinner: () => <div>Loading…</div>,
}));

const mockPi = {
  id: 'pi-1',
  name: 'PI 2026.1',
  art_id: 'art-1',
  status: 'planning',
  start_date: '2026-01-05',
  end_date: '2026-03-27',
  iteration_ids: [],
};
const mockArt = { id: 'art-1', name: 'Platform ART', team_ids: ['team-1'] };
const mockTeams = [
  { id: 'team-1', name: 'Alpha', member_count: 5, art_id: 'art-1', topology_type: null },
];
const mockArts = [
  { id: 'art-1', name: 'Platform ART', team_ids: ['team-1'] },
  { id: 'art-2', name: 'Billing ART', team_ids: [] },
];

function setupMocks() {
  vi.mocked(useQueryClient).mockReturnValue({ invalidateQueries: vi.fn() } as unknown as ReturnType<typeof useQueryClient>);
  vi.mocked(useMutation).mockReturnValue({ mutate: vi.fn(), isPending: false } as unknown as ReturnType<typeof useMutation>);
  vi.mocked(useQuery).mockImplementation(({ queryKey }: Parameters<typeof useQuery>[0]) => {
    const key = (queryKey as string[])[0];
    if (key === 'pi') return { data: mockPi, isLoading: false } as unknown as ReturnType<typeof useQuery>;
    if (key === 'art') return { data: mockArt } as unknown as ReturnType<typeof useQuery>;
    if (key === 'teams') return { data: mockTeams, isLoading: false } as unknown as ReturnType<typeof useQuery>;
    if (key === 'arts') return { data: mockArts } as unknown as ReturnType<typeof useQuery>;
    return { data: undefined, isLoading: false } as unknown as ReturnType<typeof useQuery>;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setupMocks();
});

describe('TeamSetup', () => {
  it('renders the team list', () => {
    render(<TeamSetup />);
    expect(screen.getAllByText('Alpha').length).toBeGreaterThan(0);
  });

  it('shows ART select with Unassigned option when editing a team', async () => {
    const user = userEvent.setup();
    render(<TeamSetup />);
    const editButtons = screen.getAllByRole('button', { name: 'Edit' });
    await user.click(editButtons[0]);
    const artSelects = screen.getAllByRole('combobox', { name: /ART/i });
    expect(artSelects.length).toBeGreaterThan(0);
    expect(screen.getAllByRole('option', { name: '— Unassigned —' }).length).toBeGreaterThan(0);
  });

  it('renders ART options in the edit select', async () => {
    const user = userEvent.setup();
    render(<TeamSetup />);
    const editButtons = screen.getAllByRole('button', { name: 'Edit' });
    await user.click(editButtons[0]);
    expect(screen.getAllByRole('option', { name: 'Platform ART' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('option', { name: 'Billing ART' }).length).toBeGreaterThan(0);
  });

  it('renders ART selects in both mobile and desktop edit forms', async () => {
    const user = userEvent.setup();
    render(<TeamSetup />);
    await user.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
    const artSelects = screen.getAllByRole('combobox', { name: /ART/i });
    expect(artSelects.length).toBe(2);
  });

  it('shows loading spinner when data is loading', () => {
    vi.mocked(useQuery).mockImplementation(({ queryKey }: Parameters<typeof useQuery>[0]) => {
      const key = (queryKey as string[])[0];
      if (key === 'pi') return { data: undefined, isLoading: true } as unknown as ReturnType<typeof useQuery>;
      return { data: undefined, isLoading: false } as unknown as ReturnType<typeof useQuery>;
    });
    render(<TeamSetup />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });
});
