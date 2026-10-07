import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ServicioDetail from '../pages/ServicioDetail';
import { servicios } from '../services/api';

vi.mock('../services/api', () => ({
  servicios: { getById: vi.fn() },
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/servicios/svc-1']}>
      <Routes>
        <Route path="/servicios/:id" element={<ServicioDetail />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ServicioDetail', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renderiza los datos del servicio', async () => {
    servicios.getById.mockResolvedValue({
      data: {
        id: 'svc-1',
        nombre: 'Roberto García',
        servicio: 'Plomería',
        tipoPersona: 'natural',
        descripcion: 'Reparaciones a domicilio',
        telefono: '3005554444',
      },
    });
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Plomería' })).toBeInTheDocument();
    expect(screen.getByText('Persona natural')).toBeInTheDocument();
    expect(screen.getByText('Roberto García')).toBeInTheDocument();
    expect(screen.getByText('Reparaciones a domicilio')).toBeInTheDocument();
    expect(screen.getByText('3005554444')).toBeInTheDocument();
  });

  it('abre WhatsApp con el número del proveedor', async () => {
    servicios.getById.mockResolvedValue({
      data: {
        id: 'svc-1',
        nombre: 'Roberto García',
        servicio: 'Plomería',
        tipoPersona: 'juridica',
        telefono: '3005554444',
      },
    });
    const openSpy = vi.fn();
    window.open = openSpy;
    renderPage();

    await screen.findByRole('heading', { name: 'Plomería' });
    fireEvent.click(screen.getByRole('button', { name: 'Contactar por WhatsApp' }));

    await waitFor(() => {
      expect(openSpy).toHaveBeenCalled();
    });
    const url = openSpy.mock.calls[0][0];
    expect(url).toContain('wa.me/3005554444');
    expect(url).toContain('text=');
  });

  it('navega al inicio si el servicio no se encuentra', async () => {
    servicios.getById.mockRejectedValue({ response: { status: 404 } });
    renderPage();

    await waitFor(() => {
      expect(servicios.getById).toHaveBeenCalledWith('svc-1');
    });
  });
});