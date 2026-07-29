# The Factory (Tremu) — notas del proyecto

App interna de mercadeo de la Cámara de Comercio de Barranquilla. Vite + React + shadcn/ui +
Zustand + Supabase.

- **Producción:** https://tremubaq.vercel.app (Vercel, team `nivlek02s-projects`, proyecto `tremu`).
  El viejo `the-factory-seven.vercel.app` da 404.
- **Repo:** `Nivlek02/the-factory`, rama de producción `master`.
- **Supabase:** proyecto `yvzpfdwswmjcnipcgclg`. Cuenta `kazuhacoc01@gmail.com`.
- **Versión:** vive **solo** en `package.json` (ver "Versión y aviso de actualización").

> Este archivo es la memoria del proyecto: prioriza **trampas que cuestan un bug** y decisiones que
> no se deducen del código. Si algo de acá se contradice con el código o con la base, manda el
> código — y hay que corregir esta nota.

---

## Antes de tocar nada

- **El typecheck real es `npx tsc --noEmit -p tsconfig.app.json`.** `npx tsc --noEmit` a secas **no
  compila nada** (el `tsconfig.json` raíz tiene `"files": []` + `references`) y da un exit 0 falso.
  Hoy el proyecto está en **cero errores**: cualquier error que salga es de tu cambio.
- `npm run build` tiene que quedar limpio. No hay test runner (ni vitest ni jest) — la verificación
  se hace con scripts sueltos y con Playwright (ver "Verificación").
- **`vercel.json` necesita el bloque `rewrites`** o toda ruta profunda (`/login`, `/settings`,
  `/board/:id`, `/activar`) da 404: `dist/` solo contiene `index.html`. El rewrite excluye
  `assets/`, `version.json` y `logo-email.png`. **Cualquier archivo estático nuevo en la raíz hay
  que excluirlo ahí o Vercel devolverá `index.html` en su lugar** (ya pasó dos veces: con
  `version.json` el aviso de versión no habría aparecido nunca, y con el logo del correo salía un
  icono roto).
- Env vars de Vercel (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`) se gestionan por API con
  un token personal. Ojo al pegar keys a mano: ya pasó que un salto de línea se convirtió en
  espacios en medio del JWT y lo invalidó (`401 Invalid API key`). En `.env` los valores van **entre
  comillas**; al parsearlos hay que quitarlas y **no partir por `=` a secas** (los JWT llevan `=`
  de padding).

---

## Seguridad y permisos

### RLS
- **`usuarios_roles`** (el directorio del equipo): SELECT para cualquier autenticado — la app
  necesita la lista para asignar tareas. **Escribir solo si el rol es Estratega o Soporte**, vía
  `public.puede_gestionar_usuarios()`, que es **SECURITY DEFINER a la fuerza**: una policy sobre
  `usuarios_roles` que consulte `usuarios_roles` se evalúa recursivamente contra sí misma.
  No abre a `anon` a propósito: son 22 nombres y correos personales, y la publishable key es
  pública y va en el bundle.
- **`factory_projects`, `tasks`, `task_comments`**: cerradas a `authenticated`
  (migración `20260729000000`). Antes estaban `TO anon USING (true)` para SELECT/INSERT/UPDATE/
  **DELETE**, o sea que cualquiera con la publishable key —que va en el JS— podía leer, modificar y
  borrar todas las campañas sin cuenta. El gate de `App.tsx` solo esconde la UI, no protege datos.
- **`activacion_config`**: RLS activa y **sin ninguna policy** → inalcanzable desde el navegador. La
  edge function la lee porque el service_role bypassea RLS.
- `profiles` y `user_roles` quedaron **vacías y muertas** (enum de roles viejo). No se borraron.
- **Storage `task-attachments`**: subir y borrar solo `authenticated`, pero la lectura es
  **`{public}`** — cualquiera con la URL de un archivo lo abre sin cuenta. **Decisión consciente del
  usuario (2026-07-29): se deja así.** Las rutas llevan un id aleatorio, así que no se adivinan,
  pero las URLs quedan guardadas en las campañas y en el Markdown exportado. Cerrarlo es pasar el
  bucket a privado y cambiar `getPublicUrl` → `createSignedUrl` resolviendo al mostrar (las URLs ya
  guardadas dejarían de servir directo).

**Auditoría del 2026-07-29** (`pg_policies` sobre `public` y `storage`): **no queda ninguna policy
con `anon`**. La única `{public}` es el SELECT de los adjuntos, ya explicado.

**Lección de esa auditoría — mirar las policies que YA hay antes de crear otras.** La migración
`20260729000000` asumió que `tasks`/`task_comments` tenían las policies `anon` de `20260106024406`;
Postgres avisó con NOTICE que **no existían** (esa migración vieja nunca llegó a este proyecto:
esas dos tablas estaban restringidas desde `20251217203726`). Quedaron dos juegos equivalentes, y
eso **rompió una restricción real**: `task_comments` tenía `"Authenticated users can edit recent
comments"` (solo 10 minutos) y un `USING (true)` al lado la anulaba — **entre policies permisivas
gana la más laxa**. Se corrigió con `20260729010000`, que borra las duplicadas.

**Dos reglas que ya costaron bugs:**
1. Un INSERT rechazado por RLS **falla en silencio** — solo se ve en la consola del navegador.
2. Un UPDATE sin permiso **no da error**: RLS *filtra filas*, así que vuelve `error: null` con **0
   filas**. Hay que mirar el conteo con `.select()`, no solo `error` (lo hacen `updateUser` y
   `deleteUser` en `authStore`).

### Roles
`usuarios_roles.rol` guarda la **etiqueta** ('Copywriter', 'Estratega'…) con un check constraint;
`authService` la traduce al id interno (`copy`, `estratega`…) con un mapa inverso de `ROLE_LABELS`.
El rol es **informativo en todas partes menos en la gestión de usuarios**, que es el único lugar
donde decide permisos (`canManageUsers` en el front + la policy en la base; la base es la que
manda). `CARGO_POR_USUARIO` permite mostrar un cargo distinto por persona sin cambiar su rol real.

### Edge functions
**Desplegadas (3):** `admin-usuarios`, `activar-acceso`, `notificar-correo`.
**Muertas, en el repo, sin desplegar:** `create-initial-user`, `update-user-password`,
`send-notification` — validan el rol contra `user_roles` (vacía), así que darían 403 siempre. **No
conectarlas sin reescribirlas.** `admin-set-password` **se borró**: no validaba nada, recibía
`{email, password}` y cambiaba la contraseña de cualquiera. **Si reaparece, no desplegarla.**

Las tres desplegadas usan service_role, que **bypassea toda RLS**, así que la autorización se hace
a mano dentro de la función:
- **`admin-usuarios`** (`verify_jwt: true`) — único camino a `auth.users` desde el navegador.
  Exige JWT válido → verifica contra `usuarios_roles` que quien llama sea Estratega/Soporte →
  **relee la fila objetivo de la base por `id`**, nunca confía en el email del body. Acciones:
  `set-email` (cambia auth.users **y** el directorio, o quedarían peleados), `set-password`,
  `create-access`.
- **`notificar-correo`** (`verify_jwt: true`) — exige JWT y que quien llama exista en el
  directorio, **sin exigir rol de gestor** (cualquiera del equipo notifica al trabajar).
- **`activar-acceso`** (`verify_jwt: false`, **pública a la fuerza**: quien la usa todavía no tiene
  cuenta). Ver "Activación de cuentas".

### XSS — `dangerouslySetInnerHTML`
La descripción de la campaña, los entregables y los comentarios son **HTML del editor** y se
pintan con `dangerouslySetInnerHTML`. **Siempre a través de `dangerousHtml()` de
`src/lib/sanitizeHtml.ts`** (DOMPurify con lista blanca). Sin eso es un XSS almacenado: un
`<img src=x onerror=…>` guardado en un entregable se ejecuta en el navegador de cualquiera que abra
la campaña y puede robar la sesión de `localStorage` — y si la víctima es Estratega/Soporte, con
ella se gestiona el equipo. Ojo: un `<script>` inyectado por innerHTML no corre, pero
`onerror`/`onload` **sí**, así que "no hay `<script>`" no es defensa. La limpieza es **en lectura**,
así que cubre lo que ya está guardado sin migrar nada. `htmlAText` (`campaignMarkdown.ts`) usa
`DOMParser`, que es inerte — ahí no hace falta.

---

## Datos de las campañas

Todo vive en el blob **`factory_projects.data` (JSONB)**: nodos del flujo, entregables, canales,
loops, etapas, ELMR, adjuntos. **Agregar un campo no necesita migración de esquema** — se lee con
`?? default` en `rowToProject` y se serializa en `projectToRow`.

**Migraciones en LECTURA** (mismo patrón para todo lo que cambia de forma): `stripApprovalNodes`,
`mergeGuionNodes`, `interaccionesValidas`, `asignarNumerosFaltantes`. Se arregla al leer y no se
toca la base.

### Guardia de escritura obsoleta (`revision`)
Cada escritura reemplaza el proyecto **entero**. Con dos personas a la vez, quien guardaba de
último **pisaba el trabajo del otro sin error ni aviso**: bastaba dejar la pestaña abierta un rato
(nada volvía a leer de la base solo) y tocar cualquier cosa.

Hoy `data.revision` es un contador por campaña. Antes de escribir, `syncProject` compara el de la
base con el último conocido (`revisionConocida`, un `Map` a nivel de módulo — **no** en el objeto
del proyecto: el `setTimeout` captura una instantánea y leerlo de ahí daba falsos conflictos al
hacer dos cambios seguidos). Si el de la base es mayor: **no pisa**, recarga esa campaña y avisa con
un toast. Además `FactoryPage` **relee al volver a la pestaña** (`visibilitychange`/`focus`), que es
lo que evita llegar al conflicto; no relee si hay una escritura propia pendiente
(`haySincronizacionPendiente()`).

### Números y códigos
- `FactoryProject.numero` (`#7`) = **máx + 1, no `length + 1`**: borrar la campaña del medio no
  recicla su número. Se calcula en el cliente, así que dos campañas creadas a la vez podían
  compartirlo; `asignarNumerosFaltantes` **repara duplicados al leer** dejándole el número a la más
  vieja (regla determinista por `createdAt`, así todos los navegadores llegan al mismo resultado).
- `FabricaBriefItem.codigo` (`C1`, `D2`, `E1`…): la letra sale del `stageType` del nodo
  (`LETRA_POR_STAGE`), con respaldo por rol para lo legado. El consecutivo se calcula **leyendo los
  códigos ya usados**, no contando tareas, porque las tareas entran por tres caminos distintos.
  `landing_formulario` usa **LF** para no chocar con la **F** del formulario de inscripción.
- **`heredarCodigos` es obligatorio** porque guardar el wizard de edición reconstruye
  `fabricaBriefs` desde cero: sin él, cada "Guardar cambios" repartiría códigos nuevos
  (C1 → C7 → C13). Se recupera por **texto + rol**, emparejando de a uno con `shift` para que dos
  tareas del mismo nombre no se lleven el mismo.

### ⚠️ Riesgo abierto: el wizard de edición reconstruye todo
`buildFabricaBriefs` (`CreateProjectWizard`) rearma `fabricaBriefs` **completo, con ids nuevos**, en
cada guardado. En teoría, editar una campaña ya avanzada puede perder `deliverableContent`,
`comments`, `workflowStatus` y `currentNodeId` de entregables que ya pasaron por el flujo. **No está
confirmado que haya pasado en producción.** Arreglarlo bien es pasar a diff/merge en vez de
reemplazo. Preguntar antes de invertir en eso.

---

## Flujo de trabajo (los nodos)

Cadena base: **Copys → Diseño de piezas → Envío de acciones**. Copys **se bifurca en tres ramas
que no se cruzan**:
- → **Diseño** (cualquier copy normal). La tarea se renombra al nacer con `nombreDePieza`
  (`Redactar copy para Correo — X` → `Diseño de pieza para Correo — X`).
- → **Call Center** (solo el guion de la llamada, `isCallCenterGuion`). Checkpoint **único** por
  nodo.
- → **Formulario de la landing → Cargue de la landing** (solo `Copy de landing`, `isLandingCopy`).

Los demás nodos (Pauta, BTL, KAM, Relacionamiento, Call Center) **nacen del Plan de canales**, no de
un checkbox: `syncCanalNodes` los agrega y los quita al agregar o quitar canales, igual que
`syncRequerimientoNodes` con Landing/Formulario.

Quién dispara qué vive en la tabla `AUTO_ADVANCE` + el predicado `avanzaDesde()`
(`StrategyBriefPanels.tsx`). Al aprobar, la tarea nueva hereda `fechaAccion` y guarda
`sourceBriefId` (referencia **por id**: el diálogo resuelve el original en vivo, así que si el copy
se corrige después se ve corregido).

**Trampas de los nodos:**
- **`roleId` vs `roleLabel`.** El `roleLabel` es texto para mostrar; el `roleId` de una tarea tiene
  que ser el **id** (`diseno`), porque es con lo que `isTaskOwnedBy` decide de quién es. Casi todos
  los nodos tienen `roleId: null`, y antes se caía a la etiqueta ('Diseñador') → **las piezas de
  diseño no le aparecían al diseñador en "Mis tareas"**. Hoy `activateNextStage` traduce con
  `roleIdDeEtiqueta`, y `isTaskOwnedBy` tiene además un **respaldo por etiqueta** que cubre todo lo
  ya guardado en Supabase sin migrar el JSONB. Si agregas un nodo, ponle `roleId` real.
- **Varios nodos comparten `roleLabel`** (Landing/Formulario/Envíos son "Gestor de canales";
  KAM/BTL/Relacionamiento/Call Center son "Estratega"). `briefsForNode` desambigua por
  `currentNodeId` y, para lo legado sin él, por texto de la tarea. `stampCanalNodeIds` estampa el
  `currentNodeId` correcto al crear/actualizar, así que las heurísticas de texto son solo red de
  seguridad. La rama de `landing` se evalúa **antes** del filtro por rol, porque ese nodo cambió de
  rol (Gestor de canales → Soporte) y lo viejo ya no coincide.
- El nodo Envío de acciones usa `DeliveryBriefPanel`, no `ContentBriefPanel` — cuando agregues algo
  a "cualquier nodo", verifica que Envíos también lo tenga (ya se olvidó una vez).

---

## Fechas, urgencia y métricas

- **Semáforo** (`src/lib/urgencia.ts`): rojo ≤2 días (incluye vencidas), amarillo ≤7, verde >7.
  `parseISOLocal` parsea a mano porque **`new Date('2026-07-20')` se interpreta como UTC** y en
  Colombia (UTC-5) mostraría el día anterior. Mismo motivo en `formatFecha` de la edge function.
- `fechaAccion` se siembra desde `CanalRow.dia` y es editable desde la tarea. En
  `buildFabricaBriefs` viaja en una variable de bucle que **se resetea a null al salir**, o
  Landing/Loops heredarían la fecha del último canal.
- **Las tareas de métricas NO heredan fecha** a propósito: heredar la del envío las dejaría en rojo
  al día siguiente de enviar.
- **Dashboard de métricas: solo Correo, WhatsApp y SMS** (`esCanalMedido`). Muestra Enviados +
  Clics, y Apertura **solo en Correo** (`mideApertura`), espejo de los campos que pide el formulario
  de `FactoryPage`. Si ese formulario cambia, hay que actualizar esas funciones o el dashboard
  seguirá escondiendo datos. `enviadosDe()` hace `enviados || baseTotal`: **si quitas ese fallback,
  las métricas cargadas antes del 2026-07-28 se ven en cero.** Pauta sí genera métricas, solo se
  ocultan de este tab. Call Center nunca las generó.
- Cortar el nombre del canal **por prefijo**, nunca con `/…de (\w+)/`: ese `\w+` parte "Call
  Center" en "Call".

---

## Correo (FUNCIONANDO)

**Transporte: Gmail por SMTP, único.** Secrets: `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `APP_URL`
(+ `MAIL_FROM_NAME` opcional). **Sin modo de prueba: los correos van a sus destinatarios reales.**

- **Se descartó Resend** porque sin dominio verificado solo entrega a la dueña de la cuenta, y el
  DNS de `camarabaq.org.co` (Microsoft 365) no dependía de nosotros. Con SMTP de Gmail **el que
  envía es Google**, así que sale alineado con SPF/DKIM y no cae en spam — con un tercero enviando
  "desde" un gmail, sí.
- **Contraseña de aplicación, NO OAuth** (el token de OAuth caduca cada 7 días en modo Testing). La
  de aplicación no caduca, pero **se revoca sola si se cambia la contraseña de la cuenta de
  Google**: si el correo se cae de golpe, eso es lo primero que hay que mirar.
- **`denomailer` MATA el worker** de Supabase: 500 sin cuerpo, sin cabeceras CORS (se ve como un
  error de CORS engañoso) y **sin entrar al `catch`** — no es una excepción, es el worker
  muriéndose. Se aisló desplegando un evento que solo hacía `Deno.connectTls` a smtp.gmail.com:465:
  respondió `220`, o sea que **el runtime sí permite sockets TLS** y el problema era la librería.
  Por eso hay un **cliente SMTP propio** (~90 líneas). Ojo: esta versión del CLI **no tiene
  `functions logs`**.
- Trampas del cliente SMTP: las respuestas multilínea van `250-…` y **cierran con `250 ` (código +
  espacio)** — sin esperar esa línea el siguiente comando se desincroniza; las cabeceras son ASCII,
  así que el asunto va como **palabra codificada RFC 2047**; el cuerpo va en **base64**, lo que de
  paso elimina el *dot stuffing* y las líneas largas; el `AUTH PLAIN` se loguea como
  `<comando oculto>`. `GMAIL_APP_PASSWORD` se limpia de espacios (Google la muestra en bloques
  de 4).
- **Todo lo que va a una cabecera o a un comando SMTP pasa por `unaLinea()`**, y los destinatarios
  por `correoValido()`. Un `\n` en el asunto (que lo arma el cliente) permitiría inyectar un `Bcc:`
  y convertir esto en relay. No basta con confiar en el filtro de `cabecera()`: su regex usa `$`,
  que en JS **también matchea antes de un `\n` final**.
- **Se manda un correo por destinatario**, no uno con todos en el `to`: el directorio tiene correos
  personales y no tienen por qué verse entre ellos. Tope de una cuenta Gmail gratuita: ~500/día, y
  el sistema manda **un correo por rol, no por tarea**.

**Regla de oro del lado del navegador:** el cliente **NUNCA manda direcciones de correo**. Solo dice
qué pasó, en qué campaña, sobre qué tareas y qué **rol** es responsable; la función resuelve los
correos contra `usuarios_roles`. Si el cliente mandara el `to`, esto sería un **relay abierto**.

**Los 4 eventos y dónde se enganchan:**
- `tarea.asignada` sale del **store** (`addFabricaBriefs` + `addProject`), no de los paneles:
  `addFabricaBriefs` es el único camino por el que entra una tarea a una campaña existente, así que
  cubre de una el quick-add de los ~6 paneles **y** lo que siembra `activateNextStage`. `addProject`
  hace falta aparte porque el lote del wizard se escribe directo en el objeto.
  **`updateProject` NO notifica a propósito**: reconstruye `fabricaBriefs` completo en cada guardado
  y mandaría una avalancha.
- `tarea.en_revision` → a la **estratega de la campaña** (por `strategistName`, que es el nombre, no
  un id), con fallback a todas las Estrategas.
- `tarea.aprobada` / `tarea.correccion` → al rol responsable del entregable.
- Destinatarios = miembros del grupo de rol en **esa** campaña y, si está vacío, todos los del
  directorio con ese rol. Es la misma regla de `isTaskOwnedBy`, así que **el correo coincide con lo
  que la persona ve en "Mis tareas"**. Nadie se notifica a sí mismo.
- **Notificar nunca puede romper ni frenar la acción del usuario**: todo es fire-and-forget y los
  errores solo van a `console.warn`.

**Para probar sin tocar una campaña** (POST con token de sesión a
`…/functions/v1/notificar-correo`): `{"evento":"preview"}` devuelve el **HTML** sin enviar nada;
`{"evento":"prueba"}` lo **envía**, y solo a quien llama. `enviarCorreoDePrueba()` sigue exportada
en `emailNotifications.ts` sin que nadie la llame — devolver el botón de Ajustes es solo UI.

**La plantilla no se toca con criterio de página web:** tablas anidadas (Outlook renderiza con el
motor de Word), **estilos en línea** (Gmail borra el `<style>` en varios clientes; el `<style>` solo
lleva el `@media`, que es un extra), logo en **PNG** (los clientes no renderizan SVG) y el diseño
**no depende del logo** porque casi todos bloquean imágenes remotas. Al rasterizar
`public/fabrica-logo.svg` hay que **inyectarle `viewBox="0 0 1254 1254"`**: no lo trae, así que
cambiarle el tamaño lo *recorta* en vez de escalarlo (el primer intento salió en blanco).

**Un fallo que ya costó tiempo:** `error.context` de `functions.invoke()` es `any` y cambia según el
tipo de fallo — `Response` para un no-2xx, el `TypeError` crudo del fetch para un fallo de red/CORS.
Llamarle `.json()` a lo segundo tiraba una excepción que **rechazaba la promesa** y dejaba el botón
cargando para siempre. `motivoDelError()` comprueba `instanceof Response` antes de tocarlo, e
`invocar()` **siempre resuelve** (try/catch + timeout de 20s).

---

## Login y activación de cuentas

- Login real de Supabase Auth en `/login`. `App.tsx` manda toda ruta sin sesión a `/login` (salvo
  `/activar`) y `/login` → `/` con sesión. `authStore.initialize()` restaura la sesión; si hay
  sesión válida pero **sin fila enlazada en `usuarios_roles`, no se deja pasar**.
- Los usuarios sin `user_id` caen a su id de tabla como `userId`: siguen siendo **asignables** en
  tareas, pero `loginUser` los rechaza. En Ajustes se ven con el badge **"Sin acceso"** (se deriva
  de `userId === id`). Poner una contraseña a alguien "Sin acceso" **le crea la cuenta**.
- **"Nuevo Usuario" no crea acceso**, solo directorio: el Admin API exige service_role (imposible en
  el navegador) y `signUp` tampoco sirve porque el proyecto tiene `mailer_autoconfirm: false` y **no
  tiene SMTP propio**, así que nadie podría confirmar el correo. Por lo mismo, todo lo que crea
  cuentas usa `email_confirm: true`.
- **`/activar` — el link es COMPARTIDO, no uno por persona.** Se le planteó el riesgo al usuario
  (quien lo tenga y sepa el correo de un compañero puede tomar esa cuenta, y desde que el rol decide
  permisos, tomar una de Estratega/Soporte da gestión del equipo) y **eligió el link compartido**,
  con una **ventana de tiempo** como control. Lo que contiene la función: la ventana validada **en
  el servidor**, y que solo activa filas que ya existen **con `user_id` nulo** (no sirve para
  secuestrar una cuenta activa ni cambiarle la clave a nadie), y nunca acepta un rol desde el body.
  Si el `update` que enlaza falla, **borra el usuario recién creado** para no dejar una cuenta que
  existe en auth pero que el directorio no reconoce.
- **El correo que se escribe ahí va a un `ilike`, o sea que era un PATRÓN de búsqueda.** `%` y `_`
  son comodines: un `%netsat%` que matcheara una sola fila permitía activar la cuenta de un
  compañero **sin saber su correo**, y la respuesta devolvía su nombre. Hoy se valida la forma del
  correo (que además bloquea el `%`) y el valor se escapa con `comoLiteral()`. Se sigue usando
  `ilike` y no `eq` porque en la tabla los correos están escritos a mano y pueden traer mayúsculas.
  **Regla general: cualquier texto de usuario que llegue a un `.ilike()`/`.like()` hay que
  escaparlo.** El `_` se escapa en vez de rechazarse porque es legal en un correo real.
- La pantalla distingue "ese correo no está en el equipo" (404) de "esa cuenta ya está activa"
  (409). Eso permite tantear qué correos están en el directorio, pero se dejó a propósito: sin esos
  mensajes, quien se equivoca de correo no tiene forma de saber qué pasó. La mitigación es cerrar
  la ventana pronto.
- **La ventana se administra SOLO desde el SQL Editor de Supabase** (la tabla no tiene policies):
  ```sql
  update public.activacion_config set activo_hasta = '2026-08-07 23:59:59-05', updated_at = now();
  ```
  Cerrar de inmediato = ponerle una fecha pasada.

---

## Versión y aviso de actualización

`package.json` es la **única fuente de verdad**. `vite.config.ts` la lee con `readFileSync` y la
inyecta como `__APP_VERSION__` (+ `__BUILD_TIME__`, `__BUILD_ID__`), y emite `version.json` en cada
build. `src/lib/version.ts` concentra todo (las constantes se leen con `typeof __X__ !== 'undefined'`
para que el módulo no explote fuera de un bundle de Vite). El hook consulta con `cache:'no-store'`
al volver a la pestaña y cada 15 min, y **no hace nada en dev** (`/version.json` no existe hasta el
build).

- El aviso **también salta cuando cambia solo el build con el mismo número** (que es el caso normal
  acá), y entonces **no imprime el número** para no confundir.
- `applyUpdate()` limpia `caches` y actualiza los service workers antes de recargar: un
  `location.reload()` pelado dejaba al usuario viendo lo mismo y el aviso en bucle.
- `version.json` va con `Cache-Control: no-cache, must-revalidate`. Si el CDN lo cachea, **el aviso
  no aparece nunca y no da ninguna señal de error**.
- Publicar: `npm version patch|minor|major --no-git-tag-version` → entrada en `CHANGELOG.md` → push
  a `master`.
- La tabla `app_version` quedó **huérfana** (nadie la lee ni la escribe). El control de versiones es
  solo del backend: se actualiza en cada deploy.

---

## Otros detalles que muerden

- **El borrador del wizard** (`src/lib/campaignDraft.ts`) se autoguarda en `localStorage` cada 2 s y
  se ofrece en la lista de campañas. **Solo se descarta al crear la campaña o al pulsar
  "Descartar"** — antes `close()` lo borraba, así que el aviso nunca aparecía. `reset()` limpia el
  formulario en memoria, no el `localStorage`. Sigue siendo local al navegador: no viaja entre
  equipos.
- **Un clic fuera no cierra el wizard** (`onPointerDownOutside` + `onInteractOutside`): hay que
  frenar **los dos**, Radix dispara el cierre por vías distintas según sea puntero o foco/táctil.
  Escape se dejó vivo a propósito.
- **Nunca declarar un componente dentro de otro si envuelve inputs.** `Marco` estaba definido
  dentro de `ActivarPage`, así que cada render creaba un tipo nuevo, React remontaba el formulario
  en cada tecla y el `autoFocus` se llevaba el cursor.
- **Diagramas.** El de Flujo de trabajo es un árbol (`computeTreeLayout`: columna = profundidad,
  fila = hoja del subárbol) sobre CSS grid, con dos `<svg>` en **píxeles** por detrás (el área de
  ramas se mide con un `ResizeObserver`; `preserveAspectRatio="none"` deformaba las curvas e impedía
  puntas de flecha). Cada `<svg>` define **su propio** marker: los `id` son globales en el
  documento. Columnas con mínimo de 190px y scroll horizontal si no caben; el `ref` que exporta el
  PNG apunta al **contenido completo**, no al contenedor con scroll, para que la imagen salga
  entera. `pixelRatio: 1.25` (con 2, un diagrama de 1600px salía en 3200 y no cabía en pantalla).
- **`src/lib/interacciones.ts` es compartido** por el wizard (qué chips ofrece) y el diagrama (qué
  filtra al leer). Tenerlo solo en el wizard fue la causa de que el diagrama siguiera pintando
  interacciones que ya no se ofrecían. `INTERACCION_OPCIONES` conserva las 5 aunque un canal no las
  admita: es la lista de "qué es estándar", y sacar una haría que lo ya guardado reapareciera como
  chip personalizado.
- **Herramientas** (`BitlyLinkTool.tsx`): los 6 campos están **hardcodeados** en el frontend — el
  webhook `formulariolink` que iba a servir el schema **nunca existió**. Usa 2 webhooks de n8n:
  `crearlink` (POST, devuelve `{url, titulo, qrUrl}`) y `descargar-qr` (la URL ya viene armada del
  backend). La descarga del QR va por blob + `<a download>` porque el atributo `download` no se
  respeta en recursos cross-origin. Sus design tokens son **locales al componente** a propósito.
- **El sistema de correo viejo sigue ahí, muerto y aparte**:
  `src/services/notificationService.ts` + `supabase/functions/send-notification` (webhook n8n) son
  del kanban viejo, no de las campañas. Si se conecta algo de correo, es a `notificar-correo`.

---

## Verificación

- **Playwright**: el navegador está en `%LOCALAPPDATA%\ms-playwright\chromium-1228`. **`chromium
  .launch()` sin argumentos falla** — solo se descargó el Chromium "headed", no
  `chrome-headless-shell`. Hay que pasar `executablePath` apuntando a
  `chromium-1228/chrome-win64/chrome.exe`. El paquete `playwright` **no** está en el proyecto; se
  instala `playwright-core` aparte (no tiene postinstall que descargue navegadores).
- Lo normal es verificar **stubbeando la sesión y `factory_projects`** con `page.route`, para no
  escribir en la base real.
- **Trampas del stub que dejan la pantalla en blanco**: el nodo del flujo usa `label`, no `name`, y
  su `status` es `ProjectTaskStatus` (`pending`…), no `todo` — con cualquiera mal, `NodeCard`
  revienta con `Cannot read properties of undefined (reading 'cls')`. Las pestañas de la campaña
  **no son `role="tab"`** (hay que buscarlas por texto); las del diálogo de la tarea sí.
- `BriefDialog` **avanza solo al siguiente entregable de la cola** al aprobar, así que para aprobar
  varios basta con clicar "Aprobar" seguido.
- Para lógica pura (store, libs, helpers de las edge functions) sale más barato bundlear con esbuild
  y stubbear el cliente de Supabase que abrir un navegador. **Los stubs tienen que quedar
  `external`**: si esbuild los inlinea, la prueba y el código terminan con dos copias del módulo (y
  de la base de mentira) y todo falla por la razón equivocada.

---

## Historial reciente

Solo lo que sigue explicando el estado actual. Lo anterior está en el historial de git.

- **2026-07-29 (v1.9.1)** — se cerró el comodín del `ilike` en `activar-acceso` (permitía activar la
  cuenta de un compañero sin saber su correo) y se quitaron las policies duplicadas que anularon la
  ventana de 10 minutos de edición de comentarios. Auditoría de `pg_policies`: cero policies con
  `anon`.
- **2026-07-29 (v1.9.0) — revisión de seguridad.** Se cerró el acceso anónimo a
  `factory_projects`/`tasks`/`task_comments`; se saneó el HTML con DOMPurify; guardia de escritura
  obsoleta + relectura al volver a la pestaña; `roleId` correcto en las tareas que crea
  `activateNextStage` + respaldo por etiqueta en `isTaskOwnedBy`; reparación de números duplicados;
  limpieza de CR/LF en las cabeceras SMTP; typecheck a cero errores.
- **2026-07-29 (v1.8.x)** — número de campaña (`#7`) y código de tarea (`C1`); aviso de "campaña sin
  terminar" con Continuar/Descartar; el borrador ya no se borra al cerrar el wizard; el clic fuera
  no cierra. Se quitó el bloque "Flujo de trabajo de la interacción" del diagrama del ciclo
  (`accionDeInteraccion` quedó en `interacciones.ts` sin llamadores).
- **2026-07-28/29 (v1.4–1.7)** — la captura de interés es la única fuente del requerimiento
  (excluyente: Landing **o** Formulario, no los dos); interacciones recortadas por canal; correo a
  Gmail SMTP con cliente propio; plantilla responsive con logo; la cadena del flujo arrastra fecha y
  entregable de origen ("Paso anterior"); la tarea de Diseño se renombra al nacer.
- **2026-07-16/17** — `usuarios_roles` (directorio + roles en una sola tabla, 22 personas), login
  real, gestión de usuarios restringida a Estratega/Soporte, semáforo de fechas, `rewrites` en
  `vercel.json`.
- **Rediseño visual "Tremu ISO"** — en producción desde el 2026-07-11 (PR #1): acento `#009CF5`,
  Plus Jakarta Sans, sin modo oscuro, sin gradientes. El semáforo (`state-*`) se conservó porque
  comunica significado; `team-*`/`board-*` se neutralizaron a gris.

---

## Pendientes

### Hay que hacerlo (requiere tus credenciales)
- [ ] **Aplicar la migración `20260729010000_quitar-policies-duplicadas.sql`**
      (`supabase db push --linked`). Devuelve la ventana de 10 minutos para editar comentarios, que
      la migración anterior anuló sin querer.
- [ ] **Redesplegar `activar-acceso`** (`supabase functions deploy activar-acceso`) para que entre
      el escape del `ilike`. **Hasta que se despliegue, el comodín sigue vivo en producción.**
- [x] ~~Aplicar `20260729000000_cerrar-acceso-anonimo.sql`~~ — hecho el 2026-07-29 y **verificado**:
      sin sesión, SELECT devuelve 0 filas e INSERT da `42501` en las 3 tablas, y `pg_policies` no
      muestra ninguna policy con `anon`.
- [x] ~~Redesplegar `notificar-correo`~~ — hecho y verificado (401 sin token, con token basura y con
      la key anónima sin sesión).

### Credenciales que quedaron expuestas en chats
- [ ] Cambiar la contraseña de **`kelvin.trujillo@netsat.co`** (se compartió el 2026-07-29 para
      verificar el envío; es rol **Soporte**, o sea que **puede gestionar usuarios**).
- [ ] Cambiar la contraseña inicial de **`ktrujillo`** (`Colombia2026*`, en texto plano en un chat).
- [ ] **Revocar el access token de Supabase (`sbp_…`)** usado el 2026-07-16 — da acceso a **toda la
      cuenta**: https://supabase.com/dashboard/account/tokens
- [ ] Borrar la API key de **Resend** (`re_LDKrS…`, pegada en un chat el 2026-07-28). Ya no se usa
      para nada: https://resend.com/api-keys

### Accesos del equipo
- [ ] **Dar acceso a los otros 21** — hoy solo `ktrujillo` tiene cuenta; el resto sale con "Sin
      acceso". Se reparte el link de `/activar` y cada quien crea su contraseña. **NO verificado: la
      creación real de una cuenta por ahí** (probarlo habría creado un acceso de verdad en
      producción) — la primera persona que active es la prueba real, conviene acompañarla.
- [ ] **CERRAR la ventana de activación** cuando todos hayan entrado (hoy vence el **2026-08-07**).
      Ver el SQL en "Login y activación".
- [ ] **`debe_cambiar_password` no lo hace cumplir nadie** — es solo una columna (default `true` en
      los 22). Falta el gate en el login.
- [ ] "Nuevo Usuario" podría crear la cuenta de una: `create-access` ya existe, solo falta ofrecer
      el campo de contraseña en el diálogo de creación.
- [ ] Considerar **SMTP propio en Supabase Auth**: sin eso no habrá "olvidé mi contraseña".
      Verificar un dominio destraparía esto y de paso permitiría un remitente institucional en vez
      de un gmail (es un registro DNS que **no toca el correo de nadie**).

### Decidido, no hacer (para que nadie lo "arregle" de sorpresa)
- **Los adjuntos siguen públicos de lectura** — decisión del usuario el 2026-07-29. Ver Storage
  arriba.
- **Sin cabeceras de seguridad / CSP en `vercel.json`** todavía: se explicó la opción y quedó
  pendiente de decisión, no descartada.

### Deuda técnica y verificaciones
- [ ] **`react-router` 6.30.x tiene un aviso moderado** que solo se cierra subiendo a **7.x**
      (cambio mayor). Los reportes conocidos son de *framework mode*/SSR, que esta app no usa. Es
      una decisión aparte, no se hizo para no arriesgar el ruteo.
- [ ] `npm audit` deja avisos en **herramientas de build** (vite/esbuild/eslint). Cerrarlos pide
      vite 8 (mayor). No llegan al bundle.
- [ ] **Recordatorios por fecha por correo** — no puede salir del navegador: necesita un cron
      (pg_cron o Vercel Cron) que recorra `factory_projects` y junte las tareas rojas por persona.
      La regla ya existe en `src/lib/urgencia.ts`.
- [ ] Decidir qué hacer con el correo viejo (`notificationService.ts` + `send-notification`): o se
      borra, o se reescribe contra `notificar-correo`.
- [ ] Confirmar a mano el **round-trip de "Editar proyecto"** del ecosistema cíclico (etapas, ELMR,
      motor, `etapaId`/`siguienteEtapaId`): se creó y se vio en la misma sesión, no se reabrió.
- [ ] Probar **quitar un canal ya guardado** (desmarcar BTL/KAM/Call Center en "Editar proyecto") y
      confirmar que `syncCanalNodes` borra su nodo. La lógica es simétrica a
      `syncRequerimientoNodes` (ya probada) pero no se ejercitó.
- [ ] Confirmar **CORS** en los 2 webhooks n8n que se usan (`crearlink`, `descargar-qr`) y probar
      `BitlyLinkTool` contra n8n real (solo se verificó con mocks). Para el nombre del archivo del
      QR hace falta además `Access-Control-Expose-Headers: Content-Disposition`.
- [ ] Borrar la rama `origin/worktree-bitacora-rediseno-tremu` (su PR ya se mergeó).
- [ ] **RLS por rol** (más allá de la gestión de usuarios) sigue pendiente a propósito. Ya hay
      sesión real, así que es viable; ojo con el fallo silencioso.
