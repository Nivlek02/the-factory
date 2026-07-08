import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FactoryProject,
  ProjectTask,
  StrategyNode,
  StrategyStageType,
  useFactoryStore,
} from '@/store/factoryStore';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Plus, MoreVertical, Trash2, Workflow, Rocket,
  FileText, LayoutPanelTop, PenLine, Palette, Megaphone, Send, Link2,
  Target, TrendingUp, Users, DollarSign, RefreshCw, CheckCircle2,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuCheckboxItem,
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
  ContentBriefPanel, ApprovalQueuePanel, DeliveryBriefPanel, briefsForNode,
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
  { type: 'aprobacion', label: 'Aprobación',         short: 'Aprueba',  icon: CheckCircle2,    color: 'hsl(var(--factory))',         suggestRole: ['Estratega'] },
  { type: 'diseno',     label: 'Diseño de piezas',   short: 'Diseño',   icon: Palette,         color: 'hsl(var(--team-design))',     suggestRole: ['Diseñador'] },
  { type: 'pauta',      label: 'Pauta',              short: 'Pauta',    icon: Megaphone,       color: 'hsl(var(--team-production))', suggestRole: ['Mercadeo', 'Manager'] },
  { type: 'envios',     label: 'Envíos masivos',     short: 'Envíos',   icon: Send,            color: 'hsl(var(--team-social))',     suggestRole: ['Mercadeo', 'Social'] },
];

const STAGE_BY_TYPE = Object.fromEntries(STAGES.map((s) => [s.type, s])) as Record<StrategyStageType, StageMeta>;

/** Etapas cuyo panel de tareas gestiona entregables (FabricaBriefItem) en vez del todo-list simple. */
const BRIEF_DRIVEN_STAGES: StrategyStageType[] = ['copys', 'diseno', 'aprobacion', 'envios'];

const STATUS_META: Record<StrategyNode['status'], { label: string; cls: string }> = {
  pending:     { label: 'Pendiente',   cls: 'bg-muted text-muted-foreground' },
  in_progress: { label: 'En proceso',  cls: 'bg-state-progress-bg text-state-progress' },
  in_review:   { label: 'En revisión', cls: 'bg-state-review-bg text-state-review' },
  completed:   { label: 'Completada',  cls: 'bg-state-done-bg text-state-done' },
};

// ───────────────────────────────────────────────────────────────────────────
// Layout: topological depth + vertical stacking per column
// ───────────────────────────────────────────────────────────────────────────

const COL_W = 240;
const ROW_H = 130;
const PAD_X = 32;
const PAD_Y = 32;
const NODE_W = 200;
const NODE_H = 96;

interface PositionedNode extends StrategyNode {
  col: number;
  row: number;
  x: number;
  y: number;
}

function layout(nodes: StrategyNode[]): { placed: PositionedNode[]; width: number; height: number } {
  // depth = longest path from a root (no deps) to this node
  const depth = new Map<string, number>();
  const visiting = new Set<string>();
  const byId = new Map(nodes.map((n) => [n.id, n] as const));

  const dfs = (id: string): number => {
    if (depth.has(id)) return depth.get(id)!;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const n = byId.get(id);
    const d = !n || n.dependsOn.length === 0
      ? 1
      : 1 + Math.max(0, ...n.dependsOn.filter((p) => byId.has(p)).map(dfs));
    visiting.delete(id);
    depth.set(id, d);
    return d;
  };

  nodes.forEach((n) => dfs(n.id));

  // group by column for nodes without a custom position
  const cols = new Map<number, StrategyNode[]>();
  nodes.forEach((n) => {
    if (n.position) return;
    const c = depth.get(n.id) ?? 1;
    if (!cols.has(c)) cols.set(c, []);
    cols.get(c)!.push(n);
  });

  const placed: PositionedNode[] = nodes.map((n) => {
    if (n.position) {
      return { ...n, col: depth.get(n.id) ?? 1, row: 0, x: n.position.x, y: n.position.y };
    }
    const c = depth.get(n.id) ?? 1;
    const list = cols.get(c) ?? [];
    const i = list.indexOf(n);
    return {
      ...n,
      col: c,
      row: i,
      x: PAD_X + c * COL_W,
      y: PAD_Y + i * ROW_H,
    };
  });

  const maxX = placed.length ? Math.max(...placed.map((p) => p.x + NODE_W)) : COL_W;
  const maxY = placed.length ? Math.max(...placed.map((p) => p.y + NODE_H)) : ROW_H;
  return { placed, width: maxX + PAD_X, height: maxY + PAD_Y };
}


// ───────────────────────────────────────────────────────────────────────────
// Bezier path from one node port to another
// ───────────────────────────────────────────────────────────────────────────

function pathBetween(x1: number, y1: number, x2: number, y2: number) {
  const dx = Math.max(40, (x2 - x1) / 2);
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
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

export const LoopTab = ({ project }: Props) => {
  const {
    addStrategyNode, updateStrategyNode, deleteStrategyNode,
    addTask, updateTask, deleteTask,
  } = useFactoryStore();

  const nodes = project.strategyNodes ?? [];
  const { placed, width, height } = useMemo(() => layout(nodes), [nodes]);
  const placedById = useMemo(() => new Map(placed.map((p) => [p.id, p])), [placed]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [tasksNodeId, setTasksNodeId] = useState<string | null>(null);

  const tasksByNodeId = useMemo(() => {
    const map = new Map<string, { total: number; pending: number }>();
    nodes.forEach((n) => {
      if (BRIEF_DRIVEN_STAGES.includes(n.stageType)) {
        const matches = n.stageType === 'envios'
          ? briefsForNode(project, n).filter((b) => b.tarea.startsWith('Configurar envío por'))
          : briefsForNode(project, n);
        map.set(n.id, {
          total: matches.length,
          pending: matches.filter((b) => getBriefStatus(b) !== 'completed').length,
        });
        return;
      }
      const matches = project.tasks.filter(
        (t) => n.roleLabel && t.assignedRoleLabel === n.roleLabel,
      );
      map.set(n.id, {
        total: matches.length,
        pending: matches.filter((t) => t.status !== 'completed').length,
      });
    });
    return map;
  }, [nodes, project]);



  const handleAddStage = (stage: StageMeta) => {
    // Suggest role + member from project roleGroups
    let role = stage.suggestRole
      ? project.roleGroups.find((g) => stage.suggestRole!.some((s) => g.roleLabel.toLowerCase().includes(s.toLowerCase())))
      : undefined;
    if (!role) role = project.roleGroups[0];
    const member = role?.members[0];

    // Auto-link suggested chain: copys → diseno → envios
    let dependsOn: string[] = [];
    if (stage.type === 'diseno') {
      const copys = nodes.find((n) => n.stageType === 'copys');
      if (copys) dependsOn = [copys.id];
    } else if (stage.type === 'envios') {
      const diseno = nodes.find((n) => n.stageType === 'diseno');
      const copys = nodes.find((n) => n.stageType === 'copys');
      if (diseno) dependsOn = [diseno.id];
      else if (copys) dependsOn = [copys.id];
    }

    addStrategyNode(project.id, {
      stageType: stage.type,
      label: stage.label,
      roleId: role?.roleId ?? null,
      roleLabel: role?.roleLabel ?? null,
      memberId: member?.id ?? null,
      memberName: member?.name ?? null,
      status: 'pending',
      dependsOn,
    });
  };

  const dottedBg = {
    backgroundImage: 'radial-gradient(circle, hsl(var(--border) / 0.55) 1px, transparent 1px)',
    backgroundSize: '18px 18px',
  } as React.CSSProperties;

  // Root "Inicia el proyecto" node coordinates
  const startX = 0;
  const startY = PAD_Y + ((placed.length ? Math.max(...placed.filter((p) => p.col === 1).map((p) => p.y)) : PAD_Y) - PAD_Y) / 2 + NODE_H / 2;
  const startCenter = { x: startX + NODE_W / 2, y: Math.max(startY, PAD_Y + NODE_H / 2) };

  const totalWidth = Math.max(width, 900);
  const totalHeight = Math.max(height, 360);

  // Auto-fit canvas to its container so there are no scrollbars
  const fitRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const scaleRef = useRef(1);
  useEffect(() => { scaleRef.current = scale; }, [scale]);
  useEffect(() => {
    const el = fitRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const { width: w, height: h } = el.getBoundingClientRect();
      if (w === 0 || h === 0) return;
      const s = Math.min(w / totalWidth, h / totalHeight, 1);
      setScale(s);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [totalWidth, totalHeight]);

  // Free dragging — clamp inside canvas, divide by scale to undo CSS transform
  const handleDrag = (nodeId: string, dx: number, dy: number, startX: number, startY: number) => {
    const s = scaleRef.current || 1;
    const nx = Math.max(0, startX + dx / s);
    const ny = Math.max(0, startY + dy / s);
    updateStrategyNode(project.id, nodeId, { position: { x: nx, y: ny } });
  };

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

  // ── Loop metrics: computed from canal delivery metrics briefs ──────
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
      {/* ── Loop Diagram + Metrics ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {/* Loop phases diagram */}
        <div className="md:col-span-2 rounded-xl border border-border/60 bg-card/70 p-3 shadow-sm">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-2">
            <RefreshCw className="h-3 w-3" />
            Ciclo Loop
          </h3>
          <LoopDiagram />
        </div>

        {/* Metric cards */}
        <div className="md:col-span-3 grid grid-cols-2 gap-3">
          <LoopMetric label="Base total" value={loopMetrics.base.value} delta={loopMetrics.base.delta} icon={<Users className="h-3.5 w-3.5" />} />
          <LoopMetric label="Enviados" value={loopMetrics.enviados.value} delta={loopMetrics.enviados.delta} icon={<TrendingUp className="h-3.5 w-3.5" />} />
          <LoopMetric label="Apertura" value={loopMetrics.apertura.value} delta={loopMetrics.apertura.delta} icon={<Target className="h-3.5 w-3.5" />} />
          <LoopMetric label="Clics" value={loopMetrics.clics.value} delta={loopMetrics.clics.delta} icon={<DollarSign className="h-3.5 w-3.5" />} />
        </div>
      </div>

      {/* Stage palette */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-card/70 p-2.5 shadow-sm">
        <div className="flex items-center gap-1.5 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Workflow className="h-3.5 w-3.5" />
          Construir estrategia
        </div>
        <div className="h-5 w-px bg-border/60" />
        {STAGES.map((s) => {
          const Icon = s.icon;
          return (
            <Button
              key={s.type}
              size="sm"
              variant="outline"
              className="h-7 text-[11px] gap-1.5 hover:border-current"
              style={{ color: s.color }}
              onClick={() => handleAddStage(s)}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="text-foreground">{s.label}</span>
              <Plus className="h-3 w-3 opacity-60" />
            </Button>
          );
        })}
      </div>

      {nodes.length === 0 ? (
        <div className="border-2 border-dashed border-border rounded-xl p-12 text-center" style={dottedBg}>
          <Rocket className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium mb-1">Inicia tu estrategia de mercadeo</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Agrega etapas desde el panel superior. Cada etapa se conecta al inicio del proyecto y puedes
            ramificarlas en líneas independientes o secuenciales (por ejemplo: Copys → Diseño → Envíos).
          </p>
        </div>
      ) : (
        <div
          ref={fitRef}
          className="relative overflow-hidden rounded-2xl border border-border/60 bg-background/40"
          style={{ ...dottedBg, height: 'calc(100vh - 340px)', minHeight: 360 }}
        >
          <div
            className="absolute top-0 left-0 origin-top-left"
            style={{ width: totalWidth, height: totalHeight, transform: `scale(${scale})` }}
          >
            {/* SVG connectors layer */}
            <svg
              className="absolute inset-0 pointer-events-none"
              width={totalWidth}
              height={totalHeight}
            >
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(var(--muted-foreground))" />
                </marker>
              </defs>

              {/* root → orphan nodes (col 1, no deps) */}
              {placed.filter((n) => n.dependsOn.length === 0).map((n) => {
                const x1 = startCenter.x;
                const y1 = startCenter.y;
                const x2 = n.x;
                const y2 = n.y + NODE_H / 2;
                const stage = STAGE_BY_TYPE[n.stageType];
                return (
                  <path
                    key={`root-${n.id}`}
                    d={pathBetween(x1, y1, x2, y2)}
                    stroke={stage?.color ?? 'hsl(var(--border))'}
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    fill="none"
                    opacity={0.7}
                    markerEnd="url(#arrow)"
                  />
                );
              })}

              {/* dependency edges */}
              {placed.flatMap((n) =>
                n.dependsOn.map((parentId) => {
                  const p = placedById.get(parentId);
                  if (!p) return null;
                  const x1 = p.x + NODE_W;
                  const y1 = p.y + NODE_H / 2;
                  const x2 = n.x;
                  const y2 = n.y + NODE_H / 2;
                  const stage = STAGE_BY_TYPE[n.stageType];
                  return (
                    <path
                      key={`${parentId}-${n.id}`}
                      d={pathBetween(x1, y1, x2, y2)}
                      stroke={stage?.color ?? 'hsl(var(--muted-foreground))'}
                      strokeWidth={2.2}
                      fill="none"
                      opacity={0.85}
                      markerEnd="url(#arrow)"
                    />
                  );
                })
              )}
            </svg>

            {/* Project start node */}
            <div
              className="absolute rounded-xl shadow-glow text-factory-foreground bg-gradient-factory flex flex-col items-center justify-center text-center px-3"
              style={{
                left: startX,
                top: startCenter.y - NODE_H / 2,
                width: NODE_W,
                height: NODE_H,
              }}
            >
              <Rocket className="h-5 w-5 mb-1" />
              <p className="text-sm font-semibold leading-tight">Inicia el proyecto</p>
              <p className="text-[10px] opacity-80 truncate max-w-full">{project.name}</p>
            </div>

            {/* Strategy nodes */}
            {placed.map((n) => (
              <NodeCard
                key={n.id}
                node={n}
                project={project}
                taskCounts={tasksByNodeId.get(n.id)}
                onOpenTasks={() => setTasksNodeId(n.id)}
                onEdit={() => setEditingId(n.id)}
                onStatus={(s) => updateStrategyNode(project.id, n.id, { status: s })}
                onDelete={() => deleteStrategyNode(project.id, n.id)}
                onToggleDep={(parentId) => {
                  const next = n.dependsOn.includes(parentId)
                    ? n.dependsOn.filter((p) => p !== parentId)
                    : [...n.dependsOn, parentId];
                  updateStrategyNode(project.id, n.id, { dependsOn: next });
                }}
                onDrag={(dx, dy, sx, sy) => handleDrag(n.id, dx, dy, sx, sy)}
              />
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
            onAddTask={(t) => addTask(project.id, t)}
            onUpdateTask={(id, u) => updateTask(project.id, id, u)}
            onDeleteTask={(id) => deleteTask(project.id, id)}
          />
        );
      })()}
    </div>
  );
};

// ───────────────────────────────────────────────────────────────────────────

const NodeCard = ({
  node, project, onEdit, onStatus, onDelete, onToggleDep, onOpenTasks, taskCounts, onDrag,
}: {
  node: PositionedNode;
  project: FactoryProject;
  onEdit: () => void;
  onStatus: (s: StrategyNode['status']) => void;
  onDelete: () => void;
  onToggleDep: (parentId: string) => void;
  onOpenTasks: () => void;
  taskCounts?: { total: number; pending: number };
  onDrag: (dx: number, dy: number, startX: number, startY: number) => void;
}) => {

  const stage = STAGE_BY_TYPE[node.stageType];
  const Icon = stage?.icon ?? FileText;
  const statusMeta = STATUS_META[node.status];
  const otherNodes = (project.strategyNodes ?? []).filter((n) => n.id !== node.id);

  const draggedRef = useRef(false);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // ignore drags initiated from interactive controls inside the card
    if ((e.target as HTMLElement).closest('[data-no-drag]')) return;
    if (e.button !== 0) return;
    e.preventDefault();
    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const startX = node.x;
    const startY = node.y;
    draggedRef.current = false;

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startClientX;
      const dy = ev.clientY - startClientY;
      if (!draggedRef.current && Math.hypot(dx, dy) > 4) draggedRef.current = true;
      if (draggedRef.current) onDrag(dx, dy, startX, startY);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      // swallow the next click if we actually dragged
      if (draggedRef.current) {
        const stop = (ev: MouseEvent) => { ev.stopPropagation(); ev.preventDefault(); window.removeEventListener('click', stop, true); };
        window.addEventListener('click', stop, true);
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => { if (!draggedRef.current) onOpenTasks(); }}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenTasks(); } }}
      onPointerDown={handlePointerDown}
      className="absolute rounded-xl bg-card border shadow-sm hover:shadow-lg transition-shadow p-2.5 group cursor-grab active:cursor-grabbing focus:outline-none focus:ring-2 focus:ring-factory/40 select-none touch-none"
      style={{
        left: node.x,
        top: node.y,
        width: NODE_W,
        height: NODE_H,
        borderLeft: `4px solid ${stage?.color ?? 'hsl(var(--border))'}`,
      }}
    >

      {/* pending tasks badge */}
      {taskCounts && taskCounts.pending > 0 && (
        <span
          className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-factory text-factory-foreground text-[10px] font-bold flex items-center justify-center ring-2 ring-background shadow-sm"
          title={`${taskCounts.pending} tareas pendientes`}
        >
          {taskCounts.pending}
        </span>
      )}

      {/* Input/output ports */}
      <span
        className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full ring-2 ring-background"
        style={{ backgroundColor: stage?.color ?? 'hsl(var(--muted-foreground))' }}
      />
      <span
        className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full ring-2 ring-background opacity-70"
        style={{ backgroundColor: stage?.color ?? 'hsl(var(--muted-foreground))' }}
      />

      <div className="flex items-start justify-between gap-1.5 mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: stage?.color }} />
          <p className="text-[12px] font-semibold leading-tight truncate">{node.label}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              data-no-drag
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity shrink-0"
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>


          <DropdownMenuContent align="end" className="w-56">
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
            {otherNodes.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Link2 className="h-3 w-3" /> Depende de
                </DropdownMenuLabel>
                {otherNodes.map((other) => (
                  <DropdownMenuCheckboxItem
                    key={other.id}
                    checked={node.dependsOn.includes(other.id)}
                    onCheckedChange={() => onToggleDep(other.id)}
                  >
                    {other.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5 mr-2" /> Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center justify-between mt-1">
        <Badge variant="outline" className={`text-[9px] px-1.5 h-4 ${statusMeta.cls} border-0`}>
          {statusMeta.label}
        </Badge>
        {node.roleLabel && (
          <span className="text-[9px] text-muted-foreground truncate ml-1">{node.roleLabel}</span>
        )}
      </div>

      {node.memberName ? (
        <div className="flex items-center gap-1 mt-1">
          <div
            className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
            style={{ backgroundColor: stage?.color ?? 'hsl(var(--muted-foreground))' }}
          >
            {node.memberName.charAt(0).toUpperCase()}
          </div>
          <span className="text-[10px] text-foreground/80 truncate">{node.memberName}</span>
        </div>
      ) : (
        <p className="text-[10px] text-muted-foreground italic mt-1">Sin asignar</p>
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
  project, node, onClose, onAddTask, onUpdateTask, onDeleteTask,
}: {
  project: FactoryProject;
  node: StrategyNode;
  onClose: () => void;
  onAddTask: (t: Omit<ProjectTask, 'id' | 'createdAt'>) => void;
  onUpdateTask: (id: string, u: Partial<Omit<ProjectTask, 'id' | 'createdAt'>>) => void;
  onDeleteTask: (id: string) => void;
}) => {
  const stage = STAGE_BY_TYPE[node.stageType];
  const Icon = stage?.icon ?? FileText;
  const role = project.roleGroups.find((g) => g.roleId === node.roleId);
  const members = role?.members ?? [];

  const isBriefDriven = BRIEF_DRIVEN_STAGES.includes(node.stageType);

  const matches = node.roleLabel
    ? project.tasks.filter((t) => t.assignedRoleLabel === node.roleLabel)
    : [];
  const pending = matches.filter((t) => t.status !== 'completed');
  const done = matches.filter((t) => t.status === 'completed');

  const [title, setTitle] = useState('');
  const [memberId, setMemberId] = useState(node.memberId ?? '');

  const handleAdd = () => {
    const t = title.trim();
    if (!t || !node.roleLabel) return;
    const m = members.find((x) => x.id === memberId);
    onAddTask({
      title: t,
      description: '',
      assignedMemberId: m?.id ?? node.memberId ?? null,
      assignedMemberName: m?.name ?? node.memberName ?? null,
      assignedRoleLabel: node.roleLabel,
      status: 'pending',
      priority: null,
      dueDate: null,
    });
    setTitle('');
  };

  const briefPendingCount = isBriefDriven
    ? (node.stageType === 'envios'
        ? briefsForNode(project, node).filter((b) => b.tarea.startsWith('Configurar envío por'))
        : briefsForNode(project, node)
      ).filter((b) => getBriefStatus(b) !== 'completed').length
    : pending.length;

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className={isBriefDriven ? 'sm:max-w-2xl max-h-[85vh] overflow-y-auto' : 'sm:max-w-lg'}>
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

        {node.stageType === 'copys' || node.stageType === 'diseno' ? (
          <ContentBriefPanel project={project} node={node} />
        ) : node.stageType === 'aprobacion' ? (
          <ApprovalQueuePanel project={project} node={node} />
        ) : node.stageType === 'envios' ? (
          <DeliveryBriefPanel project={project} node={node} />
        ) : !node.roleLabel ? (
          <p className="text-xs text-muted-foreground py-4">
            Asigna un rol a esta etapa para poder crear tareas.
          </p>
        ) : (
          <div className="space-y-4 py-1">
            {/* Quick add */}
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Nueva tarea</Label>
              <div className="flex gap-1.5">
                <Input
                  placeholder="¿Qué hay que hacer?"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                  className="h-8 text-xs"
                />
                {members.length > 0 && (
                  <Select value={memberId} onValueChange={setMemberId}>
                    <SelectTrigger className="h-8 text-xs w-32">
                      <SelectValue placeholder="Asignar" />
                    </SelectTrigger>
                    <SelectContent>
                      {members.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Button size="sm" className="h-8" onClick={handleAdd} disabled={!title.trim()}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Pending list */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Pendientes ({pending.length})
              </p>
              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {pending.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic px-1 py-2">Sin tareas pendientes.</p>
                ) : pending.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    onComplete={() => onUpdateTask(t.id, { status: 'completed' })}
                    onDelete={() => onDeleteTask(t.id)}
                  />
                ))}
              </div>
            </div>

            {/* Done collapsible */}
            {done.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Completadas ({done.length})
                </p>
                <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1 opacity-70">
                  {done.map((t) => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      onReopen={() => onUpdateTask(t.id, { status: 'pending' })}
                      onDelete={() => onDeleteTask(t.id)}
                      done
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const TaskRow = ({
  task, onComplete, onReopen, onDelete, done,
}: {
  task: ProjectTask;
  onComplete?: () => void;
  onReopen?: () => void;
  onDelete: () => void;
  done?: boolean;
}) => (
  <div className="flex items-center gap-2 px-2 py-1.5 rounded-md border border-border/60 bg-card/60 hover:bg-muted/40 group">
    <button
      onClick={done ? onReopen : onComplete}
      className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 transition-colors ${
        done ? 'bg-state-done border-state-done' : 'border-muted-foreground/40 hover:border-state-done'
      }`}
      aria-label={done ? 'Reabrir' : 'Completar'}
    />
    <span className={`text-xs flex-1 truncate ${done ? 'line-through text-muted-foreground' : ''}`}>
      {task.title}
    </span>
    {task.assignedMemberName && (
      <span className="text-[10px] text-muted-foreground shrink-0">{task.assignedMemberName}</span>
    )}
    <button
      onClick={onDelete}
      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
      aria-label="Eliminar"
    >
      <Trash2 className="h-3 w-3" />
    </button>
  </div>
);



