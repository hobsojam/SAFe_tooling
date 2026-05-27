import { render, screen, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockNavigate = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', () => ({
  useParams: () => ({ piId: 'pi-1' }),
  useNavigate: () => mockNavigate,
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useQueryClient: vi.fn(),
}));

vi.mock('../../components/Toaster', () => ({ useToast: () => vi.fn() }));
vi.mock('../../components/Spinner', () => ({ Spinner: () => <div>Loading…</div> }));
vi.mock('../../components/Badge', () => ({
  PIStatusBadge: ({ status }: { status: string }) => <span>{status}</span>,
}));

import { Setup } from '../../pages/Setup';
import { makeIteration, makePI } from '../factories';

const mockPI = makePI({
  id: 'pi-1',
  name: 'PI 2026.1',
  status: 'planning',
  start_date: '2026-01-05',
  end_date: '2026-03-27',
});
const mockIter = makeIteration({
  id: 'iter-1',
  pi_id: 'pi-1',
  number: 1,
  name: 'Iteration 1',
  start_date: '2026-01-05',
  end_date: '2026-01-16',
  is_ip: false,
});

type MutOpts = { onSuccess?: (...args: unknown[]) => void; onError?: (e: Error) => void };
type CapturedEntry = { opts: MutOpts; mutate: ReturnType<typeof vi.fn> };

// Mutation order: updatePIMut[0], activateMut[1], closeMut[2], createIterMut[3], deleteIterMut[4], deletePIMut[5]
function captureMutations(
  pi = mockPI,
  iterations: ReturnType<typeof makeIteration>[] = [],
): CapturedEntry[] {
  const captured: CapturedEntry[] = [];
  vi.mocked(useQueryClient).mockReturnValue({ invalidateQueries: vi.fn() } as any);
  vi.mocked(useMutation).mockImplementation((opts: unknown) => {
    const mutate = vi.fn();
    captured.push({ opts: opts as MutOpts, mutate });
    return { mutate, isPending: false } as any;
  });
  vi.mocked(useQuery).mockImplementation(({ queryKey }: any) => {
    const key = (queryKey as string[])[0];
    if (key === 'pi') return { data: pi, isLoading: false } as any;
    if (key === 'iterations') return { data: iterations, isLoading: false } as any;
    return { data: undefined, isLoading: false } as any;
  });
  return captured;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockNavigate.mockReset();
});

describe('Setup page — lifecycle button interactions', () => {
  it('Activate button calls a mutation mutate fn', async () => {
    const captured = captureMutations();
    const user = userEvent.setup();
    render(<Setup />);
    await user.click(screen.getByRole('button', { name: 'Activate' }));
    expect(captured.some((c) => c.mutate.mock.calls.length > 0)).toBe(true);
  });

  it('Close button calls a mutation mutate fn (active PI)', async () => {
    const activePI = makePI({ ...mockPI, status: 'active' });
    const captured = captureMutations(activePI);
    const user = userEvent.setup();
    render(<Setup />);
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(captured.some((c) => c.mutate.mock.calls.length > 0)).toBe(true);
  });

  it('Delete iteration button calls a mutation mutate fn', async () => {
    const captured = captureMutations(mockPI, [mockIter]);
    const user = userEvent.setup();
    render(<Setup />);
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(captured.some((c) => c.mutate.mock.calls.length > 0)).toBe(true);
  });

  it('shows active lifecycle hint for an active PI', () => {
    captureMutations(makePI({ ...mockPI, status: 'active' }));
    render(<Setup />);
    expect(screen.getByText('Close after the PI System Demo and Inspect & Adapt.')).toBeInTheDocument();
  });
});

describe('Setup page — edit form onChange handlers', () => {
  it('name input onChange updates value', async () => {
    captureMutations();
    const user = userEvent.setup();
    render(<Setup />);
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const nameInput = screen.getByLabelText('Name');
    await user.clear(nameInput);
    await user.type(nameInput, 'Updated PI');
    expect(nameInput).toHaveValue('Updated PI');
  });

  it('start date input onChange updates form state', async () => {
    captureMutations();
    const user = userEvent.setup();
    render(<Setup />);
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const startInput = screen.getByLabelText('Start Date');
    fireEvent.change(startInput, { target: { value: '2026-02-01' } });
    expect(startInput).toHaveValue('2026-02-01');
  });

  it('end date input onChange updates form state', async () => {
    captureMutations();
    const user = userEvent.setup();
    render(<Setup />);
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const endInput = screen.getByLabelText('End Date');
    fireEvent.change(endInput, { target: { value: '2026-04-30' } });
    expect(endInput).toHaveValue('2026-04-30');
  });
});

describe('Setup page — iteration form onChange handlers', () => {
  it('IP checkbox onChange toggles checked state', async () => {
    captureMutations();
    const user = userEvent.setup();
    render(<Setup />);
    await user.click(screen.getByRole('button', { name: '+ Add' }));
    const checkbox = screen.getByRole('checkbox', { name: /Innovation/i });
    expect(checkbox).not.toBeChecked();
    await user.click(checkbox);
    expect(checkbox).toBeChecked();
  });

  it('iteration name input onChange updates value', async () => {
    captureMutations();
    const user = userEvent.setup();
    render(<Setup />);
    await user.click(screen.getByRole('button', { name: '+ Add' }));
    const nameInput = screen.getByLabelText('Name (optional)');
    await user.type(nameInput, 'Sprint Zero');
    expect(nameInput).toHaveValue('Sprint Zero');
  });

  it('iteration start date onChange updates form state', async () => {
    captureMutations();
    const user = userEvent.setup();
    render(<Setup />);
    await user.click(screen.getByRole('button', { name: '+ Add' }));
    const startInput = screen.getByLabelText('Start Date');
    fireEvent.change(startInput, { target: { value: '2026-03-01' } });
    expect(startInput).toHaveValue('2026-03-01');
  });

  it('iteration end date onChange updates form state', async () => {
    captureMutations();
    const user = userEvent.setup();
    render(<Setup />);
    await user.click(screen.getByRole('button', { name: '+ Add' }));
    const endInput = screen.getByLabelText('End Date');
    fireEvent.change(endInput, { target: { value: '2026-03-14' } });
    expect(endInput).toHaveValue('2026-03-14');
  });
});

describe('Setup page — updatePIMut callbacks', () => {
  it('onSuccess closes the edit form', async () => {
    const captured = captureMutations();
    const user = userEvent.setup();
    render(<Setup />);
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    act(() => { captured[0].opts.onSuccess?.(); });
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
  });

  it('onError shows error in the edit form', async () => {
    const captured = captureMutations();
    const user = userEvent.setup();
    render(<Setup />);
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    act(() => { captured[0].opts.onError?.(new Error('Save failed')); });
    expect(screen.getByText('Save failed')).toBeInTheDocument();
  });
});

describe('Setup page — activateMut and closeMut callbacks', () => {
  it('activateMut onError shows lifecycle error', () => {
    const captured = captureMutations();
    render(<Setup />);
    act(() => { captured[1].opts.onError?.(new Error('Cannot activate')); });
    expect(screen.getByText('Cannot activate')).toBeInTheDocument();
  });

  it('activateMut onSuccess clears lifecycle error', () => {
    const captured = captureMutations();
    render(<Setup />);
    act(() => { captured[1].opts.onError?.(new Error('Cannot activate')); });
    act(() => { captured[1].opts.onSuccess?.(); });
    expect(screen.queryByText('Cannot activate')).not.toBeInTheDocument();
  });

  it('closeMut onError shows lifecycle error', () => {
    const captured = captureMutations();
    render(<Setup />);
    act(() => { captured[2].opts.onError?.(new Error('Cannot close')); });
    expect(screen.getByText('Cannot close')).toBeInTheDocument();
  });

  it('closeMut onSuccess clears lifecycle error', () => {
    const captured = captureMutations();
    render(<Setup />);
    act(() => { captured[2].opts.onError?.(new Error('Cannot close')); });
    act(() => { captured[2].opts.onSuccess?.(); });
    expect(screen.queryByText('Cannot close')).not.toBeInTheDocument();
  });
});

describe('Setup page — createIterMut callbacks', () => {
  it('onSuccess closes the iteration form', async () => {
    const captured = captureMutations();
    const user = userEvent.setup();
    render(<Setup />);
    await user.click(screen.getByRole('button', { name: '+ Add' }));
    expect(screen.getByText('New Iteration')).toBeInTheDocument();
    act(() => { captured[3].opts.onSuccess?.(); });
    expect(screen.queryByText('New Iteration')).not.toBeInTheDocument();
  });

  it('onError shows error in the iteration form', async () => {
    const captured = captureMutations();
    const user = userEvent.setup();
    render(<Setup />);
    await user.click(screen.getByRole('button', { name: '+ Add' }));
    act(() => { captured[3].opts.onError?.(new Error('Create iter failed')); });
    expect(screen.getByText('Create iter failed')).toBeInTheDocument();
  });
});

describe('Setup page — deletePIMut callbacks', () => {
  it('onSuccess navigates to /pi', () => {
    const captured = captureMutations();
    render(<Setup />);
    act(() => { captured[5].opts.onSuccess?.(); });
    expect(mockNavigate).toHaveBeenCalledWith('/pi');
  });

  it('onError shows lifecycle error in the delete confirm section', async () => {
    const captured = captureMutations();
    const user = userEvent.setup();
    render(<Setup />);
    await user.click(screen.getByRole('button', { name: 'Delete PI' }));
    act(() => { captured[5].opts.onError?.(new Error('Delete PI failed')); });
    expect(screen.queryAllByText('Delete PI failed').length).toBeGreaterThan(0);
  });
});
