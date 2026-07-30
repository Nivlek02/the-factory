import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { readFileSync } from "fs";
import { componentTagger } from "lovable-tagger";

/**
 * `package.json` es la ÚNICA fuente de verdad de la versión. De acá sale el número que se
 * hornea en el bundle, el que se publica en version.json y el que se ve en la UI — no debe
 * haber un "1.2.0" escrito a mano en ningún otro archivo. Para publicar:
 * `npm version patch|minor|major --no-git-tag-version` (ver CHANGELOG.md).
 */
const APP_VERSION: string = JSON.parse(
  readFileSync(path.resolve(__dirname, "package.json"), "utf-8"),
).version;

const BUILD_TIME = new Date().toISOString();

/**
 * El identificador del build es **el hash de contenido del bundle**, no el SHA del commit.
 *
 * POR QUÉ: el aviso de "nueva versión" salta cuando el build del servidor no coincide con el que
 * corre en la pestaña. Cuando el id era el SHA de git —y encima iba horneado dentro del bundle—
 * **cualquier commit generaba un bundle distinto**, así que un cambio solo de documentación le
 * sacaba a todo el equipo el aviso de una versión nueva que no existía. Pasó exactamente eso con
 * dos commits de CLAUDE.md.
 *
 * Con el hash de contenido, dos builds del mismo código dan el mismo id y no se avisa nada; en
 * cuanto cambia una línea de código el nombre del bundle cambia y el aviso vuelve a salir.
 *
 * Ojo: para que esto funcione, `__BUILD_ID__` y `__BUILD_TIME__` **ya no se inyectan en el
 * bundle** — si estuvieran dentro, el contenido cambiaría en cada compilación y volveríamos al
 * mismo problema. La pestaña averigua su propio id leyendo el nombre de su archivo con
 * `import.meta.url` (ver src/lib/version.ts).
 */
function hashDelBundle(bundle: Record<string, { type: string; isEntry?: boolean; fileName: string }>): string {
  const entrada = Object.values(bundle).find((c) => c.type === "chunk" && c.isEntry);
  // `assets/index-DQTgJBmR.js` → `DQTgJBmR`, el hash de contenido que le pone Vite.
  const m = entrada?.fileName.match(/-([A-Za-z0-9_-]+)\.js$/);
  return m?.[1] ?? BUILD_TIME;
}

/**
 * Escribe version.json junto al bundle. El navegador lo consulta con cache: 'no-store' para
 * saber si el servidor ya tiene un build distinto al que está corriendo. Va como archivo
 * estático (no en la base) para que se actualice solo en cada deploy, sin que nadie tenga
 * que acordarse de tocar nada.
 *
 * Ojo: `vercel.json` tiene que excluirlo del rewrite de SPA y mandarle Cache-Control sin caché,
 * o el CDN devolvería siempre el mismo archivo y el aviso no aparecería nunca.
 */
function versionFilePlugin() {
  return {
    name: "tremu-version-file",
    generateBundle(
      this: { emitFile: (f: { type: "asset"; fileName: string; source: string }) => void },
      _opciones: unknown,
      bundle: Record<string, { type: string; isEntry?: boolean; fileName: string }>,
    ) {
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: JSON.stringify({
          version: APP_VERSION,
          buildTime: BUILD_TIME,
          buildId: hashDelBundle(bundle),
          // Compatibilidad con pestañas que quedaron abiertas con el bundle anterior, que leía
          // `builtAt`. Se puede quitar unos deploys después de este.
          builtAt: BUILD_TIME,
        }),
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  define: {
    // Solo la versión: es lo único que se le muestra al usuario y solo cambia cuando cambia de
    // verdad. Ni el build id ni la hora entran acá a propósito — ver `hashDelBundle`.
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  plugins: [react(), mode === "development" && componentTagger(), versionFilePlugin()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
