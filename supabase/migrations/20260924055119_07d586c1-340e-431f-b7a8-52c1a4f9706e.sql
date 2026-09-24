
CREATE OR REPLACE FUNCTION public.enforce_restaurant_publish_rules() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_required jsonb; v_kind text;
BEGIN
  IF NEW.is_active IS TRUE AND (TG_OP='INSERT' OR OLD.is_active IS NOT TRUE) THEN
    IF NEW.verification_status IS DISTINCT FROM 'verified' THEN
      RAISE EXCEPTION 'İşletme doğrulanmadan yayına alınamaz.';
    END IF;
    SELECT value INTO v_required FROM public.compliance_settings WHERE key='required_business_documents';
    FOR v_kind IN SELECT jsonb_array_elements_text(COALESCE(v_required,'[]'::jsonb)) LOOP
      IF NOT EXISTS (SELECT 1 FROM public.business_documents d WHERE d.restaurant_id=NEW.id AND d.doc_kind=v_kind AND d.status='approved' AND (d.expires_at IS NULL OR d.expires_at >= current_date)) THEN
        RAISE EXCEPTION 'Zorunlu belge eksik veya süresi dolmuş: %', v_kind;
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.enforce_restaurant_publish_rules() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER restaurants_publish_rules BEFORE INSERT OR UPDATE OF is_active ON public.restaurants
  FOR EACH ROW EXECUTE FUNCTION public.enforce_restaurant_publish_rules();

CREATE OR REPLACE FUNCTION public.audit_compliance_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  INSERT INTO public.audit_logs(actor_id, action, entity, entity_id, status, detail)
  VALUES (auth.uid(), TG_TABLE_NAME || '.' || lower(TG_OP), TG_TABLE_NAME, NEW.id::text, 'success',
    jsonb_build_object('status', to_jsonb(NEW)->>'status', 'verification_status', to_jsonb(NEW)->>'verification_status'));
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.audit_compliance_change() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER refund_requests_audit AFTER INSERT OR UPDATE ON public.refund_requests FOR EACH ROW EXECUTE FUNCTION public.audit_compliance_change();
CREATE TRIGGER complaints_audit AFTER UPDATE ON public.complaints FOR EACH ROW EXECUTE FUNCTION public.audit_compliance_change();
CREATE TRIGGER content_reports_audit AFTER UPDATE ON public.content_reports FOR EACH ROW EXECUTE FUNCTION public.audit_compliance_change();
CREATE TRIGGER business_documents_audit AFTER INSERT OR UPDATE ON public.business_documents FOR EACH ROW EXECUTE FUNCTION public.audit_compliance_change();
CREATE TRIGGER restaurants_verification_audit AFTER UPDATE OF verification_status, suspended_reason ON public.restaurants FOR EACH ROW EXECUTE FUNCTION public.audit_compliance_change();
