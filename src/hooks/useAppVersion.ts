import { useState, useEffect, useCallback, useRef } from 'react';
import {
  APP_VERSION,
  RUNNING_VERSION,
  VersionInfo,
  applyUpdate,
  fetchRemoteVersion,
  formatVersion,
  isNewerVersion,
  versionKey,
} from '@/lib/version';

/**
 * Detecta que el servidor ya tiene un build distinto al que corre en esta pestaña.
 *
 * Antes esto leía la tabla `app_version` de Supabase, pero nadie actualizaba esa fila nunca
 * (seguía en 1.0.0 desde su creación), así que el banner no se mostró jamás. Ahora compara lo
 * que está horneado en el bundle contra /version.json, que Vite regenera en cada build — así
 * funciona solo en cada deploy, sin depender de que alguien se acuerde de tocar la base.
 */

const DISMISS_KEY = 'tremu_dismissed_build';
const POLL_MS = 15 * 60 * 1000;

export const useAppVersion = () => {
  const [remote, setRemote] = useState<VersionInfo | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(() => {
    try {
      return localStorage.getItem(DISMISS_KEY);
    } catch {
      return null;
    }
  });
  // El fetch en vuelo, para abortarlo al desmontar y no dejar un setState huérfano.
  const abortRef = useRef<AbortController | null>(null);

  const check = useCallback(async () => {
    // En dev no existe /version.json (lo emite el build), así que el fetch se lo comería el
    // servidor de Vite devolviendo index.html: no tiene sentido chequear nada acá.
    if (import.meta.env.DEV) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const info = await fetchRemoteVersion(controller.signal);
    if (info && !controller.signal.aborted) setRemote(info);
  }, []);

  useEffect(() => {
    check();

    const id = window.setInterval(check, POLL_MS);
    // El caso real es alguien que dejó la pestaña abierta días: al volver al frente se revisa
    // de una en vez de esperar hasta 15 minutos.
    const onVisible = () => document.visibilityState === 'visible' && check();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', check);

    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', check);
      abortRef.current?.abort();
    };
  }, [check]);

  const hasNewVersion =
    isNewerVersion(remote, RUNNING_VERSION) && !!remote && versionKey(remote) !== dismissed;

  const dismissUpdate = () => {
    if (!remote) return;
    // Se guarda el build descartado, no un "no molestar" a secas: el aviso vuelve cuando se
    // publique uno distinto, pero no reaparece a los 15 minutos con el mismo.
    const key = versionKey(remote);
    try {
      localStorage.setItem(DISMISS_KEY, key);
    } catch {
      /* modo incógnito con storage bloqueado: se ignora */
    }
    setDismissed(key);
  };

  return {
    /** Versión que corre en esta pestaña, ya formateada (`v1.2.0`). */
    currentVersion: formatVersion(APP_VERSION),
    /** Versión publicada en el servidor, formateada. Vacío mientras no se haya podido leer. */
    newVersion: remote ? formatVersion(remote.version) : '',
    /** true si el servidor publica una versión distinta (o el mismo número con otro build). */
    isSameVersionNumber: !!remote && remote.version === APP_VERSION,
    hasNewVersion,
    acknowledgeAndReload: applyUpdate,
    dismissUpdate,
  };
};
