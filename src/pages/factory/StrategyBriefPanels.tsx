import { useMemo, useState } from 'react';
import {
  FactoryProject,
  StrategyNode,
  FabricaBriefItem,
  useFactoryStore,
} from '@/store/factoryStore';
import { useAuthStore } from '@/store/authStore';
import {
  DeliverableSummary,
  BriefStatusBadge,
  getBriefStatus,
  isCanalBrief,
} from '@/components/factory/DeliverableSummary';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, MessageSquare, FileText, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import RichTextEditor from '@/components/ui/rich-text-editor';
import FileUpload, { Attachment } from '@/components/ui/file-upload';

const genId = () => `c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const authorName = () => useAuthStore.getState().currentUser?.fullName ?? 'Usuario';

// ───────────────────────────────────────────────────────────────────────────
// Graph helpers — resolve the approval node downstream of a content node,
// and the content node upstream of an approval node, via `dependsOn`.
// ───────────────────────────────────────────────────────────────────────────

export const findApprovalNodeFor = (nodes: StrategyNode[], contentNodeId: string) =>
  nodes.find((n) => n.stageType === 'aprobacion' && n.dependsOn.includes(contentNodeId));

export const findContentNodeFor = (nodes: StrategyNode[], approvalNode: StrategyNode) =>
  nodes.find((n) => n.id === approvalNode.dependsOn[0]);

/** Entregables que viven en un nodo: por currentNodeId (fijo desde su creación), o por roleLabel
 *  si aún no lo tienen (datos legados). El entregable nunca "se mueve" de nodo — solo cambia su
 *  `workflowStatus`, así que aprobar/corregir siempre se hace desde la misma tarea. */
export const briefsForNode = (project: FactoryProject, node: StrategyNode): FabricaBriefItem[] =>
  (project.fabricaBriefs ?? []).filter((b) =>
    b.currentNodeId ? b.currentNodeId === node.id : b.roleLabel === node.roleLabel
  );

const hasUnresolvedCorrection = (brief: FabricaBriefItem) =>
  getBriefStatus(brief) === 'pending' && (brief.comments ?? []).some((c) => c.isAdjustmentRequest);

// ───────────────────────────────────────────────────────────────────────────
// Shared list row/group
// ───────────────────────────────────────────────────────────────────────────

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
    <span className="text-sm flex-1 truncate">{brief.tarea}</span>
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
  project, brief, hasApprovalStage, queue, onClose, onAdvance,
}: {
  project: FactoryProject;
  brief: FabricaBriefItem;
  /** Si existe una etapa de Aprobación aguas abajo, "enviar" pasa a revisión en vez de completar directo. */
  hasApprovalStage: boolean;
  /** Hermanos en la misma lista, para avanzar automáticamente al siguiente tras aprobar/corregir. */
  queue?: FabricaBriefItem[];
  onClose: () => void;
  onAdvance?: (next: FabricaBriefItem) => void;
}) => {
  const { updateFabricaBrief } = useFactoryStore();
  const status = getBriefStatus(brief);
  const isEditable = status === 'pending';
  const isReviewable = status === 'in_review';

  const [content, setContent] = useState(brief.deliverableContent ?? '');
  const [attachments, setAttachments] = useState<Attachment[]>(brief.deliverableAttachments ?? []);
  const [newComment, setNewComment] = useState('');
  const [correctionComment, setCorrectionComment] = useState('');

  const priorComments = brief.comments ?? [];
  const lastCorrection = [...priorComments].reverse().find((c) => c.isAdjustmentRequest);

  const advanceOrClose = () => {
    const next = queue?.find((b) => b.id !== brief.id) ?? null;
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
    });
    onClose();
  };

  const handleApprove = () => {
    updateFabricaBrief(project.id, brief.id, { workflowStatus: 'completed' });
    advanceOrClose();
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
    });
    advanceOrClose();
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <span>{brief.tarea}</span>
            <BriefStatusBadge brief={brief} />
          </DialogTitle>
          <p className="text-xs text-muted-foreground">Rol: {brief.roleLabel}</p>
        </DialogHeader>

        {isEditable ? (
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

            <div className="space-y-2 border-t border-border/40 pt-3">
              <Label className="text-xs flex items-center gap-1"><MessageSquare className="h-3 w-3" /> Comentarios</Label>
              {priorComments.length > 0 && (
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {priorComments.map((c) => (
                    <div
                      key={c.id}
                      className={cn('rounded-md px-2.5 py-1.5 text-xs', c.isAdjustmentRequest ? 'bg-state-blocked-bg/50' : 'bg-muted/40')}
                    >
                      <p className="text-[10px] text-muted-foreground mb-0.5">
                        {c.author}{c.isAdjustmentRequest ? ' · corrección' : ''}
                      </p>
                      <p className="whitespace-pre-wrap">{c.content}</p>
                    </div>
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

        {isReviewable && (
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

        <DialogFooter className="flex gap-2">
          {isEditable && (
            <>
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button onClick={handleSubmit} disabled={!content && attachments.length === 0}>
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
  const nodes = project.strategyNodes ?? [];
  const briefs = briefsForNode(project, node);
  const pending = briefs.filter((b) => getBriefStatus(b) === 'pending');
  const inReview = briefs.filter((b) => getBriefStatus(b) === 'in_review');
  const completed = briefs.filter((b) => getBriefStatus(b) === 'completed');
  const hasApprovalStage = !!findApprovalNodeFor(nodes, node.id);

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
          hasApprovalStage={hasApprovalStage}
          queue={inReview}
          onClose={() => setOpenBrief(null)}
          onAdvance={setOpenBrief}
        />
      )}
    </div>
  );
};

// ───────────────────────────────────────────────────────────────────────────
// Aprobación — cola de revisión que agrega los entregables "en revisión" del
// nodo de contenido del que depende (los entregables nunca se mueven aquí).
// ───────────────────────────────────────────────────────────────────────────

export const ApprovalQueuePanel = ({ project, node }: { project: FactoryProject; node: StrategyNode }) => {
  const nodes = project.strategyNodes ?? [];
  const contentNode = findContentNodeFor(nodes, node);
  const briefs = contentNode ? briefsForNode(project, contentNode) : [];
  const queue = briefs.filter((b) => getBriefStatus(b) === 'in_review');
  const done = briefs.filter((b) => getBriefStatus(b) === 'completed');

  const [openBrief, setOpenBrief] = useState<FabricaBriefItem | null>(null);

  return (
    <div className="space-y-3">
      <BriefGroup title="Pendientes de revisión" items={queue} onOpen={setOpenBrief} emptyLabel="Sin entregables por revisar." />
      <BriefGroup title="Aprobadas" items={done} onOpen={setOpenBrief} hideIfEmpty />

      {openBrief && (
        <BriefDialog
          project={project}
          brief={openBrief}
          hasApprovalStage
          queue={queue}
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
      <DialogContent className="sm:max-w-md">
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
  const briefs = briefsForNode(project, node).filter((b) => isCanalBrief(b.tarea));
  const [editingBrief, setEditingBrief] = useState<FabricaBriefItem | null>(null);

  if (!node.roleLabel) {
    return <p className="text-sm text-muted-foreground py-4">Asigna un rol a esta etapa para ver los envíos.</p>;
  }

  return (
    <div className="space-y-3">
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
