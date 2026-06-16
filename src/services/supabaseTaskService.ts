import { supabase } from '@/integrations/supabase/client';
import { Task, TaskStatus, BoardType, Role, Comment, HistoryEntry, Attachment } from '@/types';
import type { Json } from '@/integrations/supabase/types';

// Convert database task to app Task type
const mapDbTaskToTask = (dbTask: any): Task => ({
  id: dbTask.id,
  taskNumber: dbTask.task_number ?? null,
  title: dbTask.title,
  description: dbTask.description || '',
  board: dbTask.board as BoardType,
  status: dbTask.status as TaskStatus,
  priority: dbTask.priority || null,
  dueDate: dbTask.due_date ? new Date(dbTask.due_date) : undefined,
  createdAt: new Date(dbTask.created_at),
  creatorId: dbTask.created_by,
  creatorName: dbTask.created_by,
  assignedRole: dbTask.assigned_to as Role,
  assignedToName: dbTask.assigned_to_name || null,
  reopenedCount: dbTask.reopened_count,
  comments: [],
  history: (dbTask.history as unknown as HistoryEntry[]) || [],
  attachments: (dbTask.attachments as unknown as Attachment[]) || [],
  folderUrl: dbTask.folder_url || null,
  thumbnailUrl: dbTask.thumbnail_url || null,
});

export const fetchTasks = async (): Promise<Task[]> => {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching tasks:', error);
    throw error;
  }

  // Fetch comments for all tasks
  const { data: comments, error: commentsError } = await supabase
    .from('task_comments')
    .select('*')
    .order('created_at', { ascending: true });

  if (commentsError) {
    console.error('Error fetching comments:', commentsError);
  }

  const tasks = (data || []).map(mapDbTaskToTask);
  
  // Attach comments to their respective tasks
  if (comments) {
    tasks.forEach(task => {
      task.comments = comments
        .filter(c => c.task_id === task.id)
        .map(c => ({
          id: c.id,
          taskId: c.task_id,
          userId: (c as any).user_id ?? '',
          userName: c.author,
          content: c.content,
          isAdjustmentRequest: c.is_adjustment_request,
          createdAt: new Date(c.created_at),
        }));
    });
  }

  return tasks;
};

export const fetchTasksByBoard = async (board: BoardType): Promise<Task[]> => {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('board', board)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching tasks by board:', error);
    throw error;
  }

  // Fetch comments for these tasks
  const taskIds = (data || []).map(t => t.id);
  const { data: comments } = await supabase
    .from('task_comments')
    .select('*')
    .in('task_id', taskIds)
    .order('created_at', { ascending: true });

  const tasks = (data || []).map(mapDbTaskToTask);
  
  if (comments) {
    tasks.forEach(task => {
      task.comments = comments
        .filter(c => c.task_id === task.id)
        .map(c => ({
          id: c.id,
          taskId: c.task_id,
          userId: (c as any).user_id ?? '',
          userName: c.author,
          content: c.content,
          isAdjustmentRequest: c.is_adjustment_request,
          createdAt: new Date(c.created_at),
        }));
    });
  }

  return tasks;
};


export const createTask = async (
  task: Omit<Task, 'id' | 'createdAt' | 'reopenedCount' | 'comments' | 'history'> & { attachments?: Attachment[] }
): Promise<Task> => {
  const historyEntry = {
    id: crypto.randomUUID(),
    taskId: '',
    action: 'Tarea creada',
    userId: task.creatorId,
    userName: task.creatorName,
    createdAt: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      title: task.title,
      description: task.description || '',
      board: task.board,
      status: task.status,
      priority: task.priority,
      due_date: task.dueDate?.toISOString() || null,
      created_by: task.creatorName,
      assigned_to: task.assignedRole,
      assigned_to_name: task.assignedToName || null,
      reopened_count: 0,
      attachments: (task.attachments || []) as unknown as Json,
      history: [historyEntry] as unknown as Json,
      folder_url: task.folderUrl || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating task:', error);
    throw error;
  }

  return mapDbTaskToTask(data);
};

export const updateTaskStatus = async (
  taskId: string,
  newStatus: TaskStatus,
  currentUser: { id: string; name: string },
  previousStatus: TaskStatus
): Promise<void> => {
  // First get the current task to update history
  const { data: currentTask, error: fetchError } = await supabase
    .from('tasks')
    .select('history, reopened_count')
    .eq('id', taskId)
    .single();

  if (fetchError) {
    console.error('Error fetching task:', fetchError);
    throw fetchError;
  }

  const historyEntry = {
    id: crypto.randomUUID(),
    taskId,
    action: 'Estado cambiado',
    userId: currentUser.id,
    userName: currentUser.name,
    previousStatus,
    newStatus,
    createdAt: new Date().toISOString(),
  };

  const existingHistory = (currentTask?.history as unknown as any[]) || [];
  const updatedHistory = [...existingHistory, historyEntry];

  const { error } = await supabase
    .from('tasks')
    .update({
      status: newStatus,
      history: updatedHistory as unknown as Json,
    })
    .eq('id', taskId);

  if (error) {
    console.error('Error updating task status:', error);
    throw error;
  }
};

export const addComment = async (
  taskId: string,
  content: string,
  isAdjustmentRequest: boolean,
  currentUser: { id: string; name: string }
): Promise<Comment> => {
  const { data, error } = await supabase
    .from('task_comments')
    .insert({
      task_id: taskId,
      author: currentUser.name,
      content,
      is_adjustment_request: isAdjustmentRequest,
    })
    .select()
    .single();

  if (error) {
    console.error('Error adding comment:', error);
    throw error;
  }

  // If it's an adjustment request, update the task status and reopened count
  if (isAdjustmentRequest) {
    const { data: currentTask, error: fetchError } = await supabase
      .from('tasks')
      .select('history, reopened_count, status')
      .eq('id', taskId)
      .single();

    if (!fetchError && currentTask) {
      const historyEntry = {
        id: crypto.randomUUID(),
        taskId,
        action: `Tarea vuelta a Pendiente por solicitud de ajuste de ${currentUser.name}`,
        userId: currentUser.id,
        userName: currentUser.name,
        previousStatus: currentTask.status,
        newStatus: 'pending',
        createdAt: new Date().toISOString(),
      };

      const existingHistory = (currentTask.history as unknown as any[]) || [];

      await supabase
        .from('tasks')
        .update({
          status: 'pending',
          reopened_count: (currentTask.reopened_count || 0) + 1,
          history: [...existingHistory, historyEntry] as unknown as Json,
        })
        .eq('id', taskId);
    }
  }

  return {
    id: data.id,
    taskId: data.task_id,
    userId: currentUser.id,
    userName: currentUser.name,
    content: data.content,
    isAdjustmentRequest: data.is_adjustment_request,
    createdAt: new Date(data.created_at),
  };
};

export const deleteComment = async (commentId: string): Promise<void> => {
  const { error } = await supabase
    .from('task_comments')
    .delete()
    .eq('id', commentId);

  if (error) {
    console.error('Error deleting comment:', error);
    throw error;
  }
};

export const updateComment = async (
  commentId: string,
  content: string,
  userFullName: string
): Promise<void> => {
  const { data: existing, error: fetchError } = await supabase
    .from('task_comments')
    .select('author, created_at')
    .eq('id', commentId)
    .single();

  if (fetchError || !existing) throw new Error('Comentario no encontrado');

  if (existing.author !== userFullName) {
    throw new Error('No puedes editar comentarios de otros usuarios');
  }

  const minutesElapsed = (Date.now() - new Date(existing.created_at).getTime()) / 60000;
  if (minutesElapsed > 10) {
    throw new Error('Este comentario ya no puede editarse porque superó el límite de 10 minutos');
  }

  const { error } = await supabase
    .from('task_comments')
    .update({ content })
    .eq('id', commentId);

  if (error) {
    console.error('Error updating comment:', error);
    throw error;
  }
};

export const deleteTask = async (taskId: string): Promise<void> => {
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId);

  if (error) {
    console.error('Error deleting task:', error);
    throw error;
  }
};

export const updateTask = async (taskId: string, updates: Partial<Task>): Promise<void> => {
  const dbUpdates: any = {};
  
  if (updates.title !== undefined) dbUpdates.title = updates.title;
  if (updates.description !== undefined) dbUpdates.description = updates.description;
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
  if (updates.assignedRole !== undefined) dbUpdates.assigned_to = updates.assignedRole;
  if (updates.assignedToName !== undefined) dbUpdates.assigned_to_name = updates.assignedToName || null;
  if (updates.dueDate !== undefined) dbUpdates.due_date = updates.dueDate?.toISOString() || null;
  if (updates.reopenedCount !== undefined) dbUpdates.reopened_count = updates.reopenedCount;
  if (updates.attachments !== undefined) dbUpdates.attachments = updates.attachments as unknown as Json;
  if (updates.history !== undefined) dbUpdates.history = updates.history as unknown as Json;
  if (updates.folderUrl !== undefined) dbUpdates.folder_url = updates.folderUrl || null;
  if (updates.thumbnailUrl !== undefined) dbUpdates.thumbnail_url = updates.thumbnailUrl || null;

  const { error } = await supabase
    .from('tasks')
    .update(dbUpdates)
    .eq('id', taskId);

  if (error) {
    console.error('Error updating task:', error);
    throw error;
  }
};

// Subscribe to realtime changes (tasks + comments)
export const subscribeToTasks = (
  onInsert: (task: Task) => void,
  onUpdate: (task: Task) => void,
  onDelete: (taskId: string) => void,
  onCommentChange?: (taskId: string) => void
) => {
  const channel = supabase
    .channel('tasks-changes')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'tasks' },
      (payload) => {
        onInsert(mapDbTaskToTask(payload.new));
      }
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'tasks' },
      (payload) => {
        onUpdate(mapDbTaskToTask(payload.new));
      }
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'tasks' },
      (payload) => {
        onDelete((payload.old as any).id);
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'task_comments' },
      (payload) => {
        const taskId = (payload.new as any)?.task_id || (payload.old as any)?.task_id;
        if (taskId && onCommentChange) {
          onCommentChange(taskId);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};
