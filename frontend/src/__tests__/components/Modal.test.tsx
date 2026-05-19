import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Modal } from '../../components/Modal';

describe('Modal', () => {
  it('renders nothing when closed', () => {
    render(
      <Modal open={false} title="Test" onClose={() => {}}>
        content
      </Modal>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders the dialog when open', () => {
    render(
      <Modal open={true} title="Test" onClose={() => {}}>
        content
      </Modal>,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('renders the title', () => {
    render(
      <Modal open={true} title="My Modal Title" onClose={() => {}}>
        content
      </Modal>,
    );
    expect(screen.getByText('My Modal Title')).toBeInTheDocument();
  });

  it('renders children', () => {
    render(
      <Modal open={true} title="Test" onClose={() => {}}>
        child content
      </Modal>,
    );
    expect(screen.getByText('child content')).toBeInTheDocument();
  });

  it('has aria-modal="true"', () => {
    render(
      <Modal open={true} title="Test" onClose={() => {}}>
        content
      </Modal>,
    );
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
  });

  it('labels the dialog with the title element', () => {
    render(
      <Modal open={true} title="Test" onClose={() => {}}>
        content
      </Modal>,
    );
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-labelledby', 'modal-title');
  });

  it('has an accessible close button', () => {
    render(
      <Modal open={true} title="Test" onClose={() => {}}>
        content
      </Modal>,
    );
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('calls onClose when the close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Modal open={true} title="Test" onClose={onClose}>
        content
      </Modal>,
    );
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when the backdrop is clicked', () => {
    const onClose = vi.fn();
    const { container } = render(
      <Modal open={true} title="Test" onClose={onClose}>
        content
      </Modal>,
    );
    fireEvent.click(container.firstChild as HTMLElement);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not call onClose when clicking inside the dialog', () => {
    const onClose = vi.fn();
    render(
      <Modal open={true} title="Test" onClose={onClose}>
        content
      </Modal>,
    );
    fireEvent.click(screen.getByText('content'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not propagate Escape keydown (handled by onCancel)', () => {
    render(
      <Modal open={true} title="Test" onClose={() => {}}>
        content
      </Modal>,
    );
    const dialog = screen.getByRole('dialog');
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    const stopPropagation = vi.spyOn(event, 'stopPropagation');
    dialog.dispatchEvent(event);
    expect(stopPropagation).toHaveBeenCalled();
  });

  it('closes the dialog when transitioning from open to closed', () => {
    const { rerender } = render(
      <Modal open={true} title="Test" onClose={() => {}}>
        content
      </Modal>,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    rerender(
      <Modal open={false} title="Test" onClose={() => {}}>
        content
      </Modal>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
