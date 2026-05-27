import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('react-router-dom', () => ({
  useParams: () => ({ piId: 'pi-1' }),
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useQueryClient: vi.fn(),
}));

vi.mock('../../components/Toaster', () => ({ useToast: () => vi.fn() }));
vi.mock('../../components/Spinner', () => ({ Spinner: () => <div>Loading…</div> }));
vi.mock('../../components/EmptyState', () => ({
  EmptyState: ({ message }: { message: string }) => <div>{message}</div>,
}));

import { RoamUnroamed } from '../../pages/RoamUnroamed';
import { makePI, makeRisk, makeTeam } from '../factories';

const mockPI = makePI({ id: 'pi-1', name: 'PI 2026.1' });
const mockTeams = [makeTeam({ id: 'team-1', name: 'Alpha' })];
const unroamedRisk = makeRisk({
  id: 'risk-1',
  pi_id: 'pi-1',
  description: 'DB migration risk',
  roam_status: 'unroamed',
  team_id: 'team-1',
  owner: null,
  mitigation_notes: '',
});

type MutOpts = {
  onSuccess?: (data: unknown, vars: { id: string }) => void;
  onError?: (e: Error, vars: { id: string }) => void;
};

function captureMutation(risks = [unroamedRisk]) {
  let capturedOpts: MutOpts = {};
  vi.mocked(useQueryClient).mockReturnValue({ invalidateQueries: vi.fn() } as any);
  vi.mocked(useMutation).mockImplementation((opts: unknown) => {
    capturedOpts = opts as MutOpts;
    return { mutate: vi.fn(), isPending: false } as any;
  });
  vi.mocked(useQuery).mockImplementation(({ queryKey }: any) => {
    const key = (queryKey as string[])[0];
    if (key === 'pi') return { data: mockPI, isLoading: false } as any;
    if (key === 'risks') return { data: risks, isLoading: false } as any;
    if (key === 'teams') return { data: mockTeams, isLoading: false } as any;
    return { data: undefined, isLoading: false } as any;
  });
  return { get opts() { return capturedOpts; } };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('RoamUnroamed — onChange handlers', () => {
  it('owner input onChange updates displayed value', async () => {
    captureMutation();
    const user = userEvent.setup();
    render(<RoamUnroamed />);
    const ownerInput = screen.getByLabelText(`Owner`);
    await user.type(ownerInput, 'Alice');
    expect(ownerInput).toHaveValue('Alice');
  });

  it('mitigation notes input onChange updates displayed value', async () => {
    captureMutation();
    const user = userEvent.setup();
    render(<RoamUnroamed />);
    const notesInput = screen.getByLabelText('Mitigation Notes');
    await user.type(notesInput, 'Rollback plan ready');
    expect(notesInput).toHaveValue('Rollback plan ready');
  });

  it('clicking ROAM with a custom owner passes owner in mutate args', async () => {
    const mutate = vi.fn();
    vi.mocked(useQueryClient).mockReturnValue({ invalidateQueries: vi.fn() } as any);
    vi.mocked(useMutation).mockReturnValue({ mutate, isPending: false } as any);
    vi.mocked(useQuery).mockImplementation(({ queryKey }: any) => {
      const key = (queryKey as string[])[0];
      if (key === 'pi') return { data: mockPI, isLoading: false } as any;
      if (key === 'risks') return { data: [unroamedRisk], isLoading: false } as any;
      if (key === 'teams') return { data: mockTeams, isLoading: false } as any;
      return { data: undefined, isLoading: false } as any;
    });
    const user = userEvent.setup();
    render(<RoamUnroamed />);
    const ownerInput = screen.getByLabelText('Owner');
    await user.type(ownerInput, 'Bob');
    await user.click(screen.getByRole('button', { name: 'ROAM this risk' }));
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'risk-1',
        body: expect.objectContaining({ owner: 'Bob' }),
      }),
    );
  });

  it('clicking ROAM with mitigation notes passes notes in mutate args', async () => {
    const mutate = vi.fn();
    vi.mocked(useQueryClient).mockReturnValue({ invalidateQueries: vi.fn() } as any);
    vi.mocked(useMutation).mockReturnValue({ mutate, isPending: false } as any);
    vi.mocked(useQuery).mockImplementation(({ queryKey }: any) => {
      const key = (queryKey as string[])[0];
      if (key === 'pi') return { data: mockPI, isLoading: false } as any;
      if (key === 'risks') return { data: [unroamedRisk], isLoading: false } as any;
      if (key === 'teams') return { data: mockTeams, isLoading: false } as any;
      return { data: undefined, isLoading: false } as any;
    });
    const user = userEvent.setup();
    render(<RoamUnroamed />);
    const notesInput = screen.getByLabelText('Mitigation Notes');
    await user.type(notesInput, 'Use backup server');
    await user.click(screen.getByRole('button', { name: 'ROAM this risk' }));
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'risk-1',
        body: expect.objectContaining({ mitigation_notes: 'Use backup server' }),
      }),
    );
  });
});

describe('RoamUnroamed — mutation callbacks', () => {
  it('onError shows per-risk error message', () => {
    const capture = captureMutation();
    render(<RoamUnroamed />);
    act(() => { capture.opts.onError?.(new Error('ROAM failed'), { id: 'risk-1' }); });
    expect(screen.getByText('ROAM failed')).toBeInTheDocument();
  });

  it('onSuccess clears the per-risk error', () => {
    const capture = captureMutation();
    render(<RoamUnroamed />);
    act(() => { capture.opts.onError?.(new Error('ROAM failed'), { id: 'risk-1' }); });
    expect(screen.getByText('ROAM failed')).toBeInTheDocument();
    act(() => { capture.opts.onSuccess?.(null, { id: 'risk-1' }); });
    expect(screen.queryByText('ROAM failed')).not.toBeInTheDocument();
  });

  it('shows "Saving…" on the button while saving[risk.id] is true', async () => {
    captureMutation();
    const user = userEvent.setup();
    // Override mutation to control the pending state per-risk via setSaving side-effect
    let capturedMutate = vi.fn();
    vi.mocked(useMutation).mockReturnValue({ mutate: capturedMutate, isPending: false } as any);
    render(<RoamUnroamed />);
    // Clicking the button calls save(r) which sets saving[r.id]=true then calls mutate
    // The mock mutate does nothing so saving stays true until onSuccess/onError
    await user.click(screen.getByRole('button', { name: 'ROAM this risk' }));
    expect(capturedMutate).toHaveBeenCalled();
    // After the click, saving['risk-1'] = true → button shows "Saving…"
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeInTheDocument();
  });
});
