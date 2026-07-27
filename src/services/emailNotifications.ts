/**
 * Notificaciones por correo de las campañas de La Fábrica.
 *
 * Este módulo NO envía correo ni conoce direcciones: arma el contexto de lo que pasó (campaña,
 * tareas, rol responsable) y se lo pasa a la edge function `notificar-correo`, que resuelve los
 * destinatarios contra `usuarios_roles` con el service_role. Mandar direcciones desde el
 * navegador convertiría la función en un relay abierto — ver el comentario de seguridad allá.
 *
 * Regla de oro: notificar NUNCA puede romper ni frenar la acción del usuario. Todo es
 * fire-and-forget y los errores solo se loguean; si el correo falla, la tarea igual se guardó.
 */
import { supabase } from '@/integrations/supabase/client';
import type { FactoryProject, FabricaBriefItem } from '@/store/factoryStore';

type Evento = 'tarea.asignada' | 'tarea.en_revision' | 'tarea.aprobada' | 'tarea.correccion';

interface Payload {
  evento: Evento | 'prueba';
  campana?: { nombre: string; cliente?: string };
  tareas?: string[];
  rolLabel?: string;
  miembros?: string[];
  estratega?: string;
  nota?: string;
  fecha?: string;
}

interface Respuesta {
  success: boolean;
  error?: string;
  /** Solo en la prueba: a dónde fue realmente (puede diferir si hay modo de prueba activo). */
  enviadoA?: string[];
  modoPrueba?: boolean;
}

const invocar = async (body: Payload): Promise<Respuesta> => {
  const { data, error } = await supabase.functions.invoke('notificar-correo', { body });

  // invoke() marca error para cualquier no-2xx, pero el motivo real viene en el cuerpo.
  if (error) {
    const detalle = await (error as { context?: Response }).context
      ?.json()
      .then((b: { error?: string }) => b?.error)
      .catch(() => null);
    return { success: false, error: detalle ?? error.message };
  }
  if (data?.error) return { success: false, error: data.error as string };
  return { success: true, ...(data ?? {}) };
};

/** Dispara sin bloquear: quien llama sigue su flujo aunque el correo tarde o falle. */
const disparar = (body: Payload) => {
  void invocar(body).then((r) => {
    if (!r.success) console.warn('[notificar-correo] no se envió:', r.error);
  });
};

/**
 * Personas del grupo de rol en esa campaña. Mismo criterio que `flattenCampaignTasks`
 * (roleId o roleLabel), para que el correo le llegue exactamente a quien ve la tarea en
 * "Mis tareas". Si el grupo está vacío, la edge function cae a todos los del rol.
 */
const miembrosDelRol = (project: FactoryProject, roleId: string, roleLabel: string): string[] =>
  project.roleGroups?.find((g) => g.roleId === roleId || g.roleLabel === roleLabel)
    ?.members.map((m) => m.name) ?? [];

const campanaDe = (project: FactoryProject) => ({
  nombre: project.name,
  cliente: project.client || undefined,
});

type BriefLike = Pick<FabricaBriefItem, 'roleId' | 'roleLabel' | 'tarea'> &
  Partial<Pick<FabricaBriefItem, 'fechaAccion'>>;

/**
 * Tareas nuevas para el equipo. Se agrupan por rol y sale UN correo por rol, no uno por tarea:
 * crear una campaña siembra ~10 entregables de golpe y diez correos seguidos serían ruido.
 */
export const notificarTareasAsignadas = (project: FactoryProject, briefs: BriefLike[]) => {
  const porRol = new Map<string, BriefLike[]>();
  for (const b of briefs) {
    if (!b.tarea?.trim() || !b.roleLabel) continue;
    const clave = `${b.roleId}||${b.roleLabel}`;
    porRol.set(clave, [...(porRol.get(clave) ?? []), b]);
  }

  for (const [clave, items] of porRol) {
    const [roleId, roleLabel] = clave.split('||');
    disparar({
      evento: 'tarea.asignada',
      campana: campanaDe(project),
      tareas: items.map((b) => b.tarea),
      rolLabel: roleLabel,
      miembros: miembrosDelRol(project, roleId, roleLabel),
      // Solo tiene sentido mostrar la fecha si todas las tareas del correo comparten una.
      fecha: items.every((b) => b.fechaAccion && b.fechaAccion === items[0].fechaAccion)
        ? items[0].fechaAccion ?? undefined
        : undefined,
    });
  }
};

/** Entregable enviado a aprobación → le llega a la Estratega de la campaña. */
export const notificarEnRevision = (project: FactoryProject, brief: FabricaBriefItem) =>
  disparar({
    evento: 'tarea.en_revision',
    campana: campanaDe(project),
    tareas: [brief.tarea],
    estratega: project.strategistName || undefined,
    fecha: brief.fechaAccion ?? undefined,
  });

/** Aprobado o devuelto con correcciones → le llega al rol responsable del entregable. */
const notificarResultado = (
  evento: 'tarea.aprobada' | 'tarea.correccion',
  project: FactoryProject,
  brief: FabricaBriefItem,
  nota?: string
) =>
  disparar({
    evento,
    campana: campanaDe(project),
    tareas: [brief.tarea],
    rolLabel: brief.roleLabel,
    miembros: miembrosDelRol(project, brief.roleId, brief.roleLabel),
    nota,
    fecha: brief.fechaAccion ?? undefined,
  });

export const notificarAprobada = (project: FactoryProject, brief: FabricaBriefItem) =>
  notificarResultado('tarea.aprobada', project, brief);

export const notificarCorreccion = (project: FactoryProject, brief: FabricaBriefItem, nota: string) =>
  notificarResultado('tarea.correccion', project, brief, nota);

/** Prueba desde Ajustes: se envía al correo de quien la pide. Esta sí espera respuesta. */
export const enviarCorreoDePrueba = () => invocar({ evento: 'prueba' });
