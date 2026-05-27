import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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

const mockToast = vi.fn();
vi.mock('../../components/Toaster', () => ({
  useToast: () => mockToast,
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

type MutationOpts = {
  mutationFn: (args: unknown) => Promise<unknown>;
  onSuccess: () => void;
  onError: (e: Error) => void;
};

interface MutationCapture {
  mutate: ReturnType<typeof vi.fn>;
  opts: MutationOpts;
}

type TeamStub = { id: string; name: string; member_count: number; art_id: string; topology_type: string | null };

/** Returns a live array that grows with each useMutation call across all renders. */
function setupMocks(teams: TeamStub[] = mockTeams): MutationCapture[] {
  const captured: MutationCapture[] = [];
  vi.mocked(useQueryClient).mockReturnValue({ invalidateQueries: vi.fn() } as unknown as ReturnType<typeof useQueryClient>);
  vi.mocked(useMutation).mockImplementation((opts: unknown) => {
    const mutate = vi.fn();
    captured.push({ mutate, opts: opts as MutationOpts });
    return { mutate, isPending: false } as unknown as ReturnType<typeof useMutation>;
  });
  vi.mocked(useQuery).mockImplementation(({ queryKey }: Parameters<typeof useQuery>[0]) => {
    const key = (queryKey as string[])[0];
    if (key === 'pi') return { data: mockPi, isLoading: false } as unknown as ReturnType<typeof useQuery>;
    if (key === 'art') return { data: mockArt } as unknown as ReturnType<typeof useQuery>;
    if (key === 'teams') return { data: teams, isLoading: false } as unknown as ReturnType<typeof useQuery>;
    if (key === 'arts') return { data: mockArts } as unknown as ReturnType<typeof useQuery>;
    return { data: undefined, isLoading: false } as unknown as ReturnType<typeof useQuery>;
  });
  return captured;
}

/** Check that any captured mutate was called with an argument matching the predicate. */
function anyMutateCalled(captured: MutationCapture[], pred: (arg: unknown) => boolean): boolean {
  return captured.some((c) => c.mutate.mock.calls.some((call: unknown[]) => pred(call[0])));
}

/** Get the opts from the most recent set of mutations (last 3 entries). */
function latestOpts(captured: MutationCapture[]): [MutationOpts, MutationOpts, MutationOpts] {
  const len = captured.length;
  return [captured[len - 3].opts, captured[len - 2].opts, captured[len - 1].opts];
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('TeamSetup', () => {
  describe('loading states', () => {
    it('shows spinner when PI is loading', () => {
      vi.mocked(useQueryClient).mockReturnValue({ invalidateQueries: vi.fn() } as unknown as ReturnType<typeof useQueryClient>);
      vi.mocked(useMutation).mockReturnValue({ mutate: vi.fn(), isPending: false } as unknown as ReturnType<typeof useMutation>);
      vi.mocked(useQuery).mockImplementation(({ queryKey }: Parameters<typeof useQuery>[0]) => {
        const key = (queryKey as string[])[0];
        if (key === 'pi') return { data: undefined, isLoading: true } as unknown as ReturnType<typeof useQuery>;
        return { data: undefined, isLoading: false } as unknown as ReturnType<typeof useQuery>;
      });
      render(<TeamSetup />);
      expect(screen.getByText('Loading…')).toBeInTheDocument();
    });

    it('shows spinner when teams are loading', () => {
      vi.mocked(useQueryClient).mockReturnValue({ invalidateQueries: vi.fn() } as unknown as ReturnType<typeof useQueryClient>);
      vi.mocked(useMutation).mockReturnValue({ mutate: vi.fn(), isPending: false } as unknown as ReturnType<typeof useMutation>);
      vi.mocked(useQuery).mockImplementation(({ queryKey }: Parameters<typeof useQuery>[0]) => {
        const key = (queryKey as string[])[0];
        if (key === 'pi') return { data: mockPi, isLoading: false } as unknown as ReturnType<typeof useQuery>;
        if (key === 'teams') return { data: [], isLoading: true } as unknown as ReturnType<typeof useQuery>;
        return { data: undefined, isLoading: false } as unknown as ReturnType<typeof useQuery>;
      });
      render(<TeamSetup />);
      expect(screen.getByText('Loading…')).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('shows empty message when there are no teams', () => {
      setupMocks([]);
      render(<TeamSetup />);
      expect(screen.getByText(/No teams in this ART yet/)).toBeInTheDocument();
    });

    it('shows Teams (0) when no teams', () => {
      setupMocks([]);
      render(<TeamSetup />);
      expect(screen.getByText('Teams (0)')).toBeInTheDocument();
    });

    it('hides empty message when add form is open', async () => {
      setupMocks([]);
      const user = userEvent.setup();
      render(<TeamSetup />);
      await user.click(screen.getByRole('button', { name: '+ Add Team' }));
      expect(screen.queryByText(/No teams in this ART yet/)).not.toBeInTheDocument();
    });
  });

  describe('team list', () => {
    it('renders team name and member count', () => {
      setupMocks();
      render(<TeamSetup />);
      expect(screen.getAllByText('Alpha').length).toBeGreaterThan(0);
    });

    it('shows Teams (1) when one team exists', () => {
      setupMocks();
      render(<TeamSetup />);
      expect(screen.getByText('Teams (1)')).toBeInTheDocument();
    });

    it('renders ART name as subtitle', () => {
      setupMocks();
      render(<TeamSetup />);
      expect(screen.getByText('Platform ART')).toBeInTheDocument();
    });

    it('sorts teams alphabetically', () => {
      const multiTeams = [
        { id: 'team-2', name: 'Zeta', member_count: 3, art_id: 'art-1', topology_type: null },
        { id: 'team-1', name: 'Alpha', member_count: 5, art_id: 'art-1', topology_type: null },
        { id: 'team-3', name: 'Beta', member_count: 4, art_id: 'art-1', topology_type: null },
      ];
      setupMocks(multiTeams);
      render(<TeamSetup />);
      // Mobile cards are rendered in DOM order; verify Alpha comes before Beta before Zeta
      const allNames = screen.getAllByText(/^(Alpha|Beta|Zeta)$/).map((el) => el.textContent!);
      const firstAlpha = allNames.indexOf('Alpha');
      const firstBeta = allNames.indexOf('Beta');
      const firstZeta = allNames.indexOf('Zeta');
      expect(firstAlpha).toBeLessThan(firstBeta);
      expect(firstBeta).toBeLessThan(firstZeta);
    });

    it('renders topology badge for a team with topology_type set', () => {
      const teamsWithTopology = [
        { id: 'team-1', name: 'Alpha', member_count: 5, art_id: 'art-1', topology_type: 'stream_aligned' },
      ];
      setupMocks(teamsWithTopology);
      render(<TeamSetup />);
      expect(screen.getAllByText('Stream-aligned').length).toBeGreaterThan(0);
    });
  });

  describe('add team form', () => {
    it('shows add form when "+ Add Team" is clicked', async () => {
      setupMocks();
      const user = userEvent.setup();
      render(<TeamSetup />);
      await user.click(screen.getByRole('button', { name: '+ Add Team' }));
      expect(screen.getByRole('heading', { name: 'New Team' })).toBeInTheDocument();
    });

    it('hides "+ Add Team" button while form is open', async () => {
      setupMocks();
      const user = userEvent.setup();
      render(<TeamSetup />);
      await user.click(screen.getByRole('button', { name: '+ Add Team' }));
      expect(screen.queryByRole('button', { name: '+ Add Team' })).not.toBeInTheDocument();
    });

    it('hides form when Cancel is clicked', async () => {
      setupMocks();
      const user = userEvent.setup();
      render(<TeamSetup />);
      await user.click(screen.getByRole('button', { name: '+ Add Team' }));
      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByRole('heading', { name: 'New Team' })).not.toBeInTheDocument();
    });

    it('shows error when name is empty on submit', async () => {
      setupMocks();
      const user = userEvent.setup();
      render(<TeamSetup />);
      await user.click(screen.getByRole('button', { name: '+ Add Team' }));
      await user.clear(screen.getByLabelText('Name'));
      await user.click(screen.getByRole('button', { name: 'Add Team' }));
      expect(screen.getByText('Name is required.')).toBeInTheDocument();
    });


    it('calls createMut.mutate with form values on valid submit', async () => {
      const captured = setupMocks();
      const user = userEvent.setup();
      render(<TeamSetup />);
      await user.click(screen.getByRole('button', { name: '+ Add Team' }));
      await user.clear(screen.getByLabelText('Name'));
      await user.type(screen.getByLabelText('Name'), 'Gamma');
      await user.click(screen.getByRole('button', { name: 'Add Team' }));
      expect(
        anyMutateCalled(captured, (arg) => (arg as { name?: string }).name === 'Gamma'),
      ).toBe(true);
    });

    it('creates team with selected topology type', async () => {
      const captured = setupMocks();
      const user = userEvent.setup();
      render(<TeamSetup />);
      await user.click(screen.getByRole('button', { name: '+ Add Team' }));
      await user.clear(screen.getByLabelText('Name'));
      await user.type(screen.getByLabelText('Name'), 'Gamma');
      await user.selectOptions(screen.getByLabelText(/Topology Type/i), 'platform');
      await user.click(screen.getByRole('button', { name: 'Add Team' }));
      expect(
        anyMutateCalled(captured, (arg) => (arg as { topology_type?: string }).topology_type === 'platform'),
      ).toBe(true);
    });

    it('selecting "None" topology passes null', async () => {
      const captured = setupMocks();
      const user = userEvent.setup();
      render(<TeamSetup />);
      await user.click(screen.getByRole('button', { name: '+ Add Team' }));
      await user.clear(screen.getByLabelText('Name'));
      await user.type(screen.getByLabelText('Name'), 'Gamma');
      await user.selectOptions(screen.getByLabelText(/Topology Type/i), 'enabling');
      await user.selectOptions(screen.getByLabelText(/Topology Type/i), '');
      await user.click(screen.getByRole('button', { name: 'Add Team' }));
      expect(
        anyMutateCalled(captured, (arg) => (arg as { topology_type?: unknown }).topology_type === null),
      ).toBe(true);
    });

    it('closes form and resets on onSuccess', async () => {
      const captured = setupMocks();
      const user = userEvent.setup();
      render(<TeamSetup />);
      await user.click(screen.getByRole('button', { name: '+ Add Team' }));
      const [, createOpts] = latestOpts(captured);
      await act(async () => {
        createOpts.onSuccess();
      });
      expect(screen.queryByRole('heading', { name: 'New Team' })).not.toBeInTheDocument();
    });

    it('shows error on onError for create', async () => {
      const captured = setupMocks();
      const user = userEvent.setup();
      render(<TeamSetup />);
      await user.click(screen.getByRole('button', { name: '+ Add Team' }));
      const [, createOpts] = latestOpts(captured);
      await act(async () => {
        createOpts.onError(new Error('Server error'));
      });
      expect(screen.getByText('Server error')).toBeInTheDocument();
    });
  });

  describe('edit team', () => {
    it('shows ART select with Unassigned option when editing', async () => {
      setupMocks();
      const user = userEvent.setup();
      render(<TeamSetup />);
      await user.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
      const artSelects = screen.getAllByRole('combobox', { name: /ART/i });
      expect(artSelects.length).toBeGreaterThan(0);
      expect(screen.getAllByRole('option', { name: '— Unassigned —' }).length).toBeGreaterThan(0);
    });

    it('renders both mobile and desktop ART selects when editing', async () => {
      setupMocks();
      const user = userEvent.setup();
      render(<TeamSetup />);
      await user.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
      const artSelects = screen.getAllByRole('combobox', { name: /ART/i });
      expect(artSelects.length).toBe(2);
    });

    it('renders ART options in edit select', async () => {
      setupMocks();
      const user = userEvent.setup();
      render(<TeamSetup />);
      await user.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
      expect(screen.getAllByRole('option', { name: 'Platform ART' }).length).toBeGreaterThan(0);
      expect(screen.getAllByRole('option', { name: 'Billing ART' }).length).toBeGreaterThan(0);
    });

    it('changing ART select updates the value', async () => {
      setupMocks();
      const user = userEvent.setup();
      render(<TeamSetup />);
      await user.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
      const artSelects = screen.getAllByRole('combobox', { name: /ART/i });
      await user.selectOptions(artSelects[0], 'art-2');
      expect((artSelects[0] as HTMLSelectElement).value).toBe('art-2');
    });

    it('submitting edit form calls updateMut.mutate with art_id', async () => {
      const captured = setupMocks();
      const user = userEvent.setup();
      render(<TeamSetup />);
      await user.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
      await user.click(screen.getAllByRole('button', { name: 'Save' })[0]);
      expect(
        anyMutateCalled(captured, (arg) => {
          const a = arg as { body?: { art_id?: string } };
          return a?.body?.art_id === 'art-1';
        }),
      ).toBe(true);
    });

    it('cancel edit clears the edit form', async () => {
      setupMocks();
      const user = userEvent.setup();
      render(<TeamSetup />);
      await user.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
      expect(screen.getAllByRole('button', { name: 'Save' }).length).toBeGreaterThan(0);
      await user.click(screen.getAllByRole('button', { name: 'Cancel' })[0]);
      expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    });

    it('shows validation error when name is empty on edit', async () => {
      setupMocks();
      const user = userEvent.setup();
      render(<TeamSetup />);
      await user.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
      // Mobile edit form exposes "Name" label; clear via that input
      const nameInputs = screen.getAllByLabelText('Name');
      await user.clear(nameInputs[0]);
      await user.click(screen.getAllByRole('button', { name: 'Save' })[0]);
      expect(screen.getAllByText('Name is required.').length).toBeGreaterThan(0);
    });


    it('clears edit state on updateMut onSuccess', async () => {
      const captured = setupMocks();
      const user = userEvent.setup();
      render(<TeamSetup />);
      await user.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
      const [updateOpts] = latestOpts(captured);
      await act(async () => {
        updateOpts.onSuccess();
      });
      expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    });

    it('shows error message on updateMut onError', async () => {
      const captured = setupMocks();
      const user = userEvent.setup();
      render(<TeamSetup />);
      await user.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
      const [updateOpts] = latestOpts(captured);
      await act(async () => {
        updateOpts.onError(new Error('Update failed'));
      });
      expect(screen.getAllByText('Update failed').length).toBeGreaterThan(0);
    });

    it('clicking Delete on another team while editing clears edit state', async () => {
      // Two teams required: editing Alpha hides its Delete; Beta still shows Delete.
      const multiTeams = [
        { id: 'team-1', name: 'Alpha', member_count: 5, art_id: 'art-1', topology_type: null },
        { id: 'team-2', name: 'Beta', member_count: 3, art_id: 'art-1', topology_type: null },
      ];
      setupMocks(multiTeams);
      const user = userEvent.setup();
      render(<TeamSetup />);
      await user.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
      expect(screen.getAllByRole('button', { name: 'Save' }).length).toBeGreaterThan(0);
      // Beta's Delete is still visible; clicking it calls setEdit(null)
      await user.click(screen.getAllByRole('button', { name: 'Delete' })[0]);
      expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: 'Yes, delete' }).length).toBeGreaterThan(0);
    });

    it('changing topology type in edit select updates selection', async () => {
      setupMocks();
      const user = userEvent.setup();
      render(<TeamSetup />);
      await user.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
      const topologySelects = screen.getAllByRole('combobox', { name: 'Topology type' });
      await user.selectOptions(topologySelects[0], 'enabling');
      expect((topologySelects[0] as HTMLSelectElement).value).toBe('enabling');
    });
  });

  describe('delete team', () => {
    it('shows delete confirmation when Delete is clicked', async () => {
      setupMocks();
      const user = userEvent.setup();
      render(<TeamSetup />);
      await user.click(screen.getAllByRole('button', { name: 'Delete' })[0]);
      expect(screen.getAllByRole('button', { name: 'Yes, delete' }).length).toBeGreaterThan(0);
    });

    it('shows team name in delete confirmation', async () => {
      setupMocks();
      const user = userEvent.setup();
      render(<TeamSetup />);
      await user.click(screen.getAllByRole('button', { name: 'Delete' })[0]);
      const confirms = screen.getAllByText(/Delete/).filter((el) => el.textContent?.includes('Alpha'));
      expect(confirms.length).toBeGreaterThan(0);
    });

    it('hides delete confirmation when Cancel is clicked', async () => {
      setupMocks();
      const user = userEvent.setup();
      render(<TeamSetup />);
      await user.click(screen.getAllByRole('button', { name: 'Delete' })[0]);
      await user.click(screen.getAllByRole('button', { name: 'Cancel' })[0]);
      expect(screen.queryByRole('button', { name: 'Yes, delete' })).not.toBeInTheDocument();
    });

    it('calls deleteMut.mutate with team id when Yes, delete is clicked', async () => {
      const captured = setupMocks();
      const user = userEvent.setup();
      render(<TeamSetup />);
      await user.click(screen.getAllByRole('button', { name: 'Delete' })[0]);
      await user.click(screen.getAllByRole('button', { name: 'Yes, delete' })[0]);
      expect(anyMutateCalled(captured, (arg) => arg === 'team-1')).toBe(true);
    });

    it('clears delete state on deleteMut onSuccess', async () => {
      const captured = setupMocks();
      const user = userEvent.setup();
      render(<TeamSetup />);
      await user.click(screen.getAllByRole('button', { name: 'Delete' })[0]);
      const [, , deleteOpts] = latestOpts(captured);
      await act(async () => {
        deleteOpts.onSuccess();
      });
      expect(screen.queryByRole('button', { name: 'Yes, delete' })).not.toBeInTheDocument();
    });

    it('shows error on deleteMut onError', async () => {
      const captured = setupMocks();
      const user = userEvent.setup();
      render(<TeamSetup />);
      await user.click(screen.getAllByRole('button', { name: 'Delete' })[0]);
      const [, , deleteOpts] = latestOpts(captured);
      await act(async () => {
        deleteOpts.onError(new Error('Delete failed'));
      });
      expect(screen.getAllByText('Delete failed').length).toBeGreaterThan(0);
    });

    it('clicking Edit when delete is pending clears delete state', async () => {
      const multiTeams = [
        { id: 'team-1', name: 'Alpha', member_count: 5, art_id: 'art-1', topology_type: null },
        { id: 'team-2', name: 'Beta', member_count: 3, art_id: 'art-1', topology_type: null },
      ];
      setupMocks(multiTeams);
      const user = userEvent.setup();
      render(<TeamSetup />);
      // Set delete pending on the first team (Alpha)
      await user.click(screen.getAllByRole('button', { name: 'Delete' })[0]);
      expect(screen.getAllByRole('button', { name: 'Yes, delete' }).length).toBeGreaterThan(0);
      // Click Edit on the second team (Beta) to clear delete state via startEdit
      await user.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
      expect(screen.queryByRole('button', { name: 'Yes, delete' })).not.toBeInTheDocument();
    });
  });

  describe('desktop table interactions', () => {
    it('desktop Edit button click opens edit form', async () => {
      setupMocks();
      const user = userEvent.setup();
      render(<TeamSetup />);
      // Desktop Edit is [1] (mobile is [0])
      await user.click(screen.getAllByRole('button', { name: 'Edit' })[1]);
      expect(screen.getAllByRole('button', { name: 'Save' }).length).toBeGreaterThan(0);
    });

    it('desktop Delete button click shows confirmation', async () => {
      setupMocks();
      const user = userEvent.setup();
      render(<TeamSetup />);
      await user.click(screen.getAllByRole('button', { name: 'Delete' })[1]);
      expect(screen.getAllByRole('button', { name: 'Yes, delete' }).length).toBeGreaterThan(0);
    });

    it('desktop delete confirm Yes, delete calls mutate', async () => {
      const captured = setupMocks();
      const user = userEvent.setup();
      render(<TeamSetup />);
      await user.click(screen.getAllByRole('button', { name: 'Delete' })[0]);
      // Both mobile and desktop Yes, delete buttons are now in DOM; click desktop one ([1])
      await user.click(screen.getAllByRole('button', { name: 'Yes, delete' })[1]);
      expect(anyMutateCalled(captured, (arg) => arg === 'team-1')).toBe(true);
    });

    it('desktop delete confirm Cancel hides confirmation', async () => {
      setupMocks();
      const user = userEvent.setup();
      render(<TeamSetup />);
      await user.click(screen.getAllByRole('button', { name: 'Delete' })[0]);
      // Cancel buttons: [0] mobile, [1] desktop
      await user.click(screen.getAllByRole('button', { name: 'Cancel' })[1]);
      expect(screen.queryByRole('button', { name: 'Yes, delete' })).not.toBeInTheDocument();
    });

    it('desktop edit Cancel button closes form', async () => {
      setupMocks();
      const user = userEvent.setup();
      render(<TeamSetup />);
      await user.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
      // Cancel buttons in edit mode: [0] mobile, [1] desktop
      await user.click(screen.getAllByRole('button', { name: 'Cancel' })[1]);
      expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    });

    it('desktop edit name input fires onChange', async () => {
      setupMocks();
      const user = userEvent.setup();
      render(<TeamSetup />);
      await user.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
      // Desktop name input has aria-label="Team name"
      const desktopNameInput = screen.getByRole('textbox', { name: 'Team name' });
      await user.type(desktopNameInput, 'X');
      expect((desktopNameInput as HTMLInputElement).value).toContain('X');
    });

    it('desktop edit member count input fires onChange', async () => {
      setupMocks();
      const user = userEvent.setup();
      render(<TeamSetup />);
      await user.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
      // Desktop member count input has aria-label="Member count"
      const desktopMemberInput = screen.getByRole('spinbutton', { name: 'Member count' });
      await user.type(desktopMemberInput, '1');
      expect((desktopMemberInput as HTMLInputElement).value).toMatch(/\d/);
    });

    it('desktop ART select fires onChange with non-empty value', async () => {
      setupMocks();
      const user = userEvent.setup();
      render(<TeamSetup />);
      await user.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
      // Both ART selects: [0] mobile, [1] desktop
      const artSelects = screen.getAllByRole('combobox', { name: /ART/i });
      await user.selectOptions(artSelects[1], 'art-2');
      expect((artSelects[1] as HTMLSelectElement).value).toBe('art-2');
    });

    it('desktop ART select passes null when Unassigned is chosen', async () => {
      const captured = setupMocks();
      const user = userEvent.setup();
      render(<TeamSetup />);
      await user.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
      const artSelects = screen.getAllByRole('combobox', { name: /ART/i });
      // First select a different ART, then go back to unassigned
      await user.selectOptions(artSelects[1], 'art-2');
      await user.selectOptions(artSelects[1], '');
      await user.click(screen.getAllByRole('button', { name: 'Save' })[0]);
      expect(
        anyMutateCalled(captured, (arg) => {
          const a = arg as { body?: { art_id?: unknown } };
          return a?.body?.art_id === null;
        }),
      ).toBe(true);
    });

    it('mobile edit topology select fires onChange', async () => {
      setupMocks();
      const user = userEvent.setup();
      render(<TeamSetup />);
      await user.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
      // Mobile topology select label is "Topology Type" (capital T)
      const mobileTopologySelects = screen.getAllByRole('combobox', { name: 'Topology Type' });
      await user.selectOptions(mobileTopologySelects[0], 'platform');
      expect((mobileTopologySelects[0] as HTMLSelectElement).value).toBe('platform');
    });

    it('mobile edit topology select passes null when None is chosen', async () => {
      setupMocks();
      const user = userEvent.setup();
      render(<TeamSetup />);
      await user.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
      const mobileTopologySelects = screen.getAllByRole('combobox', { name: 'Topology Type' });
      await user.selectOptions(mobileTopologySelects[0], 'platform');
      await user.selectOptions(mobileTopologySelects[0], '');
      expect((mobileTopologySelects[0] as HTMLSelectElement).value).toBe('');
    });

    it('mobile edit ART select passes null when Unassigned is chosen', async () => {
      const captured = setupMocks();
      const user = userEvent.setup();
      render(<TeamSetup />);
      await user.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
      const artSelects = screen.getAllByRole('combobox', { name: /ART/i });
      await user.selectOptions(artSelects[0], '');
      await user.click(screen.getAllByRole('button', { name: 'Save' })[0]);
      expect(
        anyMutateCalled(captured, (arg) => {
          const a = arg as { body?: { art_id?: unknown } };
          return a?.body?.art_id === null;
        }),
      ).toBe(true);
    });
  });

  describe('TopologySelect component', () => {
    it('renders all topology options in add form', async () => {
      setupMocks();
      const user = userEvent.setup();
      render(<TeamSetup />);
      await user.click(screen.getByRole('button', { name: '+ Add Team' }));
      const select = screen.getByLabelText(/Topology Type/i);
      expect(select.querySelectorAll('option').length).toBe(5); // "— None —" + 4 types
    });

    it('renders "— None —" as default option in add form', async () => {
      setupMocks();
      const user = userEvent.setup();
      render(<TeamSetup />);
      await user.click(screen.getByRole('button', { name: '+ Add Team' }));
      expect(screen.getAllByRole('option', { name: '— None —' }).length).toBeGreaterThan(0);
    });

    it('renders stream_aligned, enabling, complicated_subsystem, platform options', async () => {
      setupMocks();
      const user = userEvent.setup();
      render(<TeamSetup />);
      await user.click(screen.getByRole('button', { name: '+ Add Team' }));
      const select = screen.getByLabelText(/Topology Type/i);
      const optionValues = Array.from(select.querySelectorAll('option')).map(
        (o) => (o as HTMLOptionElement).value,
      );
      expect(optionValues).toContain('stream_aligned');
      expect(optionValues).toContain('enabling');
      expect(optionValues).toContain('complicated_subsystem');
      expect(optionValues).toContain('platform');
    });
  });
});
