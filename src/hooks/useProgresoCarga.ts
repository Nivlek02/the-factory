import { useEffect, useState } from 'react';

/**
 * Progreso estimado (0-100) para esperas que no se pueden medir de verdad.
 *
 * Acá la espera no es descargar bytes sino que el servidor responda (n8n consultando Zoom), así
 * que una barra por `Content-Length` se quedaría en 0% todo el rato y saltaría a 100% de golpe:
 * peor que no tener nada. En vez de eso avanza sobre el tiempo transcurrido con una curva que se
 * acerca al techo sin llegar nunca (1 - e^-t) — nunca miente diciendo "100%" antes de tiempo, y
 * al terminar salta al 100% real y se queda un instante para que se vea que cerró.
 *
 * `visible` se mantiene en true ese instante extra; úsalo para decidir si sigues mostrando la
 * pantalla de carga (si usas solo `activo`, el 100% no alcanza a verse nunca).
 */
export const useProgresoCarga = (
  activo: boolean,
  { techo = 92, duracionEstimadaMs = 3500, cierreMs = 350 } = {},
) => {
  const [progreso, setProgreso] = useState(0);
  const [visible, setVisible] = useState(activo);

  useEffect(() => {
    if (activo) {
      setVisible(true);
      setProgreso(0);
      const inicio = Date.now();
      const id = window.setInterval(() => {
        const t = (Date.now() - inicio) / duracionEstimadaMs;
        setProgreso(Math.min(techo, Math.round(techo * (1 - Math.exp(-t)))));
      }, 100);
      return () => window.clearInterval(id);
    }

    setProgreso(100);
    const id = window.setTimeout(() => setVisible(false), cierreMs);
    return () => window.clearTimeout(id);
  }, [activo, techo, duracionEstimadaMs, cierreMs]);

  return { progreso, visible };
};
