import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Factory, Loader2, CheckCircle2, Lock } from 'lucide-react';

/**
 * Autoactivación: la persona ya está en el directorio del equipo pero no tiene cuenta de acceso.
 * Escribe su correo, elige contraseña y entra. El link es el mismo para todos y se reparte a
 * mano; lo que lo acota es la ventana de tiempo, que valida la edge function `activar-acceso`
 * (acá solo se pinta el estado — esconder el formulario no protegería nada por sí solo).
 */

const MIN_PASSWORD = 8;

type Estado = 'cargando' | 'abierta' | 'cerrada' | 'listo';

/**
 * Marco de la tarjeta. **Tiene que vivir fuera de ActivarPage**: definido adentro, cada render
 * creaba un tipo de componente nuevo, así que React desmontaba y volvía a montar todo el
 * formulario en cada tecla — se perdía el foco y el `autoFocus` del correo se lo llevaba de
 * vuelta, haciendo imposible escribir la contraseña.
 */
const Marco = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen flex items-center justify-center bg-background p-4">
    <div className="w-full max-w-sm">
      <div className="flex items-center justify-center gap-2 mb-8">
        <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
          <Factory className="h-5 w-5 text-primary-foreground" />
        </div>
        <h1 className="font-logo text-2xl leading-none">Tremu</h1>
      </div>
      <div className="bg-card border border-border rounded-lg shadow-sm p-6">{children}</div>
    </div>
  </div>
);

const ActivarPage = () => {
  const [estado, setEstado] = useState<Estado>('cargando');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [nombre, setNombre] = useState('');

  useEffect(() => {
    let vivo = true;
    supabase.functions
      .invoke('activar-acceso', { body: { soloEstado: true } })
      .then(({ data, error: e }) => {
        if (!vivo) return;
        // Ante un fallo de red se muestra el formulario igual: el servidor vuelve a validar la
        // ventana al enviar, así que no se puede colar nada, y así no se bloquea a nadie por un
        // error transitorio.
        setEstado(e || data?.abierta !== false ? 'abierta' : 'cerrada');
      })
      .catch(() => vivo && setEstado('abierta'));
    return () => { vivo = false; };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    if (password.length < MIN_PASSWORD) {
      setError(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`);
      return;
    }
    if (password !== password2) {
      setError('Las dos contraseñas no coinciden.');
      return;
    }

    setSubmitting(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('activar-acceso', {
        body: { email: email.trim(), password },
      });
      // invoke() marca error para cualquier no-2xx, pero el motivo real viene en el cuerpo.
      if (fnError) {
        const ctx = (fnError as { context?: unknown }).context;
        let detalle: string | null = null;
        if (typeof Response !== 'undefined' && ctx instanceof Response) {
          detalle = await ctx.clone().json().then((b: { error?: string }) => b?.error ?? null).catch(() => null);
        }
        setError(detalle ?? 'No se pudo activar la cuenta. Intenta de nuevo.');
        return;
      }
      if (data?.error) {
        setError(data.error as string);
        return;
      }
      setNombre((data?.nombre as string) ?? '');
      setEstado('listo');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo activar la cuenta.');
    } finally {
      setSubmitting(false);
    }
  };

  if (estado === 'cargando') {
    return (
      <Marco>
        <div className="flex items-center justify-center py-6 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      </Marco>
    );
  }

  if (estado === 'cerrada') {
    return (
      <Marco>
        <div className="text-center space-y-3 py-2">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mx-auto">
            <Lock className="h-5 w-5 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold tracking-tight">Activación cerrada</h2>
          <p className="text-sm text-muted-foreground">
            El periodo para crear tu contraseña ya terminó. Pídele acceso al equipo de mercadeo.
          </p>
          <Link to="/login" className="text-sm text-primary hover:underline inline-block pt-1">
            Ir a iniciar sesión
          </Link>
        </div>
      </Marco>
    );
  }

  if (estado === 'listo') {
    return (
      <Marco>
        <div className="text-center space-y-3 py-2">
          <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-5 w-5 text-accent-foreground" />
          </div>
          <h2 className="text-lg font-semibold tracking-tight">
            {nombre ? `Listo, ${nombre.split(' ')[0]}` : 'Cuenta activada'}
          </h2>
          <p className="text-sm text-muted-foreground">
            Ya puedes entrar a Tremu con tu correo y la contraseña que acabas de crear.
          </p>
          <Link to="/login" className="inline-block pt-2">
            <Button className="w-full">Iniciar sesión</Button>
          </Link>
        </div>
      </Marco>
    );
  }

  return (
    <Marco>
      <h2 className="text-lg font-semibold tracking-tight mb-1">Crea tu contraseña</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Escribe el correo con el que te registraron en el equipo y elige una contraseña para entrar.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="email">Correo</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            autoFocus
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nombre@camarabaq.org.co"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Contraseña</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={`Mínimo ${MIN_PASSWORD} caracteres`}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password2">Repite la contraseña</Label>
          <Input
            id="password2"
            type="password"
            autoComplete="new-password"
            required
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Activar mi cuenta'}
        </Button>
      </form>

      <p className="text-xs text-muted-foreground text-center mt-4">
        ¿Ya tienes contraseña?{' '}
        <Link to="/login" className="text-primary hover:underline">Inicia sesión</Link>
      </p>
    </Marco>
  );
};

export default ActivarPage;
