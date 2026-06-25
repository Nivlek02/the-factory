import { useEffect, useState } from 'react';
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
  afiliado: 'Afiliado activo',
  matriculado: 'Matriculado',
  potencial: 'Potencial',
  no_renovado: 'No renovado',
  vip: 'VIP / Alta dirección',
  cluster: 'Cluster sectorial',
  mercado_medio: 'Mercado medio',
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
  const { addProject, updateProject } = useFactoryStore();
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
  });

  const [audiencia, setAudiencia] = useState({
    segmentos: editProject?.audienciaNarrativa?.segmentos ?? [] as string[],
    metaInscripciones: editProject?.audienciaNarrativa?.metaInscripciones ?? '',
    dolor: editProject?.audienciaNarrativa?.dolor ?? '',
    promesa: editProject?.audienciaNarrativa?.promesa ?? '',
    bigIdea: editProject?.audienciaNarrativa?.bigIdea ?? '',
  });

  const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const [canalesRows, setCanalesRows] = useState<{ id: string; canal: string; dia: string; copy: string; segmento: string }[]>(
    editProject?.canales?.map((c) => ({ ...c })) ?? []
  );
  const [loopsRows, setLoopsRows] = useState<{ id: string; disparador: string; reaccion: string; responsable: string }[]>(
    editProject?.loops?.map((l) => ({ ...l })) ?? []
  );
  const [fabricaBriefs, setFabricaBriefs] = useState<FabricaBriefItem[]>(
    editProject?.fabricaBriefs?.map((b) => ({ ...b })) ?? []
  );

  // Reset when opening without editProject
  const reset = () => {
    setStep(0);
    setData({ name: '', description: '', client: '', state: 'planning', priority: 'P1', startDate: today(), dueDate: '', strategistName: '' });
    setAudiencia({ segmentos: [], metaInscripciones: '', dolor: '', promesa: '', bigIdea: '' });
    setCanalesRows([]);
    setLoopsRows([]);
    setFabricaBriefs([]);
  };

  const addCanalRow = () => {
    setCanalesRows((prev) => [...prev, { id: uid(), canal: 'Correo', dia: '', copy: '', segmento: '' }]);
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

  // ─── Auto-populate Fábrica briefs from canales + loops ───
  const buildFabricaBriefs = (canales: typeof canalesRows, loops: typeof loopsRows): FabricaBriefItem[] => {
    const items: FabricaBriefItem[] = [];
    const addItem = (roleId: string, roleLabel: string, tarea: string) => {
      items.push({ id: uid(), roleId, roleLabel, tarea, checked: false });
    };

    // ─── Tareas configuradas desde Ajustes ───
    //   Producción y Diseño siempre participan
    for (const role of roles) {
      if (role.tareas.length === 0) continue;
      if (role.id === 'produccion' || role.id === 'diseno') {
        for (const t of role.tareas) addItem(role.id, role.label, t);
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
            for (const t of gestor.tareas) addItem(gestor.id, gestor.label, t);
          }
          addItem('gestor_canales', 'Gestor de canales',
            `Configurar envío por ${row.canal}${ref ? ` — ${ref}` : ''}`);
          addItem('copy', 'Copy',
            `Redactar copy para ${row.canal}${row.copy ? ` — ${row.copy}` : ''}`);
          const copyRole = roles.find((r) => r.id === 'copy');
          if (copyRole) {
            for (const t of copyRole.tareas) addItem(copyRole.id, copyRole.label, t);
          }
          break;
        }
        case 'Meta Ads': {
          addItem('social', 'Social Media',
            `Configurar campaña en Meta Ads${row.copy ? ` — ${row.copy}` : ''}`);
          const socialRole = roles.find((r) => r.id === 'social');
          if (socialRole) {
            for (const t of socialRole.tareas) addItem(socialRole.id, socialRole.label, t);
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
            for (const t of copyRole.tareas) addItem(copyRole.id, copyRole.label, t);
          }
          const estRole = roles.find((r) => r.id === 'estratega');
          if (estRole) {
            for (const t of estRole.tareas) addItem(estRole.id, estRole.label, t);
          }
          break;
        }
        case 'RRSS': {
          addItem('social', 'Social Media',
            `Plan de contenido para RRSS${row.copy ? ` — ${row.copy}` : ''}`);
          const socialRole = roles.find((r) => r.id === 'social');
          if (socialRole) {
            for (const t of socialRole.tareas) addItem(socialRole.id, socialRole.label, t);
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
      // Solo incluimos roles que participan via canals/loops
      const involvedInCanal = canales.some(
        (c) => canalInvolvesRole(c.canal, role.id)
      );
      const involvedInLoop = loops.some((l) => l.responsable === role.label);
      if (involvedInCanal || involvedInLoop) {
        for (const t of role.tareas) addItem(role.id, role.label, t);
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

  // Rebuild when canales or loops change
  useEffect(() => {
    if (canalesRows.length > 0 || loopsRows.some((l) => l.responsable)) {
      setFabricaBriefs(buildFabricaBriefs(canalesRows, loopsRows));
    } else {
      setFabricaBriefs([]);
    }
  }, [canalesRows, loopsRows]);

  const toggleFabricaBrief = (id: string) =>
    setFabricaBriefs((prev) => prev.map((b) => (b.id === id ? { ...b, checked: !b.checked } : b)));

  const updateFabricaLoop = (id: string, field: string, value: string) =>
    setFabricaBriefs((prev) => prev.map((b) => (b.id === id ? { ...b, [field]: value } : b)));

  const close = () => {
    onOpenChange(false);
    if (!isEditing) setTimeout(reset, 300);
  };

  const canNext = step === 0 ? data.name.trim().length > 0 : true;
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
      });
      onCreated(editProject.id);
      close();
      return;
    }
    const id = addProject({
      name: data.name.trim(),
      description: data.description.trim(),
      client: data.client.trim(),
      state: data.state,
      priority: data.priority,
      startDate: data.startDate || null,
      dueDate: data.dueDate || null,
      strategistName: data.strategistName.trim(),
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
                <Textarea
                  rows={3}
                  placeholder="Objetivo, alcance, contexto…"
                  value={data.description}
                  onChange={(e) => setData((d) => ({ ...d, description: e.target.value }))}
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
              <div className="grid grid-cols-3 gap-3">
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
                  {[
                    { id: 'afiliado', label: 'Afiliado activo' },
                    { id: 'matriculado', label: 'Matriculado' },
                    { id: 'potencial', label: 'Potencial' },
                    { id: 'no_renovado', label: 'No renovado' },
                    { id: 'vip', label: 'VIP / Alta dirección' },
                    { id: 'cluster', label: 'Cluster sectorial' },
                    { id: 'mercado_medio', label: 'Mercado medio' },
                  ].map((seg) => {
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
                  <div className="grid grid-cols-[100px_minmax(50px,70px)_1fr_minmax(80px,100px)] gap-2 px-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Canal</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span className="hidden sm:inline">Día</span>
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Copy / Ángulo del toque</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Segmento</span>
                  </div>
                  {canalesRows.map((row) => (
                    <div key={row.id} className="grid grid-cols-[100px_minmax(50px,70px)_1fr_minmax(80px,100px)_24px] gap-2 items-center rounded-lg border border-border/60 bg-card p-2">
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
                      <select
                        value={row.segmento}
                        onChange={(e) => updateCanalRow(row.id, 'segmento', e.target.value)}
                        className="text-xs bg-transparent border-none outline-none w-full text-left cursor-pointer"
                      >
                        <option value="">Segmento</option>
                        {audiencia.segmentos.map((segId) => (
                          <option key={segId} value={segId}>
                            {SEGMENTOS_LABEL[segId] ?? segId}
                          </option>
                        ))}
                      </select>
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
                            <input
                              placeholder="Ej: Abrió correo pero no hizo clic"
                              value={row.disparador}
                              onChange={(e) => updateLoopRow(row.id, 'disparador', e.target.value)}
                              className="w-full bg-transparent border-none outline-none text-xs py-1"
                            />
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
                          <div className="space-y-2">
                            {items.map((item) => (
                              <div key={item.id}>
                                <label className="flex items-start gap-2.5 p-1.5 rounded-md hover:bg-muted/40 cursor-pointer transition-colors">
                                  <input
                                    type="checkbox"
                                    checked={item.checked}
                                    onChange={() => toggleFabricaBrief(item.id)}
                                    className="mt-0.5 h-4 w-4 rounded border-muted-foreground text-factory focus:ring-factory"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <span className={`text-sm ${item.checked ? 'line-through text-muted-foreground' : ''}`}>
                                      {item.tarea}
                                    </span>
                                  </div>
                                </label>

                                {/* ─── Loop strategy form (visible when activated) ─── */}
                                {item.checked && (
                                  <div className="ml-7 mt-1 mb-2 p-3 rounded-md bg-muted/30 border border-border/40 space-y-2">
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                      Estrategia de mejora continua
                                    </p>
                                    <div className="grid grid-cols-3 gap-2">
                                      <div className="space-y-0.5">
                                        <Label className="text-[10px] text-muted-foreground">Métrica / KPI</Label>
                                        <Input
                                          placeholder="Ej: Tasa de apertura"
                                          value={item.metrica ?? ''}
                                          onChange={(e) => updateFabricaLoop(item.id, 'metrica', e.target.value)}
                                          className="h-7 text-xs"
                                        />
                                      </div>
                                      <div className="space-y-0.5">
                                        <Label className="text-[10px] text-muted-foreground">Línea base</Label>
                                        <Input
                                          placeholder="Ej: 15%"
                                          value={item.lineaBase ?? ''}
                                          onChange={(e) => updateFabricaLoop(item.id, 'lineaBase', e.target.value)}
                                          className="h-7 text-xs"
                                        />
                                      </div>
                                      <div className="space-y-0.5">
                                        <Label className="text-[10px] text-muted-foreground">Objetivo</Label>
                                        <Input
                                          placeholder="Ej: 25%"
                                          value={item.objetivo ?? ''}
                                          onChange={(e) => updateFabricaLoop(item.id, 'objetivo', e.target.value)}
                                          className="h-7 text-xs"
                                        />
                                      </div>
                                    </div>
                                    <div className="space-y-0.5">
                                      <Label className="text-[10px] text-muted-foreground">Estrategia de mejora</Label>
                                      <Input
                                        placeholder="¿Qué vamos a hacer para mejorar este indicador?"
                                        value={item.mejora ?? ''}
                                        onChange={(e) => updateFabricaLoop(item.id, 'mejora', e.target.value)}
                                        className="h-7 text-xs"
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                )}
              </div>
              <div className="border-t pt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {fabricaBriefs.filter((b) => b.checked).length} de {fabricaBriefs.length} activaciones confirmadas
                </span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex sm:justify-between gap-2 border-t pt-3">
          <Button variant="outline" onClick={() => step === 0 ? close() : setStep((s) => s - 1)}>
            {step === 0 ? 'Cancelar' : (<><ChevronLeft className="h-4 w-4" /> Atrás</>)}
          </Button>
          {isLast ? (
            <Button className="bg-gradient-factory text-factory-foreground shadow-glow" onClick={handleCreate} disabled={!data.name.trim()}>
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
