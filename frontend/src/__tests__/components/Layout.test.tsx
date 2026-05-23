import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Layout } from '../../components/Layout';

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useQueryClient: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ piId: 'pi-1' }),
  useLocation: () => ({ pathname: '/pi/pi-1/board' }),
  useNavigate: () => vi.fn(),
  NavLink: ({ children, to, className }: { children: React.ReactNode; to: string; className: ((args: { isActive: boolean }) => string) | string }) => {
    const cls = typeof className === 'function' ? className({ isActive: false }) : className;
    return <a href={to} className={cls}>{children}</a>;
  },
  Outlet: () => <div data-testid="outlet">page content</div>,
}));

vi.mock('../../api', () => ({
  api: {
    listPIs: vi.fn(),
    listARTs: vi.fn(),
    createPI: vi.fn(),
  },
}));

vi.mock('./Toaster', () => ({
  useToast: () => vi.fn(),
}));

vi.mock('../../components/Toaster', () => ({
  useToast: () => vi.fn(),
}));

vi.mock('./Modal', () => ({
  Modal: ({ open, title, children }: { open: boolean; title: string; children: React.ReactNode }) =>
    open ? <div role="dialog" aria-label={title}>{children}</div> : null,
}));

vi.mock('./Badge', () => ({
  PIStatusBadge: ({ status }: { status: string }) => <span>{status}</span>,
}));

const mockPIs = [
  { id: 'pi-1', name: 'PI 2026.1', status: 'active', art_id: 'art-1', start_date: '2026-01-05', end_date: '2026-03-27', iteration_ids: [] },
  { id: 'pi-2', name: 'PI 2026.2', status: 'planning', art_id: 'art-1', start_date: '2026-04-06', end_date: '2026-06-26', iteration_ids: [] },
];
const mockARTs = [{ id: 'art-1', name: 'Platform ART', team_ids: [] }];

function setupMocks(overrides: { pis?: typeof mockPIs; arts?: typeof mockARTs } = {}) {
  vi.mocked(useQueryClient).mockReturnValue({ invalidateQueries: vi.fn() } as unknown as ReturnType<typeof useQueryClient>);
  vi.mocked(useMutation).mockReturnValue({ mutate: vi.fn(), isPending: false } as unknown as ReturnType<typeof useMutation>);
  vi.mocked(useQuery).mockImplementation(({ queryKey }: Parameters<typeof useQuery>[0]) => {
    const key = (queryKey as string[])[0];
    if (key === 'pis') return { data: overrides.pis ?? mockPIs } as unknown as ReturnType<typeof useQuery>;
    if (key === 'arts') return { data: overrides.arts ?? mockARTs } as unknown as ReturnType<typeof useQuery>;
    return { data: [] } as unknown as ReturnType<typeof useQuery>;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setupMocks();
});

describe('Layout', () => {
  it('renders the SAFe Tools brand label', () => {
    render(<Layout />);
    expect(screen.getAllByText('SAFe Tools').length).toBeGreaterThan(0);
  });

  it('renders the PI selector with PI options', () => {
    render(<Layout />);
    expect(screen.getByRole('combobox', { name: 'Program Increment' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'PI 2026.1' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'PI 2026.2' })).toBeInTheDocument();
  });

  it('renders nav links for the active PI', () => {
    render(<Layout />);
    expect(screen.getByRole('link', { name: 'PI Health' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Board' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Backlog' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Risks' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dependencies' })).toBeInTheDocument();
  });

  it('renders compact section headings for secondary navigation', () => {
    render(<Layout />);
    expect(screen.getByText('Planning')).toBeInTheDocument();
    expect(screen.getByText('Ceremonies')).toBeInTheDocument();
    expect(screen.getByText('Setup')).toBeInTheDocument();
  });

  it('renders core PI workflow links as top-level primary links', () => {
    render(<Layout />);
    expect(screen.getByRole('link', { name: 'PI Health' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Board' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Backlog' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Risks' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dependencies' })).toBeInTheDocument();
  });

  it('renders planning links after expanding the Planning section', async () => {
    const user = userEvent.setup();
    render(<Layout />);
    await user.click(screen.getByText('Planning'));
    expect(screen.getByRole('link', { name: 'Stories' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Objectives' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Capacity' })).toBeInTheDocument();
  });

  it('renders all ceremony links after expanding the Ceremonies section', async () => {
    const user = userEvent.setup();
    render(<Layout />);
    await user.click(screen.getByText('Ceremonies'));
    expect(screen.getByRole('link', { name: 'ART Sync' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Predictability' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Inspect & Adapt' })).toBeInTheDocument();
  });

  it('renders setup links after expanding the Setup section', async () => {
    const user = userEvent.setup();
    render(<Layout />);
    await user.click(screen.getByText('Setup'));
    expect(screen.getByRole('link', { name: 'PI Setup' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Team Setup' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'ART Setup' })).toBeInTheDocument();
  });

  it('renders the "+ New PI" button', () => {
    render(<Layout />);
    expect(screen.getByRole('button', { name: '+ New PI' })).toBeInTheDocument();
  });

  it('renders the outlet (page content)', () => {
    render(<Layout />);
    expect(screen.getByTestId('outlet')).toBeInTheDocument();
  });

  it('shows PI status badge for the active PI', () => {
    render(<Layout />);
    expect(screen.getByText('active')).toBeInTheDocument();
  });

  it('opens the New PI modal when "+ New PI" is clicked', async () => {
    const user = userEvent.setup();
    render(<Layout />);
    await user.click(screen.getByRole('button', { name: '+ New PI' }));
    expect(screen.getByRole('dialog', { name: 'New Program Increment' })).toBeInTheDocument();
  });

  it('shows ART options in the New PI modal', async () => {
    const user = userEvent.setup();
    render(<Layout />);
    await user.click(screen.getByRole('button', { name: '+ New PI' }));
    expect(screen.getByRole('option', { name: 'Platform ART' })).toBeInTheDocument();
  });

  it('shows "No ARTs found" hint when there are no ARTs', async () => {
    setupMocks({ arts: [] });
    const user = userEvent.setup();
    render(<Layout />);
    await user.click(screen.getByRole('button', { name: '+ New PI' }));
    expect(screen.getByText(/No ARTs found/)).toBeInTheDocument();
  });

  it('shows validation error when submitting PI form with empty name', async () => {
    const user = userEvent.setup();
    render(<Layout />);
    await user.click(screen.getByRole('button', { name: '+ New PI' }));
    await user.click(screen.getByRole('button', { name: 'Create PI' }));
    expect(screen.getByText('Name is required.')).toBeInTheDocument();
  });

  it('shows validation error when ART is not selected', async () => {
    setupMocks({ arts: [] });
    const user = userEvent.setup();
    render(<Layout />);
    await user.click(screen.getByRole('button', { name: '+ New PI' }));
    const nameInput = screen.getByLabelText(/^Name/);
    await user.type(nameInput, 'PI 2026.3');
    await user.click(screen.getByRole('button', { name: 'Create PI' }));
    expect(screen.getByText('ART is required.')).toBeInTheDocument();
  });

  it('closes the PI modal when Cancel is clicked', async () => {
    const user = userEvent.setup();
    render(<Layout />);
    await user.click(screen.getByRole('button', { name: '+ New PI' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders the Open navigation button on mobile header', () => {
    render(<Layout />);
    expect(screen.getByRole('button', { name: 'Open navigation' })).toBeInTheDocument();
  });

  it('opens the mobile sidebar when the hamburger button is clicked', async () => {
    const user = userEvent.setup();
    render(<Layout />);
    await user.click(screen.getByRole('button', { name: 'Open navigation' }));
    expect(screen.getByRole('button', { name: 'Close navigation' })).toBeInTheDocument();
  });

  it('closes the sidebar when the backdrop is clicked', async () => {
    const user = userEvent.setup();
    render(<Layout />);
    await user.click(screen.getByRole('button', { name: 'Open navigation' }));
    await user.click(screen.getByRole('button', { name: 'Close navigation' }));
    expect(screen.queryByRole('button', { name: 'Close navigation' })).not.toBeInTheDocument();
  });
});
