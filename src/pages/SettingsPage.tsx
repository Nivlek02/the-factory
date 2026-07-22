import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
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
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Settings, UserPlus, Trash2, Users, Eye, EyeOff, Pencil, Mail, Loader2, ChevronLeft, ChevronRight, RefreshCw, ShieldAlert } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAppVersion } from '@/hooks/useAppVersion';

/** Mismo mínimo que valida la edge function admin-usuarios; si cambia, cambiar en ambos. */
const MIN_PASSWORD = 8;

const SettingsPage = () => {
  const {
    users, currentUser, addUser, updateUser, deleteUser, loadUsers,
    canManageUsers, setUserPassword, createUserAccess,
  } = useAuthStore();
  const puedeGestionar = canManageUsers();
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

    if (!newEmail.trim() || !newName.trim() || !newUsername.trim()) {
      toast({
        title: 'Error',
        description: 'Por favor complete todos los campos obligatorios',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);
    const result = await addUser(newUsername, newName, newEmail, newRole);
    setIsCreating(false);

    if (result.success) {
      toast({
        title: 'Usuario agregado',
        description: `${newName} ya aparece en el equipo. Todavía no puede iniciar sesión: un administrador debe crearle la cuenta de acceso.`,
      });
      setNewUsername('');
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
    const result = await updateUser(editingUser.id, {
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

  const handleDeleteUser = async (rowId: string, username: string) => {
    if (rowId === currentUser?.id) {
      toast({
        title: 'Error',
        description: 'No puedes eliminar tu propio usuario',
        variant: 'destructive',
      });
      return;
    }

    const result = await deleteUser(rowId);

    if (result.success) {
      toast({
        title: 'Usuario eliminado',
        description: `El usuario ${username} ha sido eliminado`,
      });
    } else {
      toast({
        title: 'Error',
        description: result.error,
        variant: 'destructive',
      });
    }
  };

  const getRoleBadgeColor = (_role: AppRole) => 'bg-muted text-muted-foreground';

  const getRoleLabel = (role: AppRole) => ROLE_LABELS[role] ?? role;

  // Ajustes es solo para quienes pueden gestionar usuarios (Estratega/Soporte). El item del
  // sidebar ya se oculta; esto bloquea también la navegación directa por URL a /settings.
  if (!puedeGestionar) return <Navigate to="/" replace />;

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
                {puedeGestionar && (
                  <Button onClick={() => setShowNewUserDialog(true)}>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Nuevo Usuario
                  </Button>
                )}
                <DialogContent className="sm:max-w-sm max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <UserPlus className="h-5 w-5" />
                      Nuevo Usuario
                    </DialogTitle>
                    <DialogDescription>
                      Lo agrega al equipo para poder asignarle tareas. La cuenta de acceso se crea
                      aparte: hasta entonces no podrá iniciar sesión.
                    </DialogDescription>
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
                        Los roles Estratega y Soporte pueden gestionar usuarios; el resto solo consulta.
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
              {!puedeGestionar && (
                <div
                  role="status"
                  className="mb-4 flex items-start gap-2.5 rounded-md border border-state-review/30 bg-state-review-bg px-3 py-2.5"
                >
                  <ShieldAlert className="h-4 w-4 shrink-0 text-state-review mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-foreground">Solo lectura</p>
                    <p className="text-muted-foreground">
                      Solo los roles <strong>Estratega</strong> y <strong>Soporte</strong> pueden crear,
                      editar o eliminar usuarios. Tu rol es {currentUser ? ROLE_LABELS[currentUser.role] : '—'}.
                      Si necesitas un cambio, contacta a un administrador.
                    </p>
                  </div>
                </div>
              )}
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
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <Badge className={getRoleBadgeColor(user.role)} title={`Rol: ${getRoleLabel(user.role)}`}>
                                    {user.displayRole ?? getRoleLabel(user.role)}
                                  </Badge>
                                  {/* userId cae al id de la fila cuando no hay cuenta en auth.users
                                      (ver rowToUser en authService): esa igualdad = no puede entrar. */}
                                  {user.userId === user.id && (
                                    <Badge
                                      variant="outline"
                                      className="border-state-review/40 bg-state-review-bg text-state-review text-[10px] px-1.5"
                                      title="Está en el equipo y se le pueden asignar tareas, pero aún no puede iniciar sesión."
                                    >
                                      Sin acceso
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  {!puedeGestionar ? (
                                    <span className="text-xs text-muted-foreground">—</span>
                                  ) : (
                                  <>
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
                                          <AlertDialogAction onClick={() => handleDeleteUser(user.id, user.username)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                            Eliminar
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  )}
                                  </>
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
                Los roles Estratega y Soporte pueden gestionar usuarios; el resto solo consulta.
              </p>
            </div>

            <div className="space-y-2 border-t pt-4">
              <Label htmlFor="editPassword">
                {editingUser && editingUser.userId !== editingUser.id
                  ? 'Nueva contraseña (opcional)'
                  : 'Contraseña de acceso'}
              </Label>
              {editingUser && editingUser.userId === editingUser.id && (
                <p className="text-xs text-muted-foreground">
                  {editingUser.fullName} todavía no puede iniciar sesión. Ponle una contraseña para
                  crearle la cuenta de acceso.
                </p>
              )}
              <div className="relative">
                <Input
                  id="editPassword"
                  type={showEditPassword ? 'text' : 'password'}
                  placeholder={`Mínimo ${MIN_PASSWORD} caracteres`}
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
                  disabled={isChangingPassword || editPassword.length < MIN_PASSWORD}
                  onClick={async () => {
                    if (!editingUser) return;
                    setIsChangingPassword(true);
                    const tieneCuenta = editingUser.userId !== editingUser.id;
                    // Sin cuenta de acceso hay que crearla; con cuenta, solo se le fija la nueva.
                    const result = tieneCuenta
                      ? await setUserPassword(editingUser.id, editPassword)
                      : await createUserAccess(editingUser.id, editPassword);
                    setIsChangingPassword(false);

                    if (result.success) {
                      toast({
                        title: tieneCuenta ? 'Contraseña actualizada' : 'Cuenta de acceso creada',
                        description: tieneCuenta
                          ? `${editingUser.fullName} ya puede entrar con la contraseña nueva.`
                          : `${editingUser.fullName} ya puede iniciar sesión con ${editingUser.email}.`,
                      });
                      setEditPassword('');
                    } else {
                      toast({ title: 'Error', description: result.error, variant: 'destructive' });
                    }
                  }}
                  className="w-full"
                >
                  {isChangingPassword ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {editPassword.length < MIN_PASSWORD
                    ? `Mínimo ${MIN_PASSWORD} caracteres`
                    : editingUser && editingUser.userId !== editingUser.id
                      ? 'Cambiar contraseña'
                      : 'Crear cuenta de acceso'}
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
