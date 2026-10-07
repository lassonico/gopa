import { useState, useEffect } from 'react';
import api from '../services/api';
import Loader from '../components/Loader';

export default function Cupones() {
  const [list, setList] = useState([]);
  const [form, setForm] = useState({
    codigo: '', tipo: 'porcentaje', valor: '', compraMinima: '',
    fechaInicio: '', fechaVencimiento: '', limiteUsos: ''
  });
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);

  const load = () => {
    api.get('/cupones/todos').then(({ data }) => setList(data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.put(`/cupones/${editingId}`, form);
      } else {
        await api.post('/cupones', form);
      }
      setForm({ codigo: '', tipo: 'porcentaje', valor: '', compraMinima: '', fechaInicio: '', fechaVencimiento: '', limiteUsos: '' });
      setEditingId(null);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'No se pudo guardar el cupón');
    }
  };

  const editar = (c) => {
    setForm({
      codigo: c.codigo || '',
      tipo: c.tipo || 'porcentaje',
      valor: c.valor || '',
      compraMinima: c.compraMinima || '',
      fechaInicio: c.fechaInicio ? String(c.fechaInicio).slice(0, 10) : '',
      fechaVencimiento: c.fechaVencimiento ? String(c.fechaVencimiento).slice(0, 10) : '',
      limiteUsos: c.limiteUsos || ''
    });
    setEditingId(c.id);
  };

  const cancelar = () => {
    setForm({ codigo: '', tipo: 'porcentaje', valor: '', compraMinima: '', fechaInicio: '', fechaVencimiento: '', limiteUsos: '' });
    setEditingId(null);
  };

  const eliminar = async (id) => {
    if (confirm('¿Eliminar cupón?')) {
      try {
        await api.delete(`/cupones/${id}`);
        load();
      } catch (err) {
        alert(err.response?.data?.error || 'No se pudo eliminar el cupón');
      }
    }
  };

  if (loading) return <div className="loading"><Loader /></div>;

  return (
    <div>
      <div className="admin-header"><h1>Cupones</h1></div>

      <div className="form-card" style={{ marginBottom: 24 }}>
        <form onSubmit={handleSubmit}>
          <h3 style={{ marginBottom: 12 }}>{editingId ? 'Editar Cupón' : 'Crear Cupón'}</h3>
          <div className="form-group">
            <label>Código</label>
            <input value={form.codigo} onChange={e => setForm({ ...form, codigo: e.target.value.toUpperCase() })} required disabled={!!editingId} />
          </div>
          <div className="form-group">
            <label>Tipo</label>
            <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
              <option value="porcentaje">Porcentaje</option>
              <option value="valor_fijo">Valor fijo</option>
              <option value="domicilio_gratis">Domicilio gratis</option>
            </select>
          </div>
          <div className="form-group">
            <label>Valor</label>
            <input type="number" value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} required />
          </div>
          <div className="form-group">
            <label>Compra mínima</label>
            <input type="number" value={form.compraMinima} onChange={e => setForm({ ...form, compraMinima: e.target.value })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label>Inicio</label>
              <input type="date" value={form.fechaInicio} onChange={e => setForm({ ...form, fechaInicio: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Vencimiento</label>
              <input type="date" value={form.fechaVencimiento} onChange={e => setForm({ ...form, fechaVencimiento: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label>Límite de usos</label>
            <input type="number" value={form.limiteUsos} onChange={e => setForm({ ...form, limiteUsos: e.target.value })} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="btn btn-primary">{editingId ? 'Actualizar Cupón' : 'Crear Cupón'}</button>
            {editingId && (
              <button type="button" className="btn btn-outline" onClick={cancelar}>Cancelar</button>
            )}
          </div>
        </form>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr><th>Código</th><th>Tipo</th><th>Valor</th><th>Usos</th><th>Vence</th><th>Acción</th></tr>
          </thead>
          <tbody>
            {list.map(c => (
              <tr key={c.id}>
                <td><strong>{c.codigo}</strong></td>
                <td>{c.tipo}</td>
                <td>{c.tipo === 'porcentaje' ? `${c.valor}%` : c.tipo === 'domicilio_gratis' ? 'Gratis' : `$${c.valor}`}</td>
                <td>{c.usosActuales || 0}/{c.limiteUsos || '∞'}</td>
                <td style={{ fontSize: 13 }}>{c.fechaVencimiento ? new Date(c.fechaVencimiento).toLocaleDateString() : '-'}</td>
                <td style={{ display: 'flex', gap: 4 }}>
                  <button className="btn btn-outline btn-sm" onClick={() => editar(c)}>✎ Editar</button>
                  <button className="btn btn-danger btn-sm" onClick={() => eliminar(c.id)}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
