import { useState, useEffect, useMemo } from 'react';
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
import { Settings, UserPlus, Trash2, Users, Eye, EyeOff, Pencil, Mail, Loader2, ChevronLeft, ChevronRight, ShieldAlert, Search, ArrowDownUp, ArrowUp, ArrowDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

/** Mismo mínimo que valida la edge function admin-usuarios; si cambia, cambiar en ambos. */
const MIN_PASSWORD = 8;

type UserSortKey = 'usuario' | 'nombre' | 'correo' | 'rol' | 'acceso';

const USER_SORT_OPTIONS: { value: UserSortKey; label: string }[] = [
  { value: 'usuario', label: 'Usuario' },
  { value: 'nombre', label: 'Nombre' },
  { value: 'correo', label: 'Correo' },
  { value: 'rol', label: 'Rol' },
  { value: 'acceso', label: 'Acceso' },
];

/** Búsqueda sin tildes: "Munoz" tiene que encontrar a "Muñoz" y "jose" a "José". */
const norm = (s: string) =>
  (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Forma mínima de un correo. Es la MISMA validación que hace la edge function `activar-acceso`.
 *
 * Sin esto, un correo mal escrito entraba al directorio sin protestar, y el síntoma aparecía días
 * después y sin pista: a esa persona no le llegaban las notificaciones y `/activar` no la
 * encontraba (busca por correo exacto).
 */
const correoValido = (e: string) => /^[^\s@%]+@[^\s@%]+\.[^\s@%]{2,}$/.test(e.trim());


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

  // Búsqueda y ordenamiento de la lista de usuarios
  const [userSearch, setUserSearch] = useState('');
  const [userSortBy, setUserSortBy] = useState<UserSortKey>('nombre');
  const [userSortDir, setUserSortDir] = useState<'asc' | 'desc'>('asc');

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

    if (!correoValido(newEmail)) {
      toast({
        title: 'Correo inválido',
        description: 'Revisa el correo: con uno mal escrito la persona no recibirá notificaciones ni podrá activar su cuenta.',
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

    // El correo es opcional al editar (si se deja vacío no se toca), pero si escribieron algo
    // tiene que servir: acá además puede ser el correo con el que la persona inicia sesión.
    if (editEmail.trim() && !correoValido(editEmail)) {
      toast({
        title: 'Correo inválido',
        description: 'Revisa el correo: es el que usa para iniciar sesión y para recibir notificaciones.',
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

  /** Etiqueta que se VE en la tabla: puede ser un cargo por persona, no la del rol (ver
   *  CARGO_POR_USUARIO). Se ordena y se busca por esto para que coincida con lo que se lee. */
  const etiquetaRol = (u: AppUser) => u.displayRole ?? getRoleLabel(u.role);

  /** userId cae al id de la fila cuando no hay cuenta en auth.users (ver rowToUser). */
  const tieneAcceso = (u: AppUser) => u.userId !== u.id;

  const usuariosVisibles = useMemo(() => {
    const q = norm(userSearch.trim());
    const filtrados = q
      ? users.filter((u) =>
          [u.username, u.fullName, u.email, etiquetaRol(u)].some((campo) => norm(campo).includes(q))
        )
      : users;

    const cmp = (a: AppUser, b: AppUser): number => {
      switch (userSortBy) {
        case 'usuario': return a.username.localeCompare(b.username, 'es');
        case 'correo':  return (a.email ?? '').localeCompare(b.email ?? '', 'es');
        case 'rol':     return etiquetaRol(a).localeCompare(etiquetaRol(b), 'es') || a.fullName.localeCompare(b.fullName, 'es');
        // "Sin acceso" primero: es la lista sobre la que hay que actuar (crearles la cuenta).
        case 'acceso':  return Number(tieneAcceso(a)) - Number(tieneAcceso(b)) || a.fullName.localeCompare(b.fullName, 'es');
        case 'nombre':
        default:        return a.fullName.localeCompare(b.fullName, 'es');
      }
    };

    const ordenados = [...filtrados].sort(cmp);
    return userSortDir === 'desc' ? ordenados.reverse() : ordenados;
  }, [users, userSearch, userSortBy, userSortDir]);

  const totalUserPages = Math.max(1, Math.ceil(usuariosVisibles.length / USERS_PER_PAGE));

  // Al buscar u ordenar, la página actual puede quedar fuera de rango (ej. estabas en la 4 y el
  // filtro dejó 1 sola página) y la tabla se vería vacía sin explicación.
  useEffect(() => {
    if (userPage > totalUserPages) setUserPage(1);
  }, [userPage, totalUserPages]);

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
              {/* Buscar + ordenar */}
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Buscar por nombre, usuario, correo o rol…"
                    className="h-8 pl-8 text-xs"
                    aria-label="Buscar usuarios"
                  />
                </div>

                <div className="flex items-center gap-1.5 ml-auto">
                  <ArrowDownUp className="h-3.5 w-3.5 text-muted-foreground" />
                  <Select value={userSortBy} onValueChange={(v) => setUserSortBy(v as UserSortKey)}>
                    <SelectTrigger className="h-8 w-[170px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {USER_SORT_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>Ordenar: {o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => setUserSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                    title={userSortDir === 'asc' ? 'Ascendente' : 'Descendente'}
                    aria-label={userSortDir === 'asc' ? 'Ascendente' : 'Descendente'}
                  >
                    {userSortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>

              {userSearch.trim() && (
                <p className="text-xs text-muted-foreground mb-2">
                  {usuariosVisibles.length} de {users.length} usuarios coinciden con "{userSearch.trim()}"
                </p>
              )}

              {(() => {
                const paginatedUsers = usuariosVisibles.slice((userPage - 1) * USERS_PER_PAGE, userPage * USERS_PER_PAGE);
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
                        {usuariosVisibles.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                              {userSearch.trim()
                                ? `Ningún usuario coincide con "${userSearch.trim()}"`
                                : 'No hay usuarios registrados'}
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
                                    {etiquetaRol(user)}
                                  </Badge>
                                  {!tieneAcceso(user) && (
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

          {/* La ventana de activación (/activar) se administra solo desde el backend: la fecha
              vive en `activacion_config` y la valida la edge function. No se expone acá. */}

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
                      // `editingUser` es una instantánea del momento en que se abrió el diálogo:
                      // tras crear el acceso seguía diciendo "Crear cuenta de acceso" y un segundo
                      // intento rebotaba con "este usuario ya tiene cuenta". Se relee del store,
                      // que `createUserAccess`/`setUserPassword` acaban de refrescar.
                      const refrescado = useAuthStore.getState().users.find((u) => u.id === editingUser.id);
                      if (refrescado) setEditingUser(refrescado);
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
