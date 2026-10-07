import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AlertModal from './AlertModal';

describe('AlertModal', () => {
  it('renders modal when show is true', () => {
    render(<AlertModal show={true} onClose={vi.fn()} title="Alerta" message="Mensaje de prueba" />);
    expect(screen.getByText('Alerta')).toBeInTheDocument();
    expect(screen.getByText('Mensaje de prueba')).toBeInTheDocument();
  });

  it('does not render when show is false', () => {
    render(<AlertModal show={false} onClose={vi.fn()} title="Alerta" message="Mensaje de prueba" />);
    expect(screen.queryByText('Alerta')).not.toBeInTheDocument();
  });

  it('calls onClose when OK button is clicked', () => {
    const onClose = vi.fn();
    render(<AlertModal show={true} onClose={onClose} title="Alerta" message="Mensaje de prueba" />);
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(onClose).toHaveBeenCalled();
  });
});