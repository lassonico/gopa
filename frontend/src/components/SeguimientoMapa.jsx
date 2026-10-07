import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const iconoRepartidor = L.divIcon({
  html: '<div style="font-size:26px;line-height:26px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.35))">🛵</div>',
  className: '',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

const iconoDestino = L.divIcon({
  html: '<div style="font-size:26px;line-height:26px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.35))">📍</div>',
  className: '',
  iconSize: [26, 26],
  iconAnchor: [13, 26],
});

function AjustarVista({ puntos }) {
  const map = useMap();
  const clave = JSON.stringify(puntos);
  useEffect(() => {
    const pts = JSON.parse(clave);
    if (!pts.length) return;
    if (pts.length === 1) {
      map.setView(pts[0], 16);
    } else {
      map.fitBounds(pts, { padding: [34, 34] });
    }
  }, [map, clave]);
  return null;
}

export default function SeguimientoMapa({ repartidor, destino, height = 220 }) {
  const puntos = [];
  const rep = [];
  if (repartidor) {
    rep.push([repartidor.lat, repartidor.lng]);
    puntos.push([repartidor.lat, repartidor.lng]);
  }
  if (destino) {
    puntos.push([destino.lat, destino.lng]);
  }
  const centro = puntos[0] || [2.9355, -75.2818];
  const autoRuta = rep.length && destino ? [rep[0], [destino.lat, destino.lng]] : [];

  return (
    <MapContainer
      center={centro}
      zoom={15}
      scrollWheelZoom={false}
      style={{ width: '100%', height, borderRadius: 10, zIndex: 0 }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {destino && (
        <Marker position={[destino.lat, destino.lng]} icon={iconoDestino} />
      )}
      {repartidor && (
        <Marker position={[repartidor.lat, repartidor.lng]} icon={iconoRepartidor} />
      )}
      {autoRuta.length === 2 && (
        <Polyline positions={autoRuta} pathOptions={{ color: '#aa1c41', dashArray: '6 8', weight: 3 }} />
      )}
      <AjustarVista puntos={puntos} />
    </MapContainer>
  );
}
