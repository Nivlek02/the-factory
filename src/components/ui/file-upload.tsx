import { useRef, useState } from 'react';
import { Button } from './button';
import { Paperclip, X, FileText, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { uploadFile } from '@/services/storageService';
import { toast } from 'sonner';

export interface Attachment {
  id: string;
  name: string;
  type: 'image' | 'document';
  url: string;
  size: number;
  path?: string;
  uploadedAt?: string;
}

interface FileUploadProps {
  attachments: Attachment[];
  onChange: (attachments: Attachment[]) => void;
  maxFiles?: number;
  className?: string;
  taskId?: string;
}

const FileUpload = ({ attachments, onChange, maxFiles = 10, className, taskId }: FileUploadProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const newAttachments: Attachment[] = [];

    try {
      for (const file of Array.from(files)) {
        if (attachments.length + newAttachments.length >= maxFiles) {
          toast.warning(`Máximo ${maxFiles} archivos permitidos`);
          break;
        }

        const isImage = file.type.startsWith('image/');
        
        // Upload to Supabase Storage
        const result = await uploadFile(file, taskId);
        
        const newAttachment: Attachment = {
          id: Math.random().toString(36).substr(2, 9),
          name: file.name,
          type: isImage ? 'image' : 'document',
          url: result.url,
          size: file.size,
          path: result.path,
          uploadedAt: new Date().toISOString(),
        };
        
        newAttachments.push(newAttachment);
      }

      if (newAttachments.length > 0) {
        onChange([...attachments, ...newAttachments]);
        toast.success(`${newAttachments.length} archivo(s) subido(s)`);
      }
    } catch (error) {
      console.error('Error uploading files:', error);
      toast.error('Error al subir archivos');
    } finally {
      setUploading(false);
      // Reset input
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  };

  const removeAttachment = (id: string) => {
    onChange(attachments.filter((a) => a.id !== id));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className={cn("space-y-3", className)}>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
        onChange={handleFileChange}
        className="hidden"
        disabled={uploading}
      />
      
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={attachments.length >= maxFiles || uploading}
        className="w-full"
      >
        {uploading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Subiendo...
          </>
        ) : (
          <>
            <Paperclip className="h-4 w-4 mr-2" />
            Adjuntar archivo
          </>
        )}
      </Button>
      
      {attachments.length > 0 && (
        <div className="space-y-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg border border-border/50"
            >
              {attachment.type === 'image' ? (
                <div className="w-10 h-10 rounded overflow-hidden bg-muted flex-shrink-0">
                  <img
                    src={attachment.url}
                    alt={attachment.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
              )}
              
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{attachment.name}</p>
                <p className="text-xs text-muted-foreground">{formatFileSize(attachment.size)}</p>
              </div>
              
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeAttachment(attachment.id)}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                disabled={uploading}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
      
      {attachments.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {attachments.length} de {maxFiles} archivos
        </p>
      )}
    </div>
  );
};

export default FileUpload;
