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

// ---------------------------------------------------------------------------
// OBSOLETO: createUser / updateUserProfile / deleteUserProfile todavía escriben en
// profiles + user_roles, que quedaron vacías y con el enum de roles viejo. La lectura
// (login, lista de equipo) ya usa usuarios_roles. Nada las llama hoy — SettingsPage
// invoca addUser/updateUser/deleteUser del authStore, que no existen (bug preexistente).
// Si se van a conectar, primero hay que reescribirlas contra usuarios_roles.
// ---------------------------------------------------------------------------

// Sign up a new user (used by mercadeo to create team members)
export const createUser = async (
  email: string,
  password: string,
  username: string,
  fullName: string,
  role: AppRole
): Promise<{ success: boolean; error?: string; user?: AppUser }> => {
  // Create auth user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/`,
    },
  });

  if (authError) {
    console.error('Error creating auth user:', authError);
    if (authError.message.includes('already registered')) {
      return { success: false, error: 'Este correo ya está registrado' };
    }
    return { success: false, error: authError.message };
  }

  if (!authData.user) {
    return { success: false, error: 'Error al crear usuario' };
  }

  const userId = authData.user.id;

  // Create profile
  const { error: profileError } = await supabase
    .from('profiles')
    .insert({
      user_id: userId,
      email,
      username,
      full_name: fullName,
    });

  if (profileError) {
    console.error('Error creating profile:', profileError);
    if (profileError.message.includes('duplicate key')) {
      return { success: false, error: 'El nombre de usuario ya existe' };
    }
    return { success: false, error: profileError.message };
  }

  // Explicitly upsert the intended role (do not rely on the trigger default).
  // NOTA: la columna `user_roles.role` en Supabase sigue siendo el enum viejo
  // (mercadeo/disenador/copy/manager/seo) — falta una migración para ampliarlo
  // a los 5 roles nuevos. Esta función hoy es inalcanzable desde la UI
  // (SettingsPage llama a addUser, que no existe en authStore), así que el
  // `as any` no tiene efecto práctico todavía.
  const { error: roleError } = await supabase
    .from('user_roles')
    .upsert({ user_id: userId, role: role as any }, { onConflict: 'user_id' });

  if (roleError) {
    console.error('Error setting role:', roleError);
  }

  return {
    success: true,
    user: {
      id: userId,
      userId,
      username,
      email,
      fullName,
      role,
      createdAt: new Date().toISOString(),
    },
  };
};

// Update user profile
export const updateUserProfile = async (
  userId: string,
  data: { username?: string; fullName?: string; email?: string }
): Promise<{ success: boolean; error?: string }> => {
  const updates: Record<string, string> = {};
  if (data.username) updates.username = data.username;
  if (data.fullName) updates.full_name = data.fullName;
  if (data.email) updates.email = data.email;

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('user_id', userId);

  if (error) {
    console.error('Error updating profile:', error);
    if (error.message.includes('duplicate key')) {
      return { success: false, error: 'El nombre de usuario ya existe' };
    }
    return { success: false, error: error.message };
  }

  return { success: true };
};

// Update user role
export const updateUserRole = async (
  userId: string,
  role: AppRole
): Promise<{ success: boolean; error?: string }> => {
  // NOTA: ver comentario en createUser sobre el enum `user_roles.role` pendiente de migrar.
  const { error } = await supabase
    .from('user_roles')
    .update({ role: role as any })
    .eq('user_id', userId);

  if (error) {
    console.error('Error updating role:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
};

// Delete user (remove from profiles, roles; auth user remains but can't access app)
export const deleteUserProfile = async (userId: string): Promise<{ success: boolean; error?: string }> => {
  // Delete role first (foreign key)
  await supabase.from('user_roles').delete().eq('user_id', userId);
  
  // Delete profile
  const { error } = await supabase
    .from('profiles')
    .delete()
    .eq('user_id', userId);

  if (error) {
    console.error('Error deleting profile:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
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

// Get current session user
export const getCurrentUser = async (): Promise<AppUser | null> => {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.user) {
    return null;
  }

  return fetchUserProfile(session.user.id);
};

// Subscribe to auth changes
export const onAuthStateChange = (callback: (user: AppUser | null) => void) => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (event, session) => {
      if (session?.user) {
        // Defer profile fetch to avoid deadlock
        setTimeout(() => {
          fetchUserProfile(session.user.id).then(callback);
        }, 0);
      } else {
        callback(null);
      }
    }
  );

  return subscription.unsubscribe;
};
