import { useState, useEffect, useCallback, useRef } from 'react';
import { Task, TaskStatus, BoardType, Comment, Attachment } from '@/types';
import { AppUser } from '@/store/authStore';
import { useAuthStore } from '@/store/authStore';
import * as taskService from '@/services/supabaseTaskService';
import { sendTaskNotification } from '@/services/notificationService';

export const useSupabaseTasks = (board?: BoardType) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { users } = useAuthStore();

  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      const fetchedTasks = board 
        ? await taskService.fetchTasksByBoard(board)
        : await taskService.fetchTasks();
      setTasks(fetchedTasks);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [board]);

  // Debounce comment reloads to avoid rapid successive fetches
  const commentReloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshSingleTask = useCallback(async (taskId: string) => {
    try {
      const allTasks = board
        ? await taskService.fetchTasksByBoard(board)
        : await taskService.fetchTasks();
      const updated = allTasks.find(t => t.id === taskId);
      if (updated) {
        setTasks(prev => prev.map(t => t.id === taskId ? updated : t));
      }
    } catch (err) {
      console.error('Error refreshing single task:', err);
    }
  }, [board]);

  useEffect(() => {
    loadTasks();

    const unsubscribe = taskService.subscribeToTasks(
      (newTask) => {
        if (board && newTask.board !== board) return;
        setTasks((prev) => {
          if (prev.some(t => t.id === newTask.id)) return prev;
          return [newTask, ...prev];
        });
      },
      (updatedTask) => {
        setTasks((prev) => 
          prev.map((t) => t.id === updatedTask.id ? { ...t, ...updatedTask } : t)
        );
      },
      (taskId) => {
        setTasks((prev) => prev.filter((t) => t.id !== taskId));
      },
      (taskId) => {
        // Comment changed — debounce and only refresh the affected task
        if (commentReloadTimer.current) clearTimeout(commentReloadTimer.current);
        commentReloadTimer.current = setTimeout(() => {
          refreshSingleTask(taskId);
        }, 500);
      }
    );

    return () => {
      unsubscribe();
      if (commentReloadTimer.current) clearTimeout(commentReloadTimer.current);
    };
  }, [loadTasks, refreshSingleTask]);

  const addTask = async (
    taskData: Omit<Task, 'id' | 'createdAt' | 'reopenedCount' | 'comments' | 'history'> & { attachments?: Attachment[] },
    currentUser: AppUser
  ) => {
    const newTask = await taskService.createTask(taskData);
    
    // Notify: new task created
    await sendTaskNotification('task.created', newTask);

    return newTask;
  };

  const updateTaskStatus = async (
    taskId: string,
    newStatus: TaskStatus,
    currentUser: AppUser
  ) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const previousStatus = task.status;
    const isTransitionToReview = previousStatus !== 'in_review' && newStatus === 'in_review';

    await taskService.updateTaskStatus(taskId, newStatus, { id: currentUser.userId, name: currentUser.fullName }, previousStatus);

    // Notify creator whenever a task moves to review (both boards)
    if (isTransitionToReview) {
      await sendTaskNotification('task.in_review', { ...task, status: newStatus });
    }

    setTasks((prev) =>
      prev.map((t) => t.id === taskId ? { ...t, status: newStatus } : t)
    );
  };

  const addComment = async (
    taskId: string,
    content: string,
    isAdjustmentRequest: boolean,
    currentUser: AppUser
  ) => {
    const task = tasks.find((t) => t.id === taskId);
    const comment = await taskService.addComment(taskId, content, isAdjustmentRequest, { id: currentUser.userId, name: currentUser.fullName });
    
    // Notify assigned copy/diseñador when mercadeo requests adjustment
    if (isAdjustmentRequest && task && currentUser.role === 'mercadeo') {
      await sendTaskNotification('task.adjustment', { ...task, status: 'pending' }, content);
    }

    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              comments: [...t.comments, comment],
              ...(isAdjustmentRequest
                ? { status: 'pending' as TaskStatus, reopenedCount: t.reopenedCount + 1 }
                : {}),
            }
          : t
      )
    );

    return comment;
  };

  const deleteTask = async (taskId: string) => {
    await taskService.deleteTask(taskId);
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  };

  const getTasksByStatus = (status: TaskStatus) => {
    return tasks.filter((t) => (!board || t.board === board) && t.status === status);
  };

  const refreshTasks = () => { loadTasks(); };

  return {
    tasks, loading, error,
    addTask, updateTaskStatus, addComment, deleteTask,
    getTasksByStatus, refreshTasks,
  };
};
