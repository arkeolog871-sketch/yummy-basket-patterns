DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='app_categories') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.app_categories;
  END IF;
END $$;