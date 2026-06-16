import { Task } from '@/types';
import { useAuthStore, AppUser } from '@/store/authStore';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

type TaskAction = 'tarea creada' | 'enviar a revisión' | 'solicitud de ajuste';

type NotificationEvent = 'task.created' | 'task.adjustment' | 'task.in_review';

interface NotificationPayload {
  correo_creador: string;
  nombre_creador: string;
  correo_encargado: string;
  nombre_encargado: string;
  rol_encargado: 'copy' | 'diseñador';
  accion: TaskAction;
  nota_ajuste: string;
  tarea: {
    titulo: string;
    descripcion: string;
    fecha_creacion: string;
    fecha_limite: string;
    tablero: string;
  };
}

const getActionFromEvent = (event: NotificationEvent): TaskAction => {
  switch (event) {
    case 'task.created':
      return 'tarea creada';
    case 'task.in_review':
      return 'enviar a revisión';
    case 'task.adjustment':
      return 'solicitud de ajuste';
    default:
      return 'tarea creada';
  }
};

const stripHtmlTags = (html: string): string => {
  return html.replace(/<[^>]*>/g, '').trim();
};

const resolveAssignedRole = (assignedRole: string): 'copy' | 'disenador' => {
  return assignedRole.startsWith('designer') ? 'disenador' : 'copy';
};

const ensureUsersLoaded = async (): Promise<AppUser[]> => {
  let users = useAuthStore.getState().users;
  if (users.length === 0) {
    await useAuthStore.getState().loadUsers();
    users = useAuthStore.getState().users;
  }
  return users;
};

export const sendTaskNotification = async (
  event: NotificationEvent,
  task: Task,
  adjustmentNote?: string
) => {
  try {
    // Skip notification if task is unassigned — there is no encargado to notify,
    // and the resolver fallback would otherwise mis-route to the first copy user.
    if (!task.assignedRole || (task.assignedRole as string) === 'unassigned' || !task.assignedToName) {
      console.log('NOTIFICATION_SKIPPED_UNASSIGNED', { event, taskId: task.id, boardId: task.board });
      return;
    }

    const users = await ensureUsersLoaded();

    const creator = users.find((u) => u.fullName === task.creatorName && u.role === 'mercadeo')
      || users.find((u) => u.fullName === task.creatorName);

    const requiredAssignedRole = resolveAssignedRole(task.assignedRole);
    const assignedUser = (task.assignedToName
      ? users.find((u) => u.fullName === task.assignedToName && u.role === requiredAssignedRole)
      : undefined)
      || users.find((u) => u.role === requiredAssignedRole && (!task.assignedToName || u.fullName === task.assignedToName))
      || users.find((u) => u.role === requiredAssignedRole);

    const action = getActionFromEvent(event);

    const payload: NotificationPayload = {
      correo_creador: creator?.email || 'desconocido@email.com',
      nombre_creador: creator?.fullName || task.creatorName,
      correo_encargado: assignedUser?.email || 'desconocido@email.com',
      nombre_encargado: assignedUser?.fullName || task.assignedToName || 'Sin asignar',
      rol_encargado: requiredAssignedRole === 'disenador' ? 'diseñador' : 'copy',
      accion: action,
      nota_ajuste: event === 'task.adjustment' ? stripHtmlTags(adjustmentNote || '') : '',
      tarea: {
        titulo: task.title,
        descripcion: stripHtmlTags(task.description || 'Sin descripción'),
        fecha_creacion: format(new Date(task.createdAt), "d 'de' MMMM, yyyy 'a las' HH:mm", { locale: es }),
        fecha_limite: task.dueDate
          ? format(new Date(task.dueDate), "d 'de' MMMM, yyyy", { locale: es })
          : 'Sin fecha límite',
        tablero: task.board === 'design' ? 'Diseño' : 'Copys',
      },
    };

    const { data, error } = await supabase.functions.invoke('send-notification', {
      body: {
        action,
        taskId: task.id,
        boardId: task.board,
        payload,
      },
    });

    if (error) {
      console.error('INVOKE_ERROR', {
        event,
        taskId: task.id,
        boardId: task.board,
        error,
        status: (error as any)?.context?.status || null,
      });
      return;
    }

    console.log('INVOKE_OK', {
      event,
      taskId: task.id,
      boardId: task.board,
      status: data?.status ?? null,
      data,
    });
  } catch (error) {
    console.error('INVOKE_ERROR', {
      event,
      taskId: task.id,
      boardId: task.board,
      error,
      status: null,
    });
  }
};
