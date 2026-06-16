# Rediseño TREMU → THE FACTORY

Transformación de TREMU desde un modelo Trello (tableros aislados) hacia un ecosistema operativo tipo Asana/Linear, con **THE FACTORY** como núcleo: Proyectos → Equipos → Tareas → Subtareas.

Este es un rediseño de gran alcance. Lo dividiré en **3 fases entregables** para que puedas validar visualmente antes de avanzar a la lógica de datos.

---

## FASE 1 — Identidad visual + Sidebar + Dashboard (UI shell)

**Sin tocar lógica de negocio aún.** Solo la capa de presentación.

### 1.1 Design System "Factory"
- Nueva paleta semántica en `index.css` y `tailwind.config.ts`:
  - **Primario Factory:** indigo profundo (`238 75% 58%`) con glow eléctrico
  - **Superficies:** stack de 4 niveles (`bg`, `surface`, `surface-elevated`, `surface-overlay`)
  - **Estados operativos:** planning, in-progress, review, blocked, done, archived
  - **Prioridades:** P0 crítica → P3 baja con tokens dedicados
  - **Equipos:** color-coding por área (Diseño, Copy, Social, SEO, Producción, Dirección)
  - Gradientes sutiles `--gradient-factory`, sombras `--shadow-elevated`, `--shadow-glow`
- Tipografía: pareja display + body más distintiva (no Inter por defecto)
- Dark mode pulido y light mode premium

### 1.2 Sidebar nuevo (`AppSidebar.tsx`)
```
GENERAL
  · Inicio
  · Reportes
  · Seguimiento de eventos
  · Herramientas
  · Ajustes

THE FACTORY                    [badge: live dot]
  · Overview
  · Projects
  · Timeline
  · Teams
  · Calendar
  · Workload
  · Activity
  · Deliverables

PROYECTOS RECIENTES
  · [color dot] Proyecto A
  · [color dot] Proyecto B

FAVORITOS  ·  EQUIPOS ACTIVOS
```
- Header del sidebar con switcher de Workspace
- Command Palette (⌘K) abierto desde el sidebar
- Mantener colapso actual

### 1.3 Dashboard "Inicio" rediseñado
Layout ejecutivo en grid bento:
- Fila KPI: 4 métricas globales (proyectos activos, tareas críticas, entregables semana, % progreso)
- Bloque grande: Timeline operativo de la semana
- Carga laboral por equipo (workload chart horizontal)
- Actividad reciente (feed vivo)
- Entregables próximos (cards compactas con avatar stack)
- Tareas críticas P0/P1
- Calendario mini

### 1.4 Rutas nuevas (placeholders navegables)
- `/factory/overview`
- `/factory/projects`
- `/factory/projects/:projectId`
- `/factory/timeline`
- `/factory/teams`
- `/factory/calendar`
- `/factory/workload`
- `/factory/activity`
- `/factory/deliverables`

Las rutas existentes (`/`, `/reports`, `/webinars`, `/herramientas`, `/settings`, `/board/:id`) se mantienen funcionales. Los tableros antiguos seguirán accesibles durante la transición.

### Entregable Fase 1
Shell visual completo navegable con datos mock. Sin migración de DB.

---

## FASE 2 — Vista de Proyecto + Vista de Tarea

### 2.1 Vista de Proyecto (`/factory/projects/:id`)
**Header:**
- Nombre · cliente · estado pill · barra de progreso · prioridad · fechas · avatar stack de líderes · chips de equipos involucrados

**Tabs internas:** Overview · Tasks · Timeline · Calendar · Team · Deliverables · Files · Reports · Activity

**Switcher de vistas en Tasks:** List · Kanban · Timeline · Gantt · Calendar · Workload

### 2.2 Task Modal expandida (centro operativo)
Panel lateral grande estilo Linear/Height:
- Descripción rica (ya existe Tiptap)
- Subtareas con checklist
- Comentarios + actividad unificada (ya existe base)
- Archivos (ya existe)
- Etiquetas, prioridad, dependencias
- Múltiples responsables + watchers
- Aprobación flow
- Tiempo estimado vs invertido
- Historial (ya existe)

### 2.3 Componentes nuevos reutilizables
- `AvatarStack`, `StatusPill`, `PriorityFlag`, `TeamChip`
- `KanbanView`, `TimelineView`, `GanttView`, `WorkloadChart`
- `ActivityFeed`, `ApprovalCard`, `DependencyGraph`
- `CommandPalette` (⌘K global)
- `NotificationCenter`

### Entregable Fase 2
Experiencia completa de proyecto/tarea con UI Factory, conectada al schema actual de tareas como adaptador temporal.

---

## FASE 3 — Backend + Migración de datos

Solo después de validar Fases 1 y 2 visualmente:

### 3.1 Schema nuevo
- `workspaces`, `projects`, `project_teams`, `project_members`
- `teams` (Diseño, Copy, Social, SEO, Producción, Dirección)
- Extender `tasks` con `project_id`, `parent_task_id` (subtareas), `dependencies`, `watchers`, `estimated_hours`, `logged_hours`, `approval_status`
- Roles nuevos: Admin · Director · Project Manager · Team Lead · Member · Guest (tabla `user_roles` con enum, función `has_role` SECURITY DEFINER — sin romper roles actuales de Mercadeo/Diseñador/Copy/Manager/SEO)
- RLS por proyecto + membership

### 3.2 Migración
- Script para mapear tableros existentes → proyecto contenedor "Migración Legacy"
- Mantener compatibilidad para no romper datos en producción

### 3.3 IA y automatización (futuro)
- Resúmenes automáticos de proyecto vía Lovable AI (`google/gemini-2.5-flash`)
- Detección de bloqueos
- Sugerencias de asignación

---

## Detalles técnicos

- **Stack:** React + Vite + Tailwind + shadcn (sin cambios). Animaciones con `framer-motion`.
- **Compatibilidad:** Los tableros actuales (`/board/:id`) y su lógica permanecen intactos durante Fases 1-2. Fase 3 los reemplaza progresivamente.
- **Memoria de proyecto:** El idioma sigue siendo español, se mantiene `overflow-wrap: anywhere` para URLs largas, y se respetan todas las reglas existentes de permisos por rol.
- **No se tocará** `src/integrations/supabase/client.ts` ni `types.ts`.

---

## Qué necesito de ti antes de empezar

1. **¿Empezamos por Fase 1?** (recomendado — es lo que más impacto visual genera y desbloquea decisiones)
2. **¿Conservar idioma 100% español en THE FACTORY** o usar términos en inglés como "Overview", "Timeline", "Workload" tal como los pusiste?
3. **¿Light mode, dark mode o ambos** como prioridad para Fase 1?
4. **¿Algún proyecto/evento real que pueda usar como dataset de ejemplo** para el dashboard mock?

Una vez confirmes, arranco con Fase 1 completa en una sola entrega.
