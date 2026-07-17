import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { useFactoryStore, type FabricaBriefItem, type EtapaCiclo, type EtapaTipo } from '@/store/factoryStore';
import { useRolesStore } from '@/store/rolesStore';
import RichTextEditor from '@/components/ui/rich-text-editor';
import {
  Cog, Plus, X, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, FolderKanban, Check, Target, GitBranch, Calendar, Clock,
  Mail, MessageCircle, Smartphone, Facebook, Instagram, Music, Search, Phone, Store, Briefcase, Handshake,
  Sparkles, Megaphone, MousePointerClick, Link2, ShieldCheck, Flag, RefreshCw,
  type LucideIcon,
} from 'lucide-react';

import { FactoryProject } from '@/store/factoryStore';
interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (projectId: string) => void;
  editProject?: FactoryProject;
}

const STEPS = [
  { key: 'data', label: 'Datos', icon: FolderKanban },
  { key: 'audience', label: 'Audiencia y Narrativa', icon: Target },
  { key: 'canales', label: 'Canales y Comportamiento', icon: GitBranch },
  { key: 'fabrica', label: 'Fábrica', icon: Cog },
] as const;

const SEGMENTOS_LABEL: Record<string, string> = {
  todos: 'Segmento General',
  afiliado: 'Afiliado',
  renovado: 'Renovados',
  matriculado: 'Matriculado',
  potencial: 'Potencial',
  no_renovado: 'No renovado',
  vip: 'VIP / Alta dirección',
  cluster_energia: 'Energía',
  cluster_espacios: 'Espacios Habitables',
  cluster_salud: 'Salud',
  cluster_turismo: 'Turismo de Eventos y Negocios',
  cluster_alimentos: 'Alimentos y Agroindustrias',
  mercado_medio: 'Mercado medio',
};

const REQUERIMIENTOS = [
  { id: 'landing', label: 'Landing' },
  { id: 'formulario', label: 'Formulario de inscripción' },
  // Opción excluyente: la campaña no necesita landing ni formulario. Permite avanzar sin
  // generar ninguna tarea de esos entregables.
  { id: 'ninguno', label: 'No requiere formulario/landing' },
] as const;

type ReqId = (typeof REQUERIMIENTOS)[number]['id'];

/** Maps each requerimiento to the roles + specific tareas that should appear when selected.
 *  If tareas array is empty for a role, ALL their tareas are included. */
const REQ_ROLE_TAREAS: Record<ReqId, Record<string, string[]>> = {
  // "Landing page" (Gestor de canales) se crea de forma explícita e incondicional más abajo
  // — este mapa ya no debe agregar una segunda tarea "Landing" duplicada vía canales.
  landing: {},
  formulario: {},
  ninguno: {},
};

/** Convierte YYYY-MM-DD a DD/MM para mostrar. Si no es fecha ISO, devuelve el texto original. */
const formatFecha = (dateStr: string) => {
  if (!dateStr) return '';
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return dateStr;
  return `${match[3]}/${match[2]}`;
};

const MESES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Muestra "15 de mar" desde YYYY-MM-DD */
const formatDisplay = (dateStr: string) => {
  if (!dateStr) return '';
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return dateStr;
  const m = parseInt(match[2], 10);
  return `${parseInt(match[3], 10)} de ${MESES_CORTO[m - 1]}`;
};

/** Canales disponibles en el Plan de canales, cada uno con su ícono. */
const CHANNELS: { id: string; icon: LucideIcon }[] = [
  { id: 'Correo', icon: Mail },
  { id: 'WhatsApp', icon: MessageCircle },
  { id: 'SMS', icon: Smartphone },
  { id: 'Facebook', icon: Facebook },
  { id: 'Instagram', icon: Instagram },
  { id: 'TikTok', icon: Music },
  { id: 'Google Ads', icon: Search },
  { id: 'Call Center', icon: Phone },
  { id: 'BTL', icon: Store },
  { id: 'KAM', icon: Briefcase },
  { id: 'Relacionamiento', icon: Handshake },
];

/** Las 6 etapas del ecosistema cíclico de convocatoria/conversión/reactivación — ver
 *  EtapaCiclo en factoryStore.ts. `initEtapas()` siembra estos defaults; nombre/objetivo
 *  quedan editables, tipo/orden inicial no. */
const ETAPA_DEFAULTS: { tipo: EtapaTipo; nombre: string; objetivo: string }[] = [
  { tipo: 'atraccion', nombre: 'Atracción multicanal', objetivo: 'Canales directos, redes orgánicas y pauta digital que traen al contacto al ecosistema.' },
  { tipo: 'interaccion', nombre: 'Interacción', objetivo: 'Abre/no abre · clic/no clic · comenta · visita la landing.' },
  { tipo: 'captura', nombre: 'Captura de interés', objetivo: 'Link por DM · formulario de inscripción · datos de contacto.' },
  { tipo: 'validacion', nombre: 'Validación', objetivo: 'Cruce contra CRM/fuente externa (ej: renovado / no renovado / no inscrito).' },
  { tipo: 'desenlace', nombre: 'Desenlace', objetivo: 'Rama por resultado (ej: confirmación · CTA de renovación · ruta de formalización).' },
  { tipo: 'reactivacion', nombre: 'Reactivación y remarketing', objetivo: 'Audiencias por comportamiento (no abrió · abrió sin clic · clic sin conversión · comentó sin convertir) — reinicia el ciclo con una nueva ola de segmentación.' },
];

/** Ícono + color por tipo de etapa, para el acordeón del wizard (mismo patrón que
 *  STAGE_BY_TYPE en MapTab.tsx). */
const ETAPA_TIPO_META: Record<EtapaTipo, { icon: LucideIcon; color: string }> = {
  atraccion: { icon: Megaphone, color: 'hsl(var(--team-social))' },
  interaccion: { icon: MousePointerClick, color: 'hsl(var(--team-copy))' },
  captura: { icon: Link2, color: 'hsl(var(--team-seo))' },
  validacion: { icon: ShieldCheck, color: 'hsl(var(--team-production))' },
  desenlace: { icon: Flag, color: 'hsl(var(--team-direction))' },
  reactivacion: { icon: RefreshCw, color: 'hsl(var(--team-design))' },
};

type WizardCanalRow = { id: string; canal: string; dia: string; hora: string; copy: string; segmento: string; etapaId?: string };
type WizardLoopRow = { id: string; disparador: string; reaccion: string; responsable: string; etapaId?: string; siguienteEtapaId?: string };

/** Una fila del Plan de canales — reutilizada dentro de cada etapa y en "Sin etapa asignada"
 *  (donde además se muestra el selector de etapa) para no triplicar este markup. */
const ToqueRow = ({
  row, onUpdate, onRemove, segmentos, etapas, showEtapaPicker,
}: {
  row: WizardCanalRow;
  onUpdate: (field: string, value: string) => void;
  onRemove: () => void;
  segmentos: string[];
  etapas: EtapaCiclo[];
  showEtapaPicker?: boolean;
}) => (
  <div
    className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card p-3 md:grid md:items-center md:gap-2 md:p-2"
    style={{
      // Ángulo del toque es texto libre sin truncado (a diferencia de Segmento/Etapa, que ya
      // truncan con "…" + tooltip) — se le da el piso más generoso de todos los campos.
      gridTemplateColumns: showEtapaPicker
        ? '95px 75px 58px minmax(150px, 1fr) minmax(60px, 90px) minmax(60px, 90px) 20px'
        : '95px 75px 58px minmax(150px, 1fr) minmax(60px, 90px) 20px',
    }}
  >
    <Select value={row.canal} onValueChange={(v) => onUpdate('canal', v)}>
      <SelectTrigger className="h-8 w-full gap-1.5 border-none bg-transparent px-1 text-xs font-medium shadow-none focus:ring-0 focus:ring-offset-0 md:h-auto">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {CHANNELS.map(({ id, icon: Icon }) => (
          <SelectItem key={id} value={id} className="text-xs">
            <span className="flex items-center gap-2">
              <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              {id}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>

    <div className="flex items-center gap-3 md:contents">
      <div
        className="relative flex flex-1 items-center gap-1.5 cursor-pointer md:flex-none"
        onClick={(e) => {
          const input = e.currentTarget.querySelector('input[type="date"]') as HTMLInputElement;
          input?.showPicker();
        }}
      >
        <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-xs text-foreground truncate">
          {row.dia ? formatDisplay(row.dia) : <span className="text-muted-foreground/60">Fecha</span>}
        </span>
        <input
          type="date"
          value={row.dia}
          onChange={(e) => onUpdate('dia', e.target.value)}
          className="w-0 h-0 opacity-0 absolute -z-10"
        />
      </div>
      <div
        className="relative flex flex-1 items-center gap-1.5 cursor-pointer md:flex-none"
        onClick={(e) => {
          const input = e.currentTarget.querySelector('input[type="time"]') as HTMLInputElement;
          input?.showPicker();
        }}
      >
        <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-xs text-foreground truncate">
          {row.hora || <span className="text-muted-foreground/60">Hora</span>}
        </span>
        <input
          type="time"
          value={row.hora ?? ''}
          onChange={(e) => onUpdate('hora', e.target.value)}
          className="w-0 h-0 opacity-0 absolute -z-10"
        />
      </div>
    </div>

    <input
      placeholder="Ángulo del toque…"
      value={row.copy}
      onChange={(e) => onUpdate('copy', e.target.value)}
      className="text-xs bg-transparent border-none outline-none w-full"
    />
    <div className="min-w-0 overflow-hidden" title={SEGMENTOS_LABEL[row.segmento] ?? 'Segmento General'}>
      <select
        value={row.segmento || 'todos'}
        onChange={(e) => onUpdate('segmento', e.target.value)}
        className="text-xs bg-transparent border-none outline-none w-full max-w-full cursor-pointer truncate"
        style={{ textOverflow: 'ellipsis' }}
      >
        <option value="todos">Segmento General</option>
        {segmentos.map((segId) => (
          <option key={segId} value={segId}>
            {SEGMENTOS_LABEL[segId] ?? segId}
          </option>
        ))}
      </select>
    </div>
    {showEtapaPicker && (
      <div className="min-w-0 overflow-hidden">
        <select
          value={row.etapaId ?? ''}
          onChange={(e) => onUpdate('etapaId', e.target.value)}
          className="text-xs bg-transparent border-none outline-none w-full max-w-full cursor-pointer truncate"
        >
          <option value="">Asignar a etapa…</option>
          {[...etapas].sort((a, b) => a.orden - b.orden).map((e) => (
            <option key={e.id} value={e.id}>{e.nombre}</option>
          ))}
        </select>
      </div>
    )}
    <button
      onClick={onRemove}
      className="self-end text-muted-foreground hover:text-destructive transition-colors md:self-auto"
    >
      <X className="h-3.5 w-3.5" />
    </button>
  </div>
);

/** Una fila de Loops de comportamiento — reutilizada dentro de cada etapa y en "Sin etapa
 *  asignada". `onUpdate('siguienteEtapaId', etapaId)` es el selector "Lleva a →" que cierra o
 *  ramifica el ciclo (ej. una reactivación que reinicia en Atracción). */
const LoopRowItem = ({
  row, onUpdate, onRemove, canalesRows, roles, etapas, showEtapaPicker,
}: {
  row: WizardLoopRow;
  onUpdate: (field: string, value: string) => void;
  onRemove: () => void;
  canalesRows: WizardCanalRow[];
  roles: { id: string; label: string }[];
  etapas: EtapaCiclo[];
  showEtapaPicker?: boolean;
}) => {
  // El disparador debe salir de una acción real del Plan de canales: basta con que la fila
  // tenga acción (canal) y fecha definidas — el ángulo del toque ya no es requisito. Así el
  // loop queda atado a un toque existente apenas se programa, en vez de a texto libre.
  const canalTriggers = canalesRows
    .filter((c) => c.canal.trim() && c.dia.trim())
    .map((c) => {
      const fecha = formatDisplay(c.dia) || c.dia;
      const detalle = c.copy.trim() ? ` · ${c.copy.trim()}` : '';
      return {
        label: `${c.canal} · ${fecha}${detalle}`,
        value: `Salida de ${c.canal} (${fecha})${c.copy.trim() ? `: ${c.copy.trim()}` : ''}`,
      };
    });
  const allPresetValues = ['', ...canalTriggers.map((t) => t.value)];
  const isCustomInput = row.disparador === '__custom__' || (row.disparador !== '' && !allPresetValues.includes(row.disparador));

  return (
    <tr className="border-b border-border/60">
      <td className="p-1.5">
        {canalTriggers.length > 0 && !isCustomInput ? (
          <select
            value={row.disparador}
            onChange={(e) => onUpdate('disparador', e.target.value)}
            className="w-full bg-transparent border-none outline-none text-xs py-1 cursor-pointer"
          >
            <option value="">Seleccionar disparador…</option>
            <optgroup label="Acciones del Plan de canales">
              {canalTriggers.map((t, i) => (
                <option key={i} value={t.value}>{t.label}</option>
              ))}
            </optgroup>
            <option value="__custom__">✏️ Escribir personalizado…</option>
          </select>
        ) : (
          <input
            placeholder="Escribe el disparador personalizado…"
            value={isCustomInput && row.disparador === '__custom__' ? '' : row.disparador}
            onChange={(e) => onUpdate('disparador', e.target.value)}
            className="w-full bg-transparent border-none outline-none text-xs py-1"
          />
        )}
      </td>
      <td className="p-1.5">
        <input
          placeholder="Reacción diseñada…"
          value={row.reaccion}
          onChange={(e) => onUpdate('reaccion', e.target.value)}
          className="w-full bg-transparent border-none outline-none text-xs py-1"
        />
      </td>
      <td className="p-1.5">
        <select
          value={row.responsable}
          onChange={(e) => onUpdate('responsable', e.target.value)}
          className="w-full bg-transparent border-none outline-none text-xs py-1 cursor-pointer"
        >
          <option value="">Responsable</option>
          {roles.map((r) => (
            <option key={r.id} value={r.label}>{r.label}</option>
          ))}
        </select>
      </td>
      <td className="p-1.5">
        <select
          value={row.siguienteEtapaId ?? ''}
          onChange={(e) => onUpdate('siguienteEtapaId', e.target.value)}
          className="w-full bg-transparent border-none outline-none text-xs py-1 cursor-pointer"
          title="Lleva a → cierra o ramifica el ciclo hacia otra etapa (ej. reactivación)"
        >
          <option value="">— Cierra aquí —</option>
          {[...etapas].sort((a, b) => a.orden - b.orden).map((e) => (
            <option key={e.id} value={e.id}>Lleva a: {e.nombre}</option>
          ))}
        </select>
      </td>
      {showEtapaPicker && (
        <td className="p-1.5">
          <select
            value={row.etapaId ?? ''}
            onChange={(e) => onUpdate('etapaId', e.target.value)}
            className="w-full bg-transparent border-none outline-none text-xs py-1 cursor-pointer"
          >
            <option value="">Asignar a etapa…</option>
            {[...etapas].sort((a, b) => a.orden - b.orden).map((e) => (
              <option key={e.id} value={e.id}>{e.nombre}</option>
            ))}
          </select>
        </td>
      )}
      <td className="p-1.5">
        <button onClick={onRemove} className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
          <X className="h-3 w-3" />
        </button>
      </td>
    </tr>
  );
};

const CreateProjectWizard = ({ open, onOpenChange, onCreated, editProject }: Props) => {
  const { addProject, updateProject, projects: allProjects } = useFactoryStore();
  const { roles } = useRolesStore();
  const isEditing = !!editProject;

  const [step, setStep] = useState(0);
  const today = () => new Date().toISOString().split('T')[0];
  const [data, setData] = useState({
    name: editProject?.name ?? '',
    description: editProject?.description ?? '',
    client: editProject?.client ?? '',
    state: (editProject?.state ?? 'planning') as const,
    priority: (editProject?.priority ?? 'P1') as 'P0'|'P1'|'P2',
    startDate: editProject?.startDate ?? today(),
    dueDate: editProject?.dueDate ?? '',
    strategistName: editProject?.strategistName ?? '',
    segmentLink: (editProject as any)?.segmentLink ?? '',
    eventCategory: (editProject as any)?.eventCategory ?? '',
    promocionarEn: (editProject as any)?.promocionarEn ?? [] as string[],
  });

  const [audiencia, setAudiencia] = useState({
    segmentos: editProject?.audienciaNarrativa?.segmentos ?? [] as string[],
    metaInscripciones: editProject?.audienciaNarrativa?.metaInscripciones ?? '',
    dolor: editProject?.audienciaNarrativa?.dolor ?? '',
    promesa: editProject?.audienciaNarrativa?.promesa ?? '',
    bigIdea: editProject?.audienciaNarrativa?.bigIdea ?? '',
  });

  const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  // ─── Categorías de evento ───
  const EVENT_CATEGORIES = [
    'Aplicar inteligencia artificial',
    'Promover la sostenibilidad',
    'Recibir financiamiento',
    'Ser más productivo y eficiente',
    'Vender en el exterior',
    'Vender más',
  ] as const;

  // ─── Proyectos existentes para "Promocionar en" ───
  const matchingProjects = useMemo(() => {
    if (!data.eventCategory) return [];
    const cat = data.eventCategory.toLowerCase().trim();
    const start = data.startDate ? new Date(data.startDate) : null;
    const end = data.dueDate ? new Date(data.dueDate) : null;

    return allProjects.filter((p) => {
      // Skip self when editing
      if (editProject && p.id === editProject.id) return false;
      // Must have same category
      if (!p.eventCategory || p.eventCategory.toLowerCase().trim() !== cat) return false;
      // Must have at least one date to compare
      const pStart = p.startDate ? new Date(p.startDate) : null;
      const pEnd = p.dueDate ? new Date(p.dueDate) : null;
      if (!pStart && !pEnd) return false;
      if (!start && !end) return false;

      const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
      // Check if any of the 4 date pairs are within 7 days
      const dates = [start, end].filter(Boolean) as Date[];
      const pDates = [pStart, pEnd].filter(Boolean) as Date[];
      for (const d of dates) {
        for (const pd of pDates) {
          if (Math.abs(d.getTime() - pd.getTime()) <= SEVEN_DAYS) return true;
        }
      }
      return false;
    });
  }, [data.eventCategory, data.startDate, data.dueDate, allProjects, editProject]);
  const [canalesRows, setCanalesRows] = useState<WizardCanalRow[]>(
    editProject?.canales?.map((c) => ({ hora: '', ...c })) ?? []
  );
  const [loopsRows, setLoopsRows] = useState<WizardLoopRow[]>(
    editProject?.loops?.map((l) => ({ ...l })) ?? []
  );
  const [etapas, setEtapas] = useState<EtapaCiclo[]>(editProject?.etapas ?? []);
  const [mensajeBase, setMensajeBase] = useState({
    emocion: editProject?.mensajeBase?.emocion ?? '',
    logica: editProject?.mensajeBase?.logica ?? '',
    motivacion: editProject?.mensajeBase?.motivacion ?? '',
    recompensa: editProject?.mensajeBase?.recompensa ?? '',
  });
  const [motor, setMotor] = useState({
    fuenteValidacion: editProject?.motor?.fuenteValidacion ?? '',
  });
  const [requerimientos, setRequerimientos] = useState<string[]>(
    editProject?.requerimientos ?? []
  );
  const [formularioConfig, setFormularioConfig] = useState({
    basico: editProject?.formularioConfig?.basico ?? null as boolean | null,
    camposAdicionales: editProject?.formularioConfig?.camposAdicionales ?? '',
    cuadroTexto: editProject?.formularioConfig?.cuadroTexto ?? '',
  });
  const [attachments, setAttachments] = useState<{ name: string; type: string; data: string }[]>(
    editProject?.attachments ?? []
  );
  const [fabricaBriefs, setFabricaBriefs] = useState<FabricaBriefItem[]>(
    editProject?.fabricaBriefs?.map((b) => ({ ...b })) ?? []
  );

  // ─── Draft auto-save to localStorage ───
  const DRAFT_KEY = 'factory-project-draft';
  const hasDraft = !isEditing && typeof window !== 'undefined' && localStorage.getItem(DRAFT_KEY) !== null;

  // Restore draft from localStorage when opening without editProject
  useEffect(() => {
    if (open && !isEditing) {
      try {
        const saved = localStorage.getItem(DRAFT_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.data) setData(parsed.data);
          if (parsed.audiencia) setAudiencia(parsed.audiencia);
          if (parsed.canalesRows) setCanalesRows(parsed.canalesRows);
          if (parsed.loopsRows) setLoopsRows(parsed.loopsRows);
          if (parsed.etapas) setEtapas(parsed.etapas);
          if (parsed.mensajeBase) setMensajeBase(parsed.mensajeBase);
          if (parsed.motor) setMotor(parsed.motor);
          if (parsed.requerimientos) setRequerimientos(parsed.requerimientos);
          if (parsed.formularioConfig) setFormularioConfig(parsed.formularioConfig);
          if (parsed.attachments) setAttachments(parsed.attachments);
          if (parsed.step !== undefined) setStep(parsed.step);
        }
      } catch { /* ignore invalid draft */ }
    }
  }, [open]);

  // Auto-save to localStorage on changes (debounced)
  useEffect(() => {
    if (!open || isEditing) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({
          data,
          audiencia,
          canalesRows,
          loopsRows,
          etapas,
          mensajeBase,
          motor,
          requerimientos,
          formularioConfig,
          attachments,
          step,
        }));
      } catch { /* QuotaExceededError — draft not persisted, data stays in state */ }
    }, 2000);
    return () => clearTimeout(timer);
  }, [open, isEditing, data, audiencia, canalesRows, loopsRows, etapas, mensajeBase, motor, requerimientos, formularioConfig, attachments, step]);

  const clearDraft = () => {
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
  };

  // Reset when opening without editProject
  const reset = () => {
    setStep(0);
    setData({ name: '', description: '', client: '', state: 'planning', priority: 'P1', startDate: today(), dueDate: '', strategistName: '', segmentLink: '', eventCategory: '', promocionarEn: [] });
    setAudiencia({ segmentos: [], metaInscripciones: '', dolor: '', promesa: '', bigIdea: '' });
    setCanalesRows([]);
    setLoopsRows([]);
    setEtapas([]);
    setMensajeBase({ emocion: '', logica: '', motivacion: '', recompensa: '' });
    setMotor({ fuenteValidacion: '' });
    setRequerimientos([]);
    setFormularioConfig({ basico: null, camposAdicionales: '', cuadroTexto: '' });
    setAttachments([]);
    setFabricaBriefs([]);
  };

  // ─── Etapas del ciclo ───
  const initEtapas = () => {
    setEtapas(ETAPA_DEFAULTS.map((d, i) => ({ id: uid(), tipo: d.tipo, nombre: d.nombre, orden: i, objetivo: d.objetivo })));
  };
  const updateEtapa = (id: string, field: 'nombre' | 'objetivo', value: string) =>
    setEtapas((prev) => prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)));
  const moveEtapa = (id: string, dir: -1 | 1) => {
    setEtapas((prev) => {
      const sorted = [...prev].sort((a, b) => a.orden - b.orden);
      const idx = sorted.findIndex((e) => e.id === id);
      const swapIdx = idx + dir;
      if (idx === -1 || swapIdx < 0 || swapIdx >= sorted.length) return prev;
      const a = sorted[idx];
      const b = sorted[swapIdx];
      return prev.map((e) => {
        if (e.id === a.id) return { ...e, orden: b.orden };
        if (e.id === b.id) return { ...e, orden: a.orden };
        return e;
      });
    });
  };

  const addCanalRow = (etapaId?: string) => {
    setCanalesRows((prev) => [...prev, { id: uid(), canal: 'Correo', dia: '', hora: '', copy: '', segmento: 'todos', etapaId }]);
  };
  const removeCanalRow = (id: string) => setCanalesRows((prev) => prev.filter((r) => r.id !== id));
  const updateCanalRow = (id: string, field: string, value: string) =>
    setCanalesRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  const addLoopRow = (etapaId?: string) => {
    setLoopsRows((prev) => [...prev, { id: uid(), disparador: '', reaccion: '', responsable: '', etapaId }]);
  };
  const removeLoopRow = (id: string) => setLoopsRows((prev) => prev.filter((r) => r.id !== id));
  const updateLoopRow = (id: string, field: string, value: string) =>
    setLoopsRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));

  // ─── Helpers for requerimiento filtering ───
  /** Returns the subset of tareas for a role that match the selected requerimientos.
   *  If no requerimientos are selected, returns all tareas (full brief). */
  const filterTareasByRequerimientos = (roleId: string, roleTareas: string[], reqs: string[]): string[] => {
    if (reqs.length === 0) return roleTareas;
    const matched = new Set<string>();
    for (const reqId of reqs) {
      const reqRoles = REQ_ROLE_TAREAS[reqId as ReqId];
      if (!reqRoles) continue;
      const reqTareas = reqRoles[roleId];
      if (!reqTareas) continue;
      if (reqTareas.length === 0) {
        // Empty array means ALL tareas for this role when this req is selected
        return roleTareas;
      }
      for (const t of reqTareas) matched.add(t);
    }
    return roleTareas.filter((t) => matched.has(t));
  };

  // ─── Auto-populate Fábrica briefs from canales + loops ───
  const buildFabricaBriefs = (canales: typeof canalesRows, loops: typeof loopsRows, reqs: string[], fConfig: typeof formularioConfig): FabricaBriefItem[] => {
    const items: FabricaBriefItem[] = [];

    // Fecha del toque que se está procesando. Toda tarea creada dentro del bucle de canales
    // la hereda (también las que nacen vía addRoleTareasFiltered), para no repetirla en los
    // ~10 addItem del switch. Fuera del bucle vale null y no se estampa nada.
    let fechaCanalActual: string | null = null;

    const addItem = (roleId: string, roleLabel: string, tarea: string, extra?: Partial<FabricaBriefItem>) => {
      items.push({
        id: uid(),
        roleId,
        roleLabel,
        tarea,
        checked: false,
        ...(fechaCanalActual ? { fechaAccion: fechaCanalActual } : {}),
        ...extra,
      });
    };
    const addRoleTareasFiltered = (roleId: string, roleLabel: string, roleTareas: string[]) => {
      const filtered = filterTareasByRequerimientos(roleId, roleTareas, reqs);
      for (const t of filtered) addItem(roleId, roleLabel, t);
    };

    // ─── Tareas configuradas desde Ajustes ───
    //   Diseño siempre participa
    for (const role of roles) {
      if (role.tareas.length === 0) continue;
      if (role.id === 'diseno') {
        addRoleTareasFiltered(role.id, role.label, role.tareas);
      }
    }

    // ─── Responsabilidad por canal ───
    for (const row of canales) {
      fechaCanalActual = row.dia || null;
      const fecha = row.dia ? formatFecha(row.dia) : '';
      const segmento = row.segmento ? SEGMENTOS_LABEL[row.segmento] ?? row.segmento : '';
      const ref = [fecha, segmento].filter(Boolean).join(' — ');

      switch (row.canal) {
        case 'Correo':
        case 'WhatsApp':
        case 'SMS': {
          const gestor = roles.find((r) => r.id === 'gestor_canales');
          if (gestor) {
            addRoleTareasFiltered(gestor.id, gestor.label, gestor.tareas);
          }
          addItem('gestor_canales', 'Gestor de canales',
            `Configurar envío por ${row.canal}${ref ? ` — ${ref}` : ''}`);
          addItem('copy', 'Copywriter',
            `Redactar copy para ${row.canal}${row.copy ? ` — ${row.copy}` : ''}`);
          const copyRole = roles.find((r) => r.id === 'copy');
          if (copyRole) {
            addRoleTareasFiltered(copyRole.id, copyRole.label, copyRole.tareas);
          }
          break;
        }
        case 'Facebook':
        case 'Instagram':
        case 'TikTok':
        case 'Google Ads': {
          addItem('trafficker', 'Trafficker',
            `Configurar campaña en ${row.canal}${row.copy ? ` — ${row.copy}` : ''}`);
          const traffickerRole = roles.find((r) => r.id === 'trafficker');
          if (traffickerRole) {
            addRoleTareasFiltered(traffickerRole.id, traffickerRole.label, traffickerRole.tareas);
          }
          break;
        }
        case 'Call Center': {
          // La tarea de registro de Estratega ("¿se hizo? sí/no + fecha") se activa sola al
          // aprobar el guion — ver activateNextStage en StrategyBriefPanels — no se siembra aquí.
          addItem('copy', 'Copywriter',
            `Redactar guion para Call Center${row.copy ? ` — ${row.copy}` : ''}`);
          const copyRole = roles.find((r) => r.id === 'copy');
          if (copyRole) {
            addRoleTareasFiltered(copyRole.id, copyRole.label, copyRole.tareas);
          }
          break;
        }
        case 'BTL': {
          addItem('estratega', 'Estratega',
            `Coordinar activación BTL${ref ? ` — ${ref}` : ''}`);
          addItem('diseno', 'Diseñador',
            `Diseñar piezas BTL${row.copy ? ` — ${row.copy}` : ''}`);
          break;
        }
        case 'KAM': {
          addItem('estratega', 'Estratega',
            `Gestionar cuentas clave (KAM)${ref ? ` — ${ref}` : ''}`);
          break;
        }
        case 'Relacionamiento': {
          addItem('estratega', 'Estratega',
            `Plan de relacionamiento${ref ? ` — ${ref}` : ''}`);
          break;
        }
      }
    }
    // A partir de acá las tareas ya no salen de un toque: no deben heredar su fecha.
    fechaCanalActual = null;

    // ─── Loops → tareas por responsable ───
    for (const row of loops) {
      if (!row.responsable) continue;
      const role = roles.find((r) => r.label === row.responsable);
      addItem(
        role?.id ?? row.responsable.toLowerCase().replace(/\s+/g, '_'),
        row.responsable,
        `Loop: ${row.disparador || '(sin disparador)'} → ${row.reaccion || '(sin reacción)'}`
      );
    }

    // ─── Tareas de roles involucrados que aún no estén en la lista ───
    const roleIdsInBrief = new Set(items.map((i) => i.roleId));
    for (const role of roles) {
      if (roleIdsInBrief.has(role.id)) continue;
      if (role.tareas.length === 0) continue;
      // Solo incluimos roles que participan via canales/loops
      const involvedInCanal = canales.some(
        (c) => canalInvolvesRole(c.canal, role.id)
      );
      const involvedInLoop = loops.some((l) => l.responsable === role.label);
      if (involvedInCanal || involvedInLoop) {
        addRoleTareasFiltered(role.id, role.label, role.tareas);
      }
    }

    // ─── Tarea de landing page — responsabilidad del Gestor de canales ───
    if (reqs.includes('landing')) {
      addItem('gestor_canales', 'Gestor de canales', 'Landing page');
    }

    // ─── Tarea de formulario de inscripción ───
    if (reqs.includes('formulario') && fConfig.basico !== null) {
      if (fConfig.basico === true) {
        addItem('gestor_canales', 'Gestor de canales', 'Formulario de inscripción básico');
      } else {
        addItem('gestor_canales', 'Gestor de canales', 'Formulario de inscripción con campos adicionales', {
          briefNotes: fConfig.camposAdicionales || undefined,
        });
      }
    }

    return items;
  };

  const canalInvolvesRole = (canal: string, roleId: string): boolean => {
    const map: Record<string, string[]> = {
      Correo:      ['gestor_canales', 'copy'],
      WhatsApp:    ['gestor_canales', 'copy'],
      SMS:         ['gestor_canales', 'copy'],
      Facebook:    ['trafficker'],
      Instagram:   ['trafficker'],
      TikTok:      ['trafficker'],
      'Google Ads': ['trafficker'],
      'Call Center': ['copy'],
      BTL:         ['estratega', 'diseno'],
      KAM:         ['estratega'],
      Relacionamiento: ['estratega'],
    };
    return map[canal]?.includes(roleId) ?? false;
  };

  // "Responsable" de un loop debe salir de los roles que el Plan de canales ya involucra (según
  // los canales elegidos), no del catálogo completo de roles. Si todavía no hay canales que
  // impliquen ningún rol, se muestran todos como fallback para no bloquear el selector.
  const involvedRoleIds = new Set(
    canalesRows.flatMap((c) => roles.filter((r) => canalInvolvesRole(c.canal, r.id)).map((r) => r.id))
  );
  const involvedRoles = involvedRoleIds.size > 0 ? roles.filter((r) => involvedRoleIds.has(r.id)) : roles;

  // Rebuild when canales, loops, requerimientos or formularioConfig change
  useEffect(() => {
    const hasFormulario = requerimientos.includes('formulario') && formularioConfig.basico !== null;
    const hasLanding = requerimientos.includes('landing');
    const hasContent = canalesRows.length > 0 || loopsRows.some((l) => l.responsable) || hasFormulario || hasLanding;
    if (hasContent) {
      setFabricaBriefs(buildFabricaBriefs(canalesRows, loopsRows, requerimientos, formularioConfig));
    } else {
      setFabricaBriefs([]);
    }
  }, [canalesRows, loopsRows, requerimientos, formularioConfig]);

  const toggleFabricaBrief = (id: string) =>
    setFabricaBriefs((prev) => prev.map((b) => (b.id === id ? { ...b, checked: !b.checked } : b)));

  const updateFabricaLoop = (id: string, field: string, value: string) =>
    setFabricaBriefs((prev) => prev.map((b) => (b.id === id ? { ...b, [field]: value } : b)));

  const close = () => {
    clearDraft();
    onOpenChange(false);
    if (!isEditing) setTimeout(reset, 300);
  };

  const hasLandingOrFormulario = requerimientos.includes('landing') || requerimientos.includes('formulario');
  // El paso de Requerimiento queda satisfecho con Landing/Formulario o con "No requiere
  // formulario/landing" (deja pasar sin generar tareas de esos entregables).
  const reqSatisfied = hasLandingOrFormulario || requerimientos.includes('ninguno');

  const canNext = step === 0
    ? data.name.trim().length > 0
    : step === 2
    ? reqSatisfied && (!requerimientos.includes('formulario') || formularioConfig.basico !== null)
    : true;
  const isLast = step === STEPS.length - 1;

  const handleCreate = () => {
    if (isEditing && editProject) {
      updateProject(editProject.id, {
        name: data.name.trim(),
        description: data.description.trim(),
        client: data.client.trim(),
        state: data.state,
        priority: data.priority,
        startDate: data.startDate || null,
        dueDate: data.dueDate || null,
        audienciaNarrativa: {
          segmentos: audiencia.segmentos,
          metaInscripciones: audiencia.metaInscripciones.trim(),
          dolor: audiencia.dolor.trim(),
          promesa: audiencia.promesa.trim(),
          bigIdea: audiencia.bigIdea.trim(),
        },
        canales: canalesRows,
        loops: loopsRows,
        etapas,
        mensajeBase,
        motor,
        fabricaBriefs: fabricaBriefs,
        requerimientos,
        segmentLink: data.segmentLink.trim(),
        eventCategory: data.eventCategory,
        promocionarEn: data.promocionarEn,
        formularioConfig,
        attachments,
      });
      onCreated(editProject.id);
      close();
      return;
    }
    clearDraft();
    const id = addProject({
      name: data.name.trim(),
      description: data.description.trim(),
      client: data.client.trim(),
      state: data.state,
      priority: data.priority,
      startDate: data.startDate || null,
      dueDate: data.dueDate || null,
      strategistName: data.strategistName.trim(),
      segmentLink: data.segmentLink.trim(),
      eventCategory: data.eventCategory,
      promocionarEn: data.promocionarEn,
      audienciaNarrativa: {
        segmentos: audiencia.segmentos,
        metaInscripciones: audiencia.metaInscripciones.trim(),
        dolor: audiencia.dolor.trim(),
        promesa: audiencia.promesa.trim(),
        bigIdea: audiencia.bigIdea.trim(),
      },
      canales: canalesRows,
      loops: loopsRows,
      etapas,
      mensajeBase,
      motor,
      fabricaBriefs: fabricaBriefs,
      requerimientos,
      formularioConfig,
      attachments,
    });
    onCreated(id);
    close();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => v ? onOpenChange(v) : close()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar campaña' : 'Nueva campaña'}</DialogTitle>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center gap-2 px-1 py-2">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const active = i === step;
            const done = i < step;
            return (
              <div key={s.key} className="flex items-center gap-2 flex-1">
                <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  active ? 'bg-factory-soft text-factory'
                  : done ? 'text-foreground' : 'text-muted-foreground'
                }`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                    active ? 'bg-factory text-factory-foreground'
                    : done ? 'bg-state-done text-white' : 'bg-muted text-muted-foreground'
                  }`}>
                    {done ? <Check className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
                  </div>
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
                {i < STEPS.length - 1 && <div className={`h-px flex-1 ${i < step ? 'bg-state-done' : 'bg-border'}`} />}
              </div>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto px-1 py-3">
          {/* STEP 1 — DATA */}
          {step === 0 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Nombre de producto o campaña *</Label>
                <Input
                  placeholder="Ej. Evento Internacional 2025"
                  value={data.name}
                  onChange={(e) => setData((d) => ({ ...d, name: e.target.value }))}
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label>Descripción</Label>
                <RichTextEditor
                  content={data.description}
                  onChange={(html) => setData((d) => ({ ...d, description: html }))}
                  placeholder="Objetivo, alcance, contexto…"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Cliente / Área</Label>
                  <Input
                    placeholder="Ej. Brand Studio"
                    value={data.client}
                    onChange={(e) => setData((d) => ({ ...d, client: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Fecha de inicio</Label>
                  <Input
                    type="date"
                    value={data.startDate}
                    onChange={(e) => setData((d) => ({ ...d, startDate: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Fecha de finalización</Label>
                  <Input
                    type="date"
                    value={data.dueDate}
                    onChange={(e) => setData((d) => ({ ...d, dueDate: e.target.value }))}
                  />
                </div>
              </div>
              {/* Categoría del evento */}
              <div className="space-y-1.5">
                <Label>Categoría del evento</Label>
                <Select
                  value={data.eventCategory}
                  onValueChange={(v) => setData((d) => ({ ...d, eventCategory: v, promocionarEn: [] }))}
                >
                  <SelectTrigger><SelectValue placeholder="Selecciona una categoría…" /></SelectTrigger>
                  <SelectContent>
                    {EVENT_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label>Estratega</Label>
                  <Input
                    placeholder="Nombre del estratega"
                    value={data.strategistName}
                    onChange={(e) => setData((d) => ({ ...d, strategistName: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Estado inicial</Label>
                  <Select value={data.state} onValueChange={(v) => setData((d) => ({ ...d, state: v as any }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="planning">En planeación</SelectItem>
                      <SelectItem value="in_progress">En proceso</SelectItem>
                      <SelectItem value="review">En revisión</SelectItem>
                      <SelectItem value="blocked">Bloqueado</SelectItem>
                      <SelectItem value="done">Completado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Prioridad</Label>
                  <Select value={data.priority} onValueChange={(v) => setData((d) => ({ ...d, priority: v as any }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="P0">P0 — Crítica</SelectItem>
                      <SelectItem value="P1">P1 — Alta</SelectItem>
                      <SelectItem value="P2">P2 — Normal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Link del segmento</Label>
                  <Input
                    placeholder="URL del segmento (opcional)"
                    value={data.segmentLink}
                    onChange={(e) => setData((d) => ({ ...d, segmentLink: e.target.value }))}
                  />
                </div>
              </div>

              {/* Promocionar en — proyectos existentes con misma categoría y fechas cercanas */}
              {data.eventCategory && (
                <div className="space-y-2">
                  <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground block">
                    Promocionar en
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Campañas existentes con la misma categoría y fechas a ±7 días de distancia.
                  </p>
                  {matchingProjects.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">
                      No hay campañas existentes que coincidan con la categoría y el rango de fechas.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {matchingProjects.map((p) => {
                        const selected = data.promocionarEn.includes(p.id);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() =>
                              setData((d) => ({
                                ...d,
                                promocionarEn: selected
                                  ? d.promocionarEn.filter((id) => id !== p.id)
                                  : [...d.promocionarEn, p.id],
                              }))
                            }
                            className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                              selected
                                ? 'border-blue-500 bg-blue-50 text-blue-700'
                                : 'border-border bg-card text-muted-foreground hover:border-muted-foreground'
                            }`}
                          >
                            {p.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ─── Archivos adjuntos ─── */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground block">
                  Archivos adjuntos
                </Label>
                <p className="text-xs text-muted-foreground">
                  Adjunta archivos de referencia (briefs, imágenes, PDFs, etc.).
                </p>
                <div className="flex flex-wrap gap-2">
                  {attachments.map((file, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border/60 bg-card text-xs">
                      <span className="truncate max-w-[160px]">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                        className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer mt-1">
                  <Plus className="h-3.5 w-3.5" />
                  <span>Adjuntar archivo</span>
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={async (e) => {
                      const files = Array.from(e.target.files ?? []);
                      const newFiles = await Promise.all(
                        files.map((f) => new Promise<{ name: string; type: string; data: string }>((resolve) => {
                          const reader = new FileReader();
                          reader.onload = () => resolve({ name: f.name, type: f.type, data: reader.result as string });
                          reader.readAsDataURL(f);
                        }))
                      );
                      setAttachments((prev) => [...prev, ...newFiles]);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>
            </div>
          )}

          {/* STEP 2 — AUDIENCIA Y NARRATIVA */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground block mb-3">
                  Segmentos de audiencia
                </Label>
                <div className="flex flex-wrap gap-2">
                  {(() => {
                    const ALL_SEGMENTS = ['afiliado', 'renovado', 'matriculado', 'potencial', 'no_renovado', 'vip', 'cluster_energia', 'cluster_espacios', 'cluster_salud', 'cluster_turismo', 'cluster_alimentos', 'mercado_medio'];
                    const allSelected = ALL_SEGMENTS.every((s) => audiencia.segmentos.includes(s));
                    return (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            setAudiencia((a) => ({
                              ...a,
                              segmentos: allSelected ? [] : [...ALL_SEGMENTS],
                            }))
                          }
                          className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                            allSelected
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-border bg-card text-muted-foreground hover:border-muted-foreground'
                          }`}
                        >
                          Todos
                        </button>
                        {ALL_SEGMENTS.map((segId) => {
                          const seg = { id: segId, label: ({
                            afiliado: 'Afiliado',
                            renovado: 'Renovados',
                            matriculado: 'Matriculado',
                            potencial: 'Potencial',
                            no_renovado: 'No renovado',
                            vip: 'VIP / Alta dirección',
                            cluster_energia: 'Energía',
                            cluster_espacios: 'Espacios Habitables',
                            cluster_salud: 'Salud',
                            cluster_turismo: 'Turismo de Eventos y Negocios',
                            cluster_alimentos: 'Alimentos y Agroindustrias',
                            mercado_medio: 'Mercado medio',
                          } as Record<string, string>)[segId] };
                          const active = audiencia.segmentos.includes(seg.id);
                          return (
                            <button
                              key={seg.id}
                              type="button"
                              onClick={() =>
                                setAudiencia((a) => ({
                                  ...a,
                                  segmentos: active
                                    ? a.segmentos.filter((s) => s !== seg.id)
                                    : [...a.segmentos, seg.id],
                                }))
                              }
                              className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                                active
                                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                                  : 'border-border bg-card text-muted-foreground hover:border-muted-foreground'
                              }`}
                            >
                              {seg.label}
                            </button>
                          );
                        })}
                      </>
                    );
                  })()}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Meta de inscripciones</Label>
                <Input
                  type="number"
                  placeholder="# de inscripciones esperadas"
                  value={audiencia.metaInscripciones}
                  onChange={(e) => setAudiencia((a) => ({ ...a, metaInscripciones: e.target.value }))}
                />
              </div>

              <div className="border-t pt-4">
                <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground block mb-3">
                  Núcleo narrativo
                </Label>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Dolor concreto que resuelve</Label>
                    <Textarea
                      rows={2}
                      placeholder="El problema real del cliente, en sus propias palabras…"
                      value={audiencia.dolor}
                      onChange={(e) => setAudiencia((a) => ({ ...a, dolor: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Promesa concreta del producto</Label>
                    <Textarea
                      rows={2}
                      placeholder="Qué resultado específico obtendrá…"
                      value={audiencia.promesa}
                      onChange={(e) => setAudiencia((a) => ({ ...a, promesa: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Mensaje madre (Big Idea)</Label>
                    <Input
                      placeholder="La idea central que unifica la campaña — 1 sola frase"
                      value={audiencia.bigIdea}
                      onChange={(e) => setAudiencia((a) => ({ ...a, bigIdea: e.target.value }))}
                    />
                   </div>
                </div>
              </div>

              {/* ─── Base del mensaje (ELMR) ─── */}
              <div className="border-t pt-4">
                <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground block mb-3">
                  Base del mensaje (ELMR)
                </Label>
                <p className="text-xs text-muted-foreground mb-3 italic">
                  Los 4 pilares que sostienen el mensaje de la campaña a lo largo de todo el ciclo.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Emoción</Label>
                    <Textarea
                      rows={2}
                      placeholder="Qué siente el contacto al ver el mensaje…"
                      value={mensajeBase.emocion}
                      onChange={(e) => setMensajeBase((m) => ({ ...m, emocion: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Lógica</Label>
                    <Textarea
                      rows={2}
                      placeholder="El argumento racional que respalda la promesa…"
                      value={mensajeBase.logica}
                      onChange={(e) => setMensajeBase((m) => ({ ...m, logica: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Motivación</Label>
                    <Textarea
                      rows={2}
                      placeholder="Qué lo impulsa a actuar ahora…"
                      value={mensajeBase.motivacion}
                      onChange={(e) => setMensajeBase((m) => ({ ...m, motivacion: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Recompensa</Label>
                    <Textarea
                      rows={2}
                      placeholder="Qué gana al participar/convertir…"
                      value={mensajeBase.recompensa}
                      onChange={(e) => setMensajeBase((m) => ({ ...m, recompensa: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3 — CANALES Y COMPORTAMIENTO */}
          {step === 2 && (
            <div className="space-y-4">
              {/* ─── Ecosistema cíclico: Plan de canales + Loops agrupados por etapa ─── */}
              {etapas.length === 0 ? (
                <div className="rounded-xl border-2 border-dashed border-border p-8 text-center space-y-3">
                  <RefreshCw className="h-7 w-7 text-muted-foreground mx-auto" />
                  <p className="text-sm font-medium">Organiza el ecosistema en 6 etapas cíclicas</p>
                  <p className="text-xs text-muted-foreground max-w-md mx-auto">
                    Atracción → Interacción → Captura → Validación → Desenlace → Reactivación (que
                    reinicia el ciclo). Agrupa ahí el Plan de canales y los Loops de comportamiento.
                  </p>
                  <Button type="button" size="sm" onClick={initEtapas}>
                    <Sparkles className="h-3.5 w-3.5" /> Inicializar las 6 etapas
                  </Button>
                </div>
              ) : (
                <div>
                  <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground block mb-3">
                    Ecosistema cíclico — canales y comportamiento por etapa
                  </Label>
                  <Accordion type="multiple" defaultValue={etapas.map((e) => e.id)} className="space-y-2">
                    {[...etapas].sort((a, b) => a.orden - b.orden).map((etapa, idx, sorted) => {
                      const meta = ETAPA_TIPO_META[etapa.tipo];
                      const Icon = meta.icon;
                      const toques = canalesRows.filter((r) => r.etapaId === etapa.id);
                      const etapaLoops = loopsRows.filter((r) => r.etapaId === etapa.id);
                      // La etapa de Atracción no lleva loops: la audiencia recién entra al
                      // ecosistema, todavía no hay comportamiento que disparar. Los loops
                      // aparecen a partir de Interacción.
                      const showLoops = etapa.tipo !== 'atraccion';
                      return (
                        <AccordionItem key={etapa.id} value={etapa.id} className="rounded-lg border border-border/60 bg-card px-3 last:border-b-0">
                          <div className="flex items-center gap-1">
                            <div className="flex flex-col shrink-0">
                              <button
                                type="button"
                                onClick={() => moveEtapa(etapa.id, -1)}
                                disabled={idx === 0}
                                className="text-muted-foreground hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed"
                              >
                                <ChevronUp className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveEtapa(etapa.id, 1)}
                                disabled={idx === sorted.length - 1}
                                className="text-muted-foreground hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed"
                              >
                                <ChevronDown className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            <AccordionTrigger className="py-3">
                              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                <span
                                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                                  style={{ backgroundColor: `${meta.color}1a`, color: meta.color }}
                                >
                                  <Icon className="h-4 w-4" />
                                </span>
                                <div className="min-w-0 text-left">
                                  <p className="text-sm font-semibold truncate">{idx + 1}. {etapa.nombre}</p>
                                  <p className="text-[10px] text-muted-foreground">
                                    {toques.length} {toques.length === 1 ? 'toque' : 'toques'}
                                    {showLoops && ` · ${etapaLoops.length} ${etapaLoops.length === 1 ? 'loop' : 'loops'}`}
                                  </p>
                                </div>
                              </div>
                            </AccordionTrigger>
                          </div>
                          <AccordionContent className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Nombre</Label>
                                <Input value={etapa.nombre} onChange={(e) => updateEtapa(etapa.id, 'nombre', e.target.value)} className="h-8 text-xs" />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Objetivo</Label>
                                <Input value={etapa.objetivo} onChange={(e) => updateEtapa(etapa.id, 'objetivo', e.target.value)} className="h-8 text-xs" />
                              </div>
                            </div>

                            {/* Toques de esta etapa (Plan de canales) */}
                            <div className="space-y-2 border-t border-border/40 pt-3">
                              <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Plan de canales</Label>
                              <div className="space-y-2">
                                {toques.map((row) => (
                                  <ToqueRow
                                    key={row.id}
                                    row={row}
                                    segmentos={audiencia.segmentos}
                                    etapas={etapas}
                                    onUpdate={(field, value) => updateCanalRow(row.id, field, value)}
                                    onRemove={() => removeCanalRow(row.id)}
                                  />
                                ))}
                              </div>
                              <button
                                onClick={() => addCanalRow(etapa.id)}
                                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1"
                              >
                                <Plus className="h-3.5 w-3.5" /> Agregar toque
                              </button>
                            </div>

                            {/* Loops de esta etapa — no se muestran en Atracción (ver showLoops) */}
                            {showLoops && (
                            <div className="space-y-2 border-t border-border/40 pt-3">
                              <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Loops de comportamiento</Label>
                              {etapaLoops.length > 0 && (
                                <div className="overflow-x-auto">
                                  <table className="w-full border-collapse">
                                    <thead>
                                      <tr className="bg-muted text-left">
                                        <th className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground p-2 rounded-l">Disparador</th>
                                        <th className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground p-2">Reacción diseñada</th>
                                        <th className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground p-2">Responsable</th>
                                        <th className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground p-2 rounded-r">Lleva a →</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {etapaLoops.map((row) => (
                                        <LoopRowItem
                                          key={row.id}
                                          row={row}
                                          canalesRows={canalesRows}
                                          roles={involvedRoles}
                                          etapas={etapas}
                                          onUpdate={(field, value) => updateLoopRow(row.id, field, value)}
                                          onRemove={() => removeLoopRow(row.id)}
                                        />
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                              <button
                                onClick={() => addLoopRow(etapa.id)}
                                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1"
                              >
                                <Plus className="h-3.5 w-3.5" /> Agregar disparador
                              </button>
                            </div>
                            )}
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                </div>
              )}

              {/* ─── Sin etapa asignada — toques/loops de proyectos anteriores a la unificación. Sin
                 el gate de `etapas.length > 0`: si el proyecto todavía no tiene etapas, TODAS sus
                 filas existentes deben verse aquí (no quedar ocultas detrás del botón "Inicializar
                 etapas" de arriba) — nada se pierde ni se esconde. ─── */}
              {(() => {
                const etapaIds = new Set(etapas.map((e) => e.id));
                const sueltosCanales = canalesRows.filter((r) => !r.etapaId || !etapaIds.has(r.etapaId));
                const sueltosLoops = loopsRows.filter((r) => !r.etapaId || !etapaIds.has(r.etapaId));
                if (sueltosCanales.length === 0 && sueltosLoops.length === 0) return null;
                return (
                  <div className="rounded-lg border border-dashed border-border/60 p-3 space-y-3">
                    <div>
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sin etapa asignada</Label>
                      <p className="text-[10px] text-muted-foreground italic">
                        Toques y loops de antes de organizar el ciclo — asígnalos a una etapa.
                      </p>
                    </div>
                    {sueltosCanales.length > 0 && (
                      <div className="space-y-2">
                        {sueltosCanales.map((row) => (
                          <ToqueRow
                            key={row.id}
                            row={row}
                            segmentos={audiencia.segmentos}
                            etapas={etapas}
                            showEtapaPicker
                            onUpdate={(field, value) => updateCanalRow(row.id, field, value)}
                            onRemove={() => removeCanalRow(row.id)}
                          />
                        ))}
                      </div>
                    )}
                    {sueltosLoops.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="bg-muted text-left">
                              <th className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground p-2 rounded-l">Disparador</th>
                              <th className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground p-2">Reacción diseñada</th>
                              <th className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground p-2">Responsable</th>
                              <th className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground p-2">Lleva a →</th>
                              <th className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground p-2 rounded-r">Etapa</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sueltosLoops.map((row) => (
                              <LoopRowItem
                                key={row.id}
                                row={row}
                                canalesRows={canalesRows}
                                roles={involvedRoles}
                                etapas={etapas}
                                showEtapaPicker
                                onUpdate={(field, value) => updateLoopRow(row.id, field, value)}
                                onRemove={() => removeLoopRow(row.id)}
                              />
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ─── Requerimiento (Motor del proceso) ─── */}
              <div className="border-t pt-4">
                <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground block mb-3">
                  Requerimiento (Motor del proceso) *
                </Label>
                <p className="text-xs text-muted-foreground mb-3 italic">
                  Selecciona los requerimientos de la campaña para generar las tareas correspondientes en el brief de fábrica.
                </p>
                {!reqSatisfied && (
                  <p className="text-xs mb-3 -mt-2 font-medium text-destructive">
                    Debes elegir "Landing", "Formulario de inscripción" o "No requiere formulario/landing" para continuar.
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {REQUERIMIENTOS.map((req) => {
                    const active = requerimientos.includes(req.id);
                    return (
                      <button
                        key={req.id}
                        type="button"
                        onClick={() =>
                          setRequerimientos((prev) => {
                            if (active) return prev.filter((r) => r !== req.id);
                            // "ninguno" es excluyente con landing/formulario y viceversa.
                            if (req.id === 'ninguno') return ['ninguno'];
                            return [...prev.filter((r) => r !== 'ninguno'), req.id];
                          })
                        }
                        className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                          active
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-border bg-card text-muted-foreground hover:border-muted-foreground'
                        }`}
                      >
                        {req.label}
                      </button>
                    );
                  })}
                </div>

                {/* ─── Formulario básico? (solo cuando está seleccionado Formulario de inscripción) ─── */}
                {requerimientos.includes('formulario') && (
                  <div className="mt-4 p-4 rounded-lg border border-border/60 bg-card/50 space-y-3">
                    <Label className="text-sm font-semibold block">¿Formulario básico?</Label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setFormularioConfig((prev) => ({ ...prev, basico: true }))}
                        className={`px-4 py-2 rounded-lg text-xs font-medium border transition-all ${
                          formularioConfig.basico === true
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-border bg-card text-muted-foreground hover:border-muted-foreground'
                        }`}
                      >
                        Sí
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormularioConfig((prev) => ({ ...prev, basico: false }))}
                        className={`px-4 py-2 rounded-lg text-xs font-medium border transition-all ${
                          formularioConfig.basico === false
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-border bg-card text-muted-foreground hover:border-muted-foreground'
                        }`}
                      >
                        No
                      </button>
                    </div>

                    {formularioConfig.basico === true && (
                      <p className="text-xs text-muted-foreground italic">
                        Se creará la tarea "Formulario de inscripción básico" para el gestor de canales.
                      </p>
                    )}

                    {formularioConfig.basico === false && (
                      <div className="space-y-1.5 border-t border-border/40 pt-3">
                        <Label className="text-xs">Campos adicionales del formulario</Label>
                        <textarea
                          rows={2}
                          placeholder="Ej: Teléfono, cargo, empresa, ciudad…"
                          value={formularioConfig.camposAdicionales}
                          onChange={(e) => setFormularioConfig((prev) => ({ ...prev, camposAdicionales: e.target.value }))}
                          className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-factory/40 resize-none"
                        />
                      </div>
                    )}
                  </div>
                )}

              </div>
            </div>
          )}

          {/* STEP 4 — FÁBRICA */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground block mb-3">
                  Brief por rol <span className="text-xs font-normal normal-case text-muted-foreground">— activa y define la estrategia de mejora continua</span>
                </Label>
                {fabricaBriefs.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic text-center py-6">
                    Completa la sección de canales primero para generar los briefs automáticos.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {(() => {
                      const grouped = fabricaBriefs.reduce<Record<string, FabricaBriefItem[]>>((acc, item) => {
                        const key = item.roleLabel;
                        if (!acc[key]) acc[key] = [];
                        acc[key].push(item);
                        return acc;
                      }, {});
                      return Object.entries(grouped).map(([roleLabel, items]) => (
                        <div key={roleLabel} className="rounded-lg border border-border/60 bg-card p-3">
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-factory mb-2">
                            {roleLabel}
                          </h4>
                          <div className="space-y-1">
                            {items.map((item) => (
                              <div key={item.id} className="flex items-start gap-2 px-1.5 py-1 rounded-md text-sm text-foreground/80">
                                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
                                <span>{item.tarea}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                )}
              </div>
              <div className="border-t pt-3 text-xs text-muted-foreground">
                {fabricaBriefs.length} {fabricaBriefs.length === 1 ? 'tarea' : 'tareas'} generadas
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex sm:justify-between gap-2 border-t pt-3">
          <Button variant="outline" onClick={() => step === 0 ? close() : setStep((s) => s - 1)}>
            {step === 0 ? 'Cancelar' : (<><ChevronLeft className="h-4 w-4" /> Atrás</>)}
          </Button>
          {isLast ? (
            <Button className="bg-primary text-primary-foreground shadow-glow" onClick={handleCreate} disabled={!data.name.trim() || !reqSatisfied}>
              <Check className="h-4 w-4" /> {isEditing ? 'Actualizar campaña' : 'Crear campaña'}
            </Button>
          ) : (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext}>
              Siguiente <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateProjectWizard;
