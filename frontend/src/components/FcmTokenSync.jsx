import { useEffect } from 'react';
import { useAuth } from '../App';
import { refreshFcmToken } from '../services/firebase';
import { auth as authApi } from '../services/api';

const CLAVE = 'fcmToken';
const INTERVALO_MS = 6 * 60 * 60 * 1000;

export default function FcmTokenSync() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return undefined;
    let activo = true;

    const sincronizar = async () => {
      try {
        const token = await refreshFcmToken();
        if (!activo || !token) return;
        if (localStorage.getItem(CLAVE) === token) return;
        await authApi.updateFcmToken(token);
        localStorage.setItem(CLAVE, token);
      } catch {
        // sin red o sesión expirada: se reintenta en el próximo disparo
      }
    };

    sincronizar();

    const alVolver = () => {
      if (document.visibilityState === 'visible') sincronizar();
    };
    document.addEventListener('visibilitychange', alVolver);
    const intervalo = setInterval(sincronizar, INTERVALO_MS);

    return () => {
      activo = false;
      document.removeEventListener('visibilitychange', alVolver);
      clearInterval(intervalo);
    };
  }, [user]);

  return null;
}
