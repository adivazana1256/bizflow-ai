-- Phase 1 foundation: businesses + accounts, app role, and RLS tenant isolation.
-- Applied by scripts/migrate.ts via the ADMIN (superuser) connection.

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- gen_random_uuid()

-- App role: logs in, but is NOT a superuser and NOT a table owner, so RLS
-- policies apply to it. The runtime app connects as this role. (C2)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'bizflow_app') THEN
    CREATE ROLE bizflow_app LOGIN PASSWORD 'app_password';
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO bizflow_app;

CREATE TABLE IF NOT EXISTS businesses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  business_type text,
  email         text,
  phone         text,
  address       text,
  logo          text,
  timezone      text NOT NULL DEFAULT 'UTC',
  currency      text NOT NULL DEFAULT 'USD',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS accounts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid NOT NULL REFERENCES businesses(id),
  full_name     text NOT NULL,
  email         text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role          text NOT NULL DEFAULT 'staff',
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS accounts_business_id_idx ON accounts (business_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON businesses, accounts TO bizflow_app;

-- Row-Level Security. current_setting(..., true) returns NULL when unset, so an
-- unscoped query matches nothing (fail closed) rather than erroring.
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON businesses;
CREATE POLICY tenant_isolation ON businesses
  USING (id = current_setting('app.business_id', true)::uuid)
  WITH CHECK (id = current_setting('app.business_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation ON accounts;
CREATE POLICY tenant_isolation ON accounts
  USING (business_id = current_setting('app.business_id', true)::uuid)
  WITH CHECK (business_id = current_setting('app.business_id', true)::uuid);
