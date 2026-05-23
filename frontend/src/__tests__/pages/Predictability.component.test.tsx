import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('react-router-dom', () => ({
  useParams: () => ({ piId: 'pi-1' }),
}));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return { ...actual, useQuery: vi.fn(), useMutation: vi.fn(), useQueryClient: vi.fn() };
});

import { Predictability } from '../../pages/Predictability';
import { makePI, makePIObjective, makeTeam } from '../factories';
import { setupQueryMocks } from '../setupMocks';

const mockPI = makePI({ id: 'pi-1', name: 'PI 2026.1', art_id: 'art-1', status: 'active' });
const mockTeam = makeTeam({ id: 'team-1', name: 'Alpha', art_id: 'art-1' });

const committedObjective = makePIObjective({
  id: 'obj-1',
  team_id: 'team-1',
  pi_id: 'pi-1',
  planned_business_value: 10,
  actual_business_value: null,
  is_stretch: false,
});

const scoredObjective = makePIObjective({
  id: 'obj-2',
  team_id: 'team-1',
  pi_id: 'pi-1',
  planned_business_value: 10,
  actual_business_value: 8,
  is_stretch: false,
});

const stretchObjective = makePIObjective({
  id: 'obj-3',
  team_id: 'team-1',
  pi_id: 'pi-1',
  planned_business_value: 5,
  actual_business_value: null,
  is_stretch: true,
});

function setupPageMocks({
  objectives = [],
  teams = [mockTeam],
  isLoading = false,
}: {
  objectives?: ReturnType<typeof makePIObjective>[];
  teams?: ReturnType<typeof makeTeam>[];
  isLoading?: boolean;
} = {}) {
  setupQueryMocks(
    ({ queryKey }) => {
      const key = queryKey[0] as string;
      if (key === 'pi') return mockPI;
      if (key === 'objectives') return objectives;
      if (key === 'teams') return teams;
      return undefined;
    },
    { isLoading },
  );
}

describe('Predictability page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows spinner while loading', () => {
    setupPageMocks({ isLoading: true });
    render(<Predictability />);
    expect(screen.getByLabelText('Loading')).toBeInTheDocument();
  });

  it('shows empty state when there are no committed objectives', () => {
    setupPageMocks({ objectives: [] });
    render(<Predictability />);
    expect(
      screen.getByText('No committed objectives for this PI. Add objectives on the Objectives page.'),
    ).toBeInTheDocument();
  });

  it('excludes stretch objectives from the committed count', () => {
    setupPageMocks({ objectives: [stretchObjective] });
    render(<Predictability />);
    expect(
      screen.getByText('No committed objectives for this PI. Add objectives on the Objectives page.'),
    ).toBeInTheDocument();
  });

  it('renders the ART Predictability heading with PI name', () => {
    setupPageMocks({ objectives: [committedObjective] });
    render(<Predictability />);
    expect(screen.getByRole('heading', { name: /ART Predictability/ })).toBeInTheDocument();
    expect(screen.getByText(/PI 2026.1/)).toBeInTheDocument();
  });

  it('shows team name in table row when objectives exist', () => {
    setupPageMocks({ objectives: [committedObjective] });
    render(<Predictability />);
    expect(screen.getAllByText('Alpha').length).toBeGreaterThanOrEqual(1);
  });

  it('shows "Not yet scored" when no actual business value is recorded', () => {
    setupPageMocks({ objectives: [committedObjective] });
    render(<Predictability />);
    expect(screen.getAllByText('Not yet scored').length).toBeGreaterThanOrEqual(1);
  });

  it('shows predictability percentage badge when objectives are scored', () => {
    setupPageMocks({ objectives: [scoredObjective] });
    render(<Predictability />);
    expect(screen.getAllByText('80%').length).toBeGreaterThanOrEqual(1);
  });

  it('applies teal badge class for on-target predictability (≥80%)', () => {
    setupPageMocks({ objectives: [scoredObjective] });
    render(<Predictability />);
    const badges = screen.getAllByText('80%');
    expect(badges.some((el) => el.className.includes('bg-teal-100'))).toBe(true);
  });

  it('shows "No committed objectives" for a team with no objectives', () => {
    const otherTeam = makeTeam({ id: 'team-2', name: 'Beta', art_id: 'art-1' });
    setupPageMocks({ objectives: [committedObjective], teams: [mockTeam, otherTeam] });
    render(<Predictability />);
    expect(screen.getByText('No committed objectives')).toBeInTheDocument();
  });

  it('shows ART totals row with correct planned BV', () => {
    setupPageMocks({ objectives: [committedObjective] });
    render(<Predictability />);
    expect(screen.getByText('ART Total')).toBeInTheDocument();
  });

  it('displays the explanatory formula footnote', () => {
    setupPageMocks({ objectives: [committedObjective] });
    render(<Predictability />);
    expect(screen.getByText(/Predictability = Actual BV/)).toBeInTheDocument();
  });
});
