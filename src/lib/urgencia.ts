/**
 * Semáforo de urgencia por cercanía a la fecha de una acción.
 * Cortes acordados con el usuario: rojo ≤2 días (incluye vencidas), amarillo ≤7, verde >7.
 */

export type NivelUrgencia = 'vencida' | 'roja' | 'amarilla' | 'verde';

export interface Urgencia {
  nivel: NivelUrgencia;
  /** Días calendario hasta la fecha: 0 = hoy, negativo = ya pasó. */
  dias: number;
  etiqueta: string;
  /** Clases Tailwind para el chip. Usa los tokens `state-*` del semáforo (rojo/ámbar/verde),
   *  que el rediseño Tremu ISO conservó a propósito por comunicar significado, y con el
   *  mismo patrón `bg-state-X-bg text-state-X` que ya usa DeliverableSummary. */
  className: string;
}

/** Medianoche local, para que la comparación sea por día calendario y no por hora. */
const aMedianoche = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Parsea 'YYYY-MM-DD' como fecha LOCAL. `new Date('2026-07-20')` la trataría como UTC y en
 *  zonas al oeste de Greenwich (Colombia, UTC-5) mostraría el día anterior. */
const parseISOLocal = (iso: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!m) {
    const suelta = new Date(iso);
    return Number.isNaN(suelta.getTime()) ? null : aMedianoche(suelta);
  }
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
};

export const diasHasta = (iso: string, hoy = new Date()): number | null => {
  const fecha = parseISOLocal(iso);
  if (!fecha) return null;
  const MS_DIA = 86_400_000;
  return Math.round((fecha.getTime() - aMedianoche(hoy).getTime()) / MS_DIA);
};

export const calcularUrgencia = (iso: string | null | undefined, hoy = new Date()): Urgencia | null => {
  if (!iso) return null;
  const dias = diasHasta(iso, hoy);
  if (dias === null) return null;

  if (dias < 0) {
    const n = Math.abs(dias);
    return {
      nivel: 'vencida',
      dias,
      etiqueta: n === 1 ? 'Venció ayer' : `Venció hace ${n} días`,
      className: 'bg-state-blocked-bg text-state-blocked',
    };
  }

  if (dias <= 2) {
    return {
      nivel: 'roja',
      dias,
      etiqueta: dias === 0 ? 'Hoy' : dias === 1 ? 'Mañana' : 'En 2 días',
      className: 'bg-state-blocked-bg text-state-blocked',
    };
  }

  if (dias <= 7) {
    return {
      nivel: 'amarilla',
      dias,
      etiqueta: `En ${dias} días`,
      className: 'bg-state-review-bg text-state-review',
    };
  }

  return {
    nivel: 'verde',
    dias,
    etiqueta: `En ${dias} días`,
    className: 'bg-state-done-bg text-state-done',
  };
};

/** 'YYYY-MM-DD' → '20 jul'. Devuelve el texto original si no parsea. */
export const formatFechaCorta = (iso: string | null | undefined): string => {
  if (!iso) return '';
  const fecha = parseISOLocal(iso);
  if (!fecha) return iso;
  return fecha.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
};

/** Fecha con día, mes y año (ej. "5 jul 2026"). Usa el mismo parseo local que evita el
 *  corrimiento de día por UTC en Colombia. */
export const formatFechaLarga = (iso: string | null | undefined): string => {
  if (!iso) return '';
  const fecha = parseISOLocal(iso);
  if (!fecha) return iso;
  return fecha.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
};
