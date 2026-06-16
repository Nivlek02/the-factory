import { create } from 'zustand';
import { Task, TaskStatus, BoardType, Role, Comment, HistoryEntry, User, USERS, Attachment } from '@/types';

interface TaskStore {
  tasks: Task[];
  currentUser: User;
  setCurrentUser: (user: User) => void;
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'reopenedCount' | 'comments' | 'history' | 'attachments'> & { attachments?: Attachment[] }) => void;
  updateTaskStatus: (taskId: string, newStatus: TaskStatus) => void;
  addComment: (taskId: string, content: string, isAdjustmentRequest: boolean) => void;
  deleteTask: (taskId: string) => void;
  getTasksByBoard: (board: BoardType) => Task[];
  getTasksByStatus: (board: BoardType, status: TaskStatus) => Task[];
}

const generateId = () => Math.random().toString(36).substr(2, 9);

// Sample initial tasks
const initialTasks: Task[] = [
  {
    id: '1',
    title: 'Diseñar banner promocional',
    description: 'Crear un banner para la campaña de verano con dimensiones 1200x628px. Debe incluir el logo, mensaje promocional y call-to-action.',
    board: 'design',
    status: 'pending',
    priority: 'high',
    dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    creatorId: '1',
    creatorName: 'Camila Rodriguez',
    assignedRole: 'designer_1',
    reopenedCount: 0,
    comments: [],
    attachments: [],
    history: [
      {
        id: 'h1',
        taskId: '1',
        action: 'Tarea creada',
        userId: '1',
        userName: 'Camila Rodriguez',
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
    ],
  },
  {
    id: '2',
    title: 'Actualizar identidad visual',
    description: 'Revisar y actualizar los elementos de identidad visual según las nuevas guías de marca.',
    board: 'design',
    status: 'in_progress',
    priority: 'medium',
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    creatorId: '2',
    creatorName: 'Maria Sanabria',
    assignedRole: 'designer_2',
    reopenedCount: 1,
    attachments: [],
    comments: [
      {
        id: 'c1',
        taskId: '2',
        userId: '2',
        userName: 'Maria Sanabria',
        content: 'Por favor ajustar los colores según la paleta actualizada.',
        isAdjustmentRequest: true,
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      },
    ],
    history: [
      {
        id: 'h2',
        taskId: '2',
        action: 'Tarea creada',
        userId: '2',
        userName: 'Maria Sanabria',
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      },
      {
        id: 'h3',
        taskId: '2',
        action: 'Estado cambiado',
        userId: '2',
        userName: 'Maria Sanabria',
        previousStatus: 'pending',
        newStatus: 'in_progress',
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      },
    ],
  },
  {
    id: '3',
    title: 'Redactar copy para newsletter',
    description: 'Escribir el contenido del newsletter mensual incluyendo introducción, secciones principales y call-to-action.',
    board: 'copys',
    status: 'completed',
    priority: null,
    dueDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    creatorId: '3',
    creatorName: 'Yeinis Zapata',
    assignedRole: 'copy_1',
    reopenedCount: 0,
    attachments: [],
    comments: [],
    history: [
      {
        id: 'h4',
        taskId: '3',
        action: 'Tarea creada',
        userId: '3',
        userName: 'Yeinis Zapata',
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      },
      {
        id: 'h5',
        taskId: '3',
        action: 'Estado cambiado',
        userId: '3',
        userName: 'Yeinis Zapata',
        previousStatus: 'pending',
        newStatus: 'completed',
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      },
    ],
  },
  {
    id: '4',
    title: 'Crear copies para redes sociales',
    description: 'Desarrollar 10 copies creativos para Instagram y Facebook para la campaña del mes.',
    board: 'copys',
    status: 'pending',
    priority: 'high',
    dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    creatorId: '1',
    creatorName: 'Camila Rodriguez',
    assignedRole: 'copy_2',
    reopenedCount: 2,
    attachments: [],
    comments: [
      {
        id: 'c2',
        taskId: '4',
        userId: '1',
        userName: 'Camila Rodriguez',
        content: 'Necesitamos un tono más casual para esta campaña.',
        isAdjustmentRequest: true,
        createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
      },
      {
        id: 'c3',
        taskId: '4',
        userId: '3',
        userName: 'Yeinis Zapata',
        content: 'Entendido, voy a revisar el tono.',
        isAdjustmentRequest: false,
        createdAt: new Date(Date.now() - 10 * 60 * 60 * 1000),
      },
    ],
    history: [
      {
        id: 'h6',
        taskId: '4',
        action: 'Tarea creada',
        userId: '1',
        userName: 'Camila Rodriguez',
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      },
    ],
  },
];

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: initialTasks,
  currentUser: USERS[0],
  
  setCurrentUser: (user) => set({ currentUser: user }),
  
  addTask: (taskData) => {
    const newTask: Task = {
      ...taskData,
      id: generateId(),
      createdAt: new Date(),
      reopenedCount: 0,
      comments: [],
      attachments: taskData.attachments || [],
      history: [
        {
          id: generateId(),
          taskId: '',
          action: 'Tarea creada',
          userId: taskData.creatorId,
          userName: taskData.creatorName,
          createdAt: new Date(),
        },
      ],
    };
    newTask.history[0].taskId = newTask.id;
    
    set((state) => ({
      tasks: [...state.tasks, newTask],
    }));
  },
  
  updateTaskStatus: (taskId, newStatus) => {
    const { currentUser } = get();
    
    set((state) => ({
      tasks: state.tasks.map((task) => {
        if (task.id === taskId) {
          const historyEntry: HistoryEntry = {
            id: generateId(),
            taskId,
            action: 'Estado cambiado',
            userId: currentUser.id,
            userName: currentUser.name,
            previousStatus: task.status,
            newStatus,
            createdAt: new Date(),
          };
          
          return {
            ...task,
            status: newStatus,
            history: [...task.history, historyEntry],
          };
        }
        return task;
      }),
    }));
  },
  
  addComment: (taskId, content, isAdjustmentRequest) => {
    const { currentUser } = get();
    
    set((state) => ({
      tasks: state.tasks.map((task) => {
        if (task.id === taskId) {
          const newComment: Comment = {
            id: generateId(),
            taskId,
            userId: currentUser.id,
            userName: currentUser.name,
            content,
            isAdjustmentRequest,
            createdAt: new Date(),
          };
          
          let updatedTask = {
            ...task,
            comments: [...task.comments, newComment],
          };
          
          if (isAdjustmentRequest) {
            const historyEntry: HistoryEntry = {
              id: generateId(),
              taskId,
              action: `Tarea vuelta a Pendiente por solicitud de ajuste de ${currentUser.name}`,
              userId: currentUser.id,
              userName: currentUser.name,
              previousStatus: task.status,
              newStatus: 'pending',
              createdAt: new Date(),
            };
            
            updatedTask = {
              ...updatedTask,
              status: 'pending',
              reopenedCount: task.reopenedCount + 1,
              history: [...task.history, historyEntry],
            };
          }
          
          return updatedTask;
        }
        return task;
      }),
    }));
  },
  
  deleteTask: (taskId) => {
    set((state) => ({
      tasks: state.tasks.filter((task) => task.id !== taskId),
    }));
  },
  
  getTasksByBoard: (board) => {
    return get().tasks.filter((task) => task.board === board);
  },
  
  getTasksByStatus: (board, status) => {
    return get().tasks.filter((task) => task.board === board && task.status === status);
  },
}));
