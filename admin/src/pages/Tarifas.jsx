import { useState, useEffect } from 'react';
import api from '../services/api';
import Loader from '../components/Loader';

export default function Tarifas() {
  const [form, setForm] = useState({ comisionVentas: '', valorDomicilio: '' });
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    api.get('/configuraciones/tarifas')
      .then(({ data }) => setForm({
        comisionVentas: data?.comisionVentas ?? '',
        valorDomicilio: data?.valorDomicilio ?? '',
      }))
      .catch(() => setMessage({ type: 'error', text: 'No se pudieron cargar las tarifas' }))
      .finally(() => setLoading(false));
  }, []);

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setMessage(null);
    try {
      await api.put('/configuraciones/tarifas', form);
      setMessage({ type: 'success', text: 'Tarifas actualizadas correctamente' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'No se pudieron guardar las tarifas' });
    } finally {
      setGuardando(false);
    }
  };

  if (loading) return <div className="loading"><Loader /></div>;

  return (
    <div>
      <div className="admin-header"><h1>Tarifas Globales</h1></div>

      <div className="form-card" style={{ marginBottom: 24 }}>
        <form onSubmit={guardar}>
          <h3 style={{ marginBottom: 8 }}>Configuración de tarifas</h3>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 16px' }}>
            Aplican a todos los comercios de la plataforma.
          </p>

          <div className="form-group">
            <label>Comisión por venta (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={form.comisionVentas}
              onChange={e => setForm({ ...form, comisionVentas: e.target.value })}
              placeholder="Ej: 10"
            />
            <small style={{ color: '#9ca3af' }}>
              Se aplicará como comisión por defecto a todos los comercios.
            </small>
          </div>

          <div className="form-group">
            <label>Valor del domicilio (COP)</label>
            <input
              type="number"
              min="0"
              step="100"
              value={form.valorDomicilio}
              onChange={e => setForm({ ...form, valorDomicilio: e.target.value })}
              placeholder="Ej: 2600"
            />
            <small style={{ color: '#9ca3af' }}>
              Se cobra al cliente en la app al confirmar su pedido.
            </small>
          </div>

          {message && (
            <div style={{
              padding: 12, borderRadius: 8, margin: '12px 0',
              background: message.type === 'success' ? '#DCFCE7' : '#FEE2E2',
              color: message.type === 'success' ? '#166534' : '#991B1B',
            }}>
              {message.text}
            </div>
          )}

          <button type="submit" className="btn btn-primary" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar tarifas'}
          </button>
        </form>
      </div>
    </div>
  );
}