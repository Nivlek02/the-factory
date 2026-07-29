/**
 * Carga las campañas y las vuelve a leer al regresar a la pestaña.
 *
 * POR QUÉ: `hydrate()` corría una sola vez (`if (!isLoaded)`), así que una pestaña abierta desde la
 * mañana mostraba el estado de la mañana. Eso trae dos problemas distintos:
 *
 *  1. Se toman decisiones sobre datos viejos (una tarea que otra persona ya aprobó sigue
 *     apareciendo pendiente en "Mis tareas" o en Reportes).
 *  2. Al tocar cualquier cosa se escribía esa copia vieja encima del trabajo de los demás. Eso ya
 *     no puede pasar —la guardia de `data.revision` en factoryStore lo bloquea—, pero releer al
 *     volver es lo que evita llegar al conflicto.
 *
 * Estaba solo en `FactoryPage`; este hook lo comparten las tres vistas que leen campañas.
 *
 * No recarga si hay una escritura propia sin confirmar (`haySincronizacionPendiente`): sería
 * pisarse el cambio a uno mismo.
 */
import { useEffect } from 'react';
import { useFactoryStore, haySincronizacionPendiente } from '@/store/factoryStore';

export const useCampanasFrescas = () => {
  const { hydrate, isLoaded } = useFactoryStore();

  useEffect(() => {
    if (!isLoaded) hydrate();
  }, [isLoaded, hydrate]);

  useEffect(() => {
    const refrescar = () => {
      if (document.visibilityState === 'visible' && !haySincronizacionPendiente()) hydrate();
    };
    document.addEventListener('visibilitychange', refrescar);
    window.addEventListener('focus', refrescar);
    return () => {
      document.removeEventListener('visibilitychange', refrescar);
      window.removeEventListener('focus', refrescar);
    };
  }, [hydrate]);
};
