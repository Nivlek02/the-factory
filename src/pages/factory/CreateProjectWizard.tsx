import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useFactoryStore, type FabricaBriefItem } from '@/store/factoryStore';
import { useRolesStore } from '@/store/rolesStore';
import RichTextEditor from '@/components/ui/rich-text-editor';
import { Cog, Plus, X, ChevronLeft, ChevronRight, FolderKanban, Check, Target, GitBranch, Calendar } from 'lucide-react';

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
  { id: 'pauta_digital', label: 'Pauta digital' },
  { id: 'piezas', label: 'Piezas' },
] as const;

type ReqId = (typeof REQUERIMIENTOS)[number]['id'];

/** Maps each requerimiento to the roles + specific tareas that should appear when selected.
 *  If tareas array is empty for a role, ALL their tareas are included. */
const REQ_ROLE_TAREAS: Record<ReqId, Record<string, string[]>> = {
  landing: {
    gestor_canales: ['Landing'],
    produccion: ['Landing page'],
  },
  formulario: {},
  pauta_digital: {
    social: [],
  },
  piezas: {
    diseno: ['Diseño de piezas gráficas'],
  },
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
  const [canalesRows, setCanalesRows] = useState<{ id: string; canal: string; dia: string; copy: string; segmento: string }[]>(
    editProject?.canales?.map((c) => ({ ...c })) ?? []
  );
  const [loopsRows, setLoopsRows] = useState<{ id: string; disparador: string; reaccion: string; responsable: string }[]>(
    editProject?.loops?.map((l) => ({ ...l })) ?? []
  );
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
          requerimientos,
          formularioConfig,
          attachments,
          step,
        }));
      } catch { /* QuotaExceededError — draft not persisted, data stays in state */ }
    }, 2000);
    return () => clearTimeout(timer);
  }, [open, isEditing, data, audiencia, canalesRows, loopsRows, requerimientos, formularioConfig, attachments, step]);

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
    setRequerimientos([]);
    setFormularioConfig({ basico: null, camposAdicionales: '', cuadroTexto: '' });
    setAttachments([]);
    setFabricaBriefs([]);
  };

  const addCanalRow = () => {
    setCanalesRows((prev) => [...prev, { id: uid(), canal: 'Correo', dia: '', copy: '', segmento: 'todos' }]);
  };
  const removeCanalRow = (id: string) => setCanalesRows((prev) => prev.filter((r) => r.id !== id));
  const updateCanalRow = (id: string, field: string, value: string) =>
    setCanalesRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  const addLoopRow = () => {
    setLoopsRows((prev) => [...prev, { id: uid(), disparador: '', reaccion: '', responsable: '' }]);
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
    const addItem = (roleId: string, roleLabel: string, tarea: string, extra?: Partial<FabricaBriefItem>) => {
      items.push({ id: uid(), roleId, roleLabel, tarea, checked: false, ...extra });
    };
    const addRoleTareasFiltered = (roleId: string, roleLabel: string, roleTareas: string[]) => {
      const filtered = filterTareasByRequerimientos(roleId, roleTareas, reqs);
      for (const t of filtered) addItem(roleId, roleLabel, t);
    };

    // ─── Tareas configuradas desde Ajustes ───
    //   Producción y Diseño siempre participan
    for (const role of roles) {
      if (role.tareas.length === 0) continue;
      if (role.id === 'produccion' || role.id === 'diseno') {
        addRoleTareasFiltered(role.id, role.label, role.tareas);
      }
    }

    // ─── Responsabilidad por canal ───
    for (const row of canales) {
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
          addItem('copy', 'Copy',
            `Redactar copy para ${row.canal}${row.copy ? ` — ${row.copy}` : ''}`);
          const copyRole = roles.find((r) => r.id === 'copy');
          if (copyRole) {
            addRoleTareasFiltered(copyRole.id, copyRole.label, copyRole.tareas);
          }
          break;
        }
        case 'Meta Ads': {
          addItem('social', 'Social Media',
            `Configurar campaña en Meta Ads${row.copy ? ` — ${row.copy}` : ''}`);
          const socialRole = roles.find((r) => r.id === 'social');
          if (socialRole) {
            addRoleTareasFiltered(socialRole.id, socialRole.label, socialRole.tareas);
          }
          break;
        }
        case 'Call Center': {
          addItem('estratega', 'Estratega',
            `Gestionar Call Center${ref ? ` — ${ref}` : ''}`);
          addItem('copy', 'Copy',
            `Redactar guion para Call Center${row.copy ? ` — ${row.copy}` : ''}`);
          const copyRole = roles.find((r) => r.id === 'copy');
          if (copyRole) {
            addRoleTareasFiltered(copyRole.id, copyRole.label, copyRole.tareas);
          }
          const estRole = roles.find((r) => r.id === 'estratega');
          if (estRole) {
            addRoleTareasFiltered(estRole.id, estRole.label, estRole.tareas);
          }
          break;
        }
        case 'RRSS': {
          addItem('social', 'Social Media',
            `Plan de contenido para RRSS${row.copy ? ` — ${row.copy}` : ''}`);
          const socialRole = roles.find((r) => r.id === 'social');
          if (socialRole) {
            addRoleTareasFiltered(socialRole.id, socialRole.label, socialRole.tareas);
          }
          break;
        }
      }
    }

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
      'Meta Ads':  ['social'],
      'Call Center': ['estratega', 'copy'],
      RRSS:        ['social'],
    };
    return map[canal]?.includes(roleId) ?? false;
  };

  // Rebuild when canales, loops, requerimientos or formularioConfig change
  useEffect(() => {
    const hasFormulario = requerimientos.includes('formulario') && formularioConfig.basico !== null;
    const hasContent = canalesRows.length > 0 || loopsRows.some((l) => l.responsable) || hasFormulario;
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

  const canNext = step === 0
    ? data.name.trim().length > 0
    : step === 2
    ? hasLandingOrFormulario && (!requerimientos.includes('formulario') || formularioConfig.basico !== null)
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
          <DialogTitle>{isEditing ? 'Editar proyecto' : 'Nuevo proyecto'}</DialogTitle>
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
                    Proyectos existentes con la misma categoría y fechas a ±7 días de distancia.
                  </p>
                  {matchingProjects.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">
                      No hay proyectos existentes que coincidan con la categoría y el rango de fechas.
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
            </div>
          )}

          {/* STEP 3 — CANALES Y COMPORTAMIENTO */}
          {step === 2 && (
            <div className="space-y-4">
              {/* ─── Plan de canales ─── */}
              <div>
                <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground block mb-3">
                  Plan de canales
                </Label>
                <div className="space-y-2">
                  {/* Header */}
                  <div className="grid grid-cols-[90px_60px_1fr_minmax(0,140px)] gap-2 px-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Canal</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span className="hidden sm:inline">Día</span>
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Copy / Ángulo del toque</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Segmento</span>
                  </div>
                  {canalesRows.map((row) => (
                    <div key={row.id} className="grid grid-cols-[90px_60px_1fr_minmax(0,140px)_24px] gap-2 items-center rounded-lg border border-border/60 bg-card p-2">
                      <select
                        value={row.canal}
                        onChange={(e) => updateCanalRow(row.id, 'canal', e.target.value)}
                        className="text-xs bg-transparent border-none outline-none cursor-pointer font-medium"
                      >
                        <option value="Correo">Correo</option>
                        <option value="WhatsApp">WhatsApp</option>
                        <option value="SMS">SMS</option>
                        <option value="Meta Ads">Meta Ads</option>
                        <option value="RRSS">RRSS</option>
                        <option value="Call Center">Call Center</option>
                      </select>
                      <div
                        className="relative flex items-center gap-1 w-full cursor-pointer"
                        onClick={(e) => {
                          const input = e.currentTarget.querySelector('input[type="date"]') as HTMLInputElement;
                          input?.showPicker();
                        }}
                      >
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        {row.dia && (
                          <span className="text-xs text-foreground truncate">
                            {formatDisplay(row.dia)}
                          </span>
                        )}
                        <input
                          type="date"
                          value={row.dia}
                          onChange={(e) => updateCanalRow(row.id, 'dia', e.target.value)}
                          className="w-0 h-0 opacity-0 absolute -z-10"
                        />
                      </div>
                      <input
                        placeholder="Ángulo del toque…"
                        value={row.copy}
                        onChange={(e) => updateCanalRow(row.id, 'copy', e.target.value)}
                        className="text-xs bg-transparent border-none outline-none w-full"
                      />
                      <div className="min-w-0 overflow-hidden" title={SEGMENTOS_LABEL[row.segmento] ?? 'Segmento General'}>
                        <select
                          value={row.segmento || 'todos'}
                          onChange={(e) => updateCanalRow(row.id, 'segmento', e.target.value)}
                          className="text-xs bg-transparent border-none outline-none w-full max-w-full cursor-pointer truncate"
                          style={{ textOverflow: 'ellipsis' }}
                        >
                          <option value="todos">Segmento General</option>
                          {audiencia.segmentos.map((segId) => (
                            <option key={segId} value={segId}>
                              {SEGMENTOS_LABEL[segId] ?? segId}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        onClick={() => removeCanalRow(row.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={addCanalRow}
                    className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1"
                  >
                    <Plus className="h-3.5 w-3.5" /> Agregar toque
                  </button>
                </div>
              </div>

              {/* ─── Loops de comportamiento ─── */}
              <div className="border-t pt-4">
                <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground block mb-3">
                  Loops de comportamiento (estrategia de canales)
                </Label>
                <p className="text-xs text-muted-foreground mb-3 italic">
                  Qué sucede después de los toques programados — cada acción del cliente dispara una reacción diseñada.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-muted text-left">
                        <th className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground p-2 rounded-l">Disparador</th>
                        <th className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground p-2">Reacción diseñada</th>
                        <th className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground p-2 rounded-r">Responsable</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loopsRows.map((row) => (
                        <tr key={row.id} className="border-b border-border/60">
                          <td className="p-1.5">
                            {(() => {
                              const emailTriggers = canalesRows
                                .filter((c) => c.canal === 'Correo' && c.copy.trim())
                                .map((c) => ({ label: `📧 ${c.copy.trim()}`, value: `Envío de correo: ${c.copy.trim()}` }));
                              const standardTriggers = [
                                'Abrió correo pero no hizo clic',
                                'Hizo clic en el enlace',
                                'No abrió el correo',
                                'Respondió al correo',
                                'Se dio de baja',
                              ];
                              const allPresetValues = ['', ...standardTriggers, ...emailTriggers.map((t) => t.value)];
                              const isCustomInput = row.disparador === '__custom__' || (row.disparador !== '' && !allPresetValues.includes(row.disparador));
                              if (emailTriggers.length > 0 && !isCustomInput) {
                                return (
                                  <select
                                    value={row.disparador}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      if (val === '__custom__') {
                                        updateLoopRow(row.id, 'disparador', '__custom__');
                                      } else {
                                        updateLoopRow(row.id, 'disparador', val);
                                      }
                                    }}
                                    className="w-full bg-transparent border-none outline-none text-xs py-1 cursor-pointer"
                                  >
                                    <option value="">Seleccionar disparador…</option>
                                    <optgroup label="Disparadores estándar">
                                      {standardTriggers.map((t) => (
                                        <option key={t} value={t}>{t}</option>
                                      ))}
                                    </optgroup>
                                    <optgroup label="Envíos programados">
                                      {emailTriggers.map((t, i) => (
                                        <option key={i} value={t.value}>{t.label}</option>
                                      ))}
                                    </optgroup>
                                    <option value="__custom__">✏️ Escribir personalizado…</option>
                                  </select>
                                );
                              }
                              return (
                                <input
                                  placeholder="Escribe el disparador personalizado…"
                                  value={isCustomInput && row.disparador === '__custom__' ? '' : row.disparador}
                                  onChange={(e) => updateLoopRow(row.id, 'disparador', e.target.value)}
                                  className="w-full bg-transparent border-none outline-none text-xs py-1"
                                />
                              );
                            })()}
                          </td>
                          <td className="p-1.5">
                            <input
                              placeholder="Reacción diseñada…"
                              value={row.reaccion}
                              onChange={(e) => updateLoopRow(row.id, 'reaccion', e.target.value)}
                              className="w-full bg-transparent border-none outline-none text-xs py-1"
                            />
                          </td>
                          <td className="p-1.5 flex items-center gap-1">
                            <select
                              value={row.responsable}
                              onChange={(e) => updateLoopRow(row.id, 'responsable', e.target.value)}
                              className="flex-1 bg-transparent border-none outline-none text-xs py-1 cursor-pointer"
                            >
                              <option value="">Responsable</option>
                              {roles.map((r) => (
                                <option key={r.id} value={r.label}>
                                  {r.label}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => removeLoopRow(row.id)}
                              className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  onClick={addLoopRow}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-2"
                >
                  <Plus className="h-3.5 w-3.5" /> Agregar disparador
                </button>
              </div>

              {/* ─── Requerimientos ─── */}
              <div className="border-t pt-4">
                <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground block mb-3">
                  Requerimiento *
                </Label>
                <p className="text-xs text-muted-foreground mb-3 italic">
                  Selecciona los requerimientos del proyecto para generar las tareas correspondientes en el brief de fábrica.
                </p>
                {!hasLandingOrFormulario && (
                  <p className="text-xs mb-3 -mt-2 font-medium text-destructive">
                    Debes elegir al menos "Landing" o "Formulario de inscripción" para continuar.
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
                          setRequerimientos((prev) =>
                            active
                              ? prev.filter((r) => r !== req.id)
                              : [...prev, req.id]
                          )
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
            <Button className="bg-gradient-factory text-factory-foreground shadow-glow" onClick={handleCreate} disabled={!data.name.trim() || !hasLandingOrFormulario}>
              <Check className="h-4 w-4" /> Crear proyecto
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
