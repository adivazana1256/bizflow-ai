-- Phase 1/2 foundation: businesses + accounts. Single-tenant per deployment,
-- so no RLS, no separate app role — the deployment is the isolation boundary.
-- business_id columns are kept for future flexibility. Applied by scripts/migrate.ts.

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- gen_random_uuid()

-- The single business this deployment serves (effectively a singleton row).
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

-- Staff who log into the approval panel. Seeded by the developer, no signup.
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

CREATE TABLE IF NOT EXISTS customers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id),
  full_name   text NOT NULL,
  phone       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS customers_business_id_idx ON customers (business_id);

CREATE TABLE IF NOT EXISTS orders (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id),
  customer_id uuid REFERENCES customers(id),
  total       integer NOT NULL,          -- minor units
  currency    text NOT NULL,
  status      text NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  source_key  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS orders_business_status_idx ON orders (business_id, status);
-- Dedup: one order per (business, source_key). NULL keys stay distinct (Postgres
-- default), so orders without a key are never collapsed.
CREATE UNIQUE INDEX IF NOT EXISTS orders_business_source_key_uq
  ON orders (business_id, source_key);

CREATE TABLE IF NOT EXISTS order_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     uuid NOT NULL REFERENCES orders(id),
  product_name text NOT NULL,
  variant_name text,
  extras       text,
  quantity     integer NOT NULL,
  unit_price   integer NOT NULL,          -- minor units
  line_total   integer NOT NULL           -- minor units
);
CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON order_items (order_id);

CREATE TABLE IF NOT EXISTS leads (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id),
  name        text NOT NULL,
  phone       text,
  interest    text,
  status      text NOT NULL DEFAULT 'new', -- new | contacted
  source_key  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS leads_business_status_idx ON leads (business_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS leads_business_source_key_uq ON leads (business_id, source_key);

CREATE TABLE IF NOT EXISTS repair_bookings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id),
  service     text NOT NULL,
  device      text,
  name        text NOT NULL,
  phone       text,
  price       integer NOT NULL DEFAULT 0, -- minor units
  currency    text NOT NULL,
  status      text NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  source_key  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS repair_bookings_business_status_idx ON repair_bookings (business_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS repair_bookings_business_source_key_uq ON repair_bookings (business_id, source_key);
