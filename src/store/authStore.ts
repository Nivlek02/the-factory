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

type Result = { success: boolean; error?: string };

/** Roles que pueden gestionar el equipo. Espejo del frontend de la policy RLS de
 *  usuarios_roles (ver puede_gestionar_usuarios en 20260717010000): esto solo decide qué
 *  se muestra — quien mande el request igual rebota contra la base. */
export const ROLES_GESTORES: AppRole[] = ['estratega', 'soporte'];

const SIN_PERMISO = 'Solo los roles Estratega y Soporte pueden gestionar usuarios.';

export interface UserEdit {
  username: string;
  fullName: string;
  email?: string;
  role: AppRole;
}

interface AuthStore {
  users: AppUser[];
  currentUser: AppUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  initialize: () => Promise<void>;
  login: (email: string, password: string) => Promise<Result>;
  logout: () => Promise<void>;
  loadUsers: () => Promise<void>;
  addUser: (username: string, fullName: string, email: string, role: AppRole) => Promise<Result>;
  updateUser: (rowId: string, edit: UserEdit) => Promise<Result>;
  deleteUser: (rowId: string) => Promise<Result>;
  /** Si el usuario en sesión puede gestionar el equipo (Estratega o Soporte). */
  canManageUsers: () => boolean;
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

  // Agrega la persona al directorio. NO crea cuenta de acceso: eso exige el Admin API
  // (service_role), que no puede vivir en el navegador. Queda con user_id nulo hasta que
  // alguien le cree la cuenta; hasta entonces es asignable pero no puede iniciar sesión.
  addUser: async (username, fullName, email, role) => {
    const { error } = await supabase.from('usuarios_roles').insert({
      usuario: username.trim(),
      nombre_completo: fullName.trim(),
      email: email.trim(),
      rol: ROLE_LABELS[role],
    });

    if (error) {
      return { success: false, error: describeError(error.message) };
    }

    await get().loadUsers();
    return { success: true };
  },

  updateUser: async (rowId, edit) => {
    const target = get().users.find((u) => u.id === rowId);
    const nuevoEmail = edit.email?.trim();

    // El correo de acceso vive en auth.users y solo el Admin API puede cambiarlo. Si lo
    // cambiáramos solo acá, la persona seguiría entrando con el correo viejo y la app le
    // mostraría el nuevo. Mejor bloquearlo que dejar los dos datos peleados.
    if (target?.userId !== target?.id && nuevoEmail && nuevoEmail !== target?.email) {
      return {
        success: false,
        error:
          'No se puede cambiar el correo de un usuario que ya tiene cuenta de acceso: seguiría iniciando sesión con el correo anterior. Debe hacerse desde el panel de Supabase.',
      };
    }

    const { data, error } = await supabase
      .from('usuarios_roles')
      .update({
        usuario: edit.username.trim(),
        nombre_completo: edit.fullName.trim(),
        rol: ROLE_LABELS[edit.role],
        ...(nuevoEmail ? { email: nuevoEmail } : {}),
      })
      .eq('id', rowId)
      .select();

    if (error) {
      return { success: false, error: describeError(error.message) };
    }

    // RLS no rechaza un UPDATE: filtra las filas. Sin permiso esto vuelve sin error y con
    // 0 filas, así que hay que mirar el conteo o cantaríamos un éxito que no ocurrió.
    if (!data || data.length === 0) {
      return { success: false, error: SIN_PERMISO };
    }

    await get().loadUsers();

    // Si me edité a mí mismo, refresca la sesión visible (nombre/rol del sidebar).
    const actual = get().currentUser;
    if (actual && actual.id === rowId) {
      const refrescado = get().users.find((u) => u.id === rowId);
      if (refrescado) set({ currentUser: refrescado });
    }

    return { success: true };
  },

  // Quita a la persona del directorio. La cuenta de auth (si tenía) sobrevive, pero
  // loginUser la rechaza al no encontrar su fila: en la práctica pierde el acceso.
  deleteUser: async (rowId) => {
    const { data, error } = await supabase.from('usuarios_roles').delete().eq('id', rowId).select();

    if (error) {
      return { success: false, error: describeError(error.message) };
    }

    // Mismo caso que updateUser: sin permiso, RLS devuelve 0 filas y ningún error.
    if (!data || data.length === 0) {
      return { success: false, error: SIN_PERMISO };
    }

    await get().loadUsers();
    return { success: true };
  },

  canManageUsers: () => {
    const rol = get().currentUser?.role;
    return !!rol && ROLES_GESTORES.includes(rol);
  },

  canAccessBoard: (_boardId) => {
    return true;
  },
}));

/** Traduce los errores crudos de Postgres a algo que le sirva a quien está en la UI. */
function describeError(message: string): string {
  if (message.includes('usuarios_roles_usuario_key')) return 'Ese nombre de usuario ya existe.';
  if (message.includes('usuarios_roles_email_key')) return 'Ese correo ya está registrado.';
  if (message.includes('usuarios_roles_rol_check')) return 'Ese rol no es válido.';
  return message;
}

// Legacy export for notification service
export const USERS: AppUser[] = [];
