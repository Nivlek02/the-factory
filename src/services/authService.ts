import { supabase } from '@/integrations/supabase/client';

/** Rol de equipo — puramente informativo, ya no controla acceso a tableros ni RLS. */
export type AppRole = 'copy' | 'diseno' | 'gestor_canales' | 'estratega' | 'soporte' | 'trafficker';

export interface AppUser {
  id: string;
  userId: string;
  username: string;
  email: string;
  fullName: string;
  role: AppRole;
  /** Etiqueta que se MUESTRA en la UI. Normalmente es ROLE_LABELS[role], pero puede ser un
   *  título de cargo por persona (ver CARGO_POR_USUARIO) sin cambiar el rol real. */
  displayRole?: string;
  createdAt: string;
}

export const ROLE_LABELS: Record<AppRole, string> = {
  copy: 'Copywriter',
  diseno: 'Diseñador',
  gestor_canales: 'Gestor de canales',
  estratega: 'Estratega',
  soporte: 'Soporte',
  trafficker: 'Trafficker',
};

/** usuarios_roles.rol guarda la etiqueta ('Copywriter'); acá la volvemos al id interno. */
const ROLE_IDS: Record<string, AppRole> = Object.fromEntries(
  Object.entries(ROLE_LABELS).map(([id, label]) => [label, id as AppRole])
);

/**
 * Título de cargo que se MUESTRA en la UI en lugar de la etiqueta del rol, POR PERSONA.
 * NO cambia el rol real (que decide permisos): solo lo que se ve. Clave = usuarios_roles.usuario.
 * Ej.: Erik Sojo (`sojo`) se muestra como "Jefe de mercadeo" pero por debajo sigue siendo
 * Estratega — así conserva la gestión de usuarios y aparece como estratega en las campañas.
 */
export const CARGO_POR_USUARIO: Record<string, string> = {
  sojo: 'Jefe de mercadeo',
};

/** Fila de usuarios_roles → AppUser. */
type UsuarioRolRow = {
  id: string;
  user_id: string | null;
  usuario: string;
  email: string;
  nombre_completo: string;
  rol: string;
  created_at: string;
};

const rowToUser = (row: UsuarioRolRow): AppUser => {
  const role = ROLE_IDS[row.rol] ?? 'soporte';
  return {
    id: row.id,
    // Los usuarios sin cuenta de auth todavía caen a su id de tabla: siguen siendo
    // asignables en tareas, pero no pueden iniciar sesión hasta que tengan user_id.
    userId: row.user_id ?? row.id,
    username: row.usuario,
    email: row.email,
    fullName: row.nombre_completo,
    role,
    displayRole: CARGO_POR_USUARIO[row.usuario] ?? ROLE_LABELS[role],
    createdAt: row.created_at,
  };
};

// Fetch user profile with role
export const fetchUserProfile = async (userId: string): Promise<AppUser | null> => {
  const { data, error } = await supabase
    .from('usuarios_roles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching usuario_rol:', error);
    return null;
  }

  return data ? rowToUser(data) : null;
};

// Fetch all users — requiere sesión (RLS de usuarios_roles solo abre a authenticated).
export const fetchAllUsers = async (): Promise<AppUser[]> => {
  const { data, error } = await supabase
    .from('usuarios_roles')
    .select('*')
    .order('nombre_completo', { ascending: true });

  if (error || !data) {
    console.error('Error fetching usuarios_roles:', error);
    return [];
  }

  return data.map(rowToUser);
};

// Login
export const loginUser = async (
  email: string,
  password: string
): Promise<{ success: boolean; error?: string; user?: AppUser }> => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error('Login error:', error);
    return { success: false, error: 'Correo o contraseña incorrectos' };
  }

  if (!data.user) {
    return { success: false, error: 'Error al iniciar sesión' };
  }

  const profile = await fetchUserProfile(data.user.id);

  if (!profile) {
    // Sin fila en usuarios_roles (o sin user_id enlazado) no hay acceso: la cuenta
    // de auth existe pero nadie la vinculó a una persona del equipo.
    await supabase.auth.signOut();
    return { success: false, error: 'Tu cuenta ha sido desactivada. Contacta al administrador.' };
  }

  return { success: true, user: profile };
};

// Logout
export const logoutUser = async (): Promise<void> => {
  await supabase.auth.signOut();
};

