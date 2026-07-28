import { useEffect, useState, useCallback } from 'react';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, ExternalLink, Copy, Send } from 'lucide-react';
import { toast } from 'sonner';

const WEBINARS_URL = 'https://n8n.camarabaq.org.co/webhook/webinars';
const REGISTROS_WEBHOOK = 'https://n8n.camarabaq.org.co/webhook/webinars_registros';

type Webinar = {
  id: number | string;
  titulo: string;
  fecha_inicio?: string;
  fecha_inicio_formateada?: string;
  inscritos: number;
  link: string;
  has_link: boolean;
  tipo?: string;
};

type WebinarsData = {
  success?: boolean;
  total?: number;
  updated_at?: string;
  webinars?: Webinar[];
};

const cardStyle: React.CSSProperties = {
  border: '1px solid hsl(var(--border))',
  borderRadius: 14,
  padding: 14,
  color: 'hsl(var(--foreground))',
  background: 'hsl(var(--surface))',
  boxShadow: 'var(--shadow-card)',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
};

const kvStyle: React.CSSProperties = {
  border: '1px solid hsl(var(--border))',
  background: 'hsl(var(--surface-elevated))',
  borderRadius: 10,
  padding: 10,
};

const pillStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: 'hsl(var(--accent-foreground))',
  background: 'hsl(var(--accent))',
  border: '1px solid hsl(var(--accent))',
  padding: '6px 10px',
  borderRadius: 999,
  whiteSpace: 'nowrap',
};

const primaryBtn: React.CSSProperties = {
  cursor: 'pointer',
  border: 'none',
  borderRadius: 999,
  padding: '8px 14px',
  fontWeight: 600,
  fontSize: 12,
  background: 'hsl(var(--primary))',
  color: 'hsl(var(--primary-foreground))',
  boxShadow: 'var(--shadow-glow)',
  textDecoration: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  width: '100%',
};

const secondaryBtn: React.CSSProperties = {
  ...primaryBtn,
  background: 'hsl(var(--surface-elevated))',
  border: '1px solid hsl(var(--border))',
  boxShadow: 'none',
  color: 'hsl(var(--foreground))',
};

const WebinarsPage = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [webinarsData, setWebinarsData] = useState<WebinarsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualId, setManualId] = useState('');

  const fetchWebinars = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(WEBINARS_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const payload: WebinarsData = Array.isArray(json) ? json[0] : json;
      setWebinarsData(payload || {});
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWebinars();
  }, [fetchWebinars]);

  const copyLink = async (url: string) => {
    if (!url) {
      toast.error('No hay link para copiar');
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copiado');
    } catch {
      toast.error('No se pudo copiar el link');
    }
  };

  const sendManualId = async () => {
    const id = manualId.trim();
    if (!id) {
      toast.error('Escribe un ID primero');
      return;
    }
    const w = webinarsData?.webinars?.find((x) => String(x.id) === id);
    const topic = w?.titulo || '';
    try {
      await fetch(REGISTROS_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, topic }),
      });
      toast.success('Enviado: ' + (topic || '(sin evento)'));
      setManualId('');
    } catch {
      toast.error('Error enviando');
    }
  };

  const webinars = webinarsData?.webinars || [];

  return (
    <Layout>
      <div className="p-6 h-full flex flex-col">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-foreground">Seguimiento de eventos</h1>
        </div>

        <div className="mb-4 flex gap-2 flex-wrap">
          <Button variant="outline" onClick={fetchWebinars} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>

        <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Cargando...</p>
            </div>
          ) : error ? (
            <div className="text-center py-16 text-destructive">
              Error al cargar los datos: {error}
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center mb-3">
                <p className="text-sm text-muted-foreground">
                  Se muestran {webinars.length} evento(s)
                </p>
                {webinarsData?.updated_at && (
                  <p className="text-xs text-muted-foreground">
                    Actualizado: {new Date(webinarsData.updated_at).toLocaleString('es-CO')}
                  </p>
                )}
              </div>

              {webinars.length === 0 ? (
                <div className="text-center text-muted-foreground py-10">
                  No hay webinars para mostrar.
                </div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: 14,
                  }}
                >
                  {webinars.map((w) => (
                    <article key={w.id} style={cardStyle}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, lineHeight: 1.3, overflowWrap: 'anywhere' }}>
                          {w.titulo}
                        </h3>
                        <span style={pillStyle}>
                          ID: <span style={{ fontFamily: 'ui-monospace,Consolas,monospace' }}>{w.id}</span>
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div style={kvStyle}>
                          <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 10, letterSpacing: '.5px', textTransform: 'uppercase', marginBottom: 4 }}>
                            Fecha inicio
                          </div>
                          <div style={{ fontSize: 12, fontFamily: 'ui-monospace,Consolas,monospace' }}>
                            {w.fecha_inicio_formateada || w.fecha_inicio || '-'}
                          </div>
                        </div>
                        <div style={kvStyle}>
                          <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 10, letterSpacing: '.5px', textTransform: 'uppercase', marginBottom: 4 }}>
                            Inscritos
                          </div>
                          <div style={{ fontSize: 12, fontFamily: 'ui-monospace,Consolas,monospace' }}>
                            {w.inscritos ?? 0}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gap: 10 }}>
                        {w.has_link && w.link ? (
                          <>
                            <a href={w.link} target="_blank" rel="noopener noreferrer" style={primaryBtn}>
                              <ExternalLink className="h-4 w-4" />
                              Abrir link de inscripción
                            </a>
                            <button type="button" style={secondaryBtn} onClick={() => copyLink(w.link)}>
                              <Copy className="h-4 w-4" />
                              Copiar link de registro
                            </button>
                          </>
                        ) : (
                          <span style={{ color: 'hsl(var(--muted-foreground))', fontSize: 12, fontStyle: 'italic' }}>Sin link</span>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}

              <div className="mt-6 flex gap-2 justify-end items-center flex-wrap">
                <input
                  value={manualId}
                  onChange={(e) => setManualId(e.target.value)}
                  type="text"
                  placeholder="Escribe el ID del webinar..."
                  className="px-3 py-2 rounded-md border border-input bg-background text-sm min-w-[220px]"
                />
                <Button onClick={sendManualId}>
                  <Send className="h-4 w-4 mr-2" />
                  Enviar ID + Evento
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default WebinarsPage;
