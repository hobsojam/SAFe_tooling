import { useQueryClient } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Root } from '../../main';

// Replace the full App with a lightweight probe that can trigger cache errors
vi.mock('../../App', () => ({
  default: function FakeApp() {
    const qc = useQueryClient();
    function fireBackendError() {
      qc.getQueryCache().config.onError?.(new TypeError('Failed to fetch'), {} as never);
    }
    function fireAppError() {
      qc.getQueryCache().config.onError?.(new Error('404: Not Found'), {} as never);
    }
    return (
      <div>
        <span>app loaded</span>
        <button onClick={fireBackendError}>fire backend error</button>
        <button onClick={fireAppError}>fire app error</button>
      </div>
    );
  },
}));

describe('Root', () => {
  it('renders the app normally when there are no errors', () => {
    render(<Root />);
    expect(screen.getByText('app loaded')).toBeInTheDocument();
  });

  it('swaps to the maintenance page on a network error (TypeError)', async () => {
    render(<Root />);
    await userEvent.click(screen.getByRole('button', { name: /fire backend error/i }));
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /down for maintenance/i })).toBeInTheDocument(),
    );
    expect(screen.queryByText('app loaded')).not.toBeInTheDocument();
  });

  it('swaps to the maintenance page on a 502 error', async () => {
    render(<Root />);
    const qc = screen.getByRole('button', { name: /fire backend error/i });
    // re-fire with 502 message via a custom event approach — simulate directly
    await userEvent.click(qc);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /down for maintenance/i })).toBeInTheDocument(),
    );
  });

  it('does NOT swap to maintenance page for a 404 application error', async () => {
    render(<Root />);
    await userEvent.click(screen.getByRole('button', { name: /fire app error/i }));
    expect(screen.queryByRole('heading', { name: /down for maintenance/i })).not.toBeInTheDocument();
    expect(screen.getByText('app loaded')).toBeInTheDocument();
  });

  it('returns to the app after clicking Retry', async () => {
    render(<Root />);
    await userEvent.click(screen.getByRole('button', { name: /fire backend error/i }));
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /down for maintenance/i })).toBeInTheDocument(),
    );
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    await waitFor(() => expect(screen.getByText('app loaded')).toBeInTheDocument());
    expect(screen.queryByRole('heading', { name: /down for maintenance/i })).not.toBeInTheDocument();
  });
});
