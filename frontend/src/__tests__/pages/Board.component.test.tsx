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

import { Board, DependencyArrows } from '../../pages/Board';
import type { Arrow } from '../../pages/Board';
import { makeFeature, makeIteration, makePI, makeTeam, makeDependency } from '../factories';
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
    vi.mocked(useDroppable).mockReturnValue({ setNodeRef: vi.fn(), isOver: true, active: null, rect: { current: null }, node: { current: null }, over: null });
    setupBoardMocks();
    const { container } = render(<Board />);
    const overCells = container.querySelectorAll('[class*="bg-blue-50"]');
    expect(overCells.length).toBeGreaterThan(0);
  });

  it('sets data-cell-team and data-cell-iter on iteration cells', () => {
    setupBoardMocks();
    const { container } = render(<Board />);
    const cell = container.querySelector('[data-cell-team="Alpha"][data-cell-iter="I1"]');
    expect(cell).not.toBeNull();
  });

  it('sets data-cell-iter="Unplanned" on the unplanned column cell', () => {
    setupBoardMocks();
    const { container } = render(<Board />);
    const cell = container.querySelector('[data-cell-team="Alpha"][data-cell-iter="Unplanned"]');
    expect(cell).not.toBeNull();
  });

  it('marks unassigned-team feature as at-risk', () => {
    const feature = makeFeature({ pi_id: 'pi-1', team_id: null, name: 'Unassigned Feature' });
    setupBoardMocks({ features: [feature], deps: [] });
    const { container } = render(<Board />);
    expect(container.querySelector('[data-at-risk="true"]')).not.toBeNull();
  });

  it('marks consumer feature at-risk when provider is in same iteration', () => {
    const consumer = makeFeature({ pi_id: 'pi-1', team_id: 'team-1', iteration_id: 'iter-1', name: 'Consumer' });
    const provider = makeFeature({ pi_id: 'pi-1', team_id: 'team-1', iteration_id: 'iter-1', name: 'Provider' });
    const dep = makeDependency({
      from_feature_id: consumer.id,
      to_feature_id: provider.id,
      status: 'identified',
    });
    setupBoardMocks({
      features: [consumer, provider],
      iterations: [mockIteration],
      deps: [dep],
    });
    const { container } = render(<Board />);
    expect(container.querySelector('[data-at-risk="true"]')).not.toBeNull();
  });

  it('does not mark consumer at-risk when provider is in an earlier iteration', () => {
    const iter1 = makeIteration({ id: 'iter-1', pi_id: 'pi-1', number: 1, is_ip: false });
    const iter2 = makeIteration({ id: 'iter-2', pi_id: 'pi-1', number: 2, is_ip: false });
    const consumer = makeFeature({ pi_id: 'pi-1', team_id: 'team-1', iteration_id: 'iter-2', name: 'Consumer' });
    const provider = makeFeature({ pi_id: 'pi-1', team_id: 'team-1', iteration_id: 'iter-1', name: 'Provider' });
    const dep = makeDependency({
      from_feature_id: consumer.id,
      to_feature_id: provider.id,
      status: 'identified',
    });
    setupBoardMocks({
      features: [consumer, provider],
      iterations: [iter1, iter2],
      deps: [dep],
    });
    const { container } = render(<Board />);
    expect(container.querySelector('[data-at-risk="true"]')).toBeNull();
  });

  it('does not mark consumer at-risk when dependency is resolved', () => {
    const consumer = makeFeature({ pi_id: 'pi-1', team_id: 'team-1', iteration_id: 'iter-1', name: 'Consumer' });
    const provider = makeFeature({ pi_id: 'pi-1', team_id: 'team-1', iteration_id: 'iter-1', name: 'Provider' });
    const dep = makeDependency({
      from_feature_id: consumer.id,
      to_feature_id: provider.id,
      status: 'resolved',
    });
    setupBoardMocks({
      features: [consumer, provider],
      iterations: [mockIteration],
      deps: [dep],
    });
    const { container } = render(<Board />);
    expect(container.querySelector('[data-at-risk="true"]')).toBeNull();
  });

  it('renders the IP iteration column header', () => {
    const ipIter = makeIteration({ id: 'iter-ip', pi_id: 'pi-1', number: 2, is_ip: true });
    setupBoardMocks({ iterations: [mockIteration, ipIter] });
    render(<Board />);
    expect(screen.getByText('I2 (IP)')).toBeInTheDocument();
  });

  it('renders dependency table when deps are present', () => {
    const dep = makeDependency({
      pi_id: 'pi-1',
      from_feature_id: mockFeature.id,
      to_feature_id: mockFeature.id,
      description: 'Needs auth gateway',
      owner: 'Alice',
    });
    setupBoardMocks({ deps: [dep] });
    render(<Board />);
    expect(screen.getByText('Needs auth gateway')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('shows dash when dependency owner is null', () => {
    const dep = makeDependency({
      pi_id: 'pi-1',
      from_feature_id: mockFeature.id,
      to_feature_id: mockFeature.id,
      owner: null,
    });
    setupBoardMocks({ deps: [dep] });
    render(<Board />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});

describe('DependencyArrows', () => {
  it('renders nothing for empty arrows', () => {
    const { container } = render(<DependencyArrows arrows={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders one SVG path per arrow', () => {
    const arrows: Arrow[] = [
      { depId: 'd1', x1: 0, y1: 0, x2: 100, y2: 100, resolved: false },
      { depId: 'd2', x1: 10, y1: 10, x2: 200, y2: 50, resolved: true },
    ];
    const { container } = render(<DependencyArrows arrows={arrows} />);
    const paths = container.querySelectorAll('path');
    expect(paths.length).toBe(2);
  });

  it('sets full opacity and no stroke-dasharray for unresolved arrows', () => {
    const arrows: Arrow[] = [
      { depId: 'd1', x1: 0, y1: 0, x2: 100, y2: 100, resolved: false },
    ];
    const { container } = render(<DependencyArrows arrows={arrows} />);
    const path = container.querySelector('path[data-dep-id="d1"]')!;
    expect(path.getAttribute('opacity')).toBe('0.85');
    expect(path.getAttribute('stroke-dasharray')).toBeNull();
  });

  it('sets reduced opacity and stroke-dasharray for resolved arrows', () => {
    const arrows: Arrow[] = [
      { depId: 'd2', x1: 0, y1: 0, x2: 100, y2: 100, resolved: true },
    ];
    const { container } = render(<DependencyArrows arrows={arrows} />);
    const path = container.querySelector('path[data-dep-id="d2"]')!;
    expect(path.getAttribute('opacity')).toBe('0.35');
    expect(path.getAttribute('stroke-dasharray')).toBe('5 3');
  });

  it('generates a bezier path using control point offset of max(40, 40% of dx)', () => {
    // x1=0, y1=50, x2=200, y2=150
    // abs diff = 200, 40% = 80, max(40, 80) = 80
    // cx1 = 0+80=80, cx2 = 200-80=120
    const arrows: Arrow[] = [
      { depId: 'd3', x1: 0, y1: 50, x2: 200, y2: 150, resolved: false },
    ];
    const { container } = render(<DependencyArrows arrows={arrows} />);
    const path = container.querySelector('path[data-dep-id="d3"]')!;
    expect(path.getAttribute('d')).toBe('M 0 50 C 80 50, 120 150, 200 150');
  });

  it('uses minimum offset of 40 when dx is small', () => {
    // x1=0, y1=0, x2=10, y2=100 → abs diff=10, 40% = 4, max(40, 4) = 40
    // cx1 = 0+40=40, cx2 = 10-40=-30
    const arrows: Arrow[] = [
      { depId: 'd4', x1: 0, y1: 0, x2: 10, y2: 100, resolved: false },
    ];
    const { container } = render(<DependencyArrows arrows={arrows} />);
    const path = container.querySelector('path[data-dep-id="d4"]')!;
    expect(path.getAttribute('d')).toBe('M 0 0 C 40 0, -30 100, 10 100');
  });
});
