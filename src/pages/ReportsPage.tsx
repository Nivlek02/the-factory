import { useState, useMemo, useEffect } from 'react';
import { useFactoryStore } from '@/store/factoryStore';
import { useAuthStore } from '@/store/authStore';
import { flattenCampaignTasks, isTaskOwnedBy, compareByUrgencia, CampaignTask } from '@/lib/campaignTasks';
import { calcularUrgencia, formatFechaCorta } from '@/lib/urgencia';
import { BRIEF_STATUS_META } from '@/components/factory/DeliverableSummary';
import { BriefWorkflowStatus } from '@/store/factoryStore';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon, Download, BarChart3, ListTodo, Users, Layers, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const PAGE_SIZE_OPTIONS = [5, 20, 50] as const;

const STATUS_ORDER: BriefWorkflowStatus[] = ['pending', 'in_review', 'completed'];

/** 'YYYY-MM-DD' → Date local a medianoche (evita el corrimiento por UTC en Colombia). */
const parseFecha = (iso: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
};

const ReportsPage = () => {
  const { projects, hydrate, isLoaded } = useFactoryStore();
  const { users } = useAuthStore();

  useEffect(() => {
    if (!isLoaded) hydrate();
  }, [isLoaded, hydrate]);

  // Filters
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [allTasksPage, setAllTasksPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);

  // Todas las tareas de todas las campañas, ya normalizadas.
  const allTasks = useMemo(() => flattenCampaignTasks(projects), [projects]);

  // Roles presentes en las tareas (para el filtro).
  const roleOptions = useMemo(
    () => [...new Set(allTasks.map((t) => t.roleLabel))].sort((a, b) => a.localeCompare(b)),
    [allTasks]
  );

  const filteredTasks = useMemo(() => {
    const filtered = allTasks.filter((task) => {
      // Date filter (sobre la fecha de entrega de la acción)
      if (dateFrom && dateTo) {
        const d = task.fechaAccion ? parseFecha(task.fechaAccion) : null;
        if (!d || !isWithinInterval(d, { start: startOfDay(dateFrom), end: endOfDay(dateTo) })) {
          return false;
        }
      }

      if (projectFilter !== 'all' && task.projectId !== projectFilter) return false;
      if (statusFilter !== 'all' && task.status !== statusFilter) return false;
      if (roleFilter !== 'all' && task.roleLabel !== roleFilter) return false;

      // Usuario: se le atribuye una tarea por su rol o por figurar como miembro del grupo.
      if (userFilter !== 'all') {
        const u = users.find((x) => x.id === userFilter);
        if (u && !isTaskOwnedBy(task, { role: u.role as string, fullName: u.fullName })) return false;
      }

      return true;
    });
    return filtered.sort(compareByUrgencia);
  }, [allTasks, dateFrom, dateTo, projectFilter, statusFilter, roleFilter, userFilter, users]);

  // Stats
  const stats = useMemo(() => {
    const byStatus = STATUS_ORDER.reduce((acc, s) => {
      acc[s] = filteredTasks.filter((t) => t.status === s).length;
      return acc;
    }, {} as Record<BriefWorkflowStatus, number>);
    return { byStatus };
  }, [filteredTasks]);

  // Resumen por rol
  const byRole = useMemo(() => {
    const map = new Map<string, { role: string; total: number } & Record<BriefWorkflowStatus, number>>();
    for (const t of filteredTasks) {
      const row = map.get(t.roleLabel) ?? { role: t.roleLabel, total: 0, pending: 0, in_review: 0, completed: 0 };
      row.total += 1;
      row[t.status] += 1;
      map.set(t.roleLabel, row);
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [filteredTasks]);

  // Resumen por usuario — se le atribuyen las tareas de su rol o donde figura como miembro.
  const byUser = useMemo(() => {
    return users
      .map((u) => {
        const owned = filteredTasks.filter((t) => isTaskOwnedBy(t, { role: u.role as string, fullName: u.fullName }));
        return {
          id: u.id,
          name: u.fullName,
          total: owned.length,
          pending: owned.filter((t) => t.status === 'pending').length,
          in_review: owned.filter((t) => t.status === 'in_review').length,
          completed: owned.filter((t) => t.status === 'completed').length,
        };
      })
      .filter((r) => r.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [filteredTasks, users]);

  const clearFilters = () => {
    setDateFrom(undefined);
    setDateTo(undefined);
    setProjectFilter('all');
    setStatusFilter('all');
    setRoleFilter('all');
    setUserFilter('all');
    setAllTasksPage(1);
  };

  const statusClass = (status: BriefWorkflowStatus) => BRIEF_STATUS_META[status].cls;

  const csvCell = (v: string) => `"${(v ?? '').replace(/"/g, '""')}"`;

  const exportToCSV = () => {
    const headers = ['Tarea', 'Campaña', 'Cliente', 'Rol', 'Responsables', 'Estado', 'Fecha de entrega', 'Estratega'];
    const rows = filteredTasks.map((t) => [
      csvCell(t.tarea),
      csvCell(t.projectName),
      csvCell(t.projectClient),
      csvCell(t.roleLabel),
      csvCell(t.assignees.join(', ')),
      csvCell(BRIEF_STATUS_META[t.status].label),
      csvCell(t.fechaAccion ? formatFechaCorta(t.fechaAccion) : ''),
      csvCell(t.strategistName),
    ]);
    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `reporte_campanas_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  return (
    <Layout>
      <div className="p-6 lg:p-8 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <BarChart3 className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">Reportes</h1>
            </div>
            <p className="text-muted-foreground">Tareas de las campañas por rol y por usuario</p>
          </div>
          <Button onClick={exportToCSV} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {/* Date From */}
              <div>
                <label className="text-sm font-medium mb-2 block">Desde</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dateFrom && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateFrom ? format(dateFrom, "d MMM", { locale: es }) : "Fecha"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} locale={es} />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Date To */}
              <div>
                <label className="text-sm font-medium mb-2 block">Hasta</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dateTo && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateTo ? format(dateTo, "d MMM", { locale: es }) : "Fecha"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={dateTo} onSelect={setDateTo} locale={es} />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Campaña */}
              <div>
                <label className="text-sm font-medium mb-2 block">Campaña</label>
                <Select value={projectFilter} onValueChange={(v) => { setProjectFilter(v); setAllTasksPage(1); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Estado */}
              <div>
                <label className="text-sm font-medium mb-2 block">Estado</label>
                <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setAllTasksPage(1); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {STATUS_ORDER.map((s) => (
                      <SelectItem key={s} value={s}>{BRIEF_STATUS_META[s].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Rol */}
              <div>
                <label className="text-sm font-medium mb-2 block">Rol</label>
                <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); setAllTasksPage(1); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {roleOptions.map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Usuario */}
              <div>
                <label className="text-sm font-medium mb-2 block">Usuario</label>
                <Select value={userFilter} onValueChange={(v) => { setUserFilter(v); setAllTasksPage(1); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Limpiar filtros
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Tareas</p>
                  <p className="text-3xl font-bold">{filteredTasks.length}</p>
                </div>
                <ListTodo className="h-8 w-8 text-primary/20" />
              </div>
            </CardContent>
          </Card>

          {STATUS_ORDER.map((status) => (
            <Card key={status}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{BRIEF_STATUS_META[status].label}</p>
                    <p className="text-3xl font-bold">{stats.byStatus[status]}</p>
                  </div>
                  <div className={cn("w-3 h-8 rounded-full", statusClass(status).split(' ')[0])} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs for Tables */}
        <Tabs defaultValue="all" className="space-y-4">
          <TabsList>
            <TabsTrigger value="all" className="flex items-center gap-2">
              <ListTodo className="h-4 w-4" />
              Todas las tareas
            </TabsTrigger>
            <TabsTrigger value="byRole" className="flex items-center gap-2">
              <Layers className="h-4 w-4" />
              Por rol ({byRole.length})
            </TabsTrigger>
            <TabsTrigger value="byUser" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Por usuario ({byUser.length})
            </TabsTrigger>
          </TabsList>

          {/* ─── Todas las tareas ─── */}
          <TabsContent value="all">
            <Card>
              <CardContent className="pt-6">
                {(() => {
                  const totalPages = Math.max(1, Math.ceil(filteredTasks.length / itemsPerPage));
                  const paginated = filteredTasks.slice((allTasksPage - 1) * itemsPerPage, allTasksPage * itemsPerPage);
                  return (
                    <>
                      <div className="rounded-md border overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Tarea</TableHead>
                              <TableHead>Campaña</TableHead>
                              <TableHead>Rol</TableHead>
                              <TableHead>Responsables</TableHead>
                              <TableHead>Estado</TableHead>
                              <TableHead>Fecha de entrega</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredTasks.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                  No hay tareas que coincidan con los filtros
                                </TableCell>
                              </TableRow>
                            ) : (
                              paginated.map((t) => {
                                const urg = calcularUrgencia(t.fechaAccion);
                                return (
                                  <TableRow key={`${t.projectId}-${t.id}`}>
                                    <TableCell className="font-medium max-w-[240px] truncate" title={t.tarea}>{t.tarea}</TableCell>
                                    <TableCell className="text-sm max-w-[160px] truncate" title={t.projectName}>{t.projectName}</TableCell>
                                    <TableCell className="text-sm">
                                      <Badge variant="outline">{t.roleLabel}</Badge>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground max-w-[160px] truncate">
                                      {t.assignees.length > 0 ? t.assignees.join(', ') : '—'}
                                    </TableCell>
                                    <TableCell>
                                      <Badge className={statusClass(t.status)}>{BRIEF_STATUS_META[t.status].label}</Badge>
                                    </TableCell>
                                    <TableCell className="text-sm">
                                      {t.fechaAccion ? (
                                        urg ? (
                                          <Badge variant="outline" className={`border-0 ${urg.className}`}>
                                            {formatFechaCorta(t.fechaAccion)} · {urg.etiqueta}
                                          </Badge>
                                        ) : formatFechaCorta(t.fechaAccion)
                                      ) : '—'}
                                    </TableCell>
                                  </TableRow>
                                );
                              })
                            )}
                          </TableBody>
                        </Table>
                      </div>
                      <div className="flex items-center justify-between pt-4 mt-4 border-t">
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-muted-foreground">Registros por página:</span>
                          <Select value={String(itemsPerPage)} onValueChange={(v) => { setItemsPerPage(Number(v)); setAllTasksPage(1); }}>
                            <SelectTrigger className="w-[70px] h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {PAGE_SIZE_OPTIONS.map(n => (
                                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <span className="text-sm text-muted-foreground">
                            Página {allTasksPage} de {totalPages} ({filteredTasks.length} tareas)
                          </span>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="outline" size="sm" disabled={allTasksPage <= 1} onClick={() => setAllTasksPage(p => p - 1)}>
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm" disabled={allTasksPage >= totalPages} onClick={() => setAllTasksPage(p => p + 1)}>
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Por rol ─── */}
          <TabsContent value="byRole">
            <Card>
              <CardContent className="pt-6">
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Rol</TableHead>
                        <TableHead className="text-center">Total</TableHead>
                        <TableHead className="text-center">Pendientes</TableHead>
                        <TableHead className="text-center">En revisión</TableHead>
                        <TableHead className="text-center">Completadas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {byRole.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            No hay tareas que coincidan con los filtros
                          </TableCell>
                        </TableRow>
                      ) : (
                        byRole.map((r) => (
                          <TableRow key={r.role}>
                            <TableCell className="font-medium">
                              <Badge variant="outline">{r.role}</Badge>
                            </TableCell>
                            <TableCell className="text-center font-semibold">{r.total}</TableCell>
                            <TableCell className="text-center">{r.pending}</TableCell>
                            <TableCell className="text-center">{r.in_review}</TableCell>
                            <TableCell className="text-center">{r.completed}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Por usuario ─── */}
          <TabsContent value="byUser">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Carga por usuario
                  <span className="text-muted-foreground font-normal ml-2 text-sm">
                    (según su rol o su participación como miembro del equipo)
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Usuario</TableHead>
                        <TableHead className="text-center">Total</TableHead>
                        <TableHead className="text-center">Pendientes</TableHead>
                        <TableHead className="text-center">En revisión</TableHead>
                        <TableHead className="text-center">Completadas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {byUser.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            No hay tareas atribuibles a usuarios con los filtros actuales
                          </TableCell>
                        </TableRow>
                      ) : (
                        byUser.map((u) => (
                          <TableRow key={u.id}>
                            <TableCell className="font-medium">{u.name}</TableCell>
                            <TableCell className="text-center font-semibold">{u.total}</TableCell>
                            <TableCell className="text-center">{u.pending}</TableCell>
                            <TableCell className="text-center">{u.in_review}</TableCell>
                            <TableCell className="text-center">{u.completed}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default ReportsPage;
