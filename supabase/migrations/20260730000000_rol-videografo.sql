-- Nuevo rol de equipo: Videógrafo.
--
-- `usuarios_roles.rol` guarda la ETIQUETA (no el id interno) y la valida con un check constraint,
-- así que sin esto cualquier INSERT/UPDATE con 'Videógrafo' rebota con
-- `usuarios_roles_rol_check` — que es justo el error que `describeError` traduce a "Ese rol no es
-- válido". La tilde importa: la etiqueta tiene que quedar idéntica a ROLE_LABELS.videografo
-- en src/services/authService.ts.
--
-- Es aditiva: no toca ninguna fila existente ni ninguna policy.

ALTER TABLE public.usuarios_roles
  DROP CONSTRAINT IF EXISTS usuarios_roles_rol_check;

ALTER TABLE public.usuarios_roles
  ADD CONSTRAINT usuarios_roles_rol_check CHECK (
    rol IN ('Copywriter', 'Diseñador', 'Gestor de canales', 'Estratega', 'Soporte', 'Trafficker', 'Videógrafo')
  );
