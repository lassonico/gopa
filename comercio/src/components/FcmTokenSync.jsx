import { useEffect } from 'react';
import { useAuth } from '../App';
import { requestFcmToken, refreshFcmToken } from '../services/firebase';
import { auth as authApi } from '../services/api';

const CLAVE = 'fcmToken';
const CLAVE_FORZADO = 'fcmForzadoEn';
const CLAVE_REBIND = 'fcmRebindSw1';
const INTERVALO_MS = 6 * 60 * 60 * 1000;
const FORZAR_CADA_MS = 24 * 60 * 60 * 1000;

export default function FcmTokenSync() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return undefined;
    let activo = true;

    // forzar=true recrea la suscripción (recupera tokens muertos), pero con
    // límite de 1 vez al día para no generar tokens basura en cada apertura.
    const sincronizar = async (permitirForzar) => {
      try {
        const ultimoForzado = Number(localStorage.getItem(CLAVE_FORZADO) || 0);
        // Rebindeo único: enlaza la suscripción al SW de Firebase (no al del PWA).
        const necesitaRebind = !localStorage.getItem(CLAVE_REBIND);
        const debeForzar = necesitaRebind || (permitirForzar && Date.now() - ultimoForzado > FORZAR_CADA_MS);
        const token = debeForzar ? await requestFcmToken() : await refreshFcmToken();
        if (!activo || !token) return;
        if (debeForzar) {
          localStorage.setItem(CLAVE_FORZADO, String(Date.now()));
          localStorage.setItem(CLAVE_REBIND, '1');
        }
        if (localStorage.getItem(CLAVE) === token) return;
        await authApi.updateFcmToken(token);
        localStorage.setItem(CLAVE, token);
      } catch {
        // sin red o sesión expirada: se reintenta en el próximo disparo
      }
    };

    sincronizar(true);

    const alVolver = () => {
      if (document.visibilityState === 'visible') sincronizar(false);
    };
    document.addEventListener('visibilitychange', alVolver);
    const intervalo = setInterval(() => sincronizar(false), INTERVALO_MS);

    return () => {
      activo = false;
      document.removeEventListener('visibilitychange', alVolver);
      clearInterval(intervalo);
    };
  }, [user]);

  return null;
}
