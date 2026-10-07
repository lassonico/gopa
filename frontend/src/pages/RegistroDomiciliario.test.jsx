import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RegistroDomiciliario from '../pages/RegistroDomiciliario';
import { solicitudes } from '../services/api';

const { toast } = vi.hoisted(() => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('../services/api', () => ({
  solicitudes: { registroDomiciliario: vi.fn() },
}));

vi.mock('../components/Toast', () => ({
  useToast: () => toast,
}));

vi.mock('../components/Turnstile', () => ({
  __esModule: true,
  default: () => <div data-testid="turnstile" />,
  TURNSTILE_ENABLED: false,
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <RegistroDomiciliario />
    </MemoryRouter>
  );
}

const combos = () => screen.getAllByRole('combobox');

describe('RegistroDomiciliario', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renderiza el título y los campos del formulario', () => {
    renderPage();
    expect(screen.getByText('🛵 Sé domiciliario')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Nombre completo')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Número de documento')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('+57 300 123 4567')).toBeInTheDocument();
    expect(combos()).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Enviar Solicitud' })).toBeInTheDocument();
  });

  it('envía los datos al backend al enviar el formulario', async () => {
    solicitudes.registroDomiciliario.mockResolvedValue({ data: { id: '1' } });
    renderPage();

    fireEvent.change(screen.getByPlaceholderText('Nombre completo'), { target: { value: 'Carlos Pérez' } });
    fireEvent.change(combos()[0], { target: { value: 'Cédula de ciudadanía' } });
    fireEvent.change(screen.getByPlaceholderText('Número de documento'), { target: { value: '1098765432' } });
    fireEvent.change(screen.getByPlaceholderText('+57 300 123 4567'), { target: { value: '3005555555' } });
    fireEvent.change(screen.getByPlaceholderText('tu@correo.com'), { target: { value: 'carlos@test.com' } });
    fireEvent.change(combos()[1], { target: { value: 'Moto' } });

    fireEvent.click(screen.getByRole('button', { name: 'Enviar Solicitud' }));

    await waitFor(() => {
      expect(solicitudes.registroDomiciliario).toHaveBeenCalledWith({
        nombre: 'Carlos Pérez',
        tipoDocumento: 'Cédula de ciudadanía',
        numeroDocumento: '1098765432',
        telefono: '3005555555',
        email: 'carlos@test.com',
        tipoVehiculo: 'Moto',
        turnstileToken: '',
      });
    });

    expect(toast.success).toHaveBeenCalled();
    expect(screen.getByText('¡Solicitud Enviada!')).toBeInTheDocument();
    expect(screen.getByText('Volver al inicio')).toBeInTheDocument();
  });

  it('muestra toast de error si el backend falla', async () => {
    solicitudes.registroDomiciliario.mockRejectedValue({
      response: { data: { error: 'Campos obligatorios faltantes' } },
    });
    renderPage();

    fireEvent.change(screen.getByPlaceholderText('Nombre completo'), { target: { value: 'Ana' } });
    fireEvent.change(combos()[0], { target: { value: 'Pasaporte' } });
    fireEvent.change(screen.getByPlaceholderText('Número de documento'), { target: { value: '12345678' } });
    fireEvent.change(screen.getByPlaceholderText('+57 300 123 4567'), { target: { value: '3000000000' } });
    fireEvent.change(screen.getByPlaceholderText('tu@correo.com'), { target: { value: 'ana@test.com' } });
    fireEvent.change(combos()[1], { target: { value: 'Bicicleta' } });

    fireEvent.click(screen.getByRole('button', { name: 'Enviar Solicitud' }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Campos obligatorios faltantes');
    });
  });
});