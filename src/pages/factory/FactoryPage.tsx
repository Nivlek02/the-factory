import { useState, useRef, useEffect } from 'react';
import Layout from '@/components/layout/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus,
  FolderKanban,
  Users,
  CheckSquare,
  Sparkles,
  CircleDot,
  Flag,
  Calendar,
  MoreVertical,
  Trash2,
  UserPlus,
  ChevronRight,
  X,
  Workflow,
  BarChart3,
  RefreshCw,
  Pencil,
} from 'lucide-react';
import { useFactoryStore, FactoryProject, ProjectTask, ProjectRoleGroup, CanalRow, FabricaBriefItem } from '@/store/factoryStore';
import { useRolesStore } from '@/store/rolesStore';
import CreateProjectWizard from './CreateProjectWizard';
import { WorkflowTab, MetricsDashboardTab, LoopTab } from './MapTab';
import { DeliverableSummary, BriefStatusBadge, isMetricsBrief, isUrlBrief } from '@/components/factory/DeliverableSummary';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATE_META: Record<string, { label: string; cls: string }> = {
  planning:    { label: 'En planeación', cls: 'bg-state-planning-bg text-state-planning' },
  in_progress: { label: 'En proceso',  cls: 'bg-state-progress-bg text-state-progress' },
  review:      { label: 'En revisión', cls: 'bg-state-review-bg text-state-review' },
  blocked:     { label: 'Bloqueado',   cls: 'bg-state-blocked-bg text-state-blocked' },
  done:        { label: 'Completado',  cls: 'bg-state-done-bg text-state-done' },
};

const TASK_STATUS_META: Record<string, { label: string; cls: string }> = {
  pending:     { label: 'Pendiente',   cls: 'bg-muted text-muted-foreground' },
  in_progress: { label: 'En proceso',  cls: 'bg-state-progress-bg text-state-progress' },
  in_review:   { label: 'En revisión', cls: 'bg-state-review-bg text-state-review' },
  completed:   { label: 'Completada',  cls: 'bg-state-done-bg text-state-done' },
};

const TASK_STATUSES = [
  { value: 'pending',     label: 'Pendiente' },
  { value: 'in_progress', label: 'En proceso' },
  { value: 'in_review',   label: 'En revisión' },
  { value: 'completed',   label: 'Completada' },
];

const PRIORITY_META: Record<string, { cls: string; border: string; label: string }> = {
  P0: { cls: 'text-priority-p0', border: 'border-priority-p0', label: 'Crítica' },
  P1: { cls: 'text-priority-p1', border: 'border-priority-p1', label: 'Alta' },
  P2: { cls: 'text-priority-p2', border: 'border-priority-p2', label: 'Normal' },
};

const ROLE_COLORS = [
  'hsl(var(--team-design))',
  'hsl(var(--team-copy))',
  'hsl(var(--team-social))',
  'hsl(var(--team-seo))',
  'hsl(var(--team-production))',
  'hsl(var(--factory))',
];

function roleColor(index: number) {
  return ROLE_COLORS[index % ROLE_COLORS.length];
}

function projectProgress(project: FactoryProject): number {
  const briefs = project.fabricaBriefs ?? [];
  if (!briefs.length) return 0;
  return Math.round((briefs.filter((b) => b.deliverableSubmittedAt || b.checked).length / briefs.length) * 100);
}

// ─── Empty States ─────────────────────────────────────────────────────────────

const EmptyFactory = ({ onNew }: { onNew: () => void }) => (
  <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
    <div className="w-16 h-16 rounded-2xl bg-gradient-factory flex items-center justify-center shadow-glow mb-5 text-factory-foreground">
      <FolderKanban className="h-8 w-8" />
    </div>
    <h2 className="font-display text-xl font-semibold mb-2">Crea tu primer proyecto</h2>
    <p className="text-sm text-muted-foreground max-w-xs mb-6">
      Organiza equipos, asigna roles, define requerimientos y gestiona tareas en un solo espacio colaborativo.
    </p>
    <Button onClick={onNew} className="bg-gradient-factory text-factory-foreground shadow-glow">
      <Plus className="h-4 w-4" />
      Nuevo proyecto
    </Button>
  </div>
);

const NoSelection = ({ onNew }: { onNew: () => void }) => (
  <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
    <div className="w-12 h-12 rounded-xl bg-factory-soft flex items-center justify-center mb-4">
      <ChevronRight className="h-6 w-6 text-factory" />
    </div>
    <h3 className="font-semibold mb-1">Selecciona un proyecto</h3>
    <p className="text-sm text-muted-foreground mb-4">O crea uno nuevo para empezar.</p>
    <Button variant="outline" size="sm" onClick={onNew}>
      <Plus className="h-4 w-4" />
      Nuevo proyecto
    </Button>
  </div>
);

// ─── Task Card ────────────────────────────────────────────────────────────────

const TaskCard = ({
  task,
  allMembers,
  onStatusChange,
  onDelete,
}: {
  task: ProjectTask;
  allMembers: Array<{ id: string; name: string; roleLabel: string }>;
  onStatusChange: (status: string) => void;
  onDelete: () => void;
}) => {
  return (
    <div className="group bg-card rounded-lg border border-border/60 p-3 hover:border-factory/30 hover:shadow-sm transition-all">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="text-xs font-medium leading-snug flex-1">{task.title}</p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 shrink-0">
              <MoreVertical className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {TASK_STATUSES.map((s) => (
              <DropdownMenuItem key={s.value} onClick={() => onStatusChange(s.value)}>
                {s.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem className="text-destructive" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5 mr-2" />
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {task.description && (
        <p className="text-[10px] text-muted-foreground mb-2 line-clamp-2">{task.description}</p>
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {task.assignedMemberName && (
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded-full bg-factory/30 flex items-center justify-center text-[8px] font-bold text-factory">
                {task.assignedMemberName.charAt(0).toUpperCase()}
              </div>
              <span className="text-[10px] text-muted-foreground">{task.assignedMemberName}</span>
              {task.assignedRoleLabel && (
                <span className="text-[9px] text-muted-foreground">({task.assignedRoleLabel})</span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          {task.priority === 'high' && (
            <Badge variant="outline" className="text-[9px] px-1 h-3.5 border-priority-p0 text-priority-p0">Alta</Badge>
          )}
          {task.priority === 'medium' && (
            <Badge variant="outline" className="text-[9px] px-1 h-3.5 border-priority-p1 text-priority-p1">Media</Badge>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const OverviewTab = ({ project }: { project: FactoryProject }) => {
  const briefs = project.fabricaBriefs ?? [];
  const progress = projectProgress(project);
  const totalMembers = project.roleGroups.reduce((s, g) => s + g.members.length, 0);
  const doneTasks = briefs.filter((b) => b.deliverableSubmittedAt || b.checked).length;
  const inProgress = briefs.filter((b) => !b.deliverableSubmittedAt && !b.checked).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Progreso</p>
            <div className="flex items-center gap-2 mt-2">
              <Progress value={progress} className="h-2 flex-1" />
              <span className="text-sm font-semibold">{progress}%</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">{doneTasks} de {briefs.length} tareas</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">En proceso</p>
            <p className="font-display text-2xl font-semibold text-state-progress mt-1">{inProgress}</p>
            <p className="text-[10px] text-muted-foreground">tareas pendientes</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Equipo</p>
            <p className="font-display text-2xl font-semibold mt-1">{totalMembers}</p>
            <p className="text-[10px] text-muted-foreground">{project.roleGroups.length} rol{project.roleGroups.length !== 1 ? 'es' : ''}</p>
          </CardContent>
        </Card>
      </div>

      {project.description && (
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Descripción</p>
            <div className="text-sm text-foreground/80 leading-relaxed prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: project.description }} />
          </CardContent>
        </Card>
      )}

      {project.roleGroups.length > 0 && (
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">Resumen del equipo</p>
            <div className="space-y-2">
              {project.roleGroups.map((g, i) => (
                <div key={g.roleId} className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: roleColor(i) }} />
                  <span className="text-xs font-medium w-28 shrink-0">{g.roleLabel}</span>
                  <span className="text-xs text-muted-foreground flex-1">
                    {g.members.map(m => m.name).join(', ') || 'Sin personas'}
                  </span>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {g.requirements.length} req.
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-sm">
        <CardContent className="p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">Detalles</p>
          <div className="grid grid-cols-2 gap-3 text-xs">
            {project.client && (
              <div>
                <span className="text-muted-foreground">Cliente</span>
                <p className="font-medium mt-0.5">{project.client}</p>
              </div>
            )}
            {project.dueDate && (
              <div>
                <span className="text-muted-foreground">Fecha límite</span>
                <p className="font-medium mt-0.5 flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(project.dueDate).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">Creado</span>
              <p className="font-medium mt-0.5">
                {new Date(project.createdAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
            {project.segmentLink && (
              <div className="col-span-2">
                <span className="text-muted-foreground">Link del segmento</span>
                <p className="font-medium mt-0.5 truncate">
                  <a href={project.segmentLink} target="_blank" rel="noopener noreferrer" className="text-factory hover:underline">
                    {project.segmentLink}
                  </a>
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ─── Form summary — Audiencia y narrativa ─── */}
      {(project.audienciaNarrativa?.segmentos?.length > 0 || project.audienciaNarrativa?.metaInscripciones || project.audienciaNarrativa?.dolor || project.audienciaNarrativa?.promesa || project.audienciaNarrativa?.bigIdea) && (
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">Audiencia y Narrativa</p>
            <div className="space-y-3 text-xs">
              {project.audienciaNarrativa?.segmentos?.length > 0 && (
                <div>
                  <span className="text-muted-foreground">Segmentos</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {project.audienciaNarrativa.segmentos.map((seg) => (
                      <span key={seg} className="px-2 py-0.5 rounded-full bg-muted text-[10px] font-medium">
                        {({
                          afiliado: 'Afiliado',
                          renovado: 'Renovados',
                          matriculado: 'Matriculado',
                          potencial: 'Potencial',
                          no_renovado: 'No renovado',
                          vip: 'VIP / Alta dirección',
                          cluster_energia: 'Energía',
                          cluster_espacios: 'Espacios Habitables',
                          cluster_salud: 'Salud',
                          cluster_turismo: 'Turismo de Eventos y Negocios',
                          cluster_alimentos: 'Alimentos y Agroindustrias',
                          mercado_medio: 'Mercado medio',
                        } as Record<string, string>)[seg] ?? seg}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {project.audienciaNarrativa?.metaInscripciones && (
                <div>
                  <span className="text-muted-foreground">Meta de inscripciones</span>
                  <p className="font-medium mt-0.5">{project.audienciaNarrativa.metaInscripciones}</p>
                </div>
              )}
              {project.audienciaNarrativa?.dolor && (
                <div>
                  <span className="text-muted-foreground">Dolor que resuelve</span>
                  <p className="font-medium mt-0.5">{project.audienciaNarrativa.dolor}</p>
                </div>
              )}
              {project.audienciaNarrativa?.promesa && (
                <div>
                  <span className="text-muted-foreground">Promesa</span>
                  <p className="font-medium mt-0.5">{project.audienciaNarrativa.promesa}</p>
                </div>
              )}
              {project.audienciaNarrativa?.bigIdea && (
                <div>
                  <span className="text-muted-foreground">Big Idea</span>
                  <p className="font-medium mt-0.5">{project.audienciaNarrativa.bigIdea}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Form summary — Plan de canales ─── */}
      {project.canales && project.canales.length > 0 && (
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">Plan de canales</p>
            <div className="space-y-1.5">
              {project.canales.map((c) => (
                <div key={c.id} className="flex items-center gap-2 text-xs py-1 border-b border-border/40 last:border-0">
                  <span className="font-medium w-20 shrink-0">{c.canal}</span>
                  {c.dia && <span className="text-muted-foreground text-[10px]">{c.dia}</span>}
                  {c.copy && <span className="text-muted-foreground truncate flex-1">— {c.copy}</span>}
                  {c.segmento && (
                    <span className="px-1.5 py-0.5 rounded bg-muted text-[10px] shrink-0">
                      {c.segmento}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Form summary — Loops ─── */}
      {project.loops && project.loops.length > 0 && (
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">Loops de comportamiento</p>
            <div className="space-y-1.5">
              {project.loops.map((l) => (
                <div key={l.id} className="flex items-center gap-2 text-xs py-1 border-b border-border/40 last:border-0">
                  <span className="font-medium">{l.disparador || '—'}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="text-muted-foreground flex-1">{l.reaccion || '—'}</span>
                  {l.responsable && <span className="text-[10px] text-muted-foreground shrink-0">({l.responsable})</span>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// ─── Equipo + Tareas (merged) ──────────────────────────────────────────────

const TeamTasksTab = ({
  project,
}: {
  project: FactoryProject;
}) => {
  const { addRole } = useRolesStore();
  const { addRoleGroup, addFabricaBriefs, updateFabricaBrief } = useFactoryStore();
  const [addRoleOpen, setAddRoleOpen] = useState(false);
  const [deliverableBrief, setDeliverableBrief] = useState<FabricaBriefItem | null>(null);
  const [deliverableContent, setDeliverableContent] = useState('');
  const [deliverableMetricas, setDeliverableMetricas] = useState<Record<string, string>>({});

  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleTareas, setNewRoleTareas] = useState('');

  const handleAddRole = () => {
    const name = newRoleName.trim();
    if (!name) return;
    const tareas = newRoleTareas
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    const roleId = `role-${Date.now()}`;
    addRole(name, tareas);
    addRoleGroup(project.id, roleId, name);
    if (tareas.length > 0) {
      addFabricaBriefs(
        project.id,
        tareas.map((t) => ({ roleId, roleLabel: name, tarea: t }))
      );
    }
    setNewRoleName('');
    setNewRoleTareas('');
    setAddRoleOpen(false);
  };

  const briefs = project.fabricaBriefs ?? [];
  const grouped = briefs.reduce<Record<string, typeof briefs>>((acc, b) => {
    if (!acc[b.roleLabel]) acc[b.roleLabel] = [];
    acc[b.roleLabel].push(b);
    return acc;
  }, {});
  const totalChecked = briefs.filter((b) => b.checked).length;
  const isEmpty = briefs.length === 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-base font-semibold">Hoja de fábrica</h3>
          {!isEmpty && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {briefs.length} {briefs.length === 1 ? 'tarea' : 'tareas'}
            </p>
          )}
        </div>
        <Button size="sm" onClick={() => setAddRoleOpen(true)}>
          <UserPlus className="h-4 w-4" />
          Agregar rol al equipo
        </Button>
      </div>

      {/* Empty state */}
      {isEmpty ? (
        <div className="rounded-xl border border-dashed border-border/60 p-10 flex flex-col items-center text-center">
          <CheckSquare className="h-8 w-8 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium text-muted-foreground mb-1">
            Sin tareas pendientes
          </p>
          <p className="text-xs text-muted-foreground/60 max-w-xs">
            Agrega un rol con responsabilidades para empezar a llenar la hoja de fábrica del proyecto.
          </p>
        </div>
      ) : (
        /* Hoja de fábrica grouped by role */
        <div className="space-y-3">
          {Object.entries(grouped).map(([roleLabel, items]) => (
            <div
              key={roleLabel}
              className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden"
            >
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/40 bg-muted/20">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                  {roleLabel}
                </h4>
                <span className="text-[10px] text-muted-foreground">
                  {items.filter((b) => b.deliverableSubmittedAt || b.checked).length}/{items.length}
                </span>
              </div>
              <div className="p-2">
                {items.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center gap-3 py-1.5 px-2 rounded-md hover:bg-muted/40 transition-colors group"
                  >
                      <button
                          onClick={() => {
                            setDeliverableBrief(b);
                            setDeliverableContent(b.deliverableContent ?? '');
                            setDeliverableMetricas(b.deliverableMetricas ?? {});
                          }}
                          className="text-sm flex-1 text-left text-foreground/80 hover:text-factory transition-colors"
                    >
                      {b.tarea}
                    </button>
                    <BriefStatusBadge brief={b} className="shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add role dialog */}
      <Dialog open={addRoleOpen} onOpenChange={setAddRoleOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Agregar rol al equipo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nombre del rol</Label>
              <Input
                placeholder="Ej: Diseñador UX"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Responsabilidades</Label>
              <p className="text-[10px] text-muted-foreground">
                Una por línea. Estas serán las tareas del rol.
              </p>
              <Textarea
                placeholder={`Ej: Diseñar piezas gráficas\nCrear prototipos\nRevisar briefs creativos`}
                value={newRoleTareas}
                onChange={(e) => setNewRoleTareas(e.target.value)}
                className="min-h-[120px] text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddRoleOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddRole} disabled={!newRoleName.trim()}>Agregar rol</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deliverable summary dialog — solo lectura; la edición vive en "Construir estrategia" */}
      <Dialog open={!!deliverableBrief} onOpenChange={(v) => { if (!v) setDeliverableBrief(null); }}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{deliverableBrief?.tarea}</DialogTitle>
            {deliverableBrief && (
              <p className="text-xs text-muted-foreground">
                Rol: {deliverableBrief.roleLabel}
              </p>
            )}
          </DialogHeader>

          {deliverableBrief && (() => {
            // Métricas y URL (Landing/Formulario) no tienen hoy un lugar en "Construir estrategia",
            // así que se siguen editando aquí. Copy/Diseño y el estado de envío se editan allá.
            if (isMetricsBrief(deliverableBrief.tarea)) {
              const canalMatch = deliverableBrief.tarea.match(/Recolectar métricas de (\w+)/);
              const canalTipo = canalMatch?.[1] ?? '';
              const fields = canalTipo === 'Correo'
                ? [
                    { key: 'baseTotal', label: 'Base total' },
                    { key: 'enviados', label: 'Enviados' },
                    { key: 'apertura', label: 'Apertura' },
                    { key: 'clics', label: 'Clics' },
                  ]
                : [
                    { key: 'baseTotal', label: 'Base total' },
                    { key: 'clics', label: 'Clics' },
                  ];
              return (
                <div className="space-y-4 py-2">
                  <div className="space-y-3 border rounded-lg p-4 bg-muted/20">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Métricas del envío</p>
                    <div className="grid grid-cols-2 gap-3">
                      {fields.map(({ key, label }) => (
                        <div key={key} className="space-y-1">
                          <Label className="text-xs">{label}</Label>
                          <Input type="number" min="0" placeholder="0" className="h-8 text-xs"
                            value={deliverableMetricas[key] ?? ''}
                            onChange={(e) => setDeliverableMetricas((prev) => ({ ...prev, [key]: e.target.value }))} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            }

            if (isUrlBrief(deliverableBrief.tarea)) {
              return (
                <div className="space-y-4 py-2">
                  {deliverableBrief.briefNotes && (
                    <div className="rounded-lg border border-border/60 bg-muted/30 px-4 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Campos adicionales</p>
                      <p className="text-sm text-foreground/80 whitespace-pre-wrap">{deliverableBrief.briefNotes}</p>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label>URL del entregable</Label>
                    <Input
                      type="url"
                      placeholder="https://…"
                      value={deliverableContent}
                      onChange={(e) => setDeliverableContent(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                </div>
              );
            }

            return <DeliverableSummary brief={deliverableBrief} />;
          })()}

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setDeliverableBrief(null)}>
              {deliverableBrief && (isMetricsBrief(deliverableBrief.tarea) || isUrlBrief(deliverableBrief.tarea)) ? 'Cancelar' : 'Cerrar'}
            </Button>
            {deliverableBrief && (isMetricsBrief(deliverableBrief.tarea) || isUrlBrief(deliverableBrief.tarea)) && (
              <Button
                onClick={() => {
                  const now = new Date().toISOString();
                  if (isMetricsBrief(deliverableBrief.tarea)) {
                    updateFabricaBrief(project.id, deliverableBrief.id, {
                      deliverableMetricas,
                      deliverableSubmittedAt: deliverableBrief.deliverableSubmittedAt ?? now,
                    });
                  } else {
                    updateFabricaBrief(project.id, deliverableBrief.id, {
                      deliverableContent,
                      deliverableSubmittedAt: deliverableBrief.deliverableSubmittedAt ?? now,
                    });
                  }
                  setDeliverableBrief(null);
                }}
                disabled={isUrlBrief(deliverableBrief.tarea) && !deliverableContent.trim()}
              >
                {deliverableBrief.deliverableSubmittedAt ? 'Actualizar' : 'Guardar'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ─── Project Workspace ────────────────────────────────────────────────────────

const TABS = [
  { key: 'flujo',    label: 'Flujo de trabajo',      icon: <Workflow className="h-3.5 w-3.5" /> },
  { key: 'metrics',  label: 'Dashboard de métricas',  icon: <BarChart3 className="h-3.5 w-3.5" /> },
  { key: 'loop',     label: 'Loop',                   icon: <RefreshCw className="h-3.5 w-3.5" /> },
  { key: 'overview', label: 'Overview',                icon: <Flag className="h-3.5 w-3.5" /> },
  { key: 'equipo',   label: 'Equipo',                  icon: <Users className="h-3.5 w-3.5" /> },
] as const;

const ProjectWorkspace = ({ project }: { project: FactoryProject }) => {
  const [activeTab, setActiveTab] = useState<'flujo' | 'metrics' | 'loop' | 'overview' | 'equipo'>('flujo');
  const { addTask, updateTask, deleteTask, deleteProject, setActiveProject } = useFactoryStore();

  const [editWizardOpen, setEditWizardOpen] = useState(false);

  const allMembers = project.roleGroups.flatMap((g) =>
    g.members.map((m) => ({ id: m.id, name: m.name, roleLabel: g.roleLabel }))
  );

  const stateMeta = STATE_META[project.state];
  const priorityMeta = PRIORITY_META[project.priority];
  const progress = projectProgress(project);

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      {/* Project header */}
      <div className="border-b border-border/60 bg-gradient-surface px-6 py-4 shrink-0">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="min-w-0">
            <h2 className="font-display text-xl font-semibold truncate">{project.name}</h2>
            {project.client && (
              <p className="text-xs text-muted-foreground mt-0.5">{project.client}</p>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditWizardOpen(true)}>
                <Pencil className="h-3.5 w-3.5 mr-2" />
                Editar proyecto
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onClick={() => { deleteProject(project.id); setActiveProject(null); }}>
                <Trash2 className="h-3.5 w-3.5 mr-2" />
                Eliminar proyecto
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${stateMeta.cls}`}>
            <CircleDot className="h-3 w-3" />
            {stateMeta.label}
          </span>
          <Badge variant="outline" className={`text-xs font-semibold ${priorityMeta.border} ${priorityMeta.cls}`}>
            <Flag className="h-3 w-3 mr-1" />
            {priorityMeta.label}
          </Badge>
          {project.dueDate && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {new Date(project.dueDate).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
            </span>
          )}
          <div className="flex items-center gap-1.5 ml-auto">
            <Progress value={progress} className="h-1.5 w-20" />
            <span className="text-[11px] font-semibold">{progress}%</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0.5">
          {TABS.map((tab) => {
            const count =
              tab.key === 'equipo' ? project.roleGroups.length : null;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  activeTab === tab.key
                    ? 'bg-factory-soft text-factory'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                }`}
              >
                {tab.icon}
                {tab.label}
                {count !== null && count > 0 && (
                  <span className="text-[10px] bg-current/10 rounded-full px-1.5">{count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'flujo' && <WorkflowTab project={project} />}
        {activeTab === 'metrics' && <MetricsDashboardTab project={project} />}
        {activeTab === 'loop' && <LoopTab project={project} />}
        {activeTab === 'overview' && <OverviewTab project={project} />}
        {activeTab === 'equipo' && (
          <TeamTasksTab project={project} />
        )}
      </div>

      <CreateProjectWizard
        open={editWizardOpen}
        onOpenChange={setEditWizardOpen}
        onCreated={() => {}}
        editProject={project}
      />
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const FactoryPage = () => {
  const { projects, activeProjectId, setActiveProject, hydrate, isLoaded } = useFactoryStore();
  const activeProject = projects.find((p) => p.id === activeProjectId) ?? null;

  useEffect(() => {
    if (!isLoaded) hydrate();
  }, [isLoaded, hydrate]);

  const [createOpen, setCreateOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [stateFilter, setStateFilter] = useState<'all' | FactoryProject['state']>('all');

  const filteredProjects = projects.filter((p) => {
    const matchesQ = query.trim()
      ? `${p.name} ${p.client}`.toLowerCase().includes(query.trim().toLowerCase())
      : true;
    const matchesS = stateFilter === 'all' ? true : p.state === stateFilter;
    return matchesQ && matchesS;
  });

  return (
    <Layout>
      <div className="animate-fade-in flex flex-col h-full bg-background">
        {/* Page header — clean, minimal */}
        <header className="border-b border-border/60 bg-card shrink-0">
          <div className="px-6 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-md bg-factory-soft flex items-center justify-center">
                <Sparkles className="h-3.5 w-3.5 text-factory" />
              </div>
              <div className="leading-tight">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">La Fabrica</p>
                <h1 className="font-display text-sm font-semibold text-foreground">Espacio de trabajo</h1>
              </div>
            </div>
            <Button size="sm" onClick={() => setCreateOpen(true)} className="bg-factory text-factory-foreground hover:bg-factory/90">
              <Plus className="h-4 w-4" />
              Nuevo proyecto
            </Button>
          </div>
        </header>

        {/* Two-panel layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: project list */}
          <div className="w-72 shrink-0 border-r border-border/60 flex flex-col bg-card/40">
            <div className="px-3 py-3 border-b border-border/60 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <FolderKanban className="h-3 w-3" />
                  Proyectos
                </p>
                <span className="text-[10px] text-muted-foreground">{filteredProjects.length}/{projects.length}</span>
              </div>
              <Input
                placeholder="Buscar proyecto…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-7 text-xs"
              />
              <Select value={stateFilter} onValueChange={(v) => setStateFilter(v as any)}>
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  {Object.entries(STATE_META).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 overflow-y-auto py-2 px-2 space-y-3">
              {filteredProjects.length === 0 && (
                <div className="px-3 py-6 text-center">
                  <p className="text-xs text-muted-foreground">
                    {projects.length === 0 ? 'Sin proyectos aún.' : 'Sin coincidencias.'}
                  </p>
                </div>
              )}
              {[
                { label: 'En planeación', states: ['planning'] },
                { label: 'En proceso', states: ['in_progress', 'review', 'blocked'] },
                { label: 'Completados', states: ['done'] },
              ].map((group) => {
                const groupProjects = filteredProjects.filter((p) => group.states.includes(p.state));
                if (groupProjects.length === 0) return null;
                return (
                  <div key={group.label}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 py-1">
                      {group.label}
                    </p>
                    <div className="space-y-0.5">
                      {groupProjects.map((p) => {
                        const isActive = p.id === activeProjectId;
                        const progress = projectProgress(p);
                        const pending = p.tasks.filter((t) => t.status !== 'completed').length;
                        const stateDot =
                          p.state === 'done' ? 'state-done' :
                          p.state === 'in_progress' ? 'state-progress' :
                          p.state === 'review' ? 'state-review' :
                          p.state === 'blocked' ? 'state-blocked' : 'state-planning';
                        return (
                          <button
                            key={p.id}
                            onClick={() => setActiveProject(p.id)}
                            className={`w-full text-left px-2.5 py-2 rounded-md transition-colors border ${
                              isActive
                                ? 'bg-card border-factory/30 shadow-sm'
                                : 'border-transparent hover:bg-muted/50'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: `hsl(var(--${stateDot}))` }} />
                              <p className="text-xs font-medium truncate flex-1">{p.name}</p>
                              <span className={`text-[9px] font-semibold ${PRIORITY_META[p.priority].cls}`}>{PRIORITY_META[p.priority].label}</span>
                            </div>
                            {p.client && (
                              <p className="text-[10px] text-muted-foreground truncate mb-1.5 pl-3.5">{p.client}</p>
                            )}
                            <div className="flex items-center gap-2 pl-3.5">
                              <div className="flex-1 h-0.5 rounded-full bg-border/60 overflow-hidden">
                                <div className="h-full bg-factory rounded-full" style={{ width: `${progress}%` }} />
                              </div>
                              <span className="text-[10px] text-muted-foreground tabular-nums">{progress}%</span>
                              {pending > 0 && (
                                <span className="text-[10px] text-muted-foreground tabular-nums">· {pending}p</span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            {projects.length > 0 && (
              <div className="p-2 border-t border-border/60">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-xs text-muted-foreground hover:text-foreground h-7"
                  onClick={() => setCreateOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Nuevo proyecto
                </Button>
              </div>
            )}
          </div>

          {/* Right: workspace */}
          {projects.length === 0 ? (
            <EmptyFactory onNew={() => setCreateOpen(true)} />
          ) : activeProject ? (
            <ProjectWorkspace key={activeProject.id} project={activeProject} />
          ) : (
            <NoSelection onNew={() => setCreateOpen(true)} />
          )}
        </div>
      </div>

      <CreateProjectWizard
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(id) => setActiveProject(id)}
      />
    </Layout>
  );
};

export default FactoryPage;
