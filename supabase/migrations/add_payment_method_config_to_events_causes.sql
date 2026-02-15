-- Add per-entity payment routing configuration.
-- Defaults to auto so integrated payment is tried first and can fallback.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS manual_payment_link text;

ALTER TABLE public.causes
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS manual_payment_link text;

-- Keep event legacy payment_link data by seeding manual_payment_link where empty.
UPDATE public.events
SET manual_payment_link = payment_link
WHERE manual_payment_link IS NULL
  AND payment_link IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'events_payment_method_check'
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_payment_method_check
      CHECK (payment_method IN ('auto', 'integrated', 'manual_link'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'causes_payment_method_check'
  ) THEN
    ALTER TABLE public.causes
      ADD CONSTRAINT causes_payment_method_check
      CHECK (payment_method IN ('auto', 'integrated', 'manual_link'));
  END IF;
END $$;
