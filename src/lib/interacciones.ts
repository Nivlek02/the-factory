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
 * Interacciones estándar que aplican a cada canal. Solo el correo tiene apertura; WhatsApp y SMS
 * tienen clic pero no "abre". En los demás (Call Center, BTL, KAM, Relacionamiento, pauta) esos
 * chips no significan nada — ahí la interacción esperada se escribe a mano ("agenda cita",
 * "pide info"…), así que el canal solo admite valores personalizados.
 */
const INTERACCIONES_POR_CANAL: Record<string, readonly InteraccionEstandar[]> = {
  Correo: ['Abre', 'No abre', 'Clic', 'No clic', 'Visita landing'],
  WhatsApp: ['Clic', 'No clic', 'Visita landing'],
  SMS: ['Clic', 'No clic', 'Visita landing'],
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
