# Changelog

Todos los cambios relevantes de Tremu se anotan acá. El formato sigue
[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el número de versión sigue
[Versionado Semántico](https://semver.org/lang/es/): `MAYOR.MENOR.PARCHE`.

- **PARCHE** (`1.0.0` → `1.0.1`): arreglos, nada nuevo que aprender.
- **MENOR** (`1.0.1` → `1.1.0`): funciones nuevas, sin romper lo que ya había.
- **MAYOR** (`1.1.0` → `2.0.0`): cambios grandes que obligan a hacer algo distinto.

## Cómo publicar una versión

La versión vive **solo** en `package.json`. De ahí sale el número que se hornea en el bundle,
el que se publica en `/version.json` y el `v1.2.0` que se ve en el sidebar — no hay que tocarlo
en ningún otro archivo.

1. `npm version patch|minor|major --no-git-tag-version`
2. Agregar la entrada acá abajo, escrita para quien usa la app: qué cambió y por qué le importa.
3. Commit y push a `master`. Vercel despliega solo y, unos minutos después, a quien tenga la
   pestaña abierta le aparece el aviso "Nueva versión disponible".

> El aviso también salta cuando se redespliega sin subir el número (mismo `1.2.0`, otro build).
> Es a propósito: así nadie se queda con el bundle viejo. Si algún día se despliega tantas veces
> al día que molesta, se quita esa mitad de `isNewerVersion` en `src/lib/version.ts`.

---

## [1.3.0] — 2026-07-28

### Cambiado

- **El Dashboard de métricas mide solo Correo, WhatsApp y SMS.** Call Center nunca tuvo métricas
  (su entregable es "¿se realizó? sí/no") y las de pauta viven en Meta y Google, así que ya no
  aparecen acá. Los datos de pauta no se borran: siguen en su propia tarea.
- **El desglose por canal quedó en Enviados y Clics**, más Apertura solo en Correo, que es el
  único canal donde ese dato existe.
- En las métricas de WhatsApp y SMS ahora se pide **"Enviados"** en vez de "Base total": es el
  mismo número, con el nombre que le corresponde. Lo que ya estaba cargado se sigue viendo.
- Se quitó "Base" de la tabla de salidas y la tarjeta "Base total" de los totales — con Base
  fuera del resto del tablero, ese número solo lo aportaba Correo y el total quedaba cojo.

---

## [1.2.1] — 2026-07-28

### Cambiado

- El desglose por canal ya no muestra "Base" — el volumen se sigue viendo en la tabla de salidas
  de abajo.
- Las tarjetas de WhatsApp, SMS y pauta ya no muestran "Apertura" ni "Enviados": esos canales no
  registran esos datos, así que solo aparecía un guion. Correo, que sí los tiene, no cambia.
  El porcentaje de clics conserva su referencia en el tooltip de la fila.

---

## [1.2.0] — 2026-07-28

### Agregado

- **Desglose por canal en el Dashboard de métricas.** Además de los totales de la campaña, ahora
  hay una tarjeta por canal — Correo, WhatsApp y SMS siempre visibles, más cualquier otro que
  tenga métricas cargadas (pauta, Call Center) — con base, enviados, apertura y clics, y el
  porcentaje al lado de apertura y clics. Un canal sin datos aparece igual, marcado "Sin datos",
  para que se note lo que falta por cargar.
- **Lista de salidas** debajo del desglose: cada envío con su fecha y sus métricas, y una marca
  "Sin métricas" en los que todavía nadie llenó.

### Cambiado

- El primer bloque del dashboard ahora se llama "Totales de la campaña", para distinguirlo del
  desglose por canal que va debajo.

---

## [1.1.1] — 2026-07-28

### Eliminado

- Se quitó la tarjeta "Notificaciones por correo" de Ajustes, con su botón de envío de prueba.
  Servía para comprobar que el correo funcionaba; ya está confirmado y en funcionamiento.

---

## [1.1.0] — 2026-07-28

### Agregado

- **Seguimiento de eventos** muestra una barra con porcentaje mientras carga, en vez de un
  spinner sin información. La consulta a Zoom puede tardar varios segundos y antes no se sabía
  si algo estaba pasando.

### Cambiado

- **El diagrama de Flujo de trabajo se lee mucho mejor.** Las líneas entre etapas ahora son
  negras, van en ángulo recto de tarjeta a tarjeta y terminan en una flecha, así que se sigue la
  secuencia de un vistazo (antes eran curvas grises casi invisibles que pasaban por debajo de
  las tarjetas). Los nodos tienen más aire entre ellos y las etapas ya no se aplastan en
  pantallas angostas: si no caben, el diagrama se desplaza en horizontal en vez de recortar los
  títulos. La exportación a imagen sigue saliendo completa.

### Corregido

- **"Enviar correo de prueba" (Ajustes) ya no se queda cargando para siempre.** Cuando la
  función de correo no responde, el botón vuelve a la normalidad y explica qué pasó — incluido
  el caso actual, en el que la función todavía no está desplegada en Supabase. Antes el error se
  tragaba y el botón quedaba girando hasta recargar la página.

---

## [1.0.0] — 2026-07-28

Primera versión numerada. Hasta acá la app se identificaba con el SHA del commit (`1ed3c5d`),
que no le decía nada a nadie; de ahora en adelante usa un número legible.

### Agregado

- La versión que se está usando se ve en el pie del menú lateral (`v1.0.0`), útil para saber si
  alguien está mirando una versión vieja al reportar algo.
- `CHANGELOG.md` con el historial de cambios y cómo publicar una versión nueva.

### Cambiado

- El aviso de "Nueva versión disponible" ya no muestra el código del build; cuando el número de
  versión cambia, lo dice en formato `v1.2.0`.
- El botón "Actualizar ahora" ahora limpia la caché del navegador antes de recargar. Antes podía
  pasar que la recarga trajera de vuelta la versión vieja y el aviso reapareciera.
- La app revisa si hay versión nueva al volver a la pestaña (además de cada 15 minutos), que es
  el caso real de quien deja Tremu abierta varios días.
- Descartar el aviso con la ✕ ahora lo oculta hasta que se publique una versión distinta, en vez
  de volver a aparecer al rato.

---

## Historial anterior

Los cambios previos a `1.0.0` están en la bitácora de `CLAUDE.md` y en el historial de git.
