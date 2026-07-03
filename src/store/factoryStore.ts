import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';

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
  /** Deliverable del Copy — contenido WYSIWYG */
  deliverableContent?: string;
  deliverableAttachments?: Array<{name: string; url: string; type: string}>;
  deliverableSubmittedAt?: string | null;
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
}

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

interface FactoryStore {
  projects: FactoryProject[];
  activeProjectId: string | null;
  isLoaded: boolean;

  hydrate: () => Promise<void>;

  addProject: (data: Pick<FactoryProject, 'name' | 'description' | 'client' | 'state' | 'priority' | 'startDate' | 'dueDate' | 'strategistName' | 'audienciaNarrativa' | 'canales' | 'loops' | 'fabricaBriefs' | 'requerimientos' | 'segmentLink' | 'eventCategory' | 'promocionarEn'>) => string;
  updateProject: (id: string, updates: Partial<Pick<FactoryProject, 'name' | 'description' | 'client' | 'state' | 'priority' | 'startDate' | 'dueDate' | 'audienciaNarrativa' | 'canales' | 'loops' | 'fabricaBriefs' | 'requerimientos' | 'segmentLink' | 'eventCategory' | 'promocionarEn'>>) => void;
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
  updateFabricaBrief: (projectId: string, briefId: string, updates: Partial<Pick<FabricaBriefItem, 'checked' | 'metrica' | 'lineaBase' | 'objetivo' | 'mejora'>>) => void;

  setActiveProject: (id: string | null) => void;
}

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
    priority: row.priority as ProjectPriority,
    startDate: data.startDate ?? null,
    dueDate: row.due_date,
    createdAt: row.created_at,
    roleGroups: data.roleGroups ?? [],
    tasks: data.tasks ?? [],
    strategyNodes: data.strategyNodes ?? [],
    strategistName: data.strategistName ?? '',
    audienciaNarrativa: data.audienciaNarrativa ?? { segmentos: [], metaInscripciones: '', dolor: '', promesa: '', bigIdea: '' },
    canales: data.canales ?? [],
    loops: data.loops ?? [],
    fabricaBriefs: data.fabricaBriefs ?? [],
    requerimientos: data.requerimientos ?? [],
    segmentLink: data.segmentLink ?? '',
    eventCategory: data.eventCategory ?? '',
    promocionarEn: data.promocionarEn ?? [],
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
      id,
      createdAt: new Date().toISOString(),
      roleGroups: [],
      tasks: [],
      strategyNodes: [],
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
