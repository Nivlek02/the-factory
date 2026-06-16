import { useState, useMemo } from 'react';
import { Task, TaskStatus, STATUSES } from '@/types';
import TaskCard from './TaskCard';
import { cn } from '@/lib/utils';
import { Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface TaskColumnProps {
  status: TaskStatus;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onDeleteTask?: (taskId: string) => void;
  onAddTask?: () => void;
  showThumbnail?: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, status: TaskStatus) => void;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
  onDragEnd: (e: React.DragEvent) => void;
  isDragOver: boolean;
}

const TaskColumn = ({
  status,
  tasks,
  onTaskClick,
  onDeleteTask,
  onAddTask,
  showThumbnail,
  onDragOver,
  onDrop,
  onDragStart,
  onDragEnd,
  isDragOver,
}: TaskColumnProps) => {
  const [searchQuery, setSearchQuery] = useState('');

  const getColumnHeaderColor = (status: TaskStatus) => {
    switch (status) {
      case 'draft':
        return 'bg-orange-400';
      case 'pending':
        return 'bg-status-pending';
      case 'in_progress':
        return 'bg-status-progress';
      case 'in_review':
        return 'bg-blue-500';
      case 'completed':
        return 'bg-status-completed';
      default:
        return 'bg-muted-foreground';
    }
  };

  // Sort tasks by priority: high first, then medium, then null
  const sortedTasks = useMemo(() => {
    const priorityOrder: Record<string, number> = { high: 0, medium: 1 };
    return [...tasks].sort((a, b) => {
      const aPriority = a.priority ? priorityOrder[a.priority] : 2;
      const bPriority = b.priority ? priorityOrder[b.priority] : 2;
      return aPriority - bPriority;
    });
  }, [tasks]);

  const filteredTasks = status === 'completed' && searchQuery
    ? sortedTasks.filter((task) =>
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.creatorName.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : sortedTasks;

  return (
    <div
      className={cn(
        "min-w-0 bg-muted/50 rounded-xl p-3 transition-all duration-200",
        isDragOver && "column-drag-over bg-primary/5"
      )}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, status)}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={cn("w-3 h-3 rounded-full", getColumnHeaderColor(status))} />
          <h2 className="font-semibold text-sm text-foreground">{STATUSES[status]}</h2>
          <span className="text-xs text-muted-foreground bg-background px-2 py-0.5 rounded-full">
            {filteredTasks.length}
          </span>
        </div>
        {status === 'pending' && onAddTask && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={onAddTask}
          >
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Search bar for completed column */}
      {status === 'completed' && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar en completadas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
      )}

      {/* Tasks */}
      <div className="space-y-3 min-h-[200px] scrollbar-thin overflow-y-auto max-h-[calc(100vh-220px)]">
        {filteredTasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onClick={() => onTaskClick(task)}
            onDelete={onDeleteTask ? () => onDeleteTask(task.id) : undefined}
            showThumbnail={showThumbnail}
            onDragStart={(e) => onDragStart(e, task.id)}
            onDragEnd={onDragEnd}
          />
        ))}
        {filteredTasks.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            {searchQuery ? 'No se encontraron tareas' : 'No hay tareas'}
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskColumn;
