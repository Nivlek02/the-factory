import FactoryPageShell from './FactoryPageShell';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  ArrowUpRight,
  Plus,
  Filter,
  TrendingUp,
  TrendingDown,
  FolderKanban,
  AlertOctagon,
  PackageCheck,
  Activity,
  Flame,
  CircleDot,
  Clock,
  CheckCircle2,
  GitBranch,
  MessageSquare,
  FileUp,
  UserPlus,
} from 'lucide-react';
import { Link } from 'react-router-dom';

const KPI = ({
  label,
  value,
  delta,
  trend,
  icon,
  tone = 'default',
}: {
  label: string;
  value: string;
  delta: string;
  trend: 'up' | 'down';
  icon: React.ReactNode;
  tone?: 'default' | 'critical' | 'success' | 'warning';
}) => {
  const toneRing = {
    default: 'ring-border',
    critical: 'ring-state-blocked/20',
    success: 'ring-state-done/20',
    warning: 'ring-state-review/20',
  }[tone];

  const iconBg = {
    default: 'bg-factory-soft text-factory',
    critical: 'bg-state-blocked-bg text-state-blocked',
    success: 'bg-state-done-bg text-state-done',
    warning: 'bg-state-review-bg text-state-review',
  }[tone];

  return (
    <Card className={`relative overflow-hidden ring-1 ${toneRing} shadow-sm hover:shadow-elevated transition-shadow`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg}`}>
            {icon}
          </div>
          <span
            className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${
              trend === 'up' ? 'bg-state-done-bg text-state-done' : 'bg-state-blocked-bg text-state-blocked'
            }`}
          >
            {trend === 'up' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {delta}
          </span>
        </div>
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
          {label}
        </p>
        <p className="font-display text-3xl font-semibold text-foreground tracking-tight">{value}</p>
      </CardContent>
    </Card>
  );
};

const projects = [
  {
    id: 'evento-marketing-2025',
    name: 'Evento Internacional 2025',
    client: 'Marketing Corp',
    progress: 72,
    state: 'in_progress',
    teams: ['team-design', 'team-copy', 'team-social', 'team-production'],
    due: '12 Dic',
    priority: 'P0',
  },
  {
    id: 'campana-q1',
    name: 'Campaña Q1 — Lanzamiento',
    client: 'Brand Studio',
    progress: 48,
    state: 'in_progress',
    teams: ['team-copy', 'team-social', 'team-seo'],
    due: '28 Ene',
    priority: 'P1',
  },
  {
    id: 'rebranding',
    name: 'Rebranding Corporativo',
    client: 'Internal',
    progress: 92,
    state: 'review',
    teams: ['team-design', 'team-direction'],
    due: '02 Dic',
    priority: 'P1',
  },
  {
    id: 'seo-portal',
    name: 'SEO Portal Institucional',
    client: 'Portal LATAM',
    progress: 23,
    state: 'planeacion',
    teams: ['team-seo', 'team-copy'],
    due: '15 Feb',
    priority: 'P2',
  },
];

const STATE_META: Record<string, { label: string; cls: string }> = {
  planning: { label: 'Planeacion', cls: 'bg-state-planning-bg text-state-planning' },
  in_progress: { label: 'En proceso', cls: 'bg-state-progress-bg text-state-progress' },
  review: { label: 'En revisión', cls: 'bg-state-review-bg text-state-review' },
  blocked: { label: 'Bloqueado', cls: 'bg-state-blocked-bg text-state-blocked' },
  done: { label: 'Completado', cls: 'bg-state-done-bg text-state-done' },
};

const workload = [
  { team: 'Diseño', color: 'team-design', load: 86, members: 4 },
  { team: 'Copy', color: 'team-copy', load: 64, members: 3 },
  { team: 'Social Media', color: 'team-social', load: 48, members: 2 },
  { team: 'SEO', color: 'team-seo', load: 71, members: 2 },
  { team: 'Producción', color: 'team-production', load: 92, members: 3 },
  { team: 'Dirección', color: 'team-direction', load: 35, members: 2 },
];

const activity = [
  { who: 'Camila R.', action: 'aprobó el entregable', target: 'Banner Hero v3', time: 'hace 12 min', icon: CheckCircle2, tone: 'text-state-done' },
  { who: 'Yeinis Z.', action: 'comentó en', target: 'Copy Landing — versión 2', time: 'hace 38 min', icon: MessageSquare, tone: 'text-factory' },
  { who: 'María S.', action: 'subió 4 archivos a', target: 'Evento Internacional 2025', time: 'hace 1 h', icon: FileUp, tone: 'text-team-design' },
  { who: 'Laura G.', action: 'invitó a', target: 'Carlos P. al proyecto Rebranding', time: 'hace 2 h', icon: UserPlus, tone: 'text-team-direction' },
  { who: 'Ana M.', action: 'creó una dependencia en', target: 'SEO Portal Institucional', time: 'hace 3 h', icon: GitBranch, tone: 'text-team-seo' },
];

const deliverables = [
  { name: 'Banner Hero v3', project: 'Evento Internacional 2025', due: 'Hoy', priority: 'P0' },
  { name: 'Copy Landing v2', project: 'Campaña Q1', due: 'Mañana', priority: 'P1' },
  { name: 'Reel Instagram', project: 'Rebranding', due: '2 Dic', priority: 'P1' },
  { name: 'Auditoría SEO inicial', project: 'SEO Portal', due: '4 Dic', priority: 'P2' },
];

const FactoryOverviewPage = () => {
  return (
    <FactoryPageShell
      title="Overview"
      description="Centro operativo de producción — visión ejecutiva de proyectos, equipos y entregables en tiempo real."
      actions={
        <>
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4" />
            Filtros
          </Button>
          <Button size="sm" className="bg-gradient-factory hover:opacity-90 text-factory-foreground shadow-glow">
            <Plus className="h-4 w-4" />
            Nuevo proyecto
          </Button>
        </>
      }
    >
      {/* KPI ROW */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPI label="Proyectos activos" value="14" delta="+3" trend="up" icon={<FolderKanban className="h-5 w-5" />} />
        <KPI label="Tareas críticas" value="7" delta="+2" trend="up" icon={<AlertOctagon className="h-5 w-5" />} tone="critical" />
        <KPI label="Entregables semana" value="23" delta="-4" trend="down" icon={<PackageCheck className="h-5 w-5" />} tone="warning" />
        <KPI label="Progreso operativo" value="68%" delta="+6%" trend="up" icon={<Activity className="h-5 w-5" />} tone="success" />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Active projects — wide */}
        <Card className="lg:col-span-2 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-display text-base font-semibold">Proyectos activos</h2>
                <p className="text-xs text-muted-foreground">Estado en vivo de tu pipeline operativo</p>
              </div>
              <Link to="/factory/projects">
                <Button variant="ghost" size="sm" className="text-factory hover:text-factory hover:bg-factory-soft">
                  Ver todos
                  <ArrowUpRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>

            <div className="space-y-2">
              {projects.map((p) => (
                <Link key={p.id} to={`/factory/projects/${p.id}`}>
                  <div className="group flex items-center gap-4 p-3 rounded-xl border border-border/60 hover:border-factory/30 hover:bg-factory-soft/40 transition-all">
                    <div className="w-10 h-10 rounded-lg bg-gradient-factory-soft flex items-center justify-center shrink-0">
                      <FolderKanban className="h-5 w-5 text-factory" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-sm truncate">{p.name}</p>
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 h-4 font-semibold ${
                            p.priority === 'P0'
                              ? 'border-priority-p0 text-priority-p0'
                              : p.priority === 'P1'
                              ? 'border-priority-p1 text-priority-p1'
                              : 'border-priority-p2 text-priority-p2'
                          }`}
                        >
                          {p.priority}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                        <span>{p.client}</span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {p.due}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${STATE_META[p.state].cls}`}>
                          <CircleDot className="h-2.5 w-2.5" />
                          {STATE_META[p.state].label}
                        </span>
                      </div>
                    </div>

                    {/* teams stack */}
                    <div className="hidden md:flex -space-x-1.5 shrink-0">
                      {p.teams.map((t) => (
                        <div
                          key={t}
                          className="w-6 h-6 rounded-full ring-2 ring-card"
                          style={{ backgroundColor: `hsl(var(--${t}))` }}
                          title={t}
                        />
                      ))}
                    </div>

                    {/* progress */}
                    <div className="hidden sm:flex flex-col items-end gap-1 shrink-0 w-24">
                      <span className="text-[11px] font-semibold text-foreground">{p.progress}%</span>
                      <Progress value={p.progress} className="h-1.5 w-full" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Activity feed */}
        <Card className="shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-display text-base font-semibold">Actividad reciente</h2>
                <p className="text-xs text-muted-foreground">Lo que está pasando ahora</p>
              </div>
              <span className="flex items-center gap-1.5 text-[10px] font-medium text-state-done">
                <span className="w-1.5 h-1.5 rounded-full bg-state-done animate-pulse" />
                LIVE
              </span>
            </div>
            <ul className="space-y-3">
              {activity.map((a, i) => {
                const Icon = a.icon;
                return (
                  <li key={i} className="flex gap-3">
                    <div className={`w-7 h-7 rounded-full bg-muted/60 flex items-center justify-center shrink-0 ${a.tone}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-foreground leading-relaxed">
                        <span className="font-medium">{a.who}</span>{' '}
                        <span className="text-muted-foreground">{a.action}</span>{' '}
                        <span className="font-medium">{a.target}</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{a.time}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        {/* Workload */}
        <Card className="lg:col-span-2 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-display text-base font-semibold">Carga laboral por equipo</h2>
                <p className="text-xs text-muted-foreground">Distribución actual de capacidad</p>
              </div>
              <Link to="/factory/workload">
                <Button variant="ghost" size="sm" className="text-factory hover:text-factory hover:bg-factory-soft">
                  Detalle
                  <ArrowUpRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
            <div className="space-y-3">
              {workload.map((w) => (
                <div key={w.team} className="flex items-center gap-3">
                  <div className="flex items-center gap-2 w-32 shrink-0">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: `hsl(var(--${w.color}))` }} />
                    <span className="text-xs font-medium">{w.team}</span>
                  </div>
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${w.load}%`,
                        backgroundColor: w.load > 85 ? `hsl(var(--state-blocked))` : `hsl(var(--${w.color}))`,
                      }}
                    />
                  </div>
                  <div className="w-20 text-right text-[11px] text-muted-foreground shrink-0">
                    <span className="font-semibold text-foreground">{w.load}%</span> · {w.members}p
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Deliverables upcoming */}
        <Card className="shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-display text-base font-semibold">Entregables próximos</h2>
                <p className="text-xs text-muted-foreground">Los siguientes en cola</p>
              </div>
              <Flame className="h-4 w-4 text-priority-p0" />
            </div>
            <ul className="space-y-2">
              {deliverables.map((d, i) => (
                <li
                  key={i}
                  className="flex items-center gap-3 p-2.5 rounded-lg border border-border/50 hover:bg-muted/40 transition-colors"
                >
                  <div className="w-1 h-8 rounded-full bg-gradient-factory" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{d.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{d.project}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] font-semibold text-priority-p0">{d.due}</p>
                    <span className="text-[9px] text-muted-foreground">{d.priority}</span>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </FactoryPageShell>
  );
};

export default FactoryOverviewPage;
