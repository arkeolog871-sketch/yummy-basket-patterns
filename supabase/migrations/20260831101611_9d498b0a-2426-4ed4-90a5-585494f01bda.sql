CREATE TABLE public.account_deletion_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  phone text,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.account_deletion_requests TO authenticated;
GRANT UPDATE (status) ON public.account_deletion_requests TO authenticated;
GRANT ALL ON public.account_deletion_requests TO service_role;

ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own deletion request"
ON public.account_deletion_requests FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own deletion request"
ON public.account_deletion_requests FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Founders and admins can view all deletion requests"
ON public.account_deletion_requests FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'founder') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Founders and admins can update deletion requests"
ON public.account_deletion_requests FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'founder') OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'founder') OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX account_deletion_requests_user_id_idx ON public.account_deletion_requests (user_id);
CREATE INDEX account_deletion_requests_status_idx ON public.account_deletion_requests (status);

CREATE TRIGGER account_deletion_requests_set_updated_at
BEFORE UPDATE ON public.account_deletion_requests
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();