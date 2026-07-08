import { BriefWorkflowStatus, FabricaBriefItem } from '@/store/factoryStore';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { FileText, Link2, MessageSquare } from 'lucide-react';

export const BRIEF_STATUS_META: Record<BriefWorkflowStatus, { label: string; cls: string }> = {
  pending: { label: 'Pendiente', cls: 'bg-muted text-muted-foreground' },
  in_review: { label: 'En revisión', cls: 'bg-state-review-bg text-state-review' },
  completed: { label: 'Completado', cls: 'bg-state-done-bg text-state-done' },
};

export function getBriefStatus(brief: FabricaBriefItem): BriefWorkflowStatus {
  if (brief.workflowStatus) return brief.workflowStatus;
  if (brief.deliverableSubmittedAt || brief.checked) return 'completed';
  return 'pending';
}

export function BriefStatusBadge({ brief, className }: { brief: FabricaBriefItem; className?: string }) {
  const meta = BRIEF_STATUS_META[getBriefStatus(brief)];
  return (
    <Badge variant="outline" className={cn('border-0 text-[10px] px-1.5 h-4', meta.cls, className)}>
      {meta.label}
    </Badge>
  );
}

const formatDateTime = (iso?: string | null) => {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-CO', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

export const isCanalBrief = (tarea: string) => tarea.startsWith('Configurar envío por');
export const isMetricsBrief = (tarea: string) => tarea.startsWith('Recolectar métricas de');
export const isUrlBrief = (tarea: string) => tarea.includes('Landing') || tarea.includes('Formulario de inscripción');

/** Vista de solo lectura de un entregable — usada en Equipo y en los paneles de Construir estrategia. */
export const DeliverableSummary = ({ brief }: { brief: FabricaBriefItem }) => {
  const comments = brief.comments ?? [];
  const attachments = brief.deliverableAttachments ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <BriefStatusBadge brief={brief} />
        {brief.deliverableSubmittedAt && (
          <span className="text-[11px] text-muted-foreground">
            Actualizado {formatDateTime(brief.deliverableSubmittedAt)}
          </span>
        )}
      </div>

      {brief.briefNotes && (
        <div className="rounded-lg border border-border/60 bg-muted/30 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Campos adicionales</p>
          <p className="text-sm text-foreground/80 whitespace-pre-wrap">{brief.briefNotes}</p>
        </div>
      )}

      {isCanalBrief(brief.tarea) ? (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Estado del envío</p>
          {brief.deliverableEnviado === true && (
            <Badge variant="outline" className="border-0 bg-state-done-bg text-state-done">Enviado</Badge>
          )}
          {brief.deliverableEnviado === false && (
            <div className="space-y-1.5">
              <Badge variant="outline" className="border-0 bg-state-blocked-bg text-state-blocked">No enviado</Badge>
              {brief.deliverableMotivoNoEnvio && (
                <p className="text-sm text-foreground/80 whitespace-pre-wrap">{brief.deliverableMotivoNoEnvio}</p>
              )}
            </div>
          )}
          {brief.deliverableEnviado == null && (
            <p className="text-sm text-muted-foreground italic">Aún sin definir</p>
          )}
        </div>
      ) : isMetricsBrief(brief.tarea) ? (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Métricas del envío</p>
          {brief.deliverableMetricas && Object.keys(brief.deliverableMetricas).length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(brief.deliverableMetricas).map(([key, value]) => (
                <div key={key} className="rounded-md border border-border/60 px-3 py-2">
                  <p className="text-[10px] text-muted-foreground uppercase">{key}</p>
                  <p className="text-sm font-semibold">{value || '—'}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">Sin métricas registradas</p>
          )}
        </div>
      ) : isUrlBrief(brief.tarea) ? (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">URL del entregable</p>
          {brief.deliverableContent ? (
            <a
              href={brief.deliverableContent}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-factory hover:underline flex items-center gap-1.5 break-all"
            >
              <Link2 className="h-3.5 w-3.5 shrink-0" />
              {brief.deliverableContent}
            </a>
          ) : (
            <p className="text-sm text-muted-foreground italic">Sin URL registrada</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Contenido</p>
            {brief.deliverableContent ? (
              <div
                className="prose prose-sm max-w-none rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-foreground/90"
                dangerouslySetInnerHTML={{ __html: brief.deliverableContent }}
              />
            ) : (
              <p className="text-sm text-muted-foreground italic">Sin contenido todavía</p>
            )}
          </div>

          {attachments.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Adjuntos</p>
              <div className="space-y-1.5">
                {attachments.map((a, i) => (
                  <a
                    key={a.id ?? i}
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 rounded-md border border-border/50 bg-muted/30 px-2.5 py-1.5 text-xs hover:bg-muted/50 transition-colors"
                  >
                    <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{a.name}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {(comments.length > 0 || brief.comentarios) && (
        <div className="space-y-1.5 border-t border-border/40 pt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <MessageSquare className="h-3 w-3" /> Comentarios
          </p>
          <div className="space-y-2">
            {comments.map((c) => (
              <div
                key={c.id}
                className={cn(
                  'rounded-md px-3 py-2 text-sm',
                  c.isAdjustmentRequest ? 'bg-state-blocked-bg/60 text-foreground' : 'bg-muted/30 text-foreground/90',
                )}
              >
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span className="text-[10px] font-semibold text-muted-foreground">
                    {c.author}{c.isAdjustmentRequest ? ' · corrección' : ''}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{formatDateTime(c.createdAt)}</span>
                </div>
                <p className="whitespace-pre-wrap">{c.content}</p>
              </div>
            ))}
            {comments.length === 0 && brief.comentarios && (
              <p className="text-sm text-foreground/80 whitespace-pre-wrap">{brief.comentarios}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
