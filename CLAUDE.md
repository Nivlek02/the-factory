# The Factory — notas del proyecto

App interna de mercadeo (Vite + React + shadcn/ui + Zustand + Supabase). Desplegada en Vercel
en el team `nivlek02s-projects`, **dominio `https://tremubaq.vercel.app/`** (el proyecto se
renombró a `tremu`; el viejo `the-factory-seven.vercel.app` ya da 404).
Repo: `Nivlek02/the-factory`, rama de producción `master`.

## Estado de infraestructura

- **Supabase activo:** proyecto `yvzpfdwswmjcnipcgclg`. El anterior (`mjjhssqclqxrxpbbalft`) **ya
  no existe** — no está en la cuenta, así que los datos que tuviera son irrecuperables. Solo se
  migró el esquema (las 25 migraciones), nunca los datos.
- **Desde 2026-07-16 la app SÍ usa Supabase Auth real** (login en `/login`, ver punto 29). Ya no
  hay `DEMO_USER`. Matices importantes:
  - Solo `ktrujillo` tiene cuenta en `auth.users`. Los otros 21 de `usuarios_roles` tienen
    `user_id` nulo: aparecen en la lista de equipo y son asignables, pero no pueden entrar.
  - **El resto de las tablas sigue con RLS `TO anon, authenticated`** y no se tocó. La sesión no
    restringe nada fuera de `usuarios_roles`. Si esas policies se cierran a `authenticated`, hay que
    verificar que todo el tráfico ya vaya autenticado.
  - **`usuarios_roles` es la excepción**: SELECT para cualquier autenticado, pero escribir solo si
    el rol es Estratega o Soporte (vía `puede_gestionar_usuarios()`, SECURITY DEFINER — ver punto
    30). Es el único lugar donde el rol **decide permisos** y no es solo informativo.
  - Regla de siempre: un insert rechazado por RLS **falla en silencio** (solo se loguea en la
    consola del navegador, nunca se ve en la UI). Y ojo con el UPDATE: RLS **filtra filas en vez de
    rechazar el comando**, así que sin permiso vuelve *sin error* y con 0 filas — hay que mirar el
    conteo con `.select()`, no solo `error`.
- **`vercel.json` necesita el bloque `rewrites`** para que las rutas profundas (`/login`,
  `/settings`, `/board/:id`) no den 404 — `dist/` solo contiene `index.html`. No lo quites.
  El rewrite excluye `assets/` y `version.json`: **cualquier archivo estático nuevo en la raíz hay
  que excluirlo ahí o Vercel devolverá `index.html` en su lugar** (ya pasó con `version.json`).
- Vercel env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`) se gestionan por API con
  un token personal (`vcp_...`, no guardado aquí). Ojo al pegar keys manualmente en el dashboard:
  ya pasó una vez que un salto de línea se convirtió en espacios en medio del JWT y lo invalidó.
  Los valores en `.env` van **entre comillas** — al parsearlos hay que quitarlas, y no partir por
  `=` a secas porque los JWT llevan `=` de padding.
- **Ojo con el typecheck:** `npx tsc --noEmit` a secas **no compila nada** (el `tsconfig.json` raíz
  tiene `"files": []` + `references`) y da exit 0 falso. El real es
  `npx tsc --noEmit -p tsconfig.app.json` → hoy salen **4 errores preexistentes** (3 en
  `SettingsPage.tsx` por `addUser`/`updateUser`/`deleteUser`, 1 en `CreateProjectWizard.tsx:376`).

## Bitácora

### 2026-07-07 / 2026-07-08

1. **Migración de Supabase a proyecto nuevo** (`yvzpfdwswmjcnipcgclg`)
   - Se aplicaron las 25 migraciones existentes (`supabase db push --linked --include-all`).
   - Se regeneraron los tipos (`src/integrations/supabase/types.ts`).
   - `.env` y `supabase/config.toml` actualizados.

2. **Fix: `factory_projects` no guardaba nada** (commit `a1af8ad`)
   - Causa: esa tabla tenía RLS `TO authenticated` mientras el resto de la app (sin auth real)
     necesita `TO anon, authenticated`. Migración nueva
     `20260707120000_allow-anon-factory-projects.sql` corrige las policies.

3. **Fix: env var corrupta en Vercel**
   - `VITE_SUPABASE_PUBLISHABLE_KEY` tenía dos espacios insertados en medio del JWT (típico de
     copy-paste desde un bloque de código con wrap). Causaba `401 Invalid API key` en el navegador.
   - Se corrigió por la API de Vercel directamente (evitando otro copy-paste) y se forzó redeploy.

4. **Fix: wizard de creación de proyecto** (commit `5cf5185`)
   - Bug: si no se seleccionaba ningún requerimiento, `filterTareasByRequerimientos` devolvía
     todas las tareas sin filtrar → se creaban las tareas de "Landing" y "Formulario de
     inscripción" a la vez aunque el usuario no hubiera elegido ninguna.
   - Ahora es obligatorio elegir **Landing** o **Formulario de inscripción** antes de avanzar o
     crear el proyecto (`src/pages/factory/CreateProjectWizard.tsx`).

5. **Feature: flujo por defecto en "Construir estrategia"** (commit `90d26c8`)
   - Cada proyecto nuevo arranca con el esquema visual:
     `Copys → Aprobación de copy (Estratega) → Diseño de piezas → Aprobación de diseño (Estratega)
     → Envío de acciones (Gestor de canales)`.
   - Implementado en `buildDefaultStrategyNodes()` dentro de `src/store/factoryStore.ts`
     (usado por `addProject`). Se agregó el stage type `'aprobacion'` a la paleta en
     `src/pages/factory/MapTab.tsx` (icono `CheckCircle2`) para poder seguir ramificando el flujo
     a mano.
   - Proyectos ya existentes no se tocan (solo aplica a los creados de ahora en adelante).
   - **Pendiente de verificar visualmente:** el usuario iba a confirmarlo en producción — la
     verificación con Playwright no se pudo completar en esta máquina (la descarga/extracción de
     Chromium se quedó atascada ~241MB sin avanzar, probablemente Windows Defender escaneando
     `chrome.dll`). Typecheck y build sí pasaron limpio.

6. **Refactor: pestañas del proyecto — Flujo de trabajo / Dashboard de métricas / Loop / aprobación
   dentro de la tarea** (commit `54923a6`)
   - La vista de proyecto tenía una sola pestaña "Loop" que mezclaba el diagrama de ciclo, las
     tarjetas de métricas y el tablero de "Construir estrategia". Se separó en tres pestañas:
     **Flujo de trabajo** (`WorkflowTab`, solo el tablero de Construir estrategia), **Dashboard de
     métricas** (`MetricsDashboardTab`) y **Loop** (`LoopTab`, solo el diagrama del ciclo). Overview
     y Equipo quedan igual. Todo en `src/pages/factory/MapTab.tsx` / `FactoryPage.tsx`.
   - Se eliminó el stage type `'aprobacion'` como nodo aparte del flujo (ya no está en la paleta ni
     en `buildDefaultStrategyNodes`). Ahora **todo entregable pasa por revisión dentro de su propia
     tarea**: `hasApprovalStage` en `ContentBriefPanel` (`StrategyBriefPanels.tsx`) quedó fijo en
     `true`, así que el mismo `BriefDialog` de la tarea maneja pending → in_review → aprobar/corregir,
     sin salir a un nodo de "Aprobación" separado. Se borraron `ApprovalQueuePanel`,
     `findApprovalNodeFor` y `findContentNodeFor` por quedar sin uso.
   - **Migración en lectura:** `stripApprovalNodes()` en `factoryStore.ts` (`rowToProject`) limpia
     automáticamente los nodos `aprobacion` que ya estuvieran guardados en Supabase (de la feature
     del punto 5) y reconecta el `dependsOn` de sus dependientes al nodo previo, para no dejar
     huecos en proyectos ya creados.
   - Typecheck y `npm run build` pasaron limpio (los 4 errores de `tsc` que aparecen en
     `CreateProjectWizard.tsx` y `SettingsPage.tsx` son preexistentes, no relacionados). Pusheado
     directo a `master` a pedido del usuario para verlo en el deploy de Vercel.

7. **Ajustes de Flujo de trabajo, historial de aprobación y roles fijos** (commit `90f9848`)
   - Tablero de "Flujo de trabajo" en una sola línea con scroll horizontal (antes envolvía en
     columnas apiladas en mobile); nodo "Inicia el proyecto" más pequeño. Se quitó el texto "Sin
     asignar" del preview de nodos (`NodeCard` en `MapTab.tsx`).
   - Se quitó el panel/paleta para agregar etapas a mano ("Construir estrategia" con botones
     Formulario/Landing/Copys/etc.) — las etapas ya se generan automáticamente desde
     `buildDefaultStrategyNodes` y el auto-build por canales/loops, no hacía falta.
   - **Historial de cambios:** `TaskComment` (`factoryStore.ts`) tiene ahora `isSystemEvent?:
     boolean`. `BriefDialog` (`StrategyBriefPanels.tsx`) registra automáticamente entradas de
     historial con fecha/hora al enviar a revisión y al aprobar (antes solo se guardaba el
     comentario de corrección al rechazar). Se muestra fecha/hora en todos los comentarios, tanto
     en el diálogo editable como en `DeliverableSummary` (solo lectura).
   - **Activar siguiente tarea al aprobar:** `activateNextStage()` en `StrategyBriefPanels.tsx` —
     al aprobar un entregable de Copys, crea automáticamente una tarea pendiente en el nodo de
     Diseño (siguiente en la cadena `dependsOn`), sin mover el entregable original.
   - **Roles fijos:** se reemplazó la creación libre de roles (nombre + responsabilidades a mano)
     por un selector de los 5 roles asignables a un proyecto: Copywriter, Diseñador, Gestor de
     canales, Estratega, Soporte (`ASSIGNABLE_ROLE_IDS` en `rolesStore.ts`). Los roles internos
     `social`/`seo`/`produccion` se mantienen (sin exponer en el selector) porque
     `CreateProjectWizard.tsx` todavía los usa para la generación automática de tareas por canal
     (Meta Ads, RRSS, etc.) — **no tocar sus `id`s** o se rompe esa automatización.
     `rolesStore` subió a `version: 2` para que el `migrate` renombre las etiquetas ya persistidas
     en `localStorage` (Copy→Copywriter, Diseño→Diseñador) y agregue el rol Soporte.
   - Se quitó la gestión de "Responsabilidades por rol" de Ajustes (`SettingsPage.tsx`) y el
     conteo "X req." en Descripción general (antes Overview) — esas responsabilidades se van a
     manejar desde el backend, a pedido del usuario.
   - **No se pudo verificar visualmente con Playwright** — intento de instalar el paquete
     (`npx playwright`) falló por `ECONNRESET` de npm en esta máquina; solo typecheck + build.

8. **Rol de equipo unificado (Copywriter/Diseñador/Gestor de canales/Estratega/Soporte) + diagrama
   ramificado de Flujo de trabajo + Pauta en redes sociales**
   - **AppRole pasó a ser puramente informativo.** `authService.ts`: `AppRole` ahora es
     `'copy' | 'diseno' | 'gestor_canales' | 'estratega' | 'soporte'` (antes
     `mercadeo/disenador/copy/manager/seo`), con `ROLE_LABELS` = Copywriter/Diseñador/Gestor de
     canales/Estratega/Soporte — igual al catálogo de `rolesStore.ts`. Se quitó TODA la lógica de
     acceso a tableros por rol (Index.tsx, BoardPage.tsx, TaskDetailModal.tsx, TaskCard.tsx,
     CreateTaskModal.tsx, ReportsPage.tsx, notificationService.ts, useSupabaseTasks.ts,
     AppSidebar.tsx) — ahora todos los usuarios ven todos los tableros y pueden hacer cualquier
     acción, a pedido explícito del usuario ("elimina eso de acceso a tableros... solo
     informativo"). `DEMO_USER.role` pasó de `'mercadeo'` a `'estratega'`.
   - **IMPORTANTE — no se tocó el schema de Supabase.** La columna `user_roles.role` en Postgres
     sigue siendo el enum viejo (`mercadeo/disenador/copy/manager/seo`) — falta una migración para
     ampliarlo. `authService.createUser`/`updateUserRole` llevan un `role as any` con nota explicando
     esto. **Además, "Nuevo Usuario"/"Editar Usuario" en Ajustes ya estaban rotos antes de esta
     sesión**: `SettingsPage.tsx` llama a `addUser`/`updateUser`/`deleteUser` desde `useAuthStore()`,
     pero esos métodos no existen en `authStore.ts` (son los 3 errores de `tsc` que aparecen desde
     el principio). El selector de rol ahora muestra las etiquetas correctas, pero crear/editar
     usuarios de verdad sigue sin funcionar — es un bug preexistente, no se intentó arreglar (fuera
     de alcance de este pedido).
   - **Diagrama de Flujo de trabajo rediseñado como flowchart ramificado** (antes: columnas por
     profundidad con wrap). Nuevo `computeLanes()` en `MapTab.tsx` agrupa los nodos en cadenas
     lineales por rama (cada raíz sin `dependsOn` inicia una rama) y las ordena
     Landing/Formulario (arriba) → Copys-Diseño-Envíos (centro) → Pauta (abajo) vía `LANE_RANK`.
     El nodo "Inicia el proyecto" queda a la izquierda centrado verticalmente; un `<svg>` con
     curvas Bézier (`viewBox` + `preserveAspectRatio="none"`, sin JS de medición) conecta el inicio
     con la primera tarjeta de cada rama; dentro de cada rama, flechas rectas entre nodos
     consecutivos. El ancho de cada tarjeta es un porcentaje fijo (`100/maxLaneLength`) del
     contenedor — todo fluido, sin `overflow-x/y`, sin scrollbar. `NodeCard` no se tocó (mismo
     estilo). **No se pudo verificar visualmente** (ver nota de Playwright abajo) — revisar con
     cuidado en producción, especialmente con 1 sola rama vs. 3 ramas.
   - **Pauta en redes sociales**: se renombró el requerimiento `pauta_digital` ("Pauta digital" →
     "Pauta en redes sociales") en `CreateProjectWizard.tsx`. Antes este requerimiento NO generaba
     ningún nodo en Flujo de trabajo (el efecto de auto-build por canales nunca corría porque
     `buildDefaultStrategyNodes()` ya sembraba 3 nodos siempre, así que su guard `nodes.length > 0`
     cortocircuitaba de inmediato — ese auto-build lleva tiempo siendo código muerto). Ahora
     `buildDefaultStrategyNodes(requerimientos)` en `factoryStore.ts` recibe los requerimientos del
     wizard y agrega nodos raíz condicionalmente: `landing`/`formulario` (rol Gestor de canales) y
     `pauta` (rol **Social Media**, explícito a pedido del usuario — no es uno de los 5 roles de
     equipo, se mantiene como etiqueta especializada igual que en `buildFabricaBriefs`).
   - **No se pudo verificar visualmente con Playwright** — el intento anterior falló por
     `ECONNRESET`; esta vez `npx playwright install chromium` sí conectó y empezó a descargar
     (~183 MB) pero iba muy lento (~10% en 2 min) y no se esperó a que terminara. Vale la pena
     reintentar en otra sesión si se quiere confirmar visualmente antes de tocar producción de
     nuevo.

### 2026-07-08

9. **Playwright por fin instalado en esta máquina** — Chromium (`chromium-1228`, ~416 MB) quedó
   completo en `%LOCALAPPDATA%\ms-playwright`. Importante para próximas sesiones: `chromium.launch()`
   sin argumentos falla (`Executable doesn't exist ... chromium_headless_shell`) porque solo se
   descargó el Chromium "headed" normal, no el paquete separado `chrome-headless-shell`; hay que
   pasar `executablePath` apuntando a `chromium-1228/chrome-win64/chrome.exe` explícitamente.

10. **Fix: nodo "Formulario de inscripción" huérfano en Flujo de trabajo** (resuelve el punto 1
    del pendiente de arriba) — causa raíz: `updateProject` nunca tocaba `strategyNodes`, solo
    `fabricaBriefs`, así que al editar un proyecto y desmarcar un requerimiento (`formulario`,
    `landing` o `pauta_digital`) la tarea real desaparecía del Equipo pero el nodo visual seguía
    en Flujo de trabajo para siempre. Se agregó `syncRequerimientoNodes()` en `factoryStore.ts`
    (cerca de `patchProject`), que en cada `updateProject` con `requerimientos` reconcilia los
    nodos raíz `landing`/`formulario`/`pauta` contra la lista actual — agrega los que falten, quita
    los que ya no estén — sin tocar la cadena Copys → Diseño → Envíos ni nodos agregados a mano.
    **Verificado end-to-end con Playwright:** crear proyecto con Landing + Formulario → el nodo
    aparece; editar y desmarcar Formulario → el nodo desaparece y Landing queda intacto.

11. **Plan de canales: nuevos canales + íconos + tabla responsive + hora** (`CreateProjectWizard.tsx`)
    - Lista de canales reemplazada a pedido del usuario: se quitó `Meta Ads` (se separó en
      `Facebook` e `Instagram`), se agregó `TikTok`, se quitó `RRSS` y se agregó `Google Ads`, y se
      sumaron `BTL`, `KAM` y `Relacionamiento`. Lista final: Correo, WhatsApp, SMS, Facebook,
      Instagram, TikTok, Google Ads, Call Center, BTL, KAM, Relacionamiento (`CHANNELS` en
      `CreateProjectWizard.tsx`). Se actualizó `buildFabricaBriefs` (switch por canal) y
      `canalInvolvesRole` para los canales nuevos — mapeo de roles es una decisión razonable pero
      no confirmada con el usuario: Facebook/Instagram/TikTok/Google Ads → Social Media, BTL →
      Estratega + Diseñador, KAM → Estratega, Relacionamiento → Gestor de canales.
    - El selector de canal pasó de `<select>` nativo a `Select`/`SelectItem` de shadcn con ícono
      lucide-react por canal (Mail, MessageCircle, Smartphone, Facebook, Instagram, Music, Search,
      Phone, Store, Briefcase, Handshake).
    - **Fix fecha cortada ("10 de ....")**: la columna "Día" estaba fija en `60px` en el grid,
      insuficiente para el texto `formatDisplay()`. Ahora fecha y hora comparten un contenedor con
      ancho suficiente.
    - **Nuevo: selector de hora.** Se agregó `hora: string` a `CanalRow` (`factoryStore.ts`) y un
      `<input type="time">` oculto igual al patrón ya usado para la fecha (click → `showPicker()`),
      al lado del selector de fecha.
    - **Responsive:** la fila de cada canal es `flex flex-col` (tarjeta apilada) en mobile y
      cambia a `md:grid` con columnas fijas desde `768px`. El header de la tabla se oculta en mobile
      (`hidden md:grid`) porque cada campo ya es autodescriptivo (placeholder/ícono).
    - **Verificado con Playwright:** los 11 canales aparecen con su ícono en el dropdown, fecha
      "10 de sep" y hora "14:30" se ven completos sin cortarse, y a 375px de ancho la fila se apila
      en tarjeta sin overflow horizontal ni romper el diseño del diálogo.
    - Typecheck (`tsc --noEmit`) y `npm run build` pasan limpio.

12. **Herramientas: iframe de n8n reemplazado por formulario JSON-driven ("Acortar link con
    Bitly")** — `HerramientasPage.tsx` ya no embebe el HTML crudo que devolvía el webhook de n8n
    (`https://n8n.camarabaq.org.co/webhook/bitly+qr+links`), ni las opciones "Crear link de
    descarga"/"Crear formulario" (a pedido del usuario, se quitaron del alcance por completo).
    - Nuevo componente autocontenido `src/components/tools/BitlyLinkTool.tsx`: al montar hace
      `GET https://n8n.camarabaq.org.co/webhook/formulariolink` (schema `{ title, fields[], 
      submitLabel }`), pinta el formulario 100% desde ese JSON (ningún campo hardcodeado — orden,
      labels, placeholders, requerido y tipo salen del schema) y al enviar hace
      `POST https://n8n.camarabaq.org.co/webhook/crearlink` con los valores capturados, esperando
      `{ url, titulo }`. Sin recargar la página.
    - Estados cubiertos: loading del schema, error de schema con botón "Reintentar", formulario con
      validación (requerido + URL válida vía `new URL()`), loading del submit, error de submit
      (con los valores del usuario preservados, no se pierden), éxito con tarjeta de resultado +
      botón "Copiar link" (muestra "¡Link copiado!" 2s vía `navigator.clipboard`) + "Generar otro
      link" que resetea sin recargar.
    - **Los design tokens del HTML de n8n (Open Sans, fondo radial `#eef3ff`, sombras
      `rgba(80,112,255,.18)`, botón píldora con gradiente `#2563ff→#4c8dff`, etc.) se mantienen
      LOCALES al componente** (objeto `T` + inline styles), no se tocó el theme global
      (`index.css` `:root`/`.dark`) — son visualmente distintos del resto de la app (navy/Inter) y
      mezclarlos en las CSS vars globales habría afectado otras pantallas. Solo se agregó `Open
      Sans` al mismo `@import` de Google Fonts que ya cargaba Inter/Space Grotesk/Baloo 2.
    - **Pendiente de confirmar con el usuario: CORS en n8n.** El iframe anterior no tenía problema
      de CORS (carga un documento completo, no hace fetch); el nuevo componente sí hace
      `fetch()` desde el navegador a ambos webhooks, así que ambos nodos de n8n necesitan responder
      con headers `Access-Control-Allow-Origin` (o "Allow CORS" activado en el nodo Webhook) o el
      fetch fallará con un error de CORS que ni siquiera llega al `catch` como un mensaje claro —
      no se pudo probar contra el n8n real desde esta sesión.
    - Verificado con Playwright mockeando ambos endpoints (`page.route`): loading, formulario
      renderizado desde el JSON, validación de campo requerido, validación de URL inválida,
      submitting, éxito, copiar, reset, error de schema con reintentar, error de submit con datos
      preservados, y vista mobile (375px) — todos los estados se ven correctos. No se probó contra
      los webhooks reales de n8n (`formulariolink`/`crearlink`), solo con respuestas simuladas que
      siguen el contrato JSON acordado.
    - Typecheck y `npm run build` pasan limpio.

13. **Herramientas: descarga de código QR** — el contrato de `POST .../crearlink` cambió: ahora
    devuelve `{ url, titulo, qrUrl }` (antes solo `url`/`titulo`). `BitlyResult` en
    `BitlyLinkTool.tsx` suma `qrUrl?: string`. La tarjeta de éxito agrega un segundo botón
    "Descargar código QR" (estilo pill outline, debajo del botón de "Copiar link") que hace
    `fetch(result.qrUrl)` — la URL ya viene armada desde el backend
    (`https://n8n.camarabaq.org.co/webhook/descargar-qr?link=<link codificado>`), el frontend no
    arma query params — y fuerza la descarga automática del archivo vía blob +
    `<a download>` (no un simple `<a href=... download>` directo, porque el atributo `download` no
    se respeta de forma confiable en recursos cross-origin sin blob). El nombre del archivo sale
    del header `Content-Disposition` si n8n lo manda; si no, se arma uno genérico
    (`codigo-qr.<ext>`) a partir del `Content-Type` de la respuesta.
    - También se cambió el subtítulo de la página de "Acortar link con Bitly" a "Crear código QR
      con métricas de seguimiento" (`HerramientasPage.tsx`), reflejando que ahora es la única
      herramienta y su propósito real es el QR con tracking, no solo el link corto.
    - El schema de campos (`GET .../formulariolink`) puede seguir cambiando del lado de n8n (ej.
      cambiar `utm_content` por `utm_term`, como pidió el usuario en esta ronda) **sin tocar el
      frontend** — es exactamente el punto de que el formulario sea 100% JSON-driven. Se verificó
      con un mock de schema que incluye `utm_term` en vez de `utm_content` y renderizó correcto sin
      cambios de código.
    - **CORS sigue pendiente de confirmar en n8n**, y ahora aplica también a
      `webhook/descargar-qr` (tercer endpoint al que el frontend le hace `fetch()` directo). Nota
      adicional: el header `Content-Disposition` requiere que n8n exponga
      `Access-Control-Expose-Headers: Content-Disposition` para que el navegador se lo entregue al
      JS entre orígenes distintos — si no, el nombre de archivo cae al fallback genérico (no rompe
      la descarga, solo el nombre sugerido).
    - Verificado con Playwright mockeando los 3 endpoints: formulario con `utm_term`, éxito con
      ambos botones, descarga real capturada vía `page.waitForEvent('download')`, y estado de error
      del QR (500) con mensaje inline sin romper "Copiar link" ni "Generar otro link". No probado
      contra n8n real.
    - Typecheck y `npm run build` pasan limpio.

14. **Fix: rol "Producción" fantasma en Equipo + Landing/Formulario mal atribuidos** — el usuario
    reportó que crear/editar una tarea generaba un rol "Producción" visible en la pestaña Equipo,
    y que "Landing page" debía ser responsabilidad de Gestor de canales y verse en el nodo
    correspondiente de Flujo de trabajo (igual para Formulario de inscripción).
    - **Causa raíz:** `rolesStore.ts` tenía `produccion.tareas = ['Landing page']` (rol interno, no
      asignable desde la UI pero igual "activo"), y `CreateProjectWizard.buildFabricaBriefs`
      inyectaba esa tarea sin condición cuando el requerimiento "Landing" estaba seleccionado (loop
      "Tareas configuradas desde Ajustes", `role.id === 'produccion' || 'diseno'`). El resultado
      (`FabricaBriefItem.roleLabel = 'Producción'`) fluye directo a `project.fabricaBriefs`, y
      `TeamTasksTab` (pestaña Equipo) agrupa la "Hoja de fábrica" por `roleLabel` sin filtrar contra
      `ASSIGNABLE_ROLE_IDS` — así que cualquier rol interno que se cuele en un brief aparece como
      tarjeta propia. Este efecto se dispara cada vez que se recalcula `fabricaBriefs`, lo cual pasa
      en cada `useEffect` del wizard — o sea, tanto al crear como cada vez que se reabre "Editar
      proyecto" y se toca algo (de ahí "creé una tarea nueva y me creó un rol").
    - **Fix:** se quitó `'produccion'` del loop en `CreateProjectWizard.tsx` (solo `'diseno'` sigue
      ahí) y de `REQ_ROLE_TAREAS.landing`; se agregó un bloque explícito, simétrico al de
      "Formulario de inscripción", que crea la tarea "Landing page" con
      `roleId: 'gestor_canales'` sin depender de que exista una fila de canal (antes el único
      camino real hacia un `Landing`-tarea de Gestor de canales pasaba por el switch de
      Correo/WhatsApp/SMS, así que elegir solo "Landing" sin ningún canal no generaba nada para ese
      rol). `rolesStore.ts`: `DEFAULT_TAREAS.produccion` quedó en `[]` (cosmético — no afecta a
      quien ya tenga el rol persistido en su `localStorage`, el fix real vive en el wizard). El rol
      `produccion` en sí no se eliminó del catálogo (su `id` en teoría podría usarse en otro lado,
      y `ASSIGNABLE_ROLE_IDS` ya lo excluía correctamente).
    - **Nodos de Flujo de trabajo ahora muestran los entregables reales** — `BRIEF_DRIVEN_STAGES`
      (`MapTab.tsx`) suma `'landing'` y `'formulario'` (antes solo `copys`/`diseno`/`envios`), y
      ambos reusan `ContentBriefPanel` (ya genérico — RichText + adjuntos + aprobación — no hizo
      falta un panel nuevo). El punto fino: `landing`/`formulario`/`envios` comparten
      `roleLabel: 'Gestor de canales'` en sus `StrategyNode`, así que un simple
      `b.roleLabel === node.roleLabel` (como ya usan copys/diseno, donde el rol es único) mezclaría
      las tareas de los tres nodos. Se amplió `briefsForNode` (`StrategyBriefPanels.tsx`) para que,
      además del match por `currentNodeId`/`roleLabel`, desambigüe por texto de la tarea cuando no
      hay `currentNodeId` todavía: `envios` → `isCanalBrief` (ya existía como filtro manual en el
      caller, ahora vive adentro de `briefsForNode`), `landing` → `tarea.includes('Landing')`,
      `formulario` → `tarea.includes('Formulario de inscripción')`. Los entregables creados a mano
      desde el propio nodo (`currentNodeId` seteado) siguen matcheando sin este filtro adicional,
      así que una "Nueva tarea" con texto libre en el nodo Landing no desaparece por no contener la
      palabra "Landing". Se simplificaron los dos call-sites en `MapTab.tsx`
      (`tasksByNodeId`/`briefPendingCount`) y `DeliveryBriefPanel`, que ya no necesitan re-filtrar
      manualmente por fuera.
    - **Importante — no se limpió el dato ya persistido.** Si un proyecto ya tenía el brief
      "Landing page" con `roleLabel: 'Producción'` guardado en Supabase antes de este fix, la
      tarjeta "Producción" en Equipo sigue apareciendo hasta que alguien vuelva a abrir "Editar
      proyecto" en ese proyecto y le dé "Guardar cambios" — `buildFabricaBriefs` recalcula
      `fabricaBriefs` completo en cada guardado del wizard, así que ese siguiente guardado ya lo
      corrige solo, sin necesidad de tocar la base de datos a mano.
    - **Riesgo pre-existente detectado pero NO tocado en esta sesión** (fuera de alcance del
      pedido): `buildFabricaBriefs` reconstruye `fabricaBriefs` **completo** desde cero cada vez que
      se guarda el wizard de edición — genera IDs nuevos y no preserva `deliverableContent`,
      `comments`, `workflowStatus`, `currentNodeId`, etc. de entregables que ya hubieran avanzado
      por "Flujo de trabajo". Si el usuario edita un proyecto ya avanzado (con copys/diseños ya
      aprobados, por ejemplo) y guarda desde el wizard, en teoría se perdería ese progreso. No se
      confirmó si esto ya se manifestó en producción; requeriría un rediseño (diff/merge en vez de
      reemplazo) que no estaba pedido — dejarlo anotado para revisar si se reporta.
    - Verificado con Playwright: proyecto nuevo con Landing + Formulario → pestaña Equipo muestra
      una sola tarjeta "Gestor de canales" con "Landing page" y "Formulario de inscripción básico"
      (cero tarjetas "Producción"); nodo "Landing" en Flujo de trabajo muestra solo "Landing page"
      (1 pendiente, Gestor de canales); nodo "Formulario de inscripción" muestra solo "Formulario
      de inscripción básico" — sin mezclarse entre sí ni con Envíos.
    - Typecheck y `npm run build` pasan limpio.

15. **Herramientas: pantalla inicial con botón "Crear QR con métricas de seguimiento (Utms)"** —
    a pedido del usuario, `BitlyLinkTool.tsx` ya no trae el schema del formulario automáticamente
    al montar; ahora arranca en un estado `idle` con una tarjeta + botón, y el `GET
    .../formulariolink` solo se dispara al hacer clic (nuevo estado inicial en el union `Status`,
    se quitó el `useEffect` que llamaba `loadSchema()` en mount). Verificado con Playwright
    interceptando la ruta: confirmado que el fetch del schema NO ocurre hasta el clic.
    - **Placeholders de guía**: se agregó `DEFAULT_PLACEHOLDERS` (link/titulo/utm_source/
      utm_medium/utm_campaign/utm_term) como *fallback* — solo se usa cuando el campo del schema no
      trae su propio `placeholder` (`field.placeholder ?? DEFAULT_PLACEHOLDERS[field.name]`). Esto
      no reintroduce hardcodeo de campos: si n8n cambia o quita un campo, simplemente no hay
      fallback para ese `name` y no pasa nada; el schema remoto sigue siendo la única fuente de qué
      campos existen.
    - Typecheck y `npm run build` pasan limpio.

16. **Reversión: el formulario de Bitly/QR ya NO es JSON-driven — los campos quedan hardcodeados
    en el frontend** — el usuario confirmó que `https://n8n.camarabaq.org.co/webhook/formulariolink`
    **no existe** (nunca se implementó del lado de n8n), así que toda la arquitectura de "schema
    remoto" de los puntos 12/13/15 quedó reemplazada. `BitlyLinkTool.tsx`:
    - Se borró `SCHEMA_URL`, la interfaz `FormSchema`, `loadSchema()` y todo el fetch GET. Los 6
      campos (`link`, `titulo`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, con sus
      labels/placeholders/requerido) ahora viven en una constante local `FIELDS: FormField[]` en el
      propio componente — es la única fuente de verdad de qué campos tiene el formulario.
      `DEFAULT_PLACEHOLDERS` (del punto 15) se fusionó directamente en `FIELDS` ya que no hace
      falta el mecanismo de *fallback* sin un schema remoto que sobreescribir.
    - Sigue igual: `POST .../crearlink` con los 6 campos, respuesta `{ url, titulo, qrUrl }`,
      tarjeta de éxito con copiar + descargar QR (puntos 12/13, sin cambios en esa parte).
    - El botón inicial "Crear QR con métricas de seguimiento (Utms)" del punto 15 ya no dispara un
      fetch al hacer clic — simplemente cambia el estado local a `'form'` (ya no hay
      `'loading-schema'`/`'error-schema'` en el union `Status`, se simplificó a
      `'idle' | 'form' | 'submitting' | 'error-submit' | 'success'`).
    - **Fix del botón "fuera del diseño"**: con `height` fijo (50px) y el texto largo
      ("Crear QR con métricas de seguimiento (Utms)") envolviendo a dos líneas en viewports
      angostos, el ícono quedaba descentrado/asomado fuera del pill. Se extrajo un componente
      compartido `PillButton` (usado también por "Copiar link" y "Descargar código QR") que usa
      `padding` en vez de `height` fijo — el botón crece con el contenido en vez de recortarlo — y
      el ícono lleva `shrink-0` para no aplastarse cuando el texto envuelve.
    - Verificado con Playwright: confirmado que `formulariolink` nunca se llama (se interceptó y
      abortó la ruta a propósito, cero requests); formulario con los 6 campos correctos sin
      depender de red; botón inicial ya no se ve roto en 900px ni en mobile (375px, mismo problema
      de sidebar preexistente y ya documentado, no relacionado a este fix); flujo completo
      (idle → form → submit → éxito con copiar/descargar) intacto.
    - Typecheck y `npm run build` pasan limpio.

17. **Fix: entregable de Landing/Formulario debe ser un campo URL, no rich text** — el usuario pidió
    que el entregable de los nodos "Landing" y "Formulario de inscripción" en Flujo de trabajo sea
    "un campo de texto con el URL" y quede guardado ahí. `BriefDialog` (`StrategyBriefPanels.tsx`)
    usaba siempre el mismo `RichTextEditor` (WYSIWYG) para cualquier tipo de entregable — se agregó
    `isUrl = isUrlBrief(brief.tarea)` (reusa el helper que ya existía en `DeliverableSummary.tsx`,
    antes solo se usaba en la vista de solo-lectura) y, cuando es `true`, la vista editable ahora
    muestra un `<Input type="url">` simple (sin adjuntos) en vez del editor enriquecido, con
    validación (`isValidUrl`, mismo patrón que `BitlyLinkTool.tsx`) que deshabilita "Enviar a
    aprobación" hasta que el valor sea una URL válida. Sigue guardando en el mismo campo
    `deliverableContent` de siempre, así que la vista de solo-lectura (`DeliverableSummary`, que ya
    tenía el branch `isUrlBrief` desde antes) no necesitó cambios — ya renderizaba el link
    correctamente, solo faltaba que la vista *editable* capturara una URL en vez de HTML libre.
    - **Bug relacionado encontrado y corregido de paso**: el `useEffect` que recalcula
      `fabricaBriefs` en `CreateProjectWizard.tsx` tenía un gate `hasContent` que solo consideraba
      `canalesRows.length > 0 || loopsRows... || hasFormulario` — si el usuario elegía **solo**
      "Landing" (sin ninguna fila de canal ni Formulario), `buildFabricaBriefs` nunca se llamaba y
      la tarea "Landing page" (agregada en el punto 14) jamás se generaba, a pesar de que el código
      que la crea ya estaba ahí. Se agregó `hasLanding = requerimientos.includes('landing')` al
      gate. Esto se detectó verificando este mismo fix con Playwright — un proyecto con únicamente
      "Landing" seleccionado mostraba "0 pendientes" en el nodo.
    - Verificado con Playwright: nodo Landing con campo URL (no editor de texto enriquecido),
      submit deshabilitado con URL inválida/vacía, habilitado con URL válida, y al reabrir el
      entregable ya aprobado/en revisión se ve como link clickeable con la URL guardada.
    - Typecheck y `npm run build` pasan limpio.

18. **Fix: formulario de Herramientas se recortaba en viewports bajos** — el contenedor en
    `HerramientasPage.tsx` tenía `overflow-hidden` con altura fija (`calc(100vh - 160px)`); si el
    contenido (formulario de 6 campos, o la tarjeta de éxito con sus 3 botones) superaba esa altura
    — típico en laptops con poca altura de pantalla o zoom del navegador — el contenido sobrante
    quedaba recortado e inaccesible, incluyendo a veces el botón "Copiar link". Cambiado a
    `overflow-y-auto` para que aparezca una barra de scroll en vez de cortar contenido. El botón
    "Copiar link" del resultado ya existía desde el punto 12 — no hizo falta agregarlo, solo dejó
    de estar inalcanzable. Verificado con Playwright a 900×520px (viewport deliberadamente bajo):
    el formulario y la tarjeta de éxito ahora se pueden scrollear dentro del contenedor y el botón
    de copiar es alcanzable y funcional.
    - Typecheck y `npm run build` pasan limpio.

19. **Herramientas: se quita el contenedor con borde/sombra/altura fija, formulario compacto** —
    el usuario pidió eliminar el "contenedor de herramientas" y achicar el formulario para que
    quepa sin scroll. `HerramientasPage.tsx`: el `div` con `border shadow-sm overflow-y-auto` y
    `height: calc(100vh - 160px)` (del punto 18) se reemplazó por un layout flex simple
    (`flex flex-col`, el título con `shrink-0`, `BitlyLinkTool` dentro de un `min-h-0 flex-1`) sin
    borde ni sombra — el fondo radial del propio `BitlyLinkTool` sigue ahí, solo se quitó la "caja"
    alrededor. `BitlyLinkTool.tsx` ahora es dueño de su propio scroll (`h-full overflow-y-auto` en
    vez de `min-h-full`, sin depender del padre) y se redujo el padding/spacing en general (tarjetas
    de `p-8`→`p-5/p-7`, inputs de `11px 14px`→`9px 12px`, botón submit de `50px`→`46px`, `maxWidth`
    de 430→400) para que quepa sin scroll en viewports normales.
    - Verificado con Playwright a 900×800px: `document.documentElement.scrollHeight` quedó
      exactamente igual a `window.innerHeight` (800 = 800) — cero scroll necesario para ver el
      formulario completo. Sigue habiendo scroll interno como red de seguridad en viewports muy
      bajos (ya no rompe/recorta, ver punto 18).

20. **Fix: "Nueva tarea" en nodo Landing/Formulario debe usar el campo URL, sin importar el texto
    escrito** — antes, el campo URL vs. editor de texto enriquecido se decidía por
    `isUrlBrief(brief.tarea)` (busca "Landing"/"Formulario de inscripción" en el texto), así que
    una tarea creada a mano con otro título (ej. "Publicar sitio v2") en el nodo Landing caía en el
    editor WYSIWYG en vez del campo URL. `BriefDialog` (`StrategyBriefPanels.tsx`) ahora acepta un
    prop `urlOnly?: boolean`; `ContentBriefPanel` se lo pasa explícitamente en base al
    `node.stageType` (`'landing' || 'formulario'`) en vez de dejar que `BriefDialog` lo infiera del
    texto — así CUALQUIER tarea dentro de esos dos nodos usa el campo URL, sin importar cómo se
    haya titulado. `isUrlBrief` sigue como fallback si `urlOnly` no se pasa (compatibilidad con
    otros llamadores futuros).
    - Verificado con Playwright: tarea "Publicar sitio v2" creada a mano en el nodo Landing abre
      con `<input type="url">` (cero elementos `.ProseMirror`), igual que la tarea auto-generada
      "Landing page".

21. **Feature: crear tareas en cualquier nodo, para cualquier rol** — el usuario pidió poder crear
    tareas en todos los nodos del Flujo de trabajo, no solo Copys/Diseño/Envíos/Landing/Formulario.
    Antes, cualquier nodo fuera de esa lista (ej. "Pauta en redes sociales", o nodos `custom`)
    caía en una lista genérica basada en `project.tasks`/`ProjectTask` que, según quedó documentado
    en sesiones anteriores, **estaba desconectada de todo lo demás** — no aparecía en la pestaña
    Equipo ni en ningún otro lado, solo en ese mismo diálogo. Se eliminó esa rama muerta por
    completo: `NodeTasksDialog` (`MapTab.tsx`) ahora despacha `DeliveryBriefPanel` solo para
    `envios` y `ContentBriefPanel` (el mismo panel de siempre, con `FabricaBriefItem` real que sí
    se ve en Equipo) para **cualquier otro stage** con rol asignado. Se borró todo el código muerto
    asociado: `BRIEF_DRIVEN_STAGES`, el estado `title`/`memberId`/`handleAdd` basado en
    `ProjectTask`, el componente `TaskRow`, los props `onAddTask`/`onUpdateTask`/`onDeleteTask` y
    las acciones `addTask`/`updateTask`/`deleteTask` del store ya no se usan desde `MapTab.tsx`
    (las acciones siguen existiendo en `factoryStore.ts` por si algo más las usa, no se tocó el
    store). El badge "· Np" de tareas pendientes en la lista de proyectos del sidebar
    (`FactoryPage.tsx` línea ~876, lee `project.tasks`) queda inactivo de forma permanente — ya
    era efectivamente inactivo antes porque nada poblaba `project.tasks` en la práctica.
    - Verificado con Playwright: nodo "Pauta en redes sociales" (antes con la lista muerta) ahora
      tiene el mismo input "¿Qué hay que crear?" que Copys/Diseño, y la tarea creada
      ("Configurar targeting de campaña") queda como pendiente real (`FabricaBriefItem`, rol
      "Social Media") — el badge del nodo en el diagrama pasó a reflejar el conteo correcto.
    - Typecheck y `npm run build` pasan limpio (para los puntos 19, 20 y 21 en conjunto).

22. **Fix: tarea duplicada "Landing" + "Landing page" al crear proyecto con Landing** — el usuario
    creó un proyecto nuevo con Landing + un toque de Correo/WhatsApp/SMS en Plan de canales y le
    aparecieron DOS tareas para Gestor de canales: "Landing" y "Landing page". Causa: quedaban dos
    caminos generando una tarea de landing en paralelo — (a) el bloque explícito e incondicional
    agregado en el punto 14 (`if (reqs.includes('landing')) addItem(..., 'Landing page')`), y (b)
    el mapa viejo `REQ_ROLE_TAREAS.landing.gestor_canales = ['Landing']`, que solo se activaba
    cuando había una fila de canal Correo/WhatsApp/SMS (vía `addRoleTareasFiltered` dentro del
    switch de canales) — se me había pasado por alto dejar ese camino viejo activo al agregar el
    nuevo en su momento. Se vació `REQ_ROLE_TAREAS.landing` a `{}` (igual que `formulario`) para
    que ese camino viejo nunca vuelva a generar la tarea "Landing" — la única fuente de verdad
    ahora es el bloque explícito de "Landing page".
    - **Bug relacionado, mismo reporte del usuario**: "no me deja crear tareas nuevas en los nodos
      del flujo de trabajo" — al investigar (reproduciendo con Playwright en vez de asumir) se
      confirmó que Copys/Diseño/Landing SÍ dejaban crear tareas, pero **el nodo "Envío de
      acciones" (stageType `envios`) no tenía ningún input para agregar tareas** — usa
      `DeliveryBriefPanel` en vez de `ContentBriefPanel`, y ese panel nunca tuvo el "Nueva tarea"
      que sí se le agregó a `ContentBriefPanel`/`NodeTasksDialog` en el punto 21 (me quedé corto:
      until ahora "cualquier nodo" en la práctica excluía a Envíos). Se agregó el mismo quick-add
      (`Input` + botón `Plus`) a `DeliveryBriefPanel`, creando el `FabricaBriefItem` con
      `currentNodeId` igual que en `ContentBriefPanel` — como `briefsForNode` no aplica el filtro
      `isCanalBrief` cuando el brief ya tiene `currentNodeId`, la tarea nueva aparece en la lista
      del nodo sin importar que su texto no empiece con "Configurar envío por…".
    - Verificado con Playwright reproduciendo el reporte exacto del usuario (proyecto con Landing +
      canal Correo): cero tareas "Landing" sueltas, solo "Landing page"; y task creation confirmado
      en los 3 nodos (Landing, Copys, Envío de acciones) — antes del fix "Envío de acciones" tenía
      0 inputs de "Nueva tarea", después tiene 1 y la tarea creada aparece.
    - Typecheck y `npm run build` pasan limpio.

### 2026-07-10

23. **Fix: Copys aprobado no activaba Diseño + nuevos nodos KAM/BTL/Relacionamiento/Call
    Center/Pauta impulsados por Plan de canales + rol Trafficker**
    - **Causa raíz del bug reportado** ("marqué una tarea como completada en Copys y no se movió a
      Diseño"): `activateNextStage` (`StrategyBriefPanels.tsx`) hacía `if (!brief.currentNodeId)
      return;` — pero los entregables de Copys sembrados por el wizard (ej. "Redactar copy para
      Correo…") nunca tenían `currentNodeId` seteado (solo lo tienen las tareas creadas a mano con
      "Nueva tarea" dentro del nodo). `activateNextStage` ahora recibe el `nodeId` explícito del
      panel que abrió el diálogo (`BriefDialog` suma un prop `nodeId`) en vez de leerlo del brief, y
      además estampa `currentNodeId` en el brief en cada submit/aprobar/corregir — arregla el bug de
      raíz y deja el dato consistente para el futuro, sin depender de heurísticas de texto.
    - **Rol nuevo: Trafficker** (`rolesStore.ts`, `ASSIGNABLE_ROLE_IDS`, versión de persist subida a
      3; también espejado en `authService.ts` `AppRole`/`ROLE_LABELS` por consistencia con el punto
      8 de la bitácora, aunque ese enum sigue siendo puramente informativo).
    - **Nodos de Flujo de trabajo ahora dependen del Plan de canales, no solo de Requerimientos** —
      nuevo `syncCanalNodes()` en `factoryStore.ts` (paralelo a `syncRequerimientoNodes`, se corre
      en `addProject` y en `updateProject` cuando cambian `canales`): Facebook/Instagram/TikTok/
      Google Ads → nodo **"Pauta en redes sociales"** (rol Trafficker, reemplaza el viejo checkbox
      "Pauta en redes sociales" de Requerimientos que se **eliminó** — el nodo ahora nace solo de
      los canales elegidos); BTL/KAM/Relacionamiento → sus propios nodos de una sola etapa (rol
      Estratega); Call Center → cadena de 2 nodos ("Guion de llamada", rol Copywriter → "Call
      Center", rol Estratega, `dependsOn` el primero). Los nodos se agregan/quitan solos al
      agregar/quitar canales, igual que ya pasaba con Landing/Formulario.
    - **Dos entregables nuevos**, ambos con paneles y diálogos propios (no reusan `ContentBriefPanel`
      ni `DeliveryBriefPanel`):
      - `DoneDateBriefPanel` (KAM, BTL, Relacionamiento, y el nodo "Call Center") — sin contenido ni
        adjuntos, solo "¿Se realizó? Sí/No" + fecha (`deliverableDone`, `deliverableDate` nuevos en
        `FabricaBriefItem`).
      - `PautaBriefPanel` (Pauta en redes sociales) — cuadro de texto (RichTextEditor) + adjuntos,
        más "¿Publicada? Sí/No" (`deliverablePublicada`, nuevo). Al marcar "Sí" crea automáticamente
        una tarea "Recolectar métricas de {campaña}" en el mismo nodo — mismo patrón que ya existía
        para Envíos (`Recolectar métricas de {canal}`), esa parte no se tocó.
    - **Cadena de aprobación de Call Center** reutiliza `activateNextStage`: al aprobar el guion
      (Copywriter, vía `ContentBriefPanel`, con revisión como cualquier Copys/Diseño), se crea sola
      una tarea "Registrar realización — Call Center" para Estratega en el nodo "Call Center" —
      `AUTO_ADVANCE_STAGE_TYPES` (antes `CONTENT_STAGE_TYPES`) suma `callcenter_guion`/`callcenter`
      a los `copys`/`diseno` que ya tenía.
    - **Ambigüedad de `roleLabel` compartido** — KAM/BTL/Relacionamiento/Call Center comparten el
      rol "Estratega" (igual que antes Landing/Formulario/Envíos comparten "Gestor de canales"): se
      resolvió con el mismo patrón ya usado ahí — `briefsForNode` (`StrategyBriefPanels.tsx`) suma
      un branch de texto por `stageType` para cada uno. Además, como los entregables sembrados por
      el wizard tampoco tienen `currentNodeId`, se agregó `stampCanalNodeIds()` en `factoryStore.ts`
      que, en cada `addProject`/`updateProject`, estampa el `currentNodeId` correcto en esos briefs
      apenas se calculan los nodos — así `briefsForNode` casi no necesita ya las heurísticas de
      texto (quedan solo como red de seguridad).
    - **Canal "Relacionamiento" cambió de responsable**: antes generaba la tarea "Plan de
      relacionamiento" para Gestor de canales; el usuario pidió explícitamente que fuera
      responsabilidad de la Estratega (misma dinámica que BTL) — se corrigió tanto el `addItem`
      como el mapa `canalInvolvesRole` en `CreateProjectWizard.tsx`.
    - **Decisiones confirmadas con el usuario antes de implementar** (`AskUserQuestion`): TikTok
      también pasa a Trafficker (junto con Facebook/Instagram/Google Ads); el checkbox viejo
      "Pauta en redes sociales" en Requerimientos se elimina en vez de convivir con el nuevo camino
      por canales.
    - Verificado con Playwright en un solo proyecto con los 6 canales nuevos (Correo, Facebook,
      BTL, KAM, Relacionamiento, Call Center) + Landing: se generaron exactamente los 10 nodos
      esperados y 9 briefs sin duplicados (antes existía el riesgo del bug del punto 22). Se
      probaron a mano los 4 flujos: Copys aprobado → tarea aparece sola en Diseño; nodo KAM abre el
      editor "¿Se realizó?" (sin editor de texto enriquecido) y guarda fecha; guion de Call Center
      aprobado → tarea "Registrar realización — Call Center" aparece sola en el nodo Call Center
      para Estratega; nodo Pauta muestra rol Trafficker y, al marcar una campaña de Facebook como
      publicada, aparece sola la tarea "Recolectar métricas de Facebook". Typecheck y
      `npm run build` pasan limpio.
    - **No verificado**: sincronización real contra Supabase (el proyecto de prueba se creó y
      exploró en una sola sesión de navegador sin recargar, porque el `upsert` a
      `factory_projects` devolvió `406` en esta máquina — no se investigó la causa, podría ser una
      RLS/config local desactualizada; no se tocó nada de Supabase en esta sesión). Tampoco se
      probó el caso de quitar un canal (ej. desmarcar BTL en "Editar proyecto") para confirmar que
      `syncCanalNodes` borra el nodo correctamente — la lógica es simétrica a
      `syncRequerimientoNodes` (ya probada en el punto 10) pero no se ejercitó en este flujo nuevo.

24. **Flujo de trabajo: layout de grilla densa en vez de carriles apilados + se quita
    "Piezas" de Requerimientos**
    - El diagrama de Flujo de trabajo (`WorkflowTab` en `MapTab.tsx`) apilaba cada rama
      (`computeLanes`) en su propia fila a **ancho completo** — una rama de 1 solo nodo (KAM, BTL,
      Relacionamiento, Landing, Pauta) ocupaba una fila entera con 2/3 del ancho vacíos (cada
      `NodeCard` medía `100/maxLaneLength%`, calculado sobre la rama más larga de *todo* el
      diagrama). Con 10 nodos y hasta 7 ramas independientes esto se veía muy alargado
      verticalmente con huecos horizontales grandes — exactamente lo que pidió corregir el usuario.
    - Reemplazado por una **grilla CSS densa** (`display: grid`, `grid-template-columns:
      repeat(auto-fill, minmax(160px, 1fr))`, `grid-auto-flow: dense`): cada rama es un ítem que
      ocupa `grid-column: span N` (N = su longitud real — 3 para Copys→Diseño→Envíos, 2 para
      Guion de llamada→Call Center, 1 para el resto), y el algoritmo de *dense packing* del
      navegador intercala los nodos sueltos en los huecos que dejan las cadenas más largas, sin
      que el código tenga que calcular filas/columnas a mano. `computeLanes` ordena las ramas por
      longitud descendente (antes usaba `LANE_RANK` para fijar Landing/Formulario arriba, Copys
      centro, Pauta abajo — se eliminó esa constante, ya no hay orden "por fase") para que las
      cadenas largas se coloquen primero y las sueltas rellenen alrededor.
    - El conector bezier multi-rama desde "Inicia el proyecto" (un `<svg>` con una curva por
      carril, pensado para carriles apilados verticalmente) ya no tenía sentido geométrico con una
      grilla 2D — se reemplazó por una sola flecha fija (`ArrowRight`), igual a como ya se veía
      cuando solo había 1 rama.
    - Las flechas **dentro** de una rama (que sí representan un `dependsOn` real) se mantienen
      igual que antes.
    - De paso, a pedido del usuario, se quitó el botón "Piezas" del paso "Requerimiento" del
      wizard (`CreateProjectWizard.tsx`): se eliminó de `REQUERIMIENTOS` y su entrada en
      `REQ_ROLE_TAREAS` (generaba la tarea "Diseño de piezas gráficas" para Diseñador — ya no se
      genera por esa vía; `roles.diseno.tareas` en Ajustes sigue pudiendo tener esa tarea si el
      usuario la define ahí, pero el requerimiento del wizard que la disparaba automáticamente
      desapareció).
    - Verificado con Playwright: con los mismos 6 canales + Landing del punto 23, el grid quedó en
      3 filas × 3 columnas aproximadamente (662×424px, mucho más ancho que alto) en vez de 7 filas
      a ancho completo; sin overflow horizontal en 1400/1200/1000/900px de ancho (medido con
      `scrollWidth` vs `clientWidth`, no solo visual); botón "Piezas" confirmado ausente. Typecheck
      y `npm run build` pasan limpio.

25. **Flujo de trabajo: layout de árbol con ramas en filas paralelas + Copys se bifurca a Call
    Center (se elimina el nodo "Guion de llamada")**
    - El usuario pidió una estructura exacta tipo diagrama de flujo: "Inicia el proyecto" como
      única entrada a la izquierda, y de ahí 6 ramas en filas paralelas — Landing, Copys, Pauta,
      BTL, KAM, Relacionamiento. Copys **se bifurca** en dos caminos: Copys → Diseño de piezas →
      Envío de acciones, y **Copys → Call Center directo**. Las ramas cortas no deben ocupar el
      mismo ancho que la rama larga de Copys, sin cruces de líneas.
    - **Cambio de modelo de datos (confirmado con el usuario vía `AskUserQuestion`):** se eliminó el
      nodo intermedio `callcenter_guion` ("Guion de llamada"). Ahora el nodo `callcenter` (registro
      de la Estratega, "¿se hizo? sí/no + fecha") **depende directamente del nodo Copys**. El
      copywriter redacta el guion como una tarea más dentro de Copys ("Redactar guion para Call
      Center", que ahora `briefsForNode` enruta a Copys por `roleLabel` Copywriter — se quitó el
      branch que la excluía). Al aprobar esa tarea (o cualquier copy) en Copys, `activateNextStage`
      crea el registro "Registrar realización — Call Center" en el nodo Call Center. El usuario
      aceptó explícitamente el tradeoff de que *cualquier* copy aprobado dispare ese registro; para
      que no se dupliquen, `activateNextStage` ahora **deduplica** el registro de Call Center (solo
      crea uno por nodo) y usa un nombre fijo en vez de derivarlo del texto del copy.
      `AUTO_ADVANCE_STAGE_TYPES` pasó de `['copys','diseno','callcenter_guion','callcenter']` a
      `['diseno','callcenter']` (los dos hijos de Copys).
    - `syncCanalNodes` (`factoryStore.ts`): el canal "Call Center" ya no crea la cadena de 2 nodos;
      crea un solo nodo `callcenter` con `dependsOn: [copysNodeId]`. Además limpia en caliente
      cualquier nodo `callcenter_guion` que estuviera en memoria. Nueva migración en lectura
      `mergeGuionNodes()` (en `rowToProject`, junto a `stripApprovalNodes`) hace lo mismo para datos
      ya persistidos en Supabase: quita el guion y re-cuelga el Call Center de Copys. El tipo
      `callcenter_guion` se mantiene en el union `StrategyStageType` solo para poder parsear datos
      viejos antes de migrarlos.
    - **Layout rediseñado a un árbol real** (`computeTreeLayout` reemplaza a `computeLanes` en
      `MapTab.tsx`): asigna a cada nodo `(columna = profundidad en la cadena, fila = hoja del
      subárbol)` con un DFS que numera las hojas; un nodo con varios hijos (Copys) ocupa el rango de
      filas de todas sus hojas y se centra entre ellas. Las raíces se ordenan por `ROOT_ORDER`
      (Landing, [Formulario], Copys, Pauta, BTL, KAM, Relacionamiento). El render usa **CSS grid**
      (`grid-template-columns/rows: repeat(n, 1fr)`, alto fijo `filas × 116px`) para colocar las
      tarjetas, y **dos `<svg>` con `preserveAspectRatio="none"`** por detrás para las conexiones:
      uno para el abanico Inicia→raíces, otro para las dependencias entre nodos (curvas Bézier
      centro-a-centro, tapadas por las tarjetas opacas para que parezcan salir del borde). La
      bifurcación de Copys se ve como **dos curvas saliendo del mismo nodo** (una a Diseño, otra a
      Call Center), sin medición del DOM: las coordenadas salen directo de la grilla `(col, fila)`.
      Las ramas cortas ocupan solo su columna (las demás columnas de esa fila quedan vacías), así
      que no se estiran al ancho de la rama de Copys. Se eliminaron `computeLanes`, `LANE_RANK` (ya
      estaba fuera), y los imports `ArrowRight`/`Phone` que quedaron sin uso.
    - Verificado con Playwright: 9 nodos, sin "Guion de llamada"; el guion vive en Copys; aprobarlo
      crea "Registrar realización — Call Center" en el nodo Call Center; la bifurcación de Copys se
      ve con dos líneas; sin overflow horizontal en 1400/1200/1000px. Typecheck y `npm run build`
      pasan limpio.

26. **Fix: el guion de Call Center ya no dispara Diseño + exportar el Flujo de trabajo como imagen**
    - El usuario confirmó (tras el punto 25) que aprobar el guion de la llamada **no debe** crear
      tarea en Diseño, solo en Call Center — y viceversa, un copy normal no debe tocar Call Center.
      `activateNextStage` (`StrategyBriefPanels.tsx`) antes creaba una tarea en **ambos** hijos de
      Copys (Diseño y Call Center) sin distinguir cuál brief se aprobó. Se agregó
      `isCallCenterGuion(tarea)` (detecta "guion" + "call center" en el texto, reusado también en
      `briefsForNode`) y `activateNextStage` ahora filtra: si el brief aprobado es el guion → solo
      activa `callcenter`; si no → solo activa `diseno`. La deduplicación del registro de Call
      Center (un solo checkpoint por nodo, sin importar cuántos copys se aprueben) se mantiene.
    - **Nuevo: botón "Exportar imagen" en Flujo de trabajo** (`MapTab.tsx`) — descarga un PNG del
      diagrama completo (nodo de inicio, conexiones y todas las tarjetas) tal como se ve en pantalla
      en ese momento. Usa la librería `html-to-image` (`toPng`, nueva dependencia — cero
      dependencias propias, maneja bien el `<svg>` de las conexiones y las CSS vars del tema) sobre
      un `ref` sujeto al contenedor del diagrama (`diagramRef`); `pixelRatio: 2` para nitidez,
      `backgroundColor` tomado del `body` computado para que no salga transparente. El nombre del
      archivo usa el nombre del proyecto saneado (`flujo-de-trabajo-<nombre>.png`). Botón solo
      visible cuando hay nodos que exportar.
    - Verificado con Playwright: aprobar el guion → Diseño NO recibe tarea, Call Center sí; aprobar
      un copy normal después → Diseño sí recibe tarea, Call Center sigue con un solo registro (sin
      duplicar); el botón dispara una descarga real de PNG (~270KB) y el archivo, inspeccionado
      manualmente, muestra el diagrama completo y correcto (bifurcación de Copys incluida, fondo
      del tema, sin recortes). Typecheck y `npm run build` pasan limpio.

27. **Unifica Plan de canales + Loops de comportamiento en un ecosistema cíclico de 6 etapas
    (ELMR + Motor del proceso)** — pedido grande, se pasó primero por Plan Mode (ver
    `~/.claude/plans/graceful-sauteeing-hollerith.md`) antes de tocar código.
    - **Decisión de arquitectura clave — plano + `etapaId`, no anidado.** El pedido proponía
      anidar `toques`/`loops` DENTRO de cada etapa (`Etapa.toques[]`, `Etapa.loops[]`). Se
      recomendó en cambio mantener `project.canales: CanalRow[]` y `project.loops: LoopRow[]`
      exactamente como arrays planos (sin cambios), agregándoles un `etapaId` opcional (+
      `siguienteEtapaId` en los loops) y guardando en `project.etapas: EtapaCiclo[]` solo la
      metadata de cada etapa (id/tipo/nombre/orden/objetivo), no las filas. Motivo: `syncCanalNodes`
      (que genera los nodos KAM/BTL/Relacionamiento/Call Center/Pauta del punto 23),
      `buildFabricaBriefs`/`canalInvolvesRole` (wizard) y el resumen de "Descripción general"
      (`FactoryPage.tsx`) **ya leen `canales`/`loops` como arrays planos** — anidar de verdad
      habría obligado a aplanar en los 3 para terminar con el mismo array plano, con más riesgo de
      romper el sistema de nodos que se construyó en esta misma sesión. El usuario aprobó este
      approach en la revisión del plan.
    - **Modelo nuevo** (`factoryStore.ts`): `EtapaTipo` (unión de las 6 claves: atraccion,
      interaccion, captura, validacion, desenlace, reactivacion — determina ícono/color por
      defecto en la UI, no se persiste como string suelto), `EtapaCiclo { id, tipo, nombre, orden,
      objetivo }`, `MensajeBaseELMR { emocion, logica, motivacion, recompensa }`, `MotorProceso {
      fuenteValidacion }` (requiereLanding/requiereFormulario NO se duplican ahí — se derivan de
      `requerimientos`). `CanalRow`/`LoopRow` ganan `etapaId?`/`siguienteEtapaId?`.
      `FactoryProject` gana `etapas`/`mensajeBase`/`motor`. **Sin migración de esquema DB** — todo
      vive en el blob JSONB `factory_projects.data`, los campos nuevos se leen con `?? default` en
      `rowToProject`/`projectToRow`, exactamente el mismo patrón que ya usa cada campo existente.
    - **UI del wizard** (`CreateProjectWizard.tsx`, paso "Canales y Comportamiento"): las dos
      tablas planas se reemplazaron por un `Accordion` (nuevo `src/components/ui/accordion.tsx` —
      wrapper shadcn estándar sobre `@radix-ui/react-accordion`, que ya estaba en
      `package.json` como dependencia sin wrapper generado; cero paquetes nuevos instalados), uno
      por etapa (ordenadas, con ícono/color por `tipo`, nombre/objetivo editables, botones ▲▼ para
      reordenar vía `moveEtapa`, contador de toques+loops). Dentro de cada etapa: la tabla de
      Toques (mismo markup de siempre, extraído a un componente `ToqueRow` reutilizable para no
      triplicarlo) y la de Loops (extraído a `LoopRowItem`, suma una columna nueva "Lleva a →" que
      escribe `siguienteEtapaId` — la opción vacía es "— Cierra aquí —"). Botón "Inicializar las 6
      etapas" (`initEtapas`) visible cuando `etapas.length === 0`, siembra `ETAPA_DEFAULTS` con el
      texto exacto de las 6 etapas del pedido. Nueva sección "Base del mensaje (ELMR)" (4 campos)
      agregada al paso "Audiencia y Narrativa", después de "Núcleo narrativo". El bloque
      Requerimiento se mantuvo en su lugar, retitulado "Requerimiento (Motor del proceso)", con un
      input nuevo "Fuente de validación (CRM)" ligado a `motor.fuenteValidacion`.
      `buildFabricaBriefs`/`canalInvolvesRole` **no se tocaron**.
    - **Bug encontrado y corregido durante la propia verificación** (no en el plan original): la
      sección "Sin etapa asignada" (para toques/loops de proyectos que aún no tienen `etapas`)
      estaba gateada por `etapas.length > 0 &&`, lo que significaba que un proyecto viejo con
      `etapas: []` pero con toques/loops ya guardados los dejaba completamente invisibles detrás
      del botón "Inicializar etapas" — ningún dato se perdía (seguían en `canalesRows`/
      `loopsRows`), pero no había forma de verlos ni editarlos hasta inicializar. Se quitó ese
      gate: con `etapas: []`, el `Set` de ids de etapas queda vacío y **todas** las filas
      existentes caen a "Sin etapa asignada" automáticamente, visibles desde el primer render.
    - **Visualización del ciclo** (`MapTab.tsx`, dentro de `LoopTab`, debajo del `LoopDiagram`
      estático existente — no se tocó ni reemplazó): nuevo `EcosystemCycleDiagram`, sin hooks
      (early return simple si `etapas.length === 0`), posiciona las N etapas en un hexágono vía
      coordenadas polares (mismo cálculo que ya usaba `LoopDiagram` para sus 4 fases,
      generalizado a N), dibuja con un `<svg>` la flecha principal etapa[i]→etapa[i+1]→…→etapa[0]
      (el cierre N-1→0 ES la reactivación "de fábrica", ya queda representado sin datos extra), y
      una curva punteada adicional por cada `LoopRow` cuyo `siguienteEtapaId` salta a una etapa
      que NO es la siguiente natural (rama real capturada en los datos), con una leyenda de texto
      debajo listando esas ramas. Cada tarjeta de etapa muestra su conteo real de toques/loops
      (`project.canales`/`project.loops` filtrados por `etapaId`).
    - Verificado con Playwright: ELMR se guarda, "Inicializar las 6 etapas" siembra las 6 con los
      textos correctos, un toque + loop agregados dentro de "Atracción multicanal" con
      `siguienteEtapaId = Reactivación y remarketing` (una rama real, no la secuencia natural) se
      reflejan en la tarjeta ("1 toques · 1 loops") y en el diagrama del tab Loop — la curva
      punteada y la leyenda "Atracción multicanal → Reactivación y remarketing: Enviar
      remarketing" aparecen correctamente; `motor.fuenteValidacion` se guarda. Regresión:
      Flujo de trabajo sigue generando el nodo Landing + la cadena Copys→Diseño→Envíos sin
      cambios. Typecheck y `npm run build` pasan limpio en cada fase.
    - **No verificado**: round-trip completo reabriendo "Editar proyecto" después de crear (el
      script de verificación no llegó a ejercitar ese paso — se limitó a crear y ver el resultado
      en la misma sesión de navegador). Dado que la persistencia usa exactamente el mismo mecanismo
      `?? default` que todos los demás campos del proyecto (ya probado extensamente en sesiones
      anteriores), el riesgo es bajo, pero vale la pena confirmarlo a mano.
    - Pusheado a `master` (commit `babaff8`) a pedido explícito del usuario en el siguiente mensaje.
    - **Follow-up en la misma sesión**: al usuario le gustó el nuevo diagrama pero pidió quitar el
      "Ciclo Loop" estático de 4 fases (Estrategia/Ejecución/Resultados/Aprendizaje) que quedaba
      arriba — nunca leía datos del proyecto, era puramente decorativo. Se eliminó por completo de
      `LoopTab` junto con el código que quedó sin uso (`LoopDiagram`, `LOOP_PHASES`) — `LoopMetric`
      se mantuvo porque lo sigue usando `MetricsDashboardTab`. `LoopTab` ahora renderiza
      únicamente `EcosystemCycleDiagram`. Verificado con Playwright que el bloque viejo ya no
      aparece y el nuevo diagrama sigue igual. Typecheck y `npm run build` limpios.
    - **Otro follow-up en la misma sesión — 3 ajustes a Loops de comportamiento**:
      1. **"Ángulo del toque" se veía roto** (`ToqueRow`) — la grilla de la fila usaba las mismas
         6-7 columnas de ancho fijo de antes de anidar todo dentro del Accordion por etapa, pero
         el contenedor ahora es más angosto (nesting del Accordion + padding del item). Medido con
         Playwright: el input de Ángulo quedaba en **41px** de ancho real (`getComputedStyle` →
         `gridTemplateColumns` resolvía el track a 41px), prácticamente invisible. Se rebalancearon
         los anchos de columna (`canal 95px · día 75px · hora 58px · ángulo minmax(150px, 1fr) ·
         segmento minmax(60px, 90px) [· etapa minmax(60px, 90px)] · borrar 20px`) — Ángulo es texto
         libre sin truncado (a diferencia de Segmento/Etapa, que sí truncan con "…" + `title`), así
         que se le dio el piso más generoso; quedó en ~192px verificado. No se tocó nada del resto
         de la fila (mismo Select de canal, mismos date/time pickers).
      2. **El disparador ahora sale del Plan de canales, de cualquier canal** — antes
         `emailTriggers` solo tomaba toques de canal `Correo`. Se generalizó a `canalTriggers`:
         cualquier fila de `canalesRows` con `copy` (ángulo) no vacío aparece como opción, con
         label `"{canal} · {ángulo}"` y value `"Salida de {canal}: {ángulo}"` — así el loop siempre
         queda atado a una salida real del plan en vez de a un evento inventado. Los "Disparadores
         estándar" (abrió/clic/etc.) se mantienen como fallback genérico, ya no mencionan "correo"
         específicamente en el texto (eran de email únicamente).
      3. **Responsable filtrado a los roles que el Plan de canales involucra** — antes el
         `<select>` listaba el catálogo completo de `useRolesStore()` (los 8 roles, incluidos los
         3 internos no asignables). Ahora, en `CreateProjectWizard`, se calcula
         `involvedRoleIds`/`involvedRoles` reusando `canalInvolvesRole()` (la misma función que ya
         usaba `buildFabricaBriefs` para decidir qué roles participan según los canales elegidos) y
         se pasa como prop `roles` a `LoopRowItem` en vez del catálogo completo. Si todavía no hay
         canales que impliquen ningún rol (proyecto recién creado), cae de vuelta al catálogo
         completo como fallback para no bloquear el selector con una lista vacía.
      - Verificado con Playwright: ancho del input de Ángulo antes/después (41px → 192px, texto
        largo visible completo sin recorte); disparador muestra "Correo · Convocatoria inicial del
        evento" como opción real del plan; con solo un toque de Correo en el proyecto, Responsable
        muestra únicamente "Copywriter" y "Gestor de canales" (los 2 roles que `canalInvolvesRole`
        asocia a Correo), no los 8 del catálogo. Typecheck y `npm run build` limpios.

### 2026-07-11

28. **EJECUTADO: rediseño visual "Tremu ISO"** (el "PLAN PENDIENTE" de abajo ya se implementó)
    — se aplicó el sistema de diseño completo con la estrategia de remapear los **valores** de las
    CSS vars existentes en `src/index.css` (hex→HSL), sin renombrar vars ni tocar componente por
    componente, tal como se planeó.
    - `index.css`: paleta remapeada a Tremu ISO (`--background` #EEF1F7, `--primary`/`--factory`/
      `--ring` #009CF5, `--accent` #E5F5FE + `--accent-foreground` #0079BD para hovers de menús,
      ink `#12141B`/ink-2 `#3B4150`/muted `#8A90A0`, bordes `#ECEEF3`, surface blanca/soft `#F7F8FB`,
      sidebar a claro); radios explícitos nuevos `--radius-lg/md/sm` = 22/14/10px; sombras suave
      (ink .04/.05) + glow de botón (accent .18/.30). **Borrado el bloque `.dark` y todos los
      `--gradient-*`.** `@import` cambiado a solo Plus Jakarta Sans (fuera Inter/Space Grotesk/
      Baloo 2/Open Sans); `@import` movido arriba de `@tailwind` para matar el warning de build.
      Body/h1-3/`.font-display`/`.font-logo` → Jakarta con tracking negativo. **Semáforo
      conservado** (state/status/priority sin cambios); **team-*/board-* neutralizados a gris
      `223 12% 55%`** (los nodos del flowchart y las columnas del kanban pierden color decorativo —
      heads-up ya avisado al usuario, es reversible).
    - `tailwind.config.ts`: `fontFamily` sans/display/logo → Jakarta; se quitó `backgroundImage`
      (gradientes); `borderRadius` lg/md/sm → `var(--radius-lg/md/sm)`.
    - `App.tsx`: se quitó el `ThemeProvider` de next-themes (app siempre clara). `ui/sonner.tsx`:
      `theme="light"` fijo, sin `useTheme` (next-themes queda como dep sin uso, no se desinstaló).
    - `BitlyLinkTool.tsx`: objeto `T` reescrito a tokens Tremu ISO — `bg` sólido `#EEF1F7` (sin
      radial), `submitBg`/`submitBgHover` `#009CF5`/`#0087D6` sólidos (sin `linear-gradient`), nueva
      `submitShadow` de acento reusada en `PillButton`/`SubmitButton`, Plus Jakarta Sans, radios
      22/14. Se aplanaron los rgba/hex sueltos del JSX (círculos de ícono → accent-weak, caja de
      resultado → surface-soft).
    - `WebinarsPage.tsx`: las tarjetas "glass" oscuras (gradientes navy + rgba) se aplanaron a
      superficie blanca con tokens (`hsl(var(--surface))`, `--border`, `--foreground`), botón
      primario a `#009CF5` sólido pill, labels grises `#B8C6E6` → `--muted-foreground`.
    - Reemplazos de `bg-gradient-factory`/`bg-gradient-surface` (utilidades ya eliminadas) por
      `bg-primary`/`bg-surface-elevated` sólidos en `AppSidebar.tsx`, `FactoryPage.tsx`,
      `CreateProjectWizard.tsx`, `MapTab.tsx` (+ `text-factory-foreground` → `text-primary-foreground`).
    - **Verificación:** `tsc --noEmit` exit 0 y `npm run build` limpio (sin el warning de `@import`).
      Sin Playwright (por decisión del usuario — revisa visual en el deploy). Como es background job,
      **no se pusheó a master directo**: rama `worktree-bitacora-rediseno-tremu` (commit `821888d`)
      + **PR #1** (`https://github.com/Nivlek02/the-factory/pull/1`), **mergeado el 2026-07-11** —
      el rediseño está en producción (confirmado visualmente el 2026-07-16). La rama
      `worktree-bitacora-rediseno-tremu` sigue existiendo en el remoto; se puede borrar.

### 2026-07-16

29. **Tabla `usuarios_roles` (perfiles + roles en una sola) + login real de Supabase Auth + fix de
    rutas SPA en Vercel** — commits `6fb75db`, `85465d7`, `5bec390`, los tres en `master`.
    - **Hallazgo que cambió el pedido:** el usuario pidió "consolidar" `profiles` + `user_roles`
      mapeando los roles viejos (`mercadeo`→Estratega, etc.). Al revisar la base **las tres tablas
      estaban vacías** (`auth.users`, `profiles`, `user_roles`: 0 filas) — los datos viejos se
      quedaron en el proyecto Supabase reemplazado, que **ya no existe** (`projects list` devuelve
      solo `yvzpfdwswmjcnipcgclg`). O sea, no había nada que mapear: la lista de 22 personas que
      trajo el usuario es la única fuente de verdad. Se le avisó antes de tocar nada.
    - **`usuarios_roles`** (migración `20260716000000`): `id`, `user_id` (uuid nullable → FK a
      `auth.users`, `ON DELETE SET NULL`), `usuario`, `nombre_completo`, `email`, `rol` (text con
      **check constraint** de los 6 roles), `debe_cambiar_password` (bool, default true),
      `created_at`/`updated_at`. 22 registros; **nadie en Trafficker**. `profiles` y `user_roles`
      **NO se borraron** (pedido explícito) — quedan vacías y con el enum `app_role` viejo.
    - **Decisión: no se guarda ninguna contraseña en la tabla.** El pedido original mencionaba una
      columna `password_temporal`, pero la lista de columnas del propio usuario no la incluía. Las
      credenciales viven solo en `auth.users` (hasheadas por GoTrue). El usuario decidió a mitad de
      camino asignar él las contraseñas desde el frontend, así que **no se generó ninguna
      contraseña temporal ni existe archivo de contraseñas**.
    - **RLS de `usuarios_roles`: solo `authenticated` (SELECT), a propósito** — es la única tabla
      que NO abre a `anon`, a diferencia del resto (ver "Estado de infraestructura"). Motivo: es un
      directorio con 22 nombres y correos (varios gmail personales) y la publishable key es pública
      y va en el bundle. Verificado: logueado devuelve 22 filas, sin sesión devuelve **0**.
    - **Login real** (`85465d7`): se eliminó `DEMO_USER`. `LoginPage.tsx` nueva en `/login`;
      `App.tsx` redirige toda ruta a `/login` sin sesión y `/login`→`/` con sesión; `authStore`
      restaura la sesión en `initialize()` y suma `login()`/`logout()`; `AppSidebar` tiene botón de
      cerrar sesión y ya no dice "Demo ·". `authService.fetchUserProfile`/`fetchAllUsers` ahora
      leen `usuarios_roles` (`rol` guarda la **etiqueta**, así que se mapea a `AppRole` con un mapa
      inverso de `ROLE_LABELS`). Los usuarios sin `user_id` caen a su id de tabla como `userId`:
      siguen siendo asignables, pero `loginUser` los rechaza.
    - **`createUser`/`updateUserProfile`/`deleteUserProfile` quedaron marcadas OBSOLETAS** en
      `authService.ts` — siguen escribiendo en `profiles`/`user_roles` (vacías, enum viejo) mientras
      toda la lectura ya usa `usuarios_roles`. Nadie las llama (`SettingsPage` invoca
      `addUser`/`updateUser`/`deleteUser` del store, que no existen). Si se conectan, hay que
      reescribirlas primero contra `usuarios_roles`.
    - **Fix: `vercel.json` no tenía `rewrites`** (`5bec390`) — **todas** las rutas menos `/` daban
      404 en producción (`/settings`, `/reports`, `/board/:id`), porque `dist/` solo tiene
      `index.html`. Estaba roto desde siempre y no se notaba porque se navegaba client-side desde la
      raíz; el login lo volvió fatal (un refresh en `/login` = 404). El rewrite excluye `/assets/`
      para no romper los archivos con hash (verificado: siguen sirviéndose como
      `application/javascript`).
    - **El `406` del pendiente viejo: al menos esta instancia NO es de `factory_projects`.** Es
      `app_version?select=version&limit=1` con `.single()` sobre una tabla **vacía** → PostgREST
      responde `PGRST116` / 406. Viene del `VersionUpdateBanner`. Es ruido de consola, no rompe
      nada. Puede que el 406 del `upsert` de `factory_projects` sea algo distinto.
    - **Se descubrió que `npx tsc --noEmit` no verificaba nada** (tsconfig raíz con `"files": []`).
      Con `-p tsconfig.app.json` salen los 4 errores preexistentes ya documentados. Los cambios de
      esta sesión no agregan ninguno. `npm run build` limpio.
    - **Verificado con Playwright contra producción real** (`https://tremubaq.vercel.app`, no solo
      local): sin sesión toda ruta cae a `/login` sin filtrar la app; contraseña incorrecta muestra
      error y no entra; login entra; el sidebar muestra "Kelvin Trujillo / Soporte"; la sesión
      sobrevive un reload; logout vuelve al login y no revive al recargar; Ajustes lista los 22
      ("Página 1 de 5", `USERS_PER_PAGE = 5`) con los roles nuevos. Se confirmó que el hash del
      bundle en prod coincide con el del build local.
    - **Limpieza del repo**: `supabase/.temp/` agregado al `.gitignore` (contiene la URL del pooler
      y era ruido untracked permanente).

### 2026-07-17

30. **Gestión de usuarios en Ajustes (arreglada + restringida por rol), fechas semaforizadas en
    Flujo de trabajo, banner de versión funcional y fixes de UI** — commits `3dabecb`, `7301e81`.
    - **Fix: "Guardar" en Ajustes se quedaba colgado en "Guardando…"** — `SettingsPage` llamaba
      `addUser`/`updateUser`/`deleteUser` del `authStore`, que **nunca existieron** (los 3 errores
      de `tsc` documentados hace meses): la llamada tiraba `TypeError`, el `setIsSaving(false)`
      siguiente no corría y el botón quedaba muerto. Implementados los tres contra `usuarios_roles`.
      **`tsc -p tsconfig.app.json` bajó de 4 errores a 1** (queda el de `CreateProjectWizard:376`).
    - **Segunda capa del mismo bug, esta introducida por mí:** la migración `20260716000000` creó
      `usuarios_roles` con RLS activa y **solo policy de SELECT**. El INSERT devolvía `42501`, pero
      **el UPDATE devolvía éxito afectando 0 filas** (RLS *filtra* filas, no rechaza el comando).
      Arreglar solo el JS habría dado "Usuario actualizado" sin guardar nada. Migración
      `20260717000000` agrega las policies de escritura. **Lección: al escribir con RLS hay que
      mirar el conteo de filas (`.select()`), no solo `error`** — `updateUser`/`deleteUser` lo hacen.
    - **Gestión de usuarios restringida a Estratega y Soporte** (`20260717010000`): las policies de
      escritura pasan por `public.puede_gestionar_usuarios(uuid)`, **SECURITY DEFINER** — obligatorio,
      porque una policy sobre `usuarios_roles` que consulte `usuarios_roles` se evalúa recursivamente
      contra sí misma (mismo patrón que el `has_role()` original). SELECT sigue abierto a cualquier
      autenticado: la app necesita la lista del equipo para asignar tareas. `authStore.canManageUsers()`
      espeja la regla en el front (solo decide qué se muestra; la base es la que manda) y `SettingsPage`
      muestra un aviso de solo lectura + oculta los controles.
      **Verificado con un usuario Diseñador real** (creado y borrado en la prueba): lee el equipo pero
      no puede editar a otros, crear, borrar **ni ascenderse a sí mismo a Estratega**.
      ⚠️ Esto es lo primero que hace que el rol **decida permisos** — hasta ahora era informativo
      (ver punto 8). Si se agregan más reglas por rol, este es el patrón a seguir.
    - **"Nuevo Usuario" ya no pide contraseña.** No puede crear cuentas de acceso: el Admin API exige
      service_role (imposible en el navegador) y `signUp` tampoco sirve — **el proyecto tiene
      `mailer_autoconfirm: false` y no tiene SMTP propio**, así que el usuario creado no podría
      confirmar el correo ni entrar nunca. Ahora agrega la persona al directorio (asignable en tareas)
      y el diálogo avisa que no podrá iniciar sesión hasta que le creen la cuenta.
    - **Fecha por acción + semáforo** (pedido del usuario): `FabricaBriefItem.fechaAccion` (ISO),
      sembrada desde `CanalRow.dia` y **editable desde la tarea** (decisión confirmada:
      "del plan + editable"). Cortes confirmados: **rojo ≤2d (incl. vencidas), amarillo ≤7d, verde
      >7d** — la regla vive en `src/lib/urgencia.ts` (probada en todos los bordes: 2→roja, 3→amarilla,
      7→amarilla, 8→verde). Ojo: `parseISOLocal` parsea a mano porque `new Date('2026-07-20')` se
      interpreta como UTC y en Colombia (UTC-5) mostraría el día anterior. En `buildFabricaBriefs` la
      fecha se hereda vía una variable de bucle (`fechaCanalActual`) para no repetirla en los ~10
      `addItem` del switch — **se resetea a null al salir del bucle** o Landing/Loops heredarían la
      fecha del último canal. El `NodeCard` del diagrama muestra la más urgente de sus pendientes.
    - **Fix: nodo "Inicia la campaña"** — el nombre tenía `truncate`, así que técnicamente no
      desbordaba, pero se cortaba a un renglón (incluso "Campaña de renovación Julio" ya se cortaba).
      Ahora envuelve hasta 2 líneas con `line-clamp-2 break-words` + `title`. Verificado con un
      nombre de 90+ caracteres sin espacios: la tarjeta mantiene su ancho y no genera scroll.
    - **Regresión propia detectada al verificar:** al meter el chip de urgencia en `NodeCard`, el
      `justify-between` + `truncate` aplastaba el `roleLabel` hasta desaparecerlo ("Copywriter" se
      esfumó). La fila ahora es `flex-wrap`; de paso "Gestor de canales" dejó de truncarse.
    - **Iconos del Dashboard de métricas**: estaban cruzados — **Clics tenía un signo de dólar**,
      Apertura una diana, Enviados una flecha de tendencia. Ahora `Send`/`MailOpen`/
      `MousePointerClick`. `Target` y `DollarSign` quedaron sin uso y se quitaron del import.
    - **VersionUpdateBanner: ahora sí funciona.** Leía `app_version` de Supabase, pero **esa fila
      seguía en `1.0.0` desde su creación porque nadie la actualizaba nunca** — el banner no se
      mostró jamás. Se reemplazó por un `BUILD_ID` (sha del commit, vía `VERCEL_GIT_COMMIT_SHA` o
      `git rev-parse`) horneado por Vite con `define`, más un `version.json` emitido en cada build;
      el hook lo consulta con `cache:'no-store'` al volver a la pestaña y cada 5 min. **Se actualiza
      solo en cada deploy, sin tocar la base.** La tabla `app_version` quedó sin uso (no se borró).
    - **Trampa encontrada al verificar:** el rewrite de SPA (`5bec390`) **se tragaba `/version.json`**
      y devolvía HTML — el `fetch` moría en `res.json()` y el banner nunca habría aparecido. El
      rewrite ahora excluye `version.json` además de `assets/`, y le fija `Cache-Control:
      must-revalidate`. **Cuidado al agregar cualquier archivo estático nuevo en la raíz: hay que
      excluirlo del rewrite o Vercel devolverá index.html.**
    - **El `406` de `app_version` desapareció** (ya no se lee esa tabla): la consola de producción
      quedó sin errores.
    - Verificado con Playwright **contra producción** (`tremubaq.vercel.app`): login, `version.json`
      legible, sin banner falso, aviso de rol correcto para Diseñador y controles para Soporte, los
      4 iconos de métricas, y el nodo inicial con nombre largo. Los 3 colores del semáforo probados
      en la UI. Las fechas de prueba que quedaron escritas en el proyecto real se limpiaron.

31. **Edge function `admin-usuarios`: cambiar correo, contraseña y crear accesos** (commit
    `da510ae`) — el usuario reportó que no podía cambiar el correo (chocaba con el guard del punto
    30) ni la contraseña.
    - **Por qué la contraseña no funcionaba:** el campo del diálogo de edición *sí* estaba
      conectado, pero a `update-user-password`, que valida el rol contra **`user_roles`** — vacía
      desde la migración. Daba 403 siempre.
    - **`admin-usuarios` (desplegada, `verify_jwt: true`)** — único camino a `auth.users` desde el
      navegador. **La autorización se hace a mano dentro de la función porque el service_role
      bypassea toda RLS**: (1) exige JWT válido, (2) verifica contra `usuarios_roles` que quien
      llama sea Estratega/Soporte, (3) relee la fila objetivo de la base por `id` — nunca confía en
      el email del body. Acciones: `set-email` (cambia auth.users **y** el directorio, o quedarían
      peleados), `set-password`, `create-access`.
    - **⚠️ Se BORRÓ `supabase/functions/admin-set-password`**: no validaba **nada** — recibía
      `{email, password}` y cambiaba la contraseña de cualquier usuario sin comprobar quién
      llamaba. Nunca estuvo desplegada, pero era una puerta abierta esperando a que alguien la
      desplegara. **Si aparece de nuevo en el repo, no desplegarla.** `update-user-password` y
      `create-initial-user` siguen en el repo sin desplegar y con el chequeo viejo contra
      `user_roles`: **están muertas, no conectarlas sin reescribirlas.**
    - **Verificado contra la función desplegada** (no solo local): sin token → 401, token basura →
      401, **usuario válido sin rol gestor → 403** (el ataque que importa), Soporte → 200 y la
      contraseña nueva **realmente sirve para entrar**; tras cambiar el correo se entra con el
      nuevo y **el viejo deja de funcionar**; validaciones de largo mínimo y de usuario sin cuenta.
      Flujo completo probado también desde la UI.
    - **Dos textos que quedaron mintiendo tras el punto 30 y se corrigieron:** *"Solo informativo —
      todos los usuarios tienen los mismos permisos de acceso"* bajo el selector de Rol (en los dos
      diálogos) — ya no es cierto; y el campo de contraseña del diálogo de edición, que no hacía
      nada. Mínimo de contraseña unificado en **8** (la UI decía 6, la función exige 8).
    - **Badge "Sin acceso"** en la lista de Ajustes: hasta ahora no había forma de distinguir a
      quien puede entrar de quien solo figura en el directorio. Se deriva de `userId === id` (ver
      `rowToUser`). Poner una contraseña a alguien "Sin acceso" **le crea la cuenta** (`create-access`).

## Rediseño visual "Tremu ISO" — CERRADO

El plan detallado que vivía acá se ejecutó (punto 28) y el **PR #1 se mergeó el 2026-07-11**,
así que el rediseño ya está en producción (acento `#009CF5`, Plus Jakarta Sans, sin modo oscuro,
sin gradientes). Se quitó el plan de este archivo por ser ruido — el estado real es el código.
El detalle de las decisiones está en el punto 28 y en el historial del PR #1.

## Pendientes / próximos pasos

- [ ] **Confirmar a mano el round-trip de "Editar proyecto"** para el punto 27 (ecosistema
  cíclico) — crear un proyecto con etapas/ELMR/motor, cerrar el wizard, reabrir "Editar
  proyecto" y confirmar que todo (etapas, toques/loops con `etapaId`/`siguienteEtapaId`,
  mensajeBase, motor) se recarga igual. No se ejercitó ese paso específico con Playwright, solo
  crear + ver el resultado en la misma sesión.
- [ ] **Dar acceso a los otros 21 usuarios** — hoy solo `ktrujillo` tiene cuenta en `auth.users`;
  el resto sale con el badge "Sin acceso". **Ya se puede hacer desde la app**: Ajustes → editar →
  poner contraseña → "Crear cuenta de acceso" (punto 31). Falta hacerlo uno por uno.
- [ ] **`debe_cambiar_password` no lo hace cumplir nadie** — es solo una columna (default `true`
  en los 22). Falta el gate en el login que fuerce el cambio en el primer ingreso.
- [x] ~~Desplegar una edge function con service_role para crear cuentas de acceso~~ — hecho:
  `admin-usuarios` (punto 31). **Es la única desplegada.** `create-initial-user`,
  `update-user-password` y `send-notification` siguen en el repo, sin desplegar y con el chequeo de
  rol contra `user_roles` (vacía): están muertas, no conectarlas sin reescribirlas.
- [ ] **"Nuevo Usuario" podría crear la cuenta de acceso de una** — hoy agrega al directorio y hay
  que editar al usuario después para ponerle contraseña. `create-access` ya existe; solo falta
  ofrecer el campo en el diálogo de creación.
- [ ] **Considerar SMTP propio en Supabase Auth** — hoy `mailer_autoconfirm: false` (exige
  confirmar el correo) y no hay SMTP configurado, así que el mailer por defecto está muy limitado.
  Eso bloquea cualquier flujo de alta/recuperación por correo. `admin-usuarios` esquiva el problema
  con `email_confirm: true`, pero no habrá "olvidé mi contraseña" hasta resolver esto.
- [ ] **Cambiar la contraseña inicial de `ktrujillo`** — se fijó `Colombia2026*` a pedido del
  usuario, en texto plano en un chat, como acceso temporal.
- [ ] **Revocar el access token de Supabase (`sbp_...`)** usado el 2026-07-16 para aplicar la
  migración — se pegó en el chat y da acceso a **toda la cuenta**, no solo a este proyecto:
  https://supabase.com/dashboard/account/tokens
- [ ] **Borrar la rama `origin/worktree-bitacora-rediseno-tremu`** — su PR #1 ya se mergeó.
- [ ] **Investigar el `406` del `upsert` a `factory_projects`** — apareció al verificar el punto 23.
  Ojo: el 406 de la consola **no era ese** — era `app_version` + `.single()` sin sesión, y **ya no
  ocurre** (el punto 30 dejó de leer esa tabla; la consola de producción quedó limpia). Si el de
  `factory_projects` reaparece, es otra cosa. Sospecha razonable: el mismo patrón `.single()`
  contra 0 filas.
- [ ] Probar en producción quitar un canal ya guardado (ej. desmarcar BTL/KAM/Relacionamiento/Call
  Center en "Editar proyecto") y confirmar que `syncCanalNodes` (`factoryStore.ts`, punto 23) borra
  el nodo correspondiente en Flujo de trabajo — la lógica es simétrica a `syncRequerimientoNodes`
  (ya probada) pero no se ejercitó ese caso específico con Playwright.
- [ ] Confirmar CORS habilitado en los 2 webhooks n8n que sí existen y se usan (`crearlink`,
  `descargar-qr` — **`formulariolink` ya no se usa, ver punto 16, no hace falta CORS en ese**) — si
  no, la vista mostrará error apenas el usuario envíe el formulario. Para el nombre de archivo del
  QR, además exponer `Access-Control-Expose-Headers: Content-Disposition`.
- [ ] Probar `BitlyLinkTool.tsx` contra los webhooks reales de n8n (solo se verificó con mocks),
  incluyendo la descarga real del QR.
- [ ] **Riesgo detectado, no confirmado:** `CreateProjectWizard`'s `buildFabricaBriefs` reconstruye
  `fabricaBriefs` completo (IDs nuevos) cada vez que se guarda "Editar proyecto" — podría perder
  `deliverableContent`/`comments`/`workflowStatus` de entregables ya avanzados en Flujo de trabajo
  si se edita un proyecto en curso. Ver punto 14 de la bitácora. Preguntarle al usuario si esto ya
  le pasó antes de invertir en el rediseño (diff/merge) que arreglaría esto.
- [ ] Si un proyecto YA tiene el brief "Landing page" persistido con `roleLabel: 'Producción'`
  (creado antes del fix del punto 14), la tarjeta "Producción" sigue en su Equipo hasta que alguien
  abra "Editar proyecto" en ese proyecto puntual y guarde de nuevo — no fue necesario tocar la BD.

- [x] ~~Prioridad alta: revisar visualmente el nuevo diagrama de Flujo de trabajo en producción~~ —
  verificado con Playwright el 2026-07-08 (rama única probada; falta ver un caso con las 3 ramas
  a la vez — Landing + Formulario + Pauta simultáneos — en producción real).
- [x] ~~Implementar `addUser`/`updateUser`/`deleteUser` en `authStore.ts`~~ — hecho en el punto 30;
  editar y eliminar funcionan, y crear agrega al directorio (sin cuenta de acceso, ver pendiente de
  la edge function). Sigue pendiente: **`createUser`/`updateUserProfile`/`deleteUserProfile` de
  `authService.ts` quedaron marcadas OBSOLETAS** — escriben en `profiles`/`user_roles` (vacías, enum
  viejo) y nadie las llama. Si se conectan, reescribirlas primero contra `usuarios_roles`.
  **Ya no hace falta migrar el enum `user_roles.role`**: ese camino quedó muerto, los roles nuevos
  viven en `usuarios_roles.rol` como texto con check constraint.
- [ ] Confirmar con el usuario en producción: historial de aprobación con fecha/hora, activación
  automática de la siguiente tarea al aprobar, y el selector de roles fijos en Equipo — no se
  tocaron en esta sesión y siguen sin verificación visual.
- [x] ~~Confirmar con el usuario el mapeo de rol por canal nuevo en "Plan de canales" (BTL, KAM,
  Relacionamiento)~~ — confirmado explícitamente por el usuario en el punto 23: BTL/KAM/
  Relacionamiento/Call Center → Estratega (con nodo propio de "hecho sí/no + fecha"),
  Facebook/Instagram/TikTok/Google Ads → nuevo rol Trafficker.
- [ ] RLS más estricta por rol — quedó pendiente a propósito ("las RLS las creamos después"). Todas
  las tablas siguen `anon`-abiertas **menos `usuarios_roles`** (solo `authenticated`, ver punto 29).
  Desde 2026-07-16 ya hay sesión real, así que cerrar las demás a `authenticated` es viable — pero
  hay que confirmar antes que ningún camino escriba sin sesión, porque un rechazo de RLS **falla en
  silencio**.
- [x] ~~Revisar por qué se traba la descarga de Chromium para Playwright~~ — resuelto (punto 9).
  Chromium `chromium-1228` está completo en `%LOCALAPPDATA%\ms-playwright`. Recordatorio:
  `chromium.launch()` **necesita `executablePath`** apuntando a
  `chromium-1228/chrome-win64/chrome.exe` (no se descargó `chrome-headless-shell`).
- [ ] Edge functions (`create-initial-user`, `admin-set-password`, `send-notification`,
  `update-user-password`) no se redespliegan con `supabase db push` — están en el proyecto nuevo
  como código pero no se ha confirmado que estén desplegadas ahí.
