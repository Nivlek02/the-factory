import { useState, useEffect } from 'react';
import { Task, ROLES, STATUSES, TaskStatus, STATUS_ORDER, STATUS_ORDER_COPYS, Attachment, PRIORITIES, TaskPriority } from '@/types';
import { useAuthStore } from '@/store/authStore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar, Clock, User, MessageSquare, History, RotateCcw, AlertTriangle, Send, Paperclip, FileText, ExternalLink, Trash2, CheckCircle, Pencil, Save, X, FolderOpen, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import RichTextEditor from '@/components/ui/rich-text-editor';
import FileUpload from '@/components/ui/file-upload';
import { toast } from 'sonner';
import { sendTaskNotification } from '@/services/notificationService';
import * as taskService from '@/services/supabaseTaskService';
import { extractUrlFromPaste, getShortUrlLabel } from '@/lib/urlUtils';

interface TaskDetailModalProps {
  task: Task | null;
  open: boolean;
  onClose: () => void;
  onTaskUpdated?: () => void;
}

const TaskDetailModal = ({ task, open, onClose, onTaskUpdated }: TaskDetailModalProps) => {
  const [comment, setComment] = useState('');
  const [responseAttachments, setResponseAttachments] = useState<Attachment[]>([]);
  const [isAdjustmentRequest, setIsAdjustmentRequest] = useState(false);
  const [markAsComplete, setMarkAsComplete] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editedDescription, setEditedDescription] = useState('');
  const [editAttachments, setEditAttachments] = useState<Attachment[]>([]);
  const [folderUrl, setFolderUrl] = useState('');
  const [isEditingFolder, setIsEditingFolder] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentContent, setEditingCommentContent] = useState('');
  const [isReplyOpen, setIsReplyOpen] = useState(false);
  const { currentUser, users } = useAuthStore();

  // Reset reply form when modal closes or task changes
  useEffect(() => {
    if (!open) {
      setIsReplyOpen(false);
      setComment('');
      setResponseAttachments([]);
      setIsAdjustmentRequest(false);
      setMarkAsComplete(false);
    }
  }, [open]);

  const isCommentEditable = (c: { userId: string; userName: string; createdAt: Date }) => {
    if (!currentUser) return false;
    const isOwner = c.userId
      ? c.userId === currentUser.userId
      : c.userName === currentUser.fullName;
    if (!isOwner) return false;
    return (Date.now() - new Date(c.createdAt).getTime()) / 60000 <= 10;
  };

  if (!task) return null;

  // El acceso a tableros ya no se restringe por rol — el rol es solo informativo.
  const isDesignerOrCopy = false;
  const isMercadeo = true;
  const isCopysBoard = task.board === 'copys';
  const isTaskAssignee = !!currentUser?.fullName && !!task.assignedToName &&
    currentUser.fullName.trim().toLowerCase() === task.assignedToName.trim().toLowerCase();
  const canTriggerReviewNotification = isDesignerOrCopy || isTaskAssignee;
  const statusOrder = isCopysBoard ? STATUS_ORDER_COPYS : STATUS_ORDER;

  const handleStatusChange = async (newStatus: TaskStatus) => {
    if (!currentUser) return;
    
    // For copys board, only mercadeo can mark as completed
    if (isCopysBoard && newStatus === 'completed' && !isMercadeo) {
      toast.error('Solo el equipo de mercadeo puede marcar tareas como completadas');
      return;
    }
    
    const previousStatus = task.status;
    
    try {
      await taskService.updateTaskStatus(task.id, newStatus, { id: currentUser.userId, name: currentUser.fullName }, previousStatus);

      const isTransitionToReview = previousStatus !== 'in_review' && newStatus === 'in_review';
      if (isTransitionToReview) {
        await sendTaskNotification('task.in_review', { ...task, status: newStatus });
      }
 
      onTaskUpdated?.();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Error al actualizar el estado');
    }
  };

  const handleDeleteTask = async () => {
    if (!task) return;
    
    try {
      await taskService.deleteTask(task.id);
      toast.success('Tarea eliminada correctamente');
      setShowDeleteDialog(false);
      onTaskUpdated?.();
      onClose();
    } catch (error) {
      console.error('Error deleting task:', error);
      toast.error('Error al eliminar la tarea');
    }
  };

  const handleAddComment = async () => {
    const hasContent = comment.trim() || comment.includes('<') || responseAttachments.length > 0;
    if (!hasContent) return;
    if (!currentUser) return;
    
    try {
      // If there are attachments, update the task with them first
      if (responseAttachments.length > 0) {
        const currentAttachments = task.attachments || [];
        await taskService.updateTask(task.id, {
          attachments: [...currentAttachments, ...responseAttachments]
        });
      }

      // Add comment if there's text
      if (comment.trim() || comment.includes('<')) {
        await taskService.addComment(task.id, comment, isAdjustmentRequest, { id: currentUser.userId, name: currentUser.fullName });
        
        // Send notification for adjustment request
        if (isAdjustmentRequest) {
          await sendTaskNotification('task.adjustment', { ...task, status: 'pending' }, comment);
        }
      }
      
      if (markAsComplete && canTriggerReviewNotification && task.status !== 'in_review') {
        const newStatus = 'in_review';
        await taskService.updateTaskStatus(task.id, newStatus as TaskStatus, { id: currentUser.userId, name: currentUser.fullName }, task.status);
        
        // Notify when task goes to review
        await sendTaskNotification('task.in_review', { ...task, status: newStatus as TaskStatus });
        toast.success(isCopysBoard ? 'Tarea enviada a revisión' : 'Tarea enviada a revisión');
      }
      
      setComment('');
      setResponseAttachments([]);
      setIsAdjustmentRequest(false);
      setMarkAsComplete(false);
      onTaskUpdated?.();
      toast.success('Respuesta enviada');
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error('Error al agregar el comentario');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-status-pending-bg text-status-pending border-status-pending/20';
      case 'in_progress':
        return 'bg-status-progress-bg text-status-progress border-status-progress/20';
      case 'in_review':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'completed':
        return 'bg-status-completed-bg text-status-completed border-status-completed/20';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  // Check if user can change status
  const canChangeStatus = (newStatus: TaskStatus) => {
    if (isCopysBoard && newStatus === 'completed' && !isMercadeo) {
      return false;
    }
    return true;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              {task.taskNumber && (
                <p className="text-xs font-mono text-muted-foreground mb-1">#{task.taskNumber}</p>
              )}
              <DialogTitle className="text-xl font-semibold mb-2">{task.title}</DialogTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={cn("border", getStatusColor(task.status))}>
                  {STATUSES[task.status]}
                </Badge>
                <Badge variant="outline" className="text-muted-foreground">
                  {ROLES[task.assignedRole]}
                </Badge>
                {task.reopenedCount > 0 && (
                  <Badge variant="destructive" className="flex items-center gap-1">
                    <RotateCcw className="h-3 w-3" />
                    Reabierta {task.reopenedCount} {task.reopenedCount === 1 ? 'vez' : 'veces'}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent">
              <TabsTrigger
                value="details"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
              >
                Detalles
              </TabsTrigger>
              <TabsTrigger
                value="comments"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent flex items-center gap-2"
              >
                <MessageSquare className="h-4 w-4" />
                Respuestas ({task.comments.length})
              </TabsTrigger>
              <TabsTrigger
                value="attachments"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent flex items-center gap-2"
              >
                <Paperclip className="h-4 w-4" />
                Adjuntos ({task.attachments?.length || 0})
              </TabsTrigger>
              <TabsTrigger
                value="history"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent flex items-center gap-2"
              >
                <History className="h-4 w-4" />
                Historial
              </TabsTrigger>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-1.5"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="h-4 w-4" />
                Eliminar
              </Button>
            </TabsList>

            <TabsContent value="details" className="mt-4 space-y-6">
              {/* Description */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-foreground">Descripción</h4>
                  {isMercadeo && !isEditingDescription && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-muted-foreground hover:text-primary"
                      onClick={() => {
                        setEditedDescription(task.description || '');
                        setEditAttachments(task.attachments || []);
                        setIsEditingDescription(true);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1" />
                      Editar
                    </Button>
                  )}
                </div>
                {isEditingDescription ? (
                  <div className="space-y-3">
                    <RichTextEditor
                      content={editedDescription}
                      onChange={setEditedDescription}
                      placeholder="Escribe la descripción de la tarea..."
                    />
                    
                    {/* File upload for Mercadeo when editing */}
                    <div>
                      <h5 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                        <Paperclip className="h-4 w-4 text-muted-foreground" />
                        Archivos adjuntos
                      </h5>
                      <FileUpload
                        attachments={editAttachments}
                        onChange={setEditAttachments}
                        taskId={task.id}
                        maxFiles={10}
                      />
                    </div>
                    
                    <div className="flex items-center gap-2 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setIsEditingDescription(false);
                          setEditAttachments([]);
                        }}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        onClick={async () => {
                          try {
                            await taskService.updateTask(task.id, { 
                              description: editedDescription,
                              attachments: editAttachments
                            });
                            setIsEditingDescription(false);
                            setEditAttachments([]);
                            onTaskUpdated?.();
                            toast.success('Tarea actualizada');
                          } catch (error) {
                            console.error('Error updating task:', error);
                            toast.error('Error al actualizar la tarea');
                          }
                        }}
                      >
                        <Save className="h-4 w-4 mr-1" />
                        Guardar
                      </Button>
                    </div>
                  </div>
                ) : task.description ? (
                  <div 
                    className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-4 prose prose-sm max-w-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_a]:text-primary [&_a]:underline [&_a]:hover:text-primary/80"
                    dangerouslySetInnerHTML={{ __html: task.description }}
                    onClick={(e) => {
                      // Open links in new tab when clicking
                      const target = e.target as HTMLElement;
                      if (target.tagName === 'A') {
                        e.preventDefault();
                        const href = target.getAttribute('href');
                        if (href) window.open(href, '_blank', 'noopener,noreferrer');
                      }
                    }}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-4">
                    Sin descripción
                  </p>
                )}
               </div>

              {/* Folder URL */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                    <FolderOpen className="h-4 w-4 text-muted-foreground" />
                    Carpeta de archivos
                  </h4>
                  {isMercadeo && !isEditingFolder && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-muted-foreground hover:text-primary"
                      onClick={() => {
                        setFolderUrl(task.folderUrl || '');
                        setIsEditingFolder(true);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1" />
                      {task.folderUrl ? 'Editar' : 'Agregar'}
                    </Button>
                  )}
                </div>
                {isEditingFolder ? (
                  <div className="space-y-2">
                    <input
                      type="url"
                      value={folderUrl}
                      onChange={(e) => setFolderUrl(e.target.value)}
                      onPaste={(e) => {
                        const url = extractUrlFromPaste(e.clipboardData);
                        if (url) {
                          e.preventDefault();
                          setFolderUrl(url);
                        }
                      }}
                      placeholder="Pega aquí el enlace de la carpeta..."
                      className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <div className="flex items-center gap-2 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsEditingFolder(false)}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        onClick={async () => {
                          try {
                            await taskService.updateTask(task.id, { folderUrl: folderUrl.trim() || null });
                            setIsEditingFolder(false);
                            onTaskUpdated?.();
                            toast.success('Carpeta actualizada');
                          } catch (error) {
                            console.error('Error updating folder URL:', error);
                            toast.error('Error al actualizar la carpeta');
                          }
                        }}
                      >
                        <Save className="h-4 w-4 mr-1" />
                        Guardar
                      </Button>
                    </div>
                  </div>
                ) : task.folderUrl ? (
                  <a
                    href={task.folderUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary underline decoration-primary/30 hover:decoration-primary/60 transition-colors inline-flex items-center gap-1.5 bg-muted/50 rounded-lg px-4 py-2.5"
                    style={{ overflowWrap: 'anywhere', wordBreak: 'break-word', maxWidth: '100%' }}
                  >
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    {getShortUrlLabel(task.folderUrl)}
                  </a>
                ) : (
                  <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-4">
                    Sin carpeta asignada
                  </p>
                )}
              </div>

              {/* Meta info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-foreground mb-1 flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      Creado por
                    </h4>
                    <p className="text-sm text-muted-foreground">{task.creatorName}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-foreground mb-1 flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      Fecha de creación
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(task.createdAt), "d 'de' MMMM, yyyy", { locale: es })}
                    </p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-foreground mb-1 flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      Asignado a
                    </h4>
                    {(() => {
                      const canReassignDesign = task.board === 'design';
                      const canReassignSeo = task.board === 'seo';

                      if (canReassignDesign) {
                        const boardUsers = users;
                        return (
                          <Select
                            value={task.assignedToName || 'unassigned'}
                            onValueChange={async (value) => {
                              try {
                                const isUnassigned = value === 'unassigned';
                                const selectedUser = isUnassigned ? null : boardUsers.find(u => u.fullName === value);
                                let newRole: string = 'unassigned';
                                if (!isUnassigned && selectedUser) {
                                  const idx = boardUsers.findIndex(u => u.userId === selectedUser.userId);
                                  newRole = idx <= 0 ? 'designer_1' : 'designer_2';
                                }
                                await taskService.updateTask(task.id, {
                                  assignedRole: newRole as any,
                                  assignedToName: isUnassigned ? null : selectedUser?.fullName || null,
                                });
                                onTaskUpdated?.();
                                toast.success(isUnassigned ? 'Tarea desasignada' : `Tarea asignada a ${selectedUser?.fullName}`);
                                if (!isUnassigned && selectedUser) {
                                  await sendTaskNotification('task.created', { ...task, assignedToName: selectedUser.fullName });
                                }
                              } catch (error) {
                                console.error('Error reassigning task:', error);
                                toast.error('Error al reasignar la tarea');
                              }
                            }}
                          >
                            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unassigned">Sin asignar</SelectItem>
                              {boardUsers.map((user) => (
                                <SelectItem key={user.userId} value={user.fullName}>{user.fullName}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        );
                      }
                      
                      if (canReassignSeo) {
                        const boardUsers = users;
                        return (
                          <Select
                            value={task.assignedToName || 'unassigned'}
                            onValueChange={async (value) => {
                              try {
                                const isUnassigned = value === 'unassigned';
                                const selectedUser = isUnassigned ? null : boardUsers.find(u => u.fullName === value);
                                let newRole: string = 'unassigned';
                                if (!isUnassigned && selectedUser) {
                                  const idx = boardUsers.findIndex(u => u.userId === selectedUser.userId);
                                  newRole = idx <= 0 ? 'seo_1' : 'seo_2';
                                }
                                await taskService.updateTask(task.id, {
                                  assignedRole: newRole as any,
                                  assignedToName: isUnassigned ? null : selectedUser?.fullName || null,
                                });
                                onTaskUpdated?.();
                                toast.success(isUnassigned ? 'Tarea desasignada' : `Tarea asignada a ${selectedUser?.fullName}`);
                                if (!isUnassigned && selectedUser) {
                                  await sendTaskNotification('task.created', { ...task, assignedToName: selectedUser.fullName });
                                }
                              } catch (error) {
                                console.error('Error reassigning task:', error);
                                toast.error('Error al reasignar la tarea');
                              }
                            }}
                          >
                            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unassigned">Sin asignar</SelectItem>
                              {boardUsers.map((user) => (
                                <SelectItem key={user.userId} value={user.fullName}>{user.fullName}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        );
                      }
                      
                      return (
                        <p className="text-sm text-muted-foreground">
                          {task.assignedToName || 'Sin asignar'}
                        </p>
                      );
                    })()}
                  </div>
                  {task.dueDate && (
                    <div>
                      <h4 className="text-sm font-medium text-foreground mb-1 flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        Fecha límite
                      </h4>
                      <p className={cn(
                        "text-sm",
                        new Date(task.dueDate) < new Date() && task.status !== 'completed'
                          ? "text-destructive"
                          : "text-muted-foreground"
                      )}>
                        {format(new Date(task.dueDate), "d 'de' MMMM, yyyy", { locale: es })}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Priority */}
              <div>
                <h4 className="text-sm font-medium text-foreground mb-2">Prioridad</h4>
                {isMercadeo ? (
                  <Select
                    value={task.priority ?? 'none'}
                    onValueChange={async (value) => {
                      try {
                        const newPriority = value === 'none' ? null : (value as TaskPriority);
                        await taskService.updateTask(task.id, { priority: newPriority });
                        onTaskUpdated?.();
                        toast.success('Prioridad actualizada');
                      } catch (error) {
                        console.error('Error updating priority:', error);
                        toast.error('Error al actualizar la prioridad');
                      }
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin prioridad</SelectItem>
                      {Object.entries(PRIORITIES).map(([key, { label, color }]) => (
                        <SelectItem key={key} value={key}>
                          <div className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${color}`} />
                            {label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {task.priority ? (
                      <span className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${PRIORITIES[task.priority].color}`} />
                        {PRIORITIES[task.priority].label}
                      </span>
                    ) : (
                      'Sin prioridad'
                    )}
                  </p>
                )}
              </div>

              {/* Status change */}
              <div>
                <h4 className="text-sm font-medium text-foreground mb-2">Cambiar estado</h4>
                <Select value={task.status} onValueChange={handleStatusChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOrder.map((status) => (
                      <SelectItem
                        key={status}
                        value={status}
                        disabled={!canChangeStatus(status)}
                      >
                        {STATUSES[status]}
                        {isCopysBoard && status === 'completed' && !isMercadeo && ' (Solo mercadeo)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            <TabsContent value="comments" className="mt-4 space-y-4">
              {/* Comments list - taller when reply is collapsed */}
              <div className={cn("space-y-3 overflow-y-auto scrollbar-thin", isReplyOpen ? "max-h-[220px]" : "max-h-[400px]")}>
                {task.comments.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No hay comentarios aún
                  </p>
                ) : (
                  task.comments.map((c) => (
                    <div
                      key={c.id}
                      className={cn(
                        "p-4 rounded-lg border",
                        c.isAdjustmentRequest
                          ? "bg-destructive/5 border-destructive/20"
                          : "bg-muted/50 border-border/50"
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                            {c.userName.split(' ').map(n => n[0]).join('')}
                          </div>
                          <span className="text-sm font-medium">{c.userName}</span>
                          {c.isAdjustmentRequest && (
                            <Badge variant="destructive" className="text-xs flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              Solicitud de ajuste
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(c.createdAt), "d MMM, HH:mm", { locale: es })}
                          </span>
                          {isCommentEditable(c) && editingCommentId !== c.id && (
                            <button
                              onClick={() => {
                                setEditingCommentId(c.id);
                                setEditingCommentContent(c.content);
                              }}
                              className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                              title="Editar comentario"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                await taskService.deleteComment(c.id);
                                onTaskUpdated?.();
                                toast.success('Comentario eliminado');
                              } catch (error) {
                                console.error('Error deleting comment:', error);
                                toast.error('Error al eliminar el comentario');
                              }
                            }}
                            className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                            title="Eliminar comentario"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {editingCommentId === c.id ? (
                        <div className="space-y-2 mt-2">
                          <RichTextEditor
                            content={editingCommentContent}
                            onChange={setEditingCommentContent}
                            placeholder="Edita tu comentario..."
                          />
                          <div className="flex items-center gap-2 justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingCommentId(null)}
                            >
                              <X className="h-3.5 w-3.5 mr-1" />
                              Cancelar
                            </Button>
                            <Button
                              size="sm"
                              onClick={async () => {
                                if (!currentUser) return;
                                try {
                                  await taskService.updateComment(c.id, editingCommentContent, currentUser.fullName);
                                  setEditingCommentId(null);
                                  onTaskUpdated?.();
                                  toast.success('Comentario actualizado');
                                } catch (error: any) {
                                  toast.error(error?.message || 'Error al editar el comentario');
                                }
                              }}
                            >
                              <Save className="h-3.5 w-3.5 mr-1" />
                              Guardar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div
                          className="text-sm text-foreground prose prose-sm max-w-none [&_h1]:text-base [&_h2]:text-sm [&_p]:my-0.5"
                          dangerouslySetInnerHTML={{ __html: c.content }}
                        />
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Reply section — toggled by button */}
              <div className="border-t pt-3">
                {!isReplyOpen ? (
                  <Button
                    variant="outline"
                    className="w-full gap-2 text-muted-foreground hover:text-foreground"
                    onClick={() => setIsReplyOpen(true)}
                  >
                    <MessageSquare className="h-4 w-4" />
                    Responder tarea
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-foreground">Responder tarea</h4>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground" onClick={() => setIsReplyOpen(false)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    <RichTextEditor
                      content={comment}
                      onChange={setComment}
                      placeholder="Escribe tu respuesta..."
                    />

                    <FileUpload
                      attachments={responseAttachments}
                      onChange={setResponseAttachments}
                    />

                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex flex-col gap-2">
                        {isMercadeo && (
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id="adjustment"
                              checked={isAdjustmentRequest}
                              onCheckedChange={(checked) => {
                                setIsAdjustmentRequest(checked as boolean);
                                if (checked) setMarkAsComplete(false);
                              }}
                            />
                            <label htmlFor="adjustment" className="text-sm text-muted-foreground cursor-pointer">
                              Marcar como solicitud de ajuste
                            </label>
                          </div>
                        )}

                        {canTriggerReviewNotification && task.status !== 'completed' && task.status !== 'in_review' && (
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id="markComplete"
                              checked={markAsComplete}
                              onCheckedChange={(checked) => {
                                setMarkAsComplete(checked as boolean);
                                if (checked) setIsAdjustmentRequest(false);
                              }}
                            />
                            <label htmlFor="markComplete" className="text-sm text-muted-foreground cursor-pointer flex items-center gap-1">
                              <CheckCircle className="h-4 w-4 text-green-500" />
                              {isCopysBoard ? 'Enviar a revisión' : 'Marcar como completada'}
                            </label>
                          </div>
                        )}
                      </div>

                      <Button
                        onClick={handleAddComment}
                        disabled={!comment.trim() && !comment.includes('<') && responseAttachments.length === 0}
                        size="sm"
                        className={markAsComplete ? 'bg-green-600 hover:bg-green-700' : ''}
                      >
                        <Send className="h-4 w-4 mr-2" />
                        {markAsComplete ? (isCopysBoard ? 'Enviar a revisión' : 'Completar') : 'Enviar'}
                      </Button>
                    </div>

                    {isAdjustmentRequest && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        La tarea volverá a estado "Pendiente" y se incrementará el contador de reaperturas.
                      </p>
                    )}

                    {markAsComplete && isCopysBoard && (
                      <p className="text-xs text-blue-600 flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        La tarea se moverá a "En revisión" para que mercadeo la valide.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="attachments" className="mt-4">
              {(!task.attachments || task.attachments.length === 0) ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <Paperclip className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  No hay archivos adjuntos
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {[...task.attachments]
                    .sort((a, b) => {
                      const dateA = a.uploadedAt ? new Date(a.uploadedAt).getTime() : 0;
                      const dateB = b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0;
                      return dateB - dateA;
                    })
                    .map((attachment) => (
                    <div
                      key={attachment.id}
                      className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border border-border/50 hover:bg-muted transition-colors group"
                    >
                      {attachment.type === 'image' ? (
                        <a 
                          href={attachment.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="w-12 h-12 rounded overflow-hidden bg-muted flex-shrink-0 cursor-pointer"
                        >
                          <img
                            src={attachment.url}
                            alt={attachment.name}
                            className="w-full h-full object-cover"
                          />
                        </a>
                      ) : (
                        <div className="w-12 h-12 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <FileText className="h-6 w-6 text-primary" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{attachment.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {attachment.size < 1024 * 1024
                            ? (attachment.size / 1024).toFixed(1) + ' KB'
                            : (attachment.size / (1024 * 1024)).toFixed(1) + ' MB'}
                        </p>
                        {attachment.uploadedAt && (
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(attachment.uploadedAt), "d MMM yyyy, HH:mm", { locale: es })}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <a
                          href={attachment.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded hover:bg-muted-foreground/10 text-muted-foreground hover:text-primary transition-colors"
                          title="Ver archivo"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                        <a
                          href={attachment.url}
                          download={attachment.name}
                          className="p-1.5 rounded hover:bg-muted-foreground/10 text-muted-foreground hover:text-primary transition-colors"
                          title="Descargar archivo"
                          onClick={(e) => {
                            e.preventDefault();
                            fetch(attachment.url)
                              .then(res => res.blob())
                              .then(blob => {
                                const url = window.URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = attachment.name;
                                document.body.appendChild(a);
                                a.click();
                                window.URL.revokeObjectURL(url);
                                document.body.removeChild(a);
                              })
                              .catch(() => {
                                window.open(attachment.url, '_blank');
                              });
                          }}
                        >
                          <Download className="h-4 w-4" />
                        </a>
                        <button
                          onClick={async () => {
                            try {
                              if (attachment.path) {
                                const { deleteFile } = await import('@/services/storageService');
                                await deleteFile(attachment.path);
                              }
                              const updatedAttachments = (task.attachments || []).filter(a => a.id !== attachment.id);
                              await taskService.updateTask(task.id, { attachments: updatedAttachments });
                              onTaskUpdated?.();
                              toast.success('Archivo eliminado');
                            } catch (error) {
                              console.error('Error deleting attachment:', error);
                              toast.error('Error al eliminar el archivo');
                            }
                          }}
                          className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          title="Eliminar archivo"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              <div className="space-y-3 max-h-[400px] overflow-y-auto scrollbar-thin">
                {task.history.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                    <div className="flex-1">
                      <p className="text-sm text-foreground">{entry.action}</p>
                      {entry.previousStatus && entry.newStatus && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {STATUSES[entry.previousStatus]} → {STATUSES[entry.newStatus]}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {entry.userName} • {format(new Date(entry.createdAt), "d MMM, HH:mm", { locale: es })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta tarea?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente la tarea "{task.title}" y todos sus comentarios.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTask} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
};

export default TaskDetailModal;
