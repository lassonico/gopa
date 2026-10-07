import { useState, useEffect } from 'react';
import api from '../services/api';
import ConfirmModal from '../components/ConfirmModal';

export default function Notificaciones() {
  const [form, setForm] = useState({ titulo: '', mensaje: '', tipo: 'general', dirigidoA: 'todos' });
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [porEliminar, setPorEliminar] = useState(null);

  const loadHistory = async () => {
    try {
      const { data } = await api.get('/notificaciones', { params: { todas: 'true' } });
      setHistory(Array.isArray(data) ? data : []);
    } catch {}
  };

  useEffect(() => { loadHistory(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/notificaciones', form);
      setForm({ titulo: '', mensaje: '', tipo: 'general', dirigidoA: 'todos' });
      await loadHistory();
      alert('Notificación enviada');
    } catch (err) {
      alert(err.response?.data?.error || 'No se pudo enviar la notificación');
    } finally {
      setLoading(false);
    }
  };

  const eliminar = async (id) => {
    setPorEliminar(null);
    try {
      await api.delete(`/notificaciones/${id}`);
      setHistory(prev => prev.filter(n => n.id !== id));
    } catch (e) {
      alert(e.response?.data?.error || 'No se pudo eliminar la notificación');
    }
  };

  return (
    <div>
      <div className="admin-header"><h1>Notificaciones</h1></div>
      <div className="form-card" style={{ marginBottom: 24 }}>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Título</label>
            <input value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} required />
          </div>
          <div className="form-group">
            <label>Mensaje</label>
            <textarea value={form.mensaje} onChange={e => setForm({ ...form, mensaje: e.target.value })} rows={3} required />
          </div>
          <div className="form-group">
            <label>Tipo</label>
            <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
              <option value="general">General</option>
              <option value="promocion">Promoción</option>
              <option value="recordatorio">Recordatorio</option>
              <option value="evento">Evento</option>
            </select>
          </div>
          <div className="form-group">
            <label>Dirigido a</label>
            <select value={form.dirigidoA} onChange={e => setForm({ ...form, dirigidoA: e.target.value })}>
              <option value="todos">Todos los usuarios</option>
              <option value="cliente">Solo clientes</option>
              <option value="comercio">Solo comercios</option>
              <option value="domiciliario">Solo domiciliarios</option>
              <option value="admin">Solo administradores</option>
            </select>
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>Enviar</button>
        </form>
      </div>

      <div className="table-container">
        <table>
          <thead><tr><th>Título</th><th>Mensaje</th><th>Tipo</th><th>Dirigido a</th><th>Fecha</th><th>Acción</th></tr></thead>
          <tbody>
            {history.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--gray-600)' }}>No hay notificaciones</td></tr>
            ) : history.map(n => (
              <tr key={n.id}>
                <td><strong>{n.titulo}</strong></td>
                <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.mensaje}</td>
                <td><span className="badge">{n.tipo}</span></td>
                <td style={{ fontSize: 13 }}>{n.destinatarioId ? `Usuario ${String(n.destinatarioId).slice(0, 8)}…` : n.dirigidoA}</td>
                <td style={{ fontSize: 13 }}>{n.fecha ? new Date(n.fecha).toLocaleDateString() : '-'}</td>
                <td>
                  <button className="btn btn-danger btn-sm" title="Eliminar notificación"
                    onClick={() => setPorEliminar(n)}>
                    🗑
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        show={!!porEliminar}
        title="Eliminar notificación"
        message={`¿Eliminar permanentemente "${porEliminar?.titulo}"? Esta acción no se puede deshacer.`}
        onConfirm={() => eliminar(porEliminar.id)}
        onCancel={() => setPorEliminar(null)}
      />
    </div>
  );
}
