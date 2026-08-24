CREATE TABLE public.app_errors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'client',
  message TEXT NOT NULL,
  stack TEXT,
  path TEXT,
  user_agent TEXT,
  user_id UUID,
  ip TEXT,
  occurrences INTEGER NOT NULL DEFAULT 1,
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX app_errors_last_seen_idx ON public.app_errors (last_seen_at DESC);

GRANT SELECT, UPDATE, DELETE ON public.app_errors TO authenticated;
GRANT ALL ON public.app_errors TO service_role;

ALTER TABLE public.app_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Founders can view app errors"
ON public.app_errors FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'founder'));

CREATE POLICY "Founders can update app errors"
ON public.app_errors FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'founder'))
WITH CHECK (public.has_role(auth.uid(), 'founder'));

CREATE POLICY "Founders can delete app errors"
ON public.app_errors FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'founder'));