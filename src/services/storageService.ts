import { supabase } from '@/integrations/supabase/client';

const BUCKET_NAME = 'task-attachments';

/**
 * Tope por archivo. Vive acá —y no en cada formulario— porque la comprobación tiene que estar en
 * el único sitio por el que pasan TODAS las subidas: el asistente lo validaba antes de subir, pero
 * los adjuntos de entregable (que son los que se usan todos los días) no validaban nada y un
 * archivo grande se iba al servidor para volver con un error crudo y un "Error al subir archivos"
 * que no decía ni cuál era el archivo ni por qué.
 */
export const MAX_ADJUNTO_MB = 50;
export const MAX_ADJUNTO_BYTES = MAX_ADJUNTO_MB * 1024 * 1024;

/** Mensaje único para el archivo que se pasa de tamaño. */
export const errorDeTamano = (file: { name: string }) =>
  `"${file.name}" pesa más de ${MAX_ADJUNTO_MB} MB y no se puede adjuntar.`;

export interface UploadResult {
  url: string;
  path: string;
}

export async function uploadFile(file: File, taskId?: string): Promise<UploadResult> {
  // Última barrera: aunque el formulario ya haya filtrado, nadie sube por encima del tope.
  if (file.size > MAX_ADJUNTO_BYTES) throw new Error(errorDeTamano(file));

  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 9);
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const filePath = taskId 
    ? `${taskId}/${timestamp}_${randomId}_${sanitizedName}`
    : `general/${timestamp}_${randomId}_${sanitizedName}`;

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) {
    console.error('Upload error:', error);
    throw new Error(`Error al subir archivo: ${error.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(data.path);

  return {
    url: urlData.publicUrl,
    path: data.path
  };
}

/**
 * Borra varios archivos de una. **Nunca lanza**: se llama después de que el usuario ya guardó su
 * cambio, así que un fallo de red o de permisos no puede romperle la acción — el peor caso es un
 * archivo que se queda en el bucket, que es exactamente lo que pasaba siempre hasta ahora.
 *
 * Ojo con la policy de DELETE del bucket: exige `owner = auth.uid()` (o el rol 'mercadeo', que
 * vive en una tabla vacía), así que **solo quien subió el archivo puede borrarlo**. Si otra
 * persona quita el adjunto, storage lo ignora en silencio: por eso se comprueba el resultado y se
 * deja constancia en consola en vez de dar por hecho que se borró.
 */
export async function borrarArchivos(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  try {
    const { data, error } = await supabase.storage.from(BUCKET_NAME).remove(paths);
    if (error) {
      console.warn('No se pudieron borrar adjuntos del bucket:', error.message, paths);
      return;
    }
    const borrados = (data ?? []).length;
    if (borrados < paths.length) {
      console.warn(
        `Se pidió borrar ${paths.length} adjunto(s) y storage borró ${borrados}. ` +
        'Lo normal es que los suba otra persona: la policy solo deja borrar los propios.',
        paths
      );
    }
  } catch (e) {
    console.warn('Error inesperado al borrar adjuntos:', e);
  }
}

export async function deleteFile(path: string): Promise<void> {
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([path]);

  if (error) {
    console.error('Delete error:', error);
    throw new Error(`Error al eliminar archivo: ${error.message}`);
  }
}

export function getPublicUrl(path: string): string {
  const { data } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(path);
  
  return data.publicUrl;
}

/**
 * Returns a thumbnail URL using Supabase image transformation.
 * Renders a smaller, compressed version of the image for preview cards.
 */
export function getThumbnailUrl(originalUrl: string, width = 400, quality = 60): string {
  // Only transform Supabase storage URLs
  if (!originalUrl.includes('/storage/v1/object/public/')) {
    return originalUrl;
  }
  // Convert public URL to render URL with transform params
  const renderUrl = originalUrl.replace(
    '/storage/v1/object/public/',
    '/storage/v1/render/image/public/'
  );
  const separator = renderUrl.includes('?') ? '&' : '?';
  return `${renderUrl}${separator}width=${width}&quality=${quality}`;
}
