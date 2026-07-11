import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { AlertCircle, Check, Copy, Download, Loader2, QrCode } from 'lucide-react';

/**
 * Autocontenido: los campos del formulario viven acá (no hay un webhook de schema — n8n
 * solo expone el de envío). El componente solo hace POST de lo que el usuario llena y
 * pinta la respuesta; ninguna lógica de Bitly/QR vive acá.
 */
const SUBMIT_URL = 'https://n8n.camarabaq.org.co/webhook/crearlink';

type FieldType = 'text' | 'url';

interface FormField {
  name: string;
  label: string;
  type: FieldType;
  placeholder: string;
  required: boolean;
}

const FIELDS: FormField[] = [
  { name: 'link', label: 'Link a cortar', type: 'url', placeholder: 'https://tusitio.com/pagina', required: true },
  { name: 'titulo', label: 'Título (Así lo encontrarás en Bitly)', type: 'text', placeholder: 'Así lo encontrarás en Bitly', required: true },
  { name: 'utm_source', label: 'UTM Source (Opcional)', type: 'text', placeholder: 'Ej: facebook, google, newsletter', required: false },
  { name: 'utm_medium', label: 'UTM Medium (Opcional)', type: 'text', placeholder: 'Ej: cpc, social, email', required: false },
  { name: 'utm_campaign', label: 'UTM Campaign (Opcional)', type: 'text', placeholder: 'Ej: lanzamiento-2026', required: false },
  { name: 'utm_term', label: 'UTM Term (Opcional)', type: 'text', placeholder: 'Ej: palabra clave (Google Ads)', required: false },
];

interface BitlyResult {
  url: string;
  titulo?: string;
  qrUrl?: string;
  [key: string]: unknown;
}

type Status = 'idle' | 'form' | 'submitting' | 'error-submit' | 'success';
type QrStatus = 'idle' | 'downloading' | 'error';

// Design tokens Tremu ISO — superficie plana, acento sólido #009CF5, sin gradientes.
// Se mantienen locales al componente (inline styles); espejan la paleta global de index.css.
const T = {
  font: "'Plus Jakarta Sans', system-ui, sans-serif",
  bg: '#EEF1F7',
  cardBg: '#FFFFFF',
  cardBorder: '#ECEEF3',
  cardShadow: 'rgba(18, 20, 27, 0.06)',
  header: '#12141B',
  label: '#3B4150',
  inputBorder: '#ECEEF3',
  inputText: '#12141B',
  placeholder: '#8A90A0',
  focusBorder: '#009CF5',
  focusShadow: 'rgba(0, 156, 245, 0.20)',
  submitBg: '#009CF5',
  submitBgHover: '#0087D6',
  submitShadow: '0 1px 2px rgba(0, 156, 245, 0.18), 0 10px 26px rgba(0, 156, 245, 0.30)',
  accentWeak: '#E5F5FE',
  surfaceSoft: '#F7F8FB',
  required: '#EF4444',
  cardRadius: '22px',
  inputRadius: '14px',
} as const;

const isValidUrl = (value: string) => {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
};

const errorMessageFrom = (err: unknown, fallback: string) =>
  err instanceof Error && err.message ? err.message : fallback;

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'application/pdf': 'pdf',
};

/** El nombre de archivo sale del header `Content-Disposition` si n8n lo manda;
 *  si no, se arma uno genérico a partir del content-type de la respuesta. */
const filenameFromResponse = (res: Response): string => {
  const disposition = res.headers.get('Content-Disposition') ?? '';
  const match = disposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  if (match?.[1]) return decodeURIComponent(match[1]);

  const mime = (res.headers.get('Content-Type') ?? 'image/png').split(';')[0].trim();
  const ext = EXTENSION_BY_MIME[mime] ?? 'png';
  return `codigo-qr.${ext}`;
};

const emptyValues = (): Record<string, string> => {
  const values: Record<string, string> = {};
  for (const f of FIELDS) values[f.name] = '';
  return values;
};

const BitlyLinkTool = () => {
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [result, setResult] = useState<BitlyResult | null>(null);
  const [values, setValues] = useState<Record<string, string>>(emptyValues);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const [qrStatus, setQrStatus] = useState<QrStatus>('idle');
  const [qrError, setQrError] = useState('');
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
  }, []);

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    for (const field of FIELDS) {
      const raw = (values[field.name] ?? '').trim();
      if (field.required && !raw) {
        errors[field.name] = 'Este campo es obligatorio';
        continue;
      }
      if (raw && field.type === 'url' && !isValidUrl(raw)) {
        errors[field.name] = 'Ingresa una URL válida (con http:// o https://)';
      }
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setStatus('submitting');
    try {
      const res = await fetch(SUBMIT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error(`El servidor respondió con error ${res.status}`);
      const data = (await res.json()) as BitlyResult;
      if (!data || typeof data.url !== 'string') {
        throw new Error('La respuesta del servidor no incluyó un link válido');
      }
      setResult(data);
      setStatus('success');
    } catch (err) {
      setErrorMessage(errorMessageFrom(err, 'No se pudo generar el link. Intenta de nuevo.'));
      setStatus('error-submit');
    }
  };

  const resetForm = () => {
    setValues(emptyValues());
    setFieldErrors({});
    setCopied(false);
    setQrStatus('idle');
    setQrError('');
    setResult(null);
    setStatus('form');
  };

  const handleDownloadQr = async (qrUrl: string) => {
    setQrStatus('downloading');
    setQrError('');
    try {
      const res = await fetch(qrUrl);
      if (!res.ok) throw new Error(`El servidor respondió con error ${res.status}`);
      const blob = await res.blob();
      const filename = filenameFromResponse(res);
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
      setQrStatus('idle');
    } catch (err) {
      setQrError(errorMessageFrom(err, 'No se pudo descargar el código QR. Intenta de nuevo.'));
      setQrStatus('error');
    }
  };

  const handleCopy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API blocked (permisos/contexto inseguro) — no hay nada que recuperar acá.
    }
  };

  const cardStyle: CSSProperties = {
    fontFamily: T.font,
    background: T.cardBg,
    border: `1px solid ${T.cardBorder}`,
    borderRadius: T.cardRadius,
    boxShadow: `0 20px 45px -18px ${T.cardShadow}`,
  };

  return (
    <div
      className="flex h-full items-center justify-center overflow-y-auto px-3 py-3 sm:px-6"
      style={{ background: T.bg, fontFamily: T.font }}
    >
      <div className="w-full" style={{ maxWidth: 400 }}>
        {status === 'idle' && (
          <div className="p-5 sm:p-7 text-center" style={cardStyle}>
            <div
              className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full"
              style={{ background: T.accentWeak }}
            >
              <QrCode className="h-5 w-5" style={{ color: T.focusBorder }} />
            </div>
            <h1 className="mb-1.5 text-lg font-bold" style={{ color: T.header }}>
              Crear código QR con métricas de seguimiento
            </h1>
            <p className="mb-4 text-sm" style={{ color: T.label }}>
              Acorta un link, agrégale parámetros UTM para medirlo y descarga su código QR.
            </p>
            <PillButton onClick={() => setStatus('form')} icon={<QrCode className="h-4 w-4 shrink-0" />}>
              Crear QR con métricas de seguimiento (Utms)
            </PillButton>
          </div>
        )}

        {(status === 'form' || status === 'submitting' || status === 'error-submit') && (
          <div className="p-5 sm:p-6" style={cardStyle}>
            <h1 className="mb-4 text-lg font-bold" style={{ color: T.header }}>
              Crear código QR con métricas de seguimiento
            </h1>

            <form noValidate onSubmit={handleSubmit} className="space-y-3">
              {FIELDS.map((field) => (
                <FieldInput
                  key={field.name}
                  field={field}
                  value={values[field.name] ?? ''}
                  error={fieldErrors[field.name]}
                  disabled={status === 'submitting'}
                  onChange={(v) => setValues((prev) => ({ ...prev, [field.name]: v }))}
                />
              ))}

              {status === 'error-submit' && (
                <p className="flex items-center gap-1.5 text-xs" style={{ color: T.required }}>
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {errorMessage}
                </p>
              )}

              <SubmitButton submitting={status === 'submitting'} label="Generar link" />
            </form>
          </div>
        )}

        {status === 'success' && result && (
          <div className="p-5 sm:p-6 text-center" style={cardStyle}>
            <div
              className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full"
              style={{ background: T.accentWeak }}
            >
              <Check className="h-5 w-5" style={{ color: T.focusBorder }} />
            </div>
            <h1 className="mb-1 text-lg font-bold" style={{ color: T.header }}>Link generado</h1>
            {result.titulo && (
              <p className="mb-3 text-sm" style={{ color: T.label }}>{result.titulo}</p>
            )}

            <div
              className="mb-4 break-all px-3.5 py-2.5 text-sm font-medium"
              style={{
                background: T.surfaceSoft,
                border: `1px solid ${T.inputBorder}`,
                borderRadius: T.inputRadius,
                color: T.focusBorder,
              }}
            >
              {result.url}
            </div>

            <div className="flex flex-col gap-2">
              <PillButton onClick={() => handleCopy(result.url)} icon={copied ? <Check className="h-4 w-4 shrink-0" /> : <Copy className="h-4 w-4 shrink-0" />}>
                {copied ? '¡Link copiado!' : 'Copiar link'}
              </PillButton>

              {result.qrUrl && (
                <PillButton
                  variant="outline"
                  disabled={qrStatus === 'downloading'}
                  onClick={() => handleDownloadQr(result.qrUrl!)}
                  icon={qrStatus === 'downloading' ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <Download className="h-4 w-4 shrink-0" />}
                >
                  {qrStatus === 'downloading' ? 'Descargando…' : 'Descargar código QR'}
                </PillButton>
              )}

              {qrStatus === 'error' && (
                <p className="flex items-center justify-center gap-1.5 text-xs" style={{ color: T.required }}>
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {qrError}
                </p>
              )}

              <button
                type="button"
                onClick={resetForm}
                className="text-sm font-medium underline underline-offset-2"
                style={{ color: T.label }}
              >
                Generar otro link
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/** Botón píldora compartido — crece con el alto del contenido (padding en vez de height fijo)
 *  para que el ícono nunca quede fuera del botón cuando el texto envuelve a dos líneas. */
const PillButton = ({
  onClick, icon, children, variant = 'primary', disabled,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
  variant?: 'primary' | 'outline';
  disabled?: boolean;
}) => {
  const isPrimary = variant === 'primary';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex w-full items-center justify-center gap-2 text-center font-semibold leading-snug transition-transform disabled:cursor-not-allowed disabled:opacity-70"
      style={{
        borderRadius: 999,
        padding: '11px 20px',
        background: isPrimary ? T.submitBg : '#ffffff',
        color: isPrimary ? '#ffffff' : T.focusBorder,
        border: isPrimary ? 'none' : `1px solid ${T.inputBorder}`,
        boxShadow: isPrimary ? T.submitShadow : 'none',
        fontFamily: T.font,
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        if (isPrimary) e.currentTarget.style.background = T.submitBgHover;
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        if (isPrimary) e.currentTarget.style.background = T.submitBg;
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
};

const FieldInput = ({
  field,
  value,
  error,
  disabled,
  onChange,
}: {
  field: FormField;
  value: string;
  error?: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) => {
  const [focused, setFocused] = useState(false);

  const inputStyle: CSSProperties = {
    width: '100%',
    borderRadius: T.inputRadius,
    border: `1px solid ${error ? T.required : focused ? T.focusBorder : T.inputBorder}`,
    boxShadow: focused && !error ? `0 0 0 3px ${T.focusShadow}` : 'none',
    color: T.inputText,
    fontFamily: T.font,
    fontSize: 14,
    padding: '9px 12px',
    outline: 'none',
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
    background: disabled ? T.surfaceSoft : '#ffffff',
  };

  return (
    <div>
      <label
        htmlFor={`bitly-field-${field.name}`}
        className="mb-1 block text-xs font-semibold"
        style={{ color: T.label, fontFamily: T.font }}
      >
        {field.label}
        {field.required && <span style={{ color: T.required }}> *</span>}
      </label>
      <input
        id={`bitly-field-${field.name}`}
        type={field.type}
        value={value}
        placeholder={field.placeholder}
        disabled={disabled}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
      />
      {error && (
        <p className="mt-1 text-xs" style={{ color: T.required }}>{error}</p>
      )}
    </div>
  );
};

const SubmitButton = ({ submitting, label }: { submitting: boolean; label: string }) => (
  <button
    type="submit"
    disabled={submitting}
    className="mt-1 flex w-full items-center justify-center gap-2 font-semibold transition-transform disabled:cursor-not-allowed disabled:opacity-80"
    style={{
      height: 46,
      borderRadius: 999,
      background: T.submitBg,
      color: '#ffffff',
      fontFamily: T.font,
      boxShadow: T.submitShadow,
    }}
    onMouseEnter={(e) => {
      if (submitting) return;
      e.currentTarget.style.background = T.submitBgHover;
      e.currentTarget.style.transform = 'translateY(-1px)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = T.submitBg;
      e.currentTarget.style.transform = 'translateY(0)';
    }}
  >
    {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
    {submitting ? 'Generando…' : label}
  </button>
);

export default BitlyLinkTool;
