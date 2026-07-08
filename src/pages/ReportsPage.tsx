import { useState, useMemo } from 'react';
import { useSupabaseTasks } from '@/hooks/useSupabaseTasks';
import { Task, TaskStatus, BoardType, Role, STATUSES, BOARDS, ROLES, STATUS_ORDER } from '@/types';
import { useAuthStore } from '@/store/authStore';
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
import { CalendarIcon, Download, BarChart3, ListTodo, RotateCcw, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const PAGE_SIZE_OPTIONS = [5, 20, 50] as const;

const ReportsPage = () => {
  const { tasks, loading } = useSupabaseTasks();
  const { users } = useAuthStore();

  // El rol ya no filtra estas listas — son solo informativas.
  const designersAndCopys = users;
  const marketingUsers = users;
  
  // Filters
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
  const [boardFilter, setBoardFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [creatorFilter, setCreatorFilter] = useState<string>('all');
  const [allTasksPage, setAllTasksPage] = useState(1);
  const [reopenedPage, setReopenedPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // Date filter
      if (dateFrom && dateTo) {
        const taskDate = new Date(task.createdAt);
        if (!isWithinInterval(taskDate, { start: startOfDay(dateFrom), end: endOfDay(dateTo) })) {
          return false;
        }
      }
      
      // Board filter
      if (boardFilter !== 'all' && task.board !== boardFilter) return false;
      
      // Status filter
      if (statusFilter !== 'all' && task.status !== statusFilter) return false;
      
      // Assigned to filter (by name)
      if (roleFilter !== 'all') {
        const selectedUser = designersAndCopys.find(u => u.id === roleFilter);
        if (selectedUser && task.assignedToName !== selectedUser.fullName) return false;
      }
      
      // Creator filter (by name)
      if (creatorFilter !== 'all') {
        const selectedCreator = marketingUsers.find(u => u.id === creatorFilter);
        if (selectedCreator && task.creatorName !== selectedCreator.fullName) return false;
      }
      
      return true;
    });
  }, [tasks, dateFrom, dateTo, boardFilter, statusFilter, roleFilter, creatorFilter]);

  // Stats
  const stats = useMemo(() => {
    const byBoard = BOARDS.reduce((acc, board) => {
      acc[board.id] = filteredTasks.filter((t) => t.board === board.id).length;
      return acc;
    }, {} as Record<string, number>);

    const byStatus = STATUS_ORDER.reduce((acc, status) => {
      acc[status] = filteredTasks.filter((t) => t.status === status).length;
      return acc;
    }, {} as Record<string, number>);

    const reopenedTasks = filteredTasks.filter((t) => t.reopenedCount > 0);
    const totalReopened = reopenedTasks.reduce((sum, t) => sum + t.reopenedCount, 0);

    return { byBoard, byStatus, reopenedTasks, totalReopened };
  }, [filteredTasks]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-status-pending-bg text-status-pending';
      case 'in_progress':
        return 'bg-status-progress-bg text-status-progress';
      case 'completed':
        return 'bg-status-completed-bg text-status-completed';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const clearFilters = () => {
    setDateFrom(undefined);
    setDateTo(undefined);
    setBoardFilter('all');
    setStatusFilter('all');
    setRoleFilter('all');
    setCreatorFilter('all');
    setAllTasksPage(1);
    setReopenedPage(1);
  };

  const exportToCSV = () => {
    const headers = ['Título', 'Tablero', 'Estado', 'Rol Asignado', 'Encargado', 'Creador', 'Fecha Creación', 'Fecha Límite', 'Veces Reabierta'];
    const rows = filteredTasks.map((task) => [
      `"${task.title.replace(/"/g, '""')}"`,
      BOARDS.find((b) => b.id === task.board)?.name || '',
      STATUSES[task.status],
      ROLES[task.assignedRole],
      task.assignedToName || ROLES[task.assignedRole],
      task.creatorName,
      format(new Date(task.createdAt), 'dd/MM/yyyy'),
      task.dueDate ? format(new Date(task.dueDate), 'dd/MM/yyyy') : '',
      task.reopenedCount.toString(),
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `reporte_tareas_${format(new Date(), 'yyyy-MM-dd')}.csv`;
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
            <p className="text-muted-foreground">Analiza el rendimiento y estado de las tareas</p>
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

              {/* Board */}
              <div>
                <label className="text-sm font-medium mb-2 block">Tablero</label>
                <Select value={boardFilter} onValueChange={setBoardFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {BOARDS.map((board) => (
                      <SelectItem key={board.id} value={board.id}>{board.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status */}
              <div>
                <label className="text-sm font-medium mb-2 block">Estado</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {STATUS_ORDER.map((status) => (
                      <SelectItem key={status} value={status}>{STATUSES[status]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Asignado a - Solo diseñadores y copys */}
              <div>
                <label className="text-sm font-medium mb-2 block">Asignado a</label>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {designersAndCopys.map((user) => (
                      <SelectItem key={user.id} value={user.id}>{user.fullName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Creado por - Solo mercadeo */}
              <div>
                <label className="text-sm font-medium mb-2 block">Creado por</label>
                <Select value={creatorFilter} onValueChange={setCreatorFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {marketingUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>{user.fullName}</SelectItem>
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
                    <p className="text-sm text-muted-foreground">{STATUSES[status]}</p>
                    <p className="text-3xl font-bold">{stats.byStatus[status]}</p>
                  </div>
                  <div className={cn("w-3 h-8 rounded-full", getStatusColor(status).split(' ')[0])} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>


        {/* Tabs for Tables */}
        <Tabs defaultValue="all" className="space-y-4">
          <TabsList>
            <TabsTrigger value="all">Todas las tareas</TabsTrigger>
            <TabsTrigger value="reopened" className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4" />
              Tareas reabiertas ({stats.reopenedTasks.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <Card>
              <CardContent className="pt-6">
                {(() => {
                  const totalPages = Math.ceil(filteredTasks.length / itemsPerPage);
                  const paginated = filteredTasks.slice((allTasksPage - 1) * itemsPerPage, allTasksPage * itemsPerPage);
                  return (
                    <>
                      <div className="rounded-md border overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Título</TableHead>
                              <TableHead>Tablero</TableHead>
                              <TableHead>Estado</TableHead>
                              <TableHead>Encargado</TableHead>
                              <TableHead>Creador</TableHead>
                              <TableHead>Creación</TableHead>
                              <TableHead>Fecha límite</TableHead>
                              <TableHead className="text-center">Reabierta</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredTasks.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                  No hay tareas que coincidan con los filtros
                                </TableCell>
                              </TableRow>
                            ) : (
                              paginated.map((task) => (
                                <TableRow key={task.id}>
                                  <TableCell className="font-medium max-w-[200px] truncate">{task.title}</TableCell>
                                  <TableCell>
                                    <Badge variant="outline">
                                      {BOARDS.find((b) => b.id === task.board)?.name}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <Badge className={getStatusColor(task.status)}>
                                      {STATUSES[task.status]}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-sm">{task.assignedToName || 'Sin asignar'}</TableCell>
                                  <TableCell className="text-sm">{task.creatorName}</TableCell>
                                  <TableCell className="text-sm">
                                    {format(new Date(task.createdAt), 'd MMM yyyy', { locale: es })}
                                  </TableCell>
                                  <TableCell className="text-sm">
                                    {task.dueDate 
                                      ? format(new Date(task.dueDate), 'd MMM yyyy', { locale: es })
                                      : '-'}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {task.reopenedCount > 0 ? (
                                      <Badge variant="destructive">{task.reopenedCount}</Badge>
                                    ) : (
                                      <span className="text-muted-foreground">-</span>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                      <div className="flex items-center justify-between pt-4 mt-4 border-t">
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-muted-foreground">Registros por página:</span>
                            <Select value={String(itemsPerPage)} onValueChange={(v) => { setItemsPerPage(Number(v)); setAllTasksPage(1); setReopenedPage(1); }}>
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

          <TabsContent value="reopened">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Tareas con solicitudes de ajuste
                  <span className="text-muted-foreground font-normal ml-2">
                    (Total de reaperturas: {stats.totalReopened})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                   const totalPages = Math.ceil(stats.reopenedTasks.length / itemsPerPage);
                   const paginated = stats.reopenedTasks.slice((reopenedPage - 1) * itemsPerPage, reopenedPage * itemsPerPage);
                  return (
                    <>
                      <div className="rounded-md border overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Título</TableHead>
                              <TableHead>Tablero</TableHead>
                              <TableHead>Estado actual</TableHead>
                              <TableHead>Encargado</TableHead>
                              <TableHead className="text-center">Veces reabierta</TableHead>
                              <TableHead>Último ajuste solicitado por</TableHead>
                              <TableHead>Fecha último ajuste</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {stats.reopenedTasks.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                  No hay tareas reabiertas
                                </TableCell>
                              </TableRow>
                            ) : (
                              paginated.map((task) => {
                                const lastAdjustment = task.comments
                                  .filter((c) => c.isAdjustmentRequest)
                                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
                                
                                return (
                                  <TableRow key={task.id}>
                                    <TableCell className="font-medium max-w-[200px] truncate">{task.title}</TableCell>
                                    <TableCell>
                                      <Badge variant="outline">
                                        {BOARDS.find((b) => b.id === task.board)?.name}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>
                                      <Badge className={getStatusColor(task.status)}>
                                        {STATUSES[task.status]}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-sm">{task.assignedToName || 'Sin asignar'}</TableCell>
                                    <TableCell className="text-center">
                                      <Badge variant="destructive">{task.reopenedCount}</Badge>
                                    </TableCell>
                                    <TableCell className="text-sm">
                                      {lastAdjustment?.userName || '-'}
                                    </TableCell>
                                    <TableCell className="text-sm">
                                      {lastAdjustment 
                                        ? format(new Date(lastAdjustment.createdAt), 'd MMM yyyy, HH:mm', { locale: es })
                                        : '-'}
                                    </TableCell>
                                  </TableRow>
                                );
                              })
                            )}
                          </TableBody>
                        </Table>
                      </div>
                      {totalPages > 1 && (
                        <div className="flex items-center justify-between pt-4 mt-4 border-t">
                          <span className="text-sm text-muted-foreground">
                            Página {reopenedPage} de {totalPages} ({stats.reopenedTasks.length} tareas)
                          </span>
                          <div className="flex gap-1">
                            <Button variant="outline" size="sm" disabled={reopenedPage <= 1} onClick={() => setReopenedPage(p => p - 1)}>
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm" disabled={reopenedPage >= totalPages} onClick={() => setReopenedPage(p => p + 1)}>
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default ReportsPage;
