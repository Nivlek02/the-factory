import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useFactoryStore } from '@/store/factoryStore';
import { useRolesStore } from '@/store/rolesStore';
import { useAuthStore, AppRole } from '@/store/authStore';
import { Plus, X, ChevronLeft, ChevronRight, FolderKanban, Users, CheckSquare, Check, Info } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (projectId: string) => void;
}

type RoleDraft = {
  roleId: string;
  roleLabel: string;
  members: string[];
};

type TaskDraft = {
  id: string;
  title: string;
  description: string;
  roleId: string;
  memberName: string;
  priority: '' | 'high' | 'medium';
};

const STEPS = [
  { key: 'data', label: 'Datos', icon: FolderKanban },
  { key: 'team', label: 'Equipo', icon: Users },
  { key: 'tasks', label: 'Tareas', icon: CheckSquare },
] as const;

// Maps the local "role" (rolesStore id) to the global AppRole used by the
// authentication system, so we can pull real users for each role.
const ROLE_ID_TO_APP_ROLE: Record<string, AppRole | undefined> = {
  copy: 'copy',
  diseno: 'disenador',
  seo: 'seo',
  produccion: 'manager',
  social: undefined, // no direct app_role -> fallback to mercadeo/manager pool
  estratega: 'mercadeo',
};

// The role that is allowed to remain unassigned in the team step.
const UNASSIGNED_ALLOWED_ROLE_IDS = new Set(['diseno']);

const CreateProjectWizard = ({ open, onOpenChange, onCreated }: Props) => {
  const { roles } = useRolesStore();
  const { users, loadUsers } = useAuthStore();
  const {
    addProject, addRoleGroup, addMemberToRole, addTask,
  } = useFactoryStore();

  useEffect(() => { if (open && users.length === 0) loadUsers(); }, [open, users.length, loadUsers]);

  const [step, setStep] = useState(0);
  const today = () => new Date().toISOString().split('T')[0];
  const [data, setData] = useState({
    name: '', description: '', client: '',
    state: 'planning' as const, priority: 'P1' as 'P0'|'P1'|'P2',
    startDate: today(),
    dueDate: '',
  });
  const [roleDrafts, setRoleDrafts] = useState<RoleDraft[]>([]);
  const [tasks, setTasks] = useState<TaskDraft[]>([]);

  const reset = () => {
    setStep(0);
    setData({ name: '', description: '', client: '', state: 'planning', priority: 'P1', startDate: today(), dueDate: '' });
    setRoleDrafts([]);
    setTasks([]);
  };

  const close = () => { onOpenChange(false); setTimeout(reset, 300); };

  const availableRoles = roles.filter((r) => !roleDrafts.some((d) => d.roleId === r.id));
  const [pickRole, setPickRole] = useState('');
  const addRole = () => {
    const r = roles.find((x) => x.id === pickRole);
    if (!r) return;
    setRoleDrafts((d) => [...d, { roleId: r.id, roleLabel: r.label, members: [] }]);
    setPickRole('');
  };
  const removeRole = (id: string) => setRoleDrafts((d) => d.filter((x) => x.roleId !== id));
  const addMember = (roleId: string, name: string) => {
    const n = name.trim(); if (!n) return;
    setRoleDrafts((d) => d.map((r) =>
      r.roleId === roleId && !r.members.includes(n)
        ? { ...r, members: [...r.members, n] }
        : r
    ));
  };
  const removeMember = (roleId: string, idx: number) =>
    setRoleDrafts((d) => d.map((r) => r.roleId === roleId ? { ...r, members: r.members.filter((_, i) => i !== idx) } : r));

  // ─── Step Tasks helpers
  const [taskDraft, setTaskDraft] = useState<TaskDraft>({ id: '', title: '', description: '', roleId: '', memberName: '', priority: '' });
  const addTaskDraft = () => {
    if (!taskDraft.title.trim() || !taskDraft.roleId) return;
    setTasks((ts) => [...ts, { ...taskDraft, id: `${Date.now()}-${Math.random()}` }]);
    setTaskDraft({ id: '', title: '', description: '', roleId: '', memberName: '', priority: '' });
  };
  const removeTask = (id: string) => setTasks((ts) => ts.filter((t) => t.id !== id));

  const canNext = step === 0 ? data.name.trim().length > 0 : true;
  const isLast = step === STEPS.length - 1;

  const handleCreate = () => {
    const id = addProject({
      name: data.name.trim(),
      description: data.description.trim(),
      client: data.client.trim(),
      state: data.state,
      priority: data.priority,
      startDate: data.startDate || null,
      dueDate: data.dueDate || null,
    });
    roleDrafts.forEach((r) => {
      addRoleGroup(id, r.roleId, r.roleLabel);
      r.members.forEach((m) => addMemberToRole(id, r.roleId, m));
    });
    tasks.forEach((t) => {
      const role = roleDrafts.find((r) => r.roleId === t.roleId);
      addTask(id, {
        title: t.title.trim(),
        description: t.description.trim(),
        assignedMemberId: null,
        assignedMemberName: t.memberName || null,
        assignedRoleLabel: role?.roleLabel || null,
        status: 'pending',
        priority: t.priority || null,
        dueDate: null,
      });
    });
    onCreated(id);
    close();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => v ? onOpenChange(v) : close()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Nuevo proyecto</DialogTitle>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center gap-2 px-1 py-2">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const active = i === step;
            const done = i < step;
            return (
              <div key={s.key} className="flex items-center gap-2 flex-1">
                <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  active ? 'bg-factory-soft text-factory'
                  : done ? 'text-foreground' : 'text-muted-foreground'
                }`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                    active ? 'bg-factory text-factory-foreground'
                    : done ? 'bg-state-done text-white' : 'bg-muted text-muted-foreground'
                  }`}>
                    {done ? <Check className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
                  </div>
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
                {i < STEPS.length - 1 && <div className={`h-px flex-1 ${i < step ? 'bg-state-done' : 'bg-border'}`} />}
              </div>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto px-1 py-3">
          {/* STEP 1 — DATA */}
          {step === 0 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Nombre de producto o campaña *</Label>
                <Input
                  placeholder="Ej. Evento Internacional 2025"
                  value={data.name}
                  onChange={(e) => setData((d) => ({ ...d, name: e.target.value }))}
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label>Descripción</Label>
                <Textarea
                  rows={3}
                  placeholder="Objetivo, alcance, contexto…"
                  value={data.description}
                  onChange={(e) => setData((d) => ({ ...d, description: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Cliente / Área</Label>
                  <Input
                    placeholder="Ej. Brand Studio"
                    value={data.client}
                    onChange={(e) => setData((d) => ({ ...d, client: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Fecha de inicio</Label>
                  <Input
                    type="date"
                    value={data.startDate}
                    onChange={(e) => setData((d) => ({ ...d, startDate: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Fecha de finalización</Label>
                  <Input
                    type="date"
                    value={data.dueDate}
                    onChange={(e) => setData((d) => ({ ...d, dueDate: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Estado inicial</Label>
                  <Select value={data.state} onValueChange={(v) => setData((d) => ({ ...d, state: v as any }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="planning">Planning</SelectItem>
                      <SelectItem value="in_progress">En proceso</SelectItem>
                      <SelectItem value="review">En revisión</SelectItem>
                      <SelectItem value="blocked">Bloqueado</SelectItem>
                      <SelectItem value="done">Completado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Prioridad</Label>
                  <Select value={data.priority} onValueChange={(v) => setData((d) => ({ ...d, priority: v as any }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="P0">P0 — Crítica</SelectItem>
                      <SelectItem value="P1">P1 — Alta</SelectItem>
                      <SelectItem value="P2">P2 — Normal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2 — TEAM */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Select value={pickRole} onValueChange={setPickRole}>
                  <SelectTrigger><SelectValue placeholder="Selecciona un rol…" /></SelectTrigger>
                  <SelectContent>
                    {availableRoles.length === 0
                      ? <SelectItem value="__none__" disabled>No quedan roles disponibles</SelectItem>
                      : availableRoles.map((r) => <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>)
                    }
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={addRole} disabled={!pickRole}>
                  <Plus className="h-4 w-4" /> Agregar rol
                </Button>
              </div>

              {roleDrafts.length === 0 && (
                <p className="text-sm text-muted-foreground italic text-center py-6">
                  Aún no has agregado roles. Selecciona uno arriba para empezar.
                </p>
              )}

              <div className="space-y-3">
                {roleDrafts.map((r) => (
                  <RoleMemberRow
                    key={r.roleId}
                    role={r}
                    users={users}
                    onAddMember={(name) => addMember(r.roleId, name)}
                    onRemoveMember={(i) => removeMember(r.roleId, i)}
                    onRemoveRole={() => removeRole(r.roleId)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* STEP 3 — TASKS */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border/60 p-3 space-y-2 bg-muted/30">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nueva tarea inicial</p>
                <Input
                  placeholder="Título de la tarea"
                  value={taskDraft.title}
                  onChange={(e) => setTaskDraft((t) => ({ ...t, title: e.target.value }))}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Select value={taskDraft.roleId} onValueChange={(v) => setTaskDraft((t) => ({ ...t, roleId: v, memberName: '' }))}>
                    <SelectTrigger><SelectValue placeholder="Asignar a rol…" /></SelectTrigger>
                    <SelectContent>
                      {roleDrafts.length === 0
                        ? <SelectItem value="__n__" disabled>Agrega roles primero</SelectItem>
                        : roleDrafts.map((r) => <SelectItem key={r.roleId} value={r.roleId}>{r.roleLabel}</SelectItem>)
                      }
                    </SelectContent>
                  </Select>
                  <Select value={taskDraft.memberName} onValueChange={(v) => setTaskDraft((t) => ({ ...t, memberName: v }))}>
                    <SelectTrigger><SelectValue placeholder="Persona (opcional)" /></SelectTrigger>
                    <SelectContent>
                      {(roleDrafts.find((r) => r.roleId === taskDraft.roleId)?.members ?? []).length === 0
                        ? <SelectItem value="__n__" disabled>Sin personas en el rol</SelectItem>
                        : roleDrafts.find((r) => r.roleId === taskDraft.roleId)!.members.map((m) =>
                            <SelectItem key={m} value={m}>{m}</SelectItem>
                          )
                      }
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end">
                  <Button size="sm" onClick={addTaskDraft} disabled={!taskDraft.title.trim() || !taskDraft.roleId}>
                    <Plus className="h-4 w-4" /> Agregar tarea
                  </Button>
                </div>
              </div>

              {tasks.length === 0 ? (
                <p className="text-sm text-muted-foreground italic text-center py-4">
                  Las tareas iniciales son opcionales. Podrás agregar más después en el mapa.
                </p>
              ) : (
                <div className="space-y-2">
                  {tasks.map((t) => {
                    const role = roleDrafts.find((r) => r.roleId === t.roleId);
                    return (
                      <div key={t.id} className="flex items-center gap-2 p-2 rounded-md bg-card border border-border/60">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{t.title}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {role?.roleLabel}{t.memberName && ` · ${t.memberName}`}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-[10px]">{role?.roleLabel}</Badge>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeTask(t.id)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex sm:justify-between gap-2 border-t pt-3">
          <Button variant="outline" onClick={() => step === 0 ? close() : setStep((s) => s - 1)}>
            {step === 0 ? 'Cancelar' : (<><ChevronLeft className="h-4 w-4" /> Atrás</>)}
          </Button>
          {isLast ? (
            <Button className="bg-gradient-factory text-factory-foreground shadow-glow" onClick={handleCreate} disabled={!data.name.trim()}>
              <Check className="h-4 w-4" /> Crear proyecto
            </Button>
          ) : (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext}>
              Siguiente <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─── Inline sub-components ────────────────────────────────────────────────────

const RoleMemberRow = ({ role, users, onAddMember, onRemoveMember, onRemoveRole }: {
  role: RoleDraft;
  users: ReturnType<typeof useAuthStore.getState>['users'];
  onAddMember: (name: string) => void;
  onRemoveMember: (i: number) => void;
  onRemoveRole: () => void;
}) => {
  const isDesign = UNASSIGNED_ALLOWED_ROLE_IDS.has(role.roleId);
  const appRole = ROLE_ID_TO_APP_ROLE[role.roleId];

  // Pool of project-wide people that match this role
  const pool = useMemo(() => {
    if (!appRole) return users;
    return users.filter((u) => u.role === appRole);
  }, [users, appRole]);

  const available = pool.filter((u) => !role.members.includes(u.fullName));
  const [pick, setPick] = useState('');

  return (
    <div className="rounded-lg border border-border/60 p-3 bg-card">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{role.roleLabel}</span>
          {isDesign && (
            <Badge variant="outline" className="text-[9px] gap-1 h-5">
              <Info className="h-2.5 w-2.5" /> Puede quedar sin asignar
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={onRemoveRole}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-2">
        {role.members.map((m, i) => (
          <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-xs">
            {m}
            <button onClick={() => onRemoveMember(i)} className="text-muted-foreground hover:text-destructive">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {role.members.length === 0 && (
          <span className="text-xs text-muted-foreground italic">
            {isDesign ? 'Sin asignar (se asignará después)' : 'Sin personas en este rol'}
          </span>
        )}
      </div>

      {pool.length === 0 ? (
        <p className="text-[11px] text-muted-foreground italic">
          {isDesign
            ? 'No hay diseñadores creados. Puedes dejarlo así y asignar luego.'
            : 'No hay personas creadas con este rol. Crea usuarios en Configuración.'}
        </p>
      ) : (
        <div className="flex gap-1">
          <Select value={pick} onValueChange={setPick}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder={available.length === 0 ? 'Todas agregadas' : 'Agregar persona…'} />
            </SelectTrigger>
            <SelectContent>
              {available.length === 0
                ? <SelectItem value="__n__" disabled>Todas las personas ya están agregadas</SelectItem>
                : available.map((u) => (
                    <SelectItem key={u.id} value={u.fullName}>{u.fullName}</SelectItem>
                  ))}
            </SelectContent>
          </Select>
          <Button
            size="icon" variant="outline" className="h-8 w-8"
            disabled={!pick}
            onClick={() => { if (pick) { onAddMember(pick); setPick(''); } }}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default CreateProjectWizard;
