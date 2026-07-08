import { useState, useEffect } from 'react';
import Layout from '@/components/layout/Layout';
import { useAuthStore, AppRole, ROLE_LABELS, AppUser } from '@/store/authStore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Settings, UserPlus, Trash2, Users, Eye, EyeOff, Pencil, Mail, Loader2, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAppVersion } from '@/hooks/useAppVersion';

const SettingsPage = () => {
  const { users, currentUser, addUser, updateUser, deleteUser, loadUsers } = useAuthStore();
  const { toast } = useToast();

  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<AppRole>('copy');
  const [showPassword, setShowPassword] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showNewUserDialog, setShowNewUserDialog] = useState(false);

  // Pagination
  const [userPage, setUserPage] = useState(1);
  const USERS_PER_PAGE = 5;

  // Version control
  const { currentVersion } = useAppVersion();
  const [newVersion, setNewVersion] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);

  // Edit user state
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<AppRole>('copy');
  const [isSaving, setIsSaving] = useState(false);
  const [editPassword, setEditPassword] = useState('');
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Load users on mount
  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newEmail.trim() || !newPassword.trim() || !newName.trim() || !newUsername.trim()) {
      toast({
        title: 'Error',
        description: 'Por favor complete todos los campos obligatorios',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: 'Error',
        description: 'La contraseña debe tener al menos 6 caracteres',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);
    const result = await addUser(newEmail, newPassword, newUsername, newName, newRole);
    setIsCreating(false);

    if (result.success) {
      toast({
        title: 'Usuario creado',
        description: `El usuario ${newUsername} ha sido creado correctamente`,
      });
      setNewUsername('');
      setNewPassword('');
      setNewName('');
      setNewEmail('');
      setNewRole('copy');
      setShowNewUserDialog(false);
    } else {
      toast({
        title: 'Error',
        description: result.error,
        variant: 'destructive',
      });
    }
  };

  const handleEditUser = (user: AppUser) => {
    setEditingUser(user);
    setEditUsername(user.username);
    setEditName(user.fullName);
    setEditEmail(user.email);
    setEditRole(user.role);
    setEditPassword('');
    setShowEditPassword(false);
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;

    if (!editUsername.trim() || !editName.trim()) {
      toast({
        title: 'Error',
        description: 'El nombre y usuario son obligatorios',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    const result = await updateUser(editingUser.userId, {
      username: editUsername,
      fullName: editName,
      email: editEmail.trim() || undefined,
      role: editRole,
    });
    setIsSaving(false);

    if (result.success) {
      toast({
        title: 'Usuario actualizado',
        description: `El usuario ${editUsername} ha sido actualizado correctamente`,
      });
      setEditingUser(null);
    } else {
      toast({
        title: 'Error',
        description: result.error,
        variant: 'destructive',
      });
    }
  };

  const handleDeleteUser = async (userId: string, username: string) => {
    if (userId === currentUser?.userId) {
      toast({
        title: 'Error',
        description: 'No puedes eliminar tu propio usuario',
        variant: 'destructive',
      });
      return;
    }

    await deleteUser(userId);
    toast({
      title: 'Usuario eliminado',
      description: `El usuario ${username} ha sido eliminado`,
    });
  };

  const getRoleBadgeColor = (_role: AppRole) => 'bg-muted text-muted-foreground';

  const getRoleLabel = (role: AppRole) => ROLE_LABELS[role] ?? role;

  return (
    <Layout>
      <div className="p-6 lg:p-8 animate-fade-in">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Settings className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Ajustes</h1>
              <p className="text-muted-foreground">Gestiona los usuarios del sistema</p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Users List */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Usuarios Registrados
                </CardTitle>
                <CardDescription>Lista de todos los usuarios del sistema</CardDescription>
              </div>
              <Dialog open={showNewUserDialog} onOpenChange={setShowNewUserDialog}>
                <Button onClick={() => setShowNewUserDialog(true)}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Nuevo Usuario
                </Button>
                <DialogContent className="sm:max-w-sm max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <UserPlus className="h-5 w-5" />
                      Nuevo Usuario
                    </DialogTitle>
                  </DialogHeader>
                  <form onSubmit={(e) => { handleAddUser(e); }} className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="newName">Nombre completo *</Label>
                      <Input id="newName" placeholder="Ej: Juan Pérez" value={newName} onChange={(e) => setNewName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="newEmail" className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        Correo electrónico *
                      </Label>
                      <Input id="newEmail" type="email" placeholder="correo@ejemplo.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
                      <p className="text-xs text-muted-foreground">Se usará para iniciar sesión y notificaciones</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="newUsername">Nombre de usuario *</Label>
                      <Input id="newUsername" placeholder="Ej: jperez" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="newPassword">Contraseña *</Label>
                      <div className="relative">
                        <Input id="newPassword" type={showPassword ? 'text' : 'password'} placeholder="Mínimo 6 caracteres" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="pr-10" />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="newRole">Rol *</Label>
                      <Select value={newRole} onValueChange={(value) => setNewRole(value as AppRole)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(ROLE_LABELS).map(([id, label]) => (
                            <SelectItem key={id} value={id}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Solo informativo — todos los usuarios tienen los mismos permisos de acceso.
                      </p>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setShowNewUserDialog(false)}>Cancelar</Button>
                      <Button type="submit" disabled={isCreating}>
                        {isCreating ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creando...</>) : (<><UserPlus className="h-4 w-4 mr-2" />Crear Usuario</>)}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {(() => {
                const totalUserPages = Math.ceil(users.length / USERS_PER_PAGE);
                const paginatedUsers = users.slice((userPage - 1) * USERS_PER_PAGE, userPage * USERS_PER_PAGE);
                return (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Usuario</TableHead>
                          <TableHead>Nombre</TableHead>
                          <TableHead>Correo</TableHead>
                          <TableHead>Rol</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                              No hay usuarios registrados
                            </TableCell>
                          </TableRow>
                        ) : (
                          paginatedUsers.map((user) => (
                            <TableRow key={user.id}>
                              <TableCell className="font-medium">{user.username}</TableCell>
                              <TableCell>{user.fullName}</TableCell>
                              <TableCell>
                                <span className="text-sm text-muted-foreground">{user.email}</span>
                              </TableCell>
                              <TableCell>
                                <Badge className={getRoleBadgeColor(user.role)}>
                                  {getRoleLabel(user.role)}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button variant="ghost" size="sm" onClick={() => handleEditUser(user)} className="text-muted-foreground hover:text-foreground">
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  {user.userId === currentUser?.userId ? (
                                    <span className="text-xs text-muted-foreground ml-2">Tú</span>
                                  ) : (
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            Esta acción eliminará permanentemente al usuario "{user.username}". Esta acción no se puede deshacer.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                          <AlertDialogAction onClick={() => handleDeleteUser(user.userId, user.username)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                            Eliminar
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                    {totalUserPages > 1 && (
                      <div className="flex items-center justify-between pt-4 border-t mt-4">
                        <span className="text-sm text-muted-foreground">
                          Página {userPage} de {totalUserPages}
                        </span>
                        <div className="flex gap-1">
                          <Button variant="outline" size="sm" disabled={userPage <= 1} onClick={() => setUserPage(p => p - 1)}>
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm" disabled={userPage >= totalUserPages} onClick={() => setUserPage(p => p + 1)}>
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </CardContent>
          </Card>

          {/* Version Control */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                Control de Versiones
              </CardTitle>
              <CardDescription>
                Publica una nueva versión para notificar a todos los usuarios que actualicen la página
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Versión actual:</span>
                  <Badge variant="outline" className="text-base font-mono">{currentVersion || '...'}</Badge>
                </div>
                <div className="flex items-center gap-2 flex-1 max-w-sm">
                  <Input
                    placeholder="Ej: 1.1.0"
                    value={newVersion}
                    onChange={(e) => setNewVersion(e.target.value)}
                  />
                  <Button
                    disabled={!newVersion.trim() || isPublishing}
                    onClick={async () => {
                      setIsPublishing(true);
                      try {
                        // Fetch the existing row's ID
                        const { data: existing } = await supabase
                          .from('app_version')
                          .select('id')
                          .limit(1)
                          .single();

                        let error;
                        if (existing?.id) {
                          ({ error } = await supabase
                            .from('app_version')
                            .update({ version: newVersion.trim(), updated_by: currentUser?.fullName || 'admin' })
                            .eq('id', existing.id));
                        } else {
                          ({ error } = await supabase
                            .from('app_version')
                            .insert({ version: newVersion.trim(), updated_by: currentUser?.fullName || 'admin' }));
                        }

                        if (!error) {
                          toast({ title: 'Versión publicada', description: `Todos los usuarios verán la notificación para actualizar a la versión ${newVersion.trim()}` });
                          setNewVersion('');
                        } else {
                          toast({ title: 'Error', description: 'No se pudo actualizar la versión', variant: 'destructive' });
                        }
                      } catch {
                        toast({ title: 'Error', description: 'No se pudo actualizar la versión', variant: 'destructive' });
                      }
                      setIsPublishing(false);
                    }}
                  >
                    {isPublishing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Publicar versión'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit User Dialog */}
      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Usuario</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editName">Nombre completo *</Label>
              <Input
                id="editName"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editUsername">Usuario *</Label>
              <Input
                id="editUsername"
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editEmail" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Correo electrónico
              </Label>
              <Input
                id="editEmail"
                type="email"
                placeholder="correo@ejemplo.com"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editRole">Rol *</Label>
              <Select value={editRole} onValueChange={(value) => setEditRole(value as AppRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_LABELS).map(([id, label]) => (
                    <SelectItem key={id} value={id}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Solo informativo — todos los usuarios tienen los mismos permisos de acceso.
              </p>
            </div>

            <div className="space-y-2 border-t pt-4">
              <Label htmlFor="editPassword">Nueva contraseña (opcional)</Label>
              <div className="relative">
                <Input
                  id="editPassword"
                  type={showEditPassword ? 'text' : 'password'}
                  placeholder="Dejar vacío para no cambiar"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  className="pr-10"
                />
                <button type="button" onClick={() => setShowEditPassword(!showEditPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {showEditPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {editPassword && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isChangingPassword || editPassword.length < 6}
                  onClick={async () => {
                    if (!editingUser) return;
                    setIsChangingPassword(true);
                    try {
                      const { data: { session } } = await supabase.auth.getSession();
                      const res = await supabase.functions.invoke('update-user-password', {
                        body: { userId: editingUser.userId, newPassword: editPassword },
                      });
                      if (res.error || res.data?.error) {
                        toast({ title: 'Error', description: res.data?.error || 'No se pudo cambiar la contraseña', variant: 'destructive' });
                      } else {
                        toast({ title: 'Contraseña actualizada', description: 'La contraseña ha sido cambiada correctamente' });
                        setEditPassword('');
                      }
                    } catch {
                      toast({ title: 'Error', description: 'Error al cambiar la contraseña', variant: 'destructive' });
                    }
                    setIsChangingPassword(false);
                  }}
                  className="w-full"
                >
                  {isChangingPassword ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {editPassword.length < 6 ? 'Mínimo 6 caracteres' : 'Cambiar contraseña'}
                </Button>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                'Guardar cambios'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default SettingsPage;
