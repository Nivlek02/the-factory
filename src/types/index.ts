export type TaskStatus = 'pending' | 'in_progress' | 'in_review' | 'completed' | 'draft';

export type Role = 'designer_1' | 'designer_2' | 'copy_1' | 'copy_2' | 'sm_1' | 'sm_2' | 'seo_1' | 'seo_2';

export type BoardType = 'design' | 'copys' | 'social_media' | 'seo';

export type TaskPriority = 'high' | 'medium' | null;

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

export interface Comment {
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  content: string;
  isAdjustmentRequest: boolean;
  createdAt: Date;
}

export interface HistoryEntry {
  id: string;
  taskId: string;
  action: string;
  userId: string;
  userName: string;
  previousStatus?: TaskStatus;
  newStatus?: TaskStatus;
  createdAt: Date;
}

export interface Attachment {
  id: string;
  name: string;
  type: 'image' | 'document';
  url: string;
  size: number;
  path?: string; // Storage path for deletion
  uploadedAt?: string; // ISO date string
}

export interface Task {
  id: string;
  taskNumber?: number | null;
  title: string;
  description: string;
  board: BoardType;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: Date;
  createdAt: Date;
  creatorId: string;
  creatorName: string;
  assignedRole: Role;
  assignedToName?: string | null;
  reopenedCount: number;
  comments: Comment[];
  history: HistoryEntry[];
  attachments: Attachment[];
  folderUrl?: string | null;
  thumbnailUrl?: string | null;
}

export interface Board {
  id: BoardType;
  name: string;
  color: string;
  description: string;
}

export type RoleOrUnassigned = Role | 'unassigned';

export const ROLES: Record<Role, string> = {
  designer_1: 'Diseñador 1',
  designer_2: 'Diseñador 2',
  copy_1: 'Copy 1',
  copy_2: 'Copy 2',
  sm_1: 'Manager 1',
  sm_2: 'Manager 2',
  seo_1: 'SEO 1',
  seo_2: 'SEO 2',
};

export const STATUSES: Record<TaskStatus, string> = {
  draft: 'Borrador',
  pending: 'Pendiente',
  in_progress: 'En proceso',
  in_review: 'En revisión',
  completed: 'Completadas',
};

export const STATUS_ORDER: TaskStatus[] = ['pending', 'in_progress', 'in_review', 'completed'];
export const STATUS_ORDER_COPYS: TaskStatus[] = ['pending', 'in_progress', 'in_review', 'completed'];

export const PRIORITIES: Record<string, { label: string; color: string }> = {
  high: { label: 'Alta', color: 'bg-red-500' },
  medium: { label: 'Media', color: 'bg-yellow-500' },
};

export const BOARDS: Board[] = [
  { id: 'design', name: 'Diseño', color: 'board-design', description: 'Tablero del equipo de diseño' },
  { id: 'copys', name: 'Copys', color: 'board-copys', description: 'Tablero del equipo de copys' },
  { id: 'social_media', name: 'Social Media', color: 'board-social', description: 'Tablero del equipo de Social Media' },
  { id: 'seo', name: 'SEO', color: 'board-seo', description: 'Tablero del equipo de visibilidad web' },
];

// Usuarios asignados (diseñadores y copys)
export const ASSIGNED_USERS: Record<Role, string> = {
  designer_1: 'Camila Rodriguez',
  designer_2: 'Maria Sanabria',
  copy_1: 'Camila Rodriguez',
  copy_2: 'Yeinis Zapata',
  sm_1: 'Sin asignar',
  sm_2: 'Sin asignar',
  seo_1: 'Sin asignar',
  seo_2: 'Sin asignar',
};

// Usuarios creadores (equipo de mercadeo)
export const MARKETING_USERS: User[] = [
  { id: 'marketing_1', name: 'Laura Gómez', email: 'laura@example.com' },
  { id: 'marketing_2', name: 'Carlos Pérez', email: 'carlos@example.com' },
  { id: 'marketing_3', name: 'Ana Martínez', email: 'ana@example.com' },
];

// Mantener USERS por compatibilidad
export const USERS: User[] = [
  { id: '1', name: 'Camila Rodriguez', email: 'camila@example.com' },
  { id: '2', name: 'Maria Sanabria', email: 'maria@example.com' },
  { id: '3', name: 'Yeinis Zapata', email: 'yeinis@example.com' },
];
