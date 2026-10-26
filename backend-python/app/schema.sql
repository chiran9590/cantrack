-- CanTrack schema (PostgreSQL 13+). Safe to re-run: every statement is idempotent.

-- ===== people =====
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(50)  NOT NULL CHECK (role IN ('admin','manager','breeder','gardener','member')),
  active        BOOLEAN      NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (lower(email));

-- ===== facility layout =====
CREATE TABLE IF NOT EXISTS glasshouses (
  code          VARCHAR(4) PRIMARY KEY CHECK (code ~ '^[A-Z0-9]{1,4}$'),
  name          VARCHAR(255) NOT NULL,
  num_platforms INT NOT NULL CHECK (num_platforms > 0),
  num_columns   INT NOT NULL CHECK (num_columns > 0),
  num_rows      INT NOT NULL CHECK (num_rows > 0),
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  description   VARCHAR(255) NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS platforms (
  glasshouse_code VARCHAR(4) NOT NULL REFERENCES glasshouses(code),
  platform_no     INT NOT NULL,
  status          VARCHAR(50) NOT NULL DEFAULT 'active',
  PRIMARY KEY (glasshouse_code, platform_no)
);

CREATE TABLE IF NOT EXISTS positions (
  position_id     VARCHAR(50) PRIMARY KEY,               -- e.g. L1-P01-C03-R27
  glasshouse_code VARCHAR(4) NOT NULL REFERENCES glasshouses(code),
  platform_no     INT NOT NULL,
  column_no       INT NOT NULL,
  row_no          INT NOT NULL,
  status          VARCHAR(50) NOT NULL DEFAULT 'active',
  UNIQUE (glasshouse_code, platform_no, column_no, row_no)
);
CREATE INDEX IF NOT EXISTS positions_platform_idx ON positions (glasshouse_code, platform_no);

-- ===== genotypes and plants =====
CREATE TABLE IF NOT EXISTS genotypes (
  gid                  VARCHAR(50) PRIMARY KEY,
  phenomeone_id        VARCHAR(50),
  info                 JSONB NOT NULL DEFAULT '{}'::jsonb,
  status               VARCHAR(50) NOT NULL DEFAULT 'active',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  phenomeone_synced_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS plants (
  uuid                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gid                 VARCHAR(50) NOT NULL REFERENCES genotypes(gid),
  status              VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active','removed')),
  sown_date           DATE,
  current_position_id VARCHAR(50) UNIQUE REFERENCES positions(position_id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by          INT REFERENCES users(id),
  CHECK (status = 'active' OR current_position_id IS NULL)
);
CREATE INDEX IF NOT EXISTS plants_gid_idx ON plants (gid);

-- ===== scanning =====
CREATE TABLE IF NOT EXISTS scan_sessions (
  id           VARCHAR(50) PRIMARY KEY,                   -- e.g. S-20261009-A3F
  user_id      INT NOT NULL REFERENCES users(id),
  source       VARCHAR(50) NOT NULL DEFAULT 'web',        -- web | mobile
  device       VARCHAR(255),
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_scan_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS plant_location_history (
  id          BIGSERIAL PRIMARY KEY,
  plant_uuid  UUID NOT NULL REFERENCES plants(uuid),
  gid         VARCHAR(50) NOT NULL,
  position_id VARCHAR(50) NOT NULL REFERENCES positions(position_id),
  moved_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_by INT NOT NULL REFERENCES users(id),
  source      VARCHAR(50) NOT NULL DEFAULT 'web',
  session_id  VARCHAR(50) REFERENCES scan_sessions(id),
  kind        VARCHAR(50) NOT NULL DEFAULT 'scan' CHECK (kind IN ('scan','correction')),
  reason      VARCHAR(255),
  device      VARCHAR(255)
);
CREATE INDEX IF NOT EXISTS history_plant_idx   ON plant_location_history (plant_uuid, moved_at DESC);
CREATE INDEX IF NOT EXISTS history_time_idx    ON plant_location_history (moved_at DESC);
CREATE INDEX IF NOT EXISTS history_session_idx ON plant_location_history (session_id);

-- Rejected scans (invalid position, occupied position, ...). Powers the map's conflict cells.
CREATE TABLE IF NOT EXISTS scan_rejections (
  id          BIGSERIAL PRIMARY KEY,
  user_id     INT REFERENCES users(id),
  position_id VARCHAR(50),
  plant_uuid  VARCHAR(50),
  reason      VARCHAR(255) NOT NULL,
  session_id  VARCHAR(50),
  source      VARCHAR(50),
  at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rejections_pos_idx ON scan_rejections (position_id, at DESC);

-- Removing a plant never deletes history: it is recorded here and the plant is marked removed.
CREATE TABLE IF NOT EXISTS plant_status_history (
  id               BIGSERIAL PRIMARY KEY,
  plant_uuid       UUID NOT NULL REFERENCES plants(uuid),
  from_status      VARCHAR(50),
  to_status        VARCHAR(50) NOT NULL CHECK (to_status IN ('active','removed')),
  last_position_id VARCHAR(50) REFERENCES positions(position_id),
  reason           VARCHAR(255) NOT NULL,
  at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_by      INT NOT NULL REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS status_hist_plant_idx ON plant_status_history (plant_uuid, at DESC);

-- ===== audit =====
CREATE TABLE IF NOT EXISTS audit_log (
  id           BIGSERIAL PRIMARY KEY,
  actor_id     INT REFERENCES users(id),
  action       VARCHAR(255) NOT NULL,
  target       VARCHAR(255),
  before_value JSONB,
  after_value  JSONB,
  at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_time_idx ON audit_log (at DESC);

-- ===== history and audit are append-only (the database itself refuses edits, not just the website) =====
CREATE OR REPLACE FUNCTION refuse_changes() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Table % is read-only: history and audit records cannot be changed or deleted', TG_TABLE_NAME;
END $$;

DROP TRIGGER IF EXISTS lock_location_history ON plant_location_history;
CREATE TRIGGER lock_location_history BEFORE UPDATE OR DELETE ON plant_location_history FOR EACH ROW EXECUTE FUNCTION refuse_changes();
DROP TRIGGER IF EXISTS lock_status_history ON plant_status_history;
CREATE TRIGGER lock_status_history BEFORE UPDATE OR DELETE ON plant_status_history FOR EACH ROW EXECUTE FUNCTION refuse_changes();
DROP TRIGGER IF EXISTS lock_audit_log ON audit_log;
CREATE TRIGGER lock_audit_log BEFORE UPDATE OR DELETE ON audit_log FOR EACH ROW EXECUTE FUNCTION refuse_changes();
