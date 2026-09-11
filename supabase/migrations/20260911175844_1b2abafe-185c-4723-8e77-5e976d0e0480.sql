CREATE TABLE public.oauth_code_relay (
  state_hash TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX oauth_code_relay_created_at_idx ON public.oauth_code_relay (created_at);

GRANT ALL ON public.oauth_code_relay TO service_role;

ALTER TABLE public.oauth_code_relay ENABLE ROW LEVEL SECURITY;