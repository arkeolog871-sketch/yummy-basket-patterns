
CREATE TABLE public.platform_identity (
  id text PRIMARY KEY DEFAULT 'default' CHECK (id='default'),
  legal_name text, brand_name text, mersis_no text, tax_office text, tax_no text,
  address text, phone text, email text, kep_address text, kvkk_contact text, authorized_person text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_identity TO anon, authenticated;
GRANT INSERT, UPDATE ON public.platform_identity TO authenticated;
GRANT ALL ON public.platform_identity TO service_role;
ALTER TABLE public.platform_identity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pi read" ON public.platform_identity FOR SELECT USING (true);
CREATE POLICY "pi founder write" ON public.platform_identity FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'founder')) WITH CHECK (public.has_role(auth.uid(),'founder'));
INSERT INTO public.platform_identity (id, legal_name, brand_name, address, phone, email, authorized_person)
VALUES ('default','İsmail Simpil','SİLVAN CEBİMDE','Boyunlu Küme Evler Kapı No: 264 Zemin, Boyunlu Mah., Silvan / Diyarbakır','0546 696 31 33','arkeolog871@gmail.com','İsmail Simpil');
CREATE TRIGGER platform_identity_updated BEFORE UPDATE ON public.platform_identity FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.legal_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_type text NOT NULL,
  version integer NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  audience text NOT NULL DEFAULT 'customer',
  effective_at timestamptz,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  requires_reacceptance boolean NOT NULL DEFAULT false,
  lawyer_reviewed boolean NOT NULL DEFAULT false,
  created_by uuid, published_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (doc_type, version)
);
GRANT SELECT ON public.legal_documents TO anon, authenticated;
GRANT INSERT, UPDATE ON public.legal_documents TO authenticated;
GRANT ALL ON public.legal_documents TO service_role;
ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ld public read" ON public.legal_documents FOR SELECT USING (status='published' OR public.has_role(auth.uid(),'founder'));
CREATE POLICY "ld founder insert" ON public.legal_documents FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'founder'));
CREATE POLICY "ld founder update" ON public.legal_documents FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'founder')) WITH CHECK (public.has_role(auth.uid(),'founder'));
CREATE TRIGGER legal_documents_updated BEFORE UPDATE ON public.legal_documents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.legal_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  document_id uuid REFERENCES public.legal_documents(id),
  doc_type text NOT NULL,
  version integer NOT NULL,
  acceptance_type text NOT NULL CHECK (acceptance_type IN ('contract_accept','notice_read','explicit_consent','marketing_opt_in','marketing_opt_out')),
  context text NOT NULL DEFAULT 'signup',
  ip_hash text, user_agent text,
  accepted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.legal_acceptances (user_id, doc_type);
GRANT SELECT ON public.legal_acceptances TO authenticated;
GRANT ALL ON public.legal_acceptances TO service_role;
ALTER TABLE public.legal_acceptances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "la own read" ON public.legal_acceptances FOR SELECT TO authenticated USING (user_id=auth.uid() OR public.has_role(auth.uid(),'founder'));

CREATE OR REPLACE FUNCTION public.prevent_mutation() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN RAISE EXCEPTION 'Bu kayıt değiştirilemez (append-only).'; END; $$;
CREATE TRIGGER legal_acceptances_immutable BEFORE UPDATE OR DELETE ON public.legal_acceptances FOR EACH ROW EXECUTE FUNCTION public.prevent_mutation();
CREATE TRIGGER audit_logs_immutable BEFORE UPDATE OR DELETE ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION public.prevent_mutation();
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS actor_role text, ADD COLUMN IF NOT EXISTS reason text, ADD COLUMN IF NOT EXISTS correlation_id text;

CREATE TABLE public.communication_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  channel text NOT NULL CHECK (channel IN ('sms','email','push','call')),
  granted boolean NOT NULL,
  source text NOT NULL DEFAULT 'app',
  iys_status text NOT NULL DEFAULT 'not_synced',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.communication_consents (user_id, channel, created_at DESC);
GRANT SELECT, INSERT ON public.communication_consents TO authenticated;
GRANT ALL ON public.communication_consents TO service_role;
ALTER TABLE public.communication_consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cc own read" ON public.communication_consents FOR SELECT TO authenticated USING (user_id=auth.uid() OR public.has_role(auth.uid(),'founder'));
CREATE POLICY "cc own insert" ON public.communication_consents FOR INSERT TO authenticated WITH CHECK (user_id=auth.uid());
CREATE TRIGGER communication_consents_immutable BEFORE UPDATE OR DELETE ON public.communication_consents FOR EACH ROW EXECUTE FUNCTION public.prevent_mutation();

CREATE OR REPLACE FUNCTION public.can_send_marketing(_user_id uuid, _channel text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT COALESCE((SELECT granted FROM public.communication_consents WHERE user_id=_user_id AND channel=_channel ORDER BY created_at DESC LIMIT 1), false)
$$;
REVOKE ALL ON FUNCTION public.can_send_marketing(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_send_marketing(uuid,text) TO service_role;

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS legal_entity_type text,
  ADD COLUMN IF NOT EXISTS legal_name text,
  ADD COLUMN IF NOT EXISTS tax_office text,
  ADD COLUMN IF NOT EXISTS tax_no text,
  ADD COLUMN IF NOT EXISTS mersis_no text,
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS verification_note text,
  ADD COLUMN IF NOT EXISTS suspended_reason text,
  ADD COLUMN IF NOT EXISTS agreement_version integer,
  ADD COLUMN IF NOT EXISTS agreement_accepted_at timestamptz;
GRANT SELECT (legal_name, tax_office, mersis_no, legal_entity_type) ON public.restaurants TO anon, authenticated;

CREATE TABLE public.business_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  doc_kind text NOT NULL,
  storage_path text,
  document_no text,
  expires_at date,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','approved','rejected','expired')),
  review_note text, reviewed_by uuid, reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.business_documents TO authenticated;
GRANT ALL ON public.business_documents TO service_role;
ALTER TABLE public.business_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bd vendor read" ON public.business_documents FOR SELECT TO authenticated USING (public.is_vendor_of(auth.uid(),restaurant_id) OR public.has_role(auth.uid(),'founder'));
CREATE POLICY "bd vendor insert" ON public.business_documents FOR INSERT TO authenticated WITH CHECK (public.is_vendor_of(auth.uid(),restaurant_id) AND status='submitted');
CREATE POLICY "bd founder update" ON public.business_documents FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'founder')) WITH CHECK (public.has_role(auth.uid(),'founder'));
CREATE TRIGGER business_documents_updated BEFORE UPDATE ON public.business_documents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.commission_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version integer NOT NULL,
  sector text NOT NULL DEFAULT 'all',
  fee_type text NOT NULL,
  rate_percent numeric(6,3) NOT NULL DEFAULT 0,
  fixed_amount numeric(10,2) NOT NULL DEFAULT 0,
  is_optional boolean NOT NULL DEFAULT false,
  description text NOT NULL,
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz,
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.commission_rules TO authenticated;
GRANT INSERT ON public.commission_rules TO authenticated;
GRANT ALL ON public.commission_rules TO service_role;
ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cr read" ON public.commission_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "cr founder insert" ON public.commission_rules FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'founder'));

CREATE TABLE public.order_fee_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id),
  rule_id uuid REFERENCES public.commission_rules(id),
  fee_type text NOT NULL, base_amount numeric(10,2) NOT NULL, amount numeric(10,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.order_fee_lines TO authenticated;
GRANT ALL ON public.order_fee_lines TO service_role;
ALTER TABLE public.order_fee_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ofl vendor read" ON public.order_fee_lines FOR SELECT TO authenticated USING (public.is_vendor_of(auth.uid(),restaurant_id) OR public.has_role(auth.uid(),'founder'));

CREATE TABLE public.payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id),
  provider text NOT NULL,
  provider_transaction_id text,
  kind text NOT NULL CHECK (kind IN ('charge','refund','partial_refund')),
  amount numeric(10,2) NOT NULL,
  status text NOT NULL,
  settlement_status text NOT NULL DEFAULT 'none',
  idempotency_key text NOT NULL UNIQUE,
  raw_event_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payment_transactions TO authenticated;
GRANT ALL ON public.payment_transactions TO service_role;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pt read" ON public.payment_transactions FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'founder') OR EXISTS (SELECT 1 FROM public.orders o WHERE o.id=order_id AND (o.user_id=auth.uid() OR public.is_vendor_of(auth.uid(),o.restaurant_id))));

CREATE TABLE public.refund_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id),
  order_item_id uuid REFERENCES public.order_items(id),
  user_id uuid NOT NULL,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id),
  reason text NOT NULL, evidence_path text,
  requested_amount numeric(10,2),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','seller_review','platform_review','approved','partially_approved','rejected')),
  decision_note text, decided_by uuid, decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.refund_requests TO authenticated;
GRANT ALL ON public.refund_requests TO service_role;
ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rr read" ON public.refund_requests FOR SELECT TO authenticated USING (user_id=auth.uid() OR public.is_vendor_of(auth.uid(),restaurant_id) OR public.has_role(auth.uid(),'founder'));
CREATE POLICY "rr insert own" ON public.refund_requests FOR INSERT TO authenticated WITH CHECK (user_id=auth.uid() AND status='open' AND EXISTS (SELECT 1 FROM public.orders o WHERE o.id=order_id AND o.user_id=auth.uid() AND o.restaurant_id=refund_requests.restaurant_id));
CREATE POLICY "rr founder update" ON public.refund_requests FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'founder')) WITH CHECK (public.has_role(auth.uid(),'founder'));
CREATE TRIGGER refund_requests_updated BEFORE UPDATE ON public.refund_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  restaurant_id uuid REFERENCES public.restaurants(id),
  order_id uuid REFERENCES public.orders(id),
  subject text NOT NULL, body text NOT NULL,
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','SELLER_RESPONSE','PLATFORM_REVIEW','RESOLVED','REJECTED','REFUNDED','ESCALATED')),
  seller_due_at timestamptz, platform_due_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.complaints TO authenticated;
GRANT ALL ON public.complaints TO service_role;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "c read" ON public.complaints FOR SELECT TO authenticated USING (user_id=auth.uid() OR (restaurant_id IS NOT NULL AND public.is_vendor_of(auth.uid(),restaurant_id)) OR public.has_role(auth.uid(),'founder'));
CREATE POLICY "c insert own" ON public.complaints FOR INSERT TO authenticated WITH CHECK (user_id=auth.uid() AND status='OPEN' AND (order_id IS NULL OR EXISTS (SELECT 1 FROM public.orders o WHERE o.id=order_id AND o.user_id=auth.uid())));
CREATE POLICY "c founder update" ON public.complaints FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'founder')) WITH CHECK (public.has_role(auth.uid(),'founder'));
CREATE TRIGGER complaints_updated BEFORE UPDATE ON public.complaints FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.complaint_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL, actor_role text NOT NULL,
  message text, new_status text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.complaint_events TO authenticated;
GRANT ALL ON public.complaint_events TO service_role;
ALTER TABLE public.complaint_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ce read" ON public.complaint_events FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.complaints c WHERE c.id=complaint_id AND (c.user_id=auth.uid() OR (c.restaurant_id IS NOT NULL AND public.is_vendor_of(auth.uid(),c.restaurant_id)) OR public.has_role(auth.uid(),'founder'))));
CREATE POLICY "ce insert party" ON public.complaint_events FOR INSERT TO authenticated WITH CHECK (actor_id=auth.uid() AND new_status IS NULL AND EXISTS (SELECT 1 FROM public.complaints c WHERE c.id=complaint_id AND (c.user_id=auth.uid() OR (c.restaurant_id IS NOT NULL AND public.is_vendor_of(auth.uid(),c.restaurant_id)))));
CREATE TRIGGER complaint_events_immutable BEFORE UPDATE OR DELETE ON public.complaint_events FOR EACH ROW EXECUTE FUNCTION public.prevent_mutation();

CREATE TABLE public.content_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL,
  target_type text NOT NULL CHECK (target_type IN ('review','menu_item','restaurant','advertisement')),
  target_id uuid NOT NULL,
  reason text NOT NULL CHECK (reason IN ('insult','personal_data','threat','misleading','illegal','spam','other')),
  details text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','removed','dismissed','suspended')),
  decision_reason text, decided_by uuid, decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reporter_id, target_type, target_id)
);
GRANT SELECT, INSERT, UPDATE ON public.content_reports TO authenticated;
GRANT ALL ON public.content_reports TO service_role;
ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cr own read" ON public.content_reports FOR SELECT TO authenticated USING (reporter_id=auth.uid() OR public.has_role(auth.uid(),'founder'));
CREATE POLICY "cr insert" ON public.content_reports FOR INSERT TO authenticated WITH CHECK (reporter_id=auth.uid() AND status='open');
CREATE POLICY "cr founder update" ON public.content_reports FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'founder')) WITH CHECK (public.has_role(auth.uid(),'founder') AND decision_reason IS NOT NULL);

ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS verified_order_id uuid REFERENCES public.orders(id),
  ADD COLUMN IF NOT EXISTS seller_reply text, ADD COLUMN IF NOT EXISTS seller_reply_at timestamptz,
  ADD COLUMN IF NOT EXISTS hidden_reason text;

CREATE TABLE public.security_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz, detected_at timestamptz NOT NULL DEFAULT now(),
  affected_system text NOT NULL, data_categories text[] NOT NULL DEFAULT '{}',
  affected_count_estimate integer, measures text, responsible_admin uuid,
  notification_assessment text, authority_notified_at timestamptz, subjects_notified_at timestamptz,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','contained','closed')),
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.security_incidents TO authenticated;
GRANT ALL ON public.security_incidents TO service_role;
ALTER TABLE public.security_incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "si founder" ON public.security_incidents FOR ALL TO authenticated USING (public.has_role(auth.uid(),'founder')) WITH CHECK (public.has_role(auth.uid(),'founder'));
CREATE TRIGGER security_incidents_updated BEFORE UPDATE ON public.security_incidents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.compliance_settings (
  key text PRIMARY KEY, value jsonb NOT NULL, description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.compliance_settings TO authenticated;
GRANT INSERT, UPDATE ON public.compliance_settings TO authenticated;
GRANT ALL ON public.compliance_settings TO service_role;
ALTER TABLE public.compliance_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cs read" ON public.compliance_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "cs founder write" ON public.compliance_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(),'founder')) WITH CHECK (public.has_role(auth.uid(),'founder'));
INSERT INTO public.compliance_settings(key,value,description) VALUES
 ('complaint_seller_hours','48','Satıcının şikâyete cevap süresi (saat) — yapılandırılabilir'),
 ('complaint_platform_hours','72','Platform inceleme süresi (saat) — yapılandırılabilir'),
 ('breach_authority_hours','null','Kurula bildirim süresi — hukukçu teyidiyle doldurulmalı'),
 ('required_business_documents','["tax_certificate","food_registration"]','Yayın için zorunlu belge türleri');

CREATE TABLE public.data_processors (
  id text PRIMARY KEY, name text NOT NULL, purpose text NOT NULL, data_categories text[] NOT NULL,
  role text NOT NULL DEFAULT 'processor', location text,
  transfer_mechanism text, transfer_status text NOT NULL DEFAULT 'pending' CHECK (transfer_status IN ('pending','compliant','not_applicable')),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.data_processors TO anon, authenticated;
GRANT UPDATE ON public.data_processors TO authenticated;
GRANT ALL ON public.data_processors TO service_role;
ALTER TABLE public.data_processors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dp read" ON public.data_processors FOR SELECT USING (true);
CREATE POLICY "dp founder update" ON public.data_processors FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'founder')) WITH CHECK (public.has_role(auth.uid(),'founder'));
INSERT INTO public.data_processors(id,name,purpose,data_categories,location) VALUES
 ('hosting_db','Barındırma ve veritabanı altyapısı','Hesap, sipariş ve içerik verilerinin saklanması','{kimlik,iletişim,adres,sipariş,işlem güvenliği}','Yurt dışı olabilir'),
 ('email','E-posta gönderim hizmeti','Doğrulama kodu ve hizmet e-postaları','{e-posta,kod gönderim kaydı}','Yurt dışı olabilir'),
 ('maps','Google Maps / OpenStreetMap','Harita ve konum gösterimi','{konum,IP}','Yurt dışı'),
 ('push','Firebase Cloud Messaging','Sipariş ve hizmet bildirimleri','{cihaz jetonu}','Yurt dışı'),
 ('ai','OpenAI (şu an arayüzde kapalı)','Sesli/yazılı asistan','{mesaj içeriği,ses kaydı}','Yurt dışı');

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS pre_information jsonb,
  ADD COLUMN IF NOT EXISTS legal_versions jsonb;

ALTER TABLE public.account_deletion_requests
  ADD COLUMN IF NOT EXISTS retention_basis text,
  ADD COLUMN IF NOT EXISTS anonymized_fields text[],
  ADD COLUMN IF NOT EXISTS retained_fields text[],
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;
