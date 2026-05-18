import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Pagination } from '../../components/Pagination';

describe('Pagination', () => {
  it('returns null when totalPages is 1', () => {
    const { container } = render(
      <Pagination page={1} totalPages={1} onPageChange={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('returns null when totalPages is 0', () => {
    const { container } = render(
      <Pagination page={1} totalPages={0} onPageChange={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders page indicator', () => {
    render(<Pagination page={2} totalPages={5} onPageChange={vi.fn()} />);
    expect(screen.getByText('Page 2 of 5')).toBeInTheDocument();
  });

  it('disables Prev button on first page', () => {
    render(<Pagination page={1} totalPages={3} onPageChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: '← Prev' })).toBeDisabled();
  });

  it('disables Next button on last page', () => {
    render(<Pagination page={3} totalPages={3} onPageChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Next →' })).toBeDisabled();
  });

  it('calls onPageChange with page - 1 when Prev is clicked', async () => {
    const onPageChange = vi.fn();
    const user = userEvent.setup();
    render(<Pagination page={3} totalPages={5} onPageChange={onPageChange} />);
    await user.click(screen.getByRole('button', { name: '← Prev' }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('calls onPageChange with page + 1 when Next is clicked', async () => {
    const onPageChange = vi.fn();
    const user = userEvent.setup();
    render(<Pagination page={3} totalPages={5} onPageChange={onPageChange} />);
    await user.click(screen.getByRole('button', { name: 'Next →' }));
    expect(onPageChange).toHaveBeenCalledWith(4);
  });

  it('renders all page buttons when totalPages <= 7', () => {
    render(<Pagination page={1} totalPages={5} onPageChange={vi.fn()} />);
    for (let i = 1; i <= 5; i++) {
      expect(screen.getByRole('button', { name: String(i) })).toBeInTheDocument();
    }
  });

  it('calls onPageChange with the correct page when a page button is clicked', async () => {
    const onPageChange = vi.fn();
    const user = userEvent.setup();
    render(<Pagination page={1} totalPages={5} onPageChange={onPageChange} />);
    await user.click(screen.getByRole('button', { name: '3' }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('renders ellipsis for large page ranges starting near the beginning', () => {
    render(<Pagination page={2} totalPages={20} onPageChange={vi.fn()} />);
    expect(screen.getByText('…')).toBeInTheDocument();
  });

  it('renders ellipsis for large page ranges starting near the end', () => {
    render(<Pagination page={18} totalPages={20} onPageChange={vi.fn()} />);
    expect(screen.getByText('…')).toBeInTheDocument();
  });

  it('renders two ellipsis elements for large page ranges in the middle', () => {
    render(<Pagination page={10} totalPages={20} onPageChange={vi.fn()} />);
    expect(screen.getAllByText('…').length).toBe(2);
  });
});
