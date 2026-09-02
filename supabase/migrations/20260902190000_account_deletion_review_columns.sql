-- Kurucunun hesap silme taleplerini onaylayıp/reddedebilmesi için izleme sütunları.
ALTER TABLE public.account_deletion_requests
  ADD COLUMN IF NOT EXISTS founder_note text,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

GRANT UPDATE (status, founder_note, reviewed_by, reviewed_at)
  ON public.account_deletion_requests TO authenticated;
