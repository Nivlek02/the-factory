import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { execSync } from "child_process";
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

/**
 * Identificador único de este build. Vercel expone el SHA del commit; en local se saca de git;
 * si nada de eso existe (ej. un tarball sin .git) cae a la hora del build, que igual cambia
 * en cada compilación. NO es lo que se le muestra al usuario (para eso está APP_VERSION):
 * sirve para distinguir dos deploys con el mismo número de versión.
 */
function resolveBuildId(): string {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  if (sha) return sha.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return String(Date.now());
  }
}

const BUILD_ID = resolveBuildId();
const BUILD_TIME = new Date().toISOString();

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
    generateBundle(this: { emitFile: (f: { type: "asset"; fileName: string; source: string }) => void }) {
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: JSON.stringify({
          version: APP_VERSION,
          buildTime: BUILD_TIME,
          buildId: BUILD_ID,
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
    __APP_VERSION__: JSON.stringify(APP_VERSION),
    __BUILD_TIME__: JSON.stringify(BUILD_TIME),
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  plugins: [react(), mode === "development" && componentTagger(), versionFilePlugin()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
