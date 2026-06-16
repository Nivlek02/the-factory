import FactoryPlaceholder from './FactoryPlaceholder';
import {
  FolderKanban,
  GanttChartSquare,
  Users,
  Calendar,
  Gauge,
  Activity,
  PackageCheck,
} from 'lucide-react';

export const ProjectsPage = () => (
  <FactoryPlaceholder
    title="Projects"
    description="Gestiona proyectos y eventos como un ecosistema multi-equipo: prioridades, líderes, fechas y dependencias en un solo lugar."
    icon={<FolderKanban className="h-7 w-7" />}
    features={[
      'Crear y archivar proyectos',
      'Vistas List · Kanban · Timeline · Gantt',
      'Equipos multi-área por proyecto',
      'Filtros por estado y prioridad',
    ]}
  />
);

export const TimelinePage = () => (
  <FactoryPlaceholder
    title="Timeline"
    description="Visualiza el flujo de producción de toda la organización en una línea de tiempo unificada."
    icon={<GanttChartSquare className="h-7 w-7" />}
    features={[
      'Vista Gantt interactiva',
      'Dependencias entre tareas',
      'Hitos y milestones',
      'Drag & drop de fechas',
    ]}
  />
);

export const TeamsPage = () => (
  <FactoryPlaceholder
    title="Teams"
    description="Equipos activos, miembros, líderes y proyectos asignados — diseño, copy, social media, SEO, producción y dirección."
    icon={<Users className="h-7 w-7" />}
    features={[
      'Directorio por equipo',
      'Capacidades y skills',
      'Roles y permisos',
      'Asignación inter-equipos',
    ]}
  />
);

export const CalendarPage = () => (
  <FactoryPlaceholder
    title="Calendar"
    description="Calendario unificado de entregables, reuniones, deadlines y eventos por proyecto y equipo."
    icon={<Calendar className="h-7 w-7" />}
    features={[
      'Vistas mes / semana / día',
      'Filtros por equipo',
      'Sincronización con eventos',
      'Recordatorios automáticos',
    ]}
  />
);

export const WorkloadPage = () => (
  <FactoryPlaceholder
    title="Workload"
    description="Distribución de carga laboral por persona y equipo — detecta sobrecargas y rebalancea en segundos."
    icon={<Gauge className="h-7 w-7" />}
    features={[
      'Capacidad por persona',
      'Heatmap de carga semanal',
      'Alertas de overload',
      'Rebalanceo asistido por IA',
    ]}
  />
);

export const ActivityPage = () => (
  <FactoryPlaceholder
    title="Activity"
    description="Feed unificado de toda la actividad operativa: comentarios, aprobaciones, cambios de estado y entregas."
    icon={<Activity className="h-7 w-7" />}
    features={[
      'Filtros por proyecto / equipo',
      'Menciones y notificaciones',
      'Audit log completo',
      'Exportable a reportes',
    ]}
  />
);

export const DeliverablesPage = () => (
  <FactoryPlaceholder
    title="Deliverables"
    description="Pipeline de entregables: en producción, en revisión, aprobados y entregados al cliente."
    icon={<PackageCheck className="h-7 w-7" />}
    features={[
      'Estados de aprobación',
      'Versiones y revisiones',
      'Vínculo con tareas',
      'Compartir con stakeholders',
    ]}
  />
);
