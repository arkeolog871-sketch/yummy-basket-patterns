-- Public advertisement media bucket. Founder uploads from AdsPanel via
-- supabase.storage.from('banners').upload(...). Homepage reads public URLs.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('banners', 'banners', true, 31457280, NULL)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = GREATEST(COALESCE(storage.buckets.file_size_limit, 0), 31457280),
  allowed_mime_types = NULL;

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
