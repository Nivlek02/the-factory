-- Create storage bucket for task attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-attachments', 'task-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to view files (public bucket)
CREATE POLICY "Public read access for task attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'task-attachments');

-- Allow anyone to upload files
CREATE POLICY "Anyone can upload task attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'task-attachments');

-- Allow anyone to delete their uploaded files
CREATE POLICY "Anyone can delete task attachments"
ON storage.objects FOR DELETE
USING (bucket_id = 'task-attachments');