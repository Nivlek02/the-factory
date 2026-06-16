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
  ClipboardList,
  ChevronRight,
  X,
  ListTodo,
  Workflow,
} from 'lucide-react';
import { useFactoryStore, FactoryProject, ProjectTask, ProjectRoleGroup } from '@/store/factoryStore';
import { useRolesStore } from '@/store/rolesStore';
import CreateProjectWizard from './CreateProjectWizard';
import MapTab from './MapTab';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATE_META: Record<string, { label: string; cls: string }> = {
  planning:    { label: 'Planning',     cls: 'bg-state-planning-bg text-state-planning' },
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

const PRIORITY_META: Record<string, { cls: string; border: string }> = {
  P0: { cls: 'text-priority-p0', border: 'border-priority-p0' },
  P1: { cls: 'text-priority-p1', border: 'border-priority-p1' },
  P2: { cls: 'text-priority-p2', border: 'border-priority-p2' },
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
  if (!project.tasks.length) return 0;
  return Math.round((project.tasks.filter((t) => t.status === 'completed').length / project.tasks.length) * 100);
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

// ─── Role Group Card (Team Tab) ───────────────────────────────────────────────

const RoleGroupCard = ({
  group,
  colorIndex,
  project,
}: {
  group: ProjectRoleGroup;
  colorIndex: number;
  project: FactoryProject;
}) => {
  const { addMemberToRole, removeMemberFromRole, removeRoleGroup } = useFactoryStore();
  const [newMember, setNewMember] = useState('');
  const memberInputRef = useRef<HTMLInputElement>(null);
  const color = roleColor(colorIndex);

  const handleAddMember = () => {
    const name = newMember.trim();
    if (!name) return;
    addMemberToRole(project.id, group.roleId, name);
    setNewMember('');
    memberInputRef.current?.focus();
  };

  return (
    <Card className="shadow-sm overflow-hidden">
      {/* Role header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/60" style={{ borderLeftWidth: 3, borderLeftColor: color }}>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: color }}>
            {group.roleLabel.charAt(0).toUpperCase()}
          </div>
          <span className="font-semibold text-sm">{group.roleLabel}</span>
          <span className="text-[10px] text-muted-foreground">
            {group.members.length} persona{group.members.length !== 1 ? 's' : ''}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-destructive"
          onClick={() => removeRoleGroup(project.id, group.roleId)}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <CardContent className="p-4">
        {/* Members */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
            <Users className="h-3 w-3" />
            Personas
          </p>
          <div className="space-y-1.5 mb-2">
            {group.members.length === 0 && (
              <p className="text-xs text-muted-foreground italic">Sin personas asignadas</p>
            )}
            {group.members.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-2 py-1 px-2 rounded-md bg-muted/40 group/member">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0" style={{ backgroundColor: color }}>
                    {m.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-xs font-medium truncate">{m.name}</span>
                </div>
                <button
                  className="text-muted-foreground hover:text-destructive opacity-0 group-hover/member:opacity-100 transition-opacity shrink-0"
                  onClick={() => removeMemberFromRole(project.id, group.roleId, m.id)}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-1">
            <Input
              ref={memberInputRef}
              placeholder="Nombre de persona…"
              value={newMember}
              className="h-7 text-xs"
              onChange={(e) => setNewMember(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddMember()}
            />
            <Button size="icon" variant="outline" className="h-7 w-7 shrink-0" onClick={handleAddMember} disabled={!newMember.trim()}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const OverviewTab = ({ project }: { project: FactoryProject }) => {
  const progress = projectProgress(project);
  const totalMembers = project.roleGroups.reduce((s, g) => s + g.members.length, 0);
  const doneTasks = project.tasks.filter((t) => t.status === 'completed').length;
  const inProgress = project.tasks.filter((t) => t.status === 'in_progress').length;

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
            <p className="text-[10px] text-muted-foreground mt-1">{doneTasks} de {project.tasks.length} tareas</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">En proceso</p>
            <p className="font-display text-2xl font-semibold text-state-progress mt-1">{inProgress}</p>
            <p className="text-[10px] text-muted-foreground">tareas activas</p>
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
            <p className="text-sm text-foreground/80 leading-relaxed">{project.description}</p>
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// ─── Team Tab ─────────────────────────────────────────────────────────────────

const TeamTab = ({ project }: { project: FactoryProject }) => {
  const { roles } = useRolesStore();
  const { addRoleGroup } = useFactoryStore();
  const [addRoleOpen, setAddRoleOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState('');

  const availableRoles = roles.filter((r) => !project.roleGroups.some((g) => g.roleId === r.id));

  const handleAddRole = () => {
    const role = roles.find((r) => r.id === selectedRole);
    if (!role) return;
    addRoleGroup(project.id, role.id, role.label);
    setSelectedRole('');
    setAddRoleOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          {project.roleGroups.length} rol{project.roleGroups.length !== 1 ? 'es' : ''} en este proyecto
        </p>
        <Button size="sm" variant="outline" onClick={() => setAddRoleOpen(true)}>
          <UserPlus className="h-4 w-4" />
          Agregar rol
        </Button>
      </div>

      {project.roleGroups.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 flex flex-col items-center text-center">
            <Users className="h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-sm font-medium mb-1">Sin roles asignados</p>
            <p className="text-xs text-muted-foreground mb-4">
              Agrega roles al proyecto. Cada rol puede tener personas y requerimientos específicos.
            </p>
            <Button size="sm" onClick={() => setAddRoleOpen(true)}>
              <UserPlus className="h-4 w-4" />
              Agregar primer rol
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {project.roleGroups.map((group, i) => (
            <RoleGroupCard key={group.roleId} group={group} colorIndex={i} project={project} />
          ))}
        </div>
      )}

      {/* Add role dialog */}
      <Dialog open={addRoleOpen} onOpenChange={setAddRoleOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Agregar rol al proyecto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Rol</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un rol…" />
                </SelectTrigger>
                <SelectContent>
                  {availableRoles.length === 0 ? (
                    <SelectItem value="__none__" disabled>Todos los roles ya están en el proyecto</SelectItem>
                  ) : (
                    availableRoles.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {availableRoles.length === 0 && (
                <p className="text-xs text-muted-foreground">Crea más roles en Ajustes para agregarlos aquí.</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddRoleOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddRole} disabled={!selectedRole}>Agregar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ─── Tasks Tab ────────────────────────────────────────────────────────────────

const TasksTab = ({
  project,
  onNewTask,
  onStatusChange,
  onDeleteTask,
}: {
  project: FactoryProject;
  onNewTask: () => void;
  onStatusChange: (taskId: string, status: string) => void;
  onDeleteTask: (taskId: string) => void;
}) => {
  const columns = [
    { key: 'pending',     label: 'Pendiente' },
    { key: 'in_progress', label: 'En proceso' },
    { key: 'in_review',   label: 'En revisión' },
    { key: 'completed',   label: 'Completada' },
  ];

  const allMembers = project.roleGroups.flatMap((g) =>
    g.members.map((m) => ({ id: m.id, name: m.name, roleLabel: g.roleLabel }))
  );

  const { addRequirement, removeRequirement } = useFactoryStore();
  const [reqInputs, setReqInputs] = useState<Record<string, string>>({});
  const setReq = (roleId: string, v: string) => setReqInputs((s) => ({ ...s, [roleId]: v }));
  const handleAddReq = (roleId: string) => {
    const text = (reqInputs[roleId] ?? '').trim();
    if (!text) return;
    addRequirement(project.id, roleId, text);
    setReq(roleId, '');
  };
  const totalReqs = project.roleGroups.reduce((s, g) => s + g.requirements.length, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{project.tasks.length} tareas · {totalReqs} requerimientos</p>
        <Button size="sm" onClick={onNewTask}>
          <Plus className="h-4 w-4" />
          Nueva tarea
        </Button>
      </div>

      {/* Requirements per role — unified with tasks */}
      {project.roleGroups.length > 0 && (
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              <ListTodo className="h-3 w-3" />
              Requerimientos por rol
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {project.roleGroups.map((g, i) => {
                const color = roleColor(i);
                return (
                  <div key={g.roleId} className="rounded-lg border border-border/60 bg-card/60 p-3" style={{ borderLeft: `3px solid ${color}` }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold" style={{ color }}>{g.roleLabel}</span>
                      <span className="text-[10px] text-muted-foreground">{g.requirements.length} req.</span>
                    </div>
                    <div className="space-y-1 mb-2">
                      {g.requirements.length === 0 && (
                        <p className="text-[11px] text-muted-foreground italic">Sin requerimientos</p>
                      )}
                      {g.requirements.map((req) => (
                        <div key={req.id} className="flex items-start justify-between gap-2 py-1 px-2 rounded-md bg-muted/40 group/req">
                          <span className="text-[11px] leading-snug flex-1">{req.text}</span>
                          <button
                            className="text-muted-foreground hover:text-destructive opacity-0 group-hover/req:opacity-100 transition-opacity shrink-0 mt-0.5"
                            onClick={() => removeRequirement(project.id, g.roleId, req.id)}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-1">
                      <Input
                        placeholder="Agregar requerimiento…"
                        value={reqInputs[g.roleId] ?? ''}
                        className="h-7 text-xs"
                        onChange={(e) => setReq(g.roleId, e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddReq(g.roleId)}
                      />
                      <Button size="icon" variant="outline" className="h-7 w-7 shrink-0" onClick={() => handleAddReq(g.roleId)} disabled={!(reqInputs[g.roleId] ?? '').trim()}>
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {project.tasks.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 flex flex-col items-center text-center">
            <ClipboardList className="h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-sm font-medium mb-1">Sin tareas aún</p>
            <p className="text-xs text-muted-foreground mb-4">
              Crea tareas y asígnalas a las personas del equipo.
            </p>
            <Button size="sm" onClick={onNewTask}>
              <Plus className="h-4 w-4" />
              Nueva tarea
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          {columns.map((col) => {
            const colTasks = project.tasks.filter((t) => t.status === col.key);
            const meta = TASK_STATUS_META[col.key];
            return (
              <div key={col.key} className="flex flex-col gap-2">
                <div className="flex items-center justify-between px-1">
                  <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${meta.cls}`}>
                    <CircleDot className="h-2.5 w-2.5" />
                    {col.label}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{colTasks.length}</span>
                </div>
                <div className="flex flex-col gap-2 min-h-16">
                  {colTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      allMembers={allMembers}
                      onStatusChange={(status) => onStatusChange(task.id, status)}
                      onDelete={() => onDeleteTask(task.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Project Workspace ────────────────────────────────────────────────────────

const TABS = [
  { key: 'map',      label: 'Mapa',      icon: <Workflow className="h-3.5 w-3.5" /> },
  { key: 'overview', label: 'Overview',  icon: <Flag className="h-3.5 w-3.5" /> },
  { key: 'team',     label: 'Equipo',    icon: <Users className="h-3.5 w-3.5" /> },
  { key: 'tasks',    label: 'Tareas',    icon: <CheckSquare className="h-3.5 w-3.5" /> },
] as const;

const BLANK_TASK = {
  title: '',
  description: '',
  assignedMemberId: '',
  assignedMemberName: null as string | null,
  assignedRoleLabel: null as string | null,
  status: 'pending',
  priority: '' as 'high' | 'medium' | '',
  dueDate: '',
};

const ProjectWorkspace = ({ project }: { project: FactoryProject }) => {
  const [activeTab, setActiveTab] = useState<'map' | 'overview' | 'team' | 'tasks'>('map');
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [taskForm, setTaskForm] = useState(BLANK_TASK);

  const { addTask, updateTask, deleteTask, deleteProject, setActiveProject } = useFactoryStore();

  const allMembers = project.roleGroups.flatMap((g) =>
    g.members.map((m) => ({ id: m.id, name: m.name, roleLabel: g.roleLabel }))
  );

  const handleAddTask = () => {
    if (!taskForm.title.trim()) return;
    const member = allMembers.find((m) => m.id === taskForm.assignedMemberId);
    addTask(project.id, {
      title: taskForm.title.trim(),
      description: taskForm.description.trim(),
      assignedMemberId: member?.id ?? null,
      assignedMemberName: member?.name ?? null,
      assignedRoleLabel: member?.roleLabel ?? null,
      status: taskForm.status as any,
      priority: taskForm.priority as any || null,
      dueDate: taskForm.dueDate || null,
    });
    setTaskForm(BLANK_TASK);
    setNewTaskOpen(false);
  };

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
            {project.priority}
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
              tab.key === 'team' ? project.roleGroups.length :
              tab.key === 'tasks' ? project.tasks.length : null;
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
        {activeTab === 'map' && <MapTab project={project} />}
        {activeTab === 'overview' && <OverviewTab project={project} />}
        {activeTab === 'team' && <TeamTab project={project} />}
        {activeTab === 'tasks' && (
          <TasksTab
            project={project}
            onNewTask={() => setNewTaskOpen(true)}
            onStatusChange={(taskId, status) => updateTask(project.id, taskId, { status: status as any })}
            onDeleteTask={(taskId) => deleteTask(project.id, taskId)}
          />
        )}
      </div>

      {/* New Task Dialog */}
      <Dialog open={newTaskOpen} onOpenChange={setNewTaskOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva tarea</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Título</Label>
              <Input
                placeholder="¿Qué hay que hacer?"
                value={taskForm.title}
                onChange={(e) => setTaskForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Descripción <span className="text-muted-foreground">(opcional)</span></Label>
              <Textarea
                placeholder="Más detalles…"
                rows={2}
                value={taskForm.description}
                onChange={(e) => setTaskForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Asignar a</Label>
                <Select
                  value={taskForm.assignedMemberId}
                  onValueChange={(v) => setTaskForm((f) => ({ ...f, assignedMemberId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sin asignar" />
                  </SelectTrigger>
                  <SelectContent>
                    {allMembers.length === 0 ? (
                      <SelectItem value="__none__" disabled>Agrega personas al equipo primero</SelectItem>
                    ) : (
                      allMembers.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name} — {m.roleLabel}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Estado</Label>
                <Select value={taskForm.status} onValueChange={(v) => setTaskForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TASK_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Prioridad</Label>
                <Select value={taskForm.priority} onValueChange={(v) => setTaskForm((f) => ({ ...f, priority: v as any }))}>
                  <SelectTrigger><SelectValue placeholder="Sin prioridad" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="medium">Media</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Fecha límite</Label>
                <Input
                  type="date"
                  value={taskForm.dueDate}
                  onChange={(e) => setTaskForm((f) => ({ ...f, dueDate: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewTaskOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddTask} disabled={!taskForm.title.trim()}>Crear tarea</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">The Factory</p>
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
            <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
              {filteredProjects.length === 0 && (
                <div className="px-3 py-6 text-center">
                  <p className="text-xs text-muted-foreground">
                    {projects.length === 0 ? 'Sin proyectos aún.' : 'Sin coincidencias.'}
                  </p>
                </div>
              )}
              {filteredProjects.map((p) => {
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
                      <span className={`text-[9px] font-semibold ${PRIORITY_META[p.priority].cls}`}>{p.priority}</span>
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
