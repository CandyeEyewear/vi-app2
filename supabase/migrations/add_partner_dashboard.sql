-- ============================================================
-- Partner Dashboard v1: partner_org_id + partner_invites
-- ============================================================

-- 1. Add partner_org_id FK to users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS partner_org_id uuid REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_partner_org_id ON public.users(partner_org_id);

-- 2. Integrity trigger: partner_org_id must reference a partner org, not self
CREATE OR REPLACE FUNCTION public.validate_partner_org_id()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.partner_org_id IS NOT NULL THEN
    -- Cannot be your own id
    IF NEW.partner_org_id = NEW.id THEN
      RAISE EXCEPTION 'partner_org_id cannot reference self';
    END IF;
    -- Referenced user must be a partner organization
    IF NOT EXISTS (
      SELECT 1 FROM public.users
      WHERE id = NEW.partner_org_id AND is_partner_organization = true
    ) THEN
      RAISE EXCEPTION 'partner_org_id must reference a user with is_partner_organization = true';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_partner_org_id ON public.users;
CREATE TRIGGER trg_validate_partner_org_id
  BEFORE INSERT OR UPDATE OF partner_org_id ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.validate_partner_org_id();

-- 3. Create partner_invites table
CREATE TABLE IF NOT EXISTS public.partner_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_org_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  invited_by uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz
);

-- Partial unique: only one pending invite per org+email at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_partner_invites_pending_unique
  ON public.partner_invites (partner_org_id, lower(email))
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_partner_invites_token ON public.partner_invites(token);
CREATE INDEX IF NOT EXISTS idx_partner_invites_email ON public.partner_invites(lower(email));

-- 4. RLS policies (idempotent with DROP IF EXISTS)
ALTER TABLE public.partner_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Partners can view own org invites" ON public.partner_invites;
CREATE POLICY "Partners can view own org invites"
  ON public.partner_invites FOR SELECT
  USING (partner_org_id = auth.uid());

DROP POLICY IF EXISTS "Partners can create invites for own org" ON public.partner_invites;
CREATE POLICY "Partners can create invites for own org"
  ON public.partner_invites FOR INSERT
  WITH CHECK (partner_org_id = auth.uid() AND invited_by = auth.uid());

DROP POLICY IF EXISTS "Admins can view all partner invites" ON public.partner_invites;
CREATE POLICY "Admins can view all partner invites"
  ON public.partner_invites FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role IN ('admin', 'sup')
    )
  );

DROP POLICY IF EXISTS "Users can view invites for their email" ON public.partner_invites;
CREATE POLICY "Users can view invites for their email"
  ON public.partner_invites FOR SELECT
  USING (
    lower(email) = lower(auth.jwt() ->> 'email')
  );

-- No direct client UPDATE policy — acceptance handled by RPC below

-- 5. Server-side RPC for accepting invites (SECURITY DEFINER)
--    Single atomic operation: validates token, checks expiry, sets partner_org_id, marks accepted.
CREATE OR REPLACE FUNCTION public.accept_partner_invite(invite_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite record;
  v_caller_email text;
  v_caller_id uuid;
  v_org_name text;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Get caller email
  SELECT email INTO v_caller_email
  FROM auth.users WHERE id = v_caller_id;

  -- Find the invite
  SELECT * INTO v_invite
  FROM public.partner_invites
  WHERE token = invite_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invite not found');
  END IF;

  -- Validate email match (case-insensitive)
  IF lower(v_invite.email) != lower(v_caller_email) THEN
    RETURN jsonb_build_object('success', false, 'error', 'This invite was sent to a different email address');
  END IF;

  -- Check status
  IF v_invite.status = 'accepted' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invite already accepted');
  END IF;

  -- Check expiry
  IF v_invite.expires_at < now() THEN
    UPDATE public.partner_invites SET status = 'expired' WHERE id = v_invite.id;
    RETURN jsonb_build_object('success', false, 'error', 'Invite has expired. Please ask for a new one.');
  END IF;

  IF v_invite.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invite is no longer valid');
  END IF;

  -- Set partner_org_id on the user (trigger validates the reference)
  UPDATE public.users
  SET partner_org_id = v_invite.partner_org_id
  WHERE id = v_caller_id;

  -- Mark invite accepted
  UPDATE public.partner_invites
  SET status = 'accepted', accepted_at = now()
  WHERE id = v_invite.id;

  -- Get org name for response
  SELECT
    COALESCE(
      (organization_data->>'organization_name'),
      full_name
    ) INTO v_org_name
  FROM public.users
  WHERE id = v_invite.partner_org_id;

  RETURN jsonb_build_object(
    'success', true,
    'partner_org_id', v_invite.partner_org_id,
    'organization_name', v_org_name
  );
END;
$$;
