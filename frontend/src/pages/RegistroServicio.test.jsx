import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RegistroServicio from '../pages/RegistroServicio';
import { servicios } from '../services/api';

const { toast } = vi.hoisted(() => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('../services/api', () => ({
  servicios: { registroProveedor: vi.fn() },
  uploads: { uploadBase64: vi.fn() },
}));

vi.mock('../App', () => ({
  useAuth: () => ({ user: { telefono: '3000000000', nombre: 'Usuario' } }),
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
      <RegistroServicio />
    </MemoryRouter>
  );
}

describe('RegistroServicio', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renderiza el título y prellena el teléfono del usuario', () => {
    renderPage();
    expect(screen.getByText('🛠️ Ofrece tu servicio')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Nombre de la persona o empresa')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Ej: transporte de carga')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('+57 300 123 4567')).toHaveValue('3000000000');
  });

  it('envía los datos al backend al enviar el formulario', async () => {
    servicios.registroProveedor.mockResolvedValue({ data: { id: '1' } });
    renderPage();

    fireEvent.change(screen.getByPlaceholderText('Nombre de la persona o empresa'), { target: { value: 'Técnico Juan' } });
    fireEvent.change(screen.getByPlaceholderText('Ej: transporte de carga'), { target: { value: 'Plomería' } });
    fireEvent.change(screen.getByPlaceholderText('Describe el servicio que ofreces'), { target: { value: 'Reparaciones' } });
    fireEvent.click(screen.getByRole('checkbox'));

    fireEvent.click(screen.getByRole('button', { name: 'Registrar Servicio' }));

    await waitFor(() => {
      expect(servicios.registroProveedor).toHaveBeenCalledWith({
        tipoPersona: 'natural',
        nombre: 'Técnico Juan',
        servicio: 'Plomería',
        descripcion: 'Reparaciones',
        telefono: '3000000000',
        logo: '',
        imagen: '',
        turnstileToken: '',
      });
    });

    expect(toast.success).toHaveBeenCalled();
    expect(screen.getByText('¡Solicitud Enviada!')).toBeInTheDocument();
  });

  it('no envía y muestra error de validación si faltan campos', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Registrar Servicio' }));

    expect(toast.error).toHaveBeenCalledWith('Ingresa tu nombre o el de tu empresa.');
    expect(servicios.registroProveedor).not.toHaveBeenCalled();
  });

  it('muestra error de toast si el backend falla', async () => {
    servicios.registroProveedor.mockRejectedValue({ response: { data: { error: 'teléfono requerido' } } });
    renderPage();

    fireEvent.change(screen.getByPlaceholderText('Nombre de la persona o empresa'), { target: { value: 'Juan' } });
    fireEvent.change(screen.getByPlaceholderText('Ej: transporte de carga'), { target: { value: 'Carga' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Registrar Servicio' }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('teléfono requerido');
    });
  });
});