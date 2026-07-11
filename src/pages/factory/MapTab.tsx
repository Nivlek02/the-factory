import { useEffect, useMemo, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import {
  FactoryProject,
  StrategyNode,
  StrategyStageType,
  EtapaTipo,
  useFactoryStore,
} from '@/store/factoryStore';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  MoreVertical, Trash2, Workflow, Rocket, Download,
  FileText, LayoutPanelTop, PenLine, Palette, Megaphone, Send,
  Target, TrendingUp, Users, DollarSign, RefreshCw,
  Briefcase, Store, Handshake, PhoneCall,
  MousePointerClick, Link2, ShieldCheck, Flag,
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
// Layout de árbol: "Inicia el proyecto" es la única entrada a la izquierda y de
// ahí salen las ramas raíz (cada nodo sin dependsOn válido) en filas paralelas.
// Cada rama se despliega horizontalmente hacia la derecha siguiendo sus
// dependencias (Copys → Diseño → Envíos). Un nodo con varios hijos se bifurca:
// ocupa tantas filas como hojas cuelguen de él (Copys → Diseño…/Call Center = 2
// filas) y se centra verticalmente entre ellas. Sin fases ni swimlanes: la
// columna = profundidad real en la cadena, la fila = hoja del subárbol.
// ───────────────────────────────────────────────────────────────────────────

/** Orden vertical de las ramas raíz. Coincide con lo pedido: Landing, Copys (bifurca), Pauta,
 *  BTL, KAM, Relacionamiento. Formulario (si existe) va junto a Landing arriba. */
const ROOT_ORDER: Partial<Record<StrategyStageType, number>> = {
  landing: 0, formulario: 1, copys: 2, pauta: 3, btl: 4, kam: 5, relacionamiento: 6, custom: 7,
};

interface NodePlacement {
  node: StrategyNode;
  col: number;       // profundidad (0 = raíz de la rama)
  rowStart: number;  // fila inicial (0-based, inclusiva)
  rowEnd: number;    // fila final (0-based, exclusiva)
}
interface TreeLayout {
  placements: NodePlacement[];
  edges: { fromId: string; toId: string }[];
  rootIds: string[];
  totalCols: number;
  totalRows: number;
  colOf: Map<string, number>;
  centerYOf: Map<string, number>;
}

function computeTreeLayout(nodes: StrategyNode[]): TreeLayout {
  const byId = new Map(nodes.map((n) => [n.id, n] as const));
  const childrenOf = new Map<string, StrategyNode[]>();
  nodes.forEach((n) => {
    n.dependsOn.forEach((pid) => {
      if (!byId.has(pid)) return;
      if (!childrenOf.has(pid)) childrenOf.set(pid, []);
      childrenOf.get(pid)!.push(n);
    });
  });

  const roots = nodes
    .filter((n) => n.dependsOn.length === 0 || !n.dependsOn.some((p) => byId.has(p)))
    .sort((a, b) => (ROOT_ORDER[a.stageType] ?? 99) - (ROOT_ORDER[b.stageType] ?? 99));

  const colOf = new Map<string, number>();
  const range = new Map<string, { start: number; end: number }>();
  const edges: { fromId: string; toId: string }[] = [];
  const visited = new Set<string>();
  let rowCursor = 0;
  let maxCol = 0;

  const assign = (node: StrategyNode, depth: number): { start: number; end: number } => {
    if (visited.has(node.id)) return range.get(node.id) ?? { start: rowCursor, end: rowCursor + 1 };
    visited.add(node.id);
    colOf.set(node.id, depth);
    maxCol = Math.max(maxCol, depth);
    const kids = (childrenOf.get(node.id) ?? []).filter((k) => !visited.has(k.id));
    kids.forEach((k) => edges.push({ fromId: node.id, toId: k.id }));
    if (kids.length === 0) {
      const start = rowCursor;
      rowCursor += 1;
      const r = { start, end: start + 1 };
      range.set(node.id, r);
      return r;
    }
    const kidRanges = kids.map((k) => assign(k, depth + 1));
    const r = {
      start: Math.min(...kidRanges.map((x) => x.start)),
      end: Math.max(...kidRanges.map((x) => x.end)),
    };
    range.set(node.id, r);
    return r;
  };
  roots.forEach((r) => assign(r, 0));
  // Nodos huérfanos (ciclo inesperado) — cada uno en su propia fila, por robustez.
  nodes.filter((n) => !visited.has(n.id)).forEach((n) => assign(n, 0));

  const centerYOf = new Map<string, number>();
  range.forEach((r, id) => centerYOf.set(id, (r.start + r.end) / 2));

  const placements: NodePlacement[] = nodes.map((n) => ({
    node: n,
    col: colOf.get(n.id) ?? 0,
    rowStart: range.get(n.id)!.start,
    rowEnd: range.get(n.id)!.end,
  }));

  return {
    placements, edges, rootIds: roots.map((r) => r.id),
    totalCols: maxCol + 1, totalRows: Math.max(1, rowCursor), colOf, centerYOf,
  };
}

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
  const layout = useMemo(() => computeTreeLayout(nodes), [nodes]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [tasksNodeId, setTasksNodeId] = useState<string | null>(null);

  const diagramRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportImage = async () => {
    if (!diagramRef.current) return;
    setIsExporting(true);
    try {
      const bg = getComputedStyle(document.body).backgroundColor || '#ffffff';
      const dataUrl = await toPng(diagramRef.current, { backgroundColor: bg, pixelRatio: 2, cacheBust: true });
      const link = document.createElement('a');
      const safeName = project.name.trim().replace(/[^\w\-]+/g, '_') || 'proyecto';
      link.download = `flujo-de-trabajo-${safeName}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Error exportando el diagrama de Flujo de trabajo:', err);
    } finally {
      setIsExporting(false);
    }
  };

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
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Workflow className="h-3.5 w-3.5" />
          Flujo de trabajo
        </div>
        {nodes.length > 0 && (
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleExportImage} disabled={isExporting}>
            <Download className="h-3.5 w-3.5" />
            {isExporting ? 'Exportando…' : 'Exportar imagen'}
          </Button>
        )}
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
      ) : (() => {
        const ROW_H = 116;
        const gridHeight = layout.totalRows * ROW_H;
        return (
          <div ref={diagramRef} className="flex items-stretch gap-0 w-full p-2" style={{ minHeight: gridHeight }}>
            {/* Nodo de inicio — única entrada, centrado verticalmente frente a todas las ramas */}
            <div className="shrink-0 flex items-center pr-1">
              <div className="w-24 sm:w-28 rounded-lg shadow-glow text-primary-foreground bg-primary flex flex-col items-center justify-center text-center px-2 py-2.5">
                <Rocket className="h-4 w-4 mb-1" />
                <p className="text-[11px] font-semibold leading-tight">Inicia el proyecto</p>
                <p className="text-[9px] opacity-80 truncate max-w-full">{project.name}</p>
              </div>
            </div>

            {/* Abanico de conexiones: del inicio a la primera tarjeta de cada rama */}
            <div className="relative shrink-0 self-stretch" style={{ width: 30 }}>
              <svg
                className="absolute inset-0 h-full w-full pointer-events-none"
                viewBox={`0 0 1 ${layout.totalRows}`}
                preserveAspectRatio="none"
              >
                {layout.rootIds.map((id) => {
                  const cy = layout.centerYOf.get(id)!;
                  return (
                    <path
                      key={id}
                      d={`M 0 ${layout.totalRows / 2} C 0.5 ${layout.totalRows / 2}, 0.5 ${cy}, 1 ${cy}`}
                      stroke="hsl(var(--border))"
                      strokeWidth="2"
                      fill="none"
                      vectorEffect="non-scaling-stroke"
                    />
                  );
                })}
              </svg>
            </div>

            {/* Área de ramas: cada nodo se coloca en su (columna = profundidad, fila = hoja);
               un SVG por detrás dibuja las dependencias, incluida la bifurcación de Copys
               (dos curvas saliendo del mismo nodo). Las ramas cortas ocupan solo su columna. */}
            <div className="relative flex-1 min-w-0" style={{ height: gridHeight }}>
              <svg
                className="absolute inset-0 h-full w-full pointer-events-none"
                viewBox={`0 0 ${layout.totalCols} ${layout.totalRows}`}
                preserveAspectRatio="none"
              >
                {layout.edges.map((e) => {
                  const pcx = layout.colOf.get(e.fromId)! + 0.5;
                  const pcy = layout.centerYOf.get(e.fromId)!;
                  const ccx = layout.colOf.get(e.toId)! + 0.5;
                  const ccy = layout.centerYOf.get(e.toId)!;
                  const mx = (pcx + ccx) / 2;
                  return (
                    <path
                      key={`${e.fromId}-${e.toId}`}
                      d={`M ${pcx} ${pcy} C ${mx} ${pcy}, ${mx} ${ccy}, ${ccx} ${ccy}`}
                      stroke="hsl(var(--border))"
                      strokeWidth="2"
                      fill="none"
                      vectorEffect="non-scaling-stroke"
                    />
                  );
                })}
              </svg>

              <div
                className="relative grid h-full"
                style={{
                  gridTemplateColumns: `repeat(${layout.totalCols}, minmax(0, 1fr))`,
                  gridTemplateRows: `repeat(${layout.totalRows}, 1fr)`,
                }}
              >
                {layout.placements.map((p) => (
                  <div
                    key={p.node.id}
                    className="flex items-center min-w-0 px-1.5"
                    style={{ gridColumn: p.col + 1, gridRow: `${p.rowStart + 1} / ${p.rowEnd + 1}` }}
                  >
                    <div className="w-full min-w-0">
                      <NodeCard
                        node={p.node}
                        taskCounts={tasksByNodeId.get(p.node.id)}
                        onOpenTasks={() => setTasksNodeId(p.node.id)}
                        onEdit={() => setEditingId(p.node.id)}
                        onStatus={(s) => updateStrategyNode(project.id, p.node.id, { status: s })}
                        onDelete={() => deleteStrategyNode(project.id, p.node.id)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

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

// ─── Ecosistema cíclico — visualización de solo lectura de las 6 etapas reales del proyecto ──

/** Ícono + color por tipo de etapa — mismo patrón que STAGE_BY_TYPE, y mismo mapeo que
 *  ETAPA_TIPO_META en CreateProjectWizard.tsx (duplicado a propósito: cada archivo de UI
 *  define su propia tabla de íconos, igual que ya hace este archivo con STAGE_BY_TYPE). */
const ETAPA_TIPO_META: Record<EtapaTipo, { icon: typeof FileText; color: string }> = {
  atraccion: { icon: Megaphone, color: 'hsl(var(--team-social))' },
  interaccion: { icon: MousePointerClick, color: 'hsl(var(--team-copy))' },
  captura: { icon: Link2, color: 'hsl(var(--team-seo))' },
  validacion: { icon: ShieldCheck, color: 'hsl(var(--team-production))' },
  desenlace: { icon: Flag, color: 'hsl(var(--team-direction))' },
  reactivacion: { icon: RefreshCw, color: 'hsl(var(--team-design))' },
};

/** Diagrama de solo lectura del ecosistema cíclico real del proyecto: las etapas (orden real,
 *  con sus toques/loops contados desde project.canales/project.loops), la flecha principal que
 *  encadena una etapa con la siguiente (incluida la que cierra el ciclo de la última a la
 *  primera — esa es la reactivación "de fábrica"), y flechas punteadas adicionales por cada
 *  loop cuyo `siguienteEtapaId` salta a una etapa distinta de la siguiente natural (ramas reales
 *  capturadas en los datos, ej. una reactivación que salta directo a Atracción). */
const EcosystemCycleDiagram = ({ project }: { project: FactoryProject }) => {
  const etapas = [...(project.etapas ?? [])].sort((a, b) => a.orden - b.orden);
  if (etapas.length === 0) return null;

  const N = etapas.length;
  const size = 460;
  const cx = size / 2;
  const cy = size / 2;
  const r = 165;
  const idIdx = new Map(etapas.map((e, i) => [e.id, i] as const));

  const posOf = (i: number) => {
    const angle = (i / N) * 360 - 90;
    const rad = (angle * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };
  const shrinkTowards = (a: { x: number; y: number }, b: { x: number; y: number }, amount: number) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    return { x: a.x + (dx / dist) * amount, y: a.y + (dy / dist) * amount };
  };

  const mainPaths = etapas.map((_, i) => {
    const j = (i + 1) % N;
    const a = shrinkTowards(posOf(i), posOf(j), 46);
    const b = shrinkTowards(posOf(j), posOf(i), 46);
    return { key: `main-${i}`, d: `M ${a.x} ${a.y} L ${b.x} ${b.y}` };
  });

  const seenBranch = new Set<string>();
  const branchPaths: { key: string; d: string; label: string; fromIdx: number; toIdx: number }[] = [];
  for (const loop of project.loops ?? []) {
    if (!loop.etapaId || !loop.siguienteEtapaId) continue;
    const i = idIdx.get(loop.etapaId);
    const j = idIdx.get(loop.siguienteEtapaId);
    if (i === undefined || j === undefined || i === j) continue;
    if (j === (i + 1) % N) continue; // ya cubierto por la flecha principal
    const key = `${i}-${j}`;
    if (seenBranch.has(key)) continue;
    seenBranch.add(key);
    const a = posOf(i);
    const b = posOf(j);
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const dx = mx - cx;
    const dy = my - cy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const bow = 46;
    const ctrl = { x: mx + (dx / dist) * bow, y: my + (dy / dist) * bow };
    const start = shrinkTowards(a, ctrl, 46);
    const end = shrinkTowards(b, ctrl, 46);
    branchPaths.push({
      key: `branch-${key}`,
      d: `M ${start.x} ${start.y} Q ${ctrl.x} ${ctrl.y} ${end.x} ${end.y}`,
      label: loop.disparador || loop.reaccion || 'Rama',
      fromIdx: i,
      toIdx: j,
    });
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card/70 p-4 shadow-sm">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-center gap-1.5 mb-4">
        <RefreshCw className="h-3 w-3" />
        Ecosistema cíclico del proyecto
      </h3>
      <div className="overflow-x-auto">
        <div className="relative mx-auto" style={{ width: size, height: size }}>
          <svg viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 w-full h-full pointer-events-none">
            <defs>
              <marker id="ecosystem-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                <path d="M0,0 L8,4 L0,8 Z" fill="hsl(var(--border))" />
              </marker>
              <marker id="ecosystem-arrow-branch" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                <path d="M0,0 L8,4 L0,8 Z" fill="hsl(var(--factory))" />
              </marker>
            </defs>
            {mainPaths.map((p) => (
              <path key={p.key} d={p.d} stroke="hsl(var(--border))" strokeWidth="2" fill="none" markerEnd="url(#ecosystem-arrow)" />
            ))}
            {branchPaths.map((p) => (
              <path
                key={p.key} d={p.d} stroke="hsl(var(--factory))" strokeWidth="1.75"
                strokeDasharray="4 3" fill="none" markerEnd="url(#ecosystem-arrow-branch)" opacity="0.75"
              />
            ))}
          </svg>

          {etapas.map((etapa, i) => {
            const meta = ETAPA_TIPO_META[etapa.tipo];
            const Icon = meta.icon;
            const pos = posOf(i);
            const toques = (project.canales ?? []).filter((c) => c.etapaId === etapa.id).length;
            const loopsCount = (project.loops ?? []).filter((l) => l.etapaId === etapa.id).length;
            return (
              <div
                key={etapa.id}
                className="absolute w-[128px] rounded-lg border border-border/60 bg-card p-2.5 shadow-sm text-center"
                style={{ left: pos.x, top: pos.y, transform: 'translate(-50%, -50%)' }}
              >
                <div
                  className="w-7 h-7 rounded-md flex items-center justify-center mx-auto mb-1.5"
                  style={{ backgroundColor: `${meta.color}1a`, color: meta.color }}
                >
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <p className="text-[11px] font-semibold leading-tight">{i + 1}. {etapa.nombre}</p>
                <p className="text-[9px] text-muted-foreground mt-1">{toques} toques · {loopsCount} loops</p>
              </div>
            );
          })}
        </div>
      </div>
      {branchPaths.length > 0 && (
        <div className="mt-4 space-y-1 max-w-md mx-auto">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-center mb-1">Ramas y reactivación</p>
          {branchPaths.map((p) => (
            <p key={p.key} className="text-[11px] text-muted-foreground text-center">
              {etapas[p.fromIdx]?.nombre} → {etapas[p.toIdx]?.nombre}: <span className="text-foreground/80">{p.label}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Loop — el ciclo de comportamiento del proyecto ─────────────────────────

export const LoopTab = ({ project }: Props) => {
  return (
    <div className="space-y-4">
      <EcosystemCycleDiagram project={project} />
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



