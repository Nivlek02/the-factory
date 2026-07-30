import { useMemo, useState } from 'react';
import {
  FactoryProject,
  StrategyNode,
  FabricaBriefItem,
  useFactoryStore,
} from '@/store/factoryStore';
import { useAuthStore } from '@/store/authStore';
import { ROLE_LABELS, type AppRole } from '@/services/authService';
import {
  DeliverableSummary,
  BriefStatusBadge,
  getBriefStatus,
  isCanalBrief,
  isUrlBrief,
  isLandingCopy,
} from '@/components/factory/DeliverableSummary';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { es } from 'date-fns/locale';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Plus, MessageSquare, FileText, Image as ImageIcon, History, Calendar as CalendarIcon, CalendarClock, Trash2 } from 'lucide-react';
import { calcularUrgencia, formatFechaCorta, formatFechaLarga } from '@/lib/urgencia';
import { notificarEnRevision, notificarAprobada, notificarCorreccion } from '@/services/emailNotifications';
import { cn } from '@/lib/utils';
import { esUrlHttp } from '@/lib/urlSegura';
import RichTextEditor from '@/components/ui/rich-text-editor';
import FileUpload, { Attachment } from '@/components/ui/file-upload';

const genId = () => `c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const authorName = () => useAuthStore.getState().currentUser?.fullName ?? 'Usuario';

/** Misma comprobación que usa el render de los enlaces guardados, en un solo lugar: si algún día
 *  se relaja una, no puede quedar la otra por detrás. Ver src/lib/urlSegura.ts. */
const isValidUrl = (value: string) => esUrlHttp(value);

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleDateString('es-CO', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

/** El guion de la llamada vive como una tarea más dentro de Copys (mismo roleLabel Copywriter),
 *  pero conceptualmente pertenece solo a la rama de Call Center — no debe disparar Diseño, y el
 *  resto de copys no debe disparar el registro de Call Center. Ver también `briefsForNode`. */
const isCallCenterGuion = (tarea: string) => /guion/i.test(tarea) && /call center/i.test(tarea);

/** Nombre de la tarea de diseño a partir del copy que la disparó: "Redactar copy para Correo —
 *  Convocatoria" pasa a "Diseño de pieza para Correo — Convocatoria", conservando el canal y el
 *  ángulo. Un copy creado a mano desde el quick-add del nodo (título libre) no matchea el patrón:
 *  ahí se antepone el prefijo sin tocar el texto, para no perder lo que la persona escribió. */
const nombreDePieza = (tarea: string) => {
  const m = tarea.match(/^Redactar\s+(?:el\s+)?copy\s+(?:para|de)\s+(.+)$/i);
  return m ? `Diseño de pieza para ${m[1]}` : `Diseño de pieza — ${tarea}`;
};

/**
 * Etapas cuya aprobación puede activar automáticamente una tarea en el siguiente nodo de la
 * cadena (ver `activateNextStage`). Copys se bifurca hacia Diseño, Call Center y la landing.
 *
 * `tarea` fija un nombre igual para todas; `renombrar` lo deriva del entregable aprobado (Diseño:
 * la pieza se llama como su copy, pero anunciando que ahora es un diseño). Sin ninguno de los dos
 * se hereda el nombre tal cual. `unico` = un solo checkpoint por nodo, sin importar cuántos
 * entregables se aprueben aguas arriba.
 */
const AUTO_ADVANCE: Partial<Record<
  StrategyNode['stageType'],
  { tarea?: string; renombrar?: (tarea: string) => string; unico?: boolean }
>> = {
  diseno: { renombrar: nombreDePieza },
  callcenter: { tarea: 'Registrar realización — Call Center', unico: true },
  landing_formulario: { tarea: 'Formulario de la landing', unico: true },
  landing: { tarea: 'Cargue de la landing', unico: true },
};

/** Etiqueta de rol → id interno ('Diseñador' → 'diseno'). Los `roleLabel` de los nodos son texto
 *  para mostrar; el `roleId` de una tarea tiene que ser el id, porque es con lo que
 *  `isTaskOwnedBy` decide de quién es. Si la etiqueta no está en el catálogo (ej. 'Social Media',
 *  que no es uno de los roles de equipo) se devuelve tal cual: es lo que ya pasaba y sigue
 *  funcionando para el match por nombre del grupo de rol. */
const roleIdDeEtiqueta = (label: string): string =>
  (Object.keys(ROLE_LABELS) as AppRole[]).find((id) => ROLE_LABELS[id] === label) ?? label;

/** ¿El nodo `stageType` se activa al aprobar este entregable? Las tres ramas que salen de Copys
 *  (Diseño, Call Center y landing) no se cruzan: cada entregable dispara solo la suya. */
const avanzaDesde = (stageType: StrategyNode['stageType'], tarea: string): boolean => {
  if (stageType === 'callcenter') return isCallCenterGuion(tarea);
  if (stageType === 'landing_formulario') return isLandingCopy(tarea);
  if (stageType === 'diseno') return !isCallCenterGuion(tarea) && !isLandingCopy(tarea);
  return true; // landing ← landing_formulario: cadena lineal, sin bifurcación
};

/** Al aprobar un entregable, activa automáticamente una tarea pendiente para el siguiente nodo de
 *  la cadena: cualquier copy que NO sea el guion de Call Center → Diseño; el guion → el registro
 *  de Call Center (y nada más — las dos ramas de la bifurcación de Copys no se cruzan). El
 *  entregable original no se mueve — el historial de aprobación queda en su propia tarea (ver
 *  `briefsForNode`).
 *  `currentNodeId` se recibe explícito (no se lee de `brief.currentNodeId`) porque entregables
 *  sembrados desde el wizard pueden no tenerlo estampado — el panel que abre el diálogo siempre
 *  sabe en qué nodo vive la tarea que se está aprobando. */
const activateNextStage = (project: FactoryProject, currentNodeId: string, brief: FabricaBriefItem) => {
  const nodes = project.strategyNodes ?? [];
  const nextNodes = nodes.filter(
    (n) =>
      n.dependsOn.includes(currentNodeId) &&
      !!n.roleLabel &&
      !!AUTO_ADVANCE[n.stageType] &&
      avanzaDesde(n.stageType, brief.tarea)
  );
  if (nextNodes.length === 0) return;

  const live = useFactoryStore.getState().projects.find((p) => p.id === project.id) ?? project;
  const toAdd: Omit<FabricaBriefItem, 'id' | 'checked'>[] = [];
  for (const n of nextNodes) {
    const cfg = AUTO_ADVANCE[n.stageType]!;
    // Checkpoint único: no se duplica por más entregables que se aprueben aguas arriba.
    if (cfg.unico && (live.fabricaBriefs ?? []).some((b) => b.currentNodeId === n.id)) continue;
    toAdd.push({
      // El nodo puede no traer `roleId` (la mayoría lo tiene en null): antes se caía a la ETIQUETA
      // ('Diseñador'), y como `isTaskOwnedBy` compara contra el id del rol ('diseno'), la tarea no
      // le aparecía a nadie en "Mis tareas". Se traduce la etiqueta a su id.
      roleId: n.roleId ?? roleIdDeEtiqueta(n.roleLabel!),
      roleLabel: n.roleLabel!,
      tarea: cfg.tarea ?? cfg.renombrar?.(brief.tarea) ?? brief.tarea,
      currentNodeId: n.id,
      workflowStatus: 'pending',
      // La fecha viaja por la cadena: la pieza de diseño se necesita para la misma acción que su
      // copy. Sin esto las tareas creadas acá nacían sin fecha y no mostraban el semáforo (ni en
      // la lista del nodo ni en la tarjeta del diagrama), a diferencia de las del Plan de canales.
      // Sigue siendo editable desde la propia tarea.
      fechaAccion: brief.fechaAccion ?? null,
      // Referencia al entregable aprobado, para poder consultarlo desde la tarea nueva.
      sourceBriefId: brief.id,
    });
  }
  if (toAdd.length > 0) useFactoryStore.getState().addFabricaBriefs(project.id, toAdd);
};

/** Entregables que viven en un nodo: por currentNodeId (fijo desde su creación), o por roleLabel
 *  si aún no lo tienen (datos legados/creados desde el wizard). El entregable nunca "se mueve" de
 *  nodo — solo cambia su `workflowStatus`, así que aprobar/corregir siempre se hace desde la
 *  misma tarea. El rol "Gestor de canales" se comparte entre Landing, Formulario y Envíos, así
 *  que para los entregables sin currentNodeId además hace falta desambiguar por el texto de la
 *  tarea para que cada nodo muestre solo lo suyo. */
export const briefsForNode = (project: FactoryProject, node: StrategyNode): FabricaBriefItem[] =>
  (project.fabricaBriefs ?? []).filter((b) => {
    if (b.currentNodeId) return b.currentNodeId === node.id;
    // El cargue de landing pasó de Gestor de canales a Soporte: los entregables de proyectos
    // viejos conservan el rol anterior, así que acá no se puede filtrar por rol.
    if (node.stageType === 'landing') return /^(Landing page|Cargue de la landing)$/i.test(b.tarea);
    if (b.roleLabel !== node.roleLabel) return false;
    if (node.stageType === 'envios') return isCanalBrief(b.tarea);
    if (node.stageType === 'landing_formulario') return /^Formulario de la landing/i.test(b.tarea);
    // El copy de la landing vive en Copys (roleLabel Copywriter), no acá.
    if (node.stageType === 'formulario') return b.tarea.includes('Formulario de inscripción');
    // KAM/BTL/Relacionamiento/Call Center comparten roleLabel "Estratega" — sin esto, un
    // entregable sin currentNodeId (que debería estar cubierto por stampCanalNodeIds, ver
    // factoryStore) aparecería a la vez en los 4 nodos en vez de en el suyo.
    if (node.stageType === 'kam') return /\bKAM\b/i.test(b.tarea);
    if (node.stageType === 'btl') return /\bBTL\b/i.test(b.tarea);
    if (node.stageType === 'relacionamiento') return /relacionamiento/i.test(b.tarea);
    // El registro de Call Center (Estratega) siempre lleva currentNodeId (lo crea
    // activateNextStage), así que este texto es solo una red de seguridad. El guion de la llamada
    // vive en Copys (roleLabel Copywriter), no aquí.
    if (node.stageType === 'callcenter') return /call center/i.test(b.tarea) && !isCallCenterGuion(b.tarea);
    return true;
  });

const hasUnresolvedCorrection = (brief: FabricaBriefItem) =>
  getBriefStatus(brief) === 'pending' && (brief.comments ?? []).some((c) => c.isAdjustmentRequest);

// ───────────────────────────────────────────────────────────────────────────
// Shared list row/group
// ───────────────────────────────────────────────────────────────────────────

/** Chip de fecha + urgencia. Una tarea ya completada no urge, así que se muestra en gris:
 *  pintarla de rojo por "vencida" cuando ya se entregó sería ruido. */
export const FechaAccionChip = ({
  fecha, completada, className = '',
}: {
  fecha?: string | null;
  completada?: boolean;
  className?: string;
}) => {
  const urgencia = calcularUrgencia(fecha);
  if (!urgencia) return null;

  const cls = completada ? 'bg-muted text-muted-foreground' : urgencia.className;
  return (
    <span
      className={`shrink-0 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${cls} ${className}`}
      title={completada ? `Fecha de la acción: ${urgencia.etiqueta}` : urgencia.etiqueta}
    >
      <CalendarClock className="h-3 w-3" />
      {formatFechaCorta(fecha)}
    </span>
  );
};

/** 'YYYY-MM-DD' ↔ Date local. `new Date('2026-07-20')` se interpreta como UTC y en Colombia
 *  (UTC-5) devolvería el día anterior — el mismo motivo por el que existe `parseISOLocal` en
 *  `lib/urgencia`. Y al revés: `toISOString()` sobre una fecha local del calendario también
 *  correría el día, así que se arma a mano. */
const aISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const deISO = (iso?: string | null): Date | undefined => {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : undefined;
};

/**
 * Fecha de entrega de la tarea, con calendario para reprogramarla.
 *
 * **Toda tarea debe tener fecha de entrega**, así que acá no hay forma de dejarla sin fecha: el
 * enlace que lo hacía se quitó (se leía como "quitar la tarea" y era justo lo contrario de lo que
 * se quiere). Si una tarea no la tiene —creada a mano, o de antes de que existiera el campo— se
 * señala en ámbar para que se note que falta.
 *
 * Usa Popover + Calendar (los mismos de los filtros de Reportes) en vez del `input[type=date]`
 * oculto con `showPicker()`: ese depende del picker nativo del navegador, que en algunos ni se abre
 * al hacer clic en un texto.
 */
const FechaEntregaEditor = ({
  fecha, readOnly, onChange,
}: {
  fecha?: string | null;
  readOnly?: boolean;
  onChange: (v: string) => void;
}) => {
  const [abierto, setAbierto] = useState(false);
  const urgencia = calcularUrgencia(fecha);

  const chipUrgencia = urgencia && (
    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${urgencia.className}`}>
      {urgencia.etiqueta}
    </span>
  );

  if (readOnly) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <CalendarClock className="h-3.5 w-3.5" />
        {fecha ? formatFechaCorta(fecha) : <span className="text-state-review">Sin fecha de entrega</span>}
        {chipUrgencia}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <Popover open={abierto} onOpenChange={setAbierto}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'h-7 px-2 text-xs font-normal',
              !fecha && 'text-state-review border-state-review/40'
            )}
            title={fecha ? 'Reprogramar la fecha de entrega' : 'Poner la fecha de entrega'}
          >
            <CalendarClock className="h-3.5 w-3.5" />
            {fecha ? formatFechaLarga(fecha) : 'Poner fecha de entrega'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            locale={es}
            defaultMonth={deISO(fecha)}
            selected={deISO(fecha)}
            onSelect={(d) => {
              // `onSelect` manda `undefined` al hacer clic sobre el día ya elegido (Radix lo trata
              // como "deseleccionar"). Acá eso no aplica: quedarse sin fecha no es una opción.
              if (!d) return;
              onChange(aISO(d));
              setAbierto(false);
            }}
            initialFocus
          />
        </PopoverContent>
      </Popover>
      {chipUrgencia}
    </span>
  );
};

/** Código corto de la tarea (C1, D2…). Monoespaciado y con ancho mínimo para que la columna de
 *  códigos quede alineada aunque unos tengan una letra y otros dos (CC, LF). */
export const CodigoTarea = ({ codigo, className = '' }: { codigo: string; className?: string }) => (
  <span
    className={`shrink-0 min-w-[2.25rem] text-center rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-tight text-muted-foreground ${className}`}
    title="Identificador de la tarea"
  >
    {codigo}
  </span>
);

const BriefRow = ({
  brief, onClick, badge,
}: {
  brief: FabricaBriefItem;
  onClick: () => void;
  badge?: React.ReactNode;
}) => (
  <button
    onClick={onClick}
    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-md border border-border/60 bg-card/60 hover:bg-muted/40 text-left transition-colors"
  >
    {brief.codigo && <CodigoTarea codigo={brief.codigo} />}
    <span className="text-sm flex-1 truncate">{brief.tarea}</span>
    <FechaAccionChip fecha={brief.fechaAccion} completada={getBriefStatus(brief) === 'completed'} />
    {hasUnresolvedCorrection(brief) && (
      <MessageSquare className="h-3.5 w-3.5 text-state-blocked shrink-0" aria-label="Con corrección pendiente" />
    )}
    {badge ?? <BriefStatusBadge brief={brief} />}
  </button>
);

const BriefGroup = ({
  title, items, onOpen, badge, hideIfEmpty, emptyLabel = 'Sin elementos.',
}: {
  title: string;
  items: FabricaBriefItem[];
  onOpen: (b: FabricaBriefItem) => void;
  badge?: (b: FabricaBriefItem) => React.ReactNode;
  hideIfEmpty?: boolean;
  emptyLabel?: string;
}) => {
  if (hideIfEmpty && items.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        {title} ({items.length})
      </p>
      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground italic px-1 py-2">{emptyLabel}</p>
        ) : items.map((b) => (
          <BriefRow key={b.id} brief={b} onClick={() => onOpen(b)} badge={badge?.(b)} />
        ))}
      </div>
    </div>
  );
};

// ───────────────────────────────────────────────────────────────────────────
// Un solo diálogo por entregable — el cuerpo y los botones cambian según su
// estado (pending: editar y enviar; in_review: aprobar o corregir; completed:
// solo lectura), pero nunca hace falta salir de la tarea para actuar sobre ella.
// ───────────────────────────────────────────────────────────────────────────

const BriefDialog = ({
  project: projectProp, brief: briefProp, nodeId, hasApprovalStage, urlOnly, queue, onClose, onAdvance,
}: {
  project: FactoryProject;
  brief: FabricaBriefItem;
  /** Nodo desde el que se abrió esta tarea — se usa para activar el siguiente nodo de la cadena
   *  al aprobar (ver `activateNextStage`) y para estampar `currentNodeId` en el entregable. */
  nodeId: string;
  /** Si existe una etapa de Aprobación aguas abajo, "enviar" pasa a revisión en vez de completar directo. */
  hasApprovalStage: boolean;
  /** El nodo es Landing/Formulario: el entregable siempre es una URL, sin importar el texto de la
   *  tarea (incluye tareas creadas a mano desde "Nueva tarea" en ese nodo). Si no se pasa, se
   *  infiere del texto de la tarea (`isUrlBrief`) para compatibilidad con otros llamadores. */
  urlOnly?: boolean;
  /** Hermanos en la misma lista, para avanzar automáticamente al siguiente tras aprobar/corregir. */
  queue?: FabricaBriefItem[];
  onClose: () => void;
  onAdvance?: (next: FabricaBriefItem) => void;
}) => {
  const { updateFabricaBrief, deleteFabricaBrief, projects } = useFactoryStore();

  // La campaña y la tarea se releen del store EN VIVO. Lo que llega por props es una instantánea
  // del momento en que se abrió el diálogo (`setOpenBrief(brief)`), así que al cambiar algo —la
  // fecha de entrega, por ejemplo— el dato se guardaba pero la pantalla seguía mostrando el valor
  // viejo: parecía que el clic no hacía nada, y al cerrar y volver a abrir aparecía el cambio.
  // Se cae a las props si no se encuentra (la tarea se acabó de borrar, o el llamador pasa una
  // campaña que no está en el store).
  const project = projects.find((p) => p.id === projectProp.id) ?? projectProp;
  const brief = (project.fabricaBriefs ?? []).find((b) => b.id === briefProp.id) ?? briefProp;

  const status = getBriefStatus(brief);
  const isEditable = status === 'pending';
  const isReviewable = status === 'in_review';
  const isUrl = urlOnly ?? isUrlBrief(brief.tarea);

  const [content, setContent] = useState(brief.deliverableContent ?? '');
  const [attachments, setAttachments] = useState<Attachment[]>(brief.deliverableAttachments ?? []);
  const [newComment, setNewComment] = useState('');
  const [correctionComment, setCorrectionComment] = useState('');

  // Entregable que dio origen a esta tarea (el copy aprobado, para la pieza de diseño). Se busca
  // en vivo por id: si el copy se corrige después, acá se ve la versión corregida. Si el original
  // se borró, `sourceBriefId` queda colgando y simplemente no se muestra la pestaña.
  const sourceBrief = brief.sourceBriefId
    ? (project.fabricaBriefs ?? []).find((b) => b.id === brief.sourceBriefId) ?? null
    : null;
  const [tab, setTab] = useState<'tarea' | 'origen'>('tarea');
  const showSource = !!sourceBrief && tab === 'origen';

  const priorComments = brief.comments ?? [];
  const lastCorrection = [...priorComments].reverse().find((c) => c.isAdjustmentRequest);

  const advanceOrClose = () => {
    const siguiente = queue?.find((b) => b.id !== brief.id) ?? null;
    // El `queue` es del render anterior: si se abriera ese objeto tal cual, se vería el entregable
    // como estaba antes. Se relee del store por id para mostrar su estado actual.
    const vivo = siguiente
      ? useFactoryStore.getState().projects
          .find((p) => p.id === project.id)
          ?.fabricaBriefs?.find((b) => b.id === siguiente.id)
      : null;
    const next = vivo ?? siguiente;
    if (next && onAdvance) onAdvance(next); else onClose();
  };

  const handleAddComment = () => {
    const text = newComment.trim();
    if (!text) return;
    updateFabricaBrief(project.id, brief.id, {
      comments: [...priorComments, {
        id: genId(), author: authorName(), content: text, isAdjustmentRequest: false,
        createdAt: new Date().toISOString(),
      }],
    });
    setNewComment('');
  };

  const handleSubmit = () => {
    const now = new Date().toISOString();
    updateFabricaBrief(project.id, brief.id, {
      deliverableContent: content,
      deliverableAttachments: attachments,
      workflowStatus: hasApprovalStage ? 'in_review' : 'completed',
      deliverableSubmittedAt: now,
      currentNodeId: nodeId,
      comments: [...priorComments, {
        id: genId(), author: authorName(),
        content: hasApprovalStage ? 'Entregable enviado a revisión' : 'Entregable marcado como completado',
        isAdjustmentRequest: false, isSystemEvent: true, createdAt: now,
      }],
    });
    // Solo avisa cuando de verdad hay alguien esperando revisar: sin etapa de aprobación el
    // entregable queda completado y no hay a quién notificar.
    if (hasApprovalStage) notificarEnRevision(project, brief);
    onClose();
  };

  const handleApprove = () => {
    const now = new Date().toISOString();
    updateFabricaBrief(project.id, brief.id, {
      workflowStatus: 'completed',
      currentNodeId: nodeId,
      comments: [...priorComments, {
        id: genId(), author: authorName(), content: 'Entregable aprobado',
        isAdjustmentRequest: false, isSystemEvent: true, createdAt: now,
      }],
    });
    notificarAprobada(project, brief);
    // Las tareas que esto siembre en el siguiente nodo notifican solas desde addFabricaBriefs.
    activateNextStage(project, nodeId, brief);
    advanceOrClose();
  };

  const handleDelete = () => {
    deleteFabricaBrief(project.id, brief.id);
    // No se avanza al siguiente de la cola: la persona vino a borrar, no a revisar.
    onClose();
  };

  const handleReject = () => {
    const text = correctionComment.trim();
    if (!text) return;
    updateFabricaBrief(project.id, brief.id, {
      comments: [...priorComments, {
        id: genId(), author: authorName(), content: text, isAdjustmentRequest: true,
        createdAt: new Date().toISOString(),
      }],
      workflowStatus: 'pending',
      deliverableSubmittedAt: null,
      currentNodeId: nodeId,
    });
    notificarCorreccion(project, brief, text);
    advanceOrClose();
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="sm:max-w-2xl max-h-[85vh] overflow-y-auto"
        /* Un clic fuera no cierra la tarea: se pierde lo escrito en el editor y el comentario de
           corrección, que no se autoguardan. Hay que frenar los DOS eventos — Radix dispara el
           cierre por vías distintas según sea puntero o foco/táctil. Escape y la X siguen vivos. */
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            {brief.codigo && <CodigoTarea codigo={brief.codigo} className="text-[11px]" />}
            <span>{brief.tarea}</span>
            <BriefStatusBadge brief={brief} />
          </DialogTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs text-muted-foreground">Rol: {brief.roleLabel}</p>
            <span className="text-xs text-muted-foreground">·</span>
            <FechaEntregaEditor
              fecha={brief.fechaAccion}
              readOnly={!isEditable}
              onChange={(v) => updateFabricaBrief(project.id, brief.id, { fechaAccion: v })}
            />
          </div>
        </DialogHeader>

        {sourceBrief && (
          <Tabs value={tab} onValueChange={(v) => setTab(v as 'tarea' | 'origen')}>
            <TabsList className="h-9">
              <TabsTrigger value="tarea" className="text-sm h-7">Esta tarea</TabsTrigger>
              <TabsTrigger value="origen" className="text-sm h-7">Paso anterior</TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        {showSource ? (
          <div className="space-y-3 py-2">
            <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Entregable del paso anterior — solo consulta
              </p>
              <p className="text-sm font-medium mt-0.5">{sourceBrief.tarea}</p>
              <p className="text-[11px] text-muted-foreground">Rol: {sourceBrief.roleLabel}</p>
            </div>
            <DeliverableSummary brief={sourceBrief} />
          </div>
        ) : isEditable ? (
          <div className="space-y-4 py-2">
            {lastCorrection && (
              <div className="rounded-md bg-state-blocked-bg/60 px-3 py-2 text-sm">
                <p className="text-[10px] font-semibold text-muted-foreground mb-0.5">
                  Corrección de {lastCorrection.author}
                </p>
                <p className="whitespace-pre-wrap">{lastCorrection.content}</p>
              </div>
            )}

            {brief.briefNotes && (
              <div className="rounded-lg border border-border/60 bg-muted/30 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Campos adicionales</p>
                <p className="text-sm text-foreground/80 whitespace-pre-wrap">{brief.briefNotes}</p>
              </div>
            )}

            {isUrl ? (
              <div className="space-y-2">
                <Label>URL del entregable</Label>
                <Input
                  type="url"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="https://..."
                />
                {content.trim() && !isValidUrl(content.trim()) && (
                  <p className="text-xs text-destructive">Ingresa una URL válida (con http:// o https://)</p>
                )}
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Contenido del entregable</Label>
                  <RichTextEditor
                    content={content}
                    onChange={setContent}
                    placeholder="Escribe aquí el contenido del entregable..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Archivos adjuntos</Label>
                  <FileUpload attachments={attachments} onChange={setAttachments} taskId={brief.id} />
                </div>
              </>
            )}

            <div className="space-y-2 border-t border-border/40 pt-3">
              <Label className="text-xs flex items-center gap-1"><MessageSquare className="h-3 w-3" /> Comentarios e historial</Label>
              {priorComments.length > 0 && (
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {priorComments.map((c) => (
                    c.isSystemEvent ? (
                      <div key={c.id} className="flex items-center gap-1.5 text-[10px] text-muted-foreground py-0.5">
                        <History className="h-3 w-3 shrink-0" />
                        <span className="flex-1">{c.content}</span>
                        <span className="shrink-0">{c.author} · {formatDateTime(c.createdAt)}</span>
                      </div>
                    ) : (
                      <div
                        key={c.id}
                        className={cn('rounded-md px-2.5 py-1.5 text-xs', c.isAdjustmentRequest ? 'bg-state-blocked-bg/50' : 'bg-muted/40')}
                      >
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span className="text-[10px] text-muted-foreground">
                            {c.author}{c.isAdjustmentRequest ? ' · corrección' : ''}
                          </span>
                          <span className="text-[10px] text-muted-foreground">{formatDateTime(c.createdAt)}</span>
                        </div>
                        <p className="whitespace-pre-wrap">{c.content}</p>
                      </div>
                    )
                  ))}
                </div>
              )}
              <div className="flex gap-1.5">
                <Textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Agregar un comentario…"
                  className="text-xs min-h-[36px]"
                />
                <Button size="sm" variant="outline" className="h-9 shrink-0" onClick={handleAddComment} disabled={!newComment.trim()}>
                  Agregar
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-2">
            <DeliverableSummary brief={brief} />
          </div>
        )}

        {isReviewable && !showSource && (
          <div className="space-y-1.5 border-t border-border/40 pt-3">
            <Label className="text-xs">Comentario (obligatorio para enviar a corrección)</Label>
            <Textarea
              value={correctionComment}
              onChange={(e) => setCorrectionComment(e.target.value)}
              className="min-h-[70px] text-sm"
              placeholder="Explica qué hay que corregir…"
            />
          </div>
        )}

        <DialogFooter className="flex gap-2 sm:justify-between">
          {/* Eliminar va a la izquierda y separado de las acciones del flujo: es lo único
              irreversible del diálogo. Disponible en cualquier estado — una tarea creada por error
              o duplicada hay que poder borrarla igual si ya está aprobada. */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-state-blocked hover:text-state-blocked hover:bg-state-blocked-bg/40 sm:mr-auto"
              >
                <Trash2 className="h-4 w-4" />
                Eliminar tarea
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar esta tarea?</AlertDialogTitle>
                <AlertDialogDescription>
                  Se va <span className="font-medium text-foreground">«{brief.tarea}»</span> con su
                  entregable, sus adjuntos y su historial de aprobación. No se puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-state-blocked text-white hover:bg-state-blocked/90"
                >
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <div className="flex gap-2">
          {isEditable && (
            <>
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button
                onClick={handleSubmit}
                disabled={isUrl ? !isValidUrl(content.trim()) : !content && attachments.length === 0}
              >
                {hasApprovalStage ? 'Enviar a aprobación' : 'Marcar como completado'}
              </Button>
            </>
          )}
          {isReviewable && (
            <>
              <Button
                variant="outline"
                onClick={handleReject}
                disabled={!correctionComment.trim()}
                className="text-state-blocked border-state-blocked/40 hover:bg-state-blocked-bg/40"
              >
                Comentar y enviar a corrección
              </Button>
              <Button onClick={handleApprove}>Aprobar</Button>
            </>
          )}
          {status === 'completed' && (
            <Button variant="outline" onClick={onClose}>Cerrar</Button>
          )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const AttachmentsByDate = ({ briefs }: { briefs: FabricaBriefItem[] }) => {
  const groups = useMemo(() => {
    const map = new Map<string, { attachment: Attachment; brief: FabricaBriefItem }[]>();
    briefs.forEach((b) => {
      (b.deliverableAttachments ?? []).forEach((a) => {
        const iso = a.uploadedAt ?? b.deliverableSubmittedAt;
        const key = iso && !isNaN(Date.parse(iso))
          ? new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
          : 'Sin fecha';
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push({ attachment: a, brief: b });
      });
    });
    return Array.from(map.entries());
  }, [briefs]);

  if (groups.length === 0) {
    return <p className="text-xs text-muted-foreground italic py-6 text-center">Sin adjuntos todavía.</p>;
  }

  return (
    <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
      {groups.map(([date, items]) => (
        <div key={date}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">{date}</p>
          <div className="space-y-1.5">
            {items.map(({ attachment, brief }, i) => (
              <a
                key={attachment.id ?? i}
                href={attachment.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-md border border-border/50 bg-muted/30 px-2.5 py-1.5 text-xs hover:bg-muted/50 transition-colors"
              >
                {attachment.type === 'image'
                  ? <ImageIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  : <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                <span className="truncate flex-1">{attachment.name}</span>
                <span className="text-[10px] text-muted-foreground truncate max-w-[140px]">{brief.tarea}</span>
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export const ContentBriefPanel = ({ project, node }: { project: FactoryProject; node: StrategyNode }) => {
  const { addFabricaBriefs } = useFactoryStore();
  const briefs = briefsForNode(project, node);
  const pending = briefs.filter((b) => getBriefStatus(b) === 'pending');
  const inReview = briefs.filter((b) => getBriefStatus(b) === 'in_review');
  const completed = briefs.filter((b) => getBriefStatus(b) === 'completed');
  // La aprobación ya no es un nodo aparte: todo entregable pasa a revisión y se
  // aprueba/corrige desde el mismo diálogo de la tarea (ver BriefDialog).
  const hasApprovalStage = true;

  const [newTitle, setNewTitle] = useState('');
  const [openBrief, setOpenBrief] = useState<FabricaBriefItem | null>(null);
  const [activeTab, setActiveTab] = useState<'tareas' | 'adjuntos'>('tareas');

  const handleAdd = () => {
    const t = newTitle.trim();
    if (!t || !node.roleLabel) return;
    addFabricaBriefs(project.id, [{
      roleId: node.roleId ?? node.roleLabel,
      roleLabel: node.roleLabel,
      tarea: t,
      currentNodeId: node.id,
      workflowStatus: 'pending',
    }]);
    setNewTitle('');
  };

  return (
    <div className="space-y-3">
      {node.stageType === 'diseno' && (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'tareas' | 'adjuntos')}>
          <TabsList className="h-9">
            <TabsTrigger value="tareas" className="text-sm h-7">Tareas</TabsTrigger>
            <TabsTrigger value="adjuntos" className="text-sm h-7">Adjuntos</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {activeTab === 'adjuntos' && node.stageType === 'diseno' ? (
        <AttachmentsByDate briefs={briefs} />
      ) : !node.roleLabel ? (
        <p className="text-sm text-muted-foreground py-4">Asigna un rol a esta etapa para poder crear tareas.</p>
      ) : (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Nueva tarea</Label>
            <div className="flex gap-1.5">
              <Input
                placeholder="¿Qué hay que crear?"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                className="h-9 text-sm"
              />
              <Button size="sm" className="h-9" onClick={handleAdd} disabled={!newTitle.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <BriefGroup title="Pendientes" items={pending} onOpen={setOpenBrief} emptyLabel="Sin tareas pendientes." />
          <BriefGroup title="En revisión" items={inReview} onOpen={setOpenBrief} hideIfEmpty />
          <BriefGroup title="Completadas" items={completed} onOpen={setOpenBrief} hideIfEmpty />
        </>
      )}

      {openBrief && (
        <BriefDialog
          project={project}
          brief={openBrief}
          nodeId={node.id}
          hasApprovalStage={hasApprovalStage}
          urlOnly={node.stageType === 'landing' || node.stageType === 'landing_formulario' || node.stageType === 'formulario'}
          queue={inReview}
          onClose={() => setOpenBrief(null)}
          onAdvance={setOpenBrief}
        />
      )}
    </div>
  );
};

// ───────────────────────────────────────────────────────────────────────────
// Envíos — enviado / no-enviado deliverable per channel
// ───────────────────────────────────────────────────────────────────────────

const CanalStatusBadge = ({ brief }: { brief: FabricaBriefItem }) => {
  if (brief.deliverableEnviado === true)
    return <Badge variant="outline" className="border-0 bg-state-done-bg text-state-done text-[10px] px-1.5 h-4">Enviado</Badge>;
  if (brief.deliverableEnviado === false)
    return <Badge variant="outline" className="border-0 bg-state-blocked-bg text-state-blocked text-[10px] px-1.5 h-4">No enviado</Badge>;
  return <Badge variant="outline" className="border-0 bg-muted text-muted-foreground text-[10px] px-1.5 h-4">Pendiente</Badge>;
};

const DeliveryEditDialog = ({
  project, brief, onClose,
}: {
  project: FactoryProject;
  brief: FabricaBriefItem;
  onClose: () => void;
}) => {
  const { updateFabricaBrief, addFabricaBriefs } = useFactoryStore();
  const [enviado, setEnviado] = useState<boolean | null>(brief.deliverableEnviado ?? null);
  const [motivo, setMotivo] = useState(brief.deliverableMotivoNoEnvio ?? '');

  const handleSave = () => {
    const now = new Date().toISOString();
    const canalMatch = brief.tarea.match(/Configurar envío por (\w+)/);
    const canalTipo = canalMatch?.[1] ?? '';

    updateFabricaBrief(project.id, brief.id, {
      deliverableEnviado: enviado,
      deliverableMotivoNoEnvio: motivo,
      workflowStatus: enviado === true ? 'completed' : brief.workflowStatus,
      deliverableSubmittedAt: enviado === true ? (brief.deliverableSubmittedAt ?? now) : brief.deliverableSubmittedAt,
    });

    if (enviado === true && canalTipo) {
      const liveProject = useFactoryStore.getState().projects.find((p) => p.id === project.id);
      const alreadyHasMetrics = liveProject?.fabricaBriefs.some(
        (b) => b.tarea === `Recolectar métricas de ${canalTipo}`
      ) ?? false;
      if (!alreadyHasMetrics) {
        addFabricaBriefs(project.id, [{
          roleId: brief.roleId,
          roleLabel: brief.roleLabel,
          tarea: `Recolectar métricas de ${canalTipo}`,
          currentNodeId: brief.currentNodeId,
        }]);
      }
    }
    onClose();
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="sm:max-w-md"
        /* Un clic fuera no cierra la tarea: se pierde lo escrito en el editor y el comentario de
           corrección, que no se autoguardan. Hay que frenar los DOS eventos — Radix dispara el
           cierre por vías distintas según sea puntero o foco/táctil. Escape y la X siguen vivos. */
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{brief.tarea}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Estado del envío</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="envio-estado" checked={enviado === true}
                  onChange={() => setEnviado(true)} className="h-4 w-4 text-primary" />
                <span className="text-sm">Enviado</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="envio-estado" checked={enviado === false}
                  onChange={() => setEnviado(false)} className="h-4 w-4 text-primary" />
                <span className="text-sm">No enviado</span>
              </label>
            </div>
          </div>
          {enviado === false && (
            <div className="space-y-1.5">
              <Label className="text-xs">Motivo por el que no se envió</Label>
              <Textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                className="min-h-[80px] text-sm"
                placeholder="Describe por qué no se realizó el envío..."
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={enviado === null}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const DeliveryBriefPanel = ({ project, node }: { project: FactoryProject; node: StrategyNode }) => {
  const { addFabricaBriefs } = useFactoryStore();
  const briefs = briefsForNode(project, node);
  const [editingBrief, setEditingBrief] = useState<FabricaBriefItem | null>(null);
  const [newTitle, setNewTitle] = useState('');

  if (!node.roleLabel) {
    return <p className="text-sm text-muted-foreground py-4">Asigna un rol a esta etapa para ver los envíos.</p>;
  }

  const handleAdd = () => {
    const t = newTitle.trim();
    if (!t) return;
    addFabricaBriefs(project.id, [{
      roleId: node.roleId ?? node.roleLabel!,
      roleLabel: node.roleLabel!,
      tarea: t,
      currentNodeId: node.id,
      workflowStatus: 'pending',
    }]);
    setNewTitle('');
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Nueva tarea</Label>
        <div className="flex gap-1.5">
          <Input
            placeholder="¿Qué hay que crear?"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            className="h-9 text-sm"
          />
          <Button size="sm" className="h-9" onClick={handleAdd} disabled={!newTitle.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <BriefGroup
        title="Envíos"
        items={briefs}
        onOpen={setEditingBrief}
        badge={(b) => <CanalStatusBadge brief={b} />}
        emptyLabel="Sin canales configurados para este rol."
      />
      {editingBrief && (
        <DeliveryEditDialog project={project} brief={editingBrief} onClose={() => setEditingBrief(null)} />
      )}
    </div>
  );
};

// ───────────────────────────────────────────────────────────────────────────
// KAM / BTL / Relacionamiento / registro de Call Center — entregable simple:
// se hizo sí/no + fecha. Sin contenido, sin adjuntos, sin aprobación.
// ───────────────────────────────────────────────────────────────────────────

const DoneDateStatusBadge = ({ brief }: { brief: FabricaBriefItem }) => {
  if (brief.deliverableDone === true)
    return <Badge variant="outline" className="border-0 bg-state-done-bg text-state-done text-[10px] px-1.5 h-4">Hecho</Badge>;
  if (brief.deliverableDone === false)
    return <Badge variant="outline" className="border-0 bg-state-blocked-bg text-state-blocked text-[10px] px-1.5 h-4">No hecho</Badge>;
  return <Badge variant="outline" className="border-0 bg-muted text-muted-foreground text-[10px] px-1.5 h-4">Pendiente</Badge>;
};

const DoneDateEditDialog = ({
  project, brief, onClose,
}: {
  project: FactoryProject;
  brief: FabricaBriefItem;
  onClose: () => void;
}) => {
  const { updateFabricaBrief } = useFactoryStore();
  const [done, setDone] = useState<boolean | null>(brief.deliverableDone ?? null);
  const [fecha, setFecha] = useState(brief.deliverableDate ?? '');

  const handleSave = () => {
    const now = new Date().toISOString();
    updateFabricaBrief(project.id, brief.id, {
      deliverableDone: done,
      deliverableDate: fecha || null,
      workflowStatus: done === true ? 'completed' : brief.workflowStatus,
      deliverableSubmittedAt: done === true ? (brief.deliverableSubmittedAt ?? now) : brief.deliverableSubmittedAt,
    });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="sm:max-w-md"
        /* Un clic fuera no cierra la tarea: se pierde lo escrito en el editor y el comentario de
           corrección, que no se autoguardan. Hay que frenar los DOS eventos — Radix dispara el
           cierre por vías distintas según sea puntero o foco/táctil. Escape y la X siguen vivos. */
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{brief.tarea}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>¿Se realizó?</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="hecho-estado" checked={done === true}
                  onChange={() => setDone(true)} className="h-4 w-4 text-primary" />
                <span className="text-sm">Sí</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="hecho-estado" checked={done === false}
                  onChange={() => setDone(false)} className="h-4 w-4 text-primary" />
                <span className="text-sm">No</span>
              </label>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1"><CalendarIcon className="h-3 w-3" /> Fecha</Label>
            <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="text-sm" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={done === null}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const DoneDateBriefPanel = ({ project, node }: { project: FactoryProject; node: StrategyNode }) => {
  const { addFabricaBriefs } = useFactoryStore();
  const briefs = briefsForNode(project, node);
  const [editingBrief, setEditingBrief] = useState<FabricaBriefItem | null>(null);
  const [newTitle, setNewTitle] = useState('');

  if (!node.roleLabel) {
    return <p className="text-sm text-muted-foreground py-4">Asigna un rol a esta etapa para poder crear tareas.</p>;
  }

  const handleAdd = () => {
    const t = newTitle.trim();
    if (!t) return;
    addFabricaBriefs(project.id, [{
      roleId: node.roleId ?? node.roleLabel!,
      roleLabel: node.roleLabel!,
      tarea: t,
      currentNodeId: node.id,
      workflowStatus: 'pending',
    }]);
    setNewTitle('');
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Nueva tarea</Label>
        <div className="flex gap-1.5">
          <Input
            placeholder="¿Qué hay que crear?"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            className="h-9 text-sm"
          />
          <Button size="sm" className="h-9" onClick={handleAdd} disabled={!newTitle.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <BriefGroup
        title="Tareas"
        items={briefs}
        onOpen={setEditingBrief}
        badge={(b) => <DoneDateStatusBadge brief={b} />}
        emptyLabel="Sin tareas todavía."
      />
      {editingBrief && (
        <DoneDateEditDialog project={project} brief={editingBrief} onClose={() => setEditingBrief(null)} />
      )}
    </div>
  );
};

// ───────────────────────────────────────────────────────────────────────────
// Pauta en redes sociales (Trafficker) — cuadro de texto + adjuntos, y un
// entregable de "publicada sí/no" que, al marcarse, dispara la recolección de
// métricas de esa campaña (mismo patrón que Envíos → Recolectar métricas de X).
// ───────────────────────────────────────────────────────────────────────────

const PautaStatusBadge = ({ brief }: { brief: FabricaBriefItem }) => {
  if (brief.deliverablePublicada === true)
    return <Badge variant="outline" className="border-0 bg-state-done-bg text-state-done text-[10px] px-1.5 h-4">Publicada</Badge>;
  if (brief.deliverablePublicada === false)
    return <Badge variant="outline" className="border-0 bg-state-blocked-bg text-state-blocked text-[10px] px-1.5 h-4">No publicada</Badge>;
  return <Badge variant="outline" className="border-0 bg-muted text-muted-foreground text-[10px] px-1.5 h-4">Pendiente</Badge>;
};

const PautaEditDialog = ({
  project, brief, onClose,
}: {
  project: FactoryProject;
  brief: FabricaBriefItem;
  onClose: () => void;
}) => {
  const { updateFabricaBrief, addFabricaBriefs } = useFactoryStore();
  const [content, setContent] = useState(brief.deliverableContent ?? '');
  const [attachments, setAttachments] = useState<Attachment[]>(brief.deliverableAttachments ?? []);
  const [publicada, setPublicada] = useState<boolean | null>(brief.deliverablePublicada ?? null);

  const campana = brief.tarea.match(/Configurar campaña en (\w+)/)?.[1] ?? brief.tarea;

  const handleSave = () => {
    const now = new Date().toISOString();
    updateFabricaBrief(project.id, brief.id, {
      deliverableContent: content,
      deliverableAttachments: attachments,
      deliverablePublicada: publicada,
      workflowStatus: publicada === true ? 'completed' : brief.workflowStatus,
      deliverableSubmittedAt: publicada === true ? (brief.deliverableSubmittedAt ?? now) : brief.deliverableSubmittedAt,
    });

    if (publicada === true) {
      const liveProject = useFactoryStore.getState().projects.find((p) => p.id === project.id);
      const metricsTarea = `Recolectar métricas de ${campana}`;
      const alreadyHasMetrics = liveProject?.fabricaBriefs.some((b) => b.tarea === metricsTarea) ?? false;
      if (!alreadyHasMetrics) {
        addFabricaBriefs(project.id, [{
          roleId: brief.roleId,
          roleLabel: brief.roleLabel,
          tarea: metricsTarea,
          currentNodeId: brief.currentNodeId,
        }]);
      }
    }
    onClose();
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="sm:max-w-2xl max-h-[85vh] overflow-y-auto"
        /* Un clic fuera no cierra la tarea: se pierde lo escrito en el editor y el comentario de
           corrección, que no se autoguardan. Hay que frenar los DOS eventos — Radix dispara el
           cierre por vías distintas según sea puntero o foco/táctil. Escape y la X siguen vivos. */
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{brief.tarea}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Contenido de la campaña</Label>
            <RichTextEditor
              content={content}
              onChange={setContent}
              placeholder="Escribe aquí el copy/brief de la campaña..."
            />
          </div>
          <div className="space-y-2">
            <Label>Archivos adjuntos</Label>
            <FileUpload attachments={attachments} onChange={setAttachments} taskId={brief.id} />
          </div>
          <div className="space-y-2 border-t border-border/40 pt-3">
            <Label>¿Publicada?</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="publicada-estado" checked={publicada === true}
                  onChange={() => setPublicada(true)} className="h-4 w-4 text-primary" />
                <span className="text-sm">Sí</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="publicada-estado" checked={publicada === false}
                  onChange={() => setPublicada(false)} className="h-4 w-4 text-primary" />
                <span className="text-sm">No</span>
              </label>
            </div>
            {publicada === true && (
              <p className="text-xs text-muted-foreground italic">
                Al guardar se creará la tarea "Recolectar métricas de {campana}".
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const PautaBriefPanel = ({ project, node }: { project: FactoryProject; node: StrategyNode }) => {
  const { addFabricaBriefs } = useFactoryStore();
  const briefs = briefsForNode(project, node);
  const [editingBrief, setEditingBrief] = useState<FabricaBriefItem | null>(null);
  const [newTitle, setNewTitle] = useState('');

  if (!node.roleLabel) {
    return <p className="text-sm text-muted-foreground py-4">Asigna un rol a esta etapa para poder crear tareas.</p>;
  }

  const handleAdd = () => {
    const t = newTitle.trim();
    if (!t) return;
    addFabricaBriefs(project.id, [{
      roleId: node.roleId ?? node.roleLabel!,
      roleLabel: node.roleLabel!,
      tarea: t,
      currentNodeId: node.id,
      workflowStatus: 'pending',
    }]);
    setNewTitle('');
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Nueva tarea</Label>
        <div className="flex gap-1.5">
          <Input
            placeholder="¿Qué campaña hay que crear?"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            className="h-9 text-sm"
          />
          <Button size="sm" className="h-9" onClick={handleAdd} disabled={!newTitle.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <BriefGroup
        title="Campañas"
        items={briefs}
        onOpen={setEditingBrief}
        badge={(b) => <PautaStatusBadge brief={b} />}
        emptyLabel="Sin campañas configuradas."
      />
      {editingBrief && (
        <PautaEditDialog project={project} brief={editingBrief} onClose={() => setEditingBrief(null)} />
      )}
    </div>
  );
};
