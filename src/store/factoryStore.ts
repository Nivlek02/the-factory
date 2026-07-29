import { create } from 'zustand';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { Attachment } from '@/components/ui/file-upload';
import { notificarTareasAsignadas } from '@/services/emailNotifications';

export type ProjectState = 'planning' | 'in_progress' | 'cancelled' | 'done';

/** Migra estados viejos ('review'/'blocked', eliminados) al nuevo esquema. Proyectos
 *  persistidos antes de este cambio pueden traer esos valores en Supabase. */
const migrateState = (state: string): ProjectState => {
  if (state === 'review' || state === 'blocked') return 'in_progress';
  if (state === 'planning' || state === 'in_progress' || state === 'cancelled' || state === 'done') return state;
  return 'planning';
};

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
  hora: string;
  copy: string;
  segmento: string;
  /** Etapa del ciclo (ver EtapaCiclo) a la que pertenece este toque. Opcional para no romper
   *  proyectos creados antes de la unificación Plan de canales + Loops. */
  etapaId?: string;
  /** Interacción esperada tras este toque (Abre / No abre / Clic / No clic / Visita landing, o
   *  texto libre). Se asigna en la etapa de Interacción sobre cada acción sembrada en Atracción;
   *  el dato vive en el toque de origen. Opcional.
   *  `interaccion` (singular) es el formato legacy de una sola interacción; `interacciones`
   *  (plural) permite varias. Al leer, usar `interaccion` como fallback si `interacciones` falta. */
  interaccion?: string;
  interacciones?: string[];
}

/** Categorías de canales del Plan de canales. Agrupan los canales sueltos para mostrarlos
 *  resumidos en el diagrama del ecosistema (etapa de Atracción). Es el "catálogo" que vive en
 *  la capa de datos; la UI solo lo consume. */
export interface CanalCategoria {
  id: string;
  label: string;
  canales: string[];
}

export const CANAL_CATEGORIAS: CanalCategoria[] = [
  { id: 'directos', label: 'Canales directos', canales: ['Correo', 'WhatsApp', 'SMS'] },
  { id: 'pauta', label: 'Pauta digital', canales: ['Facebook', 'Instagram', 'Google Ads', 'TikTok'] },
  { id: 'relacionamiento', label: 'Relacionamiento', canales: ['Call Center', 'BTL', 'KAM', 'Relacionamiento'] },
];

/** Devuelve las categorías (en orden de CANAL_CATEGORIAS) representadas por un conjunto de
 *  nombres de canal — usado para pintar las categorías activas en el diagrama del ciclo. */
export const categoriasDeCanales = (canales: string[]): CanalCategoria[] => {
  const usados = new Set(canales.map((c) => c.trim()).filter(Boolean));
  return CANAL_CATEGORIAS.filter((cat) => cat.canales.some((c) => usados.has(c)));
};

export interface LoopRow {
  id: string;
  disparador: string;
  reaccion: string;
  responsable: string;
  /** Etapa del ciclo (ver EtapaCiclo) donde vive este loop. Opcional, ver CanalRow.etapaId. */
  etapaId?: string;
  /** "Lleva a →": etapa destino cuando este loop cierra o ramifica el ciclo (ej. una
   *  reactivación que reinicia en la etapa de Atracción). Sin valor = no cierra ninguna rama. */
  siguienteEtapaId?: string;
}

/** Las 6 etapas del ecosistema cíclico de convocatoria/conversión/reactivación. El tipo es la
 *  clave estable que determina color/ícono por defecto en la UI (ver ETAPA_TIPO_META en
 *  MapTab.tsx) — nombre/objetivo/orden son editables por el usuario. */
export type EtapaTipo =
  | 'atraccion'
  | 'interaccion'
  | 'captura'
  | 'validacion'
  | 'desenlace'
  | 'reactivacion';

export interface EtapaCiclo {
  id: string;
  tipo: EtapaTipo;
  nombre: string;
  orden: number;
  objetivo: string;
}

/** Base del mensaje de la campaña: Emoción · Lógica · Motivación · Recompensa. */
export interface MensajeBaseELMR {
  emocion: string;
  logica: string;
  motivacion: string;
  recompensa: string;
}

/** Motor del proceso: la validación contra CRM/fuente externa que decide el desenlace de cada
 *  contacto. requiereLanding/requiereFormulario no se duplican aquí — se derivan de
 *  `requerimientos` para no tener dos fuentes de verdad. */
export interface MotorProceso {
  fuenteValidacion: string;
  /** Segmentos de validación contra CRM/fuente externa que se cruzan en la etapa de Validación
   *  (ej. Renovado / No renovado / No inscrito en cámara, o valores personalizados). Se elige en
   *  el paso "Canales y comportamiento" y se refleja en el nodo de Validación del ciclo. Opcional
   *  para no romper campañas creadas antes de esta funcionalidad. */
  validacionSegmentos?: string[];
  /** Desenlace por segmento de validación: texto corto que describe la rama de cada segmento
   *  (ej. "Renovado" → "Confirmación + agradecimiento"). Se llena en la etapa de Desenlace a
   *  partir de los `validacionSegmentos` y se refleja en el nodo de Desenlace del ciclo. */
  desenlaces?: Record<string, string>;
  /** Negativos de la interacción para la etapa de Reactivación y remarketing: las audiencias por
   *  comportamiento que NO reaccionaron (No abre / No hace clic / No visita, o personalizados).
   *  Se refleja en el nodo de Reactivación del ciclo. */
  reactivacionNegativos?: string[];
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
  /** Entregable "hecho sí/no + fecha" — KAM, BTL, Relacionamiento, registro de Call Center */
  deliverableDone?: boolean | null;
  deliverableDate?: string | null;
  /** Entregable de Pauta en redes sociales (Trafficker): publicada sí/no, dispara la
   *  recolección de métricas de la campaña. Contenido/adjuntos usan los campos de arriba. */
  deliverablePublicada?: boolean | null;
  /** Fecha en que debe ocurrir la acción (ISO YYYY-MM-DD). Se siembra desde el Plan de canales
   *  (`CanalRow.dia`) cuando la tarea nace de un canal, y es editable desde la propia tarea.
   *  Alimenta el semáforo de urgencia en Flujo de trabajo. Opcional: las tareas creadas antes
   *  de esto, y las que nadie fechó, simplemente no muestran semáforo. */
  fechaAccion?: string | null;
  /** Identificador corto de la tarea dentro de su campaña: la letra del tipo de trabajo + un
   *  consecutivo (`C1`, `C2` para Copys; `D1` para Diseño; `E1` para Envíos…). Sirve para
   *  referirse a una tarea sin repetir su título entero. Se asigna al crearla y **no cambia**
   *  aunque la tarea se renombre. Las tareas creadas antes de esto no lo tienen. */
  codigo?: string;
  /** Nodo de "Construir estrategia" donde vive hoy este entregable (gestión de flujo por-nodo) */
  currentNodeId?: string | null;
  /** Entregable del paso anterior de la cadena que dio origen a esta tarea (lo estampa
   *  `activateNextStage` al aprobar). Sirve para consultarlo desde acá sin salir de la tarea:
   *  quien diseña la pieza necesita leer el copy aprobado. Es solo una referencia por id — el
   *  contenido se lee en vivo del entregable original, así que si el copy se corrige después,
   *  acá se ve la versión corregida. Las tareas creadas antes de esto simplemente no lo tienen. */
  sourceBriefId?: string | null;
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
  | 'landing_formulario'
  | 'landing'
  | 'copys'
  | 'aprobacion'
  | 'diseno'
  | 'pauta'
  | 'envios'
  | 'kam'
  | 'btl'
  | 'relacionamiento'
  | 'callcenter_guion'
  | 'callcenter'
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
  /** Número de campaña, consecutivo dentro de la app (1, 2, 3…). Es el identificador que se ve y
   *  se dicta; el `id` de arriba sigue siendo el interno. Se asigna al crearla, y a las campañas
   *  anteriores se les asignó una vez por su fecha de creación (ver `asignarNumerosFaltantes`).
   *  Nunca se reusa: borrar la campaña 3 no hace que la siguiente vuelva a ser 3. */
  numero?: number | null;
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
  /** Las 6 etapas del ecosistema cíclico — ver EtapaCiclo. Vacío hasta que el usuario
   *  "inicializa" las etapas por defecto en el wizard. */
  etapas: EtapaCiclo[];
  mensajeBase: MensajeBaseELMR;
  motor: MotorProceso;
}

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

interface FactoryStore {
  projects: FactoryProject[];
  activeProjectId: string | null;
  isLoaded: boolean;

  hydrate: () => Promise<void>;

  addProject: (data: Pick<FactoryProject, 'name' | 'description' | 'client' | 'state' | 'priority' | 'startDate' | 'dueDate' | 'strategistName' | 'audienciaNarrativa' | 'canales' | 'loops' | 'fabricaBriefs' | 'requerimientos' | 'segmentLink' | 'eventCategory' | 'promocionarEn' | 'formularioConfig' | 'attachments' | 'etapas' | 'mensajeBase' | 'motor'>) => string;
  updateProject: (id: string, updates: Partial<Pick<FactoryProject, 'name' | 'description' | 'client' | 'state' | 'priority' | 'startDate' | 'dueDate' | 'audienciaNarrativa' | 'canales' | 'loops' | 'fabricaBriefs' | 'requerimientos' | 'segmentLink' | 'eventCategory' | 'promocionarEn' | 'formularioConfig' | 'attachments' | 'etapas' | 'mensajeBase' | 'motor'>>) => void;
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

/** Default pipeline creado para cada proyecto nuevo: rama central Copys → Diseño → Envíos, más
 *  Landing/Formulario (rol Gestor de canales) si se eligieron en el wizard. Las demás ramas
 *  (Pauta en redes sociales, BTL, KAM, Relacionamiento, Call Center) dependen de los canales del
 *  Plan de canales, no de un checkbox — ver `syncCanalNodes`. La aprobación ya no es una etapa
 *  aparte: cada entregable pasa por revisión dentro de su propia tarea (ver `hasApprovalStage` en
 *  StrategyBriefPanels). Users can branch/extend it further from "Construir estrategia". */
const buildDefaultStrategyNodes = (requerimientos: string[] = []): StrategyNode[] => {
  const copyId = `node-${uid()}`;
  const disenoId = `node-${uid()}`;
  const enviosId = `node-${uid()}`;

  const nodes: StrategyNode[] = [
    stageNode(copyId, 'copys', 'Copys', 'Copywriter', []),
    stageNode(disenoId, 'diseno', 'Diseño de piezas', 'Diseñador', [copyId]),
    stageNode(enviosId, 'envios', 'Envío de acciones', 'Gestor de canales', [disenoId]),
  ];

  if (requerimientos.includes('landing')) {
    nodes.push(...buildLandingChain(copyId));
  }
  if (requerimientos.includes('formulario')) {
    nodes.push(stageNode(`node-${uid()}`, 'formulario', 'Formulario de inscripción', 'Gestor de canales', []));
  }

  return nodes;
};

const stageNode = (
  id: string,
  stageType: StrategyStageType,
  label: string,
  roleLabel: string,
  dependsOn: string[],
  roleId: string | null = null
): StrategyNode => ({
  id, stageType, label, roleId, roleLabel, memberId: null, memberName: null,
  status: 'pending', dependsOn,
});

/**
 * Cadena de la landing: cuelga del nodo Copys (el copywriter redacta el copy de la landing como
 * una tarea más dentro de Copys) → "Formulario de landing" (Gestor de canales) → "Cargue de
 * landing" (Soporte, entregable = link). Cada paso se activa solo al aprobarse el anterior, ver
 * `activateNextStage` en StrategyBriefPanels.
 *
 * Ojo: el paso de formulario de ACÁ es el formulario embebido en la landing y es independiente
 * del requerimiento "Formulario de inscripción", que sigue creando su propio nodo raíz suelto.
 *
 * A diferencia del resto de nodos, estos llevan `roleId` real (no null): sin él, las tareas que
 * crea `activateNextStage` heredan la ETIQUETA como roleId ('Soporte' en vez de 'soporte') y
 * `isTaskOwnedBy` no las reconoce, así que no saldrían en "Mis tareas" de esa persona.
 */
const buildLandingChain = (copysNodeId: string): StrategyNode[] => {
  const formId = `node-${uid()}`;
  return [
    stageNode(formId, 'landing_formulario', 'Formulario de landing', 'Gestor de canales', [copysNodeId], 'gestor_canales'),
    stageNode(`node-${uid()}`, 'landing', 'Cargue de landing', 'Soporte', [formId], 'soporte'),
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

/** Migración en lectura: proyectos creados antes de fusionar el guion en Copys pueden traer un
 *  nodo intermedio "Guion de llamada" (callcenter_guion) entre Copys y Call Center. Lo quitamos y
 *  re-colgamos el nodo Call Center directo del nodo Copys (el guion ahora es una tarea de Copys). */
const mergeGuionNodes = (nodes: StrategyNode[]): StrategyNode[] => {
  const guionIds = new Set(nodes.filter((n) => n.stageType === 'callcenter_guion').map((n) => n.id));
  if (guionIds.size === 0) return nodes;
  const copys = nodes.find((n) => n.stageType === 'copys');
  return nodes
    .filter((n) => !guionIds.has(n.id))
    .map((n) => {
      const deps = n.dependsOn.filter((d) => !guionIds.has(d));
      if (n.stageType === 'callcenter' && copys && !deps.includes(copys.id)) deps.push(copys.id);
      return { ...n, dependsOn: deps };
    });
};

/** Sincroniza los nodos del flujo de trabajo que dependen de los requerimientos del wizard con
 *  los requerimientos actuales al editar el proyecto — agrega los que falten y quita los que ya
 *  no estén seleccionados, sin tocar la cadena Copys → Diseño → Envíos ni nodos agregados a mano.
 *  Corrige que un requerimiento desmarcado dejara su nodo huérfano en Flujo de trabajo.
 *
 *  "Formulario de inscripción" es un nodo raíz suelto; "Landing" es una cadena de 2 nodos que
 *  cuelga de Copys (ver `buildLandingChain`). */
const syncRequerimientoNodes = (nodes: StrategyNode[], requerimientos: string[]): StrategyNode[] => {
  let result = nodes;

  // ── Formulario de inscripción: nodo raíz, como siempre ──
  const hasFormulario = requerimientos.includes('formulario');
  const formulario = result.find((n) => n.stageType === 'formulario');
  if (hasFormulario && !formulario) {
    result = [...result, stageNode(`node-${uid()}`, 'formulario', 'Formulario de inscripción', 'Gestor de canales', [])];
  } else if (!hasFormulario && formulario) {
    result = result.filter((n) => n.id !== formulario.id);
  }

  // ── Landing: cadena Copys → Formulario de landing → Cargue de landing ──
  const hasLanding = requerimientos.includes('landing');
  const cargue = result.find((n) => n.stageType === 'landing');
  const formLanding = result.find((n) => n.stageType === 'landing_formulario');

  if (!hasLanding) {
    return result.filter((n) => n.stageType !== 'landing' && n.stageType !== 'landing_formulario');
  }

  const copys = result.find((n) => n.stageType === 'copys');
  if (!copys) return result; // sin Copys no hay de dónde colgar la cadena

  if (!cargue && !formLanding) return [...result, ...buildLandingChain(copys.id)];

  // Proyectos creados antes de esta cadena traen un solo nodo `landing` suelto (raíz, rol Gestor
  // de canales). Al editarlos se completa: se le antepone el paso de formulario y el cargue pasa
  // a Soporte. Los entregables que ya tuviera no se tocan.
  const formId = formLanding?.id ?? `node-${uid()}`;
  if (!formLanding) {
    result = [...result, stageNode(formId, 'landing_formulario', 'Formulario de landing', 'Gestor de canales', [copys.id], 'gestor_canales')];
  }
  if (!cargue) {
    result = [...result, stageNode(`node-${uid()}`, 'landing', 'Cargue de landing', 'Soporte', [formId], 'soporte')];
  } else if (cargue.roleLabel !== 'Soporte' || !cargue.dependsOn.includes(formId)) {
    result = result.map((n) =>
      n.id === cargue.id
        ? { ...n, label: 'Cargue de landing', roleLabel: 'Soporte', roleId: 'soporte', dependsOn: [formId] }
        : n
    );
  }

  return result;
};

/** Nodos de una sola etapa que dependen de los canales elegidos en el Plan de canales (a
 *  diferencia de landing/formulario, que dependen de los checkboxes de Requerimiento). Varios
 *  canales pueden apuntar al mismo nodo (Facebook/Instagram/TikTok/Google Ads → Pauta). */
const CANAL_SINGLE_NODE: Record<string, { stageType: StrategyStageType; label: string; roleLabel: string }> = {
  Facebook: { stageType: 'pauta', label: 'Pauta en redes sociales', roleLabel: 'Trafficker' },
  Instagram: { stageType: 'pauta', label: 'Pauta en redes sociales', roleLabel: 'Trafficker' },
  TikTok: { stageType: 'pauta', label: 'Pauta en redes sociales', roleLabel: 'Trafficker' },
  'Google Ads': { stageType: 'pauta', label: 'Pauta en redes sociales', roleLabel: 'Trafficker' },
  BTL: { stageType: 'btl', label: 'BTL', roleLabel: 'Estratega' },
  KAM: { stageType: 'kam', label: 'KAM', roleLabel: 'Estratega' },
  Relacionamiento: { stageType: 'relacionamiento', label: 'Relacionamiento', roleLabel: 'Estratega' },
};

/** Sincroniza los nodos del flujo de trabajo que dependen de los canales del Plan de canales:
 *  Facebook/Instagram/TikTok/Google Ads → "Pauta en redes sociales" (Trafficker), BTL/KAM/
 *  Relacionamiento → su propio nodo (Estratega), y "Call Center" → un nodo de registro (Estratega,
 *  hecho sí/no + fecha) que cuelga directo del nodo Copys: el copywriter redacta el guion como una
 *  tarea más dentro de Copys y, al aprobarse, se activa el registro en Call Center (ver
 *  `activateNextStage`). Agrega los nodos que falten y quita los que ya no correspondan, sin tocar
 *  el resto del flujo. */
const syncCanalNodes = (nodes: StrategyNode[], canales: CanalRow[]): StrategyNode[] => {
  let result = nodes;
  const canalTypes = new Set(canales.map((c) => c.canal));

  // Migración en caliente: el nodo intermedio "Guion de llamada" (callcenter_guion) ya no existe
  // — el guion vive dentro de Copys. Se quita y sus dependientes se re-cuelgan de Copys abajo.
  const guionIds = new Set(result.filter((n) => n.stageType === 'callcenter_guion').map((n) => n.id));
  if (guionIds.size > 0) {
    result = result
      .filter((n) => !guionIds.has(n.id))
      .map((n) => ({ ...n, dependsOn: n.dependsOn.filter((d) => !guionIds.has(d)) }));
  }

  const stageTypesWanted = new Set<StrategyStageType>();
  for (const [canal, cfg] of Object.entries(CANAL_SINGLE_NODE)) {
    if (canalTypes.has(canal)) stageTypesWanted.add(cfg.stageType);
  }
  const singleNodeConfigs = new Map(Object.values(CANAL_SINGLE_NODE).map((cfg) => [cfg.stageType, cfg] as const));
  for (const [stageType, cfg] of singleNodeConfigs) {
    const existing = result.find((n) => n.stageType === stageType);
    if (stageTypesWanted.has(stageType) && !existing) {
      result = [...result, {
        id: `node-${uid()}`, stageType, label: cfg.label, roleId: null,
        roleLabel: cfg.roleLabel, memberId: null, memberName: null, status: 'pending', dependsOn: [],
      }];
    } else if (!stageTypesWanted.has(stageType) && existing) {
      result = result.filter((n) => n.id !== existing.id)
        .map((n) => ({ ...n, dependsOn: n.dependsOn.filter((d) => d !== existing.id) }));
    }
  }

  // Call Center: un solo nodo de registro (Estratega) que depende del nodo Copys.
  const wantsCallCenter = canalTypes.has('Call Center');
  const copys = result.find((n) => n.stageType === 'copys');
  const callcenter = result.find((n) => n.stageType === 'callcenter');
  if (wantsCallCenter && !callcenter) {
    result = [...result, {
      id: `node-${uid()}`, stageType: 'callcenter', label: 'Call Center', roleId: null,
      roleLabel: 'Estratega', memberId: null, memberName: null, status: 'pending',
      dependsOn: copys ? [copys.id] : [],
    }];
  } else if (!wantsCallCenter && callcenter) {
    result = result.filter((n) => n.id !== callcenter.id)
      .map((n) => ({ ...n, dependsOn: n.dependsOn.filter((d) => d !== callcenter.id) }));
  } else if (wantsCallCenter && callcenter && copys && !callcenter.dependsOn.includes(copys.id)) {
    // Datos migrados (dep al guion ya borrado): re-colgar el registro de Copys.
    result = result.map((n) => (n.id === callcenter.id ? { ...n, dependsOn: [copys.id] } : n));
  }

  return result;
};

/** Patrones de texto para asociar, la primera vez que se sincroniza el proyecto, un entregable
 *  ya generado por el wizard (sin currentNodeId) a su nodo correspondiente — evita que roles
 *  compartidos entre varios nodos (ej. "Estratega" en KAM/BTL/Relacionamiento/Call Center) se
 *  mezclen entre sí. Una vez estampado, `briefsForNode` ya no necesita heurísticas de texto para
 *  estos entregables (ver StrategyBriefPanels.briefsForNode, que sí sigue usando texto para
 *  landing/formulario/envíos por compatibilidad con datos previos a este mecanismo). */
const CANAL_NODE_TEXT_PATTERN: Partial<Record<StrategyStageType, RegExp>> = {
  kam: /\bKAM\b/i,
  btl: /\bBTL\b/i,
  relacionamiento: /relacionamiento/i,
  // El copy de la landing vive en el nodo Copys, mezclado con los copys de campaña; sin
  // estampar su nodo aparecería además en la cadena de landing (ambos matchean "landing").
  copys: /^Copy de landing/i,
};

const stampCanalNodeIds = (nodes: StrategyNode[], briefs: FabricaBriefItem[]): FabricaBriefItem[] =>
  briefs.map((b) => {
    if (b.currentNodeId) return b;

    // El nodo de cargue de landing pasó de Gestor de canales a Soporte, así que el entregable
    // "Landing page" de proyectos viejos ya no coincide por rol: se ancla por su texto exacto.
    if (/^Landing page$/i.test(b.tarea)) {
      const cargue = nodes.find((n) => n.stageType === 'landing');
      if (cargue) return { ...b, currentNodeId: cargue.id };
    }

    const match = nodes.find((n) => {
      if (n.roleLabel !== b.roleLabel) return false;
      const pattern = CANAL_NODE_TEXT_PATTERN[n.stageType];
      return pattern ? pattern.test(b.tarea) : n.stageType === 'pauta';
    });
    return match ? { ...b, currentNodeId: match.id } : b;
  });

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

// --- Identificadores visibles (número de campaña y código de tarea) ---

/** Letra del código de tarea según el tipo de nodo donde vive. Copys → C1, C2…; Diseño → D1…
 *  `landing_formulario` usa LF para no chocar con el F del formulario de inscripción, que es otra
 *  cosa (ver punto 35 de la bitácora: son dos formularios distintos a propósito). */
const LETRA_POR_STAGE: Record<StrategyStageType, string> = {
  copys: 'C',
  diseno: 'D',
  envios: 'E',
  landing: 'L',
  landing_formulario: 'LF',
  formulario: 'F',
  pauta: 'P',
  callcenter: 'CC',
  callcenter_guion: 'C',   // legado: el guion vive hoy dentro de Copys
  kam: 'K',
  btl: 'B',
  relacionamiento: 'R',
  aprobacion: 'A',         // legado: ya no se crean nodos de este tipo
  custom: 'T',
};

/** Letra de respaldo cuando la tarea no tiene nodo (entregables legados sin `currentNodeId`):
 *  se saca del rol, que es el otro dato que siempre traen. */
const LETRA_POR_ROL: Record<string, string> = {
  Copywriter: 'C',
  Diseñador: 'D',
  'Gestor de canales': 'E',
  Estratega: 'S',
  Soporte: 'Z',
  Trafficker: 'P',
  'Social Media': 'P',
};

const letraDeTarea = (
  nodes: StrategyNode[],
  brief: { currentNodeId?: string | null; roleLabel?: string }
): string => {
  const node = brief.currentNodeId ? nodes.find((n) => n.id === brief.currentNodeId) : undefined;
  if (node) return LETRA_POR_STAGE[node.stageType] ?? 'T';
  return LETRA_POR_ROL[brief.roleLabel ?? ''] ?? 'T';
};

/**
 * Asigna código a las tareas que no lo tengan. El consecutivo se calcula **por letra y por
 * campaña**, mirando los códigos ya usados: así no se repite aunque las tareas entren por caminos
 * distintos (el lote del wizard, el quick-add de un nodo, o las que nacen al aprobar un paso).
 * Las que ya tienen código no se tocan — el código es estable de por vida.
 */
const asignarCodigos = <T extends FabricaBriefItem>(
  nodes: StrategyNode[],
  existentes: FabricaBriefItem[],
  nuevos: T[]
): T[] => {
  const ultimo = new Map<string, number>();
  for (const b of existentes) {
    const m = /^([A-Z]+)(\d+)$/.exec(b.codigo ?? '');
    if (!m) continue;
    ultimo.set(m[1], Math.max(ultimo.get(m[1]) ?? 0, Number(m[2])));
  }
  return nuevos.map((b) => {
    if (b.codigo) return b;
    const letra = letraDeTarea(nodes, b);
    const n = (ultimo.get(letra) ?? 0) + 1;
    ultimo.set(letra, n);
    return { ...b, codigo: `${letra}${n}` };
  });
};

/**
 * Recupera el código de las tareas que el wizard de edición reconstruyó: las empareja con las que
 * había antes por texto + rol. Sin esto, cada "Guardar cambios" les daría un código nuevo (C1 →
 * C7 → C13…), porque `buildFabricaBriefs` las regenera desde cero con ids nuevos.
 * Se emparejan de a una (`shift`) para que dos tareas con el mismo nombre no se lleven el mismo
 * código.
 */
const heredarCodigos = (previas: FabricaBriefItem[], nuevas: FabricaBriefItem[]): FabricaBriefItem[] => {
  const disponibles = new Map<string, string[]>();
  for (const b of previas) {
    if (!b.codigo) continue;
    const k = `${b.tarea}|${b.roleLabel}`;
    const lista = disponibles.get(k);
    if (lista) lista.push(b.codigo);
    else disponibles.set(k, [b.codigo]);
  }
  return nuevas.map((b) => {
    if (b.codigo) return b;
    const heredado = disponibles.get(`${b.tarea}|${b.roleLabel}`)?.shift();
    return heredado ? { ...b, codigo: heredado } : b;
  });
};

/** Número consecutivo de campaña. Se toma el máximo ya usado + 1 en vez de `length + 1`: si se
 *  borra una campaña del medio, su número no se recicla y no queda otra con el mismo. */
const siguienteNumero = (projects: FactoryProject[]): number =>
  projects.reduce((max, p) => Math.max(max, p.numero ?? 0), 0) + 1;

/** Backfill de una sola vez para las campañas creadas antes de que existieran los números: se
 *  reparten por fecha de creación ascendente, de modo que la más vieja sea la 1. Devuelve también
 *  cuáles cambiaron, para persistir solo esas y no reescribir la base entera en cada carga.
 *
 *  Repara además los DUPLICADOS: `siguienteNumero` calcula el consecutivo con la lista que tiene
 *  el navegador en memoria, así que dos campañas creadas a la vez (dos personas, o dos pestañas)
 *  salían las dos con el mismo `#`. Acá se resuelve al leer, dejándole el número a la más vieja y
 *  renumerando la otra — la regla es determinista (orden por `createdAt`), así que los dos
 *  navegadores llegan al mismo resultado sin coordinarse. */
const asignarNumerosFaltantes = (projects: FactoryProject[]) => {
  const numerados = projects.filter((p) => typeof p.numero === 'number');
  const hayDuplicados = new Set(numerados.map((p) => p.numero)).size !== numerados.length;
  if (!hayDuplicados && numerados.length === projects.length) {
    return { projects, cambiados: [] as FactoryProject[] };
  }
  let n = projects.reduce((max, p) => Math.max(max, p.numero ?? 0), 0);
  const porFecha = [...projects].sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''));
  const numeros = new Map<string, number>();
  const vistos = new Set<number>();
  for (const p of porFecha) {
    if (typeof p.numero !== 'number') {
      numeros.set(p.id, ++n);
    } else if (vistos.has(p.numero)) {
      // Ya lo tiene otra campaña más vieja: esta estrena número al final de la fila.
      numeros.set(p.id, ++n);
    } else {
      vistos.add(p.numero);
    }
  }
  const cambiados: FactoryProject[] = [];
  const actualizados = projects.map((p) => {
    const nuevo = numeros.get(p.id);
    if (nuevo === undefined) return p;
    const actualizado = { ...p, numero: nuevo };
    cambiados.push(actualizado);
    return actualizado;
  });
  return { projects: actualizados, cambiados };
};

// --- Supabase sync helpers ---
const rowToProject = (row: any): FactoryProject => {
  const data = row.data || {};
  return {
    id: row.id,
    numero: typeof data.numero === 'number' ? data.numero : null,
    name: row.name,
    description: row.description ?? '',
    client: row.client ?? '',
    state: migrateState(row.state),
    priority: (['P0', 'P1', 'P2'] as const).includes(row.priority) ? row.priority as ProjectPriority : 'P2',
    startDate: data.startDate ?? null,
    dueDate: row.due_date,
    createdAt: row.created_at,
    roleGroups: data.roleGroups ?? [],
    tasks: data.tasks ?? [],
    strategyNodes: mergeGuionNodes(stripApprovalNodes(data.strategyNodes ?? [])),
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
    etapas: data.etapas ?? [],
    mensajeBase: data.mensajeBase ?? { emocion: '', logica: '', motivacion: '', recompensa: '' },
    motor: data.motor ?? { fuenteValidacion: '' },
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
      // Contador de escrituras, lo fija `syncProject` justo antes de guardar (ver la guardia de
      // escritura obsoleta). Acá solo se declara para que el objeto tenga la forma correcta.
      revision: 0,
      numero: p.numero ?? null,
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
      etapas: p.etapas,
      mensajeBase: p.mensajeBase,
      motor: p.motor,
    },
});

/**
 * GUARDIA DE ESCRITURA OBSOLETA — la campaña se guarda como un solo blob JSONB, así que cada
 * escritura reemplaza el proyecto ENTERO. Con dos personas trabajando a la vez, quien guardaba
 * de último pisaba el trabajo del otro **sin ningún error ni aviso**: bastaba con dejar la
 * pestaña abierta un rato (nada vuelve a leer de la base sola) y tocar cualquier cosa para
 * escribir una copia vieja encima de lo que otro acababa de aprobar.
 *
 * Se resuelve con un contador `data.revision` por campaña: antes de escribir se compara el que
 * hay en la base contra el último que conocemos. Si el de la base es mayor, alguien más escribió
 * en el medio: NO se pisa — se recarga esa campaña con lo que hay en la base y se avisa, para
 * que la persona repita su cambio sobre el dato bueno. Perder un clic es infinitamente mejor
 * que borrar la tarde de trabajo de otra persona.
 *
 * El número conocido se guarda acá (no en el objeto del proyecto) a propósito: el `setTimeout`
 * captura una instantánea del proyecto, así que leerlo de ahí daría falsos conflictos al hacer
 * dos cambios seguidos.
 */
const revisionConocida = new Map<string, number>();
const revisionDe = (data: any): number => (typeof data?.revision === 'number' ? data.revision : 0);

const pendingSync = new Map<string, ReturnType<typeof setTimeout>>();

/** ¿Hay escrituras locales sin confirmar? Se usa para no recargar encima de un cambio en vuelo. */
export const haySincronizacionPendiente = () => pendingSync.size > 0;

/** Recarga UNA campaña desde la base y la deja en el store (sin tocar las demás). */
const recargarProyecto = async (id: string) => {
  const { data } = await supabase.from('factory_projects').select('*').eq('id', id).maybeSingle();
  if (!data) return;
  revisionConocida.set(id, revisionDe(data.data));
  const fresco = rowToProject(data);
  useFactoryStore.setState((s) => ({
    projects: s.projects.map((p) => (p.id === id ? fresco : p)),
  }));
};

const syncProject = (project: FactoryProject) => {
  const existing = pendingSync.get(project.id);
  if (existing) clearTimeout(existing);
  const t = setTimeout(async () => {
    pendingSync.delete(project.id);

    const conocida = revisionConocida.get(project.id) ?? 0;
    const { data: remoto } = await supabase
      .from('factory_projects')
      .select('data')
      .eq('id', project.id)
      .maybeSingle();

    // `remoto` nulo = la campaña todavía no existe en la base (recién creada): se inserta.
    if (remoto && revisionDe(remoto.data) > conocida) {
      console.warn('Escritura descartada: la campaña cambió en la base', project.id);
      await recargarProyecto(project.id);
      toast.error('Otra persona actualizó esta campaña', {
        description: 'Se recargó con la versión más reciente. Vuelve a hacer tu cambio para no perder lo que hizo el otro.',
      });
      return;
    }

    const nueva = conocida + 1;
    const row = projectToRow(project);
    row.data.revision = nueva;
    const { error } = await supabase
      .from('factory_projects')
      .upsert([row] as any, { onConflict: 'id' });
    if (error) {
      console.error('Error syncing project:', error);
      return;
    }
    revisionConocida.set(project.id, nueva);
  }, 400);
  pendingSync.set(project.id, t);
};

const deleteRow = async (id: string) => {
  const existing = pendingSync.get(id);
  if (existing) clearTimeout(existing);
  pendingSync.delete(id);
  revisionConocida.delete(id);
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
    // Punto de partida de la guardia de escritura obsoleta: a partir de acá sabemos en qué
    // revisión venía cada campaña, y no se pisa una que haya avanzado por otro lado.
    for (const row of data ?? []) revisionConocida.set(row.id, revisionDe(row.data));

    // Las campañas anteriores a los números consecutivos reciben el suyo acá, una sola vez.
    // Se persisten solo las que cambiaron; a partir de la siguiente carga esto no hace nada.
    const { projects, cambiados } = asignarNumerosFaltantes((data ?? []).map(rowToProject));
    set({ projects, isLoaded: true });
    cambiados.forEach(syncProject);
  },

  addProject: (data) => {
    const id = `proj-${uid()}`;
    const canales = data.canales ?? [];
    const strategyNodes = syncCanalNodes(buildDefaultStrategyNodes(data.requerimientos), canales);
    const project: FactoryProject = {
      ...data,
      startDate: data.startDate ?? null,
      dueDate: data.dueDate ?? null,
      strategistName: data.strategistName ?? '',
      audienciaNarrativa: data.audienciaNarrativa ?? { segmentos: [], metaInscripciones: '', dolor: '', promesa: '', bigIdea: '' },
      canales,
      loops: data.loops ?? [],
      fabricaBriefs: asignarCodigos(strategyNodes, [], stampCanalNodeIds(strategyNodes, data.fabricaBriefs ?? [])),
      requerimientos: data.requerimientos ?? [],
      segmentLink: data.segmentLink ?? '',
      eventCategory: data.eventCategory ?? '',
      promocionarEn: data.promocionarEn ?? [],
      formularioConfig: data.formularioConfig ?? { basico: null, camposAdicionales: '', cuadroTexto: '' },
      attachments: data.attachments ?? [],
      etapas: data.etapas ?? [],
      mensajeBase: data.mensajeBase ?? { emocion: '', logica: '', motivacion: '', recompensa: '' },
      motor: data.motor ?? { fuenteValidacion: '' },
      id,
      numero: siguienteNumero(get().projects),
      createdAt: new Date().toISOString(),
      roleGroups: [],
      tasks: [],
      strategyNodes,
    };
    set((s) => ({ projects: [project, ...s.projects], activeProjectId: id }));
    revisionConocida.set(id, 0); // fila nueva: la primera escritura la deja en 1
    syncProject(project);
    // La campaña nace con su lote de entregables ya sembrado por el wizard: avisarle a cada rol
    // acá es el único punto donde se enteran (esas tareas no pasan por addFabricaBriefs).
    notificarTareasAsignadas(project, project.fabricaBriefs ?? []);
    return id;
  },

  updateProject: (id, updates) =>
    persistAfter(set, get, id, (s) => ({
      projects: patchProject(s.projects, id, (p) => {
        let strategyNodes = p.strategyNodes;
        if (updates.requerimientos) strategyNodes = syncRequerimientoNodes(strategyNodes, updates.requerimientos);
        if (updates.canales) strategyNodes = syncCanalNodes(strategyNodes, updates.canales);
        const base = updates.canales || updates.requerimientos
          ? stampCanalNodeIds(strategyNodes, updates.fabricaBriefs ?? p.fabricaBriefs)
          : (updates.fabricaBriefs ?? p.fabricaBriefs);
        // Guardar el wizard de edición reconstruye `fabricaBriefs` desde cero (ver el riesgo del
        // punto 14 de la bitácora), así que las tareas vuelven sin código. Primero se recupera el
        // que ya tenían (por texto + rol) y solo lo verdaderamente nuevo estrena consecutivo.
        const fabricaBriefs = asignarCodigos(
          strategyNodes,
          p.fabricaBriefs ?? [],
          heredarCodigos(p.fabricaBriefs ?? [], base)
        );
        return { ...p, ...updates, strategyNodes, fabricaBriefs };
      }),
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

  addFabricaBriefs: (projectId, briefs) => {
    persistAfter(set, get, projectId, (s) => ({
      projects: patchProject(s.projects, projectId, (p) => ({
        ...p,
        fabricaBriefs: [
          ...(p.fabricaBriefs ?? []),
          ...asignarCodigos(
            p.strategyNodes ?? [],
            p.fabricaBriefs ?? [],
            briefs.map((b) => ({ ...b, id: uid(), checked: false }))
          ),
        ],
      })),
    }));
    // Único punto por el que entra una tarea nueva a una campaña ya creada: el quick-add de los
    // nodos y las que activa una aprobación (activateNextStage). Notificar acá cubre las dos
    // sin repetir la llamada en cada panel. El proyecto se relee del store para que el correo
    // salga con los roleGroups y el nombre actuales.
    const project = get().projects.find((p) => p.id === projectId);
    if (project) notificarTareasAsignadas(project, briefs);
  },

  updateFabricaBrief: (projectId, briefId, updates) =>
    persistAfter(set, get, projectId, (s) => ({
      projects: patchProject(s.projects, projectId, (p) => ({
        ...p,
        fabricaBriefs: (p.fabricaBriefs ?? []).map((b) => (b.id === briefId ? { ...b, ...updates } : b)),
      })),
    })),

  setActiveProject: (id) => set({ activeProjectId: id }),
}));
