/// <reference types="vite/client" />

/* Constantes inyectadas por `define` en vite.config.ts (ver src/lib/version.ts). */

/** Versión SemVer sacada de package.json — el número que se le muestra al usuario.
 *
 *  Es la ÚNICA constante inyectada. La hora del build y el id del build ya no entran al bundle a
 *  propósito: si entraran, cada compilación produciría un archivo distinto y el aviso de "nueva
 *  versión" saltaría en cada deploy aunque el código fuera idéntico (ver `hashDelBundle` en
 *  vite.config.ts y `BUILD_ID` en src/lib/version.ts). */
declare const __APP_VERSION__: string;
