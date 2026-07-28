/// <reference types="vite/client" />

/* Constantes inyectadas por `define` en vite.config.ts (ver src/lib/version.ts). */

/** Versión SemVer sacada de package.json — el número que se le muestra al usuario. */
declare const __APP_VERSION__: string;
/** ISO string del momento del build. */
declare const __BUILD_TIME__: string;
/** SHA corto del commit (o timestamp si no hay git). Distingue deploys de la misma versión. */
declare const __BUILD_ID__: string;
