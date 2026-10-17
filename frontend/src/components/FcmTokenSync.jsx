import { useEffect } from 'react';
import { useAuth } from '../App';
import { requestFcmToken, refreshFcmToken } from '../services/firebase';
import { auth as authApi } from '../services/api';

const CLAVE = 'fcmToken';
const INTERVALO_MS = 6 * 60 * 60 * 1000;

export default function FcmTokenSync() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return undefined;
    let activo = true;

    // forzar=true pide una suscripción nueva (al abrir la app); false reutiliza.
    const sincronizar = async (forzar) => {
      try {
        const token = forzar ? await requestFcmToken() : await refreshFcmToken();
        if (!activo || !token) return;
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
