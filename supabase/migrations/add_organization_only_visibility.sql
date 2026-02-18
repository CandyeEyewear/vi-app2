-- Migration: Add organization_only visibility for opportunities
-- Allows partner organizations to post opportunities visible only to their team members

-- 1a. Add owner_org_id column
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS owner_org_id uuid REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_opportunities_owner_org_id ON opportunities(owner_org_id);

-- 1b. Validation trigger: enforce owner_org_id is set when visibility = 'organization_only'
CREATE OR REPLACE FUNCTION validate_org_visibility()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.visibility = 'organization_only' AND NEW.owner_org_id IS NULL THEN
    RAISE EXCEPTION 'owner_org_id must be set when visibility is organization_only';
  END IF;
  IF NEW.visibility IS DISTINCT FROM 'organization_only' THEN
    NEW.owner_org_id := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

DROP TRIGGER IF EXISTS trg_validate_org_visibility ON opportunities;
CREATE TRIGGER trg_validate_org_visibility
  BEFORE INSERT OR UPDATE ON opportunities
  FOR EACH ROW
  EXECUTE FUNCTION validate_org_visibility();

-- 1c. RLS SELECT policy for organization_only opportunities
CREATE POLICY "Org members can read org-only opportunities"
  ON opportunities
  FOR SELECT
  USING (
    visibility = 'organization_only'
    AND proposal_status = 'approved'
    AND (
      owner_org_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.partner_org_id = opportunities.owner_org_id
      )
    )
  );
