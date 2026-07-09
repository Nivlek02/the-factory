import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { AlertCircle, Check, Copy, Loader2, RefreshCw } from 'lucide-react';

/**
 * Autocontenido: pinta lo que el JSON del webhook le da y hace POST de lo que el
 * usuario llena. Ningún campo del formulario ni lógica de Bitly vive acá — todo
 * sale del schema remoto.
 */
const SCHEMA_URL = 'https://n8n.camarabaq.org.co/webhook/formulariolink';
const SUBMIT_URL = 'https://n8n.camarabaq.org.co/webhook/crearlink';

type FieldType = 'text' | 'url' | 'email' | 'tel' | 'number' | 'textarea';

interface FormFieldSchema {
  name: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  required?: boolean;
}

interface FormSchema {
  title: string;
  fields: FormFieldSchema[];
  submitLabel: string;
}

interface BitlyResult {
  url: string;
  titulo?: string;
  [key: string]: unknown;
}

type Status = 'loading-schema' | 'error-schema' | 'form' | 'submitting' | 'error-submit' | 'success';

// Design tokens tal cual el HTML que hoy genera n8n para este formulario —
// se mantienen locales al componente para no ensuciar el theme global de la app.
const T = {
  font: "'Open Sans', sans-serif",
  bg: 'radial-gradient(120% 120% at 50% 0%, #f7f9ff 0%, #eef3ff 55%, #e1ebff 100%)',
  cardBg: '#ffffff',
  cardBorder: '#e0e6ff',
  cardShadow: 'rgba(80, 112, 255, 0.18)',
  header: '#1f2a4d',
  label: '#4b5268',
  inputBorder: '#d6defa',
  inputText: '#30354a',
  placeholder: '#9ca3c4',
  focusBorder: '#4c6fff',
  focusShadow: 'rgba(83, 115, 255, 0.35)',
  submitBg: 'linear-gradient(135deg, #2563ff, #4c8dff)',
  submitBgHover: 'linear-gradient(135deg, #1f57e6, #3f7bf0)',
  required: '#ff6d5a',
  cardRadius: '18px',
  inputRadius: '10px',
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

const emptyValuesFor = (schema: FormSchema): Record<string, string> => {
  const values: Record<string, string> = {};
  for (const f of schema.fields) values[f.name] = '';
  return values;
};

const BitlyLinkTool = () => {
  const [status, setStatus] = useState<Status>('loading-schema');
  const [schema, setSchema] = useState<FormSchema | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [result, setResult] = useState<BitlyResult | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadSchema = useCallback(async () => {
    setStatus('loading-schema');
    try {
      const res = await fetch(SCHEMA_URL, { method: 'GET' });
      if (!res.ok) throw new Error(`El servidor respondió con error ${res.status}`);
      const data = (await res.json()) as FormSchema;
      if (!data || !Array.isArray(data.fields)) {
        throw new Error('El formulario recibido no tiene un formato válido');
      }
      setSchema(data);
      setValues(emptyValuesFor(data));
      setFieldErrors({});
      setStatus('form');
    } catch (err) {
      setErrorMessage(errorMessageFrom(err, 'No se pudo cargar el formulario. Intenta de nuevo.'));
      setStatus('error-schema');
    }
  }, []);

  useEffect(() => {
    loadSchema();
  }, [loadSchema]);

  useEffect(() => () => {
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
  }, []);

  const validate = (activeSchema: FormSchema): boolean => {
    const errors: Record<string, string> = {};
    for (const field of activeSchema.fields) {
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
    if (!schema || !validate(schema)) return;

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
    if (!schema) return;
    setValues(emptyValuesFor(schema));
    setFieldErrors({});
    setCopied(false);
    setResult(null);
    setStatus('form');
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
      className="flex min-h-full items-center justify-center px-3 py-8 sm:px-6"
      style={{ background: T.bg, fontFamily: T.font }}
    >
      <div className="w-full" style={{ maxWidth: 430 }}>
        {status === 'loading-schema' && (
          <div className="p-8 sm:p-10 text-center" style={cardStyle}>
            <Loader2 className="mx-auto h-6 w-6 animate-spin" style={{ color: T.focusBorder }} />
            <p className="mt-3 text-sm" style={{ color: T.label }}>Cargando formulario…</p>
          </div>
        )}

        {status === 'error-schema' && <ErrorCard message={errorMessage} onRetry={loadSchema} />}

        {schema && (status === 'form' || status === 'submitting' || status === 'error-submit') && (
          <div className="p-6 sm:p-8" style={cardStyle}>
            <h1 className="mb-6 text-xl font-bold" style={{ color: T.header }}>
              {schema.title}
            </h1>

            <form noValidate onSubmit={handleSubmit} className="space-y-4">
              {schema.fields.map((field) => (
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

              <SubmitButton submitting={status === 'submitting'} label={schema.submitLabel} />
            </form>
          </div>
        )}

        {status === 'success' && result && (
          <div className="p-6 sm:p-8 text-center" style={cardStyle}>
            <div
              className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full"
              style={{ background: 'rgba(37,99,255,0.1)' }}
            >
              <Check className="h-6 w-6" style={{ color: T.focusBorder }} />
            </div>
            <h1 className="mb-1 text-xl font-bold" style={{ color: T.header }}>Link generado</h1>
            {result.titulo && (
              <p className="mb-4 text-sm" style={{ color: T.label }}>{result.titulo}</p>
            )}

            <div
              className="mb-5 break-all px-4 py-3 text-sm font-medium"
              style={{
                background: '#f4f7ff',
                border: `1px solid ${T.inputBorder}`,
                borderRadius: T.inputRadius,
                color: T.focusBorder,
              }}
            >
              {result.url}
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => handleCopy(result.url)}
                className="inline-flex items-center justify-center gap-2 font-semibold transition-transform"
                style={{
                  height: 48,
                  borderRadius: 999,
                  background: T.submitBg,
                  color: '#ffffff',
                  boxShadow: '0 10px 24px rgba(37,99,255,.4)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = T.submitBgHover;
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = T.submitBg;
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? '¡Link copiado!' : 'Copiar link'}
              </button>

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

const ErrorCard = ({ message, onRetry }: { message: string; onRetry: () => void }) => (
  <div
    className="p-8 sm:p-10 text-center"
    style={{
      fontFamily: T.font,
      background: T.cardBg,
      border: `1px solid ${T.cardBorder}`,
      borderRadius: T.cardRadius,
      boxShadow: `0 20px 45px -18px ${T.cardShadow}`,
    }}
  >
    <div
      className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full"
      style={{ background: 'rgba(255,109,90,0.1)' }}
    >
      <AlertCircle className="h-6 w-6" style={{ color: T.required }} />
    </div>
    <p className="mb-5 text-sm" style={{ color: T.label }}>{message}</p>
    <button
      type="button"
      onClick={onRetry}
      className="inline-flex items-center justify-center gap-2 font-semibold"
      style={{
        height: 44,
        padding: '0 20px',
        borderRadius: 999,
        background: T.submitBg,
        color: '#ffffff',
        boxShadow: '0 10px 24px rgba(37,99,255,.4)',
      }}
    >
      <RefreshCw className="h-4 w-4" /> Reintentar
    </button>
  </div>
);

const FieldInput = ({
  field,
  value,
  error,
  disabled,
  onChange,
}: {
  field: FormFieldSchema;
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
    padding: '11px 14px',
    outline: 'none',
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
    background: disabled ? '#f6f8ff' : '#ffffff',
  };

  const sharedProps = {
    id: `bitly-field-${field.name}`,
    value,
    placeholder: field.placeholder,
    disabled,
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value),
    style: inputStyle,
  };

  return (
    <div>
      <label
        htmlFor={`bitly-field-${field.name}`}
        className="mb-1.5 block text-xs font-semibold"
        style={{ color: T.label, fontFamily: T.font }}
      >
        {field.label}
        {field.required && <span style={{ color: T.required }}> *</span>}
      </label>
      {field.type === 'textarea' ? (
        <textarea rows={3} {...sharedProps} />
      ) : (
        <input type={field.type} {...sharedProps} />
      )}
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
    className="mt-2 flex w-full items-center justify-center gap-2 font-semibold transition-transform disabled:cursor-not-allowed disabled:opacity-80"
    style={{
      height: 50,
      borderRadius: 999,
      background: T.submitBg,
      color: '#ffffff',
      fontFamily: T.font,
      boxShadow: '0 10px 24px rgba(37,99,255,.4)',
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
