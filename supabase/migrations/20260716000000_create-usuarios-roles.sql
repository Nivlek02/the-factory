-- Tabla consolidada: consolida la info de profiles (usuario/nombre/email) y el rol en una
-- sola fila por persona. Aditiva: NO borra profiles ni user_roles (ambas quedan vacías).
--
-- Nota sobre contraseñas: esta tabla NO guarda contraseñas, ni en texto plano ni hasheadas.
-- Las credenciales viven en auth.users (GoTrue). Aquí solo queda el flag
-- debe_cambiar_password para que el frontend fuerce el cambio en el primer login.
--
-- user_id es nullable a propósito: hoy auth.users está vacío y no hay pantalla de login.
-- Se rellena cuando se creen las cuentas de auth, para enlazar persona ↔ sesión.

CREATE TABLE IF NOT EXISTS public.usuarios_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  usuario text NOT NULL UNIQUE,
  nombre_completo text NOT NULL,
  email text NOT NULL UNIQUE,
  rol text NOT NULL,
  debe_cambiar_password boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT usuarios_roles_rol_check CHECK (
    rol IN ('Copywriter', 'Diseñador', 'Gestor de canales', 'Estratega', 'Soporte', 'Trafficker')
  )
);

CREATE INDEX IF NOT EXISTS idx_usuarios_roles_email ON public.usuarios_roles(lower(email));
CREATE INDEX IF NOT EXISTS idx_usuarios_roles_rol ON public.usuarios_roles(rol);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_usuarios_roles_updated_at') THEN
    CREATE TRIGGER update_usuarios_roles_updated_at
    BEFORE UPDATE ON public.usuarios_roles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- RLS: a diferencia del resto de la app (que abre a `anon` porque no hay Auth real),
-- esta tabla es un directorio de personal (nombres + correos). Se deja SOLO para
-- `authenticated`; ningún código de la app la lee todavía, así que no rompe nada.
ALTER TABLE public.usuarios_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read usuarios_roles" ON public.usuarios_roles;
CREATE POLICY "Authenticated can read usuarios_roles"
ON public.usuarios_roles
FOR SELECT
TO authenticated
USING (true);

-- Datos: 22 usuarios. Mapeo fijado manualmente por el usuario (mercadeo→Estratega,
-- disenador→Diseñador, copy→Copywriter, con overrides para pmejia y ktrujillo,
-- y earmando (manager) asignado a Estratega). Nadie en Trafficker todavía.
INSERT INTO public.usuarios_roles (usuario, nombre_completo, email, rol) VALUES
  ('msanabria',  'Maria Sanabria',         'msanabria@camarabaq.org.co',      'Estratega'),
  ('yzapata',    'Yeinis Zapata',          'yzapata@camarabaq.org.co',        'Estratega'),
  ('ktrujillo',  'Kelvin Trujillo',        'ktrujillo@camarabaq.org.co',      'Soporte'),
  ('pangulo',    'Paola Angulo',           'paoliangulo24@gmail.com',         'Estratega'),
  ('orodriguez', 'Oscar Rodríguez',        'infobrandealo@gmail.com',         'Diseñador'),
  ('emarin',     'Elsa Marín',             'Elsamarin5819@gmail.com',         'Estratega'),
  ('kbassa',     'Katherine Bassa',        'kathebassa@gmail.com',            'Diseñador'),
  ('mcamargo',   'Mauricio Camargo',       'Redes@themasterprime.com',        'Diseñador'),
  ('earmando',   'Efrain Armando',         'efrainarmando12@gmail.com',       'Estratega'),
  ('sojo',       'Erik Sojo',              'esojo@camarabaq.org.co',          'Estratega'),
  ('vlopez',     'Viviana Lopéz',          'gerencia@webxcite.net',           'Copywriter'),
  ('mrodriguezr','Maria Camila Rodriguez', 'mrodriguezr@camarabaq.org.co',    'Estratega'),
  ('pmejia',     'Pedro Mejia',            'pmejia@camarabaq.org.co',         'Gestor de canales'),
  ('harrieta',   'Harold Arrieta',         'haroldearrieta@gmail.com',        'Estratega'),
  ('jsaumeth',   'Jassiel Saumeth',        'jassielsaumeth.work@gmail.com',   'Diseñador'),
  ('nfabra',     'Nay Fabra',              'fabranay@gmail.com',              'Estratega'),
  ('marrieta',   'Miliec Arrieta',         'miliecarrietaa@gmail.com',        'Diseñador'),
  ('h2musas',    'Hey 2 musas',            'hey@2musas.com',                  'Estratega'),
  ('kherrera',   'Katty Herrera',          'kattyhe1012@gmail.com',           'Estratega'),
  ('kberdugo',   'Kevin Berdugo',          'berdugoberdugo10@gmail.com',      'Estratega'),
  ('jbonilla',   'Juan Bonilla',           'jbonilla@camarabaq.org.co',       'Estratega'),
  ('aorozco',    'Alfredo Orozco',         'alfredorozco95@gmail.com',        'Diseñador')
ON CONFLICT (usuario) DO NOTHING;
