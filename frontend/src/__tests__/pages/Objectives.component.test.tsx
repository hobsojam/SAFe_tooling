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

import { Objectives } from '../../pages/Objectives';

type PIObjective = {
  id: string;
  description: string;
  team_id: string;
  pi_id: string;
  planned_business_value: number;
  actual_business_value: number | null;
  is_stretch: boolean;
  feature_ids: string[];
  is_committed: boolean;
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

const committedObjective: PIObjective = {
  id: 'obj-1',
  description: 'Deliver auth service',
  team_id: 'team-1',
  pi_id: 'pi-1',
  planned_business_value: 8,
  actual_business_value: null,
  is_stretch: false,
  feature_ids: [],
  is_committed: true,
};

const stretchObjective: PIObjective = {
  id: 'obj-2',
  description: 'Stretch: mobile enhancements',
  team_id: 'team-1',
  pi_id: 'pi-1',
  planned_business_value: 4,
  actual_business_value: null,
  is_stretch: true,
  feature_ids: [],
  is_committed: false,
};

function setupMocks({
  objectives = [] as PIObjective[],
  teams = mockTeams,
  isPending = false,
}: {
  objectives?: PIObjective[];
  teams?: Team[];
  isPending?: boolean;
} = {}) {
  vi.mocked(useQueryClient).mockReturnValue({ invalidateQueries: vi.fn() } as any);
  vi.mocked(useMutation).mockReturnValue({ mutate: vi.fn(), isPending } as any);
  vi.mocked(useQuery).mockImplementation((opts: any) => {
    const key = opts.queryKey[0];
    if (key === 'pi') return { data: mockPI } as any;
    if (key === 'objectives') return { data: objectives, isLoading: false } as any;
    if (key === 'teams') return { data: teams } as any;
    return { data: undefined, isLoading: false } as any;
  });
}

describe('Objectives page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders committed and stretch objectives with correct badge labels', () => {
    setupMocks({ objectives: [committedObjective, stretchObjective] });
    render(<Objectives />);
    // Both mobile and desktop sections render; check label text
    const committedLabels = screen.getAllByText('Committed');
    expect(committedLabels.length).toBeGreaterThanOrEqual(1);
    const stretchLabels = screen.getAllByText('Stretch');
    expect(stretchLabels.length).toBeGreaterThanOrEqual(1);
  });

  it('applies the correct badge class for stretch objective in mobile card list', () => {
    setupMocks({ objectives: [stretchObjective] });
    render(<Objectives />);
    // Find all "Stretch" text nodes; at least one should have the purple bg class
    const stretchBadges = screen.getAllByText('Stretch');
    const hasPurple = stretchBadges.some((el) => el.className.includes('bg-purple-100'));
    expect(hasPurple).toBe(true);
  });

  it('applies the correct badge class for committed objective in mobile card list', () => {
    setupMocks({ objectives: [committedObjective] });
    render(<Objectives />);
    const committedBadges = screen.getAllByText('Committed');
    const hasBlue = committedBadges.some((el) => el.className.includes('bg-blue-100'));
    expect(hasBlue).toBe(true);
  });

  it('opens modal and shows "Add Objective" on submit button', async () => {
    setupMocks({ objectives: [] });
    const user = userEvent.setup();
    render(<Objectives />);
    await user.click(screen.getByRole('button', { name: '+ New Objective' }));
    expect(screen.getByRole('button', { name: 'Add Objective' })).toBeInTheDocument();
  });

  it('opens edit modal and shows "Save Changes" on submit button', async () => {
    setupMocks({ objectives: [committedObjective] });
    const user = userEvent.setup();
    render(<Objectives />);
    const editButtons = screen.getAllByRole('button', { name: 'Edit' });
    await user.click(editButtons[0]);
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument();
  });

  it('shows "Saving…" on submit button when mutation isPending', async () => {
    setupMocks({ objectives: [], isPending: true });
    const user = userEvent.setup();
    render(<Objectives />);
    await user.click(screen.getByRole('button', { name: '+ New Objective' }));
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeInTheDocument();
  });
});
