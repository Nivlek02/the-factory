/**
 * Aplana las tareas (fabricaBriefs) de todas las campañas a una lista normalizada, para las
 * vistas que cruzan proyectos: "Mis tareas" (Descripción general) y Reportes.
 *
 * Las tareas de una campaña viven en `project.fabricaBriefs` y se asignan por ROL, no por
 * persona: el "dueño" de una tarea es quien tenga ese rol (o esté como miembro del grupo de
 * rol en ese proyecto). Ver factoryStore / CLAUDE.md.
 */
import { FactoryProject, FabricaBriefItem, BriefWorkflowStatus } from '@/store/factoryStore';
import { getBriefStatus } from '@/components/factory/DeliverableSummary';
import { diasHasta } from '@/lib/urgencia';

export interface CampaignTask {
  id: string;
  projectId: string;
  projectName: string;
  projectClient: string;
  strategistName: string;
  tarea: string;
  roleId: string;
  roleLabel: string;
  status: BriefWorkflowStatus;
  fechaAccion: string | null;
  /** Personas del grupo de rol correspondiente en ese proyecto (asignables por nombre). */
  assignees: string[];
  brief: FabricaBriefItem;
}

/** Todas las tareas de todas las campañas, en una sola lista plana. */
export const flattenCampaignTasks = (projects: FactoryProject[]): CampaignTask[] => {
  const out: CampaignTask[] = [];
  for (const p of projects) {
    for (const b of p.fabricaBriefs ?? []) {
      const group = p.roleGroups.find((g) => g.roleId === b.roleId || g.roleLabel === b.roleLabel);
      out.push({
        id: b.id,
        projectId: p.id,
        projectName: p.name,
        projectClient: p.client,
        strategistName: p.strategistName ?? '',
        tarea: b.tarea,
        roleId: b.roleId,
        roleLabel: b.roleLabel,
        status: getBriefStatus(b),
        fechaAccion: b.fechaAccion ?? null,
        assignees: group?.members.map((m) => m.name) ?? [],
        brief: b,
      });
    }
  }
  return out;
};

const norm = (s: string) => s.trim().toLowerCase();

/**
 * ¿Esta tarea es del usuario? Sí cuando su rol coincide con el del brief (`roleId`), o cuando
 * figura por nombre como miembro del grupo de rol en ese proyecto. `roleId` del brief usa los
 * mismos ids que AppRole (copy/diseno/gestor_canales/estratega/trafficker), así que el match
 * por rol es directo; el match por nombre cubre a quien fue agregado a un rol que no es el suyo.
 */
export const isTaskOwnedBy = (
  task: CampaignTask,
  user: { role: string; fullName: string } | null | undefined,
): boolean => {
  if (!user) return false;
  if (task.roleId === user.role) return true;
  return task.assignees.some((n) => norm(n) === norm(user.fullName));
};

/**
 * Orden por urgencia + fecha de entrega: completadas al fondo; dentro de cada grupo, por días
 * hasta la fecha ascendente (vencidas y próximas primero), y las sin fecha al final.
 */
export const compareByUrgencia = (a: CampaignTask, b: CampaignTask): number => {
  const ac = a.status === 'completed' ? 1 : 0;
  const bc = b.status === 'completed' ? 1 : 0;
  if (ac !== bc) return ac - bc;

  const ad = a.fechaAccion ? diasHasta(a.fechaAccion) : null;
  const bd = b.fechaAccion ? diasHasta(b.fechaAccion) : null;
  const av = ad === null ? Number.POSITIVE_INFINITY : ad;
  const bv = bd === null ? Number.POSITIVE_INFINITY : bd;
  if (av !== bv) return av - bv;

  return a.tarea.localeCompare(b.tarea);
};
