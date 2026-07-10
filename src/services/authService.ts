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

// Fetch user profile with role
export const fetchUserProfile = async (userId: string): Promise<AppUser | null> => {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (profileError || !profile) {
    console.error('Error fetching profile:', profileError);
    return null;
  }

  const { data: roleData, error: roleError } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .single();

  if (roleError) {
    console.error('Error fetching role:', roleError);
  }

  return {
    id: profile.id,
    userId: profile.user_id,
    username: profile.username,
    email: profile.email,
    fullName: profile.full_name,
    role: (roleData?.role as AppRole) || 'soporte',
    createdAt: profile.created_at,
  };
};

// Fetch all users (for mercadeo role only)
export const fetchAllUsers = async (): Promise<AppUser[]> => {
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: true });

  if (profilesError || !profiles) {
    console.error('Error fetching profiles:', profilesError);
    return [];
  }

  const { data: roles, error: rolesError } = await supabase
    .from('user_roles')
    .select('user_id, role');

  if (rolesError) {
    console.error('Error fetching roles:', rolesError);
  }

  const roleMap = new Map(roles?.map(r => [r.user_id, r.role as AppRole]) || []);

  return profiles.map(profile => ({
    id: profile.id,
    userId: profile.user_id,
    username: profile.username,
    email: profile.email,
    fullName: profile.full_name,
    role: roleMap.get(profile.user_id) || 'soporte',
    createdAt: profile.created_at,
  }));
};

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
    // No profile means the account was deleted — deny access immediately.
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
