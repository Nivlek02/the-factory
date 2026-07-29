/**
 * Borrador de la campaña que se está creando.
 *
 * El asistente lo guarda solo cada pocos segundos mientras lo llenas, y lo restaura al abrirlo.
 * Este módulo existe para que la lista de campañas también pueda saber que hay uno pendiente y
 * ofrecer terminarlo — antes el asistente guardaba y leía la clave por su cuenta, así que desde
 * fuera no había forma de enterarse (el `hasDraft` que ya existía nunca se llegó a usar).
 *
 * Vive en `localStorage`, o sea **en el navegador donde se empezó**: si la persona cambia de
 * computador, el borrador no viaja con ella. Para eso habría que guardarlo en la base, lo que
 * implica decidir dónde y quién puede verlo.
 */
export const DRAFT_KEY = 'factory-project-draft';

/** Lo que le interesa a quien solo quiere *avisar* que hay un borrador. El asistente guarda
 *  bastante más (todos sus campos); acá solo se leen estos, y con tolerancia: un borrador viejo
 *  sin `guardadoEn` sigue siendo válido. */
export interface ResumenBorrador {
  nombre: string;
  paso: number;
  guardadoEn: string | null;
}

/** El borrador pendiente, o `null` si no hay o está corrupto. Nunca lanza: un JSON inválido en
 *  localStorage no puede tumbar la lista de campañas. */
export const leerBorrador = (): ResumenBorrador | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      nombre: (parsed?.data?.name ?? '').trim(),
      paso: typeof parsed?.step === 'number' ? parsed.step : 0,
      guardadoEn: typeof parsed?.guardadoEn === 'string' ? parsed.guardadoEn : null,
    };
  } catch {
    return null;
  }
};

export const borrarBorrador = () => {
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* nada que hacer */ }
};

/** "hace un momento" / "hace 5 min" / "ayer". Para que el aviso diga qué tan viejo es el borrador
 *  sin obligar a nadie a interpretar una fecha completa. */
export const hace = (iso: string | null): string => {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '';
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'hace un momento';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'ayer' : `hace ${d} días`;
};
