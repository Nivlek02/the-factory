import { useState, useEffect, useCallback } from 'react';

/**
 * Detecta que el servidor ya tiene un build distinto al que corre en esta pestaña.
 *
 * Antes esto leía la tabla `app_version` de Supabase, pero nadie actualizaba esa fila nunca
 * (seguía en 1.0.0 desde su creación), así que el banner no se mostró jamás. Ahora compara el
 * BUILD_ID horneado en el bundle contra /version.json, que Vite regenera en cada build — así
 * funciona solo en cada deploy, sin depender de que alguien se acuerde de tocar la base.
 */

declare const __BUILD_ID__: string;

const DISMISS_KEY = 'tremu_dismissed_build';
const POLL_MS = 5 * 60 * 1000;

export const useAppVersion = () => {
  const [serverBuild, setServerBuild] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(() => {
    try {
      return localStorage.getItem(DISMISS_KEY);
    } catch {
      return null;
    }
  });

  const check = useCallback(async () => {
    try {
      // cache: 'no-store' es el punto: sin eso el navegador nos devolvería el version.json
      // viejo desde su caché y nunca veríamos el build nuevo.
      const res = await fetch('/version.json', { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as { buildId?: string };
      if (data?.buildId) setServerBuild(data.buildId);
    } catch {
      // Sin red o detrás de un proxy raro: no es motivo para romper nada.
    }
  }, []);

  useEffect(() => {
    check();

    const id = window.setInterval(check, POLL_MS);
    // Al volver a la pestaña, revisa de una: es cuando más probable es haberse quedado atrás.
    const onVisible = () => document.visibilityState === 'visible' && check();
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [check]);

  const hasNewVersion = !!serverBuild && serverBuild !== __BUILD_ID__ && serverBuild !== dismissed;

  const acknowledgeAndReload = () => {
    // Recargar trae el bundle nuevo, con lo cual __BUILD_ID__ pasa a coincidir solo.
    window.location.reload();
  };

  const dismissUpdate = () => {
    if (serverBuild) {
      try {
        localStorage.setItem(DISMISS_KEY, serverBuild);
      } catch {
        /* modo incógnito con storage bloqueado: se ignora */
      }
      setDismissed(serverBuild);
    }
  };

  return { currentVersion: serverBuild, hasNewVersion, acknowledgeAndReload, dismissUpdate };
};
