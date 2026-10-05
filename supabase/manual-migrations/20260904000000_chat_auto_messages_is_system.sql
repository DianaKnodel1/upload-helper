-- Automatische Chat-Nachrichten als Systemnachrichten kennzeichnen
--
-- Hintergrund: Die Trigger unten erzeugen Nachrichten mit dem Teamleiter als
-- Absender. Ohne is_system = true wurden sie im Mitarbeiter-Chat wie
-- persönliche Nachrichten des Teamleiters angezeigt ("Phantom-Nachrichten").
--
-- Diese Migration:
--   1) stellt sicher, dass chat_messages.is_system existiert,
--   2) aktualisiert alle Auto-Nachrichten-Trigger auf is_system = true,
--   3) kennzeichnet vorhandene Auto-Nachrichten rueckwirkend.

-- 1) Spalte absichern ----------------------------------------------------------
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;

-- 2) Trigger-Funktionen mit is_system = true -----------------------------------

-- Willkommensnachricht bei neuer Profilzeile
CREATE OR REPLACE FUNCTION public.send_welcome_chat_message() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.team_leader_id IS NOT NULL THEN
    INSERT INTO public.chat_messages (sender_id, receiver_id, message, is_system)
    VALUES (NEW.team_leader_id, NEW.user_id, 'Hallo ' || COALESCE(NULLIF(split_part(NEW.full_name, ' ', 1), ''), '') || '! Willkommen im Team!', true);
  END IF;
  RETURN NEW;
END; $$;

-- Vertrags-/Einfuehrungs-Status (Version aus big_update mit Duplikat-Schutz)
CREATE OR REPLACE FUNCTION public.send_system_chat_on_profile_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.team_leader_id IS NULL THEN RETURN NEW; END IF;

  IF OLD.contract_signed_at IS NULL AND NEW.contract_signed_at IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.chat_messages
      WHERE receiver_id = NEW.user_id AND message = 'Vertrag unterschrieben!'
    ) THEN
      INSERT INTO public.chat_messages (sender_id, receiver_id, message, is_system)
      VALUES (NEW.team_leader_id, NEW.user_id, 'Vertrag unterschrieben!', true);
    END IF;
  END IF;

  IF OLD.onboarding_status IS DISTINCT FROM 'abgeschlossen'
     AND NEW.onboarding_status = 'abgeschlossen' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.chat_messages
      WHERE receiver_id = NEW.user_id AND message = 'Einführung abgeschlossen!'
    ) THEN
      INSERT INTO public.chat_messages (sender_id, receiver_id, message, is_system)
      VALUES (NEW.team_leader_id, NEW.user_id, 'Einführung abgeschlossen!', true);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Verifizierungsbestaetigung
CREATE OR REPLACE FUNCTION public.send_chat_on_kyc_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _leader_id UUID;
BEGIN
  IF OLD.status != 'verifiziert' AND NEW.status = 'verifiziert' THEN
    SELECT team_leader_id INTO _leader_id FROM public.profiles WHERE user_id = NEW.user_id;
    IF _leader_id IS NOT NULL THEN
      INSERT INTO public.chat_messages (sender_id, receiver_id, message, is_system)
      VALUES (_leader_id, NEW.user_id, 'Verifizierung bestätigt!', true);
    END IF;
  END IF;
  RETURN NEW;
END; $$;

-- Auftragszuweisung
CREATE OR REPLACE FUNCTION public.send_chat_on_task_assignment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _leader_id UUID; _task_title TEXT;
BEGIN
  SELECT team_leader_id INTO _leader_id FROM public.profiles WHERE user_id = NEW.user_id;
  SELECT title INTO _task_title FROM public.task_templates WHERE id = NEW.task_template_id;
  IF _leader_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.chat_messages (sender_id, receiver_id, message, is_system)
    VALUES (_leader_id, NEW.user_id, 'Neuer Auftrag: ' || COALESCE(_task_title, 'Neuer Auftrag'), true);
  END IF;
  RETURN NEW;
END; $$;

-- SMS-Code-Weiterleitung (letzte Fassung aus 20260522134847)
CREATE OR REPLACE FUNCTION public.forward_inbound_sms_to_chat()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _leader_id uuid;
  _has_active_assignment boolean := false;
BEGIN
  IF NEW.direction <> 'inbound' OR NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.task_assignments
    WHERE user_id = NEW.user_id
      AND status NOT IN ('genehmigt', 'abgelehnt', 'abgeschlossen', 'entwurf', 'storniert')
  ) INTO _has_active_assignment;

  IF NOT _has_active_assignment THEN
    RETURN NEW;
  END IF;

  SELECT team_leader_id INTO _leader_id FROM public.profiles WHERE user_id = NEW.user_id;
  IF _leader_id IS NULL THEN
    SELECT ur.user_id INTO _leader_id FROM public.user_roles ur WHERE ur.role = 'admin' LIMIT 1;
  END IF;
  IF _leader_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.chat_messages (sender_id, receiver_id, message, is_system)
  VALUES (_leader_id, NEW.user_id, '📩 SMS Code: ' || COALESCE(NEW.body, ''), true);

  INSERT INTO public.notifications (user_id, type, title, message)
  VALUES (NEW.user_id, 'info', 'Neuer SMS-Code erhalten', 'Im Chat findest du den Code zum Abschließen deines Auftrags.');

  RETURN NEW;
END;
$function$;

-- 3) Bestandsdaten rueckwirkend kennzeichnen -----------------------------------
-- Nur Zeilen, deren Absender Teamleiter des Empfaengers oder Admin ist,
-- damit keine echten, zufaellig gleichlautenden Nachrichten erfasst werden.
UPDATE public.chat_messages cm
SET is_system = true
WHERE cm.is_system IS DISTINCT FROM true
  AND (
    cm.message IN ('Vertrag unterschrieben!', 'Einführung abgeschlossen!', 'Verifizierung bestätigt!')
    OR cm.message LIKE 'Neuer Auftrag: %'
    OR cm.message LIKE '📩 SMS Code: %'
    OR (cm.message LIKE 'Hallo %! Willkommen im Team!')
  )
  AND (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = cm.receiver_id AND p.team_leader_id = cm.sender_id
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = cm.sender_id AND ur.role::text IN ('admin', 'admin_mitarbeiter')
    )
  );
