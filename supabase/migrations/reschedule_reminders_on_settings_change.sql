-- ============================================
-- RESCHEDULE REMINDERS WHEN SETTINGS CHANGE
-- ============================================
-- Today, reminders are scheduled at signup time via triggers.
-- If the user later changes reminder_settings, existing pending rows
-- are NOT automatically updated. This migration fixes that by:
-- 1) Cancelling pending reminders when reminders_enabled is turned off
-- 2) Rebuilding pending reminders for future items when settings change
--    (remindersEnabled/dayBefore/dayOf/hoursBefore).
--
-- NOTE: This rebuild approach is intentionally simple and robust:
-- it deletes all pending reminders for the user and recreates them from
-- current registrations/signups + current settings.

CREATE OR REPLACE FUNCTION public.reschedule_user_reminders(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_settings RECORD;
  rec RECORD;
  start_dt timestamptz;
  reminder_time timestamptz;
  hours_before_val integer;
BEGIN
  -- Load settings
  SELECT * INTO user_settings
  FROM public.reminder_settings
  WHERE user_id = p_user_id;

  -- If no settings row, nothing to do
  IF user_settings IS NULL THEN
    RETURN;
  END IF;

  -- Cancel existing pending reminders first (keeps history of sent/failed)
  UPDATE public.scheduled_reminders
  SET status = 'cancelled'
  WHERE user_id = p_user_id
    AND status = 'pending';

  -- If reminders disabled, stop here (we just cancelled)
  IF user_settings.reminders_enabled = false THEN
    RETURN;
  END IF;

  -- ========= Events: rebuild from event_registrations =========
  FOR rec IN
    SELECT er.event_id, e.event_date, e.start_time
    FROM public.event_registrations er
    JOIN public.events e ON e.id = er.event_id
    WHERE er.user_id = p_user_id
      AND e.event_date IS NOT NULL
  LOOP
    start_dt := (rec.event_date::text || ' ' || COALESCE(rec.start_time, '09:00:00'))::timestamptz;
    IF start_dt <= now() THEN
      CONTINUE;
    END IF;

    -- Day before (9:00 AM)
    IF user_settings.remind_day_before = true THEN
      reminder_time := (start_dt - interval '1 day')::date::timestamp + time '09:00:00';
      IF reminder_time > now() THEN
        INSERT INTO public.scheduled_reminders (user_id, event_id, reminder_type, scheduled_for, status)
        VALUES (p_user_id, rec.event_id, 'day_before', reminder_time, 'pending');
      END IF;
    END IF;

    -- Day of (8:00 AM)
    IF user_settings.remind_day_of = true THEN
      reminder_time := start_dt::date::timestamp + time '08:00:00';
      IF reminder_time > now() AND reminder_time < start_dt THEN
        INSERT INTO public.scheduled_reminders (user_id, event_id, reminder_type, scheduled_for, status)
        VALUES (p_user_id, rec.event_id, 'day_of', reminder_time, 'pending');
      END IF;
    END IF;

    -- Hours before
    IF user_settings.remind_hours_before IS NOT NULL THEN
      hours_before_val := user_settings.remind_hours_before;
      reminder_time := start_dt - (hours_before_val || ' hours')::interval;
      IF reminder_time > now() THEN
        INSERT INTO public.scheduled_reminders (user_id, event_id, reminder_type, scheduled_for, status)
        VALUES (p_user_id, rec.event_id, 'hours_before', reminder_time, 'pending');
      END IF;
    END IF;
  END LOOP;

  -- ========= Opportunities: rebuild from opportunity_signups =========
  FOR rec IN
    SELECT os.opportunity_id, o.date_start, o.time_start
    FROM public.opportunity_signups os
    JOIN public.opportunities o ON o.id = os.opportunity_id
    WHERE os.user_id = p_user_id
      AND o.date_start IS NOT NULL
  LOOP
    IF rec.time_start IS NOT NULL THEN
      start_dt := (rec.date_start::date::text || ' ' || rec.time_start)::timestamptz;
    ELSE
      start_dt := rec.date_start;
    END IF;

    IF start_dt <= now() THEN
      CONTINUE;
    END IF;

    -- Day before (9:00 AM)
    IF user_settings.remind_day_before = true THEN
      reminder_time := (start_dt - interval '1 day')::date::timestamp + time '09:00:00';
      IF reminder_time > now() THEN
        INSERT INTO public.scheduled_reminders (user_id, opportunity_id, reminder_type, scheduled_for, status)
        VALUES (p_user_id, rec.opportunity_id, 'day_before', reminder_time, 'pending');
      END IF;
    END IF;

    -- Day of (8:00 AM)
    IF user_settings.remind_day_of = true THEN
      reminder_time := start_dt::date::timestamp + time '08:00:00';
      IF reminder_time > now() AND reminder_time < start_dt THEN
        INSERT INTO public.scheduled_reminders (user_id, opportunity_id, reminder_type, scheduled_for, status)
        VALUES (p_user_id, rec.opportunity_id, 'day_of', reminder_time, 'pending');
      END IF;
    END IF;

    -- Hours before
    IF user_settings.remind_hours_before IS NOT NULL THEN
      hours_before_val := user_settings.remind_hours_before;
      reminder_time := start_dt - (hours_before_val || ' hours')::interval;
      IF reminder_time > now() THEN
        INSERT INTO public.scheduled_reminders (user_id, opportunity_id, reminder_type, scheduled_for, status)
        VALUES (p_user_id, rec.opportunity_id, 'hours_before', reminder_time, 'pending');
      END IF;
    END IF;
  END LOOP;
END;
$$;

-- Trigger function: reschedule on settings updates
CREATE OR REPLACE FUNCTION public.on_reminder_settings_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only reschedule if relevant fields changed
  IF (NEW.reminders_enabled IS DISTINCT FROM OLD.reminders_enabled)
     OR (NEW.remind_day_before IS DISTINCT FROM OLD.remind_day_before)
     OR (NEW.remind_day_of IS DISTINCT FROM OLD.remind_day_of)
     OR (NEW.remind_hours_before IS DISTINCT FROM OLD.remind_hours_before) THEN
    PERFORM public.reschedule_user_reminders(NEW.user_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_reschedule_on_reminder_settings_update ON public.reminder_settings;
CREATE TRIGGER trigger_reschedule_on_reminder_settings_update
AFTER UPDATE ON public.reminder_settings
FOR EACH ROW
EXECUTE FUNCTION public.on_reminder_settings_changed();





