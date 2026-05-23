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
import { Objectives } from '../../pages/Objectives';
import { makePI, makePIObjective, makeTeam } from '../factories';
import { setupQueryMocks } from '../setupMocks';

const mockPI = makePI({ id: 'pi-1', name: 'PI 2026.1', status: 'active' });
const mockTeams = [makeTeam({ id: 'team-1', name: 'Alpha' })];

const committedObjective = makePIObjective({
  id: 'obj-1',
  description: 'Deliver auth service',
  team_id: 'team-1',
  pi_id: 'pi-1',
  planned_business_value: 8,
  is_stretch: false,
  is_committed: true,
});

const stretchObjective = makePIObjective({
  id: 'obj-2',
  description: 'Stretch: mobile enhancements',
  team_id: 'team-1',
  pi_id: 'pi-1',
  planned_business_value: 4,
  is_stretch: true,
  is_committed: false,
});

describe('Objectives page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders committed and stretch objectives with correct badge labels', () => {
    setupQueryMocks({ pi: mockPI, objectives: [committedObjective, stretchObjective], teams: mockTeams });
    render(<Objectives />);
    expect(screen.getAllByText('Committed').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Stretch').length).toBeGreaterThanOrEqual(1);
  });

  it('applies the correct badge class for stretch objective in mobile card list', () => {
    setupQueryMocks({ pi: mockPI, objectives: [stretchObjective], teams: mockTeams });
    render(<Objectives />);
    const stretchBadges = screen.getAllByText('Stretch');
    expect(stretchBadges.some((el) => el.className.includes('bg-purple-100'))).toBe(true);
  });

  it('applies the correct badge class for committed objective in mobile card list', () => {
    setupQueryMocks({ pi: mockPI, objectives: [committedObjective], teams: mockTeams });
    render(<Objectives />);
    const committedBadges = screen.getAllByText('Committed');
    expect(committedBadges.some((el) => el.className.includes('bg-blue-100'))).toBe(true);
  });

  it('opens modal and shows "Add Objective" on submit button', async () => {
    setupQueryMocks({ pi: mockPI, objectives: [], teams: mockTeams });
    const user = userEvent.setup();
    render(<Objectives />);
    await user.click(screen.getByRole('button', { name: '+ New Objective' }));
    expect(screen.getByRole('button', { name: 'Add Objective' })).toBeInTheDocument();
  });

  it('opens edit modal and shows "Save Changes" on submit button', async () => {
    setupQueryMocks({ pi: mockPI, objectives: [committedObjective], teams: mockTeams });
    const user = userEvent.setup();
    render(<Objectives />);
    const editButtons = screen.getAllByRole('button', { name: 'Edit' });
    await user.click(editButtons[0]);
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument();
  });

  it('shows "Saving…" on submit button when mutation isPending', async () => {
    setupQueryMocks({ pi: mockPI, objectives: [], teams: mockTeams }, { isPending: true });
    const user = userEvent.setup();
    render(<Objectives />);
    await user.click(screen.getByRole('button', { name: '+ New Objective' }));
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeInTheDocument();
  });

  it('shows delete confirmation with short description when Delete clicked', async () => {
    setupQueryMocks({ pi: mockPI, objectives: [committedObjective], teams: mockTeams });
    const user = userEvent.setup();
    render(<Objectives />);
    const deleteButtons = screen.getAllByRole('button', { name: 'Delete' });
    await user.click(deleteButtons[0]);
    expect(screen.getAllByText(/Deliver auth service/).length).toBeGreaterThanOrEqual(1);
  });

  it('truncates long description with ellipsis in delete confirmation', async () => {
    const longDesc = 'A'.repeat(60);
    const objLong = makePIObjective({ id: 'obj-long', description: longDesc, team_id: 'team-1', pi_id: 'pi-1' });
    setupQueryMocks({ pi: mockPI, objectives: [objLong], teams: mockTeams });
    const user = userEvent.setup();
    render(<Objectives />);
    const deleteButtons = screen.getAllByRole('button', { name: 'Delete' });
    await user.click(deleteButtons[0]);
    expect(document.body.textContent).toContain('…');
  });

  it('shows loading spinner while data is loading', () => {
    setupQueryMocks({ pi: mockPI, objectives: [], teams: mockTeams }, { isLoading: true });
    render(<Objectives />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('renders gracefully when objectives data fails to load (isError)', () => {
    setupQueryMocks(
      ({ queryKey }) => {
        const key = queryKey[0] as string;
        if (key === 'pi') return mockPI;
        if (key === 'teams') return mockTeams;
        return undefined; // objectives returns undefined → defaults to []
      },
      { isError: true },
    );
    render(<Objectives />);
    expect(screen.getByRole('button', { name: '+ New Objective' })).toBeInTheDocument();
  });

  it('shows error message in modal when objective create mutation fails', async () => {
    setupQueryMocks({ pi: mockPI, objectives: [], teams: mockTeams });
    const onErrors: Array<(e: Error) => void> = [];
    vi.mocked(useMutation).mockImplementation((opts: any) => {
      if (opts?.onError) onErrors.push(opts.onError);
      return { mutate: vi.fn(), isPending: false } as any;
    });
    const user = userEvent.setup();
    render(<Objectives />);
    await user.click(screen.getByRole('button', { name: '+ New Objective' }));
    act(() => { onErrors[0]?.(new Error('Server error')); });
    expect(screen.getByText('Server error')).toBeInTheDocument();
  });

  it('shows Score button when PI is active', () => {
    setupQueryMocks({ pi: mockPI, objectives: [committedObjective], teams: mockTeams });
    render(<Objectives />);
    expect(screen.getAllByRole('button', { name: 'Score' }).length).toBeGreaterThanOrEqual(1);
  });

  it('hides Score button when PI is planning', () => {
    const planningPI = makePI({ id: 'pi-1', name: 'PI 2026.1', status: 'planning' });
    setupQueryMocks({ pi: planningPI, objectives: [committedObjective], teams: mockTeams });
    render(<Objectives />);
    expect(screen.queryByRole('button', { name: 'Score' })).not.toBeInTheDocument();
  });

  it('shows Score button when PI is closed', () => {
    const closedPI = makePI({ id: 'pi-1', name: 'PI 2026.1', status: 'closed' });
    setupQueryMocks({ pi: closedPI, objectives: [committedObjective], teams: mockTeams });
    render(<Objectives />);
    expect(screen.getAllByRole('button', { name: 'Score' }).length).toBeGreaterThanOrEqual(1);
  });

  it('opens Score modal with objective description when Score clicked', async () => {
    setupQueryMocks({ pi: mockPI, objectives: [committedObjective], teams: mockTeams });
    const user = userEvent.setup();
    render(<Objectives />);
    await user.click(screen.getAllByRole('button', { name: 'Score' })[0]);
    const dialog = screen.getByRole('dialog', { hidden: false });
    expect(screen.getByRole('heading', { name: 'Score Objective' })).toBeInTheDocument();
    expect(dialog.textContent).toContain('Deliver auth service');
    expect(screen.getByRole('button', { name: 'Save Score' })).toBeInTheDocument();
  });

  it('opens Score modal from the desktop row action', async () => {
    setupQueryMocks({ pi: mockPI, objectives: [committedObjective], teams: mockTeams });
    const user = userEvent.setup();
    render(<Objectives />);
    const scoreButtons = screen.getAllByRole('button', { name: 'Score' });
    await user.click(scoreButtons[scoreButtons.length - 1]);
    expect(screen.getByRole('heading', { name: 'Score Objective' })).toBeInTheDocument();
  });

  it('binds the score mutation to updateObjective', async () => {
    setupQueryMocks({ pi: mockPI, objectives: [committedObjective], teams: mockTeams });
    const mutationFns: Array<(value: unknown) => unknown> = [];
    vi.mocked(useMutation).mockImplementation((opts: any) => {
      if (opts?.mutationFn) mutationFns.push(opts.mutationFn);
      return { mutate: vi.fn(), isPending: false } as any;
    });
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(committedObjective), { status: 200 }));

    render(<Objectives />);
    await mutationFns[3]?.({
      id: 'obj-1',
      body: { actual_business_value: 6 },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/objectives/obj-1',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ actual_business_value: 6 }),
      }),
    );
    fetchMock.mockRestore();
  });

  it('prefills Score modal when objective already has actual BV', async () => {
    const scoredObjective = makePIObjective({
      ...committedObjective,
      id: 'obj-scored-prefill',
      actual_business_value: 7,
    });
    setupQueryMocks({ pi: mockPI, objectives: [scoredObjective], teams: mockTeams });
    const user = userEvent.setup();
    render(<Objectives />);
    await user.click(screen.getAllByRole('button', { name: 'Score' })[0]);
    expect(screen.getByLabelText('Actual BV (0–10)')).toHaveValue(7);
  });

  it('submits score as a number from the Score modal', async () => {
    const { mutate } = setupQueryMocks({ pi: mockPI, objectives: [committedObjective], teams: mockTeams });
    const user = userEvent.setup();
    render(<Objectives />);
    await user.click(screen.getAllByRole('button', { name: 'Score' })[0]);
    await user.type(screen.getByLabelText('Actual BV (0–10)'), '6');
    await user.click(screen.getByRole('button', { name: 'Save Score' }));
    expect(mutate).toHaveBeenCalledWith({
      id: 'obj-1',
      body: { actual_business_value: 6 },
    });
  });

  it('submits blank score as null from the Score modal', async () => {
    const { mutate } = setupQueryMocks({ pi: mockPI, objectives: [committedObjective], teams: mockTeams });
    const user = userEvent.setup();
    render(<Objectives />);
    await user.click(screen.getAllByRole('button', { name: 'Score' })[0]);
    await user.click(screen.getByRole('button', { name: 'Save Score' }));
    expect(mutate).toHaveBeenCalledWith({
      id: 'obj-1',
      body: { actual_business_value: null },
    });
  });

  it('shows score mutation error in the Score modal', async () => {
    setupQueryMocks({ pi: mockPI, objectives: [committedObjective], teams: mockTeams });
    const onErrors: Array<(e: Error) => void> = [];
    vi.mocked(useMutation).mockImplementation((opts: any) => {
      if (opts?.onError) onErrors.push(opts.onError);
      return { mutate: vi.fn(), isPending: false } as any;
    });
    const user = userEvent.setup();
    render(<Objectives />);
    await user.click(screen.getAllByRole('button', { name: 'Score' })[0]);
    act(() => { onErrors[3]?.(new Error('Score failed')); });
    expect(screen.getByText('Score failed')).toBeInTheDocument();
  });

  it('closes Score modal when score mutation succeeds', async () => {
    setupQueryMocks({ pi: mockPI, objectives: [committedObjective], teams: mockTeams });
    const onSuccesses: Array<() => void> = [];
    vi.mocked(useMutation).mockImplementation((opts: any) => {
      if (opts?.onSuccess) onSuccesses.push(opts.onSuccess);
      return { mutate: vi.fn(), isPending: false } as any;
    });
    const user = userEvent.setup();
    render(<Objectives />);
    await user.click(screen.getAllByRole('button', { name: 'Score' })[0]);
    act(() => { onSuccesses[3]?.(); });
    expect(screen.queryByRole('heading', { name: 'Score Objective' })).not.toBeInTheDocument();
  });

  it('shows Saving label while score mutation is pending', async () => {
    setupQueryMocks({ pi: mockPI, objectives: [committedObjective], teams: mockTeams }, { isPending: true });
    const user = userEvent.setup();
    render(<Objectives />);
    await user.click(screen.getAllByRole('button', { name: 'Score' })[0]);
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeInTheDocument();
  });

  it('closes Score modal when Cancel is clicked', async () => {
    setupQueryMocks({ pi: mockPI, objectives: [committedObjective], teams: mockTeams });
    const user = userEvent.setup();
    render(<Objectives />);
    await user.click(screen.getAllByRole('button', { name: 'Score' })[0]);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('heading', { name: 'Score Objective' })).not.toBeInTheDocument();
  });

  it('closes Score modal from the modal close button', async () => {
    setupQueryMocks({ pi: mockPI, objectives: [committedObjective], teams: mockTeams });
    const user = userEvent.setup();
    render(<Objectives />);
    await user.click(screen.getAllByRole('button', { name: 'Score' })[0]);
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('heading', { name: 'Score Objective' })).not.toBeInTheDocument();
  });

  it('closes edit modal and clears edit state when Cancel is clicked', async () => {
    setupQueryMocks({ pi: mockPI, objectives: [committedObjective], teams: mockTeams });
    const user = userEvent.setup();
    render(<Objectives />);
    await user.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: '+ New Objective' }));
    expect(screen.getByRole('button', { name: 'Add Objective' })).toBeInTheDocument();
  });

  it('submits new objectives with the current PI id', async () => {
    const { mutate } = setupQueryMocks({ pi: mockPI, objectives: [], teams: mockTeams });
    const user = userEvent.setup();
    render(<Objectives />);
    await user.click(screen.getByRole('button', { name: '+ New Objective' }));
    await user.type(screen.getByLabelText('Description *'), 'New objective');
    await user.click(screen.getByRole('button', { name: 'Add Objective' }));
    expect(mutate).toHaveBeenCalledWith({
      description: 'New objective',
      team_id: 'team-1',
      pi_id: 'pi-1',
      planned_business_value: 5,
      actual_business_value: null,
      is_stretch: false,
    });
  });

  it('shows actual business value when committed objectives are scored', () => {
    const scoredObj = makePIObjective({
      id: 'obj-scored',
      description: 'Scored objective',
      team_id: 'team-1',
      pi_id: 'pi-1',
      planned_business_value: 8,
      actual_business_value: 7,
      is_stretch: false,
      is_committed: true,
    });
    setupQueryMocks({ pi: mockPI, objectives: [scoredObj], teams: mockTeams });
    render(<Objectives />);
    expect(screen.getAllByText('7').length).toBeGreaterThanOrEqual(1);
  });
});
