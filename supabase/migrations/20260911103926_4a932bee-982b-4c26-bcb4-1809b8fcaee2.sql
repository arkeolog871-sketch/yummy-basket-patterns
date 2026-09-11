CREATE TABLE public.business_applications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  applicant_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  founder_note text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  slug text NOT NULL,
  name text NOT NULL,
  tagline text NOT NULL,
  category text NOT NULL,
  sector text NOT NULL DEFAULT 'yemek',
  cuisines text[] NOT NULL DEFAULT '{}',
  delivery_minutes integer NOT NULL DEFAULT 30,
  delivery_fee numeric NOT NULL DEFAULT 0,
  min_order numeric NOT NULL DEFAULT 0,
  cover_image_url text NOT NULL,
  address text NOT NULL,
  district text NOT NULL,
  city text NOT NULL,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  maps_url text NOT NULL,
  contact_email text NOT NULL,
  contact_phone text NOT NULL,
  contact_person text NOT NULL,
  opens_at time,
  closes_at time,
  is_open_manual boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.business_applications TO authenticated;
GRANT ALL ON public.business_applications TO service_role;

ALTER TABLE public.business_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Applicants read own applications"
ON public.business_applications FOR SELECT TO authenticated
USING (auth.uid() = applicant_user_id OR public.has_role(auth.uid(), 'founder'));

CREATE POLICY "Applicants create own applications"
ON public.business_applications FOR INSERT TO authenticated
WITH CHECK (auth.uid() = applicant_user_id AND status = 'pending');

CREATE POLICY "Founders update applications"
ON public.business_applications FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'founder'))
WITH CHECK (public.has_role(auth.uid(), 'founder'));

CREATE INDEX business_applications_status_idx ON public.business_applications (status, created_at DESC);
CREATE INDEX business_applications_applicant_idx ON public.business_applications (applicant_user_id);

CREATE TRIGGER business_applications_set_updated_at
BEFORE UPDATE ON public.business_applications
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();