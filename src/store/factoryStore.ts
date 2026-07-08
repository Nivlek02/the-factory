import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import type { Attachment } from '@/components/ui/file-upload';

export type ProjectState = 'planning' | 'in_progress' | 'review' | 'blocked' | 'done';

export interface AudienciaNarrativaData {
  segmentos: string[];
  metaInscripciones: string;
  dolor: string;
  promesa: string;
  bigIdea: string;
}

export interface CanalRow {
  id: string;
  canal: string;
  dia: string;
  copy: string;
  segmento: string;
}

export interface LoopRow {
  id: string;
  disparador: string;
  reaccion: string;
  responsable: string;
}

export interface TaskComment {
  id: string;
  author: string;
  content: string;
  isAdjustmentRequest: boolean;
  /** Entrada generada por el sistema (enviado a revisión / aprobado) para el historial de cambios,
   *  a diferencia de un comentario escrito por una persona. */
  isSystemEvent?: boolean;
  createdAt: string;
}

/** Estado del flujo Copys → Aprobación → Diseño → Aprobación → Envíos para un entregable. */
export type BriefWorkflowStatus = 'pending' | 'in_review' | 'completed';

export interface FabricaBriefItem {
  id: string;
  roleId: string;
  roleLabel: string;
  tarea: string;
  checked: boolean;
  /** Estrategia de loop — qué medir para saber si la activación está funcionando */
  metrica?: string;
  lineaBase?: string;
  objetivo?: string;
  mejora?: string;
  /** Nota de contexto pre-cargada al abrir el deliverable (ej: campos adicionales del formulario) */
  briefNotes?: string;
  /** Comentarios editables (habilitados para el rol Copy) — legado, ver `comments` */
  comentarios?: string;
  /** Deliverable del Copy — contenido WYSIWYG */
  deliverableContent?: string;
  deliverableAttachments?: Attachment[];
  deliverableSubmittedAt?: string | null;
  /** Delivery tracking for channel plan shipments */
  deliverableEnviado?: boolean | null;
  deliverableMotivoNoEnvio?: string;
  deliverableMetricas?: Record<string, string>;
  /** Nodo de "Construir estrategia" donde vive hoy este entregable (gestión de flujo por-nodo) */
  currentNodeId?: string | null;
  /** Estado de flujo dentro de Construir estrategia, independiente de `checked`/`deliverableSubmittedAt` */
  workflowStatus?: BriefWorkflowStatus;
  /** Hilo de comentarios (notas y correcciones de aprobación) */
  comments?: TaskComment[];
}

export type ProjectPriority = 'P0' | 'P1' | 'P2';
export type ProjectTaskStatus = 'pending' | 'in_progress' | 'in_review' | 'completed';

export interface RoleMember {
  id: string;
  name: string;
}

export interface RoleRequirement {
  id: string;
  text: string;
}

export interface ProjectRoleGroup {
  roleId: string;
  roleLabel: string;
  members: RoleMember[];
  requirements: RoleRequirement[];
}

export interface ProjectTask {
  id: string;
  title: string;
  description: string;
  assignedMemberId: string | null;
  assignedMemberName: string | null;
  assignedRoleLabel: string | null;
  status: ProjectTaskStatus;
  priority: 'high' | 'medium' | null;
  dueDate: string | null;
  createdAt: string;
}

export type StrategyStageType =
  | 'formulario'
  | 'landing'
  | 'copys'
  | 'aprobacion'
  | 'diseno'
  | 'pauta'
  | 'envios'
  | 'custom';

export interface StrategyNode {
  id: string;
  stageType: StrategyStageType;
  label: string;
  description?: string;
  roleId: string | null;
  roleLabel: string | null;
  memberId: string | null;
  memberName: string | null;
  status: ProjectTaskStatus;
  dependsOn: string[];
  position?: { x: number; y: number } | null;
}


export interface FormularioConfig {
  basico: boolean | null;
  camposAdicionales: string;
  cuadroTexto: string;
}

export interface ProjectAttachment {
  name: string;
  type: string;
  data: string; // base64
}

export interface FactoryProject {
  id: string;
  name: string;
  description: string;
  client: string;
  state: ProjectState;
  priority: ProjectPriority;
  startDate: string | null;
  dueDate: string | null;
  createdAt: string;
  roleGroups: ProjectRoleGroup[];
  tasks: ProjectTask[];
  strategyNodes: StrategyNode[];
  strategistName: string;
  audienciaNarrativa: AudienciaNarrativaData;
  canales: CanalRow[];
  loops: LoopRow[];
  fabricaBriefs: FabricaBriefItem[];
  requerimientos: string[];
  segmentLink: string;
  eventCategory: string;
  promocionarEn: string[];
  formularioConfig: FormularioConfig;
  attachments: ProjectAttachment[];
}

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

interface FactoryStore {
  projects: FactoryProject[];
  activeProjectId: string | null;
  isLoaded: boolean;

  hydrate: () => Promise<void>;

  addProject: (data: Pick<FactoryProject, 'name' | 'description' | 'client' | 'state' | 'priority' | 'startDate' | 'dueDate' | 'strategistName' | 'audienciaNarrativa' | 'canales' | 'loops' | 'fabricaBriefs' | 'requerimientos' | 'segmentLink' | 'eventCategory' | 'promocionarEn' | 'formularioConfig' | 'attachments'>) => string;
  updateProject: (id: string, updates: Partial<Pick<FactoryProject, 'name' | 'description' | 'client' | 'state' | 'priority' | 'startDate' | 'dueDate' | 'audienciaNarrativa' | 'canales' | 'loops' | 'fabricaBriefs' | 'requerimientos' | 'segmentLink' | 'eventCategory' | 'promocionarEn' | 'formularioConfig' | 'attachments'>>) => void;
  deleteProject: (id: string) => void;

  addRoleGroup: (projectId: string, roleId: string, roleLabel: string) => void;
  removeRoleGroup: (projectId: string, roleId: string) => void;

  addMemberToRole: (projectId: string, roleId: string, name: string) => void;
  removeMemberFromRole: (projectId: string, roleId: string, memberId: string) => void;

  addRequirement: (projectId: string, roleId: string, text: string) => void;
  removeRequirement: (projectId: string, roleId: string, reqId: string) => void;
  updateRequirement: (projectId: string, roleId: string, reqId: string, text: string) => void;

  addTask: (projectId: string, task: Omit<ProjectTask, 'id' | 'createdAt'>) => void;
  updateTask: (projectId: string, taskId: string, updates: Partial<Omit<ProjectTask, 'id' | 'createdAt'>>) => void;
  deleteTask: (projectId: string, taskId: string) => void;

  addStrategyNode: (projectId: string, node: Omit<StrategyNode, 'id'>) => string;
  updateStrategyNode: (projectId: string, nodeId: string, updates: Partial<Omit<StrategyNode, 'id'>>) => void;
  deleteStrategyNode: (projectId: string, nodeId: string) => void;

  addFabricaBriefs: (projectId: string, briefs: Omit<FabricaBriefItem, 'id' | 'checked'>[]) => void;
  updateFabricaBrief: (projectId: string, briefId: string, updates: Partial<FabricaBriefItem>) => void;

  setActiveProject: (id: string | null) => void;
}

/** Default pipeline creado para cada proyecto nuevo: Copy escribe → Diseño hace la pieza →
 *  Gestor de canales envía. La aprobación ya no es una etapa aparte: cada entregable pasa por
 *  revisión dentro de su propia tarea (ver `hasApprovalStage` en StrategyBriefPanels).
 *  Users can branch/extend it further from "Construir estrategia". */
const buildDefaultStrategyNodes = (): StrategyNode[] => {
  const node = (
    id: string,
    stageType: StrategyStageType,
    label: string,
    roleLabel: string,
    dependsOn: string[]
  ): StrategyNode => ({
    id, stageType, label, roleId: null, roleLabel, memberId: null, memberName: null,
    status: 'pending', dependsOn,
  });

  const copyId = `node-${uid()}`;
  const disenoId = `node-${uid()}`;
  const enviosId = `node-${uid()}`;

  return [
    node(copyId, 'copys', 'Copys', 'Copy', []),
    node(disenoId, 'diseno', 'Diseño de piezas', 'Diseño', [copyId]),
    node(enviosId, 'envios', 'Envío de acciones', 'Gestor de canales', [disenoId]),
  ];
};

/** Migración en lectura: los proyectos creados antes de este cambio pueden traer nodos
 *  `aprobacion` guardados en Supabase. Los quitamos y re-conectamos sus dependientes al
 *  nodo del que dependía la aprobación, para no dejar huecos en el flujo. */
const stripApprovalNodes = (nodes: StrategyNode[]): StrategyNode[] => {
  const approvalIds = new Set(nodes.filter((n) => n.stageType === 'aprobacion').map((n) => n.id));
  if (approvalIds.size === 0) return nodes;

  const byId = new Map(nodes.map((n) => [n.id, n] as const));
  const bridge = (deps: string[]): string[] => {
    const out: string[] = [];
    for (const d of deps) {
      if (approvalIds.has(d)) out.push(...bridge(byId.get(d)?.dependsOn ?? []));
      else out.push(d);
    }
    return Array.from(new Set(out));
  };

  return nodes
    .filter((n) => !approvalIds.has(n.id))
    .map((n) => ({ ...n, dependsOn: bridge(n.dependsOn) }));
};

const patchProject = (
  projects: FactoryProject[],
  id: string,
  fn: (p: FactoryProject) => FactoryProject
) => projects.map((p) => (p.id === id ? fn(p) : p));

const patchRoleGroup = (
  groups: ProjectRoleGroup[],
  roleId: string,
  fn: (g: ProjectRoleGroup) => ProjectRoleGroup
) => groups.map((g) => (g.roleId === roleId ? fn(g) : g));

// --- Supabase sync helpers ---
const rowToProject = (row: any): FactoryProject => {
  const data = row.data || {};
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    client: row.client ?? '',
    state: row.state as ProjectState,
    priority: (['P0', 'P1', 'P2'] as const).includes(row.priority) ? row.priority as ProjectPriority : 'P2',
    startDate: data.startDate ?? null,
    dueDate: row.due_date,
    createdAt: row.created_at,
    roleGroups: data.roleGroups ?? [],
    tasks: data.tasks ?? [],
    strategyNodes: stripApprovalNodes(data.strategyNodes ?? []),
    strategistName: data.strategistName ?? '',
    audienciaNarrativa: data.audienciaNarrativa ?? { segmentos: [], metaInscripciones: '', dolor: '', promesa: '', bigIdea: '' },
    canales: data.canales ?? [],
    loops: data.loops ?? [],
    fabricaBriefs: data.fabricaBriefs ?? [],
    requerimientos: data.requerimientos ?? [],
    segmentLink: data.segmentLink ?? '',
    eventCategory: data.eventCategory ?? '',
    promocionarEn: data.promocionarEn ?? [],
    formularioConfig: data.formularioConfig ?? { basico: null, camposAdicionales: '', cuadroTexto: '' },
    attachments: data.attachments ?? [],
  };
};

const projectToRow = (p: FactoryProject) => ({
  id: p.id,
  name: p.name,
    description: p.description,
    client: p.client,
    state: p.state,
    priority: p.priority,
    due_date: p.dueDate,
    data: {
      roleGroups: p.roleGroups,
      tasks: p.tasks,
      strategyNodes: p.strategyNodes,
      startDate: p.startDate,
      strategistName: p.strategistName,
      audienciaNarrativa: p.audienciaNarrativa,
      canales: p.canales,
      loops: p.loops,
      fabricaBriefs: p.fabricaBriefs,
      requerimientos: p.requerimientos,
      segmentLink: p.segmentLink,
      eventCategory: p.eventCategory,
      promocionarEn: p.promocionarEn,
      formularioConfig: p.formularioConfig,
      attachments: p.attachments,
    },
});

const pendingSync = new Map<string, ReturnType<typeof setTimeout>>();
const syncProject = (project: FactoryProject) => {
  const existing = pendingSync.get(project.id);
  if (existing) clearTimeout(existing);
  const t = setTimeout(async () => {
    pendingSync.delete(project.id);
    const { error } = await supabase
      .from('factory_projects')
      .upsert([projectToRow(project)] as any, { onConflict: 'id' });
    if (error) console.error('Error syncing project:', error);
  }, 400);
  pendingSync.set(project.id, t);
};

const deleteRow = async (id: string) => {
  const existing = pendingSync.get(id);
  if (existing) clearTimeout(existing);
  pendingSync.delete(id);
  const { error } = await supabase.from('factory_projects').delete().eq('id', id);
  if (error) console.error('Error deleting project:', error);
};

const persistAfter = (
  set: any,
  get: any,
  projectId: string,
  updater: (s: FactoryStore) => Partial<FactoryStore>
) => {
  set(updater);
  const project = (get() as FactoryStore).projects.find((p) => p.id === projectId);
  if (project) syncProject(project);
};

export const useFactoryStore = create<FactoryStore>()((set, get) => ({
  projects: [],
  activeProjectId: null,
  isLoaded: false,

  hydrate: async () => {
    const { data, error } = await supabase
      .from('factory_projects')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Error loading factory projects:', error);
      set({ isLoaded: true });
      return;
    }
    set({ projects: (data ?? []).map(rowToProject), isLoaded: true });
  },

  addProject: (data) => {
    const id = `proj-${uid()}`;
    const project: FactoryProject = {
      ...data,
      startDate: data.startDate ?? null,
      dueDate: data.dueDate ?? null,
      strategistName: data.strategistName ?? '',
      audienciaNarrativa: data.audienciaNarrativa ?? { segmentos: [], metaInscripciones: '', dolor: '', promesa: '', bigIdea: '' },
      canales: data.canales ?? [],
      loops: data.loops ?? [],
      fabricaBriefs: data.fabricaBriefs ?? [],
      requerimientos: data.requerimientos ?? [],
      segmentLink: data.segmentLink ?? '',
      eventCategory: data.eventCategory ?? '',
      promocionarEn: data.promocionarEn ?? [],
      formularioConfig: data.formularioConfig ?? { basico: null, camposAdicionales: '', cuadroTexto: '' },
      attachments: data.attachments ?? [],
      id,
      createdAt: new Date().toISOString(),
      roleGroups: [],
      tasks: [],
      strategyNodes: buildDefaultStrategyNodes(),
    };
    set((s) => ({ projects: [project, ...s.projects], activeProjectId: id }));
    syncProject(project);
    return id;
  },

  updateProject: (id, updates) =>
    persistAfter(set, get, id, (s) => ({
      projects: patchProject(s.projects, id, (p) => ({ ...p, ...updates })),
    })),

  deleteProject: (id) => {
    set((s) => ({
      projects: s.projects.filter((p) => p.id !== id),
      activeProjectId: s.activeProjectId === id ? null : s.activeProjectId,
    }));
    deleteRow(id);
  },

  addRoleGroup: (projectId, roleId, roleLabel) =>
    persistAfter(set, get, projectId, (s) => ({
      projects: patchProject(s.projects, projectId, (p) =>
        p.roleGroups.some((g) => g.roleId === roleId)
          ? p
          : { ...p, roleGroups: [...p.roleGroups, { roleId, roleLabel, members: [], requirements: [] }] }
      ),
    })),

  removeRoleGroup: (projectId, roleId) =>
    persistAfter(set, get, projectId, (s) => ({
      projects: patchProject(s.projects, projectId, (p) => ({
        ...p,
        roleGroups: p.roleGroups.filter((g) => g.roleId !== roleId),
      })),
    })),

  addMemberToRole: (projectId, roleId, name) =>
    persistAfter(set, get, projectId, (s) => ({
      projects: patchProject(s.projects, projectId, (p) => ({
        ...p,
        roleGroups: patchRoleGroup(p.roleGroups, roleId, (g) => ({
          ...g,
          members: [...g.members, { id: uid(), name: name.trim() }],
        })),
      })),
    })),

  removeMemberFromRole: (projectId, roleId, memberId) =>
    persistAfter(set, get, projectId, (s) => ({
      projects: patchProject(s.projects, projectId, (p) => ({
        ...p,
        roleGroups: patchRoleGroup(p.roleGroups, roleId, (g) => ({
          ...g,
          members: g.members.filter((m) => m.id !== memberId),
        })),
      })),
    })),

  addRequirement: (projectId, roleId, text) =>
    persistAfter(set, get, projectId, (s) => ({
      projects: patchProject(s.projects, projectId, (p) => ({
        ...p,
        roleGroups: patchRoleGroup(p.roleGroups, roleId, (g) => ({
          ...g,
          requirements: [...g.requirements, { id: uid(), text: text.trim() }],
        })),
      })),
    })),

  removeRequirement: (projectId, roleId, reqId) =>
    persistAfter(set, get, projectId, (s) => ({
      projects: patchProject(s.projects, projectId, (p) => ({
        ...p,
        roleGroups: patchRoleGroup(p.roleGroups, roleId, (g) => ({
          ...g,
          requirements: g.requirements.filter((r) => r.id !== reqId),
        })),
      })),
    })),

  updateRequirement: (projectId, roleId, reqId, text) =>
    persistAfter(set, get, projectId, (s) => ({
      projects: patchProject(s.projects, projectId, (p) => ({
        ...p,
        roleGroups: patchRoleGroup(p.roleGroups, roleId, (g) => ({
          ...g,
          requirements: g.requirements.map((r) => (r.id === reqId ? { ...r, text } : r)),
        })),
      })),
    })),

  addTask: (projectId, task) =>
    persistAfter(set, get, projectId, (s) => ({
      projects: patchProject(s.projects, projectId, (p) => ({
        ...p,
        tasks: [...p.tasks, { ...task, id: `task-${uid()}`, createdAt: new Date().toISOString() }],
      })),
    })),

  updateTask: (projectId, taskId, updates) =>
    persistAfter(set, get, projectId, (s) => ({
      projects: patchProject(s.projects, projectId, (p) => ({
        ...p,
        tasks: p.tasks.map((t) => (t.id === taskId ? { ...t, ...updates } : t)),
      })),
    })),

  deleteTask: (projectId, taskId) =>
    persistAfter(set, get, projectId, (s) => ({
      projects: patchProject(s.projects, projectId, (p) => ({
        ...p,
        tasks: p.tasks.filter((t) => t.id !== taskId),
      })),
    })),

  addStrategyNode: (projectId, node) => {
    const id = `node-${uid()}`;
    persistAfter(set, get, projectId, (s) => ({
      projects: patchProject(s.projects, projectId, (p) => ({
        ...p,
        strategyNodes: [...(p.strategyNodes ?? []), { ...node, id }],
      })),
    }));
    return id;
  },

  updateStrategyNode: (projectId, nodeId, updates) =>
    persistAfter(set, get, projectId, (s) => ({
      projects: patchProject(s.projects, projectId, (p) => ({
        ...p,
        strategyNodes: (p.strategyNodes ?? []).map((n) => (n.id === nodeId ? { ...n, ...updates } : n)),
      })),
    })),

  deleteStrategyNode: (projectId, nodeId) =>
    persistAfter(set, get, projectId, (s) => ({
      projects: patchProject(s.projects, projectId, (p) => ({
        ...p,
        strategyNodes: (p.strategyNodes ?? [])
          .filter((n) => n.id !== nodeId)
          .map((n) => ({ ...n, dependsOn: n.dependsOn.filter((d) => d !== nodeId) })),
      })),
    })),

  addFabricaBriefs: (projectId, briefs) =>
    persistAfter(set, get, projectId, (s) => ({
      projects: patchProject(s.projects, projectId, (p) => ({
        ...p,
        fabricaBriefs: [
          ...(p.fabricaBriefs ?? []),
          ...briefs.map((b) => ({ ...b, id: uid(), checked: false })),
        ],
      })),
    })),

  updateFabricaBrief: (projectId, briefId, updates) =>
    persistAfter(set, get, projectId, (s) => ({
      projects: patchProject(s.projects, projectId, (p) => ({
        ...p,
        fabricaBriefs: (p.fabricaBriefs ?? []).map((b) => (b.id === briefId ? { ...b, ...updates } : b)),
      })),
    })),

  setActiveProject: (id) => set({ activeProjectId: id }),
}));
