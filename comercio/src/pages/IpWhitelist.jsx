import { useState, useEffect } from 'react';
import { useAuth } from '../App';
import api, { comercio } from '../services/api';

export default function IpWhitelist() {
  const { user } = useAuth();
  const [allowedIps, setAllowedIps] = useState([]);
  const [newIp, setNewIp] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [testingIp, setTestingIp] = useState('');
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    cargarWhitelist();
  }, []);

  const cargarWhitelist = async () => {
    try {
      const { data } = await comercio.getIpWhitelist(user.comercioId);
      setAllowedIps(data.allowedIps || []);
    } catch (e) {
      console.error('Error cargando whitelist:', e);
    }
  };

  const handleAddIp = () => {
    const ip = newIp.trim();
    if (!ip) return;
    
    // Validación básica
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$|^(\d{1,3}\.){3}\*$|^(\d{1,3}\.){2}\*\.\*$|^(\d{1,3}\.)\*\.\*\.\*$/;
    if (!ipRegex.test(ip)) {
      setMessage({ type: 'error', text: 'Formato inválido. Usa: 192.168.1.1, 192.168.1.0/24, o 192.168.1.*' });
      return;
    }
    
    if (allowedIps.includes(ip)) {
      setMessage({ type: 'error', text: 'Esta IP ya está en la lista' });
      return;
    }

    setAllowedIps(prev => [...prev, ip]);
    setNewIp('');
    setMessage(null);
  };

  const handleRemoveIp = (ip) => {
    setAllowedIps(prev => prev.filter(i => i !== ip));
  };

  const handleSave = async () => {
    setLoading(true);
    setMessage(null);
    try {
      await comercio.updateIpWhitelist(user.comercioId, { allowedIps });
      setMessage({ type: 'success', text: 'Whitelist guardada correctamente' });
    } catch (e) {
      setMessage({ type: 'error', text: e.response?.data?.error || 'Error guardando' });
    } finally {
      setLoading(false);
    }
  };

  const handleTestIp = async () => {
    const ip = testingIp.trim();
    if (!ip) return;
    
    setTestResult({ testing: true });
    try {
      const { data } = await api.post(`/comercios/${user.comercioId}/ip-whitelist/test`, { ip });
      setTestResult({ 
        testedIp: data.testedIp,
        isAllowed: data.isAllowed,
        message: data.message,
        testing: false
      });
    } catch (e) {
      setTestResult({ 
        testedIp: ip,
        isAllowed: false,
        message: e.response?.data?.error || 'Error probando IP',
        testing: false
      });
    }
  };

  const formatIp = (ip) => {
    if (ip.includes('/')) return <span className="cidr-badge">{ip}</span>;
    if (ip.includes('*')) return <span className="wildcard-badge">{ip}</span>;
    return ip;
  };

  return (
    <div className="container" style={{ maxWidth: 600, padding: 24 }}>
      <h1 style={{ color: '#5E244E', marginBottom: 24 }}>Whitelist de IPs</h1>
      
      <div className="card" style={{ padding: 24 }}>
        <h2 style={{ marginBottom: 8, color: '#5E244E' }}>Control de Acceso por IP</h2>
        <p style={{ color: 'var(--gray-600)', marginBottom: 24, fontSize: 14 }}>
          Restringe el acceso al panel de comercio solo a las IPs autorizadas. 
          Si la lista está vacía, se permite acceso desde cualquier IP.
        </p>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <input
            type="text"
            value={newIp}
            onChange={e => setNewIp(e.target.value)}
            placeholder="Ej: 192.168.1.1, 192.168.1.0/24, 192.168.1.*"
            style={{ flex: 1, padding: '10px 12px', border: '2px solid var(--gray-200)', borderRadius: 8, fontSize: 14 }}
            onKeyDown={e => e.key === 'Enter' && handleAddIp()}
          />
          <button onClick={handleAddIp} className="btn btn-primary" style={{ padding: '10px 16px' }}>
            Agregar IP
          </button>
        </div>

        {allowedIps.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--gray-400)' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔓</div>
            <p>Sin restricciones de IP - Acceso permitido desde cualquier lugar</p>
            <p style={{ fontSize: 12, marginTop: 8 }}>Agrega IPs para restringir el acceso</p>
          </div>
        ) : (
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ marginBottom: 12, fontSize: 14, color: 'var(--gray-600)' }}>
              IPs autorizadas ({allowedIps.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {allowedIps.map((ip, idx) => (
                <div key={idx} style={{ 
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 16px', background: 'var(--gray-50)', borderRadius: 8
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {ip.includes('/') ? (
                      <span style={{ background: '#DBEAFE', color: '#1E40AF', padding: '2px 8', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>CIDR</span>
                    ) : ip.includes('*') ? (
                      <span style={{ background: '#FEF3C7', color: '#92400E', padding: '2px 8', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>Comodín</span>
                    ) : (
                      <span style={{ background: '#DCFCE7', color: '#166534', padding: '2px 8', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>IP exacta</span>
                    )}
                    <code style={{ fontFamily: 'monospace', fontSize: 13, color: '#5E244E' }}>{ip}</code>
                  </div>
                  <button 
                    onClick={() => handleRemoveIp(ip)}
                    style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 18, padding: 4 }}
                    title="Eliminar"
                  >🗑</button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--gray-200)' }}>
          <button 
            onClick={handleSave}
            disabled={loading}
            className="btn btn-primary"
            style={{ flex: 1, padding: '14px', fontSize: 15 }}
          >
            {loading ? 'Guardando...' : 'Guardar Whitelist'}
          </button>
          <button 
            onClick={() => { setAllowedIps([]); setMessage({ type: 'success', text: 'Whitelist limpiada - acceso abierto' }); }}
            className="btn btn-secondary"
            style={{ padding: '14px 24px' }}
          >
            Limpiar todo
          </button>
        </div>
      </div>

      {/* Test IP Section */}
      <div className="card" style={{ padding: 24, marginTop: 16 }}>
        <h2 style={{ marginBottom: 16, color: '#5E244E' }}>Probar IP</h2>
        <p style={{ color: 'var(--gray-600)', marginBottom: 16, fontSize: 14 }}>
          Verifica si una IP específica tendría acceso con la configuración actual.
        </p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <input
            type="text"
            value={testingIp}
            onChange={e => setTestingIp(e.target.value)}
            placeholder="IP a probar (ej: 192.168.1.50)"
            style={{ flex: 1, padding: '10px 12px', border: '2px solid var(--gray-200)', borderRadius: 8, fontSize: 14 }}
            onKeyDown={e => e.key === 'Enter' && handleTestIp()}
          />
          <button onClick={handleTestIp} className="btn btn-secondary" style={{ padding: '10px 16px' }} disabled={!testingIp.trim()}>
            Probar IP
          </button>
        </div>

        {testResult && (
          <div style={{
            padding: 16, borderRadius: 8,
            background: testResult.isAllowed ? '#DCFCE7' : '#FEE2E2',
            border: `1px solid ${testResult.isAllowed ? '#166534' : '#991B1B'}`
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 24 }}>{testResult.isAllowed ? '✅' : '🚫'}</span>
              <strong style={{ color: testResult.isAllowed ? '#166534' : '#991B1B' }}>
                {testResult.isAllowed ? 'IP PERMITIDA' : 'IP BLOQUEADA'}
              </strong>
              {testResult.testing && <span style={{ marginLeft: 'auto' }}>⏳ Probando...</span>}
            </div>
            <p style={{ margin: 0, fontSize: 14, color: testResult.isAllowed ? '#166534' : '#991B1B' }}>
              {testResult.message}
            </p>
            {testResult.allowedIps?.length > 0 && (
              <p style={{ margin: 8, fontSize: 12, color: 'var(--gray-500)' }}>
                IPs en whitelist: {testResult.allowedIps.join(', ')}
              </p>
            )}
          </div>
        )}

        {message && (
          <div style={{ 
            marginTop: 16, padding: 12, borderRadius: 8,
            background: message.type === 'success' ? '#DCFCE7' : '#FEE2E2',
            color: message.type === 'success' ? '#166534' : '#991B1B'
          }}>
            {message.text}
          </div>
        )}
      </div>

      {/* Formatos de ejemplo */}
      <div className="card" style={{ padding: 24, marginTop: 16, background: '#FAFAFA' }}>
        <h3 style={{ marginBottom: 12, color: '#5E244E', fontSize: 14 }}>Formatos válidos</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, fontSize: 13 }}>
          <div style={{ padding: 12, background: 'white', borderRadius: 8, border: '1px solid var(--gray-200)' }}>
            <strong style={{ color: '#5E244E' }}>IP exacta</strong>
            <code style={{ display: 'block', marginTop: 4, color: '#5E244E' }}>192.168.1.100</code>
            <p style={{ margin: 4, fontSize: 11, color: 'var(--gray-500)' }}>Una sola dirección IP</p>
          </div>
          <div style={{ padding: 12, background: 'white', borderRadius: 8, border: '1px solid var(--gray-200)' }}>
            <strong style={{ color: '#1E40AF' }}>CIDR (rango)</strong>
            <code style={{ display: 'block', marginTop: 4, color: '#1E40AF' }}>192.168.1.0/24</code>
            <p style={{ margin: 4, fontSize: 11, color: 'var(--gray-500)' }}>256 IPs (192.168.1.0 - 192.168.1.255)</p>
          </div>
          <div style={{ padding: 12, background: 'white', borderRadius: 8, border: '1px solid var(--gray-200)' }}>
            <strong style={{ color: '#92400E' }}>Comodín</strong>
            <code style={{ display: 'block', marginTop: 4, color: '#92400E' }}>192.168.1.*</code>
            <p style={{ margin: 4, fontSize: 11, color: 'var(--gray-500)' }}>Todas las IPs que empiezan por 192.168.1.</p>
          </div>
          <div style={{ padding: 12, background: 'white', borderRadius: 8, border: '1px solid var(--gray-200)' }}>
            <strong style={{ color: '#065F46' }}>Tu IP actual</strong>
            <code style={{ display: 'block', marginTop: 4, color: '#065F46' }} id="current-ip">Cargando...</code>
            <button onClick={() => { navigator.clipboard.writeText(document.getElementById('current-ip').textContent); alert('IP copiada'); }} style={{ marginTop: 4, fontSize: 11, padding: '4px 8' }}>Copiar</button>
          </div>
        </div>
      </div>
    </div>
  );
}