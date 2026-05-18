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
});
