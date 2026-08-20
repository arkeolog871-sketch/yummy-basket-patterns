ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS opens_at time,
  ADD COLUMN IF NOT EXISTS closes_at time,
  ADD COLUMN IF NOT EXISTS is_open_manual boolean NOT NULL DEFAULT true;