import { supabase } from '@/integrations/supabase/client';

const BUCKET_NAME = 'task-attachments';

export interface UploadResult {
  url: string;
  path: string;
}

export async function uploadFile(file: File, taskId?: string): Promise<UploadResult> {
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
