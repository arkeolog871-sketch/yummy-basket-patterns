-- Public advertisement media bucket. Founder uploads from AdsPanel via
-- supabase.storage.from('banners').upload(...). Homepage reads public URLs.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'banners',
  'banners',
  true,
  31457280,
  ARRAY[
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    'image/gif',
    'image/avif',
    'image/bmp',
    'image/svg+xml',
    'image/x-icon',
    'image/vnd.microsoft.icon',
    'image/heic',
    'image/heif',
    'video/mp4',
    'video/webm',
    'video/quicktime'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = GREATEST(COALESCE(storage.buckets.file_size_limit, 0), 31457280),
  allowed_mime_types = CASE
    WHEN storage.buckets.allowed_mime_types IS NULL THEN NULL
    ELSE (
      SELECT array_agg(DISTINCT mime)
      FROM unnest(storage.buckets.allowed_mime_types || EXCLUDED.allowed_mime_types) AS mime
    )
  END;

DROP POLICY IF EXISTS "banners_public_read" ON storage.objects;
DROP POLICY IF EXISTS "banners_founder_insert" ON storage.objects;
DROP POLICY IF EXISTS "banners_founder_update" ON storage.objects;
DROP POLICY IF EXISTS "banners_founder_delete" ON storage.objects;

CREATE POLICY "banners_public_read" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'banners');

CREATE POLICY "banners_founder_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'banners'
    AND public.has_role(auth.uid(), 'founder')
  );

CREATE POLICY "banners_founder_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'banners'
    AND public.has_role(auth.uid(), 'founder')
  )
  WITH CHECK (
    bucket_id = 'banners'
    AND public.has_role(auth.uid(), 'founder')
  );

CREATE POLICY "banners_founder_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'banners'
    AND public.has_role(auth.uid(), 'founder')
  );

NOTIFY pgrst, 'reload schema';
