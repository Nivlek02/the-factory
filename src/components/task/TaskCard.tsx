import { Task, ROLES, STATUSES } from '@/types';
import { Calendar, MessageSquare, RotateCcw, User, Paperclip, Trash2, Flag, FolderOpen, ImagePlus } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { getThumbnailUrl } from '@/services/storageService';

interface TaskCardProps {
  task: Task;
  onClick: () => void;
  onDelete?: () => void;
  showThumbnail?: boolean;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
}

const TaskCard = ({ task, onClick, onDelete, showThumbnail = false, draggable = true, onDragStart, onDragEnd }: TaskCardProps) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-orange-100 text-orange-700';
      case 'pending':
        return 'bg-status-pending-bg text-status-pending';
      case 'in_progress':
        return 'bg-status-progress-bg text-status-progress';
      case 'in_review':
        return 'bg-blue-100 text-blue-700';
      case 'completed':
        return 'bg-status-completed-bg text-status-completed';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getPriorityColor = (priority: string | null) => {
    switch (priority) {
      case 'high':
        return 'text-red-500';
      case 'medium':
        return 'text-yellow-500';
      default:
        return '';
    }
  };

  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'completed';

  // Get thumbnail: use thumbnailUrl, or fall back to first image attachment
  const thumbnailUrl = task.thumbnailUrl || task.attachments?.find(a => a.type === 'image')?.url;

  const showPriority = task.priority && task.status !== 'in_review' && task.status !== 'completed';

  return (
    <div
      className={cn(
        "bg-card rounded-lg shadow-card hover:shadow-card-hover transition-all duration-200 cursor-pointer border border-border/50 overflow-hidden",
        draggable && "cursor-grab active:cursor-grabbing",
        showPriority && task.priority === 'high' && "border-l-4 border-l-red-500",
        showPriority && task.priority === 'medium' && "border-l-4 border-l-yellow-500",
        task.status === 'draft' && "border-dashed border-2 border-orange-300 opacity-80"
      )}
      onClick={onClick}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      {/* Thumbnail - only for design board */}
      {showThumbnail && (
        thumbnailUrl ? (
          <div className="w-full h-[160px] bg-muted">
            <img src={getThumbnailUrl(thumbnailUrl, 600, 50)} alt="" className="w-full h-full object-cover" loading="lazy" />
          </div>
        ) : (
          <div className="w-full h-20 bg-muted/30 flex items-center justify-center">
            <ImagePlus className="h-5 w-5 text-muted-foreground/40" />
          </div>
        )
      )}

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {showPriority && (
              <Flag className={cn("h-4 w-4 shrink-0", getPriorityColor(task.priority))} />
            )}
            <div className="min-w-0">
              {task.taskNumber && (
                <span className="text-[10px] font-mono text-muted-foreground/70 block leading-none mb-0.5">
                  #{task.taskNumber}
                </span>
              )}
              <h3 className="font-bold text-sm text-foreground line-clamp-2">{task.title}</h3>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {task.reopenedCount > 0 && (
              <div className="flex items-center gap-1 text-destructive bg-destructive/10 px-2 py-0.5 rounded-full text-xs font-medium">
                <RotateCcw className="h-3 w-3" />
                <span>{task.reopenedCount}</span>
              </div>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Meta info */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center gap-1 text-muted-foreground">
            <User className="h-3 w-3" />
            <span>{task.assignedToName || ROLES[task.assignedRole]}</span>
          </div>

          {task.dueDate && (
            <div className={cn(
              "flex items-center gap-1",
              isOverdue ? "text-destructive" : "text-muted-foreground"
            )}>
              <Calendar className="h-3 w-3" />
              <span>{format(new Date(task.dueDate), 'd MMM', { locale: es })}</span>
            </div>
          )}

          {task.comments.length > 0 && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <MessageSquare className="h-3 w-3" />
              <span>{task.comments.length}</span>
            </div>
          )}

          {task.attachments && task.attachments.length > 0 && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <Paperclip className="h-3 w-3" />
              <span>{task.attachments.length}</span>
            </div>
          )}

          {task.folderUrl && (
            <a
              href={task.folderUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-primary hover:text-primary/80 underline decoration-primary/30 hover:decoration-primary/60 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <FolderOpen className="h-3 w-3 shrink-0" />
              <span>Carpeta</span>
            </a>
          )}
        </div>

        {/* Creator */}
        <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-medium text-primary">
              {task.creatorName.split(' ').map(n => n[0]).join('')}
            </div>
            <span className="text-xs text-muted-foreground">{task.creatorName.split(' ')[0]}</span>
          </div>
          <span className={cn("text-xs px-2 py-0.5 rounded-full", getStatusColor(task.status))}>
            {STATUSES[task.status]}
          </span>
        </div>
      </div>
    </div>
  );
};

export default TaskCard;
