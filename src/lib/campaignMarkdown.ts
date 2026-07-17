/**
 * Exporta una campaña completa a Markdown: todo lo capturado en el wizard y todo lo que
 * pasó después en Flujo de trabajo (entregables, aprobaciones, historial de comentarios).
 *
 * Criterio: lo que está vacío no se imprime. Un documento lleno de "—" es ruido; si una
 * sección no aparece es porque no hay nada que contar de ella.
 */
import type {
  FactoryProject,
  FabricaBriefItem,
  CanalRow,
  LoopRow,
  EtapaCiclo,
} from '@/store/factoryStore';
import { calcularUrgencia } from '@/lib/urgencia';

const STATE_LABEL: Record<string, string> = {
  planning: 'En planeación',
  in_progress: 'En proceso',
  done: 'Hecho',
  cancelled: 'Cancelado',
};

const PRIORITY_LABEL: Record<string, string> = { P0: 'Crítica', P1: 'Alta', P2: 'Media' };

const WORKFLOW_LABEL: Record<string, string> = {
  pending: 'Pendiente',
  in_review: 'En revisión',
  completed: 'Completado',
};

/** El contenido de los entregables es HTML del editor: acá se aplana a texto legible. */
const htmlAText = (html: string): string => {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  // Los <li> pierden su viñeta al usar textContent: se marcan antes de aplanar.
  doc.querySelectorAll('li').forEach((li) => li.replaceWith(`- ${li.textContent?.trim() ?? ''}\n`));
  doc.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
  doc.querySelectorAll('p, div, h1, h2, h3').forEach((p) => p.append('\n'));
  return (doc.body.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim();
};

const fecha = (iso?: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
};

const fechaHora = (iso?: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('es-CO', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

/** Escapa los pipes o romperían la tabla de Markdown en la que van. */
const celda = (v?: string | null): string => (v ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ') || '—';

const estadoDe = (b: FabricaBriefItem): string => {
  if (b.workflowStatus) return WORKFLOW_LABEL[b.workflowStatus] ?? b.workflowStatus;
  if (b.deliverableSubmittedAt) return 'En revisión';
  return b.checked ? 'Completado' : 'Pendiente';
};

export function campaignToMarkdown(project: FactoryProject): string {
  const L: string[] = [];
  const add = (...lineas: string[]) => L.push(...lineas);
  const seccion = (titulo: string) => add('', `## ${titulo}`, '');

  // ── Encabezado ──
  add(`# ${project.name || 'Campaña sin nombre'}`, '');
  // La descripción sale del editor enriquecido: es HTML, hay que aplanarla como los entregables.
  const desc = htmlAText(project.description);
  if (desc) add(desc, '');

  const ficha: string[] = [];
  const dato = (k: string, v?: string | null) => v && ficha.push(`| **${k}** | ${celda(v)} |`);
  dato('Estado', STATE_LABEL[project.state] ?? project.state);
  dato('Prioridad', PRIORITY_LABEL[project.priority] ?? project.priority);
  dato('Estratega', project.strategistName);
  dato('Cliente', project.client);
  dato('Inicio', fecha(project.startDate));
  dato('Entrega', fecha(project.dueDate));
  dato('Creada', fecha(project.createdAt));
  dato('Categoría del evento', project.eventCategory);
  dato('Link del segmento', project.segmentLink);
  if (project.promocionarEn?.length) dato('Promocionar en', project.promocionarEn.join(', '));
  if (project.requerimientos?.length) dato('Requerimientos', project.requerimientos.join(', '));
  if (ficha.length) add('| | |', '|---|---|', ...ficha);

  // ── Audiencia y narrativa ──
  const an = project.audienciaNarrativa;
  const narrativa: Array<[string, string | undefined]> = [
    ['Segmentos', an?.segmentos?.join(', ')],
    ['Meta de inscripciones', an?.metaInscripciones],
    ['Dolor', an?.dolor],
    ['Promesa', an?.promesa],
    ['Big idea', an?.bigIdea],
  ];
  if (narrativa.some(([, v]) => v)) {
    seccion('Audiencia y narrativa');
    for (const [k, v] of narrativa) if (v) add(`**${k}:** ${v}`, '');
  }

  // ── Base del mensaje (ELMR) ──
  const mb = project.mensajeBase;
  const elmr: Array<[string, string | undefined]> = [
    ['Emoción', mb?.emocion], ['Lógica', mb?.logica],
    ['Motivación', mb?.motivacion], ['Recompensa', mb?.recompensa],
  ];
  if (elmr.some(([, v]) => v)) {
    seccion('Base del mensaje (ELMR)');
    for (const [k, v] of elmr) if (v) add(`**${k}:** ${v}`, '');
  }

  // ── Motor del proceso ──
  if (project.motor?.fuenteValidacion) {
    seccion('Motor del proceso');
    add(`**Fuente de validación (CRM):** ${project.motor.fuenteValidacion}`, '');
  }

  // ── Formulario ──
  const fc = project.formularioConfig;
  if (fc && (fc.basico !== null || fc.camposAdicionales || fc.cuadroTexto)) {
    seccion('Formulario de inscripción');
    if (fc.basico !== null) add(`**Formulario básico:** ${fc.basico ? 'Sí' : 'No'}`, '');
    if (fc.camposAdicionales) add(`**Campos adicionales:** ${fc.camposAdicionales}`, '');
    if (fc.cuadroTexto) add(`**Notas:** ${fc.cuadroTexto}`, '');
  }

  // ── Ecosistema cíclico ──
  const etapaNombre = (id?: string) =>
    project.etapas?.find((e: EtapaCiclo) => e.id === id)?.nombre ?? '';

  if (project.etapas?.length) {
    seccion('Ecosistema cíclico');
    for (const e of [...project.etapas].sort((a, b) => a.orden - b.orden)) {
      const toques = project.canales.filter((c) => c.etapaId === e.id).length;
      const loops = project.loops.filter((l) => l.etapaId === e.id).length;
      add(`### ${e.orden + 1}. ${e.nombre}`, '');
      if (e.objetivo) add(e.objetivo, '');
      add(`_${toques} toque${toques !== 1 ? 's' : ''} · ${loops} loop${loops !== 1 ? 's' : ''}_`, '');
    }
  }

  // ── Plan de canales ──
  if (project.canales?.length) {
    seccion('Plan de canales');
    add('| Canal | Día | Hora | Ángulo | Segmento | Etapa |', '|---|---|---|---|---|---|');
    for (const c of project.canales as CanalRow[]) {
      add(`| ${celda(c.canal)} | ${celda(c.dia)} | ${celda(c.hora)} | ${celda(c.copy)} | ${celda(c.segmento)} | ${celda(etapaNombre(c.etapaId))} |`);
    }
    add('');
  }

  // ── Loops ──
  if (project.loops?.length) {
    seccion('Loops de comportamiento');
    add('| Disparador | Reacción | Responsable | Etapa | Lleva a |', '|---|---|---|---|---|');
    for (const l of project.loops as LoopRow[]) {
      add(`| ${celda(l.disparador)} | ${celda(l.reaccion)} | ${celda(l.responsable)} | ${celda(etapaNombre(l.etapaId))} | ${celda(etapaNombre(l.siguienteEtapaId))} |`);
    }
    add('');
  }

  // ── Equipo ──
  if (project.roleGroups?.some((g) => g.members.length)) {
    seccion('Equipo');
    for (const g of project.roleGroups) {
      if (!g.members.length) continue;
      add(`- **${g.roleLabel}:** ${g.members.map((m) => m.name).join(', ')}`);
    }
    add('');
  }

  // ── Flujo de trabajo: los nodos y sus tareas ──
  if (project.strategyNodes?.length) {
    seccion('Flujo de trabajo');
    const nodo = (id?: string | null) => project.strategyNodes.find((n) => n.id === id);
    for (const n of project.strategyNodes) {
      const depende = (n.dependsOn ?? []).map((d) => nodo(d)?.label).filter(Boolean);
      add(
        `- **${n.label}**${n.roleLabel ? ` — ${n.roleLabel}` : ''}` +
          `${n.memberName ? ` (${n.memberName})` : ''}` +
          `${depende.length ? ` · depende de: ${depende.join(', ')}` : ''}`
      );
    }
    add('');
  }

  // ── Acciones / entregables: el corazón del documento ──
  if (project.fabricaBriefs?.length) {
    seccion('Acciones y entregables');

    const porRol = new Map<string, FabricaBriefItem[]>();
    for (const b of project.fabricaBriefs) {
      const k = b.roleLabel || 'Sin rol';
      porRol.set(k, [...(porRol.get(k) ?? []), b]);
    }

    for (const [rol, items] of porRol) {
      add(`### ${rol}`, '');
      for (const b of items) {
        add(`#### ${b.tarea}`, '');

        const meta: string[] = [`**Estado:** ${estadoDe(b)}`];
        if (b.fechaAccion) {
          const u = calcularUrgencia(b.fechaAccion);
          meta.push(`**Fecha de la acción:** ${b.fechaAccion}${u ? ` (${u.etiqueta})` : ''}`);
        }
        if (b.deliverableSubmittedAt) meta.push(`**Enviado a revisión:** ${fechaHora(b.deliverableSubmittedAt)}`);
        add(meta.join(' · '), '');

        if (b.briefNotes) add(`**Contexto:** ${b.briefNotes}`, '');

        // Estrategia de loop
        const loop: Array<[string, string | undefined]> = [
          ['Métrica', b.metrica], ['Línea base', b.lineaBase],
          ['Objetivo', b.objetivo], ['Mejora', b.mejora],
        ];
        if (loop.some(([, v]) => v)) {
          add(loop.filter(([, v]) => v).map(([k, v]) => `**${k}:** ${v}`).join(' · '), '');
        }

        if (b.deliverableContent) {
          const texto = htmlAText(b.deliverableContent);
          if (texto) add('**Entregable:**', '', texto, '');
        }

        if (b.deliverableAttachments?.length) {
          add(`**Adjuntos:** ${b.deliverableAttachments.map((a) => a.name).join(', ')}`, '');
        }

        // Registros específicos por tipo de entregable
        if (b.deliverableEnviado != null) add(`**¿Enviado?:** ${b.deliverableEnviado ? 'Sí' : 'No'}`, '');
        if (b.deliverableMotivoNoEnvio) add(`**Motivo de no envío:** ${b.deliverableMotivoNoEnvio}`, '');
        if (b.deliverableDone != null) add(`**¿Se realizó?:** ${b.deliverableDone ? 'Sí' : 'No'}`, '');
        if (b.deliverableDate) add(`**Fecha de realización:** ${b.deliverableDate}`, '');
        if (b.deliverablePublicada != null) add(`**¿Publicada?:** ${b.deliverablePublicada ? 'Sí' : 'No'}`, '');

        const metricas = Object.entries(b.deliverableMetricas ?? {}).filter(([, v]) => v);
        if (metricas.length) {
          add('**Métricas registradas:**', '');
          for (const [k, v] of metricas) add(`- ${k}: ${v}`);
          add('');
        }

        // Historial: incluye los eventos de sistema (envío/aprobación) con su fecha.
        if (b.comments?.length) {
          add('**Historial:**', '');
          for (const c of b.comments) {
            const tipo = c.isAdjustmentRequest ? ' · corrección' : c.isSystemEvent ? '' : '';
            add(`- _${fechaHora(c.createdAt)}_ — **${c.author}**${tipo}: ${htmlAText(c.content) || c.content}`);
          }
          add('');
        }
      }
    }
  }

  // ── Adjuntos de la campaña ──
  if (project.attachments?.length) {
    seccion('Adjuntos de la campaña');
    // Solo el nombre: el contenido es base64 y no tiene sentido en un .md.
    for (const a of project.attachments) add(`- ${a.name}`);
    add('');
  }

  add('', '---', `_Exportado desde Tremu el ${fechaHora(new Date().toISOString())}_`);

  return L.join('\n');
}

/** Nombre de archivo seguro a partir del nombre de la campaña. */
export function markdownFileName(project: FactoryProject): string {
  const base =
    (project.name || 'campana')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'campana';
  return `${base}.md`;
}
