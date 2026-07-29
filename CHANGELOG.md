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

## [1.7.2] — 2026-07-29

### Cambiado

- **Las notificaciones por correo ahora salen por Gmail, no por Resend.** Resend exigía verificar un
  dominio propio y, sin eso, solo entregaba a una única dirección — por eso los correos del equipo
  no llegaban a nadie más. Ahora se envían desde una cuenta de Gmail y **le llegan a cualquier
  destinatario, sin necesidad de dominio**. No cambia nada de cómo funcionan: los mismos cuatro
  avisos, los mismos destinatarios según el rol y un correo por rol, no por tarea.
- Cada persona recibe **su propia copia**: antes iban todos los destinatarios en el mismo correo y
  se veían las direcciones entre sí.

> Este cambio vive en el servidor, no en la app. **Envío real confirmado el 2026-07-29**: ya no hay
> modo de prueba y los correos llegan a sus destinatarios.

---

## [1.7.1] — 2026-07-29

### Cambiado

- **La tarea que se crea en Diseño ya no se llama "Redactar copy para…".** Al aprobar un copy, la
  tarea que aparece en el nodo de Diseño pasa a llamarse **"Diseño de pieza para {canal} — {ángulo}"**,
  conservando el canal y el ángulo del copy original. Un copy creado a mano con otro título queda
  como "Diseño de pieza — {título}", sin perder lo que se escribió. El copy original no cambia de
  nombre y las tareas de diseño que ya existían se quedan como están.

---

## [1.7.0] — 2026-07-29

### Agregado

- **Las tareas ahora llevan consigo el entregable del paso anterior.** Cuando se aprueba un copy y
  eso crea sola la tarea de diseño, dentro de esa tarea aparece una pestaña **"Paso anterior"** con
  el copy aprobado —contenido, adjuntos e historial— para consultarlo sin salir de ahí ni buscarlo
  en otro nodo. Es solo lectura, y siempre muestra la versión vigente: si el copy se corrige
  después, acá se ve corregido. Aplica a toda la cadena (copy → diseño, copy → landing, etc.).

### Cambiado

- **La fecha viaja por el flujo.** Las tareas que se crean solas al aprobar un paso heredan la fecha
  de la tarea que las originó, así que ya muestran su fecha y su semáforo en la lista del nodo y en
  la tarjeta del diagrama — igual que las tareas del Gestor de canales, que la traían del Plan de
  canales. Antes nacían sin fecha. Se puede cambiar desde la propia tarea como siempre.

---

## [1.6.0] — 2026-07-29

### Agregado

- **El diagrama del ciclo ahora muestra el flujo de trabajo de la etapa de Interacción**: debajo
  del esquema aparece una tarjeta por canal con cada interacción que se puede medir y la tarea que
  deja. En correo, **quien no abre o no hace clic genera una tarea de copy** (un copy distinto para
  esas personas) que cae sobre **Copywriter** y **Gestor de canales** — el primero lo redacta, el
  segundo lo envía. Las demás interacciones se marcan como "se mide, no dispara acciones".

### Cambiado

- **Cada canal solo ofrece las interacciones que de verdad puede medir.** De WhatsApp y SMS solo se
  puede medir el clic, así que ya no aparecen "no clic" ni "visita landing". En correo se quitó
  "visita landing" (eso se mide en la landing, no en el correo) y quedan abre / no abre / clic /
  no clic. Lo ya guardado con las opciones viejas simplemente deja de mostrarse; no se pierde nada
  ni hay que corregir campañas a mano.

> El Dashboard de métricas no cambió: sigue midiendo enviados, apertura y clics igual que antes.

---

## [1.5.1] — 2026-07-28

### Corregido

- **En la pantalla de activación el cursor saltaba al correo al escribir la contraseña**, lo que
  hacía casi imposible completarla. Ya se queda en el campo donde estás escribiendo.

### Eliminado

- Se quitó de Ajustes la tarjeta del link de activación. La fecha hasta la que el link funciona
  se administra solo desde el backend.

---

## [1.5.0] — 2026-07-28

### Agregado

- **Link de activación de cuenta.** Quien está en el equipo pero aparece como "Sin acceso" ya
  puede crear su propia contraseña: entra a `/activar`, escribe el correo con el que lo
  registraron y elige su clave. Antes había que crearle el acceso uno por uno desde Ajustes.
- En Ajustes hay una tarjeta nueva para **copiar el link y controlar hasta cuándo funciona**.
  Arranca abierto hasta el viernes 7 de agosto de 2026; pasada esa fecha el link deja de crear
  cuentas aunque alguien lo tenga guardado.

---

## [1.4.1] — 2026-07-28

### Corregido

- **El diagrama del ciclo ya no muestra "clic / no clic" en Call Center** ni en los demás canales
  que no tienen esas interacciones. Ahora muestra lo que se haya escrito en el campo
  personalizado y, si no se escribió nada, solo el nombre del canal. Aplica también a campañas
  guardadas antes del cambio, sin tener que volver a editarlas.
- Al cambiar el canal de una acción se limpian las interacciones que el canal nuevo no admite,
  para que no queden datos invisibles arrastrados del canal anterior.

---

## [1.4.0] — 2026-07-28

### Cambiado

- **El requerimiento de la campaña se elige en un solo lugar:** la etapa "Captura de interés" de
  Canales y Comportamiento, que ahora incluye "No requiere formulario/landing". Se eliminó el
  bloque "Requerimiento (Motor del proceso)" del final de ese mismo paso, que preguntaba lo mismo.
  La pregunta "¿Formulario básico?" es la misma de siempre, ahora justo debajo de la opción que
  la dispara.
- **Solo se puede elegir una opción de captura a la vez.** Con Landing y Formulario marcados
  juntos se generaban dos formularios (el de la cadena de Landing y el del requerimiento suelto),
  que es la duplicidad de tareas que había que evitar.
- En el paso de **Interacción**, los canales que no tienen abre/clic —Call Center, BTL, KAM,
  Relacionamiento y pauta— ya no muestran esos chips: queda solo el campo para escribir la
  interacción esperada. WhatsApp y SMS pierden "Abre" y "No abre" (no tienen apertura); Correo
  no cambia.
- **Dashboard de métricas más legible:** cada porcentaje es su propia columna en la tabla de
  salidas y su propio ítem en las tarjetas de canal, en vez de ir colgado del número. Los canales
  llevan color: Correo azul, WhatsApp verde y SMS azul claro.

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
