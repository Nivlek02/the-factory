import { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Task, TaskStatus, STATUS_ORDER, STATUS_ORDER_COPYS, BOARDS, BoardType } from '@/types';
import { useAuthStore } from '@/store/authStore';
import Layout from '@/components/layout/Layout';
import TaskColumn from '@/components/task/TaskColumn';
import TaskDetailModal from '@/components/task/TaskDetailModal';
import CreateTaskModal from '@/components/task/CreateTaskModal';
import { Palette, PenTool, Share2, Search, CalendarIcon, X, Loader2, UserCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSupabaseTasks } from '@/hooks/useSupabaseTasks';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const BoardPage = () => {
  const { boardId } = useParams<{ boardId: string }>();
  const [searchParams] = useSearchParams();
  const board = BOARDS.find((b) => b.id === boardId) || BOARDS[0];
  const { currentUser } = useAuthStore();
  const { tasks, loading, deleteTask, updateTaskStatus, refreshTasks } = useSupabaseTasks(board.id as BoardType);
  
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState<{ from?: Date; to?: Date }>({});
  const [creatorFilter, setCreatorFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<TaskStatus | null>(null);

  // Open task from URL parameter
  useEffect(() => {
    const taskId = searchParams.get('task');
    if (taskId && tasks.length > 0) {
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        setSelectedTask(task);
        setIsDetailOpen(true);
      }
    }
  }, [searchParams, tasks]);

  // Get unique creators for filter
  const uniqueCreators = useMemo(() => {
    const creators = [...new Set(tasks.map(t => t.creatorName))].sort();
    return creators;
  }, [tasks]);

  const normalize = (str: string) =>
    str.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  const boardTasks = tasks.filter((t) => {
    // Search filter
    if (searchQuery) {
      const q = normalize(searchQuery);
      const matchesSearch =
        normalize(t.title).includes(q) ||
        normalize(t.description).includes(q) ||
        normalize(t.creatorName).includes(q);
      if (!matchesSearch) return false;
    }
    // Creator filter
    if (creatorFilter !== 'all' && t.creatorName !== creatorFilter) return false;
    // Date filter
    if (dateFilter.from || dateFilter.to) {
      const taskDate = t.dueDate ? new Date(t.dueDate) : new Date(t.createdAt);
      if (dateFilter.from && taskDate < dateFilter.from) return false;
      if (dateFilter.to) {
        const endOfDay = new Date(dateFilter.to);
        endOfDay.setHours(23, 59, 59, 999);
        if (taskDate > endOfDay) return false;
      }
    }
    return true;
  });

  const getTasksByStatus = (status: TaskStatus) => {
    // Show drafts alongside pending tasks (only to the creator)
    if (status === 'pending') {
      return boardTasks.filter((t) => t.status === status || (t.status === 'draft' && t.creatorName === currentUser?.fullName));
    }
    return boardTasks.filter((t) => t.status === status);
  };

  const [editingDraft, setEditingDraft] = useState<Task | null>(null);

  const handleTaskClick = (task: Task) => {
    if (task.status === 'draft') {
      setEditingDraft(task);
      setIsCreateOpen(true);
      return;
    }
    setSelectedTask(task);
    setIsDetailOpen(true);
  };

  const handleDeleteTask = (taskId: string) => {
    setTaskToDelete(taskId);
  };

  const confirmDeleteTask = async () => {
    if (taskToDelete) {
      await deleteTask(taskToDelete);
      toast.success('Tarea eliminada correctamente');
      setTaskToDelete(null);
    }
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setDragOverStatus(null);
  };

  const handleDragOver = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    setDragOverStatus(status);
  };

  const handleDrop = async (e: React.DragEvent, newStatus: TaskStatus) => {
    e.preventDefault();
    if (draggedTaskId && currentUser) {
      await updateTaskStatus(draggedTaskId, newStatus, currentUser);
    }
    setDraggedTaskId(null);
    setDragOverStatus(null);
  };

  // Use different status order for copys board
  const statusOrder = useMemo(() => {
    return board.id === 'copys' ? STATUS_ORDER_COPYS : STATUS_ORDER;
  }, [board.id]);

  const getBoardIcon = () => {
    switch (board.id) {
      case 'design':
        return <Palette className="h-6 w-6 text-board-design" />;
      case 'copys':
        return <PenTool className="h-6 w-6 text-board-copys" />;
      case 'social_media':
        return <Share2 className="h-6 w-6 text-board-social" />;
      case 'seo':
        return <Search className="h-6 w-6 text-board-seo" />;
      default:
        return null;
    }
  };

  const clearDateFilter = () => {
    setDateFilter({});
  };

  const currentTask = selectedTask ? tasks.find((t) => t.id === selectedTask.id) || null : null;
  const hasDateFilter = dateFilter.from || dateFilter.to;

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 lg:p-5 animate-fade-in">
        <div className="mb-4">
          <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
            <div className="flex items-center gap-3">
              {getBoardIcon()}
              <h1 className="text-2xl font-bold text-foreground">{board.name}</h1>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              {/* Search bar */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  type="text"
                  placeholder="Buscar tareas..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 pr-8 text-sm w-[200px]"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Creator filter */}
              <Select value={creatorFilter} onValueChange={setCreatorFilter}>
                <SelectTrigger className="w-auto min-w-[140px] h-8 text-sm gap-2">
                  <UserCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="Creador" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {uniqueCreators.map((creator) => (
                    <SelectItem key={creator} value={creator}>{creator}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant={hasDateFilter ? "default" : "outline"} size="sm" className="gap-2 h-8">
                    <CalendarIcon className="h-4 w-4" />
                    {hasDateFilter ? (
                      <span className="text-xs">
                        {dateFilter.from && format(dateFilter.from, 'd MMM', { locale: es })}
                        {dateFilter.from && dateFilter.to && ' - '}
                        {dateFilter.to && format(dateFilter.to, 'd MMM', { locale: es })}
                      </span>
                    ) : (
                      <span>Fecha</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="range"
                    selected={{ from: dateFilter.from, to: dateFilter.to }}
                    onSelect={(range) => setDateFilter({ from: range?.from, to: range?.to })}
                    locale={es}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
              
              {hasDateFilter && (
                <Button variant="ghost" size="sm" onClick={clearDateFilter} className="h-8 w-8 p-0">
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          <p className="text-muted-foreground">{board.description}</p>
        </div>

        <div
          className="grid gap-3 pb-2"
          style={{ gridTemplateColumns: `repeat(${statusOrder.length}, 1fr)` }}
        >
          {statusOrder.map((status) => (
            <TaskColumn
              key={status}
              status={status}
              tasks={getTasksByStatus(status)}
              onTaskClick={handleTaskClick}
              onDeleteTask={handleDeleteTask}
              onAddTask={status === 'pending' ? () => setIsCreateOpen(true) : undefined}
              showThumbnail={board.id === 'design' || board.id === 'social_media' || board.id === 'seo'}
              onDragOver={(e) => handleDragOver(e, status)}
              onDrop={handleDrop}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              isDragOver={dragOverStatus === status}
            />
          ))}
        </div>
      </div>

      <AlertDialog open={!!taskToDelete} onOpenChange={() => setTaskToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar tarea?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La tarea será eliminada permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteTask} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TaskDetailModal
        task={currentTask}
        open={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedTask(null);
        }}
        onTaskUpdated={refreshTasks}
      />

      <CreateTaskModal
        open={isCreateOpen}
        onClose={() => { setIsCreateOpen(false); setEditingDraft(null); }}
        board={board.id as BoardType}
        onTaskCreated={refreshTasks}
        editingDraft={editingDraft}
      />
    </Layout>
  );
};

export default BoardPage;
