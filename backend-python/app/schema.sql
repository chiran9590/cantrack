-- CanTrack schema (PostgreSQL 13+). Safe to re-run: upgrades an older database in place.

-- ===== people =====
CREATE TABLE IF NOT EXISTS users (
  id            serial PRIMARY KEY,
  name          text NOT NULL,
  email         text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role          text NOT NULL CHECK (role IN ('admin','manager','breeder','gardener','member')),
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at timestamptz;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin','manager','breeder','gardener','member'));

-- ===== facility layout =====
CREATE TABLE IF NOT EXISTS glasshouses (
  code          text PRIMARY KEY CHECK (code ~ '^[A-Z0-9]{1,4}$'),
  name          text NOT NULL,
  num_platforms int NOT NULL CHECK (num_platforms > 0),
  num_columns   int NOT NULL CHECK (num_columns > 0),
  num_rows      int NOT NULL CHECK (num_rows > 0),
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE glasshouses ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS platforms (
  glasshouse_code text NOT NULL REFERENCES glasshouses(code),
  platform_no     int  NOT NULL,
  status          text NOT NULL DEFAULT 'active',
  PRIMARY KEY (glasshouse_code, platform_no)
);

CREATE TABLE IF NOT EXISTS positions (
  position_id     text PRIMARY KEY,               -- e.g. L1-P01-C03-R27
  glasshouse_code text NOT NULL REFERENCES glasshouses(code),
  platform_no     int  NOT NULL,
  column_no       int  NOT NULL,
  row_no          int  NOT NULL,
  status          text NOT NULL DEFAULT 'active',
  UNIQUE (glasshouse_code, platform_no, column_no, row_no)
);
CREATE INDEX IF NOT EXISTS positions_platform_idx ON positions (glasshouse_code, platform_no);

-- ===== genotypes and plants =====
CREATE TABLE IF NOT EXISTS genotypes (
  gid           text PRIMARY KEY,
  phenomeone_id text,
  info          jsonb NOT NULL DEFAULT '{}',       -- genotype details / parentage (filled from PhenomeOne)
  status        text NOT NULL DEFAULT 'active',
  created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE genotypes ADD COLUMN IF NOT EXISTS phenomeone_synced_at timestamptz;

CREATE TABLE IF NOT EXISTS plants (
  uuid                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gid                 text NOT NULL REFERENCES genotypes(gid),
  status              text NOT NULL DEFAULT 'active' CHECK (status IN ('active','removed')),
  sown_date           date,
  -- UNIQUE = a position holds at most one plant; one column = a plant has one current position
  current_position_id text UNIQUE REFERENCES positions(position_id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  CHECK (status = 'active' OR current_position_id IS NULL)
);
ALTER TABLE plants ADD COLUMN IF NOT EXISTS created_by int REFERENCES users(id);
CREATE INDEX IF NOT EXISTS plants_gid_idx ON plants (gid);

-- ===== scanning =====
CREATE TABLE IF NOT EXISTS scan_sessions (
  id           text PRIMARY KEY,                   -- e.g. S-20261009-A3F
  user_id      int  NOT NULL REFERENCES users(id),
  source       text NOT NULL DEFAULT 'web',        -- web | mobile
  device       text,
  started_at   timestamptz NOT NULL DEFAULT now(),
  last_scan_at timestamptz
);

CREATE TABLE IF NOT EXISTS plant_location_history (
  id          bigserial PRIMARY KEY,
  plant_uuid  uuid NOT NULL REFERENCES plants(uuid),
  gid         text NOT NULL,
  position_id text NOT NULL REFERENCES positions(position_id),
  moved_at    timestamptz NOT NULL DEFAULT now(),
  recorded_by int  NOT NULL REFERENCES users(id),
  source      text NOT NULL DEFAULT 'web',
  session_id  text REFERENCES scan_sessions(id)
);
ALTER TABLE plant_location_history ADD COLUMN IF NOT EXISTS kind   text NOT NULL DEFAULT 'scan' CHECK (kind IN ('scan','correction'));
ALTER TABLE plant_location_history ADD COLUMN IF NOT EXISTS reason text;
ALTER TABLE plant_location_history ADD COLUMN IF NOT EXISTS device text;
CREATE INDEX IF NOT EXISTS history_plant_idx ON plant_location_history (plant_uuid, moved_at DESC);
CREATE INDEX IF NOT EXISTS history_time_idx  ON plant_location_history (moved_at DESC);
CREATE INDEX IF NOT EXISTS history_session_idx ON plant_location_history (session_id);

-- Rejected scans (invalid position, occupied position, ...). Powers the map's conflict cells.
CREATE TABLE IF NOT EXISTS scan_rejections (
  id          bigserial PRIMARY KEY,
  user_id     int REFERENCES users(id),
  position_id text,
  plant_uuid  text,
  reason      text NOT NULL,
  session_id  text,
  source      text,
  at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rejections_pos_idx ON scan_rejections (position_id, at DESC);

-- Removing a plant never deletes history: it is recorded here and the plant is marked removed.
CREATE TABLE IF NOT EXISTS plant_status_history (
  id               bigserial PRIMARY KEY,
  plant_uuid       uuid NOT NULL REFERENCES plants(uuid),
  from_status      text,
  to_status        text NOT NULL CHECK (to_status IN ('active','removed')),
  last_position_id text REFERENCES positions(position_id),
  reason           text NOT NULL,
  at               timestamptz NOT NULL DEFAULT now(),
  recorded_by      int NOT NULL REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS status_hist_plant_idx ON plant_status_history (plant_uuid, at DESC);

-- ===== audit =====
CREATE TABLE IF NOT EXISTS audit_log (
  id           bigserial PRIMARY KEY,
  actor_id     int REFERENCES users(id),
  action       text NOT NULL,
  target       text,
  before_value jsonb,
  after_value  jsonb,
  at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_time_idx ON audit_log (at DESC);

-- History, status history and audit are append-only: the database itself rejects updates and deletes.
CREATE OR REPLACE FUNCTION forbid_change() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION '% on % is not allowed (append-only table)', TG_OP, TG_TABLE_NAME; END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS history_append_only ON plant_location_history;
CREATE TRIGGER history_append_only BEFORE UPDATE OR DELETE ON plant_location_history FOR EACH ROW EXECUTE FUNCTION forbid_change();
DROP TRIGGER IF EXISTS status_append_only ON plant_status_history;
CREATE TRIGGER status_append_only BEFORE UPDATE OR DELETE ON plant_status_history FOR EACH ROW EXECUTE FUNCTION forbid_change();
DROP TRIGGER IF EXISTS audit_append_only ON audit_log;
CREATE TRIGGER audit_append_only BEFORE UPDATE OR DELETE ON audit_log FOR EACH ROW EXECUTE FUNCTION forbid_change();

CREATE OR REPLACE FUNCTION pad2(n int) RETURNS text AS $$ SELECT CASE WHEN n < 10 THEN '0' || n ELSE n::text END $$ LANGUAGE sql IMMUTABLE;
