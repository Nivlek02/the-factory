import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ClipboardList, ArrowUpRight, ArrowDownUp, ArrowUp, ArrowDown } from 'lucide-react';
import { useFactoryStore, BriefWorkflowStatus } from '@/store/factoryStore';
import { useAuthStore } from '@/store/authStore';
import { flattenCampaignTasks, isTaskOwnedBy, compareByUrgencia, CampaignTask } from '@/lib/campaignTasks';
import { calcularUrgencia, formatFechaCorta, diasHasta } from '@/lib/urgencia';
import { BRIEF_STATUS_META } from '@/components/factory/DeliverableSummary';

type SortKey = 'urgencia' | 'fecha' | 'campana' | 'estado' | 'tarea';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'urgencia', label: 'Urgencia' },
  { value: 'fecha', label: 'Fecha de entrega' },
  { value: 'campana', label: 'Campaña' },
  { value: 'estado', label: 'Estado' },
  { value: 'tarea', label: 'Tarea' },
];

const STATUS_RANK: Record<BriefWorkflowStatus, number> = { pending: 0, in_review: 1, completed: 2 };

/** Días hasta la fecha (nulls al final), para ordenar por fecha de entrega. */
const diasKey = (t: CampaignTask) => {
  const d = t.fechaAccion ? diasHasta(t.fechaAccion) : null;
  return d === null ? Number.POSITIVE_INFINITY : d;
};

const comparator = (sortBy: SortKey) => (a: CampaignTask, b: CampaignTask): number => {
  switch (sortBy) {
    case 'fecha':   return diasKey(a) - diasKey(b) || a.tarea.localeCompare(b.tarea);
    case 'campana': return a.projectName.localeCompare(b.projectName) || compareByUrgencia(a, b);
    case 'estado':  return STATUS_RANK[a.status] - STATUS_RANK[b.status] || compareByUrgencia(a, b);
    case 'tarea':   return a.tarea.localeCompare(b.tarea);
    case 'urgencia':
    default:        return compareByUrgencia(a, b);
  }
};

/**
 * Módulo personal: conteos + tabla de las tareas del usuario en sesión, cruzando todas las
 * campañas, con filtros (estado / campaña) y ordenamiento. `onOpenProject` deja que cada host
 * (página de sidebar, workspace de campaña) decida cómo navegar al proyecto.
 */
export const MyTasks = ({ onOpenProject }: { onOpenProject: (projectId: string) => void }) => {
  const projects = useFactoryStore((s) => s.projects);
  const currentUser = useAuthStore((s) => s.currentUser);

  const [statusFilter, setStatusFilter] = useState<'all' | BriefWorkflowStatus>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortKey>('urgencia');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Todas mis tareas (sin filtrar) — base para conteos y para las opciones de filtro.
  const misTareas = useMemo(() => {
    const user = currentUser
      ? { role: currentUser.role as string, fullName: currentUser.fullName }
      : null;
    return flattenCampaignTasks(projects).filter((t) => isTaskOwnedBy(t, user));
  }, [projects, currentUser]);

  const counts = useMemo(
    () => ({
      pending: misTareas.filter((t) => t.status === 'pending').length,
      in_review: misTareas.filter((t) => t.status === 'in_review').length,
      completed: misTareas.filter((t) => t.status === 'completed').length,
    }),
    [misTareas]
  );

  // Solo las campañas donde el usuario tiene tareas: filtrar por otra vaciaría la lista.
  const campañas = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of misTareas) map.set(t.projectId, t.projectName);
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [misTareas]);

  const visibles = useMemo(() => {
    const filtered = misTareas.filter(
      (t) =>
        (statusFilter === 'all' || t.status === statusFilter) &&
        (projectFilter === 'all' || t.projectId === projectFilter)
    );
    const sorted = [...filtered].sort(comparator(sortBy));
    return sortDir === 'desc' ? sorted.reverse() : sorted;
  }, [misTareas, statusFilter, projectFilter, sortBy, sortDir]);

  // Tarjeta de conteo — clic filtra por ese estado (y de nuevo lo quita).
  const CountCard = ({ status, label, value, cls }: { status: BriefWorkflowStatus; label: string; value: number; cls: string }) => {
    const active = statusFilter === status;
    return (
      <button
        type="button"
        onClick={() => setStatusFilter(active ? 'all' : status)}
        className={`text-left rounded-lg border bg-card shadow-sm p-4 transition-colors ${
          active ? 'border-factory ring-1 ring-factory/30' : 'border-border/60 hover:border-factory/40'
        }`}
        aria-pressed={active}
      >
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">{label}</p>
        <p className={`font-display text-2xl font-semibold mt-1 ${cls}`}>{value}</p>
      </button>
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <CountCard status="pending" label="Pendientes" value={counts.pending} cls="text-state-progress" />
        <CountCard status="in_review" label="En revisión" value={counts.in_review} cls="text-state-review" />
        <CountCard status="completed" label="Completadas" value={counts.completed} cls="text-state-done" />
      </div>

      {/* Toolbar: filtros + ordenamiento */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'all' | BriefWorkflowStatus)}>
          <SelectTrigger className="h-8 w-[160px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="pending">Pendientes</SelectItem>
            <SelectItem value="in_review">En revisión</SelectItem>
            <SelectItem value="completed">Completadas</SelectItem>
          </SelectContent>
        </Select>

        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="h-8 w-[180px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las campañas</SelectItem>
            {campañas.map(([id, name]) => (
              <SelectItem key={id} value={id}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1.5 ml-auto">
          <ArrowDownUp className="h-3.5 w-3.5 text-muted-foreground" />
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
            <SelectTrigger className="h-8 w-[170px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>Ordenar: {o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
            title={sortDir === 'asc' ? 'Ascendente' : 'Descendente'}
          >
            {sortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {misTareas.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/60 p-10 flex flex-col items-center text-center">
          <ClipboardList className="h-8 w-8 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">Sin tareas asignadas</p>
          <p className="text-xs text-muted-foreground/60 max-w-xs mt-1">
            Cuando se te asignen tareas en cualquier campaña (según tu rol), aparecerán aquí.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border/60 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tarea</TableHead>
                <TableHead>Campaña</TableHead>
                <TableHead className="hidden md:table-cell">Rol</TableHead>
                <TableHead>Entrega</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-10 text-right">Ir</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No hay tareas que coincidan con los filtros
                  </TableCell>
                </TableRow>
              ) : (
                visibles.map((t) => {
                  const urg = calcularUrgencia(t.fechaAccion);
                  const statusMeta = BRIEF_STATUS_META[t.status];
                  return (
                    <TableRow
                      key={`${t.projectId}-${t.id}`}
                      className="cursor-pointer"
                      onClick={() => onOpenProject(t.projectId)}
                    >
                      <TableCell className="font-medium max-w-[240px]">
                        <span className={t.status === 'completed' ? 'text-muted-foreground line-through' : ''}>
                          {t.tarea}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[160px] truncate" title={t.projectName}>
                        {t.projectName}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{t.roleLabel}</TableCell>
                      <TableCell>
                        {urg ? (
                          <Badge variant="outline" className={`border-0 text-[10px] px-1.5 h-4 ${urg.className}`}>
                            {formatFechaCorta(t.fechaAccion)} · {urg.etiqueta}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground/60">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`border-0 text-[10px] px-1.5 h-4 ${statusMeta.cls}`}>
                          {statusMeta.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-factory"
                          onClick={(e) => { e.stopPropagation(); onOpenProject(t.projectId); }}
                          title="Abrir campaña"
                        >
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default MyTasks;
