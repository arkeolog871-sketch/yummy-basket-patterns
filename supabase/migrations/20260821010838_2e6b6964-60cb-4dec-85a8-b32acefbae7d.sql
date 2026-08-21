ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS stock_quantity integer NOT NULL DEFAULT 0;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS logo_url text;

CREATE TABLE IF NOT EXISTS public.business_media (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  url text NOT NULL,
  storage_path text,
  kind text NOT NULL DEFAULT 'gallery',
  position integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_media TO authenticated;
GRANT SELECT ON public.business_media TO anon;
GRANT ALL ON public.business_media TO service_role;

ALTER TABLE public.business_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "business_media_public_read" ON public.business_media
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "business_media_vendor_manage" ON public.business_media
  FOR ALL TO authenticated
  USING (public.is_vendor_of(auth.uid(), restaurant_id) OR public.has_role(auth.uid(), 'founder'))
  WITH CHECK (public.is_vendor_of(auth.uid(), restaurant_id) OR public.has_role(auth.uid(), 'founder'));

CREATE INDEX IF NOT EXISTS business_media_restaurant_idx ON public.business_media (restaurant_id, position);

CREATE POLICY "media_buckets_vendor_write" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id IN ('product-images','business-images')
    AND (
      public.has_role(auth.uid(), 'founder')
      OR public.is_vendor_of(auth.uid(), NULLIF(split_part(name, '/', 1), '')::uuid)
    )
  )
  WITH CHECK (
    bucket_id IN ('product-images','business-images')
    AND (
      public.has_role(auth.uid(), 'founder')
      OR public.is_vendor_of(auth.uid(), NULLIF(split_part(name, '/', 1), '')::uuid)
    )
  );