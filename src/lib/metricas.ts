/**
 * Tareas de métricas: cómo se llaman, de qué canal son y qué campos piden.
 *
 * POR QUÉ VIVE ACÁ: la misma tarea ("Recolectar métricas de Correo — 5 jul — Empresarios") la
 * leen tres sitios que antes la interpretaban cada uno a su manera —el dashboard de MapTab, el
 * formulario de FactoryPage y el panel del nodo de Envíos—, y dos de ellos la cortaban con
 * `/…de (\w+)/`. Ese `\w+` parte los nombres con espacio: "Google Ads" quedaba en "Google" y
 * "Call Center" en "Call". Teniendo la regla en un solo lugar, si mañana cambia el nombre de la
 * tarea no puede quedar la mitad de la app leyéndolo distinto.
 */

export const PREFIJO_METRICAS = 'Recolectar métricas de ';
export const PREFIJO_ENVIO = 'Configurar envío por ';
export const PREFIJO_PAUTA = 'Configurar campaña en ';

/** Separador entre el canal y su referencia (fecha — segmento) dentro del título de una tarea. */
const SEPARADOR_REF = ' — ';

/** ¿Es una tarea de recolección de métricas? */
export const esTareaDeMetricas = (tarea: string) => tarea.startsWith(PREFIJO_METRICAS);

/**
 * Canal al que pertenece una tarea de métricas.
 *
 * Se corta **por prefijo y por el separador**, nunca con `\w+`: el nombre del canal puede llevar
 * espacio ("Google Ads", "Call Center") y detrás puede venir la referencia del toque
 * ("— 5 jul — Empresarios"). Las tareas viejas, que solo traen el canal, siguen funcionando
 * porque simplemente no tienen separador.
 */
export const canalDeMetricas = (tarea: string): string =>
  tarea.slice(PREFIJO_METRICAS.length).split(SEPARADOR_REF)[0].trim();

/** Lo que sigue al canal en el título de un envío/pauta: "Correo — 5 jul — Empresarios" → la
 *  fecha y el segmento. Es lo que distingue dos toques del mismo canal en la misma campaña. */
const refDeTarea = (tarea: string, prefijo: string): string => {
  const resto = tarea.slice(prefijo.length);
  const i = resto.indexOf(SEPARADOR_REF);
  return i === -1 ? '' : resto.slice(i);
};

/** Canal de una tarea de envío ("Configurar envío por Correo — 5 jul" → "Correo"). */
export const canalDeEnvio = (tarea: string): string =>
  tarea.startsWith(PREFIJO_ENVIO) ? tarea.slice(PREFIJO_ENVIO.length).split(SEPARADOR_REF)[0].trim() : '';

/** Canal de una tarea de pauta ("Configurar campaña en Google Ads — Remarketing" → "Google Ads"). */
export const canalDePauta = (tarea: string): string =>
  tarea.startsWith(PREFIJO_PAUTA) ? tarea.slice(PREFIJO_PAUTA.length).split(SEPARADOR_REF)[0].trim() : '';

/**
 * Nombre de la tarea de métricas que le corresponde a un envío o a una pauta.
 *
 * Conserva la **referencia del toque** (fecha y segmento) a propósito: una campaña normal manda
 * varios correos (convocatoria, recordatorio, última llamada) y antes todos compartían el nombre
 * "Recolectar métricas de Correo". Como la creación se saltaba la tarea si ya existía una con ese
 * nombre, **del segundo envío en adelante nadie recogía métricas** y el dashboard mostraba una
 * sola salida. El canal se sigue leyendo con `canalDeMetricas`, que corta antes del separador.
 */
export const tareaDeMetricasPara = (tareaOrigen: string, canal: string, prefijo: string): string =>
  `${PREFIJO_METRICAS}${canal}${refDeTarea(tareaOrigen, prefijo)}`;

/**
 * ¿Este envío/pauta ya tiene su tarea de métricas?
 *
 * Se busca por ORIGEN (`sourceBriefId`) y no por nombre: una campaña normal manda varios correos
 * (convocatoria, recordatorio…) y antes todos generaban el mismo título —"Recolectar métricas de
 * Correo"—, así que como la creación se saltaba si ya existía una con ese nombre, **del segundo
 * envío en adelante nadie recogía métricas** y el dashboard mostraba una sola salida.
 *
 * Las tareas de métricas anteriores a este cambio no tienen `sourceBriefId`: se las sigue tratando
 * como la única del canal, para no duplicarlas al volver a guardar un envío viejo.
 */
export const yaTieneMetricas = (
  briefs: { tarea: string; sourceBriefId?: string | null }[],
  origenId: string,
  canal: string
): boolean =>
  briefs.some(
    (b) =>
      esTareaDeMetricas(b.tarea) &&
      canalDeMetricas(b.tarea) === canal &&
      (b.sourceBriefId === origenId || !b.sourceBriefId)
  );

export interface CampoMetrica {
  key: string;
  label: string;
}

/**
 * Campos que pide el formulario de métricas, por canal. Espejo de lo que muestra el dashboard
 * (`esCanalMedido`/`mideApertura` en MapTab): si acá se agrega un campo, allá hay que sumarlo.
 *
 * Correo es el único con apertura y con "Base total" (ver el comentario de `enviadosDe`); en
 * WhatsApp/SMS se pide directamente lo enviado. Cualquier otro canal —pauta, sobre todo— usa los
 * mismos dos campos genéricos: sus números viven en Meta/Google y no entran al dashboard, pero
 * la tarea igual tiene que poder llenarse.
 */
export const camposDeMetricas = (canal: string): CampoMetrica[] =>
  canal === 'Correo'
    ? [
        { key: 'baseTotal', label: 'Base total' },
        { key: 'enviados', label: 'Enviados' },
        { key: 'apertura', label: 'Apertura' },
        { key: 'clics', label: 'Clics' },
      ]
    : [
        { key: 'enviados', label: 'Enviados' },
        { key: 'clics', label: 'Clics' },
      ];
