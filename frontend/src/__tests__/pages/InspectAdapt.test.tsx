import { render, screen } from '@testing-library/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InspectAdapt } from '../../pages/InspectAdapt';
import { makePI, makeTeam, makePIObjective, makeRisk } from '../factories';

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useQueryClient: vi.fn(),
}));

vi.mock('../../components/Toaster', () => ({ useToast: () => vi.fn() }));

vi.mock('../../components/Modal', () => ({
  Modal: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div role="dialog">{children}</div> : null,
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ piId: 'pi-1' }),
}));

vi.mock('../../api', () => ({
  api: {
    getPI: vi.fn(),
    listObjectives: vi.fn(),
    listRisks: vi.fn(),
    listTeamsByArt: vi.fn(),
  },
}));

vi.mock('../../components/Spinner', () => ({
  Spinner: () => <div>Loading…</div>,
}));

vi.mock('../../components/EmptyState', () => ({
  EmptyState: ({ message }: { message: string }) => <div>{message}</div>,
}));

const mockPI = makePI({ id: 'pi-1', name: 'PI 2026.1', art_id: 'art-1' });
const mockTeams = [
  makeTeam({ id: 'team-1', name: 'Alpha', art_id: 'art-1' }),
  makeTeam({ id: 'team-2', name: 'Beta', art_id: 'art-1' }),
];
const mockObjectives = [
  makePIObjective({ id: 'obj-1', team_id: 'team-1', pi_id: 'pi-1', planned_business_value: 8, actual_business_value: 8, is_stretch: false }),
  makePIObjective({ id: 'obj-2', team_id: 'team-2', pi_id: 'pi-1', planned_business_value: 4, actual_business_value: null, is_stretch: false }),
  makePIObjective({ id: 'obj-3', team_id: 'team-1', pi_id: 'pi-1', planned_business_value: 3, actual_business_value: null, is_stretch: true }),
];
const mockRisks = [
  makeRisk({ id: 'risk-1', pi_id: 'pi-1', roam_status: 'resolved' }),
  makeRisk({ id: 'risk-2', pi_id: 'pi-1', roam_status: 'owned' }),
  makeRisk({ id: 'risk-3', pi_id: 'pi-1', roam_status: 'unroamed' }),
];

function setupMocks(overrides: {
  isLoading?: boolean;
  objectives?: typeof mockObjectives;
  risks?: typeof mockRisks;
  teams?: typeof mockTeams;
} = {}) {
  vi.mocked(useQueryClient).mockReturnValue({ invalidateQueries: vi.fn() } as any);
  vi.mocked(useMutation).mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
  vi.mocked(useQuery).mockImplementation(({ queryKey }: Parameters<typeof useQuery>[0]) => {
    if (overrides.isLoading) {
      return { data: undefined, isLoading: true } as unknown as ReturnType<typeof useQuery>;
    }
    const key = (queryKey as string[])[0];
    if (key === 'pi') return { data: mockPI, isLoading: false } as unknown as ReturnType<typeof useQuery>;
    if (key === 'objectives') return { data: overrides.objectives ?? mockObjectives, isLoading: false } as unknown as ReturnType<typeof useQuery>;
    if (key === 'risks') return { data: overrides.risks ?? mockRisks, isLoading: false } as unknown as ReturnType<typeof useQuery>;
    if (key === 'teams') return { data: overrides.teams ?? mockTeams, isLoading: false } as unknown as ReturnType<typeof useQuery>;
    if (key === 'improvement-actions') return { data: [], isLoading: false } as unknown as ReturnType<typeof useQuery>;
    return { data: undefined, isLoading: false } as unknown as ReturnType<typeof useQuery>;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setupMocks();
});

describe('InspectAdapt', () => {
  it('shows loading spinner while data is loading', () => {
    setupMocks({ isLoading: true });
    render(<InspectAdapt />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('renders the page title with PI name', () => {
    render(<InspectAdapt />);
    expect(screen.getByText(/Inspect & Adapt/)).toBeInTheDocument();
    expect(screen.getByText(/PI 2026\.1/)).toBeInTheDocument();
  });

  it('shows all section headings', () => {
    render(<InspectAdapt />);
    expect(screen.getByText('ART Predictability')).toBeInTheDocument();
    expect(screen.getByText('PI Objectives')).toBeInTheDocument();
    expect(screen.getByText('Risk Disposition (ROAM)')).toBeInTheDocument();
    expect(screen.getByText('Problem-Solving Workshop')).toBeInTheDocument();
  });

  it('renders predictability stat cards with correct values', () => {
    render(<InspectAdapt />);
    // "Planned BV" and "Actual BV" appear in both the stat card and the objectives table header
    expect(screen.getAllByText('Planned BV').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Actual BV').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Objectives Scored')).toBeInTheDocument();
    expect(screen.getByText('Predictability')).toBeInTheDocument();
    // committed: obj-1 (planned=8, actual=8), obj-2 (planned=4, actual=null)
    // predictability = round(8/12*100) = 67%
    expect(screen.getByText('67%')).toBeInTheDocument();
  });

  it('shows empty state for predictability when no committed objectives', () => {
    setupMocks({ objectives: [mockObjectives[2]] }); // only stretch
    render(<InspectAdapt />);
    expect(screen.getByText(/No committed objectives/)).toBeInTheDocument();
  });

  it('shows "Not yet scored" when no objectives have actual BV', () => {
    setupMocks({
      objectives: [
        makePIObjective({ planned_business_value: 5, actual_business_value: null, is_stretch: false }),
      ],
    });
    render(<InspectAdapt />);
    expect(screen.getByText('Not yet scored')).toBeInTheDocument();
  });

  it('renders objectives table with team names', () => {
    render(<InspectAdapt />);
    // Alpha appears twice (two objectives from team-1), Beta once
    expect(screen.getAllByText('Alpha').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('shows committed and stretch type badges', () => {
    render(<InspectAdapt />);
    expect(screen.getAllByText('Committed').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Stretch')).toBeInTheDocument();
  });

  it('shows empty state for objectives when none exist', () => {
    setupMocks({ objectives: [] });
    render(<InspectAdapt />);
    expect(screen.getByText('No objectives for this PI.')).toBeInTheDocument();
  });

  it('renders ROAM breakdown cards for each status', () => {
    render(<InspectAdapt />);
    expect(screen.getByText('resolved')).toBeInTheDocument();
    expect(screen.getByText('owned')).toBeInTheDocument();
    expect(screen.getByText('accepted')).toBeInTheDocument();
    expect(screen.getByText('mitigated')).toBeInTheDocument();
    expect(screen.getByText('unroamed')).toBeInTheDocument();
  });

  it('shows correct ROAM counts', () => {
    render(<InspectAdapt />);
    // 1 resolved, 1 owned, 1 unroamed, 0 accepted, 0 mitigated
    const allCells = screen.getAllByText('1');
    expect(allCells.length).toBeGreaterThanOrEqual(3);
  });

  it('shows empty state for risks when none exist', () => {
    setupMocks({ risks: [] });
    render(<InspectAdapt />);
    expect(screen.getByText('No risks recorded for this PI.')).toBeInTheDocument();
  });

  it('shows total risk count in footer note', () => {
    render(<InspectAdapt />);
    expect(screen.getByText(/3 total risks/)).toBeInTheDocument();
  });

  it('notes stretch objectives excluded from predictability', () => {
    render(<InspectAdapt />);
    expect(screen.getByText(/stretch objective.*excluded/i)).toBeInTheDocument();
  });
});
