CREATE TABLE public.assistant_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL,
  proposal jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX assistant_messages_user_created_idx ON public.assistant_messages (user_id, created_at);

GRANT SELECT, INSERT, DELETE ON public.assistant_messages TO authenticated;
GRANT ALL ON public.assistant_messages TO service_role;

ALTER TABLE public.assistant_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Kullanici kendi sohbetini okur" ON public.assistant_messages
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Kullanici kendi sohbetine yazar" ON public.assistant_messages
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Kullanici kendi sohbetini siler" ON public.assistant_messages
  FOR DELETE TO authenticated USING (auth.uid() = user_id);