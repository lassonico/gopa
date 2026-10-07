import { useState, useEffect } from 'react';
import api from '../services/api';
import Loader from '../components/Loader';

export default function Usuarios() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get('/users')
      .then(({ data }) => setList(data))
      .finally(() => setLoading(false));
  }, []);

  const filtered = list.filter(u =>
    u.nombre?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.id?.toLowerCase().includes(search.toLowerCase()) ||
    u.comercioId?.toLowerCase().includes(search.toLowerCase())
  );

  const formatDate = (dateStr) => dateStr ? new Date(dateStr).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-';

  const formatRole = (rol) => {
    const icons = { cliente: '👤', comercio: '🏪', domiciliario: '🛵', admin: '👑' };
    return `${icons[rol] || '👤'} ${rol}`;
  };

  const eliminar = async (u) => {
    if (!confirm(`¿Eliminar permanentemente a ${u.nombre}? Esta acción no se puede deshacer.`)) return;
    try {
      await api.delete(`/users/${u.id}`);
      setList(prev => prev.filter(x => x.id !== u.id));
    } catch (e) {
      alert(e.response?.data?.error || 'No se pudo eliminar el usuario');
    }
  };

  if (loading) return <div className="loading"><Loader /></div>;

return (
    <div>
      <div className="admin-header">
        <h1>Usuarios</h1>
        <input
          type="text"
          placeholder="Buscar por nombre, email, ID o comercioId..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', width: '100%', maxWidth: 400 }}
        />
      </div>
      
      <div className="table-container" style={{ overflowX: 'auto' }}>
        <table style={{ minWidth: 900 }}>
          <thead>
            <tr>
              <th style={{ width: 50 }}>ID</th>
              <th>Nombre</th>
              <th>Email</th>
              <th>Teléfono</th>
              <th>Rol</th>
              <th>Comercio ID</th>
              <th>Activo</th>
              <th>Registro</th>
              <th>Avatar</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(u => (
              <tr key={u.id} style={{ cursor: 'pointer' }} onClick={() => navigator.clipboard.writeText(u.id)}>
                <td title={u.id} style={{ fontFamily: 'monospace', fontSize: 11, color: '#6b7280', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {u.id}
                </td>
                <td><strong>{u.nombre}</strong></td>
                <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</td>
                <td>{u.telefono || '-'}</td>
                <td>{formatRole(u.rol)}</td>
                <td title={u.comercioId} style={{ fontFamily: 'monospace', fontSize: 11, color: '#6b7280', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {u.comercioId || '-'}
                </td>
                <td style={{ textAlign: 'center' }}>{u.activo === 'true' ? '✓' : '✗'}</td>
                <td style={{ fontSize: 13 }}>{formatDate(u.fechaRegistro)}</td>
                <td style={{ textAlign: 'center' }}>
                  {u.avatar ? (
                    <img src={u.avatar} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#f3f4f6', margin: '0 auto' }} />
                  )}
                </td>
                <td>
                  <button
                    className="btn btn-danger btn-sm"
                    title="Eliminar (para solicitudes de baja de cuenta)"
                    onClick={(e) => { e.stopPropagation(); eliminar(u); }}
                  >
                    🗑
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 8, textAlign: 'center' }}>
          Haz clic en una fila para copiar el ID del usuario
        </p>
      </div>
    </div>
  );
}
