import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const WEBHOOK_URL = 'https://n8n.camarabaq.org.co/webhook/notifiacionemail';
const VALID_ACTIONS = new Set(['tarea creada', 'enviar a revisión', 'solicitud de ajuste']);

type WebhookPayload = {
  correo_creador: string;
  nombre_creador: string;
  correo_encargado: string;
  nombre_encargado: string;
  rol_encargado: 'copy' | 'diseñador';
  accion: string;
  nota_ajuste: string;
  tarea: {
    titulo: string;
    descripcion: string;
    fecha_creacion: string;
    fecha_limite: string;
    tablero: string;
  };
};

const validatePayload = (payload: any): { valid: boolean; reason?: string } => {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, reason: 'payload no es un objeto' };
  }

  const rootKeys = [
    'correo_creador',
    'nombre_creador',
    'correo_encargado',
    'nombre_encargado',
    'rol_encargado',
    'accion',
    'nota_ajuste',
    'tarea',
  ];

  for (const key of rootKeys) {
    if (!(key in payload)) {
      return { valid: false, reason: `falta key ${key}` };
    }
  }

  if (!VALID_ACTIONS.has(payload.accion)) {
    return { valid: false, reason: `accion invalida: ${payload.accion}` };
  }

  if (!payload.tarea || typeof payload.tarea !== 'object') {
    return { valid: false, reason: 'tarea invalida' };
  }

  const taskKeys = ['titulo', 'descripcion', 'fecha_creacion', 'fecha_limite', 'tablero'];
  for (const key of taskKeys) {
    if (!(key in payload.tarea)) {
      return { valid: false, reason: `falta tarea.${key}` };
    }
  }

  return { valid: true };
};

const maskEmail = (email: string) => {
  const [name, domain] = String(email || '').split('@');
  if (!name || !domain) return '***';
  return `${name.slice(0, 2)}***@${domain}`;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const requestBody = await req.json();
    const payload: WebhookPayload = requestBody?.payload ?? requestBody;
    const action = payload?.accion ?? requestBody?.action ?? 'unknown';
    const taskId = requestBody?.taskId ?? 'unknown';
    const boardId = requestBody?.boardId ?? payload?.tarea?.tablero ?? 'unknown';

    console.log('EDGE_RECEIVED', JSON.stringify({ action, taskId, boardId }));

    const validation = validatePayload(payload);
    if (!validation.valid) {
      console.error('EDGE_PAYLOAD_INVALID', validation.reason);
      return new Response(
        JSON.stringify({ success: false, error: validation.reason }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('EDGE_PAYLOAD_VALIDATED');
    console.log(
      'EDGE_POSTING_TO_WEBHOOK',
      JSON.stringify({
        action,
        taskId,
        boardId,
        correo_creador: maskEmail(payload.correo_creador),
        correo_encargado: maskEmail(payload.correo_encargado),
      })
    );

    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    const truncatedResponse = responseText.slice(0, 500);
    console.log('WEBHOOK_RESPONSE', JSON.stringify({ status: response.status, responseText: truncatedResponse }));

    return new Response(
      JSON.stringify({ success: response.ok, status: response.status, responseText: truncatedResponse }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: response.ok ? 200 : 502,
      }
    );
  } catch (error) {
    console.error('EDGE_UNHANDLED_ERROR', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'unknown_error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
