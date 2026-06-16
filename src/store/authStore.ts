import { create } from 'zustand';
import { 
  AppUser, 
  AppRole,
  fetchAllUsers,
  ROLE_LABELS,
} from '@/services/authService';

// Re-export types
export type { AppUser, AppRole };
export { ROLE_LABELS };

// Demo user for client demo — full admin (mercadeo) access
const DEMO_USER: AppUser = {
  id: 'demo-user',
  userId: 'demo-user',
  username: 'demo',
  email: 'demo@thefactory.com',
  fullName: 'Usuario Demo',
  role: 'mercadeo',
  createdAt: new Date().toISOString(),
};

interface AuthStore {
  users: AppUser[];
  currentUser: AppUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // Actions
  initialize: () => Promise<void>;
  loadUsers: () => Promise<void>;
  canAccessBoard: (boardId: string) => boolean;
}

export const useAuthStore = create<AuthStore>()((set, get) => ({
  users: [],
  currentUser: DEMO_USER,
  isAuthenticated: true,
  isLoading: false,

  initialize: async () => {
    // Load users from Supabase (for reports/notifications), silently
    const allUsers = await fetchAllUsers();
    set({ users: allUsers, isLoading: false });
  },

  loadUsers: async () => {
    const users = await fetchAllUsers();
    set({ users });
  },

  canAccessBoard: (_boardId) => {
    return true;
  },
}));

// Legacy export for notification service
export const USERS: AppUser[] = [];
