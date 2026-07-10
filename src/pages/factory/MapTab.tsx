import { useEffect, useMemo, useState } from 'react';
import {
  FactoryProject,
  StrategyNode,
  StrategyStageType,
  useFactoryStore,
} from '@/store/factoryStore';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  MoreVertical, Trash2, Workflow, Rocket, ArrowRight,
  FileText, LayoutPanelTop, PenLine, Palette, Megaphone, Send,
  Target, TrendingUp, Users, DollarSign, RefreshCw,
  Briefcase, Store, Handshake, Phone, PhoneCall,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  ContentBriefPanel, DeliveryBriefPanel, DoneDateBriefPanel, PautaBriefPanel, briefsForNode,
} from './StrategyBriefPanels';
import { getBriefStatus } from '@/components/factory/DeliverableSummary';

// ───────────────────────────────────────────────────────────────────────────
// Stage palette: the strategic building blocks of a marketing project
// ───────────────────────────────────────────────────────────────────────────

interface StageMeta {
  type: StrategyStageType;
  label: string;
  short: string;
  icon: typeof FileText;
  color: string; // hsl token
  suggestRole?: string[]; // role label hints to auto-assign
}

const STAGES: StageMeta[] = [
  { type: 'formulario', label: 'Formulario',         short: 'Form',     icon: FileText,        color: 'hsl(var(--team-seo))',        suggestRole: ['Diseñador', 'SEO', 'Mercadeo'] },
  { type: 'landing',    label: 'Landing',            short: 'Landing',  icon: LayoutPanelTop,  color: 'hsl(var(--team-design))',     suggestRole: ['Diseñador', 'SEO'] },
  { type: 'copys',      label: 'Copys',              short: 'Copys',    icon: PenLine,         color: 'hsl(var(--team-copy))',       suggestRole: ['Copy'] },
  { type: 'diseno',     label: 'Diseño de piezas',   short: 'Diseño',   icon: Palette,         color: 'hsl(var(--team-design))',     suggestRole: ['Diseñador'] },
  { type: 'pauta',      label: 'Pauta en redes sociales', short: 'Pauta', icon: Megaphone,      color: 'hsl(var(--team-social))',      suggestRole: ['Trafficker'] },
  { type: 'envios',     label: 'Envíos masivos',     short: 'Envíos',   icon: Send,            color: 'hsl(var(--team-social))',     suggestRole: ['Mercadeo', 'Social'] },
  { type: 'kam',        label: 'KAM',                short: 'KAM',      icon: Briefcase,       color: 'hsl(var(--team-direction))',  suggestRole: ['Estratega'] },
  { type: 'btl',        label: 'BTL',                short: 'BTL',      icon: Store,           color: 'hsl(var(--team-production))', suggestRole: ['Estratega'] },
  { type: 'relacionamiento', label: 'Relacionamiento', short: 'Relac.', icon: Handshake,       color: 'hsl(var(--team-direction))',  suggestRole: ['Estratega'] },
  { type: 'callcenter_guion', label: 'Guion de llamada', short: 'Guion', icon: Phone,          color: 'hsl(var(--team-copy))',       suggestRole: ['Copywriter'] },
  { type: 'callcenter', label: 'Call Center',        short: 'Call Center', icon: PhoneCall,    color: 'hsl(var(--team-direction))',  suggestRole: ['Estratega'] },
];

const STAGE_BY_TYPE = Object.fromEntries(STAGES.map((s) => [s.type, s])) as Record<StrategyStageType, StageMeta>;

const STATUS_META: Record<StrategyNode['status'], { label: string; cls: string }> = {
  pending:     { label: 'Pendiente',   cls: 'bg-muted text-muted-foreground' },
  in_progress: { label: 'En proceso',  cls: 'bg-state-progress-bg text-state-progress' },
  in_review:   { label: 'En revisión', cls: 'bg-state-review-bg text-state-review' },
  completed:   { label: 'Completada',  cls: 'bg-state-done-bg text-state-done' },
};

// ───────────────────────────────────────────────────────────────────────────
// Lanes: agrupa los nodos en cadenas lineales por rama (cada raíz —sin
// dependsOn— inicia una rama que sigue a su único dependiente, ej.
// Copys → Diseño → Envíos, o Guion de llamada → Call Center). Un nodo con
// varios dependientes abre una rama nueva por cada uno. Las ramas se
// empacan en una grilla densa (ver `WorkflowTab`) en vez de apilarse en
// filas/carriles fijos — no hay agrupación por fase, solo por conexión real.
// ───────────────────────────────────────────────────────────────────────────

function computeLanes(nodes: StrategyNode[]): StrategyNode[][] {
  const byId = new Map(nodes.map((n) => [n.id, n] as const));
  const childrenOf = new Map<string, StrategyNode[]>();
  nodes.forEach((n) => {
    n.dependsOn.forEach((pid) => {
      if (!byId.has(pid)) return;
      if (!childrenOf.has(pid)) childrenOf.set(pid, []);
      childrenOf.get(pid)!.push(n);
    });
  });

  const visited = new Set<string>();
  const lanes: StrategyNode[][] = [];

  const buildLane = (start: StrategyNode) => {
    if (visited.has(start.id)) return;
    const lane: StrategyNode[] = [];
    let current: StrategyNode | undefined = start;
    const extraStarts: StrategyNode[] = [];
    while (current && !visited.has(current.id)) {
      lane.push(current);
      visited.add(current.id);
      const kids = (childrenOf.get(current.id) ?? []).filter((k) => !visited.has(k.id));
      current = kids[0];
      for (let i = 1; i < kids.length; i++) extraStarts.push(kids[i]);
    }
    lanes.push(lane);
    extraStarts.forEach(buildLane);
  };

  // Raíces reales (sin dependsOn) o "huérfanas" (dependsOn a nodos borrados).
  nodes
    .filter((n) => n.dependsOn.length === 0 || !n.dependsOn.some((p) => byId.has(p)))
    .forEach(buildLane);
  // Cualquier nodo restante (ciclo inesperado) — no debería pasar, pero por robustez.
  nodes.filter((n) => !visited.has(n.id)).forEach(buildLane);

  // Ramas más largas primero: al empacarlas en la grilla densa (ver `WorkflowTab`), colocar
  // las cadenas conectadas antes que los nodos sueltos deja mejores huecos para rellenar y
  // evita el desperdicio de espacio horizontal que dejaban los carriles de ancho fijo.
  return lanes.sort((a, b) => b.length - a.length);
}

// ─── Loop phases ──────────────────────────────────────────────────────────────

const LOOP_PHASES = [
  { key: 'estrategia',  label: 'Estrategia',  icon: Target,     desc: 'Define objetivos y segmentos', color: 'hsl(var(--team-seo))' },
  { key: 'ejecucion',   label: 'Ejecución',   icon: Megaphone,  desc: 'Activa canales y contenido',   color: 'hsl(var(--team-copy))' },
  { key: 'resultados',  label: 'Resultados',  icon: TrendingUp, desc: 'Mide alcance y conversiones',  color: 'hsl(var(--team-design))' },
  { key: 'aprendizaje', label: 'Aprendizaje', icon: RefreshCw,  desc: 'Optimiza y repite el ciclo',   color: 'hsl(var(--factory))' },
] as const;

// ─── Loop diagram as inline SVG ───────────────────────────────────────────────

const LoopDiagram = () => {
  const cx = 160, cy = 160, r = 100;
  const N = LOOP_PHASES.length;
  const gap = 0; // deg gap between arcs

  return (
    <svg viewBox="0 0 320 320" className="w-full max-w-[280px] h-auto mx-auto">
      <defs>
        {LOOP_PHASES.map((ph, i) => {
          const angle = (i / N) * 360 - 90;
          const nextAngle = ((i + 1) / N) * 360 - 90;
          const startRad = (angle * Math.PI) / 180;
          const endRad = ((nextAngle - gap) * Math.PI) / 180;
          const x1 = cx + r * Math.cos(startRad);
          const y1 = cy + r * Math.sin(startRad);
          const x2 = cx + r * Math.cos(endRad);
          const y2 = cy + r * Math.sin(endRad);
          const largeArc = nextAngle - angle - gap > 180 ? 1 : 0;
          return (
            <path
              key={ph.key}
              id={`arc-${ph.key}`}
              d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`}
              fill="none"
              stroke={ph.color}
              strokeWidth="28"
              strokeLinecap="round"
              opacity="0.25"
            />
          );
        })}
      </defs>

      {/* Connecting arcs (background) */}
      {LOOP_PHASES.map((ph, i) => {
        const angle = (i / N) * 360 - 90;
        const nextAngle = ((i + 1) / N) * 360 - 90;
        const startRad = (angle * Math.PI) / 180;
        const endRad = ((nextAngle - gap) * Math.PI) / 180;
        const x1 = cx + r * Math.cos(startRad);
        const y1 = cy + r * Math.sin(startRad);
        const x2 = cx + r * Math.cos(endRad);
        const y2 = cy + r * Math.sin(endRad);
        const largeArc = nextAngle - angle - gap > 180 ? 1 : 0;
        return (
          <path
            key={ph.key}
            d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`}
            fill="none"
            stroke={ph.color}
            strokeWidth="28"
            strokeLinecap="round"
            opacity="0.25"
          />
        );
      })}

      {/* Phase icons + labels */}
      {LOOP_PHASES.map((ph, i) => {
        const angle = ((i + 0.5) / N) * 360 - 90;
        const rad = (angle * Math.PI) / 180;
        const iconR = r + 38;
        const ix = cx + iconR * Math.cos(rad);
        const iy = cy + iconR * Math.sin(rad);
        const labelR = r + 62;
        const lx = cx + labelR * Math.cos(rad);
        const ly = cy + labelR * Math.sin(rad);
        return (
          <g key={ph.key}>
            <circle cx={ix} cy={iy} r="14" fill={ph.color} opacity="0.15" />
            {/* Icon */}
            <text x={ix} y={iy + 1} textAnchor="middle" dominantBaseline="central" fontSize="12" fill={ph.color} fontWeight="bold">
              {ph.label.charAt(0)}
            </text>
            {/* Label */}
            <text x={lx} y={ly} textAnchor="middle" dominantBaseline="central" fontSize="10" fill="currentColor" fontWeight="600" className="fill-foreground">
              {ph.label}
            </text>
          </g>
        );
      })}

      {/* Center arrow cycle */}
      <g transform={`translate(${cx},${cy})`}>
        <circle r="22" fill="none" stroke="hsl(var(--muted-foreground) / 0.3)" strokeWidth="1.5" strokeDasharray="3 3" />
        <path d="M -6 -6 L 8 0 L -6 6" fill="none" stroke="hsl(var(--muted-foreground) / 0.5)" strokeWidth="1.5" />
        <text textAnchor="middle" y="16" fontSize="8" fill="hsl(var(--muted-foreground))" className="fill-muted-foreground">
          ciclo
        </text>
      </g>
    </svg>
  );
};

// ─── Metric card ──────────────────────────────────────────────────────────────

const LoopMetric = ({
  label, value, delta, icon,
}: {
  label: string; value: string; delta: string; icon: React.ReactNode;
}) => {
  const isUp = delta.startsWith('+');
  return (
    <div className="rounded-lg border border-border/60 bg-card p-3 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className={`text-[10px] font-semibold flex items-center gap-0.5 ${isUp ? 'text-state-done' : 'text-state-blocked'}`}>
          {delta}
          <TrendingUp className={`h-3 w-3 ${!isUp ? 'rotate-180' : ''}`} />
        </span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-muted/60 flex items-center justify-center text-muted-foreground">
          {icon}
        </div>
        <span className="font-display text-lg font-semibold">{value}</span>
      </div>
    </div>
  );
};

// ───────────────────────────────────────────────────────────────────────────

interface Props {
  project: FactoryProject;
}

// ─── Flujo de trabajo — el tablero de "Construir estrategia" ────────────────

export const WorkflowTab = ({ project }: Props) => {
  const {
    addStrategyNode, updateStrategyNode, deleteStrategyNode,
  } = useFactoryStore();

  const nodes = project.strategyNodes ?? [];
  const lanes = useMemo(() => computeLanes(nodes), [nodes]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [tasksNodeId, setTasksNodeId] = useState<string | null>(null);

  const tasksByNodeId = useMemo(() => {
    const map = new Map<string, { total: number; pending: number }>();
    nodes.forEach((n) => {
      const matches = briefsForNode(project, n);
      map.set(n.id, {
        total: matches.length,
        pending: matches.filter((b) => getBriefStatus(b) !== 'completed').length,
      });
    });
    return map;
  }, [nodes, project]);



  const dottedBg = {
    backgroundImage: 'radial-gradient(circle, hsl(var(--border) / 0.55) 1px, transparent 1px)',
    backgroundSize: '18px 18px',
  } as React.CSSProperties;

  // ── Auto-build from canales + loops ────────────────────────────────────
  useEffect(() => {
    const canalTypes = project.canales?.map((c) => c.canal) ?? [];
    const loopRows = project.loops ?? [];
    if ((canalTypes.length === 0 && loopRows.length === 0) || nodes.length > 0) return;

    const typeToStage: Record<string, StrategyStageType> = {
      'Formulario de inscripción': 'formulario',
      Landing: 'landing',
      Copys: 'copys',
      Diseño: 'diseno',
      Pauta: 'pauta',
      Envíos: 'envios',
    };

    // Deduplicate by stage type while preserving order
    const seen = new Set<StrategyStageType>();
    const toCreate: { stage: StrategyStageType; label: string }[] = [];
    for (const ct of canalTypes) {
      const st = typeToStage[ct];
      if (st && !seen.has(st)) {
        seen.add(st);
        toCreate.push({ stage: st, label: ct });
      }
    }

    if (toCreate.length === 0 && loopRows.length === 0) return;

    // First pass: create all nodes, map id by stage type
    const nodeIdsByStage = new Map<StrategyStageType, string>();
    for (const item of toCreate) {
      const stage = STAGES.find((s) => s.type === item.stage);
      let role = stage?.suggestRole
        ? project.roleGroups.find((g) => stage.suggestRole!.some((sr) => g.roleLabel.toLowerCase().includes(sr.toLowerCase())))
        : undefined;
      if (!role) role = project.roleGroups[0];
      const member = role?.members[0];

      const id = addStrategyNode(project.id, {
        stageType: item.stage,
        label: item.label,
        roleId: role?.roleId ?? null,
        roleLabel: role?.roleLabel ?? null,
        memberId: member?.id ?? null,
        memberName: member?.name ?? null,
        status: 'pending',
        dependsOn: [], // will link second pass
      });
      nodeIdsByStage.set(item.stage, id);
    }

    // Create nodes from loops de comportamiento (custom type)
    const seenLoops = new Set<string>();
    const lastCanalId = nodeIdsByStage.get('envios') ?? nodeIdsByStage.get('pauta') ?? null;
    let prevLoopId: string | null = null;
    for (const loop of loopRows) {
      if (!loop.disparador && !loop.reaccion) continue;
      const key = `${loop.disparador}→${loop.reaccion}`;
      if (seenLoops.has(key)) continue;
      seenLoops.add(key);

      const role = loop.responsable
        ? project.roleGroups.find((g) => g.roleLabel === loop.responsable)
        : undefined;
      const member = role?.members[0];

      const id = addStrategyNode(project.id, {
        stageType: 'custom',
        label: `Loop: ${loop.disparador || '…'} → ${loop.reaccion || '…'}`,
        description: loop.responsable ? `Responsable: ${loop.responsable}` : undefined,
        roleId: role?.roleId ?? null,
        roleLabel: role?.roleLabel ?? null,
        memberId: member?.id ?? null,
        memberName: member?.name ?? null,
        status: 'pending',
        dependsOn: prevLoopId ? [prevLoopId] : lastCanalId ? [lastCanalId] : [],
      });
      prevLoopId = id;
    }

    // Second pass: set dependencies (copys → diseno → envios)
    const disenoId = nodeIdsByStage.get('diseno');
    const copysId = nodeIdsByStage.get('copys');
    if (disenoId && copysId) {
      updateStrategyNode(project.id, disenoId, { dependsOn: [copysId] });
    }
    const enviosId = nodeIdsByStage.get('envios');
    if (enviosId && disenoId) {
      updateStrategyNode(project.id, enviosId, { dependsOn: [disenoId] });
    } else if (enviosId && copysId) {
      updateStrategyNode(project.id, enviosId, { dependsOn: [copysId] });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Workflow className="h-3.5 w-3.5" />
        Flujo de trabajo
      </div>

      {nodes.length === 0 ? (
        <div className="border-2 border-dashed border-border rounded-xl p-12 text-center" style={dottedBg}>
          <Rocket className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium mb-1">Preparando tu estrategia de mercadeo</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Las etapas (Copys, Diseño, Envíos, etc.) se generan automáticamente a partir de los
            canales y loops definidos al crear el proyecto.
          </p>
        </div>
      ) : (
        <div className="flex items-start gap-0 w-full">
          {/* Nodo de inicio */}
          <div className="shrink-0 pr-1.5 pt-1">
            <div className="w-24 sm:w-28 rounded-lg shadow-glow text-factory-foreground bg-gradient-factory flex flex-col items-center justify-center text-center px-2 py-2.5">
              <Rocket className="h-4 w-4 mb-1" />
              <p className="text-[11px] font-semibold leading-tight">Inicia el proyecto</p>
              <p className="text-[9px] opacity-80 truncate max-w-full">{project.name}</p>
            </div>
          </div>

          <ArrowRight className="h-5 w-5 text-muted-foreground/40 shrink-0 mx-1 mt-6" />

          {/* Grilla densa: cada rama (nodo suelto o cadena conectada) es una celda que ocupa
             tantas columnas como nodos tenga; `grid-auto-flow: dense` rellena los huecos que
             dejan las ramas cortas con las siguientes, sin agrupar por fase ni carril. Las
             flechas dentro de una celda reflejan un `dependsOn` real entre esos nodos. */}
          <div
            className="flex-1 min-w-0 grid gap-3 items-start"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gridAutoFlow: 'dense' }}
          >
            {lanes.map((lane) => (
              <div
                key={lane[0].id}
                className="flex items-center gap-1 min-w-0"
                style={{ gridColumn: `span ${lane.length}` }}
              >
                {lane.map((n, j) => (
                  <div key={n.id} className="flex items-center min-w-0 flex-1">
                    <div className="flex-1 min-w-0">
                      <NodeCard
                        node={n}
                        taskCounts={tasksByNodeId.get(n.id)}
                        onOpenTasks={() => setTasksNodeId(n.id)}
                        onEdit={() => setEditingId(n.id)}
                        onStatus={(s) => updateStrategyNode(project.id, n.id, { status: s })}
                        onDelete={() => deleteStrategyNode(project.id, n.id)}
                      />
                    </div>
                    {j < lane.length - 1 && (
                      <ArrowRight className="h-4 w-4 text-muted-foreground/40 shrink-0 mx-1" />
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit node dialog */}
      {editingId && (
        <EditNodeDialog
          project={project}
          node={nodes.find((n) => n.id === editingId)!}
          onClose={() => setEditingId(null)}
          onSave={(updates) => {
            updateStrategyNode(project.id, editingId, updates);
            setEditingId(null);
          }}
        />
      )}

      {/* Tasks-for-node dialog */}
      {tasksNodeId && (() => {
        const node = nodes.find((n) => n.id === tasksNodeId);
        if (!node) return null;
        return (
          <NodeTasksDialog
            project={project}
            node={node}
            onClose={() => setTasksNodeId(null)}
          />
        );
      })()}
    </div>
  );
};

// ─── Dashboard de métricas ────────────────────────────────────────────────

export const MetricsDashboardTab = ({ project }: Props) => {
  const loopMetrics = useMemo(() => {
    const metricsBriefs = (project.fabricaBriefs ?? []).filter(
      (b) => b.tarea.startsWith('Recolectar métricas de') && b.deliverableMetricas
    );

    let totalBase = 0;
    let totalEnviados = 0;
    let totalApertura = 0;
    let totalClics = 0;

    for (const b of metricsBriefs) {
      const m = b.deliverableMetricas!;
      totalBase     += parseInt(m.baseTotal ?? '0');
      totalEnviados += parseInt(m.enviados  ?? '0');
      totalApertura += parseInt(m.apertura  ?? '0');
      totalClics    += parseInt(m.clics     ?? '0');
    }

    const fmt = (n: number) => n > 0 ? n.toLocaleString('es-CO') : '—';

    return {
      base:     { value: fmt(totalBase),     delta: '—' },
      enviados: { value: fmt(totalEnviados), delta: '—' },
      apertura: { value: fmt(totalApertura), delta: '—' },
      clics:    { value: fmt(totalClics),    delta: '—' },
    };
  }, [project.fabricaBriefs]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/60 bg-card/70 p-3 shadow-sm">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-3">
          <TrendingUp className="h-3 w-3" />
          Dashboard de métricas
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <LoopMetric label="Base total" value={loopMetrics.base.value} delta={loopMetrics.base.delta} icon={<Users className="h-3.5 w-3.5" />} />
          <LoopMetric label="Enviados" value={loopMetrics.enviados.value} delta={loopMetrics.enviados.delta} icon={<TrendingUp className="h-3.5 w-3.5" />} />
          <LoopMetric label="Apertura" value={loopMetrics.apertura.value} delta={loopMetrics.apertura.delta} icon={<Target className="h-3.5 w-3.5" />} />
          <LoopMetric label="Clics" value={loopMetrics.clics.value} delta={loopMetrics.clics.delta} icon={<DollarSign className="h-3.5 w-3.5" />} />
        </div>
      </div>
    </div>
  );
};

// ─── Loop — el ciclo de comportamiento del proyecto ─────────────────────────

export const LoopTab = ({ project }: Props) => {
  return (
    <div className="space-y-4">
      <div className="max-w-md mx-auto w-full rounded-xl border border-border/60 bg-card/70 p-4 shadow-sm">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-center gap-1.5 mb-3">
          <RefreshCw className="h-3 w-3" />
          Ciclo Loop
        </h3>
        <LoopDiagram />
        <p className="text-xs text-muted-foreground text-center mt-2">{project.name}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto w-full">
        {LOOP_PHASES.map((ph) => {
          const Icon = ph.icon;
          return (
            <div key={ph.key} className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-card p-3 shadow-sm">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${ph.color}20`, color: ph.color }}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold">{ph.label}</p>
                <p className="text-[11px] text-muted-foreground">{ph.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ───────────────────────────────────────────────────────────────────────────

const NodeCard = ({
  node, onEdit, onStatus, onDelete, onOpenTasks, taskCounts,
}: {
  node: StrategyNode;
  onEdit: () => void;
  onStatus: (s: StrategyNode['status']) => void;
  onDelete: () => void;
  onOpenTasks: () => void;
  taskCounts?: { total: number; pending: number };
}) => {
  const stage = STAGE_BY_TYPE[node.stageType];
  const Icon = stage?.icon ?? FileText;
  const statusMeta = STATUS_META[node.status];

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpenTasks}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenTasks(); } }}
      className="relative w-full rounded-xl bg-card border shadow-sm hover:shadow-lg transition-shadow p-4 group cursor-pointer focus:outline-none focus:ring-2 focus:ring-factory/40"
      style={{ borderLeft: `5px solid ${stage?.color ?? 'hsl(var(--border))'}` }}
    >
      {/* pending tasks badge */}
      {taskCounts && taskCounts.pending > 0 && (
        <span
          className="absolute -top-2 -right-2 min-w-[22px] h-[22px] px-1.5 rounded-full bg-factory text-factory-foreground text-xs font-bold flex items-center justify-center ring-2 ring-background shadow-sm"
          title={`${taskCounts.pending} tareas pendientes`}
        >
          {taskCounts.pending}
        </span>
      )}

      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="h-5 w-5 shrink-0" style={{ color: stage?.color }} />
          <p className="text-base font-semibold leading-tight">{node.label}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity shrink-0"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={onEdit}>
              <PenLine className="h-3.5 w-3.5 mr-2" /> Editar etapa
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">Estado</DropdownMenuLabel>
            {(['pending', 'in_progress', 'in_review', 'completed'] as const).map((s) => (
              <DropdownMenuItem key={s} onClick={() => onStatus(s)} disabled={node.status === s}>
                <span className={`inline-block w-2 h-2 rounded-full mr-2 ${STATUS_META[s].cls.split(' ')[0]}`} />
                {STATUS_META[s].label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5 mr-2" /> Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center justify-between mt-1.5 gap-2">
        <Badge variant="outline" className={`text-xs px-2 h-5 shrink-0 ${statusMeta.cls} border-0`}>
          {statusMeta.label}
        </Badge>
        {node.roleLabel && (
          <span className="text-xs text-muted-foreground truncate">{node.roleLabel}</span>
        )}
      </div>

      {node.memberName && (
        <div className="flex items-center gap-1.5 mt-2">
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
            style={{ backgroundColor: stage?.color ?? 'hsl(var(--muted-foreground))' }}
          >
            {node.memberName.charAt(0).toUpperCase()}
          </div>
          <span className="text-xs text-foreground/80 truncate">{node.memberName}</span>
        </div>
      )}
    </div>
  );
};

// ───────────────────────────────────────────────────────────────────────────

const EditNodeDialog = ({
  project, node, onClose, onSave,
}: {
  project: FactoryProject;
  node: StrategyNode;
  onClose: () => void;
  onSave: (updates: Partial<StrategyNode>) => void;
}) => {
  const [label, setLabel] = useState(node.label);
  const [description, setDescription] = useState(node.description ?? '');
  const [roleId, setRoleId] = useState(node.roleId ?? '');
  const [memberId, setMemberId] = useState(node.memberId ?? '');

  const role = project.roleGroups.find((g) => g.roleId === roleId);
  const members = role?.members ?? [];

  const handleSave = () => {
    const r = project.roleGroups.find((g) => g.roleId === roleId);
    const m = r?.members.find((x) => x.id === memberId);
    onSave({
      label: label.trim() || node.label,
      description: description.trim(),
      roleId: r?.roleId ?? null,
      roleLabel: r?.roleLabel ?? null,
      memberId: m?.id ?? null,
      memberName: m?.name ?? null,
    });
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar etapa — {STAGE_BY_TYPE[node.stageType]?.label}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>Nombre</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>Notas <span className="text-muted-foreground">(opcional)</span></Label>
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>Rol</Label>
              <Select value={roleId} onValueChange={(v) => { setRoleId(v); setMemberId(''); }}>
                <SelectTrigger><SelectValue placeholder="Sin rol" /></SelectTrigger>
                <SelectContent>
                  {project.roleGroups.length === 0
                    ? <SelectItem value="__n__" disabled>Agrega roles al equipo</SelectItem>
                    : project.roleGroups.map((g) => (
                        <SelectItem key={g.roleId} value={g.roleId}>{g.roleLabel}</SelectItem>
                      ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Persona</Label>
              <Select value={memberId} onValueChange={setMemberId} disabled={!roleId}>
                <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                <SelectContent>
                  {members.length === 0
                    ? <SelectItem value="__n__" disabled>Sin personas en el rol</SelectItem>
                    : members.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                      ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ───────────────────────────────────────────────────────────────────────────
// Tasks panel — opened when clicking a strategy node card.
// Shows tasks assigned to that node's role, with pending ones grouped first.
// ───────────────────────────────────────────────────────────────────────────

const NodeTasksDialog = ({
  project, node, onClose,
}: {
  project: FactoryProject;
  node: StrategyNode;
  onClose: () => void;
}) => {
  const stage = STAGE_BY_TYPE[node.stageType];
  const Icon = stage?.icon ?? FileText;

  const briefPendingCount = briefsForNode(project, node).filter((b) => getBriefStatus(b) !== 'completed').length;

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span
              className="w-7 h-7 rounded-md flex items-center justify-center"
              style={{ backgroundColor: `${stage?.color}20`, color: stage?.color }}
            >
              <Icon className="h-4 w-4" />
            </span>
            <div className="leading-tight">
              <div className="text-sm font-semibold">{node.label}</div>
              <div className="text-[11px] text-muted-foreground font-normal">
                {node.roleLabel ?? 'Sin rol'} · {briefPendingCount} pendiente{briefPendingCount !== 1 ? 's' : ''}
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        {node.stageType === 'envios' ? (
          <DeliveryBriefPanel project={project} node={node} />
        ) : node.stageType === 'pauta' ? (
          <PautaBriefPanel project={project} node={node} />
        ) : node.stageType === 'kam' || node.stageType === 'btl' || node.stageType === 'relacionamiento' || node.stageType === 'callcenter' ? (
          <DoneDateBriefPanel project={project} node={node} />
        ) : (
          <ContentBriefPanel project={project} node={node} />
        )}

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};



