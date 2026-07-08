import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { BoardType, Role, ROLES, Attachment, Task, TaskPriority, PRIORITIES } from '@/types';
import { useAuthStore, AppUser } from '@/store/authStore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon, Flag, FolderOpen } from 'lucide-react';
import { extractUrlFromPaste } from '@/lib/urlUtils';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import RichTextEditor from '@/components/ui/rich-text-editor';
import FileUpload from '@/components/ui/file-upload';
import { sendTaskNotification } from '@/services/notificationService';
import * as taskService from '@/services/supabaseTaskService';

interface CreateTaskModalProps {
  open: boolean;
  onClose: () => void;
  board: BoardType;
  onTaskCreated?: () => void;
  editingDraft?: Task | null;
}

const CreateTaskModal = ({ open, onClose, board, onTaskCreated, editingDraft }: CreateTaskModalProps) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [dueDate, setDueDate] = useState<Date>();
  const [priority, setPriority] = useState<TaskPriority>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [folderUrl, setFolderUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [draftSaving, setDraftSaving] = useState(false);
  const { currentUser, users } = useAuthStore();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialized = useRef(false);
  const isDraftCreating = useRef(false);
  const sessionId = useRef('');
  const usersRef = useRef(users);
  useEffect(() => { usersRef.current = users; }, [users]);

  // Restore from editingDraft when provided
  useEffect(() => {
    if (open && editingDraft) {
      setTitle(editingDraft.title || '');
      setDescription(editingDraft.description || '');
      setPriority(editingDraft.priority || null);
      setFolderUrl(editingDraft.folderUrl || '');
      setDueDate(editingDraft.dueDate ? new Date(editingDraft.dueDate) : undefined);
      setAttachments(editingDraft.attachments || []);
      setDraftId(editingDraft.id);
      // Try to find matching user (use ref to avoid resetting form on users updates)
      if (editingDraft.assignedToName) {
        const matchingUser = usersRef.current.find(u => u.fullName === editingDraft.assignedToName);
        setSelectedUserId(matchingUser?.userId || 'unassigned');
      } else {
        setSelectedUserId((editingDraft.assignedRole as string) === 'unassigned' ? 'unassigned' : '');
      }
      sessionId.current = editingDraft.id;
      isDraftCreating.current = false;
      initialized.current = true;
    } else if (open && !editingDraft) {
      setDraftId(null);
      setTitle('');
      setDescription('');
      setSelectedUserId('');
      setDueDate(undefined);
      setPriority(null);
      setAttachments([]);
      setFolderUrl('');
      sessionId.current = `new-${Date.now()}`;
      isDraftCreating.current = false;
      initialized.current = true;
    } else {
      initialized.current = false;
    }
  }, [open, editingDraft]); // 'users' excluded: use usersRef to avoid resetting form mid-edit

  // Build assigned role (board slot) from the selected user's position in the list.
  // El rol de acceso ya no determina el tablero/slot — es solo informativo.
  const getAssignedRole = useCallback((userId: string, usersList: AppUser[]): Role | 'unassigned' => {
    if (userId === 'unassigned' || !userId) return 'unassigned';
    const idx = usersList.findIndex(u => u.userId === userId);
    if (idx === -1) return 'unassigned';
    const slotsByBoard: Record<string, [Role, Role]> = {
      design: ['designer_1', 'designer_2'],
      copys: ['copy_1', 'copy_2'],
      social_media: ['sm_1', 'sm_2'],
      seo: ['seo_1', 'seo_2'],
    };
    const [slotA, slotB] = slotsByBoard[board] ?? slotsByBoard.copys;
    return idx % 2 === 0 ? slotA : slotB;
  }, [board]);

  // Auto-save draft to DB (debounced)
  const saveDraftToDb = useCallback(async () => {
    if (!currentUser || !initialized.current) return;
    // Capture session at call time to detect stale completions
    const capturedSession = sessionId.current;

    const hasContent = title.trim() || description.trim() || folderUrl.trim() || attachments.length > 0;
    if (!hasContent) return;

    setDraftSaving(true);
    try {
      const isUnassigned = selectedUserId === 'unassigned' || !selectedUserId;
      const selectedUser = isUnassigned ? null : users.find(u => u.userId === selectedUserId);
      const assignedRole = getAssignedRole(selectedUserId, users);

      if (draftId) {
        // Update existing draft
        await taskService.updateTask(draftId, {
          title: title.trim() || 'Sin título',
          description,
          priority,
          dueDate,
          assignedRole: assignedRole as Role,
          assignedToName: isUnassigned ? null : selectedUser?.fullName || null,
          attachments,
          folderUrl: folderUrl.trim() || null,
        });
      } else if (!isDraftCreating.current) {
        // Create new draft — guard prevents concurrent creates from producing duplicates
        isDraftCreating.current = true;
        try {
          const newDraft = await taskService.createTask({
            title: title.trim() || 'Sin título',
            description,
            board,
            status: 'draft',
            priority,
            dueDate,
            creatorId: currentUser.userId,
            creatorName: currentUser.fullName,
            assignedRole: assignedRole as Role,
            assignedToName: isUnassigned ? null : selectedUser?.fullName || null,
            attachments,
            folderUrl: folderUrl.trim() || null,
          });
          // Only update draftId if still in the same modal session
          if (sessionId.current === capturedSession) {
            setDraftId(newDraft.id);
          }
        } finally {
          isDraftCreating.current = false;
        }
      }
    } catch (error) {
      console.error('Error saving draft:', error);
    } finally {
      setDraftSaving(false);
    }
  }, [title, description, selectedUserId, priority, folderUrl, dueDate, attachments, draftId, currentUser, board, users, getAssignedRole]);

  // Debounced auto-save
  useEffect(() => {
    if (!initialized.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveDraftToDb();
    }, 1500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [saveDraftToDb]);

  // El rol ya no filtra quién puede asignarse a cada tablero — todos los usuarios están disponibles.
  const availableUsers = useMemo(() => users, [users]);

  // Set default selected user when board changes or modal opens
  useEffect(() => {
    if (editingDraft) return; // Don't override when editing draft
    if (board === 'design' || board === 'social_media' || board === 'seo') {
      if (!selectedUserId) setSelectedUserId('unassigned');
    } else if (availableUsers.length > 0 && !selectedUserId) {
      setSelectedUserId(availableUsers[0].userId);
    }
  }, [availableUsers, selectedUserId, board, editingDraft]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error('El título es requerido');
      return;
    }

    if (!currentUser) {
      toast.error('Debes iniciar sesión');
      return;
    }

    setIsSubmitting(true);

    try {
      const creatorName = currentUser.fullName;
      const isUnassigned = selectedUserId === 'unassigned';
      const selectedUser = isUnassigned ? null : availableUsers.find(u => u.userId === selectedUserId);
      
      if (!isUnassigned && !selectedUser) {
        toast.error('Debes seleccionar un usuario');
        setIsSubmitting(false);
        return;
      }

      const assignedRole = getAssignedRole(selectedUserId, availableUsers);

      if (draftId) {
        // Convert draft to pending task
        await taskService.updateTask(draftId, {
          title: title.trim(),
          description,
          priority,
          dueDate,
          assignedRole: assignedRole as Role,
          assignedToName: isUnassigned ? null : selectedUser!.fullName,
          attachments,
          folderUrl: folderUrl.trim() || null,
          status: 'pending',
        });

        // Fetch the updated task for notification
        const allTasks = await taskService.fetchTasksByBoard(board);
        const createdTask = allTasks.find(t => t.id === draftId);
        if (createdTask) {
          await sendTaskNotification('task.created', createdTask);
        }
      } else {
        // Create new task directly
        const newTask = await taskService.createTask({
          title: title.trim(),
          description,
          board,
          status: 'pending',
          priority,
          dueDate,
          creatorId: currentUser.userId,
          creatorName,
          assignedRole: assignedRole as Role,
          assignedToName: isUnassigned ? null : selectedUser!.fullName,
          attachments,
          folderUrl: folderUrl.trim() || null,
        });

        await sendTaskNotification('task.created', newTask);
      }

      if (!isUnassigned && selectedUser?.email) {
        toast.success(`Notificación enviada a ${selectedUser.fullName}`);
      }

      toast.success('Tarea creada exitosamente');
      onTaskCreated?.();
      resetAndClose();
    } catch (error) {
      console.error('Error creating task:', error);
      toast.error('Error al crear la tarea');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetAndClose = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    sessionId.current = '';
    isDraftCreating.current = false;
    setTitle('');
    setDescription('');
    setSelectedUserId('');
    setDueDate(undefined);
    setPriority(null);
    setAttachments([]);
    setFolderUrl('');
    setDraftId(null);
    initialized.current = false;
    onClose();
  };

  const handleClose = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    // Force save before closing
    saveDraftToDb();
    initialized.current = false;
    onClose();
  };

  const handleDeleteDraft = async () => {
    if (draftId) {
      try {
        await taskService.deleteTask(draftId);
        onTaskCreated?.();
        toast.success('Borrador eliminado');
      } catch (error) {
        console.error('Error deleting draft:', error);
      }
    }
    resetAndClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{draftId ? 'Editar borrador' : 'Nueva tarea'}</span>
            {draftSaving && (
              <span className="text-xs font-normal text-muted-foreground italic">Guardando...</span>
            )}
            {!draftSaving && draftId && (
              <span className="text-xs font-normal text-orange-500 italic">Borrador guardado</span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              placeholder="Título de la tarea"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <RichTextEditor
              content={description}
              onChange={setDescription}
              placeholder="Describe la tarea en detalle..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Asignar a {board !== 'design' && board !== 'social_media' && board !== 'seo' && '*'}</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar usuario" />
                </SelectTrigger>
                <SelectContent>
                  {(board === 'design' || board === 'social_media' || board === 'seo') && (
                    <SelectItem value="unassigned">Sin asignar</SelectItem>
                  )}
                  {availableUsers.map((user) => (
                    <SelectItem key={user.userId} value={user.userId}>
                      {user.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Prioridad</Label>
              <Select value={priority || 'none'} onValueChange={(val) => setPriority(val === 'none' ? null : val as TaskPriority)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sin prioridad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin prioridad</SelectItem>
                  <SelectItem value="high">
                    <div className="flex items-center gap-2">
                      <Flag className="h-4 w-4 text-red-500" />
                      Alta
                    </div>
                  </SelectItem>
                  <SelectItem value="medium">
                    <div className="flex items-center gap-2">
                      <Flag className="h-4 w-4 text-yellow-500" />
                      Media
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Fecha límite</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dueDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dueDate ? format(dueDate, "d 'de' MMMM, yyyy", { locale: es }) : "Seleccionar fecha"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={setDueDate}
                  initialFocus
                  locale={es}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
              Carpeta de archivos
            </Label>
            <Input
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
              placeholder="Pega aquí el enlace de la carpeta (opcional)"
            />
          </div>

          <div className="space-y-2">
            <Label>Archivos adjuntos</Label>
            <FileUpload
              attachments={attachments}
              onChange={setAttachments}
            />
          </div>
        </div>

        <DialogFooter className="flex justify-between sm:justify-between">
          {draftId ? (
            <Button variant="ghost" size="sm" onClick={handleDeleteDraft} className="text-destructive hover:text-destructive">
              Eliminar borrador
            </Button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? 'Creando...' : 'Crear tarea'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateTaskModal;
