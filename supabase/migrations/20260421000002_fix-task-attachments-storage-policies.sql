-- Restrict task-attachments bucket: only authenticated users may upload or delete files.
-- Public read access is kept (bucket is public for viewing attachments in-app).

DROP POLICY IF EXISTS "Anyone can upload task attachments" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete task attachments" ON storage.objects;

-- Only authenticated users can upload
CREATE POLICY "Authenticated users can upload task attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'task-attachments');

-- Authenticated users can delete their own files; mercadeo can delete any
CREATE POLICY "Authenticated users can delete task attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'task-attachments'
  AND (
    owner = auth.uid()
    OR public.has_role(auth.uid(), 'mercadeo')
  )
);
