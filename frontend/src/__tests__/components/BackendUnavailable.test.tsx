import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BackendUnavailable } from '../../components/BackendUnavailable';

describe('BackendUnavailable', () => {
  it('renders the maintenance heading', () => {
    render(<BackendUnavailable onRetry={() => {}} />);
    expect(screen.getByRole('heading', { name: /down for maintenance/i })).toBeInTheDocument();
  });

  it('renders a retry button', () => {
    render(<BackendUnavailable onRetry={() => {}} />);
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('calls onRetry when the button is clicked', async () => {
    const onRetry = vi.fn();
    render(<BackendUnavailable onRetry={onRetry} />);
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
