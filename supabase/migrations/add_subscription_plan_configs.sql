-- Central plan config for memberships/subscriptions editable from admin UI.

CREATE TABLE IF NOT EXISTS public.subscription_plan_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_key text NOT NULL UNIQUE,
  name text NOT NULL,
  subscription_type text NOT NULL CHECK (subscription_type IN ('membership', 'organization_membership')),
  amount numeric(10,2) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'JMD',
  frequency text NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'quarterly', 'annually')),
  description text,
  is_active boolean NOT NULL DEFAULT true,
  payment_method text NOT NULL DEFAULT 'auto' CHECK (payment_method IN ('auto', 'integrated', 'manual_link')),
  manual_payment_link text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscription_plan_configs_subscription_type
  ON public.subscription_plan_configs (subscription_type);

CREATE INDEX IF NOT EXISTS idx_subscription_plan_configs_is_active
  ON public.subscription_plan_configs (is_active);

-- Seed defaults (matches current app behavior).
INSERT INTO public.subscription_plan_configs
  (plan_key, name, subscription_type, amount, currency, frequency, description, is_active, payment_method)
VALUES
  ('membership_annual', 'Annual Membership', 'membership', 6000, 'JMD', 'annually', 'VIbe Premium Membership - Annual Plan (Includes VI T-Shirt)', true, 'auto'),
  ('organization_monthly', 'Organization Monthly Plan', 'organization_membership', 10000, 'JMD', 'monthly', 'VIbe Partner Organization - Monthly Plan', true, 'auto'),
  ('organization_yearly', 'Organization Yearly Plan', 'organization_membership', 100000, 'JMD', 'annually', 'VIbe Partner Organization - Yearly Plan', true, 'auto')
ON CONFLICT (plan_key) DO NOTHING;

ALTER TABLE public.subscription_plan_configs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'subscription_plan_configs'
      AND policyname = 'Admins can read subscription plan configs'
  ) THEN
    CREATE POLICY "Admins can read subscription plan configs"
      ON public.subscription_plan_configs
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.users u
          WHERE u.id = auth.uid()
            AND u.role = 'admin'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'subscription_plan_configs'
      AND policyname = 'Admins can manage subscription plan configs'
  ) THEN
    CREATE POLICY "Admins can manage subscription plan configs"
      ON public.subscription_plan_configs
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.users u
          WHERE u.id = auth.uid()
            AND u.role = 'admin'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.users u
          WHERE u.id = auth.uid()
            AND u.role = 'admin'
        )
      );
  END IF;
END $$;
