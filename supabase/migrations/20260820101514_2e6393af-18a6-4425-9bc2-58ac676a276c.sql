CREATE TABLE public.founder_backup_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX founder_backup_codes_user_idx ON public.founder_backup_codes(user_id);

GRANT SELECT ON public.founder_backup_codes TO authenticated;
GRANT ALL ON public.founder_backup_codes TO service_role;

ALTER TABLE public.founder_backup_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY founder_backup_codes_select_own ON public.founder_backup_codes
  FOR SELECT TO authenticated USING (auth.uid() = user_id);