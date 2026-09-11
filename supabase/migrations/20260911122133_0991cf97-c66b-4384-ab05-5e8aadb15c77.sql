ALTER TABLE public.business_applications ALTER COLUMN cover_image_url DROP NOT NULL;
ALTER TABLE public.business_applications ALTER COLUMN maps_url DROP NOT NULL;
ALTER TABLE public.business_applications ALTER COLUMN cuisines SET DEFAULT '{}';