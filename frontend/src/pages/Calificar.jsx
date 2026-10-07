import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { calificaciones, pedidos } from '../services/api';
import AlertModal from '../components/AlertModal';

export default function Calificar() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    calificacionGeneral: 0,
    calidadProductos: 0,
    tiempoPreparacion: 0,
    tiempoEntrega: 0,
    atencionComercio: 0,
    atencionDomiciliario: 0,
    comentario: ''
  });
  const [pedidoData, setPedidoData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    pedidos.getById(id)
      .then(({ data }) => setPedidoData(data))
      .catch(() => {});
  }, [id]);

  const setStar = (field, val) => setForm({ ...form, [field]: val });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.calificacionGeneral) {
      setAlert({ title: 'Calificación requerida', message: 'Por favor da una calificación general' });
      return;
    }
    setLoading(true);
    try {
      await calificaciones.create({
        ...form,
        pedidoId: id,
        comercioId: pedidoData?.comercioId || '',
        domiciliarioId: pedidoData?.domiciliarioId || '',
      });
      setAlert({ title: '¡Gracias!', message: 'Calificación enviada correctamente' });
      setTimeout(() => navigate('/pedidos'), 1500);
    } catch (err) {
      setAlert({ title: 'Error', message: err.response?.data?.error || 'Error al enviar calificación' });
    } finally {
      setLoading(false);
    }
  };

  const StarInput = ({ field, label }) => (
    <div style={{ marginBottom: 16 }}>
      <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 6 }}>{label}</p>
      <div className="star-rating">
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} type="button"
            className={n <= form[field] ? 'active' : ''}
            onClick={() => setStar(field, n)}>
            ★
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="container">
      <div className="header">
        <button onClick={() => navigate(-1)} style={{ background: 'none', color: 'white', fontSize: 16 }}>←</button>
        <h1>Calificar</h1>
      </div>

      <form onSubmit={handleSubmit} className="card" style={{ marginTop: 16 }}>
        <StarInput field="calificacionGeneral" label="Calificación general" />
        <StarInput field="calidadProductos" label="Calidad de productos" />
        <StarInput field="tiempoPreparacion" label="Tiempo de preparación" />
        <StarInput field="tiempoEntrega" label="Tiempo de entrega" />
        <StarInput field="atencionComercio" label="Atención del comercio" />
        {pedidoData?.domiciliarioId && (
          <StarInput field="atencionDomiciliario" label="Atención del domiciliario" />
        )}

        <div className="input-group">
          <label>Comentario</label>
          <textarea value={form.comentario} onChange={e => setForm({ ...form, comentario: e.target.value })}
            rows={3} placeholder="Escribe tu opinión..." />
        </div>

        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Enviando...' : 'Enviar Calificación'}
        </button>
      </form>
      <AlertModal show={!!alert} title={alert?.title} message={alert?.message} onClose={() => setAlert(null)} />
    </div>
  );
}
