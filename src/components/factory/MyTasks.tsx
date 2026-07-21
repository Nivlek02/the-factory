import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ClipboardList, ArrowUpRight } from 'lucide-react';
import { useFactoryStore } from '@/store/factoryStore';
import { useAuthStore } from '@/store/authStore';
import { flattenCampaignTasks, isTaskOwnedBy, compareByUrgencia } from '@/lib/campaignTasks';
import { calcularUrgencia, formatFechaCorta } from '@/lib/urgencia';
import { BRIEF_STATUS_META } from '@/components/factory/DeliverableSummary';

/**
 * Módulo personal: conteos + tabla de las tareas del usuario en sesión, cruzando todas las
 * campañas, ordenadas por urgencia y fecha de entrega. `onOpenProject` deja que cada host
 * (página de sidebar, workspace de campaña) decida cómo navegar al proyecto.
 */
export const MyTasks = ({ onOpenProject }: { onOpenProject: (projectId: string) => void }) => {
  const projects = useFactoryStore((s) => s.projects);
  const currentUser = useAuthStore((s) => s.currentUser);

  const misTareas = useMemo(() => {
    const user = currentUser
      ? { role: currentUser.role as string, fullName: currentUser.fullName }
      : null;
    return flattenCampaignTasks(projects)
      .filter((t) => isTaskOwnedBy(t, user))
      .sort(compareByUrgencia);
  }, [projects, currentUser]);

  const counts = useMemo(
    () => ({
      pending: misTareas.filter((t) => t.status === 'pending').length,
      in_review: misTareas.filter((t) => t.status === 'in_review').length,
      completed: misTareas.filter((t) => t.status === 'completed').length,
    }),
    [misTareas]
  );

  const CountCard = ({ label, value, cls }: { label: string; value: number; cls: string }) => (
    <Card className="shadow-sm">
      <CardContent className="p-4">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">{label}</p>
        <p className={`font-display text-2xl font-semibold mt-1 ${cls}`}>{value}</p>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <CountCard label="Pendientes" value={counts.pending} cls="text-state-progress" />
        <CountCard label="En revisión" value={counts.in_review} cls="text-state-review" />
        <CountCard label="Completadas" value={counts.completed} cls="text-state-done" />
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
              {misTareas.map((t) => {
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
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default MyTasks;
