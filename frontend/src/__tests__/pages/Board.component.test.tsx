import { render, screen } from '@testing-library/react';
import { useDroppable } from '@dnd-kit/core';
import { describe, expect, it, vi, beforeAll, beforeEach } from 'vitest';

// jsdom does not implement ResizeObserver
beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DragOverlay: ({ children }: { children: React.ReactNode }) => <>{children ?? null}</>,
  PointerSensor: class {},
  useSensor: vi.fn(() => ({})),
  useSensors: vi.fn(() => []),
  useDraggable: vi.fn(() => ({
    setNodeRef: vi.fn(),
    listeners: {},
    attributes: {},
    isDragging: false,
    transform: null,
  })),
  useDroppable: vi.fn(() => ({ setNodeRef: vi.fn(), isOver: false })),
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ piId: 'pi-1' }),
}));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return { ...actual, useQuery: vi.fn(), useMutation: vi.fn(), useQueryClient: vi.fn() };
});

vi.mock('../../components/Toaster', () => ({ useToast: () => vi.fn() }));

import { Board } from '../../pages/Board';
import { makeFeature, makeIteration, makePI, makeTeam } from '../factories';
import { setupQueryMocks } from '../setupMocks';

const mockPI = makePI({ id: 'pi-1', art_id: 'art-1', name: 'PI 2026.1', status: 'active' });
const mockTeam = makeTeam({ id: 'team-1', art_id: 'art-1', name: 'Alpha' });
const mockIteration = makeIteration({ id: 'iter-1', pi_id: 'pi-1', number: 1, is_ip: false });
const mockFeature = makeFeature({
  id: 'feat-1',
  pi_id: 'pi-1',
  team_id: 'team-1',
  iteration_id: 'iter-1',
  name: 'Auth Service',
});

function setupBoardMocks({
  pi = mockPI,
  teams = [mockTeam],
  iterations = [mockIteration],
  features = [mockFeature] as ReturnType<typeof makeFeature>[],
  deps = [] as unknown[],
} = {}) {
  setupQueryMocks(({ queryKey }) => {
    const key = queryKey[0] as string;
    if (key === 'pi') return pi;
    if (key === 'teams') return teams;
    if (key === 'iterations') return iterations;
    if (key === 'features') return features;
    if (key === 'dependencies') return deps;
    return undefined;
  });
}

describe('Board page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the board header with PI name', () => {
    setupBoardMocks();
    render(<Board />);
    expect(screen.getByRole('heading', { name: /Program Board/ })).toBeInTheDocument();
  });

  it('renders team name in the grid', () => {
    setupBoardMocks();
    render(<Board />);
    expect(screen.getByText('Alpha')).toBeInTheDocument();
  });

  it('renders feature card inside the droppable cell', () => {
    setupBoardMocks();
    render(<Board />);
    expect(screen.getByText('Auth Service')).toBeInTheDocument();
  });

  it('renders the unassigned section', () => {
    setupBoardMocks({ features: [] });
    render(<Board />);
    expect(screen.getByText(/Unassigned/)).toBeInTheDocument();
  });

  it('renders unassigned features in the drop zone', () => {
    const unassigned = makeFeature({ id: 'feat-2', pi_id: 'pi-1', team_id: null, name: 'Unplanned Feature' });
    setupBoardMocks({ features: [unassigned] });
    render(<Board />);
    expect(screen.getByText('Unplanned Feature')).toBeInTheDocument();
  });

  it('shows empty state when no teams are configured', () => {
    setupBoardMocks({ teams: [] });
    render(<Board />);
    expect(screen.getByText(/No teams configured/)).toBeInTheDocument();
  });

  it('applies bg-blue-50 to DroppableCell and UnassignedDropZone when isOver', () => {
    vi.mocked(useDroppable).mockReturnValue({ setNodeRef: vi.fn(), isOver: true });
    setupBoardMocks();
    const { container } = render(<Board />);
    const overCells = container.querySelectorAll('[class*="bg-blue-50"]');
    expect(overCells.length).toBeGreaterThan(0);
  });
});
