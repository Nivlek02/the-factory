import { useParams, Link } from 'react-router-dom';
import FactoryPageShell from './FactoryPageShell';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  ArrowLeft,
  Star,
  Share2,
  MoreHorizontal,
  Plus,
  CircleDot,
  Calendar,
  Users,
  Flag,
  Construction,
} from 'lucide-react';

const TABS = ['Overview', 'Tasks', 'Timeline', 'Calendar', 'Team', 'Deliverables', 'Files', 'Reports', 'Activity'];
const VIEWS = ['List', 'Kanban', 'Timeline', 'Gantt', 'Calendar', 'Workload'];

const FactoryProjectPage = () => {
  const { projectId } = useParams();

  return (
    <FactoryPageShell
      title="Evento Internacional 2025"
      description="Marketing Corp · Proyecto multi-equipo con Diseño, Copy, Social Media, SEO, Producción y Dirección."
      eyebrow={`Project · ${projectId}`}
      actions={
        <>
          <Link to="/factory/projects">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
              Projects
            </Button>
          </Link>
          <Button variant="outline" size="icon" className="h-9 w-9">
            <Star className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-9 w-9">
            <Share2 className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-9 w-9">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
          <Button size="sm" className="bg-gradient-factory text-factory-foreground shadow-glow">
            <Plus className="h-4 w-4" />
            Nueva tarea
          </Button>
        </>
      }
    >
      {/* Project meta strip */}
      <Card className="mb-4 shadow-sm">
        <CardContent className="p-5">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-5">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
                Estado
              </p>
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-state-progress-bg text-state-progress text-xs font-medium">
                <CircleDot className="h-3 w-3" />
                En proceso
              </span>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
                Prioridad
              </p>
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-priority-p0 text-priority-p0 text-xs font-semibold">
                <Flag className="h-3 w-3" />
                P0 — Crítica
              </span>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
                Fechas
              </p>
              <p className="text-xs font-medium flex items-center gap-1.5">
                <Calendar className="h-3 w-3 text-muted-foreground" />
                15 Oct → 12 Dic
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
                Equipos
              </p>
              <div className="flex -space-x-1.5">
                {['team-design', 'team-copy', 'team-social', 'team-production', 'team-direction'].map((t) => (
                  <div
                    key={t}
                    className="w-5 h-5 rounded-full ring-2 ring-card"
                    style={{ backgroundColor: `hsl(var(--${t}))` }}
                  />
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
                Progreso
              </p>
              <div className="flex items-center gap-2">
                <Progress value={72} className="h-2 flex-1" />
                <span className="text-xs font-semibold">72%</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-border mb-5 overflow-x-auto">
        <div className="flex">
          {TABS.map((tab, i) => (
            <button
              key={tab}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                i === 0
                  ? 'border-factory text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* View switcher */}
      <div className="flex items-center gap-1 mb-5 p-1 rounded-lg bg-muted/60 w-fit">
        {VIEWS.map((v, i) => (
          <button
            key={v}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              i === 0 ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      {/* Body placeholder */}
      <Card className="border-dashed border-2">
        <CardContent className="p-12 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-factory flex items-center justify-center shadow-glow mb-4 text-factory-foreground">
            <Construction className="h-6 w-6" />
          </div>
          <h3 className="font-display text-lg font-semibold mb-1">Vista de proyecto — Fase 2</h3>
          <p className="text-sm text-muted-foreground max-w-md mb-5">
            Aquí se renderizarán las tareas en las vistas List, Kanban, Timeline, Gantt, Calendar y Workload
            con multi-responsables, dependencias, watchers y aprobaciones.
          </p>
          <div className="flex gap-2">
            <Badge variant="outline" className="text-xs">
              <Users className="h-3 w-3 mr-1" />
              Multi-equipo
            </Badge>
            <Badge variant="outline" className="text-xs">
              Subtareas
            </Badge>
            <Badge variant="outline" className="text-xs">
              Dependencias
            </Badge>
            <Badge variant="outline" className="text-xs">
              Aprobaciones
            </Badge>
          </div>
        </CardContent>
      </Card>
    </FactoryPageShell>
  );
};

export default FactoryProjectPage;
