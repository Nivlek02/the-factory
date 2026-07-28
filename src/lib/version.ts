/**
 * Versión de la app — un solo lugar para leerla, compararla y aplicar la actualización.
 *
 * La fuente de verdad es `version` en package.json: vite.config.ts la hornea en el bundle
 * (`__APP_VERSION__`) y la publica en /version.json. Acá NO se escribe ningún número a mano.
 *
 * El `buildId`/`buildTime` sirven para distinguir dos deploys con la misma versión (lo normal
 * acá: se despliega varias veces sin subir el número). Al usuario solo se le muestra el SemVer.
 */

/** Info que publica cada build en /version.json. */
export interface VersionInfo {
  version: string;
  buildTime: string;
  buildId: string;
}

const fallback = (value: string | undefined, alt: string) =>
  typeof value === 'string' && value.length > 0 ? value : alt;

// typeof __X__ !== 'undefined' porque en un test o en un entorno sin el `define` de Vite
// (Node suelto, Vitest sin config) la constante simplemente no existe y referenciarla tiraría.
export const APP_VERSION: string =
  typeof __APP_VERSION__ !== 'undefined' ? fallback(__APP_VERSION__, '0.0.0') : '0.0.0';

export const BUILD_TIME: string =
  typeof __BUILD_TIME__ !== 'undefined' ? fallback(__BUILD_TIME__, '') : '';

export const BUILD_ID: string =
  typeof __BUILD_ID__ !== 'undefined' ? fallback(__BUILD_ID__, 'dev') : 'dev';

/** Lo que corre en esta pestaña, para comparar contra lo que publica el servidor. */
export const RUNNING_VERSION: VersionInfo = {
  version: APP_VERSION,
  buildTime: BUILD_TIME,
  buildId: BUILD_ID,
};

/** `v1.2.0` — el formato que se muestra en la UI. */
export const formatVersion = (version: string = APP_VERSION): string =>
  version ? `v${version}` : '';

/**
 * Trae /version.json del servidor. Devuelve null ante cualquier problema (sin red, 404, HTML
 * en vez de JSON porque el rewrite de SPA se lo tragó, JSON inválido): que no haya red nunca
 * puede romper la app, y un null simplemente significa "no sé, no aviso nada".
 */
export const fetchRemoteVersion = async (signal?: AbortSignal): Promise<VersionInfo | null> => {
  try {
    // El query param + no-store son el punto: sin eso el navegador (o el CDN) devolvería el
    // version.json viejo desde caché y el aviso no aparecería nunca.
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store', signal });
    if (!res.ok) return null;
    const data = (await res.json()) as Partial<VersionInfo> & { builtAt?: string };
    if (!data || typeof data.version !== 'string' || !data.version) return null;
    return {
      version: data.version,
      // `builtAt` es como se llamaba antes de unificar el formato; se acepta por si una pestaña
      // vieja lee un version.json nuevo o al revés.
      buildTime: data.buildTime ?? data.builtAt ?? '',
      buildId: data.buildId ?? '',
    };
  } catch {
    return null;
  }
};

/**
 * ¿Lo que hay en el servidor es más nuevo que lo que corre acá?
 *
 * Cuenta como actualización tanto un número de versión distinto como el MISMO número con otro
 * build (redeploy sin subir versión, que es el caso habitual en este proyecto — si algún día
 * molesta, se quita la segunda mitad de la comparación).
 */
export const isNewerVersion = (
  remote: VersionInfo | null | undefined,
  running: VersionInfo = RUNNING_VERSION,
): boolean => {
  if (!remote || !remote.version) return false;
  if (!running || !running.version) return false;
  if (remote.version !== running.version) return true;
  // Misma versión: solo avisa si el build cambió de verdad. Si el servidor no publica ni
  // buildId ni buildTime no hay con qué distinguirlos, así que no se avisa.
  const remoteBuild = remote.buildId || remote.buildTime;
  const runningBuild = running.buildId || running.buildTime;
  if (!remoteBuild || !runningBuild) return false;
  return remoteBuild !== runningBuild;
};

/** Clave estable de un build, para recordar cuál descartó el usuario. */
export const versionKey = (info: VersionInfo): string =>
  `${info.version}@${info.buildId || info.buildTime}`;

/**
 * Recarga trayendo el bundle nuevo de verdad. Sin limpiar caches / service workers el usuario
 * recarga, le vuelve a salir el bundle viejo y el aviso reaparece para siempre.
 */
export const applyUpdate = async (): Promise<void> => {
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    /* storage bloqueado (incógnito, políticas): se recarga igual */
  }
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.update()));
    }
  } catch {
    /* idem */
  }
  window.location.reload();
};
