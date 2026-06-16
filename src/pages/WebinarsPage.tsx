import { useEffect, useState, useCallback } from 'react';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, ExternalLink, Copy, Send } from 'lucide-react';
import { toast } from 'sonner';

type ActiveTab = 'webinars' | 'proyectos';

const WEBINARS_URL = 'https://n8n.camarabaq.org.co/webhook/webinars';
const PROYECTOS_URL = 'https://n8n.camarabaq.org.co/webhook/proyectos_eventos';
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

type ProyectoItem = {
  titulo: string;
  tipo: string;
  inscritos: number;
  link: string;
  has_link: boolean;
};

type WebinarsData = {
  success?: boolean;
  total?: number;
  updated_at?: string;
  webinars?: Webinar[];
};

type ProyectosData = {
  success?: boolean;
  total?: number;
  updated_at?: string;
  eventos?: ProyectoItem[];
  proyectos?: ProyectoItem[];
  sin_clasificar?: ProyectoItem[];
};

const cardStyle: React.CSSProperties = {
  border: '1px solid rgba(255,255,255,.10)',
  borderRadius: 16,
  padding: 14,
  color: '#EAF1FF',
  background:
    'radial-gradient(900px 260px at 12% -40%, rgba(77,163,255,.16), transparent 55%), linear-gradient(180deg, #0F1729, #0B1324 55%, #080F1E)',
  boxShadow: '0 18px 45px rgba(3, 8, 20, .22), inset 0 1px 0 rgba(255,255,255,.04)',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
};

const kvStyle: React.CSSProperties = {
  border: '1px solid rgba(255,255,255,.07)',
  background: 'rgba(255,255,255,.04)',
  borderRadius: 12,
  padding: 10,
};

const pillStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: '#d7e6ff',
  background: 'rgba(77,163,255,.12)',
  border: '1px solid rgba(77,163,255,.22)',
  padding: '6px 10px',
  borderRadius: 999,
  whiteSpace: 'nowrap',
};

const primaryBtn: React.CSSProperties = {
  cursor: 'pointer',
  border: 'none',
  borderRadius: 10,
  padding: '8px 10px',
  fontWeight: 600,
  fontSize: 12,
  background: 'linear-gradient(135deg, rgba(77,163,255,.95), rgba(47,124,255,.95))',
  color: 'white',
  boxShadow: '0 12px 26px rgba(47,124,255,.18)',
  textDecoration: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  width: '100%',
};

const secondaryBtn: React.CSSProperties = {
  ...primaryBtn,
  background: 'rgba(255,255,255,.08)',
  border: '1px solid rgba(255,255,255,.16)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,.04)',
  color: '#EAF1FF',
};

const WebinarsPage = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('webinars');
  const [isLoading, setIsLoading] = useState(true);
  const [webinarsData, setWebinarsData] = useState<WebinarsData | null>(null);
  const [proyectosData, setProyectosData] = useState<ProyectosData | null>(null);
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

  const fetchProyectos = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(PROYECTOS_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const payload: ProyectosData = Array.isArray(json) ? json[0] : json;
      setProyectosData(payload || {});
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'webinars') fetchWebinars();
    else fetchProyectos();
  }, [activeTab, fetchWebinars, fetchProyectos]);

  const handleRefresh = () => {
    if (activeTab === 'webinars') fetchWebinars();
    else fetchProyectos();
  };

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

  const renderProyectoTable = (title: string, items: ProyectoItem[]) => (
    <div className="mb-8">
      <h2 className="text-xl font-semibold text-foreground mb-3">{title}</h2>
      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-foreground text-background">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Título</th>
              <th className="text-center px-4 py-3 font-medium">Inscritos</th>
              <th className="text-left px-4 py-3 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={3} className="text-center text-muted-foreground italic py-6">
                  No hay registros disponibles
                </td>
              </tr>
            ) : (
              items.map((item, idx) => (
                <tr key={idx} className="border-b last:border-b-0 hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-3" style={{ overflowWrap: 'anywhere' }}>{item.titulo}</td>
                  <td className="px-4 py-3 text-center font-medium">{item.inscritos}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      {item.has_link && item.link ? (
                        <>
                          <a
                            href={item.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm font-semibold hover:opacity-90 transition-opacity"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Ver inscritos
                          </a>
                          <button
                            onClick={() => copyLink(item.link)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 bg-secondary text-secondary-foreground rounded-md text-sm font-medium hover:bg-secondary/80 transition-colors border border-border"
                          >
                            <Copy className="h-3.5 w-3.5" />
                            Copiar link
                          </button>
                        </>
                      ) : (
                        <span className="text-muted-foreground text-sm italic">Sin link</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const webinars = webinarsData?.webinars || [];

  return (
    <Layout>
      <div className="p-6 h-full flex flex-col">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-foreground">Seguimiento de eventos</h1>
        </div>

        <div className="mb-4 flex gap-2 flex-wrap">
          <Button
            variant={activeTab === 'webinars' ? 'default' : 'outline'}
            onClick={() => setActiveTab('webinars')}
          >
            Webinars
          </Button>
          <Button
            variant={activeTab === 'proyectos' ? 'default' : 'outline'}
            onClick={() => setActiveTab('proyectos')}
          >
            Proyectos y eventos
          </Button>
          <Button variant="outline" onClick={handleRefresh} disabled={isLoading}>
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
          ) : activeTab === 'webinars' ? (
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
                          <div style={{ color: '#B8C6E6', fontSize: 10, letterSpacing: '.5px', textTransform: 'uppercase', marginBottom: 4 }}>
                            Fecha inicio
                          </div>
                          <div style={{ fontSize: 12, fontFamily: 'ui-monospace,Consolas,monospace' }}>
                            {w.fecha_inicio_formateada || w.fecha_inicio || '-'}
                          </div>
                        </div>
                        <div style={kvStyle}>
                          <div style={{ color: '#B8C6E6', fontSize: 10, letterSpacing: '.5px', textTransform: 'uppercase', marginBottom: 4 }}>
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
                          <span style={{ color: '#B8C6E6', fontSize: 12, fontStyle: 'italic' }}>Sin link</span>
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
          ) : proyectosData ? (
            <>
              {proyectosData.updated_at && (
                <p className="text-xs text-muted-foreground mb-4">
                  Actualizado: {new Date(proyectosData.updated_at).toLocaleString('es-CO')}
                </p>
              )}
              {renderProyectoTable('Eventos', proyectosData.eventos || [])}
              {renderProyectoTable('Proyectos', proyectosData.proyectos || [])}
              {proyectosData.sin_clasificar && proyectosData.sin_clasificar.length > 0 &&
                renderProyectoTable('Sin clasificar', proyectosData.sin_clasificar)}
            </>
          ) : null}
        </div>
      </div>
    </Layout>
  );
};

export default WebinarsPage;
