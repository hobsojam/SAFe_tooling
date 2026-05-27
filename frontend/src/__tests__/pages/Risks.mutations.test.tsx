import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('react-router-dom', () => ({
  useParams: () => ({ piId: 'pi-1' }),
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useQueryClient: vi.fn(),
}));

vi.mock('../../components/Toaster', () => ({ useToast: () => vi.fn() }));
vi.mock('../../components/Spinner', () => ({ Spinner: () => <div>Loading…</div> }));

import { Risks } from '../../pages/Risks';
import { makePI, makeRisk, makeTeam } from '../factories';

const mockPI = makePI({ id: 'pi-1', name: 'PI 2026.1', status: 'active' });
const mockTeams = [makeTeam({ id: 'team-1', name: 'Alpha' })];
const baseRisk = makeRisk({
  id: 'risk-1',
  pi_id: 'pi-1',
  description: 'DB migration risk',
  roam_status: 'unroamed',
  team_id: 'team-1',
  owner: null,
  mitigation_notes: '',
});

type MutOpts = { onSuccess?: () => void; onError?: (e: Error) => void };
type CapturedEntry = { opts: MutOpts; mutate: ReturnType<typeof vi.fn> };

// Mutation order: createMut[0], updateMut[1], deleteMut[2]
function captureMutations(risks: ReturnType<typeof makeRisk>[] = []) {
  const captured: CapturedEntry[] = [];
  vi.mocked(useQueryClient).mockReturnValue({ invalidateQueries: vi.fn() } as any);
  vi.mocked(useMutation).mockImplementation((opts: unknown) => {
    const mutate = vi.fn();
    captured.push({ opts: opts as MutOpts, mutate });
    return { mutate, isPending: false } as any;
  });
  vi.mocked(useQuery).mockImplementation(({ queryKey }: any) => {
    const key = (queryKey as string[])[0];
    if (key === 'pi') return { data: mockPI, isLoading: false } as any;
    if (key === 'risks') return { data: risks, isLoading: false } as any;
    if (key === 'teams') return { data: mockTeams, isLoading: false } as any;
    return { data: undefined, isLoading: false } as any;
  });
  return captured;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Risks page — modal close', () => {
  it('Cancel button in modal closes the modal', async () => {
    captureMutations();
    const user = userEvent.setup();
    render(<Risks />);
    await user.click(screen.getByRole('button', { name: '+ New Risk' }));
    expect(screen.getByRole('button', { name: 'Add Risk' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('button', { name: 'Add Risk' })).not.toBeInTheDocument();
  });
});

describe('Risks page — handleSubmit', () => {
  it('create: calls createMut.mutate with valid description', async () => {
    const captured = captureMutations();
    const user = userEvent.setup();
    render(<Risks />);
    await user.click(screen.getByRole('button', { name: '+ New Risk' }));
    const descTextarea = screen.getByLabelText(/Description/);
    await user.type(descTextarea, 'New infrastructure risk');
    await user.click(screen.getByRole('button', { name: 'Add Risk' }));
    const wasCalled = captured.some((c) =>
      c.mutate.mock.calls.some(
        (call: unknown[]) => (call[0] as { description?: string })?.description === 'New infrastructure risk',
      ),
    );
    expect(wasCalled).toBe(true);
  });

  it('update: calls updateMut.mutate with edited description', async () => {
    const captured = captureMutations([baseRisk]);
    const user = userEvent.setup();
    render(<Risks />);
    // click first Edit button (mobile layout comes first)
    const editButtons = screen.getAllByRole('button', { name: 'Edit' });
    await user.click(editButtons[0]);
    const descTextarea = screen.getByLabelText(/Description/);
    await user.clear(descTextarea);
    await user.type(descTextarea, 'Updated risk description');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));
    const wasCalled = captured.some((c) =>
      c.mutate.mock.calls.some((call: unknown[]) => {
        const arg = call[0] as { id?: string; body?: { description?: string } };
        return arg?.id === 'risk-1' && arg?.body?.description === 'Updated risk description';
      }),
    );
    expect(wasCalled).toBe(true);
  });
});

describe('Risks page — modal form onChange handlers', () => {
  it('team select onChange updates selected team', async () => {
    captureMutations();
    const user = userEvent.setup();
    render(<Risks />);
    await user.click(screen.getByRole('button', { name: '+ New Risk' }));
    const teamSelect = screen.getByLabelText('Team');
    await user.selectOptions(teamSelect, 'team-1');
    expect(teamSelect).toHaveValue('team-1');
  });

  it('team select onChange to empty sets null', async () => {
    captureMutations();
    const user = userEvent.setup();
    render(<Risks />);
    await user.click(screen.getByRole('button', { name: '+ New Risk' }));
    const teamSelect = screen.getByLabelText('Team');
    await user.selectOptions(teamSelect, 'team-1');
    await user.selectOptions(teamSelect, '');
    expect(teamSelect).toHaveValue('');
  });

  it('ROAM status select onChange updates status', async () => {
    captureMutations();
    const user = userEvent.setup();
    render(<Risks />);
    await user.click(screen.getByRole('button', { name: '+ New Risk' }));
    const roamSelect = screen.getByLabelText('ROAM Status');
    await user.selectOptions(roamSelect, 'owned');
    expect(roamSelect).toHaveValue('owned');
  });

  it('owner input onChange updates value', async () => {
    captureMutations();
    const user = userEvent.setup();
    render(<Risks />);
    await user.click(screen.getByRole('button', { name: '+ New Risk' }));
    const ownerInput = screen.getByLabelText('Owner');
    await user.type(ownerInput, 'Carol');
    expect(ownerInput).toHaveValue('Carol');
  });

  it('mitigation notes textarea onChange updates value', async () => {
    captureMutations();
    const user = userEvent.setup();
    render(<Risks />);
    await user.click(screen.getByRole('button', { name: '+ New Risk' }));
    const notesTextarea = screen.getByLabelText('Mitigation Notes');
    await user.type(notesTextarea, 'Using redundancy');
    expect(notesTextarea).toHaveValue('Using redundancy');
  });
});

describe('Risks page — mutation callbacks', () => {
  it('createMut onSuccess closes the modal', async () => {
    const captured = captureMutations();
    const user = userEvent.setup();
    render(<Risks />);
    await user.click(screen.getByRole('button', { name: '+ New Risk' }));
    expect(screen.getByRole('button', { name: 'Add Risk' })).toBeInTheDocument();
    act(() => { captured[0].opts.onSuccess?.(); });
    expect(screen.queryByRole('button', { name: 'Add Risk' })).not.toBeInTheDocument();
  });

  it('updateMut onSuccess closes the modal', async () => {
    const captured = captureMutations([baseRisk]);
    const user = userEvent.setup();
    render(<Risks />);
    const editButtons = screen.getAllByRole('button', { name: 'Edit' });
    await user.click(editButtons[0]);
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument();
    act(() => { captured[1].opts.onSuccess?.(); });
    expect(screen.queryByRole('button', { name: 'Save Changes' })).not.toBeInTheDocument();
  });

  it('createMut onError shows error in the modal', async () => {
    const captured = captureMutations();
    const user = userEvent.setup();
    render(<Risks />);
    await user.click(screen.getByRole('button', { name: '+ New Risk' }));
    act(() => { captured[0].opts.onError?.(new Error('Create risk failed')); });
    expect(screen.getByText('Create risk failed')).toBeInTheDocument();
  });
});
