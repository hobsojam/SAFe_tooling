import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('react-router-dom', () => ({
  useParams: () => ({ piId: 'pi-1' }),
  useNavigate: () => vi.fn(),
}));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return { ...actual, useQuery: vi.fn(), useMutation: vi.fn(), useQueryClient: vi.fn() };
});

vi.mock('../../components/Toaster', () => ({ useToast: () => vi.fn() }));

const apiMocks = vi.hoisted(() => ({
  updatePI: vi.fn(),
  activatePI: vi.fn(),
  closePI: vi.fn(),
  createIteration: vi.fn(),
  deleteIteration: vi.fn(),
  deletePI: vi.fn(),
}));

vi.mock('../../api', () => ({ api: apiMocks }));

import { useMutation } from '@tanstack/react-query';
import { Setup } from '../../pages/Setup';
import { makeIteration, makePI } from '../factories';
import { setupQueryMocks } from '../setupMocks';

const mockPI = makePI({
  id: 'pi-1',
  name: 'PI 2026.1',
  status: 'planning',
  start_date: '2026-01-05',
  end_date: '2026-03-27',
});
const mockIteration = makeIteration({
  id: 'iter-1',
  pi_id: 'pi-1',
  number: 1,
  name: 'Iteration 1',
  start_date: '2026-01-05',
  end_date: '2026-01-16',
});

function setupPageMocks({
  pi = mockPI,
  iterations = [],
  isPending = false,
  isLoading = false,
}: {
  pi?: ReturnType<typeof makePI>;
  iterations?: ReturnType<typeof makeIteration>[];
  isPending?: boolean;
  isLoading?: boolean;
} = {}) {
  return setupQueryMocks(
    ({ queryKey }) => {
      const key = queryKey[0] as string;
      if (key === 'pi') return pi;
      if (key === 'iterations') return iterations;
      return undefined;
    },
    { isPending, isLoading },
  );
}

describe('Setup page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows spinner while loading', () => {
    setupPageMocks({ isLoading: true });
    render(<Setup />);
    expect(screen.getByLabelText('Loading')).toBeInTheDocument();
  });

  it('renders "PI Setup" heading when data is loaded', () => {
    setupPageMocks();
    render(<Setup />);
    expect(screen.getByRole('heading', { name: 'PI Setup' })).toBeInTheDocument();
  });

  it('shows PI name and dates in the details section', () => {
    setupPageMocks();
    render(<Setup />);
    expect(screen.getByText('PI 2026.1')).toBeInTheDocument();
    expect(screen.getByText('2026-01-05 – 2026-03-27')).toBeInTheDocument();
  });

  it('clicking Edit opens the edit form with a Name input', async () => {
    setupPageMocks();
    const user = userEvent.setup();
    render(<Setup />);
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('shows validation error when name is cleared before saving', async () => {
    setupPageMocks();
    const user = userEvent.setup();
    render(<Setup />);
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const nameInput = screen.getByLabelText('Name');
    await user.clear(nameInput);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Name is required.')).toBeInTheDocument();
  });

  it('Cancel in edit form restores the read-only view', async () => {
    setupPageMocks();
    const user = userEvent.setup();
    render(<Setup />);
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText('PI 2026.1')).toBeInTheDocument();
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
  });

  it('shows "Saving…" on Save button when mutation isPending', async () => {
    setupPageMocks({ isPending: true });
    const user = userEvent.setup();
    render(<Setup />);
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeInTheDocument();
  });

  it('shows empty state message when no iterations', () => {
    setupPageMocks({ iterations: [] });
    render(<Setup />);
    expect(screen.getByText('No iterations yet. Add one to start planning.')).toBeInTheDocument();
  });

  it('shows iterations table with data when iterations exist', () => {
    setupPageMocks({ iterations: [mockIteration] });
    render(<Setup />);
    expect(screen.getByText('Iteration 1')).toBeInTheDocument();
    expect(screen.getByText('2026-01-05')).toBeInTheDocument();
  });

  it('clicking "+ Add" reveals the new iteration form', async () => {
    setupPageMocks();
    const user = userEvent.setup();
    render(<Setup />);
    await user.click(screen.getByRole('button', { name: '+ Add' }));
    expect(screen.getByText('New Iteration')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Iteration' })).toBeInTheDocument();
  });

  it('shows validation error when iteration dates are missing on submit', async () => {
    setupPageMocks();
    const user = userEvent.setup();
    render(<Setup />);
    await user.click(screen.getByRole('button', { name: '+ Add' }));
    await user.click(screen.getByRole('button', { name: 'Add Iteration' }));
    expect(screen.getByText('Start and end dates are required.')).toBeInTheDocument();
  });

  it('submits a new iteration with the current PI id', async () => {
    const { mutate } = setupPageMocks();
    const user = userEvent.setup();
    render(<Setup />);
    await user.click(screen.getByRole('button', { name: '+ Add' }));
    await user.type(screen.getByLabelText('Name (optional)'), 'Iteration 2');
    await user.clear(screen.getByLabelText('Number'));
    await user.type(screen.getByLabelText('Number'), '2');
    await user.type(screen.getByLabelText('Start Date'), '2026-01-19');
    await user.type(screen.getByLabelText('End Date'), '2026-01-30');
    await user.click(screen.getByRole('button', { name: 'Add Iteration' }));
    expect(mutate).toHaveBeenCalledWith({
      pi_id: 'pi-1',
      name: 'Iteration 2',
      number: 2,
      start_date: '2026-01-19',
      end_date: '2026-01-30',
      is_ip: false,
    });
  });

  it('binds PI lifecycle mutations to the current PI id', async () => {
    setupPageMocks();
    const mutationFns: Array<(value?: unknown) => unknown> = [];
    vi.mocked(useMutation).mockImplementation((opts: any) => {
      if (opts?.mutationFn) mutationFns.push(opts.mutationFn);
      return { mutate: vi.fn(), isPending: false } as any;
    });
    apiMocks.updatePI.mockResolvedValue(mockPI);
    apiMocks.activatePI.mockResolvedValue(mockPI);
    apiMocks.closePI.mockResolvedValue(mockPI);
    apiMocks.deletePI.mockResolvedValue(undefined);

    render(<Setup />);
    await mutationFns[0]?.({ name: 'Updated PI' });
    await mutationFns[1]?.();
    await mutationFns[2]?.();
    await mutationFns[5]?.();

    expect(apiMocks.updatePI).toHaveBeenCalledWith('pi-1', { name: 'Updated PI' });
    expect(apiMocks.activatePI).toHaveBeenCalledWith('pi-1');
    expect(apiMocks.closePI).toHaveBeenCalledWith('pi-1');
    expect(apiMocks.deletePI).toHaveBeenCalledWith('pi-1');
  });

  it('Activate button is enabled for a planning PI', () => {
    setupPageMocks({ pi: { ...mockPI, status: 'planning' } });
    render(<Setup />);
    expect(screen.getByRole('button', { name: 'Activate' })).not.toBeDisabled();
  });

  it('Close button is disabled for a planning PI', () => {
    setupPageMocks({ pi: { ...mockPI, status: 'planning' } });
    render(<Setup />);
    expect(screen.getByRole('button', { name: 'Close' })).toBeDisabled();
  });

  it('Close button is enabled for an active PI', () => {
    setupPageMocks({ pi: { ...mockPI, status: 'active' } });
    render(<Setup />);
    expect(screen.getByRole('button', { name: 'Close' })).not.toBeDisabled();
  });

  it('shows closed lifecycle hint for a closed PI', () => {
    setupPageMocks({ pi: { ...mockPI, status: 'closed' } });
    render(<Setup />);
    expect(screen.getByText('This PI is closed and cannot be transitioned further.')).toBeInTheDocument();
  });

  it('clicking "Delete PI" shows the confirmation prompt', async () => {
    setupPageMocks();
    const user = userEvent.setup();
    render(<Setup />);
    await user.click(screen.getByRole('button', { name: 'Delete PI' }));
    expect(screen.getByText('Are you sure? This cannot be undone.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Yes, delete' })).toBeInTheDocument();
  });

  it('Cancel in delete confirm restores the delete button', async () => {
    setupPageMocks();
    const user = userEvent.setup();
    render(<Setup />);
    await user.click(screen.getByRole('button', { name: 'Delete PI' }));
    const cancelButtons = screen.getAllByRole('button', { name: 'Cancel' });
    await user.click(cancelButtons[0]);
    expect(screen.getByRole('button', { name: 'Delete PI' })).toBeInTheDocument();
  });
});
