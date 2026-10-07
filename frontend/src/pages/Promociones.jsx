import { useData } from '../contexts/DataContext';
import Loader from '../components/Loader';

export default function Promociones() {
  const { promos: list, loaded } = useData();

  if (!loaded) return <div className="loading"><Loader /></div>;

  return (
    <div className="container" style={{ paddingBottom: 80 }}>
      <div className="header"><h1>Promociones</h1></div>

      {list.length === 0 ? (
        <div className="empty-state">
          <h3>No hay promociones</h3>
          <p>Pronto tendremos ofertas especiales</p>
        </div>
      ) : list.map((promo, index) => (
        <div key={promo.id} className="card" style={{
          marginBottom: 12, 
          marginTop: index === 0 ? 16 : 0,
          background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
          color: 'white'
        }}>
          <h3 style={{ fontSize: 18, marginBottom: 4 }}>{promo.titulo}</h3>
          <p style={{ fontSize: 14, opacity: 0.9 }}>{promo.descripcion}</p>
          {promo.fechaVencimiento && (
            <p style={{ fontSize: 12, marginTop: 8, opacity: 0.7 }}>
              Válido hasta: {new Date(promo.fechaVencimiento).toLocaleDateString()}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
