import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ConfirmModal from './ConfirmModal';

describe('ConfirmModal', () => {
  it('renders modal when show is true', () => {
    render(<ConfirmModal show={true} onCancel={vi.fn()} onConfirm={vi.fn()} title="Confirmar" message="¿Seguro?" />);
    expect(screen.getByRole('heading', { name: 'Confirmar' })).toBeInTheDocument();
    expect(screen.getByText('¿Seguro?')).toBeInTheDocument();
  });

  it('does not render when show is false', () => {
    render(<ConfirmModal show={false} onCancel={vi.fn()} onConfirm={vi.fn()} title="Confirmar" message="¿Seguro?" />);
    expect(screen.queryByRole('heading', { name: 'Confirmar' })).not.toBeInTheDocument();
  });

  it('calls onCancel when cancel button is clicked', () => {
    const onCancel = vi.fn();
    render(<ConfirmModal show={true} onCancel={onCancel} onConfirm={vi.fn()} title="Confirmar" message="¿Seguro?" />);
    fireEvent.click(screen.getByText('Cancelar'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('calls onConfirm when confirm button is clicked', () => {
    const onConfirm = vi.fn();
    render(<ConfirmModal show={true} onCancel={vi.fn()} onConfirm={onConfirm} title="Confirmar" message="¿Seguro?" />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('shows loading state', () => {
    render(<ConfirmModal show={true} onCancel={vi.fn()} onConfirm={vi.fn()} title="Confirmar" message="¿Seguro?" loading />);
    expect(screen.getByRole('button', { name: 'Procesando...' })).toBeInTheDocument();
  });

  it('uses custom confirm label and color', () => {
    render(<ConfirmModal show={true} onCancel={vi.fn()} onConfirm={vi.fn()} title="Confirmar" message="¿Seguro?" confirmLabel="Eliminar" confirmColor="#ff0000" />);
    const confirmBtn = screen.getByRole('button', { name: 'Eliminar' });
    expect(confirmBtn).toHaveStyle({ background: '#ff0000' });
  });
});