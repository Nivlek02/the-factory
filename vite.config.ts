import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { execSync } from "child_process";
import { componentTagger } from "lovable-tagger";

/**
 * Identificador único de este build. Vercel expone el SHA del commit; en local se saca de git;
 * si nada de eso existe (ej. un tarball sin .git) cae a la hora del build, que igual cambia
 * en cada compilación. Es lo que compara el banner "Nueva versión disponible".
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

/**
 * Escribe version.json junto al bundle. El navegador lo consulta con cache: 'no-store' para
 * saber si el servidor ya tiene un build distinto al que está corriendo. Va como archivo
 * estático (no en la base) para que se actualice solo en cada deploy, sin que nadie tenga
 * que acordarse de tocar nada.
 */
function versionFilePlugin() {
  return {
    name: "tremu-version-file",
    generateBundle(this: { emitFile: (f: { type: "asset"; fileName: string; source: string }) => void }) {
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: JSON.stringify({ buildId: BUILD_ID, builtAt: new Date().toISOString() }),
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
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  plugins: [react(), mode === "development" && componentTagger(), versionFilePlugin()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
