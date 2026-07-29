/**
 * Interacciones esperadas de un toque del Plan de canales.
 *
 * Vive acá y no en el wizard porque lo necesitan los dos lados: el wizard para decidir qué chips
 * ofrecer, y el diagrama del ecosistema (MapTab) para decidir qué mostrar. Antes la regla vivía
 * solo en el wizard, así que el diagrama seguía pintando "Call Center: Clic, No clic" con
 * selecciones viejas que ya no se pueden hacer.
 */

export const INTERACCION_OPCIONES = ['Abre', 'No abre', 'Clic', 'No clic', 'Visita landing'] as const;

export type InteraccionEstandar = (typeof INTERACCION_OPCIONES)[number];

/**
 * Interacciones estándar que aplican a cada canal — lo que ese canal REALMENTE puede medir.
 * Solo el correo tiene apertura, y es el único que distingue el negativo (no abre / no hace clic).
 * De WhatsApp y SMS solo se puede medir el clic. "Visita landing" salió de todos: no se mide en
 * el canal, se mide en la landing. En los demás (Call Center, BTL, KAM, Relacionamiento, pauta)
 * estos chips no significan nada — ahí la interacción esperada se escribe a mano ("agenda cita",
 * "pide info"…), así que el canal solo admite valores personalizados.
 *
 * Nota: `INTERACCION_OPCIONES` sí conserva 'Visita landing' y 'No clic' a propósito — es la lista
 * de "qué es estándar", y sacarlas de ahí haría que lo ya guardado reapareciera como chip
 * personalizado en vez de simplemente dejar de ofrecerse.
 */
const INTERACCIONES_POR_CANAL: Record<string, readonly InteraccionEstandar[]> = {
  Correo: ['Abre', 'No abre', 'Clic', 'No clic'],
  WhatsApp: ['Clic'],
  SMS: ['Clic'],
};

/** Opciones estándar que se le ofrecen a un canal. Vacío = solo texto libre. */
export const opcionesDeCanal = (canal: string): readonly InteraccionEstandar[] =>
  INTERACCIONES_POR_CANAL[canal] ?? [];

const esEstandar = (v: string): v is InteraccionEstandar =>
  (INTERACCION_OPCIONES as readonly string[]).includes(v);

/** Lista de interacciones de un toque, tolerando el formato legacy de una sola (`interaccion`). */
export const interaccionesDe = (row: { interaccion?: string; interacciones?: string[] }): string[] =>
  row.interacciones ?? (row.interaccion ? [row.interaccion] : []);

/**
 * Las interacciones que valen para ese canal: las personalizadas siempre, y las estándar solo si
 * el canal las admite. Filtra los residuos de datos guardados antes de que la regla existiera
 * (ej. un "Clic" en un Call Center) sin tener que tocar la base: si el canal no admite ninguna
 * estándar, devuelve solo lo que se escribió a mano — y si no se escribió nada, un array vacío.
 */
export const interaccionesValidas = (
  canal: string,
  row: { interaccion?: string; interacciones?: string[] },
): string[] => {
  const permitidas = opcionesDeCanal(canal);
  return interaccionesDe(row).filter((v) => !esEstandar(v) || permitidas.includes(v));
};

/**
 * Flujo de trabajo de la etapa de Interacción: qué tarea deja cada interacción y sobre quién cae.
 *
 * OJO — esto es SOLO para el diagrama del ecosistema (documenta el flujo acordado); no crea
 * tareas reales ni tiene nada que ver con el Dashboard de métricas, que sigue midiendo
 * enviados/apertura/clics por su cuenta.
 *
 * Regla acordada: solo el correo dispara acciones, y solo por el lado negativo — a quien no abre
 * o no hace clic hay que escribirle un copy distinto y volvérselo a enviar, de ahí que la tarea
 * caiga sobre Copywriter (redactar) y Gestor de canales (enviar). El clic de WhatsApp y SMS se
 * mide, pero no dispara nada.
 */
export type AccionInteraccion = { tarea: string; roles: readonly string[] };

const REENVIO_ROLES = ['Copywriter', 'Gestor de canales'] as const;

const ACCIONES_POR_INTERACCION: Record<string, Record<string, AccionInteraccion>> = {
  Correo: {
    'No abre': { tarea: 'Copy alterno para quienes no abrieron + reenvío', roles: REENVIO_ROLES },
    'No clic': { tarea: 'Copy con otro llamado a la acción para quienes no hicieron clic + reenvío', roles: REENVIO_ROLES },
  },
};

/** La tarea que dispara una interacción, o `null` si esa interacción solo se mide. */
export const accionDeInteraccion = (canal: string, interaccion: string): AccionInteraccion | null =>
  ACCIONES_POR_INTERACCION[canal]?.[interaccion] ?? null;
