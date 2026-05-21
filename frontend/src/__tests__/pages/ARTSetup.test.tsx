import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ARTSetup } from '../../pages/ARTSetup';

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useQueryClient: vi.fn(),
}));

vi.mock('../../api', () => ({
  api: {
    listARTs: vi.fn(),
    createART: vi.fn(),
    updateART: vi.fn(),
    deleteART: vi.fn(),
  },
}));

vi.mock('../../components/Toaster', () => ({
  useToast: () => vi.fn(),
}));

vi.mock('../../components/Spinner', () => ({
  Spinner: () => <div>Loading…</div>,
}));

const mockArts = [
  { id: 'art-1', name: 'Platform ART', team_ids: ['t1', 't2'] },
  { id: 'art-2', name: 'Billing ART', team_ids: [] },
];

function setupMocks(overrides: { isLoading?: boolean; arts?: typeof mockArts } = {}) {
  vi.mocked(useQueryClient).mockReturnValue({ invalidateQueries: vi.fn() } as unknown as ReturnType<typeof useQueryClient>);
  vi.mocked(useMutation).mockReturnValue({ mutate: vi.fn(), isPending: false } as unknown as ReturnType<typeof useMutation>);
  vi.mocked(useQuery).mockReturnValue({
    data: overrides.arts ?? mockArts,
    isLoading: overrides.isLoading ?? false,
  } as unknown as ReturnType<typeof useQuery>);
}

beforeEach(() => {
  vi.clearAllMocks();
  setupMocks();
});

describe('ARTSetup', () => {
  it('shows loading spinner while data is loading', () => {
    setupMocks({ isLoading: true });
    render(<ARTSetup />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('renders the ART list', () => {
    render(<ARTSetup />);
    expect(screen.getByText('Platform ART')).toBeInTheDocument();
    expect(screen.getByText('Billing ART')).toBeInTheDocument();
  });

  it('shows team count for each ART', () => {
    render(<ARTSetup />);
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('shows empty message when no ARTs exist', () => {
    setupMocks({ arts: [] });
    render(<ARTSetup />);
    expect(screen.getByText(/No ARTs yet/)).toBeInTheDocument();
  });

  it('opens the add form when "+ Add ART" is clicked', async () => {
    const user = userEvent.setup();
    render(<ARTSetup />);
    await user.click(screen.getByText('+ Add ART'));
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add ART' })).toBeInTheDocument();
  });

  it('shows validation error when submitting an empty name in add form', async () => {
    const user = userEvent.setup();
    render(<ARTSetup />);
    await user.click(screen.getByText('+ Add ART'));
    await user.click(screen.getByRole('button', { name: 'Add ART' }));
    expect(screen.getByText('Name is required.')).toBeInTheDocument();
  });

  it('cancels the add form when Cancel is clicked', async () => {
    const user = userEvent.setup();
    render(<ARTSetup />);
    await user.click(screen.getByText('+ Add ART'));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
  });

  it('opens inline edit form when Edit is clicked', async () => {
    const user = userEvent.setup();
    render(<ARTSetup />);
    const editButtons = screen.getAllByRole('button', { name: 'Edit' });
    await user.click(editButtons[0]);
    expect(screen.getByRole('textbox', { name: 'ART name' })).toBeInTheDocument();
  });

  it('shows validation error when saving an empty name in edit form', async () => {
    const user = userEvent.setup();
    render(<ARTSetup />);
    await user.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
    const input = screen.getByRole('textbox', { name: 'ART name' });
    await user.clear(input);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Name is required.')).toBeInTheDocument();
  });

  it('cancels the edit form when Cancel is clicked', async () => {
    const user = userEvent.setup();
    render(<ARTSetup />);
    await user.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('textbox', { name: 'ART name' })).not.toBeInTheDocument();
  });

  it('shows delete confirmation when Delete is clicked', async () => {
    const user = userEvent.setup();
    render(<ARTSetup />);
    await user.click(screen.getAllByRole('button', { name: 'Delete' })[0]);
    expect(screen.getByText(/Yes, delete/)).toBeInTheDocument();
  });

  it('cancels delete confirmation when Cancel is clicked', async () => {
    const user = userEvent.setup();
    render(<ARTSetup />);
    await user.click(screen.getAllByRole('button', { name: 'Delete' })[0]);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText(/Yes, delete/)).not.toBeInTheDocument();
  });

  it('calls mutate when confirming delete', async () => {
    const mutate = vi.fn();
    vi.mocked(useMutation).mockReturnValue({ mutate, isPending: false } as unknown as ReturnType<typeof useMutation>);
    const user = userEvent.setup();
    render(<ARTSetup />);
    await user.click(screen.getAllByRole('button', { name: 'Delete' })[0]);
    await user.click(screen.getByRole('button', { name: 'Yes, delete' }));
    expect(mutate).toHaveBeenCalled();
  });

  it('calls mutate when saving a valid edit', async () => {
    const mutate = vi.fn();
    vi.mocked(useMutation).mockReturnValue({ mutate, isPending: false } as unknown as ReturnType<typeof useMutation>);
    const user = userEvent.setup();
    render(<ARTSetup />);
    await user.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(mutate).toHaveBeenCalled();
  });

  it('renders gracefully when data fails to load (isError)', () => {
    vi.mocked(useQuery).mockReturnValue({ data: undefined, isLoading: false, isError: true } as unknown as ReturnType<typeof useQuery>);
    render(<ARTSetup />);
    expect(screen.getByText(/No ARTs yet/)).toBeInTheDocument();
  });

  it('shows add-form error message when create mutation fails', async () => {
    setupMocks();
    const onErrors: Array<(e: Error) => void> = [];
    vi.mocked(useMutation).mockImplementation((opts: any) => {
      if (opts?.onError) onErrors.push(opts.onError);
      return { mutate: vi.fn(), isPending: false } as unknown as ReturnType<typeof useMutation>;
    });
    const user = userEvent.setup();
    render(<ARTSetup />);
    await user.click(screen.getByText('+ Add ART'));
    act(() => { onErrors[1]?.(new Error('Name already taken')); }); // createMut is 2nd (after updateMut)
    expect(screen.getByText('Name already taken')).toBeInTheDocument();
  });
});
