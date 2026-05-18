import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Setup } from '../../pages/Setup';
import { makeIteration, makePI } from '../factories';

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useQueryClient: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ piId: 'pi-1' }),
  useNavigate: () => vi.fn(),
}));

vi.mock('../../api', () => ({
  api: {
    getPI: vi.fn(),
    listIterations: vi.fn(),
    updatePI: vi.fn(),
    activatePI: vi.fn(),
    closePI: vi.fn(),
    createIteration: vi.fn(),
    deleteIteration: vi.fn(),
    deletePI: vi.fn(),
  },
}));

vi.mock('../../components/Toaster', () => ({
  useToast: () => vi.fn(),
}));

vi.mock('../../components/Spinner', () => ({
  Spinner: () => <div>Loading…</div>,
}));

vi.mock('../../components/Badge', () => ({
  PIStatusBadge: ({ status }: { status: string }) => <span>{status}</span>,
}));

const mockPI = makePI({ id: 'pi-1', name: 'PI 2026.1', status: 'planning', start_date: '2026-01-05', end_date: '2026-03-27' });
const mockIterations = [
  makeIteration({ id: 'iter-1', pi_id: 'pi-1', number: 1, name: 'Iteration 1', start_date: '2026-01-05', end_date: '2026-01-16', is_ip: false }),
  makeIteration({ id: 'iter-2', pi_id: 'pi-1', number: 2, name: 'Iteration 2', start_date: '2026-01-19', end_date: '2026-01-30', is_ip: false }),
];

function setupMocks(overrides: {
  isLoading?: boolean;
  pi?: typeof mockPI;
  iterations?: typeof mockIterations;
} = {}) {
  vi.mocked(useQueryClient).mockReturnValue({ invalidateQueries: vi.fn() } as unknown as ReturnType<typeof useQueryClient>);
  vi.mocked(useMutation).mockReturnValue({ mutate: vi.fn(), isPending: false } as unknown as ReturnType<typeof useMutation>);
  vi.mocked(useQuery).mockImplementation(({ queryKey }: Parameters<typeof useQuery>[0]) => {
    const key = (queryKey as string[])[0];
    if (overrides.isLoading && key === 'pi') {
      return { data: undefined, isLoading: true } as unknown as ReturnType<typeof useQuery>;
    }
    if (key === 'pi') return { data: overrides.pi ?? mockPI, isLoading: false } as unknown as ReturnType<typeof useQuery>;
    if (key === 'iterations') return { data: overrides.iterations ?? mockIterations, isLoading: false } as unknown as ReturnType<typeof useQuery>;
    return { data: undefined, isLoading: false } as unknown as ReturnType<typeof useQuery>;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setupMocks();
});

describe('Setup', () => {
  it('shows loading spinner while PI data is loading', () => {
    setupMocks({ isLoading: true });
    render(<Setup />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('renders the page heading', () => {
    render(<Setup />);
    expect(screen.getByText('PI Setup')).toBeInTheDocument();
  });

  it('renders PI details — name, status, dates', () => {
    render(<Setup />);
    expect(screen.getByText('PI 2026.1')).toBeInTheDocument();
    expect(screen.getByText('planning')).toBeInTheDocument();
    expect(screen.getAllByText(/2026-01-05/).length).toBeGreaterThan(0);
  });

  it('renders the iterations table', () => {
    render(<Setup />);
    expect(screen.getByText('Iteration 1')).toBeInTheDocument();
    expect(screen.getByText('Iteration 2')).toBeInTheDocument();
  });

  it('shows "no iterations" message when list is empty', () => {
    setupMocks({ iterations: [] });
    render(<Setup />);
    expect(screen.getByText(/No iterations yet/)).toBeInTheDocument();
  });

  it('shows Activate button enabled in planning status', () => {
    render(<Setup />);
    const activateBtn = screen.getByRole('button', { name: 'Activate' });
    expect(activateBtn).not.toBeDisabled();
  });

  it('shows Close button disabled in planning status', () => {
    render(<Setup />);
    const closeBtn = screen.getByRole('button', { name: 'Close' });
    expect(closeBtn).toBeDisabled();
  });

  it('shows Close button enabled in active status', () => {
    setupMocks({ pi: makePI({ ...mockPI, status: 'active' }) });
    render(<Setup />);
    const closeBtn = screen.getByRole('button', { name: 'Close' });
    expect(closeBtn).not.toBeDisabled();
  });

  it('shows appropriate lifecycle hint for planning status', () => {
    render(<Setup />);
    expect(screen.getByText(/Activate when PI Planning is complete/)).toBeInTheDocument();
  });

  it('opens the edit details form when Edit is clicked', async () => {
    const user = userEvent.setup();
    render(<Setup />);
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
  });

  it('cancels edit details form when Cancel is clicked', async () => {
    const user = userEvent.setup();
    render(<Setup />);
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
  });

  it('shows validation error when saving details with empty name', async () => {
    const user = userEvent.setup();
    render(<Setup />);
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const nameInput = screen.getByLabelText('Name');
    await user.clear(nameInput);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Name is required.')).toBeInTheDocument();
  });

  it('opens the add iteration form when "+ Add" is clicked', async () => {
    const user = userEvent.setup();
    render(<Setup />);
    await user.click(screen.getByRole('button', { name: '+ Add' }));
    expect(screen.getByText('New Iteration')).toBeInTheDocument();
  });

  it('shows validation error when submitting iteration without dates', async () => {
    const user = userEvent.setup();
    render(<Setup />);
    await user.click(screen.getByRole('button', { name: '+ Add' }));
    await user.click(screen.getByRole('button', { name: 'Add Iteration' }));
    expect(screen.getByText('Start and end dates are required.')).toBeInTheDocument();
  });

  it('cancels add iteration form when Cancel is clicked', async () => {
    const user = userEvent.setup();
    render(<Setup />);
    await user.click(screen.getByRole('button', { name: '+ Add' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('New Iteration')).not.toBeInTheDocument();
  });

  it('shows Delete PI button in danger zone', () => {
    render(<Setup />);
    expect(screen.getByRole('button', { name: 'Delete PI' })).toBeInTheDocument();
  });

  it('shows delete confirmation when "Delete PI" is clicked', async () => {
    const user = userEvent.setup();
    render(<Setup />);
    await user.click(screen.getByRole('button', { name: 'Delete PI' }));
    expect(screen.getByText(/Are you sure/)).toBeInTheDocument();
  });

  it('cancels delete confirmation when Cancel is clicked', async () => {
    const user = userEvent.setup();
    render(<Setup />);
    await user.click(screen.getByRole('button', { name: 'Delete PI' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText(/Are you sure/)).not.toBeInTheDocument();
  });

  it('calls delete mutate when "Yes, delete" is confirmed', async () => {
    const mutate = vi.fn();
    vi.mocked(useMutation).mockReturnValue({ mutate, isPending: false } as unknown as ReturnType<typeof useMutation>);
    const user = userEvent.setup();
    render(<Setup />);
    await user.click(screen.getByRole('button', { name: 'Delete PI' }));
    await user.click(screen.getByRole('button', { name: 'Yes, delete' }));
    expect(mutate).toHaveBeenCalled();
  });
});
