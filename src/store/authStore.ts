import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import {
  AppUser,
  AppRole,
  fetchAllUsers,
  fetchUserProfile,
  loginUser,
  logoutUser,
  ROLE_LABELS,
} from '@/services/authService';

// Re-export types
export type { AppUser, AppRole };
export { ROLE_LABELS };

interface AuthStore {
  users: AppUser[];
  currentUser: AppUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  initialize: () => Promise<void>;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  loadUsers: () => Promise<void>;
  canAccessBoard: (boardId: string) => boolean;
}

export const useAuthStore = create<AuthStore>()((set, get) => ({
  users: [],
  currentUser: null,
  isAuthenticated: false,
  isLoading: true,

  initialize: async () => {
    // Restaura la sesión de Supabase si ya existe (persistida en localStorage).
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user) {
      set({ currentUser: null, isAuthenticated: false, users: [], isLoading: false });
      return;
    }

    const user = await fetchUserProfile(session.user.id);

    if (!user) {
      // Sesión válida pero sin persona enlazada en usuarios_roles: no la dejamos pasar.
      await logoutUser();
      set({ currentUser: null, isAuthenticated: false, users: [], isLoading: false });
      return;
    }

    // La lista de equipo requiere sesión (RLS), así que se carga después del login.
    const users = await fetchAllUsers();
    set({ currentUser: user, isAuthenticated: true, users, isLoading: false });
  },

  login: async (email, password) => {
    const result = await loginUser(email, password);

    if (!result.success || !result.user) {
      return { success: false, error: result.error };
    }

    const users = await fetchAllUsers();
    set({ currentUser: result.user, isAuthenticated: true, users, isLoading: false });
    return { success: true };
  },

  logout: async () => {
    await logoutUser();
    set({ currentUser: null, isAuthenticated: false, users: [] });
  },

  loadUsers: async () => {
    if (!get().isAuthenticated) return;
    const users = await fetchAllUsers();
    set({ users });
  },

  canAccessBoard: (_boardId) => {
    return true;
  },
}));

// Legacy export for notification service
export const USERS: AppUser[] = [];
